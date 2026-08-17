// Seed de catálogo: 50 itens populares de Merenda Escolar e Material Escolar.
// Idempotente: pula itens que já existem (mesma escola + módulo + nome).
// Uso:  npx tsx prisma/seed-catalog.ts        (usa SCHOOL_CODE ou ESC-001)
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const SCHOOL_CODE = process.env.SCHOOL_CODE ?? 'ESC-001';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? '';

type Module = 'FOOD' | 'SCHOOL_MATERIAL';

interface SeedItem {
  name: string;
  module: Module;
  group: string; // grupo canônico da categoria (Category.group)
  unit: string; // sigla da unidade (UnitOfMeasure.abbreviation)
  minStock: number;
}

const ITEMS: SeedItem[] = [
  // ---------------- Merenda Escolar (FOOD) ----------------
  // Estivas
  { name: 'Arroz branco tipo 1', module: 'FOOD', group: 'ESTIVAS', unit: 'kg', minStock: 50 },
  { name: 'Feijão carioca', module: 'FOOD', group: 'ESTIVAS', unit: 'kg', minStock: 40 },
  { name: 'Macarrão espaguete', module: 'FOOD', group: 'ESTIVAS', unit: 'kg', minStock: 30 },
  { name: 'Farinha de trigo', module: 'FOOD', group: 'ESTIVAS', unit: 'kg', minStock: 20 },
  { name: 'Farinha de mandioca', module: 'FOOD', group: 'ESTIVAS', unit: 'kg', minStock: 15 },
  { name: 'Açúcar refinado', module: 'FOOD', group: 'ESTIVAS', unit: 'kg', minStock: 25 },
  { name: 'Sal refinado', module: 'FOOD', group: 'ESTIVAS', unit: 'kg', minStock: 10 },
  { name: 'Óleo de soja', module: 'FOOD', group: 'ESTIVAS', unit: 'L', minStock: 20 },
  { name: 'Fubá de milho', module: 'FOOD', group: 'ESTIVAS', unit: 'kg', minStock: 15 },
  { name: 'Café em pó', module: 'FOOD', group: 'ESTIVAS', unit: 'kg', minStock: 10 },
  // Proteínas
  { name: 'Peito de frango congelado', module: 'FOOD', group: 'PROTEINAS', unit: 'kg', minStock: 30 },
  { name: 'Carne bovina moída', module: 'FOOD', group: 'PROTEINAS', unit: 'kg', minStock: 25 },
  { name: 'Ovos', module: 'FOOD', group: 'PROTEINAS', unit: 'un', minStock: 100 },
  { name: 'Sardinha em lata', module: 'FOOD', group: 'PROTEINAS', unit: 'un', minStock: 40 },
  { name: 'Leite em pó integral', module: 'FOOD', group: 'PROTEINAS', unit: 'kg', minStock: 20 },
  // Hortaliças
  { name: 'Batata inglesa', module: 'FOOD', group: 'HORTALICAS', unit: 'kg', minStock: 30 },
  { name: 'Cebola', module: 'FOOD', group: 'HORTALICAS', unit: 'kg', minStock: 20 },
  { name: 'Tomate', module: 'FOOD', group: 'HORTALICAS', unit: 'kg', minStock: 20 },
  { name: 'Cenoura', module: 'FOOD', group: 'HORTALICAS', unit: 'kg', minStock: 15 },
  { name: 'Alho', module: 'FOOD', group: 'HORTALICAS', unit: 'kg', minStock: 5 },
  // Bebidas
  { name: 'Leite integral UHT', module: 'FOOD', group: 'BEBIDAS', unit: 'L', minStock: 40 },
  { name: 'Suco concentrado de uva', module: 'FOOD', group: 'BEBIDAS', unit: 'L', minStock: 15 },
  { name: 'Achocolatado em pó', module: 'FOOD', group: 'BEBIDAS', unit: 'kg', minStock: 15 },
  // Frutas
  { name: 'Banana prata', module: 'FOOD', group: 'FRUTAS', unit: 'kg', minStock: 30 },
  { name: 'Maçã', module: 'FOOD', group: 'FRUTAS', unit: 'kg', minStock: 25 },

  // ---------------- Material Escolar (SCHOOL_MATERIAL) ----------------
  // Material escolar
  { name: 'Caderno brochura 96 folhas', module: 'SCHOOL_MATERIAL', group: 'MATERIAL_ESCOLAR', unit: 'un', minStock: 100 },
  { name: 'Lápis preto nº 2', module: 'SCHOOL_MATERIAL', group: 'MATERIAL_ESCOLAR', unit: 'un', minStock: 200 },
  { name: 'Borracha branca', module: 'SCHOOL_MATERIAL', group: 'MATERIAL_ESCOLAR', unit: 'un', minStock: 100 },
  { name: 'Caneta esferográfica azul', module: 'SCHOOL_MATERIAL', group: 'MATERIAL_ESCOLAR', unit: 'un', minStock: 150 },
  { name: 'Régua 30 cm', module: 'SCHOOL_MATERIAL', group: 'MATERIAL_ESCOLAR', unit: 'un', minStock: 80 },
  { name: 'Apontador com depósito', module: 'SCHOOL_MATERIAL', group: 'MATERIAL_ESCOLAR', unit: 'un', minStock: 80 },
  { name: 'Cola branca 90g', module: 'SCHOOL_MATERIAL', group: 'MATERIAL_ESCOLAR', unit: 'un', minStock: 60 },
  { name: 'Tesoura escolar sem ponta', module: 'SCHOOL_MATERIAL', group: 'MATERIAL_ESCOLAR', unit: 'un', minStock: 50 },
  { name: 'Lápis de cor 12 cores', module: 'SCHOOL_MATERIAL', group: 'MATERIAL_ESCOLAR', unit: 'cx', minStock: 60 },
  { name: 'Giz de cera 12 cores', module: 'SCHOOL_MATERIAL', group: 'MATERIAL_ESCOLAR', unit: 'cx', minStock: 50 },
  // Material de escritório
  { name: 'Papel sulfite A4', module: 'SCHOOL_MATERIAL', group: 'MATERIAL_ESCRITORIO', unit: 'rsm', minStock: 30 },
  { name: 'Grampeador médio', module: 'SCHOOL_MATERIAL', group: 'MATERIAL_ESCRITORIO', unit: 'un', minStock: 15 },
  { name: 'Grampo 26/6', module: 'SCHOOL_MATERIAL', group: 'MATERIAL_ESCRITORIO', unit: 'cx', minStock: 40 },
  { name: 'Clipe metálico 2/0', module: 'SCHOOL_MATERIAL', group: 'MATERIAL_ESCRITORIO', unit: 'cx', minStock: 40 },
  { name: 'Pasta suspensa', module: 'SCHOOL_MATERIAL', group: 'MATERIAL_ESCRITORIO', unit: 'un', minStock: 50 },
  // Artes
  { name: 'Tinta guache 6 cores', module: 'SCHOOL_MATERIAL', group: 'ARTES', unit: 'cx', minStock: 40 },
  { name: 'Pincel nº 12', module: 'SCHOOL_MATERIAL', group: 'ARTES', unit: 'un', minStock: 60 },
  { name: 'Cartolina', module: 'SCHOOL_MATERIAL', group: 'ARTES', unit: 'un', minStock: 100 },
  { name: 'Papel crepom', module: 'SCHOOL_MATERIAL', group: 'ARTES', unit: 'un', minStock: 80 },
  { name: 'Massa de modelar 12 cores', module: 'SCHOOL_MATERIAL', group: 'ARTES', unit: 'cx', minStock: 40 },
  // Limpeza
  { name: 'Água sanitária', module: 'SCHOOL_MATERIAL', group: 'LIMPEZA', unit: 'L', minStock: 30 },
  { name: 'Detergente neutro', module: 'SCHOOL_MATERIAL', group: 'LIMPEZA', unit: 'un', minStock: 40 },
  { name: 'Sabão em pó', module: 'SCHOOL_MATERIAL', group: 'LIMPEZA', unit: 'kg', minStock: 20 },
  { name: 'Papel higiênico', module: 'SCHOOL_MATERIAL', group: 'LIMPEZA', unit: 'pct', minStock: 50 },
  // Informática
  { name: 'Pen drive 32GB', module: 'SCHOOL_MATERIAL', group: 'INFORMATICA', unit: 'un', minStock: 10 },
];

