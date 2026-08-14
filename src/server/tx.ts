// Utilitários de transação e travamento de linha (row lock) para operações críticas.
// Toda alteração de saldo DEVE ocorrer dentro de withTransaction + lock.
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export type Tx = Prisma.TransactionClient;

/** Executa uma função dentro de uma transação PostgreSQL. */
export function withTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return prisma.$transaction(fn);
}

/**
 * Trava a linha de Stock do item (SELECT ... FOR UPDATE) e devolve o saldo.
 * Serializa operações concorrentes sobre o mesmo item, impedindo saldo negativo
 * em condições de corrida.
 */
export async function lockStockRow(tx: Tx, itemId: string): Promise<number | null> {
  const rows = await tx.$queryRaw<Array<{ quantity: string }>>`
    SELECT "quantity" FROM "Stock" WHERE "itemId" = ${itemId} FOR UPDATE
  `;
  const row = rows[0];
  return row ? Number(row.quantity) : null;
}

/** Trava a linha de um lote de alimento e devolve o saldo. */
export async function lockBatchRow(tx: Tx, batchId: string): Promise<number | null> {
  const rows = await tx.$queryRaw<Array<{ quantity: string }>>`
    SELECT "quantity" FROM "FoodBatch" WHERE "id" = ${batchId} FOR UPDATE
  `;
  const row = rows[0];
  return row ? Number(row.quantity) : null;
}
