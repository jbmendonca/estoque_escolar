import { describe, it, expect } from 'vitest';
import { createMovementSchema } from '@/modules/movimentacoes/movement.schema';
import { ModuleType, MovementType } from '@/modules/shared/enums';

describe('createMovementSchema — validação de fronteira', () => {
  it('aceita uma saída simples de material', () => {
    const parsed = createMovementSchema.safeParse({
      module: ModuleType.SCHOOL_MATERIAL,
      type: MovementType.SAIDA,
      items: [{ itemId: 'it-1', quantity: 10 }],
    });
    expect(parsed.success).toBe(true);
  });

  it('rejeita PERDA sem justificativa', () => {
    const parsed = createMovementSchema.safeParse({
      module: ModuleType.SCHOOL_MATERIAL,
      type: MovementType.PERDA,
      items: [{ itemId: 'it-1', quantity: 1 }],
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path.includes('justification'))).toBe(true);
    }
  });

  it('rejeita ENTRADA de alimento sem lote/validade', () => {
    const parsed = createMovementSchema.safeParse({
      module: ModuleType.FOOD,
      type: MovementType.ENTRADA,
      items: [{ itemId: 'it-food', quantity: 20 }],
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path.includes('batchInput'))).toBe(true);
    }
  });

  it('aceita ENTRADA de alimento com lote e validade', () => {
    const parsed = createMovementSchema.safeParse({
      module: ModuleType.FOOD,
      type: MovementType.ENTRADA,
      items: [
        {
          itemId: 'it-food',
          quantity: 20,
          batchInput: { batchNumber: 'L123', expiryDate: '2026-09-30' },
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it('rejeita quantidade zero', () => {
    const parsed = createMovementSchema.safeParse({
      module: ModuleType.SCHOOL_MATERIAL,
      type: MovementType.SAIDA,
      items: [{ itemId: 'it-1', quantity: 0 }],
    });
    expect(parsed.success).toBe(false);
  });
});
