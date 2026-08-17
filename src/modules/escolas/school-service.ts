// Cadastro de escolas (tenants). Cada escola é um tenant isolado: itens, saldos,
// movimentações, inventários e usuários pertencem a uma única escola.
// Escolas com dados vinculados são INATIVADAS, nunca excluídas.
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/errors';
import { hashPassword } from '@/modules/auth/password';
import { writeAuditLog } from '@/modules/auditoria/audit-service';
import { RoleName } from '@/modules/shared/enums';
import { isSuperAdmin, manageableSchoolIds, type AuthUser } from '@/server/rbac';
import { withTransaction } from '@/server/tx';

/** Lista as escolas visíveis ao solicitante (admin global vê todas). */
export async function listSchools(actor: AuthUser) {
  const scope = manageableSchoolIds(actor);
  return prisma.school.findMany({
    where: scope === null ? {} : { id: { in: scope } },
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { users: true, items: true, movements: true } },
    },
  });
}

export async function createSchool(
  input: { name: string; code: string; address?: string },
  actor: AuthUser,
) {
  if (!isSuperAdmin(actor)) {
    throw new AppError('FORBIDDEN', 'Apenas o administrador da rede pode criar escolas.');
  }

  try {
    return await withTransaction(async (tx) => {
      const school = await tx.school.create({
        data: { name: input.name, code: input.code, address: input.address ?? null },
      });

      await writeAuditLog(
        {
          userId: actor.id,
          schoolId: school.id,
          action: 'SCHOOL_CREATE',
          resource: 'School',
          resourceId: school.id,
          after: { name: school.name, code: school.code },
        },
        tx,
      );

      return school;
    });
  } catch (err) {
    // Corrida de código único: a unicidade é garantida pelo banco (não por um
    // pré-check sujeito a TOCTOU). Traduz para uma mensagem clara.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AppError('CONFLICT', `Já existe uma escola com o código "${input.code}".`);
    }
    throw err;
  }
}

export async function updateSchool(
  schoolId: string,
  data: { name?: string; address?: string; active?: boolean },
  actor: AuthUser,
) {
  const scope = manageableSchoolIds(actor);
  if (scope !== null && !scope.includes(schoolId)) {
    throw new AppError('FORBIDDEN', 'Você não administra esta escola.');
  }

  const before = await prisma.school.findUnique({ where: { id: schoolId } });
  if (!before) throw new AppError('NOT_FOUND', 'Escola não encontrada.');

  return withTransaction(async (tx) => {
    const school = await tx.school.update({
      where: { id: schoolId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.address !== undefined ? { address: data.address } : {}),
        ...(data.active !== undefined ? { active: data.active } : {}),
      },
    });

    await writeAuditLog(
      {
        userId: actor.id,
        schoolId,
        action: 'SCHOOL_UPDATE',
        resource: 'School',
        resourceId: schoolId,
        before: { name: before.name, active: before.active },
        after: { name: school.name, active: school.active },
      },
      tx,
    );

    return school;
  });
}

// ------------------------------------------------------- Provisionamento de tenant

export interface TenantUserInput {
  role: Exclude<RoleName, 'ADMINISTRADOR'>;
  name: string;
  email: string;
  password: string;
}

export interface ProvisionTenantInput {
  name: string;
  code: string;
  address?: string;
  users: TenantUserInput[];
  /** Cria categorias e unidades de medida padrão para a escola. */
  seedCatalog?: boolean;
}

/** Categorias padrão criadas em cada novo tenant. */
const DEFAULT_CATEGORIES: Array<{ name: string; module: 'FOOD' | 'SCHOOL_MATERIAL' }> = [
  { name: 'Cereais e Grãos', module: 'FOOD' },
  { name: 'Hortifrúti', module: 'FOOD' },
  { name: 'Proteínas', module: 'FOOD' },
  { name: 'Laticínios', module: 'FOOD' },
  { name: 'Bebidas', module: 'FOOD' },
  { name: 'Escrita', module: 'SCHOOL_MATERIAL' },
  { name: 'Papelaria', module: 'SCHOOL_MATERIAL' },
  { name: 'Artes', module: 'SCHOOL_MATERIAL' },
  { name: 'Didáticos', module: 'SCHOOL_MATERIAL' },
];

