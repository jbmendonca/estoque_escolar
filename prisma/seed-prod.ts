// Seed de PRODUÇÃO — idempotente.
// Cria perfis, permissões, a escola/tenant inicial e o usuário administrador.
// NÃO cria usuários de demonstração nem itens fictícios (ao contrário de seed.ts).
//
// Variáveis de ambiente:
//   ADMIN_EMAIL     (obrigatória)  e-mail do administrador
//   ADMIN_PASSWORD  (obrigatória)  senha inicial do administrador
//   ADMIN_NAME      (opcional)     nome exibido
//   SCHOOL_NAME     (opcional)     nome da escola/tenant inicial
//   SCHOOL_CODE     (opcional)     código da escola/tenant inicial
import { PrismaClient } from '@prisma/client';
import { hash } from '@node-rs/argon2';

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_NAME = process.env.ADMIN_NAME?.trim() || 'Administrador do Sistema';
const SCHOOL_NAME = process.env.SCHOOL_NAME?.trim() || 'Escola Municipal';
const SCHOOL_CODE = process.env.SCHOOL_CODE?.trim() || 'ESC-001';

const PERMISSIONS: Array<{ key: string; description: string }> = [
  { key: 'item.view', description: 'Visualizar itens' },
  { key: 'item.create', description: 'Cadastrar itens' },
  { key: 'item.update', description: 'Editar itens' },
  { key: 'movement.create', description: 'Registrar movimentações' },
  { key: 'movement.view', description: 'Consultar movimentações' },
  { key: 'movement.cancel', description: 'Cancelar movimentações' },
  { key: 'adjustment.review', description: 'Revisar ajustes' },
  { key: 'inventory.manage', description: 'Realizar inventário' },
  { key: 'inventory.close', description: 'Fechar inventário' },
  { key: 'report.view', description: 'Visualizar relatórios' },
  { key: 'dashboard.view', description: 'Visualizar dashboard' },
  { key: 'catalog.manage', description: 'Gerenciar cadastros base' },
  { key: 'user.manage', description: 'Gerenciar usuários' },
  { key: 'school.manage', description: 'Gerenciar escolas' },
  { key: 'permission.manage', description: 'Gerenciar permissões' },
  { key: 'audit.view', description: 'Consultar auditoria' },
  { key: 'purchase.view', description: 'Visualizar compras e sugestões' },
  { key: 'purchase.request', description: 'Solicitar aquisição de material' },
  { key: 'purchase.approve', description: 'Aprovar ou rejeitar solicitações' },
  { key: 'purchase.manage', description: 'Gerenciar listas de compras e recebimento' },
];

const ROLE_PERMISSIONS: Record<string, Array<[string, ('FOOD' | 'SCHOOL_MATERIAL')?]>> = {
  ADMINISTRADOR: PERMISSIONS.map((p) => [p.key] as [string]),
  ADMIN_ESCOLA: [
    ['item.view'], ['item.create'], ['item.update'], ['movement.view'], ['movement.cancel'],
    ['adjustment.review'], ['report.view'], ['dashboard.view'], ['audit.view'],
    ['catalog.manage'], ['inventory.manage'], ['inventory.close'], ['user.manage'],
    ['purchase.view'], ['purchase.request'], ['purchase.approve'], ['purchase.manage'],
  ],
  GESTOR_ESCOLAR: [
    ['item.view'], ['movement.view'], ['movement.cancel'], ['adjustment.review'],
    ['report.view'], ['dashboard.view'], ['audit.view'], ['inventory.close'],
    ['purchase.view'], ['purchase.request'], ['purchase.approve'], ['purchase.manage'],
  ],
  SECRETARIO: [
    ['item.view'], ['item.create'], ['item.update'], ['movement.create'], ['movement.view'],
    ['report.view'], ['dashboard.view'], ['catalog.manage'], ['inventory.manage'],
    ['purchase.view'], ['purchase.request'], ['purchase.manage'],
  ],
  COORDENADOR: [
    ['item.view'], ['movement.view'], ['movement.create'], ['report.view'], ['dashboard.view'],
    ['purchase.view'], ['purchase.request'],
  ],
  MERENDEIRA: [
    ['item.view', 'FOOD'], ['movement.create', 'FOOD'], ['movement.view', 'FOOD'],
    ['inventory.manage', 'FOOD'], ['dashboard.view', 'FOOD'],
    ['purchase.view', 'FOOD'], ['purchase.request', 'FOOD'],
  ],
  ASSISTENTE_ALUNO: [
    ['item.view', 'SCHOOL_MATERIAL'], ['movement.create', 'SCHOOL_MATERIAL'],
    ['movement.view', 'SCHOOL_MATERIAL'], ['inventory.manage', 'SCHOOL_MATERIAL'],
    ['dashboard.view', 'SCHOOL_MATERIAL'],
    ['purchase.view', 'SCHOOL_MATERIAL'], ['purchase.request', 'SCHOOL_MATERIAL'],
  ],
};

