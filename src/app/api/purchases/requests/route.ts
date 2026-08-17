import { NextResponse } from 'next/server';
import { AppError, toErrorResponse } from '@/lib/errors';
import {
  createPurchaseRequest,
  listPurchaseRequests,
} from '@/modules/compras/purchase-request-service';
import { createPurchaseRequestSchema } from '@/modules/compras/purchase.schema';
import { ModuleType, PurchaseRequestStatus } from '@/modules/shared/enums';
import { requirePermission, resolveSchoolId } from '@/server/guard';
import { resolveVisibleModules } from '@/server/rbac';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const moduleParam = url.searchParams.get('module') as ModuleType | null;
    const statusParam = url.searchParams.get('status') as PurchaseRequestStatus | null;

    const user = await requirePermission('purchase.view', { module: moduleParam ?? undefined });
    const mine = url.searchParams.get('mine') === '1';

    const result = await listPurchaseRequests(user, {
      modules: resolveVisibleModules(user, undefined, moduleParam),
      status: statusParam ?? undefined,
      requestedById: mine ? user.id : undefined,
      page: Number(url.searchParams.get('page') ?? 1),
      pageSize: Number(url.searchParams.get('pageSize') ?? 20),
    });

    return NextResponse.json(result);
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: Request) {
  try {
    const parsed = createPurchaseRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new AppError('VALIDATION', 'Dados da solicitação inválidos.', {
        issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }

    const user = await requirePermission('purchase.request', {
      schoolId: parsed.data.schoolId,
      module: parsed.data.module,
    });
    const schoolId = resolveSchoolId(user, parsed.data.schoolId);

    const created = await createPurchaseRequest(parsed.data, { userId: user.id, schoolId });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
