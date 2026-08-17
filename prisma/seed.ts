// Seed idempotente para desenvolvimento: perfis, permissões, admin, escola demo,
// categorias, unidades de medida, prateleira e itens de demonstração.
import { PrismaClient, Prisma } from '@prisma/client';
import { hash } from '@node-rs/argon2';

const prisma = new PrismaClient();

const PERMISSIONS: Array<{ key: string; description: string; moduleScope?: 'FOOD' | 'SCHOOL_MATERIAL' }> = [
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
  { key: 'purchase.view', description: 'Visualizar compras e sugestões' },
  { key: 'purchase.request', description: 'Solicitar aquisição de material' },
  { key: 'purchase.approve', description: 'Aprovar ou rejeitar solicitações' },
  { key: 'purchase.manage', description: 'Gerenciar listas de compras e recebimento' },
  { key: 'dashboard.view', description: 'Visualizar dashboard' },
  { key: 'catalog.manage', description: 'Gerenciar cadastros base' },
  { key: 'user.manage', description: 'Gerenciar usuários' },
  { key: 'school.manage', description: 'Gerenciar escolas' },
  { key: 'permission.manage', description: 'Gerenciar permissões' },
  { key: 'audit.view', description: 'Consultar auditoria' },
];

/** Permissões por perfil. `[key, moduleScope?]` — moduleScope restringe ao módulo. */
const ROLE_PERMISSIONS: Record<string, Array<[string, ('FOOD' | 'SCHOOL_MATERIAL')?]>> = {
  // Administrador GLOBAL da rede municipal: cria escolas (tenants) e enxerga todas.
  ADMINISTRADOR: PERMISSIONS.map((p) => [p.key] as [string]),
  // Administrador DO TENANT: mesmas atribuições administrativas, porém restritas
  // à sua escola (não recebe 'school.manage' nem acesso global).
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
    // Secretário organiza a compra, mas não aprova a própria solicitação.
    ['purchase.view'], ['purchase.request'], ['purchase.manage'],
  ],
  COORDENADOR: [
    ['item.view'], ['movement.view'], ['movement.create'], ['report.view'], ['dashboard.view'],
    ['purchase.view'], ['purchase.request'],
  ],
  // Merendeira: EXCLUSIVAMENTE módulo de Merenda (FOOD).
  MERENDEIRA: [
    ['item.view', 'FOOD'], ['movement.create', 'FOOD'], ['movement.view', 'FOOD'],
    ['inventory.manage', 'FOOD'], ['dashboard.view', 'FOOD'],
    ['purchase.view', 'FOOD'], ['purchase.request', 'FOOD'],
  ],
  // Assistente de Aluno: EXCLUSIVAMENTE módulo de Materiais.
  ASSISTENTE_ALUNO: [
    ['item.view', 'SCHOOL_MATERIAL'], ['movement.create', 'SCHOOL_MATERIAL'],
    ['movement.view', 'SCHOOL_MATERIAL'], ['inventory.manage', 'SCHOOL_MATERIAL'],
    ['dashboard.view', 'SCHOOL_MATERIAL'],
    ['purchase.view', 'SCHOOL_MATERIAL'], ['purchase.request', 'SCHOOL_MATERIAL'],
  ],
};

async function main() {
  // Guarda de segurança: este seed cria contas de demonstração com senha
  // conhecida (Admin@123). Nunca deve rodar contra produção — o deploy usa
  // exclusivamente prisma/seed-prod.ts.
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'seed.ts é apenas para desenvolvimento. Em produção use prisma/seed-prod.ts.',
    );
  }
  console.log('Seed: iniciando...');

  // 1) Permissões (com e sem escopo de módulo)
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: p.key },
      create: { key: p.key, description: p.description },
      update: { description: p.description },
    });
  }
  // Permissões com escopo de módulo (chave sufixada para unicidade)
  for (const [, entries] of Object.entries(ROLE_PERMISSIONS)) {
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

  // 2) Perfis + vínculo de permissões
  for (const [roleName, entries] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      create: { name: roleName, isSystem: true, description: `Perfil ${roleName}` },
      update: {},
    });

    for (const [key, scope] of entries) {
      // Para papéis restritos por módulo, guardamos a permissão escopada.
      const permKey = scope ? `${key}:${scope}` : key;
      const permission = await prisma.permission.findUnique({ where: { key: permKey } });
      if (!permission) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        create: { roleId: role.id, permissionId: permission.id },
        update: {},
      });
    }
  }
  console.log('Seed: perfis e permissões OK');

  // 3) Escola de demonstração
  const school = await prisma.school.upsert({
    where: { code: 'ESC-DEMO' },
    create: { name: 'Escola Municipal de Demonstração', code: 'ESC-DEMO' },
    update: {},
  });

  // 4) Usuários de desenvolvimento
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'ADMINISTRADOR' } });
  const passwordHash = await hash('Admin@123', {
    memoryCost: 19456, timeCost: 2, outputLen: 32, parallelism: 1,
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@escola.dev' },
    create: { name: 'Administrador do Sistema', email: 'admin@escola.dev', passwordHash },
    update: {},
  });
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

  // Usuários de teste dos perfis restritos por módulo
  for (const [email, name, roleName] of [
    ['merendeira@escola.dev', 'Maria Merendeira', 'MERENDEIRA'],
    ['assistente@escola.dev', 'Ana Assistente', 'ASSISTENTE_ALUNO'],
    ['secretario@escola.dev', 'Sérgio Secretário', 'SECRETARIO'],
    ['gestor@escola.dev', 'Gabriela Gestora', 'GESTOR_ESCOLAR'],
  ] as const) {
    const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
    const user = await prisma.user.upsert({
      where: { email },
      create: { name, email, passwordHash },
      update: {},
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      create: { userId: user.id, roleId: role.id },
      update: {},
    });
    await prisma.userSchool.upsert({
      where: { userId_schoolId: { userId: user.id, schoolId: school.id } },
      create: { userId: user.id, schoolId: school.id },
      update: {},
    });
  }
  console.log('Seed: usuários OK (senha padrão: Admin@123)');

  // 5) Unidades de medida
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

  // 6) Categorias por módulo, já vinculadas ao grupo canônico.
  // Alimentos: estivas, proteínas, hortaliças, bebidas e frutas.
  // Materiais: escritório, escolar, limpeza, informática, artes, pedagógico e outros.
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

  // Categorias antigas (de instalações anteriores) recebem o grupo equivalente,
  // para que continuem aparecendo corretamente nos relatórios e nas compras.
  const legacyGroups = [
    ['Cereais e Grãos', 'ESTIVAS'], ['Hortifrúti', 'HORTALICAS'], ['Laticínios', 'PROTEINAS'],
    ['Escrita', 'MATERIAL_ESCOLAR'], ['Papelaria', 'MATERIAL_ESCRITORIO'],
    ['Didáticos', 'MATERIAL_PEDAGOGICO'],
  ] as const;
  for (const [name, group] of legacyGroups) {
    await prisma.category.updateMany({
      where: { schoolId: school.id, name, group: null },
      data: { group },
    });
  }

  // 7) Prateleira de exemplo
  await prisma.storageLocation.upsert({
    where: { schoolId_code: { schoolId: school.id, code: 'ALM-01-A-01' } },
    create: {
      schoolId: school.id, code: 'ALM-01-A-01', warehouse: 'Almoxarifado 01',
      shelf: 'A', rack: '01', description: 'Prateleira principal',
    },
    update: {},
  });
  console.log('Seed: cadastros base OK');

  // 8) Itens de demonstração (com código sequencial e características)
  await seedDemoItems(school.id, admin.id);

  console.log('Seed: concluído.');
}

