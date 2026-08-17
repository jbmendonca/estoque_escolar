// Geração de código único e imutável de itens (MER-000001 / MAT-000001) e movimentações.
import { AppError } from '@/lib/errors';
import { ModuleType } from '@/modules/shared/enums';

const ITEM_PREFIX: Record<ModuleType, string> = {
  [ModuleType.FOOD]: 'MER',
  [ModuleType.SCHOOL_MATERIAL]: 'MAT',
};

const PAD = 6;

export function formatItemCode(module: ModuleType, sequence: number): string {
  return `${ITEM_PREFIX[module]}-${padSeq(sequence)}`;
}

export function formatMovementNumber(sequence: number): string {
  return `MOV-${padSeq(sequence)}`;
}

/** Número da solicitação de aquisição (SOL-000001). */
export function formatPurchaseRequestNumber(sequence: number): string {
  return `SOL-${padSeq(sequence)}`;
}

/** Número da lista de compras (LC-000001). */
export function formatPurchaseListNumber(sequence: number): string {
  return `LC-${padSeq(sequence)}`;
}

/** Scope de sequência por módulo de item, usado na tabela CodeSequence. */
export function itemSequenceScope(module: ModuleType): string {
  return `ITEM_${ITEM_PREFIX[module]}`;
}

function padSeq(sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new AppError('VALIDATION', 'Sequência de código inválida.');
  }
  return String(sequence).padStart(PAD, '0');
}

/**
 * Garante a imutabilidade do código: só pode mudar se não houver movimentação.
 * Lança IMMUTABLE caso contrário.
 */
export function assertItemCodeChangeAllowed(hasMovements: boolean): void {
  if (hasMovements) {
    throw new AppError('IMMUTABLE', 'O código do item não pode ser alterado após haver movimentação.');
  }
}
