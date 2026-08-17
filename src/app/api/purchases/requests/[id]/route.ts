import { NextResponse } from 'next/server';
import { AppError, toErrorResponse } from '@/lib/errors';
import {
  getPurchaseRequest,
  transitionPurchaseRequest,
} from '@/modules/compras/purchase-request-service';
import { transitionPurchaseRequestSchema } from '@/modules/compras/purchase.schema';
import { requireAuth, requirePermission } from '@/server/guard';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requirePermission('purchase.view');
    const data = await getPurchaseRequest(user, id);
    return NextResponse.json(data);
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

/**
 * Avança o fluxo (aprovar, rejeitar, comprar, receber, cancelar).
 * A permissão de cada etapa é verificada dentro do serviço, porque depende do
 * registro: o próprio solicitante pode cancelar sua solicitação pendente.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireAuth();

    const parsed = transitionPurchaseRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new AppError('VALIDATION', 'Dados da atualização inválidos.', {
        issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }

    const updated = await transitionPurchaseRequest(user, id, parsed.data);
    return NextResponse.json(updated);
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
