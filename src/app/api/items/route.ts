import { NextResponse } from 'next/server';
import { z } from 'zod';
import { toErrorResponse, AppError } from '@/lib/errors';
import { createItem, listItems } from '@/modules/catalogo/item-service';
import { requirePermission, resolveSchoolId } from '@/server/guard';
import { isAdmin, resolveVisibleModules } from '@/server/rbac';
import { ModuleType } from '@/modules/shared/enums';

const createItemBody = z.object({
  module: z.nativeEnum(ModuleType),
  name: z.string().min(1, 'Informe o nome do item.'),
  description: z.string().optional(),
  categoryId: z.string().min(1),
  unitOfMeasureId: z.string().min(1),
  storageLocationId: z.string().optional(),
  brand: z.string().optional(),
  minStock: z.number().nonnegative().optional(),
  schoolId: z.string().optional(),
  characteristics: z.array(z.object({ key: z.string().min(1), value: z.string().min(1) })).optional(),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const moduleParam = url.searchParams.get('module') as ModuleType | null;
    const schoolId = url.searchParams.get('schoolId') ?? undefined;

    const user = await requirePermission('item.view', {
      schoolId,
      module: moduleParam ?? undefined,
    });

    // Isolamento de módulo mesmo quando `module` é omitido: restringe aos
    // módulos que o usuário pode ver (impede Merendeira de ler materiais).
    const modules = resolveVisibleModules(user, schoolId, moduleParam);

    const charRaw = url.searchParams.get('characteristic');
    const [charKey, charValue] = charRaw ? charRaw.split(':') : [];

    const result = await listItems({
      schoolIds: isAdmin(user) ? undefined : user.schoolIds,
      modules,
      q: url.searchParams.get('q') ?? undefined,
      categoryId: url.searchParams.get('categoryId') ?? undefined,
      storageLocationId: url.searchParams.get('storageLocationId') ?? undefined,
      characteristic: charKey && charValue ? { key: charKey, value: charValue } : undefined,
      page: Number(url.searchParams.get('page') ?? 1),
      pageSize: Number(url.searchParams.get('pageSize') ?? 20),
      sort: url.searchParams.get('sort') ?? 'name:asc',
    });

    return NextResponse.json(result);
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: Request) {
  try {
    const parsed = createItemBody.safeParse(await request.json());
    if (!parsed.success) {
      throw new AppError('VALIDATION', 'Dados do item inválidos.', {
        issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }

    const user = await requirePermission('item.create', {
      schoolId: parsed.data.schoolId,
      module: parsed.data.module,
    });
    const schoolId = resolveSchoolId(user, parsed.data.schoolId);

    const item = await createItem({ ...parsed.data, schoolId }, user.id);
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
