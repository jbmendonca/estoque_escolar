// Gera histórico de movimentações de demonstração (~90 dias) para o painel analítico.
// Usa o SERVIÇO CENTRAL de movimentação, respeitando todas as regras de negócio:
// transação, saldo nunca negativo, FEFO, justificativa obrigatória e auditoria.
import { PrismaClient } from '@prisma/client';
import { createMovement } from '../src/modules/movimentacoes/movement-service';

const prisma = new PrismaClient();

/** PRNG determinístico — a mesma execução gera sempre os mesmos dados. */
function makeRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}
const rnd = makeRandom(20260814);

const pick = <T>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)]!;
const between = (min: number, max: number) => Math.round(min + rnd() * (max - min));

/**
 * Ajusta a data de um registro de demonstração para o passado.
 *
 * A aplicação NUNCA faz isso: movimentações são append-only e sempre gravadas com
 * a data corrente. Isto existe apenas no seed, para que o painel analítico tenha
 * uma série histórica realista para demonstrar.
 */
async function backdate(movementId: string, date: Date) {
  await prisma.$executeRaw`UPDATE "StockMovement" SET "createdAt" = ${date} WHERE "id" = ${movementId}`;
  await prisma.$executeRaw`UPDATE "StockMovementItem" SET "createdAt" = ${date} WHERE "movementId" = ${movementId}`;
  await prisma.$executeRaw`UPDATE "AuditLog" SET "createdAt" = ${date} WHERE "resourceId" = ${movementId}`;
}

/** Aplica uma hora do dia à data simulada. */
function withHour(date: Date, hour: number): Date {
  const d = new Date(date);
  d.setHours(hour, between(0, 59), 0, 0);
  return d;
}

/** Limpa movimentações e saldos de demonstração para reexecutar do zero. */
async function resetMovements(schoolId: string) {
  await prisma.$executeRaw`DELETE FROM "AuditLog" WHERE "resource" = 'StockMovement' AND "schoolId" = ${schoolId}`;
  await prisma.reviewNotification.deleteMany({ where: { schoolId } });
  await prisma.stockMovementItem.deleteMany({ where: { movement: { schoolId } } });
  await prisma.stockMovement.deleteMany({ where: { schoolId } });
  await prisma.foodBatch.deleteMany({ where: { schoolId } });
  await prisma.stock.updateMany({ where: { schoolId }, data: { quantity: 0 } });
  await prisma.$executeRaw`DELETE FROM "CodeSequence" WHERE "scope" LIKE 'MOVEMENT%'`;
  console.log('Movimentações anteriores removidas (dados de demonstração).');
}

/** Perfil de consumo: alguns itens giram muito, outros pouco (gera curva ABC realista). */
const HIGH_TURNOVER = [
  'Arroz', 'Feijão', 'Leite', 'Óleo', 'Açúcar', 'Macarrão', 'Frango', 'Banana', 'Pão',
  'Caneta', 'Lápis', 'Papel Sulfite', 'Caderno', 'Borracha',
];
const NO_TURNOVER = ['Mapa', 'Livro Didático', 'Lapiseira', 'Iogurte', 'Lentilha'];

function turnoverProfile(name: string): 'alto' | 'medio' | 'nenhum' {
  if (NO_TURNOVER.some((k) => name.includes(k))) return 'nenhum';
  if (HIGH_TURNOVER.some((k) => name.includes(k))) return 'alto';
  return 'medio';
}

