// Gera itens de demonstração: 30 de Merenda (FOOD) e 30 de Materiais (SCHOOL_MATERIAL).
// Usa a mesma sequência transacional de códigos do sistema (MER-/MAT-), garantindo
// códigos únicos e não reutilizáveis. Idempotente: pula itens de mesmo nome já existentes.
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

type Char = { key: string; value: string };
type Spec = {
  name: string;
  category: string;
  unit: string;
  brand?: string;
  minStock: number;
  characteristics: Char[];
};

const FOOD: Spec[] = [
  { name: 'Arroz Parboilizado Tipo 1', category: 'Cereais e Grãos', unit: 'kg', brand: 'Camil', minStock: 50, characteristics: [{ key: 'Marca', value: 'Camil' }, { key: 'Tipo', value: 'Parboilizado' }, { key: 'Embalagem', value: '5 kg' }] },
  { name: 'Feijão Preto', category: 'Cereais e Grãos', unit: 'kg', brand: 'Kicaldo', minStock: 40, characteristics: [{ key: 'Marca', value: 'Kicaldo' }, { key: 'Tipo', value: 'Preto' }] },
  { name: 'Macarrão Parafuso', category: 'Cereais e Grãos', unit: 'kg', brand: 'Renata', minStock: 30, characteristics: [{ key: 'Marca', value: 'Renata' }, { key: 'Formato', value: 'Parafuso' }, { key: 'Sêmola', value: 'Com ovos' }] },
  { name: 'Macarrão Espaguete', category: 'Cereais e Grãos', unit: 'kg', brand: 'Adria', minStock: 30, characteristics: [{ key: 'Marca', value: 'Adria' }, { key: 'Formato', value: 'Espaguete' }] },
  { name: 'Farinha de Trigo', category: 'Cereais e Grãos', unit: 'kg', brand: 'Dona Benta', minStock: 25, characteristics: [{ key: 'Marca', value: 'Dona Benta' }, { key: 'Tipo', value: 'Tipo 1' }] },
  { name: 'Farinha de Mandioca', category: 'Cereais e Grãos', unit: 'kg', brand: 'Yoki', minStock: 20, characteristics: [{ key: 'Marca', value: 'Yoki' }, { key: 'Tipo', value: 'Torrada' }] },
  { name: 'Fubá de Milho', category: 'Cereais e Grãos', unit: 'kg', brand: 'Sinhá', minStock: 20, characteristics: [{ key: 'Marca', value: 'Sinhá' }] },
  { name: 'Aveia em Flocos', category: 'Cereais e Grãos', unit: 'kg', brand: 'Quaker', minStock: 15, characteristics: [{ key: 'Marca', value: 'Quaker' }, { key: 'Tipo', value: 'Flocos finos' }] },
  { name: 'Açúcar Cristal', category: 'Cereais e Grãos', unit: 'kg', brand: 'União', minStock: 40, characteristics: [{ key: 'Marca', value: 'União' }, { key: 'Tipo', value: 'Cristal' }] },
  { name: 'Sal Refinado Iodado', category: 'Cereais e Grãos', unit: 'kg', brand: 'Cisne', minStock: 20, characteristics: [{ key: 'Marca', value: 'Cisne' }, { key: 'Iodado', value: 'Sim' }] },
  { name: 'Óleo de Soja', category: 'Cereais e Grãos', unit: 'L', brand: 'Liza', minStock: 30, characteristics: [{ key: 'Marca', value: 'Liza' }, { key: 'Embalagem', value: '900 ml' }] },
  { name: 'Batata Inglesa', category: 'Hortifrúti', unit: 'kg', minStock: 30, characteristics: [{ key: 'Origem', value: 'Nacional' }, { key: 'Classificação', value: 'Lavada' }] },
  { name: 'Cenoura', category: 'Hortifrúti', unit: 'kg', minStock: 20, characteristics: [{ key: 'Origem', value: 'Nacional' }] },
  { name: 'Cebola', category: 'Hortifrúti', unit: 'kg', minStock: 20, characteristics: [{ key: 'Tipo', value: 'Branca' }] },
  { name: 'Alho', category: 'Hortifrúti', unit: 'kg', minStock: 8, characteristics: [{ key: 'Tipo', value: 'Roxo' }] },
  { name: 'Tomate', category: 'Hortifrúti', unit: 'kg', minStock: 20, characteristics: [{ key: 'Tipo', value: 'Salada' }] },
  { name: 'Abóbora Cabotiá', category: 'Hortifrúti', unit: 'kg', minStock: 15, characteristics: [{ key: 'Variedade', value: 'Cabotiá' }] },
  { name: 'Banana Prata', category: 'Hortifrúti', unit: 'kg', minStock: 25, characteristics: [{ key: 'Variedade', value: 'Prata' }] },
  { name: 'Maçã Nacional', category: 'Hortifrúti', unit: 'kg', minStock: 25, characteristics: [{ key: 'Variedade', value: 'Gala' }] },
  { name: 'Laranja Pera', category: 'Hortifrúti', unit: 'kg', minStock: 25, characteristics: [{ key: 'Variedade', value: 'Pera' }] },
  { name: 'Carne Bovina Moída', category: 'Proteínas', unit: 'kg', minStock: 25, characteristics: [{ key: 'Corte', value: 'Acém' }, { key: 'Conservação', value: 'Congelada' }] },
  { name: 'Peito de Frango Congelado', category: 'Proteínas', unit: 'kg', brand: 'Sadia', minStock: 30, characteristics: [{ key: 'Marca', value: 'Sadia' }, { key: 'Corte', value: 'Peito' }, { key: 'Conservação', value: 'Congelado' }] },
  { name: 'Filé de Merluza Congelado', category: 'Proteínas', unit: 'kg', minStock: 15, characteristics: [{ key: 'Espécie', value: 'Merluza' }, { key: 'Conservação', value: 'Congelado' }] },
  { name: 'Ovos de Galinha', category: 'Proteínas', unit: 'un', minStock: 200, characteristics: [{ key: 'Tipo', value: 'Vermelho' }, { key: 'Tamanho', value: 'Grande' }] },
  { name: 'Lentilha', category: 'Proteínas', unit: 'kg', minStock: 10, characteristics: [{ key: 'Tipo', value: 'Seca' }] },
  { name: 'Leite Integral UHT', category: 'Laticínios', unit: 'L', brand: 'Italac', minStock: 60, characteristics: [{ key: 'Marca', value: 'Italac' }, { key: 'Tipo', value: 'Integral' }, { key: 'Embalagem', value: '1 L' }] },
  { name: 'Leite em Pó Integral', category: 'Laticínios', unit: 'kg', brand: 'Ninho', minStock: 20, characteristics: [{ key: 'Marca', value: 'Ninho' }, { key: 'Tipo', value: 'Integral' }] },
  { name: 'Queijo Muçarela Fatiado', category: 'Laticínios', unit: 'kg', minStock: 10, characteristics: [{ key: 'Tipo', value: 'Muçarela' }, { key: 'Apresentação', value: 'Fatiado' }] },
  { name: 'Iogurte Natural', category: 'Laticínios', unit: 'L', brand: 'Danone', minStock: 15, characteristics: [{ key: 'Marca', value: 'Danone' }, { key: 'Sabor', value: 'Natural' }] },
  { name: 'Suco de Uva Integral', category: 'Bebidas', unit: 'L', brand: 'Aurora', minStock: 20, characteristics: [{ key: 'Marca', value: 'Aurora' }, { key: 'Sabor', value: 'Uva' }, { key: 'Tipo', value: 'Integral' }] },
];