const ITEM_PREFIX: Record<Module, string> = { FOOD: 'MER', SCHOOL_MATERIAL: 'MAT' };

async function nextItemCode(tx: Prisma.TransactionClient, module: Module): Promise<string> {
  const scope = `ITEM_${ITEM_PREFIX[module]}`;
  const rows = await tx.$queryRaw<Array<{ nextValue: number }>>`
    INSERT INTO "CodeSequence" ("id", "scope", "nextValue", "updatedAt")
    VALUES (gen_random_uuid()::text, ${scope}, 2, NOW())
    ON CONFLICT ("scope")
    DO UPDATE SET "nextValue" = "CodeSequence"."nextValue" + 1, "updatedAt" = NOW()
    RETURNING ("CodeSequence"."nextValue" - 1) AS "nextValue"
  `;
  const seq = Number(rows[0]?.nextValue ?? 1);
  return `${ITEM_PREFIX[module]}-${String(seq).padStart(6, '0')}`;
}

async function main() {
  const school = await prisma.school.findUnique({ where: { code: SCHOOL_CODE } });
  if (!school) throw new Error(`Escola ${SCHOOL_CODE} não encontrada. Rode o seed de produção antes.`);

  const categories = await prisma.category.findMany({ where: { schoolId: school.id } });
  const catByGroup = new Map(
    categories.filter((c) => c.group != null).map((c) => [String(c.group), c]),
  );
  const units = await prisma.unitOfMeasure.findMany({ where: { schoolId: school.id } });
  const unitByAbbr = new Map(units.map((u) => [u.abbreviation, u]));

  const admin = ADMIN_EMAIL
    ? await prisma.user.findUnique({ where: { email: ADMIN_EMAIL }, select: { id: true } })
    : null;
  const createdById = admin?.id ?? null;

  let created = 0;
  let skipped = 0;
  const missing: string[] = [];

  for (const it of ITEMS) {
    const category = catByGroup.get(it.group);
    const unit = unitByAbbr.get(it.unit);
    if (!category || !unit) {
      missing.push(`${it.name} (grupo ${it.group} / unidade ${it.unit})`);
      continue;
    }

    const exists = await prisma.item.findFirst({
      where: { schoolId: school.id, module: it.module, name: it.name },
      select: { id: true },
    });
    if (exists) {
      skipped += 1;
      continue;
    }

    await prisma.$transaction(async (tx) => {
      const code = await nextItemCode(tx, it.module);
      const item = await tx.item.create({
        data: {
          schoolId: school.id,
          code,
          module: it.module,
          name: it.name,
          categoryId: category.id,
          unitOfMeasureId: unit.id,
          minStock: new Prisma.Decimal(it.minStock),
          createdById,
          stock: { create: { schoolId: school.id, quantity: new Prisma.Decimal(0) } },
        },
      });
      await tx.auditLog.create({
        data: {
          userId: createdById,
          schoolId: school.id,
          action: 'ITEM_CREATE',
          resource: 'Item',
          resourceId: item.id,
          after: { code, name: it.name, module: it.module } as Prisma.InputJsonValue,
        },
      });
    });
    created += 1;
  }

  console.log(`Seed catálogo: ${created} criados, ${skipped} já existiam (escola ${SCHOOL_CODE}).`);
  if (missing.length) {
    console.log(`Ignorados por falta de categoria/unidade base:\n  - ${missing.join('\n  - ')}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('Seed catálogo falhou:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
