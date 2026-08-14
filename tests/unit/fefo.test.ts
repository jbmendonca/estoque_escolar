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
});
