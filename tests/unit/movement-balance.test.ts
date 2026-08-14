import { describe, it, expect } from 'vitest';
import { applyMovementLine, directionForType, requiresJustification } from '@/modules/movimentacoes/movement-domain';
import { AppError } from '@/lib/errors';
import { MovementDirection, MovementType } from '@/modules/shared/enums';

describe('applyMovementLine — integridade de saldo', () => {
  it('entrada aumenta o saldo e registra saldo anterior/posterior', () => {
    const r = applyMovementLine({ type: MovementType.ENTRADA, quantity: 50, previousBalance: 0 });
    expect(r.direction).toBe(MovementDirection.IN);
    expect(r.previousBalance).toBe(0);
    expect(r.newBalance).toBe(50);
  });

  it('saída diminui o saldo', () => {
    const r = applyMovementLine({ type: MovementType.SAIDA, quantity: 20, previousBalance: 50 });
    expect(r.direction).toBe(MovementDirection.OUT);
    expect(r.newBalance).toBe(30);
  });

  it('bloqueia saldo negativo (INSUFFICIENT_STOCK)', () => {
    expect(() =>
      applyMovementLine({ type: MovementType.SAIDA, quantity: 15, previousBalance: 10 }),
    ).toThrowError(AppError);
    try {
      applyMovementLine({ type: MovementType.SAIDA, quantity: 15, previousBalance: 10 });
    } catch (e) {
      expect((e as AppError).code).toBe('INSUFFICIENT_STOCK');
    }
  });

  it('permite saída que zera o saldo (limite não-negativo)', () => {
    const r = applyMovementLine({ type: MovementType.SAIDA, quantity: 10, previousBalance: 10 });
    expect(r.newBalance).toBe(0);
  });

  it('rejeita quantidade zero ou negativa', () => {
    expect(() =>
      applyMovementLine({ type: MovementType.ENTRADA, quantity: 0, previousBalance: 0 }),
    ).toThrowError(/maior que zero/);
  });

  it('devolução conta como entrada (IN)', () => {
    expect(directionForType(MovementType.DEVOLUCAO)).toBe(MovementDirection.IN);
  });

  it('ajuste positivo aumenta e negativo diminui, respeitando não-negativo', () => {
    const up = applyMovementLine(
      { type: MovementType.AJUSTE, quantity: 5, previousBalance: 10, justification: 'inventário' },
      { signedDelta: 5 },
    );
    expect(up.newBalance).toBe(15);
    const down = applyMovementLine(
      { type: MovementType.AJUSTE, quantity: 5, previousBalance: 10, justification: 'inventário' },
      { signedDelta: -5 },
    );
    expect(down.newBalance).toBe(5);
    expect(() =>
      applyMovementLine(
        { type: MovementType.AJUSTE, quantity: 20, previousBalance: 10, justification: 'x' },
        { signedDelta: -20 },
      ),
    ).toThrowError(/negativo/);
  });
});

describe('requiresJustification', () => {
  it('exige justificativa em perda/avaria/vencido/ajuste', () => {
    expect(requiresJustification(MovementType.PERDA)).toBe(true);
    expect(requiresJustification(MovementType.AVARIA)).toBe(true);
    expect(requiresJustification(MovementType.PRODUTO_VENCIDO)).toBe(true);
    expect(requiresJustification(MovementType.AJUSTE)).toBe(true);
    expect(requiresJustification(MovementType.SAIDA)).toBe(false);
  });

  it('bloqueia perda sem justificativa (VALIDATION)', () => {
    try {
      applyMovementLine({ type: MovementType.PERDA, quantity: 1, previousBalance: 5 });
      expect.unreachable();
    } catch (e) {
      expect((e as AppError).code).toBe('VALIDATION');
    }
  });
});
