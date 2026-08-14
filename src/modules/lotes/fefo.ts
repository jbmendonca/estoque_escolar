// FEFO — First Expire, First Out. Seleção de lotes para saída de alimentos.
import { AppError } from '@/lib/errors';

export interface BatchLike {
  id: string;
  expiryDate: Date;
  quantity: number;
}

export interface FefoAllocation {
  batchId: string;
  quantity: number;
}

/**
 * Ordena lotes por validade ascendente (o que vence primeiro sai primeiro).
 * Empate de validade é desempatado por id para determinismo.
 */
export function orderByFefo<T extends BatchLike>(batches: readonly T[]): T[] {
  return [...batches].sort((a, b) => {
    const diff = a.expiryDate.getTime() - b.expiryDate.getTime();
    return diff !== 0 ? diff : a.id.localeCompare(b.id);
  });
}

/**
 * Aloca `quantity` a partir dos lotes disponíveis seguindo FEFO.
 * Lança INSUFFICIENT_STOCK se a soma dos saldos não cobre a quantidade
 * (garante que o estoque, por lote, nunca fique negativo).
 */
export function allocateFefo(batches: readonly BatchLike[], quantity: number): FefoAllocation[] {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new AppError('VALIDATION', 'A quantidade deve ser maior que zero.');
  }

  const ordered = orderByFefo(batches.filter((b) => b.quantity > 0));
  const allocations: FefoAllocation[] = [];
  let remaining = quantity;

  for (const batch of ordered) {
    if (remaining <= 0) break;
    const take = Math.min(batch.quantity, remaining);
    allocations.push({ batchId: batch.id, quantity: take });
    remaining -= take;
  }

  if (remaining > 0) {
    throw new AppError('INSUFFICIENT_STOCK', 'Saldo insuficiente nos lotes para a saída solicitada.', {
      requested: quantity,
      short: remaining,
    });
  }

  return allocations;
}