const DEFAULT_UNITS: Array<[string, string]> = [
  ['Quilograma', 'kg'],
  ['Grama', 'g'],
  ['Litro', 'L'],
  ['Mililitro', 'ml'],
  ['Unidade', 'un'],
  ['Pacote', 'pct'],
  ['Caixa', 'cx'],
  ['Resma', 'rsm'],
];

/**
 * Cria um tenant completo em uma única transação: a escola, seus usuários
 * (administrador do tenant, gestor, secretário, merendeira, assistente) e os
 * cadastros básicos. Todos os usuários ficam vinculados APENAS a esta escola.
 */
export async function provisionTenant(input: ProvisionTenantInput, actor: AuthUser) {
  if (!isSuperAdmin(actor)) {
    throw new AppError('FORBIDDEN', 'Apenas o administrador da rede pode criar escolas.');
  }

  const existingSchool = await prisma.school.findUnique({ where: { code: input.code } });
  if (existingSchool) {
    throw new AppError('CONFLICT', `Já existe uma escola com o código "${input.code}".`);
  }

  // Nenhum usuário do tenant pode ser administrador global.
  for (const u of input.users) {
    if (String(u.role) === RoleName.ADMINISTRADOR) {
      throw new AppError('FORBIDDEN', 'Não é permitido criar administrador global por este fluxo.');
    }
  }

  const emails = input.users.map((u) => u.email.toLowerCase());
  const duplicated = emails.filter((e, i) => emails.indexOf(e) !== i);
  if (duplicated.length > 0) {
    throw new AppError('VALIDATION', `E-mail repetido na solicitação: ${duplicated[0]}`);
  }
  const conflict = await prisma.user.findFirst({ where: { email: { in: emails } } });
  if (conflict) {
    throw new AppError('CONFLICT', `Já existe um usuário com o e-mail "${conflict.email}".`);
  }

  // Hash fora da transação (argon2 é intencionalmente lento).
  const withHashes = await Promise.all(
    input.users.map(async (u) => ({ ...u, passwordHash: await hashPassword(u.password) })),
  );

  return prisma.$transaction(async (tx) => {
    const school = await tx.school.create({
      data: { name: input.name, code: input.code, address: input.address ?? null },
    });

    // Cadastros básicos do tenant
    if (input.seedCatalog !== false) {
      await tx.category.createMany({
        data: DEFAULT_CATEGORIES.map((c) => ({
          schoolId: school.id,
          name: c.name,
          module: c.module,
        })),
      });
      await tx.unitOfMeasure.createMany({
        data: DEFAULT_UNITS.map(([name, abbreviation]) => ({
          schoolId: school.id,
          name,
          abbreviation,
        })),
      });
      await tx.appConfig.create({
        data: { schoolId: school.id, key: 'nearExpiryDays', value: '30' },
      });
    }

    const created: Array<{ id: string; name: string; email: string; role: string }> = [];

    for (const u of withHashes) {
      const role = await tx.role.findUnique({ where: { name: String(u.role) } });
      if (!role) {
        throw new AppError('VALIDATION', `Perfil desconhecido: ${u.role}`);
      }
      const user = await tx.user.create({
        data: {
          name: u.name,
          email: u.email.toLowerCase(),
          passwordHash: u.passwordHash,
          roles: { create: { roleId: role.id } },
          // Vínculo exclusivo com o tenant recém-criado.
          schools: { create: { schoolId: school.id } },
        },
      });
      created.push({ id: user.id, name: user.name, email: user.email, role: String(u.role) });
    }

    await writeAuditLog(
      {
        userId: actor.id,
        schoolId: school.id,
        action: 'SCHOOL_CREATE',
        resource: 'School',
        resourceId: school.id,
        after: {
          name: school.name,
          code: school.code,
          usuarios: created.map((c) => ({ email: c.email, perfil: c.role })),
        } as Prisma.InputJsonValue,
      },
      tx,
    );

    return { school, users: created };
  });
}
