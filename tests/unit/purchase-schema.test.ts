import { describe, it, expect } from 'vitest';
import { transitionPurchaseRequestSchema } from '@/modules/compras/purchase.schema';
import { PurchaseRequestStatus } from '@/modules/shared/enums';

describe('transição de solicitação — motivo obrigatório na recusa/cancelamento', () => {
  it('rejeitar sem motivo é inválido no servidor', () => {
    const r = transitionPurchaseRequestSchema.safeParse({
      status: PurchaseRequestStatus.REJEITADA,
    });
    expect(r.success).toBe(false);
  });

  it('cancelar sem motivo é inválido no servidor', () => {
    const r = transitionPurchaseRequestSchema.safeParse({
      status: PurchaseRequestStatus.CANCELADA,
    });
    expect(r.success).toBe(false);
  });

  it('rejeitar com motivo é aceito', () => {
    const r = transitionPurchaseRequestSchema.safeParse({
      status: PurchaseRequestStatus.REJEITADA,
      note: 'Sem verba no período.',
    });
    expect(r.success).toBe(true);
  });

  it('aprovar não exige motivo', () => {
    const r = transitionPurchaseRequestSchema.safeParse({
      status: PurchaseRequestStatus.APROVADA,
    });
    expect(r.success).toBe(true);
  });
});
