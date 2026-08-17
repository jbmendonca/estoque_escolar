// FEFO — First Expire, First Out. Seleção de lotes para saída de alimentos.
import { AppError } from '@/lib/errors';
import { roundQuantity } from '@/lib/number';
import { isExpired } from '@/modules/lotes/expiry';

export interface BatchLike {
  id: string;
  expiryDate: Date;
  quantity: number;
}

export interface FefoAllocation {
  batchId: string;
  quantity: number;
}

export interface AllocateFefoOptions {
  /**
   * Data de referência para avaliar validade. Quando ausente, o vencimento não
   * é considerado (preserva o comportamento de baixas administrativas e testes
   * de aritmética pura).
   */
  referenceDate?: Date;
  /** Permite alocar de lotes vencidos (baixas de PERDA/AVARIA/PRODUTO_VENCIDO). */
  allowExpired?: boolean;
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
export function allocateFefo(
  batches: readonly BatchLike[],
  quantity: number,
  options: AllocateFefoOptions = {},
): FefoAllocation[] {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new AppError('VALIDATION', 'A quantidade deve ser maior que zero.');
  }

  const { referenceDate, allowExpired = false } = options;
  const withBalance = batches.filter((b) => b.quantity > 0);

  // Quando há data de referência e a operação não é de baixa de vencido,
  // lotes fora da validade não podem ser consumidos/distribuídos.
  const expired =
    referenceDate && !allowExpired
      ? withBalance.filter((b) => isExpired(b.expiryDate, referenceDate))
      : [];
  const expiredIds = new Set(expired.map((b) => b.id));
  const eligible = withBalance.filter((b) => !expiredIds.has(b.id));

  const ordered = orderByFefo(eligible);
  const allocations: FefoAllocation[] = [];
  let remaining = quantity;

  for (const batch of ordered) {
    if (remaining <= 0) break;
    const take = Math.min(batch.quantity, remaining);
    allocations.push({ batchId: batch.id, quantity: take });
    remaining = roundQuantity(remaining - take);
  }

  if (remaining > 0) {
    const trappedInExpired = expired.reduce((sum, b) => sum + b.quantity, 0);
    if (trappedInExpired > 0) {
      throw new AppError(
        'INSUFFICIENT_STOCK',
        'Saldo insuficiente em lotes válidos. Há saldo em lotes vencidos que precisam ser baixados como perda ou produto vencido antes.',
        { requested: quantity, short: remaining, trappedInExpired },
      );
    }
    throw new AppError('INSUFFICIENT_STOCK', 'Saldo insuficiente nos lotes para a saída solicitada.', {
      requested: quantity,
      short: remaining,
    });
  }

  return allocations;
}
