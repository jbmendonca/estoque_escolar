// Regras de domínio da movimentação de estoque (puras, sem I/O).
// Garante: direção correta por tipo, justificativa obrigatória e saldo nunca negativo.
import { AppError } from '@/lib/errors';
import { MovementDirection, MovementType } from '@/modules/shared/enums';

/** Tipos que aumentam o saldo (entrada de mercadoria). */
const IN_TYPES: ReadonlySet<MovementType> = new Set([
  MovementType.ENTRADA,
  MovementType.DEVOLUCAO,
]);

/** Tipos que exigem justificativa obrigatória (constituição / FR-024). */
const JUSTIFICATION_REQUIRED: ReadonlySet<MovementType> = new Set([
  MovementType.PERDA,
  MovementType.AVARIA,
  MovementType.PRODUTO_VENCIDO,
  MovementType.AJUSTE,
]);

/**
 * Direção da movimentação a partir do tipo.
 * AJUSTE é bidirecional e depende do sinal informado (ver applyAdjustment).
 */
export function directionForType(type: MovementType): MovementDirection {
  if (type === MovementType.AJUSTE) {
    // Direção do ajuste é definida pelo sinal da diferença; default OUT tratado no serviço.
    return MovementDirection.OUT;
  }
  return IN_TYPES.has(type) ? MovementDirection.IN : MovementDirection.OUT;
}

export function requiresJustification(type: MovementType): boolean {
  return JUSTIFICATION_REQUIRED.has(type);
}

export interface MovementLineInput {
  type: MovementType;
  quantity: number;
  previousBalance: number;
  justification?: string | null;
}

export interface MovementLineResult {
  direction: MovementDirection;
  quantity: number;
  previousBalance: number;
  newBalance: number;
}

/**
 * Aplica uma linha de movimentação sobre um saldo, retornando o novo saldo.
 * - quantity deve ser > 0.
 * - Bloqueia saldo negativo (INSUFFICIENT_STOCK).
 * - Exige justificativa nos tipos aplicáveis.
 * Para AJUSTE, use `signedDelta` (positivo aumenta, negativo diminui).
 */
export function applyMovementLine(
  input: MovementLineInput,
  options: { signedDelta?: number } = {},
): MovementLineResult {
  const { type, quantity, previousBalance } = input;

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new AppError('VALIDATION', 'A quantidade deve ser maior que zero.');
  }
  if (!Number.isFinite(previousBalance) || previousBalance < 0) {
    throw new AppError('VALIDATION', 'Saldo anterior inválido.');
  }
  if (requiresJustification(type) && !hasText(input.justification)) {
    throw new AppError('VALIDATION', 'Justificativa é obrigatória para este tipo de movimentação.', {
      type,
    });
  }

  let direction: MovementDirection;
  let newBalance: number;

  if (type === MovementType.AJUSTE) {
    const delta = options.signedDelta ?? -quantity;
    if (Math.abs(delta) !== quantity) {
      throw new AppError('VALIDATION', 'O ajuste deve ter magnitude igual à quantidade informada.');
    }
    direction = delta >= 0 ? MovementDirection.IN : MovementDirection.OUT;
    newBalance = previousBalance + delta;
  } else {
    direction = directionForType(type);
    newBalance =
      direction === MovementDirection.IN ? previousBalance + quantity : previousBalance - quantity;
  }

  if (newBalance < 0) {
    throw new AppError('INSUFFICIENT_STOCK', 'Estoque não pode ficar negativo.', {
      previousBalance,
      quantity,
    });
  }

  return { direction, quantity, previousBalance, newBalance };
}

function hasText(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}
