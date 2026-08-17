import { NextResponse } from 'next/server';
import { AppError, toErrorResponse } from '@/lib/errors';
import { getPurchaseList, updatePurchaseListStatus } from '@/modules/compras/purchase-list-service';
import { updatePurchaseListSchema } from '@/modules/compras/purchase.schema';
import { requirePermission } from '@/server/guard';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requirePermission('purchase.view');
    const list = await getPurchaseList(user, id);
    return NextResponse.json(list);
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

/** Muda a situação da lista (aberta → enviada → concluída / cancelada). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requirePermission('purchase.manage');

    const parsed = updatePurchaseListSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new AppError('VALIDATION', 'Situação inválida para a lista de compras.');
    }

    const updated = await updatePurchaseListStatus(user, id, parsed.data.status);
    return NextResponse.json(updated);
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