const MATERIAL: Spec[] = [
  { name: 'Lápis Preto nº 2', category: 'Escrita', unit: 'un', brand: 'Faber-Castell', minStock: 200, characteristics: [{ key: 'Marca', value: 'Faber-Castell' }, { key: 'Graduação', value: 'HB nº 2' }, { key: 'Material', value: 'Madeira' }] },
  { name: 'Lapiseira 0.7mm', category: 'Escrita', unit: 'un', brand: 'Pentel', minStock: 40, characteristics: [{ key: 'Marca', value: 'Pentel' }, { key: 'Espessura', value: '0.7 mm' }] },
  { name: 'Caneta Esferográfica Preta', category: 'Escrita', unit: 'un', brand: 'BIC', minStock: 150, characteristics: [{ key: 'Marca', value: 'BIC' }, { key: 'Cor', value: 'Preta' }, { key: 'Ponta', value: '1.0 mm' }] },
  { name: 'Caneta Esferográfica Vermelha', category: 'Escrita', unit: 'un', brand: 'BIC', minStock: 80, characteristics: [{ key: 'Marca', value: 'BIC' }, { key: 'Cor', value: 'Vermelha' }] },
  { name: 'Caneta Marca-Texto Amarela', category: 'Escrita', unit: 'un', brand: 'Faber-Castell', minStock: 50, characteristics: [{ key: 'Marca', value: 'Faber-Castell' }, { key: 'Cor', value: 'Amarela' }] },
  { name: 'Borracha Branca', category: 'Escrita', unit: 'un', brand: 'Mercur', minStock: 120, characteristics: [{ key: 'Marca', value: 'Mercur' }, { key: 'Cor', value: 'Branca' }, { key: 'Material', value: 'Látex' }] },
  { name: 'Apontador com Depósito', category: 'Escrita', unit: 'un', brand: 'Faber-Castell', minStock: 80, characteristics: [{ key: 'Marca', value: 'Faber-Castell' }, { key: 'Depósito', value: 'Sim' }] },
  { name: 'Giz de Cera 12 Cores', category: 'Artes', unit: 'cx', brand: 'Acrilex', minStock: 40, characteristics: [{ key: 'Marca', value: 'Acrilex' }, { key: 'Cores', value: '12' }] },
  { name: 'Lápis de Cor 24 Cores', category: 'Artes', unit: 'cx', brand: 'Faber-Castell', minStock: 50, characteristics: [{ key: 'Marca', value: 'Faber-Castell' }, { key: 'Cores', value: '24' }] },
  { name: 'Caderno Brochura 96 folhas', category: 'Papelaria', unit: 'un', brand: 'Tilibra', minStock: 100, characteristics: [{ key: 'Marca', value: 'Tilibra' }, { key: 'Folhas', value: '96' }, { key: 'Tipo', value: 'Brochura' }] },
  { name: 'Caderno Espiral 96 folhas', category: 'Papelaria', unit: 'un', brand: 'Foroni', minStock: 80, characteristics: [{ key: 'Marca', value: 'Foroni' }, { key: 'Folhas', value: '96' }, { key: 'Tipo', value: 'Espiral' }] },
  { name: 'Caderno de Desenho 60 folhas', category: 'Papelaria', unit: 'un', brand: 'Credeal', minStock: 50, characteristics: [{ key: 'Marca', value: 'Credeal' }, { key: 'Folhas', value: '60' }] },
  { name: 'Papel Sulfite A4 75g', category: 'Papelaria', unit: 'rsm', brand: 'Report', minStock: 30, characteristics: [{ key: 'Marca', value: 'Report' }, { key: 'Tamanho', value: 'A4' }, { key: 'Gramatura', value: '75g' }, { key: 'Folhas', value: '500' }] },
  { name: 'Papel Sulfite A4 Colorido', category: 'Papelaria', unit: 'rsm', brand: 'Chamex', minStock: 10, characteristics: [{ key: 'Marca', value: 'Chamex' }, { key: 'Tamanho', value: 'A4' }, { key: 'Cor', value: 'Sortida' }] },
  { name: 'Cartolina Branca', category: 'Papelaria', unit: 'un', minStock: 100, characteristics: [{ key: 'Cor', value: 'Branca' }, { key: 'Tamanho', value: '50x66 cm' }] },
  { name: 'Cartolina Colorida', category: 'Papelaria', unit: 'un', minStock: 100, characteristics: [{ key: 'Cor', value: 'Sortida' }, { key: 'Tamanho', value: '50x66 cm' }] },
  { name: 'Papel Crepom', category: 'Artes', unit: 'un', minStock: 60, characteristics: [{ key: 'Cor', value: 'Sortida' }] },
  { name: 'Papel Camurça', category: 'Artes', unit: 'un', minStock: 40, characteristics: [{ key: 'Cor', value: 'Sortida' }] },
  { name: 'EVA Liso', category: 'Artes', unit: 'un', minStock: 60, characteristics: [{ key: 'Cor', value: 'Sortida' }, { key: 'Espessura', value: '2 mm' }] },
  { name: 'Cola Branca 90g', category: 'Artes', unit: 'un', brand: 'Tenaz', minStock: 80, characteristics: [{ key: 'Marca', value: 'Tenaz' }, { key: 'Volume', value: '90 g' }, { key: 'Tipo', value: 'Lavável' }] },
  { name: 'Cola Bastão 20g', category: 'Artes', unit: 'un', brand: 'Pritt', minStock: 60, characteristics: [{ key: 'Marca', value: 'Pritt' }, { key: 'Volume', value: '20 g' }] },
  { name: 'Tesoura Escolar sem Ponta', category: 'Artes', unit: 'un', brand: 'Mundial', minStock: 70, characteristics: [{ key: 'Marca', value: 'Mundial' }, { key: 'Ponta', value: 'Arredondada' }, { key: 'Tamanho', value: '13 cm' }] },
  { name: 'Pincel Escolar nº 12', category: 'Artes', unit: 'un', brand: 'Condor', minStock: 40, characteristics: [{ key: 'Marca', value: 'Condor' }, { key: 'Número', value: '12' }] },
  { name: 'Tinta Guache 15ml', category: 'Artes', unit: 'un', brand: 'Acrilex', minStock: 60, characteristics: [{ key: 'Marca', value: 'Acrilex' }, { key: 'Volume', value: '15 ml' }, { key: 'Cor', value: 'Sortida' }] },
  { name: 'Massa de Modelar 12 Cores', category: 'Artes', unit: 'cx', brand: 'Acrilex', minStock: 30, characteristics: [{ key: 'Marca', value: 'Acrilex' }, { key: 'Cores', value: '12' }] },
  { name: 'Régua 30cm', category: 'Escrita', unit: 'un', brand: 'Waleu', minStock: 80, characteristics: [{ key: 'Marca', value: 'Waleu' }, { key: 'Tamanho', value: '30 cm' }, { key: 'Material', value: 'Acrílico' }] },
  { name: 'Apagador para Quadro Branco', category: 'Didáticos', unit: 'un', brand: 'Cortiarte', minStock: 20, characteristics: [{ key: 'Marca', value: 'Cortiarte' }, { key: 'Uso', value: 'Quadro branco' }] },
  { name: 'Pincel para Quadro Branco', category: 'Didáticos', unit: 'un', brand: 'Pilot', minStock: 60, characteristics: [{ key: 'Marca', value: 'Pilot' }, { key: 'Cor', value: 'Preta' }, { key: 'Recarregável', value: 'Sim' }] },
  { name: 'Livro Didático de Matemática', category: 'Didáticos', unit: 'un', minStock: 40, characteristics: [{ key: 'Disciplina', value: 'Matemática' }, { key: 'Etapa', value: 'Ensino Fundamental' }] },
  { name: 'Mapa do Brasil Escolar', category: 'Didáticos', unit: 'un', minStock: 10, characteristics: [{ key: 'Tema', value: 'Político' }, { key: 'Tamanho', value: '120x90 cm' }] },
];

