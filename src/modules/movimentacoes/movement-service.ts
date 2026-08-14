// SERVIÇO CENTRAL DE MOVIMENTAÇÃO — único caminho para alterar saldo de estoque.
// Garante: transação PostgreSQL, row lock (FOR UPDATE), saldo nunca negativo,
// saldo anterior/posterior gravados, FEFO em saídas de merenda e auditoria.
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/errors';
import { applyMovementLine, directionForType } from '@/modules/movimentacoes/movement-domain';
import { allocateFefo } from '@/modules/lotes/fefo';
import { formatMovementNumber } from '@/modules/catalogo/code';
import { nextSequenceValue, movementScope } from '@/modules/catalogo/code-sequence';
import { writeAuditLog } from '@/modules/auditoria/audit-service';
import { lockStockRow, lockBatchRow } from '@/server/tx';
import { ModuleType, MovementType } from '@/modules/shared/enums';
import type { CreateMovementInput } from '@/modules/movimentacoes/movement.schema';

type Tx = Prisma.TransactionClient;

export interface MovementResultLine {
  itemId: string;
  foodBatchId: string | null;
  quantity: number;
  previousBalance: number;
  newBalance: number;
}

export interface MovementResult {
  id: string;
  number: string;
  type: string;
  lines: MovementResultLine[];
}

/** Trava a linha de Stock e devolve o saldo atual (cria o registro se não existir). */
async function lockStock(tx: Tx, itemId: string, schoolId: string): Promise<number> {
  const existing = await lockStockRow(tx, itemId);
  if (existing !== null) return existing;

  await tx.stock.create({ data: { itemId, schoolId, quantity: new Prisma.Decimal(0) } });
  // Re-trava a linha recém-criada para manter a serialização.
  await lockStockRow(tx, itemId);
  return 0;
}

/** Trava um lote e devolve seu saldo. */
async function lockBatch(tx: Tx, batchId: string): Promise<number> {
  const balance = await lockBatchRow(tx, batchId);
  if (balance === null) throw new AppError('NOT_FOUND', 'Lote não encontrado.');
  return balance;
}

/**
 * Cria uma movimentação completa (cabeçalho + linhas) de forma atômica.
 * Nenhuma outra parte do sistema deve alterar Stock/FoodBatch diretamente.
 */
export async function createMovement(
  input: CreateMovementInput,
  ctx: { userId: string; schoolId: string },
): Promise<MovementResult> {
  const { userId, schoolId } = ctx;

  return prisma.$transaction(async (tx) => {
    // Valida que todos os itens pertencem à escola e ao módulo informados (isolamento).
    const itemIds = [...new Set(input.items.map((i) => i.itemId))];
    const items = await tx.item.findMany({
      where: { id: { in: itemIds }, schoolId, module: input.module },
      select: { id: true },
    });
    if (items.length !== itemIds.length) {
      throw new AppError('FORBIDDEN', 'Item inexistente ou fora do escopo desta escola/módulo.');
    }

    const seq = await nextSequenceValue(tx, movementScope(schoolId));
    const number = formatMovementNumber(seq);
    const isAdjustment = input.type === MovementType.AJUSTE;

    const movement = await tx.stockMovement.create({
      data: {
        number,
        schoolId,
        module: input.module,
        type: input.type,
        direction: directionForType(input.type),
        justification: input.justification ?? null,
        notes: input.notes ?? null,
        referenceDocument: input.referenceDocument ?? null,
        distributionTarget: input.distributionTarget ?? null,
        distributionTargetLabel: input.distributionTargetLabel ?? null,
        reviewStatus: isAdjustment ? 'PENDENTE_REVISAO' : 'NAO_APLICAVEL',
        userId,
      },
    });

    const lines: MovementResultLine[] = [];

    for (const line of input.items) {
      if (input.module === ModuleType.FOOD) {
        lines.push(...(await handleFoodLine(tx, { line, input, schoolId, movementId: movement.id })));
      } else {
        lines.push(await handleMaterialLine(tx, { line, input, schoolId, movementId: movement.id }));
      }
    }

    // Ajuste efetiva na hora e fica pendente de revisão pelo Gestor.
    if (isAdjustment) {
      await tx.reviewNotification.create({
        data: { schoolId, movementId: movement.id, assignedToRole: 'GESTOR_ESCOLAR' },
      });
    }

    await writeAuditLog(
      {
        userId,
        schoolId,
        action: isAdjustment ? 'ADJUSTMENT' : 'MOVEMENT',
        resource: 'StockMovement',
        resourceId: movement.id,
        after: { number, type: input.type, lines },
      },
      tx,
    );

    return { id: movement.id, number, type: input.type, lines };
  });
}

type LineCtx = {
  line: CreateMovementInput['items'][number];
  input: CreateMovementInput;
  schoolId: string;
  movementId: string;
};

