import { NextResponse } from 'next/server';
import { AppError, toErrorResponse } from '@/lib/errors';
import { allocateFefo } from '@/modules/lotes/fefo';
import { listBatches } from '@/modules/lotes/food-batch-service';
import { requirePermission } from '@/server/guard';
import { ModuleType } from '@/modules/shared/enums';

/** Simula a alocação FEFO de uma saída, sem efetivar nada. */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const itemId = url.searchParams.get('itemId');
    const quantity = Number(url.searchParams.get('quantity'));
    const schoolId = url.searchParams.get('schoolId') ?? undefined;

    if (!itemId || !Number.isFinite(quantity) || quantity <= 0) {
      throw new AppError('BAD_REQUEST', 'Informe o item e uma quantidade maior que zero.');
    }

    const user = await requirePermission('item.view', { schoolId, module: ModuleType.FOOD });
    const batches = await listBatches(user, { itemId, schoolId });

    const allocations = allocateFefo(batches, quantity);
    const byId = new Map(batches.map((b) => [b.id, b]));

    return NextResponse.json({
      allocations: allocations.map((a) => {
        const batch = byId.get(a.batchId);
        return {
          batchId: a.batchId,
          batchNumber: batch?.batchNumber,
          expiryDate: batch?.expiryDate,
          quantity: a.quantity,
        };
      }),
    });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