/** Reserva o próximo valor da sequência de forma atômica (mesma lógica do sistema). */
async function nextSequence(tx: Prisma.TransactionClient, scope: string): Promise<number> {
  const rows = await tx.$queryRaw<Array<{ nextValue: number }>>`
    INSERT INTO "CodeSequence" ("id", "scope", "nextValue", "updatedAt")
    VALUES (gen_random_uuid()::text, ${scope}, 2, NOW())
    ON CONFLICT ("scope")
    DO UPDATE SET "nextValue" = "CodeSequence"."nextValue" + 1, "updatedAt" = NOW()
    RETURNING ("CodeSequence"."nextValue" - 1) AS "nextValue"
  `;
  return Number(rows[0]?.nextValue ?? 1);
}

async function createItems(
  specs: Spec[],
  module: 'FOOD' | 'SCHOOL_MATERIAL',
  schoolId: string,
  userId: string,
  locationIds: string[],
) {
  const prefix = module === 'FOOD' ? 'MER' : 'MAT';
  const scope = module === 'FOOD' ? 'ITEM_MER' : 'ITEM_MAT';
  let created = 0;
  let skipped = 0;

  for (const [index, spec] of specs.entries()) {
    const exists = await prisma.item.findFirst({ where: { schoolId, module, name: spec.name } });
    if (exists) {
      skipped += 1;
      continue;
    }

    const category = await prisma.category.findFirst({
      where: { schoolId, module, name: spec.category },
    });
    const unit = await prisma.unitOfMeasure.findFirst({
      where: { schoolId, abbreviation: spec.unit },
    });
    if (!category || !unit) {
      console.warn(`  ! ${spec.name}: categoria "${spec.category}" ou unidade "${spec.unit}" ausente`);
      continue;
    }

    // Distribui os itens entre as prateleiras disponíveis.
    const locationId = locationIds[index % locationIds.length];

    await prisma.$transaction(async (tx) => {
      const seq = await nextSequence(tx, scope);
      const code = `${prefix}-${String(seq).padStart(6, '0')}`;

      const item = await tx.item.create({
        data: {
          schoolId,
          code,
          module,
          name: spec.name,
          categoryId: category.id,
          unitOfMeasureId: unit.id,
          storageLocationId: locationId ?? null,
          brand: spec.brand ?? null,
          minStock: new Prisma.Decimal(spec.minStock),
          createdById: userId,
          characteristics: { create: spec.characteristics },
          stock: { create: { schoolId, quantity: new Prisma.Decimal(0) } },
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          schoolId,
          action: 'ITEM_CREATE',
          resource: 'Item',
          resourceId: item.id,
          after: { code, name: item.name, module } as Prisma.InputJsonValue,
        },
      });
    });

    created += 1;
  }

  return { created, skipped };
}

