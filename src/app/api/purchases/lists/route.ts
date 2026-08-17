import { NextResponse } from 'next/server';
import { AppError, toErrorResponse } from '@/lib/errors';
import { createPurchaseList, listPurchaseLists } from '@/modules/compras/purchase-list-service';
import { createPurchaseListSchema } from '@/modules/compras/purchase.schema';
import { ModuleType, PurchaseListStatus } from '@/modules/shared/enums';
import { requirePermission, resolveSchoolId } from '@/server/guard';
import { resolveVisibleModules } from '@/server/rbac';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const moduleParam = url.searchParams.get('module') as ModuleType | null;
    const statusParam = url.searchParams.get('status') as PurchaseListStatus | null;

    const user = await requirePermission('purchase.view', { module: moduleParam ?? undefined });

    const result = await listPurchaseLists(user, {
      modules: resolveVisibleModules(user, undefined, moduleParam),
      status: statusParam ?? undefined,
      page: Number(url.searchParams.get('page') ?? 1),
      pageSize: Number(url.searchParams.get('pageSize') ?? 20),
    });

    return NextResponse.json(result);
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

/** Gera uma lista de compras a partir dos itens/solicitações selecionados. */
export async function POST(request: Request) {
  try {
    const parsed = createPurchaseListSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new AppError('VALIDATION', 'Dados da lista de compras inválidos.', {
        issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }

    const user = await requirePermission('purchase.manage', {
      schoolId: parsed.data.schoolId,
      module: parsed.data.module,
    });
    const schoolId = resolveSchoolId(user, parsed.data.schoolId);

    const list = await createPurchaseList(user, parsed.data, { schoolId });
    return NextResponse.json(list, { status: 201 });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
