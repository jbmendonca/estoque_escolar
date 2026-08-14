import { describe, it, expect } from 'vitest';
import { formatDateOnly, parseDateOnly } from '@/lib/date';
import { createMovementSchema } from '@/modules/movimentacoes/movement.schema';
import { ModuleType, MovementType } from '@/modules/shared/enums';

// Regressão: a validade não pode "andar um dia" por causa do fuso horário.
describe('Datas somente-data (validade)', () => {
  it('parseDateOnly gera meia-noite UTC', () => {
    const d = parseDateOnly('2026-09-15');
    expect(d.toISOString()).toBe('2026-09-15T00:00:00.000Z');
  });

  it('formatDateOnly preserva o dia informado (sem deslocar por fuso)', () => {
    expect(formatDateOnly(parseDateOnly('2026-09-15'))).toBe('15/09/2026');
    expect(formatDateOnly(parseDateOnly('2027-06-30'))).toBe('30/06/2027');
    expect(formatDateOnly(parseDateOnly('2026-01-01'))).toBe('01/01/2026');
  });

  it('o schema de movimentação normaliza a validade para UTC', () => {
    const parsed = createMovementSchema.safeParse({
      module: ModuleType.FOOD,
      type: MovementType.ENTRADA,
      items: [
        {
          itemId: 'it-food',
          quantity: 10,
          batchInput: { batchNumber: 'L1', expiryDate: '2026-09-15' },
        },
      ],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      const expiry = parsed.data.items[0]?.batchInput?.expiryDate;
      expect(expiry?.toISOString()).toBe('2026-09-15T00:00:00.000Z');
      expect(formatDateOnly(expiry!)).toBe('15/09/2026');
    }
  });

  it('rejeita data inválida', () => {
    const parsed = createMovementSchema.safeParse({
      module: ModuleType.FOOD,
      type: MovementType.ENTRADA,
      items: [
        { itemId: 'x', quantity: 1, batchInput: { batchNumber: 'L1', expiryDate: 'nao-e-data' } },
      ],
    });
    expect(parsed.success).toBe(false);
  });
});