async function main() {
  const school = await prisma.school.findUniqueOrThrow({ where: { code: 'ESC-DEMO' } });
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@escola.dev' } });

  // Garante algumas prateleiras para distribuir os itens.
  const locationSpecs = [
    { code: 'ALM-01-A-01', warehouse: 'Almoxarifado 01', shelf: 'A', rack: '01', description: 'Prateleira principal' },
    { code: 'ALM-01-A-02', warehouse: 'Almoxarifado 01', shelf: 'A', rack: '02', description: 'Secos e grãos' },
    { code: 'ALM-01-B-01', warehouse: 'Almoxarifado 01', shelf: 'B', rack: '01', description: 'Hortifrúti' },
    { code: 'ALM-02-A-01', warehouse: 'Almoxarifado 02', shelf: 'A', rack: '01', description: 'Papelaria' },
    { code: 'ALM-02-B-01', warehouse: 'Almoxarifado 02', shelf: 'B', rack: '01', description: 'Artes e didáticos' },
  ];
  const locationIds: string[] = [];
  for (const loc of locationSpecs) {
    const created = await prisma.storageLocation.upsert({
      where: { schoolId_code: { schoolId: school.id, code: loc.code } },
      create: { schoolId: school.id, ...loc },
      update: {},
    });
    locationIds.push(created.id);
  }

  console.log(`Criando itens na escola "${school.name}"...`);

  const food = await createItems(FOOD, 'FOOD', school.id, admin.id, locationIds);
  console.log(`  Merenda:   ${food.created} criados, ${food.skipped} já existiam`);

  const material = await createItems(MATERIAL, 'SCHOOL_MATERIAL', school.id, admin.id, locationIds);
  console.log(`  Materiais: ${material.created} criados, ${material.skipped} já existiam`);

  const totals = await prisma.item.groupBy({
    by: ['module'],
    where: { schoolId: school.id },
    _count: true,
  });
  console.log('Total por módulo:', totals.map((t) => `${t.module}=${t._count}`).join(', '));
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('Falhou:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