async function main() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error('Defina ADMIN_EMAIL e ADMIN_PASSWORD no ambiente antes de rodar o seed de produção.');
  }

  // 1) Permissões base
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: p.key },
      create: { key: p.key, description: p.description },
      update: { description: p.description },
    });
  }
  // Permissões com escopo de módulo
  for (const entries of Object.values(ROLE_PERMISSIONS)) {
    for (const [key, scope] of entries) {
      if (!scope) continue;
      const scopedKey = `${key}:${scope}`;
      await prisma.permission.upsert({
        where: { key: scopedKey },
        create: { key: scopedKey, description: `${key} (${scope})`, moduleScope: scope },
        update: { moduleScope: scope },
      });
    }
  }

  // 2) Perfis e vínculos
  for (const [roleName, entries] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      create: { name: roleName, isSystem: true, description: `Perfil ${roleName}` },
      update: {},
    });
    for (const [key, scope] of entries) {
      const permission = await prisma.permission.findUnique({
        where: { key: scope ? `${key}:${scope}` : key },
      });
      if (!permission) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        create: { roleId: role.id, permissionId: permission.id },
        update: {},
      });
    }
  }
  console.log('Seed prod: perfis e permissões OK');

  // 3) Escola/tenant inicial
  const school = await prisma.school.upsert({
    where: { code: SCHOOL_CODE },
    create: { name: SCHOOL_NAME, code: SCHOOL_CODE },
    update: {},
  });

  // 4) Administrador — perfil ADMINISTRADOR (global) para poder criar novos tenants
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'ADMINISTRADOR' } });
  const passwordHash = await hash(ADMIN_PASSWORD, {
    memoryCost: 19456, timeCost: 2, outputLen: 32, parallelism: 1,
  });

  // Não reescreve a senha de um admin já existente — do contrário, todo redeploy
  // reverteria silenciosamente a senha trocada pelo administrador na aplicação.
  // Para recuperação de acesso, rode o deploy com RESET_ADMIN_PASSWORD=true.
  const resetAdminPassword = process.env.RESET_ADMIN_PASSWORD === 'true';
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    create: { name: ADMIN_NAME, email: ADMIN_EMAIL, passwordHash },
    update: resetAdminPassword ? { passwordHash } : {},
  });
  if (resetAdminPassword) {
    console.log('Seed prod: senha do administrador redefinida (RESET_ADMIN_PASSWORD=true).');
  }
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
    create: { userId: admin.id, roleId: adminRole.id },
    update: {},
  });
  await prisma.userSchool.upsert({
    where: { userId_schoolId: { userId: admin.id, schoolId: school.id } },
    create: { userId: admin.id, schoolId: school.id },
    update: {},
  });
  console.log(`Seed prod: administrador ${ADMIN_EMAIL} OK`);

  // 5) Unidades de medida da escola inicial
  const units = [
    ['Quilograma', 'kg'], ['Grama', 'g'], ['Litro', 'L'], ['Mililitro', 'ml'],
    ['Unidade', 'un'], ['Pacote', 'pct'], ['Caixa', 'cx'], ['Resma', 'rsm'],
  ] as const;
  for (const [name, abbreviation] of units) {
    await prisma.unitOfMeasure.upsert({
      where: { schoolId_abbreviation: { schoolId: school.id, abbreviation } },
      create: { schoolId: school.id, name, abbreviation },
      update: {},
    });
  }

  // 6) Categorias base por módulo, com o grupo canônico usado nos relatórios
  // e na lista de compras (alimentos separados em estivas, proteínas,
  // hortaliças, bebidas e frutas).
  const categories = [
    ['Estivas', 'FOOD', 'ESTIVAS'],
    ['Proteínas', 'FOOD', 'PROTEINAS'],
    ['Hortaliças', 'FOOD', 'HORTALICAS'],
    ['Bebidas', 'FOOD', 'BEBIDAS'],
    ['Frutas', 'FOOD', 'FRUTAS'],
    ['Material de escritório', 'SCHOOL_MATERIAL', 'MATERIAL_ESCRITORIO'],
    ['Material escolar', 'SCHOOL_MATERIAL', 'MATERIAL_ESCOLAR'],
    ['Limpeza', 'SCHOOL_MATERIAL', 'LIMPEZA'],
    ['Informática', 'SCHOOL_MATERIAL', 'INFORMATICA'],
    ['Artes', 'SCHOOL_MATERIAL', 'ARTES'],
    ['Material pedagógico', 'SCHOOL_MATERIAL', 'MATERIAL_PEDAGOGICO'],
    ['Outros', 'SCHOOL_MATERIAL', 'OUTROS'],
  ] as const;
  for (const [name, module, group] of categories) {
    await prisma.category.upsert({
      where: { schoolId_module_name: { schoolId: school.id, module, name } },
      create: { schoolId: school.id, name, module, group },
      update: { group },
    });
  }
  console.log('Seed prod: cadastros base OK');
  console.log('Seed prod: concluído.');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('Seed prod falhou:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
