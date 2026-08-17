// Utilitários de transação e travamento de linha (row lock) para operações críticas.
// Toda alteração de saldo DEVE ocorrer dentro de withTransaction + lock.
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/errors';

export type Tx = Prisma.TransactionClient;

export interface TransactionOptions {
  isolationLevel?: Prisma.TransactionIsolationLevel;
  /** Tempo máximo de execução da transação (ms). */
  timeout?: number;
  /** Tempo máximo de espera por uma conexão do pool (ms). */
  maxWait?: number;
  /** Re-tentativas quando a transação falha por contenção transitória. */
  retries?: number;
}

/** Indica contenção transitória (deadlock/serialização) — vale re-tentar. */
function isRetryable(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2034') return true; // write conflict / deadlock (Prisma)
    const state = (err.meta as { code?: string } | undefined)?.code;
    if (state === '40001' || state === '40P01') return true; // serialization / deadlock (PG)
  }
  const msg = (err instanceof Error ? err.message : '').toLowerCase();
  return msg.includes('deadlock') || msg.includes('could not serialize');
}

/** Traduz erros de concorrência do banco em AppError('CONFLICT') acionável. */
function toConflict(err: unknown): unknown {
  if (isRetryable(err)) {
    return new AppError(
      'CONFLICT',
      'Não foi possível concluir por concorrência de operações. Tente novamente.',
    );
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    return new AppError('CONFLICT', 'Registro já existe (conflito de unicidade).');
  }
  return err;
}

/**
 * Executa uma função dentro de uma transação PostgreSQL, com timeout ampliado
 * e re-tentativa automática em caso de contenção. É o único ponto onde a
 * política de isolamento/retry das operações de saldo é decidida.
 */
export async function withTransaction<T>(
  fn: (tx: Tx) => Promise<T>,
  options: TransactionOptions = {},
): Promise<T> {
  const { isolationLevel, timeout = 15_000, maxWait = 5_000, retries = 2 } = options;
  let attempt = 0;
  for (;;) {
    try {
      return await prisma.$transaction(fn, { isolationLevel, timeout, maxWait });
    } catch (err) {
      if (attempt < retries && isRetryable(err)) {
        attempt += 1;
        continue;
      }
      throw toConflict(err);
    }
  }
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
