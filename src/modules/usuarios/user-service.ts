// Gestão de usuários. Usuários com histórico são INATIVADOS, nunca excluídos
// (preserva a rastreabilidade das movimentações — Princípio II da constituição).
// Dados pessoais mínimos: apenas nome e e-mail (LGPD — minimização).
import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/errors';
import { hashPassword } from '@/modules/auth/password';
import { writeAuditLog } from '@/modules/auditoria/audit-service';
import {
  assignableRoles,
  manageableSchoolIds,
  isSuperAdmin,
  type AuthUser,
} from '@/server/rbac';

/**
 * Lista usuários DENTRO do escopo do solicitante.
 * Administrador global vê todos; administrador de tenant vê apenas usuários
 * vinculados à(s) sua(s) escola(s) — isolamento entre escolas.
 */
export async function listUsers(actor: AuthUser) {
  const scope = manageableSchoolIds(actor);
  return prisma.user.findMany({
    where: scope === null ? {} : { schools: { some: { schoolId: { in: scope } } } },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      email: true,
      active: true,
      createdAt: true,
      roles: { select: { role: { select: { name: true } } } },
      schools: { select: { school: { select: { name: true, code: true } } } },
      _count: { select: { movements: true } },
    },
  });
}

/** Papéis que o solicitante pode atribuir (bloqueia escalonamento de privilégio). */
export async function listRoles(actor: AuthUser) {
  const allowed = assignableRoles(actor).map(String);
  return prisma.role.findMany({
    where: { name: { in: allowed } },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });
}

/**
 * Valida papéis e escolas informados contra o que o solicitante pode conceder.
 * Um administrador de tenant não pode criar administradores nem vincular
 * usuários a outras escolas.
 */
async function assertCanGrant(actor: AuthUser, roleIds: string[], schoolIds: string[]) {
  if (roleIds.length > 0) {
    const allowed = assignableRoles(actor).map(String);
    const roles = await prisma.role.findMany({
      where: { id: { in: roleIds } },
      select: { name: true },
    });
    const forbidden = roles.filter((r) => !allowed.includes(r.name));
    if (forbidden.length > 0) {
      throw new AppError(
        'FORBIDDEN',
        `Você não pode conceder o perfil ${forbidden.map((r) => r.name).join(', ')}.`,
      );
    }
  }

  const scope = manageableSchoolIds(actor);
  if (scope !== null) {
    const foraDoEscopo = schoolIds.filter((id) => !scope.includes(id));
    if (foraDoEscopo.length > 0) {
      throw new AppError('FORBIDDEN', 'Você só pode vincular usuários à sua própria escola.');
    }
    if (schoolIds.length === 0) {
      throw new AppError('VALIDATION', 'Selecione a escola do usuário.');
    }
  }
}

/** Garante que o alvo da edição está dentro do escopo do solicitante. */
async function assertCanManageUser(actor: AuthUser, userId: string) {
  if (isSuperAdmin(actor)) return;
  const scope = manageableSchoolIds(actor) ?? [];
  const target = await prisma.user.findFirst({
    where: { id: userId, schools: { some: { schoolId: { in: scope } } } },
    select: { id: true },
  });
  if (!target) {
    throw new AppError('FORBIDDEN', 'Este usuário não pertence à sua escola.');
  }
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  roleIds: string[];
  schoolIds: string[];
}

export async function createUser(input: CreateUserInput, actor: AuthUser) {
  const actorId = actor.id;
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new AppError('CONFLICT', `Já existe um usuário com o e-mail "${input.email}".`);
  }
  if (input.roleIds.length === 0) {
    throw new AppError('VALIDATION', 'Selecione ao menos um perfil de acesso.');
  }
  await assertCanGrant(actor, input.roleIds, input.schoolIds);

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        roles: { create: input.roleIds.map((roleId) => ({ roleId })) },
        schools: { create: input.schoolIds.map((schoolId) => ({ schoolId })) },
      },
    });

    await writeAuditLog(
      {
        userId: actorId,
        action: 'USER_CREATE',
        resource: 'User',
        resourceId: created.id,
        // Nunca registrar senha/hash na auditoria.
        after: { name: created.name, email: created.email },
      },
      tx,
    );

    return created;
  });

  return { id: user.id, name: user.name, email: user.email, active: user.active };
}

export async function updateUser(
  userId: string,
  data: { name?: string; active?: boolean; roleIds?: string[]; schoolIds?: string[] },
  actor: AuthUser,
) {
  const actorId = actor.id;
  const before = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, active: true },
  });
  if (!before) throw new AppError('NOT_FOUND', 'Usuário não encontrado.');

  // Isolamento: só administra quem pertence ao seu escopo.
  await assertCanManageUser(actor, userId);
  if (data.roleIds || data.schoolIds) {
    await assertCanGrant(actor, data.roleIds ?? [], data.schoolIds ?? []);
  }

  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: userId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.active !== undefined ? { active: data.active } : {}),
      },
    });

    if (data.roleIds) {
      await tx.userRole.deleteMany({ where: { userId } });
      await tx.userRole.createMany({ data: data.roleIds.map((roleId) => ({ userId, roleId })) });
    }
    if (data.schoolIds) {
      await tx.userSchool.deleteMany({ where: { userId } });
      await tx.userSchool.createMany({
        data: data.schoolIds.map((schoolId) => ({ userId, schoolId })),
      });
    }

    await writeAuditLog(
      {
        userId: actorId,
        action: 'USER_UPDATE',
        resource: 'User',
        resourceId: userId,
        before: { name: before.name, active: before.active },
        after: { name: updated.name, active: updated.active },
      },
      tx,
    );

    return updated;
  });

  return { id: user.id, name: user.name, active: user.active };
}

/**
 * Inativa um usuário. Nunca exclui: o histórico de movimentações precisa
 * continuar apontando para o responsável.
 */
export async function deactivateUser(userId: string, actor: AuthUser) {
  if (userId === actor.id) {
    throw new AppError('VALIDATION', 'Você não pode desativar o seu próprio usuário.');
  }
  return updateUser(userId, { active: false }, actor);
}