async function seedDemoItems(schoolId: string, userId: string) {
  const existing = await prisma.item.count({ where: { schoolId } });
  if (existing > 0) {
    console.log('Seed: itens de demonstração já existem, pulando.');
    return;
  }

  const unKg = await prisma.unitOfMeasure.findFirstOrThrow({ where: { schoolId, abbreviation: 'kg' } });
  const unUn = await prisma.unitOfMeasure.findFirstOrThrow({ where: { schoolId, abbreviation: 'un' } });
  const catCereais = await prisma.category.findFirstOrThrow({ where: { schoolId, name: 'Estivas' } });
  const catEscrita = await prisma.category.findFirstOrThrow({ where: { schoolId, name: 'Material escolar' } });
  const local = await prisma.storageLocation.findFirstOrThrow({ where: { schoolId, code: 'ALM-01-A-01' } });

  const demo = [
    {
      module: 'FOOD' as const, name: 'Arroz Branco Tipo 1', categoryId: catCereais.id,
      unitOfMeasureId: unKg.id, minStock: 20, brand: 'Tio João',
      characteristics: [{ key: 'Marca', value: 'Tio João' }, { key: 'Tipo', value: 'Longo fino' }],
    },
    {
      module: 'FOOD' as const, name: 'Feijão Carioca', categoryId: catCereais.id,
      unitOfMeasureId: unKg.id, minStock: 15, brand: 'Camil',
      characteristics: [{ key: 'Marca', value: 'Camil' }, { key: 'Tipo', value: 'Carioca' }],
    },
    {
      module: 'SCHOOL_MATERIAL' as const, name: 'Caneta Esferográfica Azul', categoryId: catEscrita.id,
      unitOfMeasureId: unUn.id, minStock: 50, brand: 'Faber-Castell',
      characteristics: [
        { key: 'Marca', value: 'Faber-Castell' }, { key: 'Cor', value: 'Azul' },
        { key: 'Material', value: 'Plástico' },
      ],
    },
    {
      module: 'SCHOOL_MATERIAL' as const, name: 'Caderno Universitário 200 folhas',
      categoryId: catEscrita.id, unitOfMeasureId: unUn.id, minStock: 30, brand: 'Tilibra',
      characteristics: [
        { key: 'Marca', value: 'Tilibra' }, { key: 'Folhas', value: '200' }, { key: 'Cor', value: 'Azul' },
      ],
    },
  ];

  for (const d of demo) {
    const scope = d.module === 'FOOD' ? 'ITEM_MER' : 'ITEM_MAT';
    const prefix = d.module === 'FOOD' ? 'MER' : 'MAT';
    const rows = await prisma.$queryRaw<Array<{ nextValue: number }>>`
      INSERT INTO "CodeSequence" ("id", "scope", "nextValue", "updatedAt")
      VALUES (gen_random_uuid()::text, ${scope}, 2, NOW())
      ON CONFLICT ("scope")
      DO UPDATE SET "nextValue" = "CodeSequence"."nextValue" + 1, "updatedAt" = NOW()
      RETURNING ("CodeSequence"."nextValue" - 1) AS "nextValue"
    `;
    const seq = Number(rows[0]?.nextValue ?? 1);
    const code = `${prefix}-${String(seq).padStart(6, '0')}`;

    await prisma.item.create({
      data: {
        schoolId, code, module: d.module, name: d.name, categoryId: d.categoryId,
        unitOfMeasureId: d.unitOfMeasureId, storageLocationId: local.id, brand: d.brand,
        minStock: new Prisma.Decimal(d.minStock), createdById: userId,
        characteristics: { create: d.characteristics },
        stock: { create: { schoolId, quantity: new Prisma.Decimal(0) } },
      },
    });
  }
  console.log('Seed: itens de demonstração OK');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('Seed falhou:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