/** Materiais escolares: saldo direto em Stock. */
async function handleMaterialLine(tx: Tx, { line, input, schoolId, movementId }: LineCtx) {
  const previous = await lockStock(tx, line.itemId, schoolId);
  const result = applyMovementLine(
    {
      type: input.type,
      quantity: line.quantity,
      previousBalance: previous,
      justification: input.justification,
    },
    { signedDelta: input.signedDelta },
  );

  await tx.stock.update({
    where: { itemId: line.itemId },
    data: { quantity: new Prisma.Decimal(result.newBalance) },
  });

  await tx.stockMovementItem.create({
    data: {
      movementId,
      itemId: line.itemId,
      quantity: new Prisma.Decimal(result.quantity),
      previousBalance: new Prisma.Decimal(result.previousBalance),
      newBalance: new Prisma.Decimal(result.newBalance),
    },
  });

  return {
    itemId: line.itemId,
    foodBatchId: null,
    quantity: result.quantity,
    previousBalance: result.previousBalance,
    newBalance: result.newBalance,
  };
}

/** Merenda: saldo por lote; entrada cria/soma lote, saída consome via FEFO. */
async function handleFoodLine(
  tx: Tx,
  { line, input, schoolId, movementId }: LineCtx,
): Promise<MovementResultLine[]> {
  const isInbound = input.type === MovementType.ENTRADA || input.type === MovementType.DEVOLUCAO;

  if (isInbound) {
    if (!line.batchInput) {
      throw new AppError('VALIDATION', 'Entrada de alimento exige informar lote e validade.');
    }
    const { batchNumber, expiryDate, manufactureDate, supplierId } = line.batchInput;

    // Identidade do lote: item + número + validade (decisão de clarificação).
    const batch = await tx.foodBatch.upsert({
      where: {
        itemId_batchNumber_expiryDate: { itemId: line.itemId, batchNumber, expiryDate },
      },
      create: {
        schoolId,
        itemId: line.itemId,
        batchNumber,
        expiryDate,
        manufactureDate: manufactureDate ?? null,
        supplierId: supplierId ?? null,
        quantity: new Prisma.Decimal(0),
      },
      update: {},
    });

    const previousBatch = await lockBatch(tx, batch.id);
    const applied = applyMovementLine({
      type: input.type,
      quantity: line.quantity,
      previousBalance: previousBatch,
      justification: input.justification,
    });

    await tx.foodBatch.update({
      where: { id: batch.id },
      data: { quantity: new Prisma.Decimal(applied.newBalance) },
    });
    const stockBalance = await syncFoodStock(tx, line.itemId, schoolId);

    await tx.stockMovementItem.create({
      data: {
        movementId,
        itemId: line.itemId,
        foodBatchId: batch.id,
        quantity: new Prisma.Decimal(applied.quantity),
        previousBalance: new Prisma.Decimal(applied.previousBalance),
        newBalance: new Prisma.Decimal(applied.newBalance),
      },
    });

    void stockBalance;
    return [
      {
        itemId: line.itemId,
        foodBatchId: batch.id,
        quantity: applied.quantity,
        previousBalance: applied.previousBalance,
        newBalance: applied.newBalance,
      },
    ];
  }

  // Saída de alimento: lote informado ou seleção automática por FEFO.
  const available = await tx.foodBatch.findMany({
    where: line.foodBatchId
      ? { id: line.foodBatchId, itemId: line.itemId, schoolId }
      : { itemId: line.itemId, schoolId, active: true },
    select: { id: true, expiryDate: true, quantity: true },
    orderBy: { expiryDate: 'asc' },
  });

  const allocations = allocateFefo(
    available.map((b) => ({ id: b.id, expiryDate: b.expiryDate, quantity: Number(b.quantity) })),
    line.quantity,
  );

  const results: MovementResultLine[] = [];
  for (const alloc of allocations) {
    const previousBatch = await lockBatch(tx, alloc.batchId);
    const applied = applyMovementLine(
      {
        type: input.type,
        quantity: alloc.quantity,
        previousBalance: previousBatch,
        justification: input.justification,
      },
      { signedDelta: input.signedDelta !== undefined ? -alloc.quantity : undefined },
    );

    await tx.foodBatch.update({
      where: { id: alloc.batchId },
      data: { quantity: new Prisma.Decimal(applied.newBalance) },
    });

    await tx.stockMovementItem.create({
      data: {
        movementId,
        itemId: line.itemId,
        foodBatchId: alloc.batchId,
        quantity: new Prisma.Decimal(applied.quantity),
        previousBalance: new Prisma.Decimal(applied.previousBalance),
        newBalance: new Prisma.Decimal(applied.newBalance),
      },
    });

    results.push({
      itemId: line.itemId,
      foodBatchId: alloc.batchId,
      quantity: applied.quantity,
      previousBalance: applied.previousBalance,
      newBalance: applied.newBalance,
    });
  }

  await syncFoodStock(tx, line.itemId, schoolId);
  return results;
}

/** Recalcula o Stock de um item FOOD como a soma dos saldos dos lotes. */
async function syncFoodStock(tx: Tx, itemId: string, schoolId: string): Promise<number> {
  const agg = await tx.foodBatch.aggregate({ where: { itemId }, _sum: { quantity: true } });
  const total = Number(agg._sum.quantity ?? 0);
  await tx.stock.upsert({
    where: { itemId },
    create: { itemId, schoolId, quantity: new Prisma.Decimal(total) },
    update: { quantity: new Prisma.Decimal(total) },
  });
  return total;
}
