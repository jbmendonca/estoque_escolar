import { NextResponse } from 'next/server';
import { toErrorResponse } from '@/lib/errors';
import { listBatches } from '@/modules/lotes/food-batch-service';
import { requirePermission } from '@/server/guard';
import { ModuleType } from '@/modules/shared/enums';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const schoolId = url.searchParams.get('schoolId') ?? undefined;

    // Somente quem pode ver o módulo de Merenda acessa lotes.
    const user = await requirePermission('item.view', { schoolId, module: ModuleType.FOOD });

    const data = await listBatches(user, {
      itemId: url.searchParams.get('itemId') ?? undefined,
      schoolId,
    });

    return NextResponse.json({ data });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
