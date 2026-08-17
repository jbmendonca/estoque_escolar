import { describe, it, expect } from 'vitest';
import {
  resolveDirection,
  allowsExpiredAllocation,
} from '@/modules/movimentacoes/movement-domain';
import { MovementDirection, MovementType } from '@/modules/shared/enums';

describe('resolveDirection — direção efetiva da movimentação', () => {
  it('entrada e devolução são IN', () => {
    expect(resolveDirection(MovementType.ENTRADA)).toBe(MovementDirection.IN);
    expect(resolveDirection(MovementType.DEVOLUCAO)).toBe(MovementDirection.IN);
  });

  it('saídas comuns são OUT', () => {
    expect(resolveDirection(MovementType.CONSUMO)).toBe(MovementDirection.OUT);
    expect(resolveDirection(MovementType.PERDA)).toBe(MovementDirection.OUT);
  });

  it('AJUSTE positivo é IN e negativo é OUT (não mais sempre OUT)', () => {
    expect(resolveDirection(MovementType.AJUSTE, 5)).toBe(MovementDirection.IN);
    expect(resolveDirection(MovementType.AJUSTE, -5)).toBe(MovementDirection.OUT);
  });

  it('AJUSTE sem sinal explícito é tratado como saída (espelha applyMovementLine)', () => {
    expect(resolveDirection(MovementType.AJUSTE)).toBe(MovementDirection.OUT);
  });
});

describe('allowsExpiredAllocation — quem pode baixar lote vencido', () => {
  it('perda, avaria e produto vencido podem', () => {
    expect(allowsExpiredAllocation(MovementType.PERDA)).toBe(true);
    expect(allowsExpiredAllocation(MovementType.AVARIA)).toBe(true);
    expect(allowsExpiredAllocation(MovementType.PRODUTO_VENCIDO)).toBe(true);
  });

  it('consumo, preparo e distribuição não podem', () => {
    expect(allowsExpiredAllocation(MovementType.CONSUMO)).toBe(false);
    expect(allowsExpiredAllocation(MovementType.PREPARO_MERENDA)).toBe(false);
    expect(allowsExpiredAllocation(MovementType.DISTRIBUICAO)).toBe(false);
  });
});
