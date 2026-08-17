import { describe, it, expect } from 'vitest';
import { orderByFefo, allocateFefo } from '@/modules/lotes/fefo';
import { AppError } from '@/lib/errors';

const d = (iso: string) => new Date(iso);

describe('FEFO — First Expire, First Out', () => {
  it('ordena por menor validade primeiro', () => {
    const batches = [
      { id: 'L1', expiryDate: d('2026-09-30'), quantity: 10 },
      { id: 'L2', expiryDate: d('2026-09-15'), quantity: 10 },
    ];
    const ordered = orderByFefo(batches);
    expect(ordered.map((b) => b.id)).toEqual(['L2', 'L1']);
  });

  it('sugere o lote que vence antes ao alocar', () => {
    const batches = [
      { id: 'L1', expiryDate: d('2026-09-30'), quantity: 10 },
      { id: 'L2', expiryDate: d('2026-09-15'), quantity: 10 },
    ];
    const alloc = allocateFefo(batches, 5);
    expect(alloc).toEqual([{ batchId: 'L2', quantity: 5 }]);
  });

  it('completa com o próximo lote quando o primeiro não cobre', () => {
    const batches = [
      { id: 'L2', expiryDate: d('2026-09-15'), quantity: 4 },
      { id: 'L1', expiryDate: d('2026-09-30'), quantity: 10 },
    ];
    const alloc = allocateFefo(batches, 6);
    expect(alloc).toEqual([
      { batchId: 'L2', quantity: 4 },
      { batchId: 'L1', quantity: 2 },
    ]);
  });

  it('bloqueia quando a soma dos lotes é insuficiente (sem saldo negativo)', () => {
    const batches = [{ id: 'L1', expiryDate: d('2026-09-30'), quantity: 3 }];
    try {
      allocateFefo(batches, 5);
      expect.unreachable();
    } catch (e) {
      expect((e as AppError).code).toBe('INSUFFICIENT_STOCK');
    }
  });

  it('ignora lotes zerados', () => {
    const batches = [
      { id: 'L0', expiryDate: d('2026-08-01'), quantity: 0 },
      { id: 'L1', expiryDate: d('2026-09-30'), quantity: 10 },
    ];
    const alloc = allocateFefo(batches, 5);
    expect(alloc).toEqual([{ batchId: 'L1', quantity: 5 }]);
  });

  describe('exclusão de lotes vencidos', () => {
    const hoje = d('2026-08-16');
    const vencido = { id: 'V', expiryDate: d('2026-08-10'), quantity: 10 };
    const valido = { id: 'B', expiryDate: d('2026-09-30'), quantity: 10 };

    it('consumo não retira de lote vencido, mesmo sendo o que vence primeiro', () => {
      const alloc = allocateFefo([vencido, valido], 5, { referenceDate: hoje });
      expect(alloc).toEqual([{ batchId: 'B', quantity: 5 }]);
    });

    it('baixa de perda/avaria pode alocar lote vencido', () => {
      const alloc = allocateFefo([vencido, valido], 5, {
        referenceDate: hoje,
        allowExpired: true,
      });
      expect(alloc).toEqual([{ batchId: 'V', quantity: 5 }]);
    });

    it('erro específico quando o saldo válido não cobre mas há saldo preso em vencido', () => {
      try {
        allocateFefo([vencido], 5, { referenceDate: hoje });
        expect.unreachable();
      } catch (e) {
        expect((e as AppError).code).toBe('INSUFFICIENT_STOCK');
        expect((e as AppError).details).toMatchObject({ trappedInExpired: 10 });
      }
    });

    it('sem referenceDate, o vencimento é ignorado (compatibilidade)', () => {
      const alloc = allocateFefo([vencido, valido], 5);
      expect(alloc).toEqual([{ batchId: 'V', quantity: 5 }]);
    });
  });
});