async function main() {
  const school = await prisma.school.findUniqueOrThrow({ where: { code: 'ESC-DEMO' } });
  const secretario = await prisma.user.findUniqueOrThrow({ where: { email: 'secretario@escola.dev' } });
  const merendeira = await prisma.user.findUniqueOrThrow({ where: { email: 'merendeira@escola.dev' } });
  const assistente = await prisma.user.findUniqueOrThrow({ where: { email: 'assistente@escola.dev' } });

  await resetMovements(school.id);

  const items = await prisma.item.findMany({
    where: { schoolId: school.id, active: true },
    select: { id: true, name: true, module: true },
    orderBy: { name: 'asc' },
  });

  const food = items.filter((i) => i.module === 'FOOD');
  const material = items.filter((i) => i.module === 'SCHOOL_MATERIAL');
  console.log(`Itens: ${food.length} merenda, ${material.length} materiais`);

  const today = new Date();
  const dayMs = 24 * 60 * 60 * 1000;

  // ---------------- 1) Entradas iniciais ----------------
  console.log('Registrando entradas...');
  let entradas = 0;

  for (const item of food) {
    if (turnoverProfile(item.name) === 'nenhum' && rnd() < 0.5) continue;

    // 1 ou 2 lotes por produto, com validades variadas.
    const lotes = rnd() < 0.35 ? 2 : 1;
    for (let l = 0; l < lotes; l++) {
      // Mistura: alguns vencidos, alguns próximos do vencimento, a maioria no prazo.
      const roll = rnd();
      const diasValidade = roll < 0.06 ? between(-20, -1) : roll < 0.2 ? between(3, 25) : between(60, 400);
      const expiry = new Date(today.getTime() + diasValidade * dayMs);

      // Entradas ocorreram entre 65 e 45 dias atrás (antes do consumo).
      const entradaEm = new Date(today.getTime() - between(45, 65) * dayMs);
      const mov = await createMovement(
        {
          module: 'FOOD',
          type: 'ENTRADA',
          referenceDocument: `NF ${between(1000, 9999)}`,
          items: [
            {
              itemId: item.id,
              quantity: between(60, 400),
              batchInput: {
                batchNumber: `L${between(100, 999)}-${l + 1}`,
                expiryDate: expiry,
              },
            },
          ],
        },
        { userId: secretario.id, schoolId: school.id },
      );
      await backdate(mov.id, entradaEm);
      entradas++;
    }
  }

  for (const item of material) {
    if (turnoverProfile(item.name) === 'nenhum' && rnd() < 0.4) continue;
    const entradaEm = new Date(today.getTime() - between(45, 65) * dayMs);
    const mov = await createMovement(
      {
        module: 'SCHOOL_MATERIAL',
        type: 'ENTRADA',
        referenceDocument: `NF ${between(1000, 9999)}`,
        items: [{ itemId: item.id, quantity: between(80, 600) }],
      },
      { userId: secretario.id, schoolId: school.id },
    );
    await backdate(mov.id, entradaEm);
    entradas++;
  }
  console.log(`  ${entradas} entradas registradas`);

  // ---------------- 2) Saídas ao longo do período ----------------
  console.log('Registrando saídas (consumo/distribuição)...');
  let saidas = 0;
  let bloqueadas = 0;

  const DESTINOS = ['1º A', '2º B', '3º A', '4º B', '5º A', 'Secretaria', 'Coordenação'] as const;

  // Percorre ~60 dias úteis, com consumo diário.
  for (let d = 60; d >= 0; d--) {
    const date = new Date(today.getTime() - d * dayMs);
    const weekday = date.getDay();
    if (weekday === 0 || weekday === 6) continue; // sem aulas no fim de semana

    // --- Merenda: consumo diário ---
    const foodPerDay = between(2, 5);
    for (let i = 0; i < foodPerDay; i++) {
      const candidatos = food.filter((f) => turnoverProfile(f.name) !== 'nenhum');
      if (candidatos.length === 0) break;
      const item = pick(candidatos);
      const perfil = turnoverProfile(item.name);
      const qtd = perfil === 'alto' ? between(5, 25) : between(1, 8);

      try {
        const mov = await createMovement(
          {
            module: 'FOOD',
            type: rnd() < 0.75 ? 'PREPARO_MERENDA' : 'CONSUMO',
            items: [{ itemId: item.id, quantity: qtd }],
          },
          { userId: merendeira.id, schoolId: school.id },
        );
        await backdate(mov.id, withHour(date, between(7, 13)));
        saidas++;
      } catch {
        bloqueadas++; // saldo insuficiente — a regra de saldo não-negativo funcionando
      }
    }

    // --- Materiais: distribuição ---
    if (rnd() < 0.7) {
      const candidatos = material.filter((m) => turnoverProfile(m.name) !== 'nenhum');
      if (candidatos.length > 0) {
        const item = pick(candidatos);
        const perfil = turnoverProfile(item.name);
        const qtd = perfil === 'alto' ? between(5, 40) : between(1, 10);
        try {
          const mov = await createMovement(
            {
              module: 'SCHOOL_MATERIAL',
              type: 'DISTRIBUICAO',
              distributionTarget: 'TURMA',
              distributionTargetLabel: pick([...DESTINOS]),
              items: [{ itemId: item.id, quantity: qtd }],
            },
            { userId: assistente.id, schoolId: school.id },
          );
          await backdate(mov.id, withHour(date, between(8, 16)));
          saidas++;
        } catch {
          bloqueadas++;
        }
      }
    }

    // --- Perdas ocasionais (exigem justificativa) ---
    if (rnd() < 0.08) {
      const item = pick(food);
      try {
        const mov = await createMovement(
          {
            module: 'FOOD',
            type: rnd() < 0.5 ? 'PERDA' : 'AVARIA',
            justification: pick([
              'Produto danificado no transporte',
              'Embalagem violada',
              'Armazenamento inadequado',
              'Item deteriorado',
            ]),
            items: [{ itemId: item.id, quantity: between(1, 6) }],
          },
          { userId: merendeira.id, schoolId: school.id },
        );
        await backdate(mov.id, withHour(date, between(9, 15)));
        saidas++;
      } catch {
        bloqueadas++;
      }
    }
  }

  console.log(`  ${saidas} saídas registradas`);
  if (bloqueadas > 0) {
    console.log(`  ${bloqueadas} tentativas bloqueadas por saldo insuficiente (regra funcionando)`);
  }

  const total = await prisma.stockMovement.count({ where: { schoolId: school.id } });
  const negativos = await prisma.stock.count({ where: { schoolId: school.id, quantity: { lt: 0 } } });
  console.log(`Total de movimentações: ${total}`);
  console.log(`Saldos negativos: ${negativos} (deve ser 0)`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('Falhou:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
