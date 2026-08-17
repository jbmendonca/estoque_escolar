import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { AppError, toErrorResponse } from '@/lib/errors';
import { requirePermission, resolveSchoolId } from '@/server/guard';
import { resolveVisibleModules, schoolScopeFilter } from '@/server/rbac';
import { ModuleType } from '@/modules/shared/enums';

const createBody = z.object({
  name: z.string().trim().min(1, 'Informe o nome da categoria.'),
  module: z.nativeEnum(ModuleType),
  schoolId: z.string().optional(),
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

    const modules = resolveVisibleModules(user, schoolId, moduleParam);

    const data = await prisma.category.findMany({
      where: {
        active: true,
        // Isolamento de módulo (Merenda ↔ Material), mesmo sem `module` na query.
        module: { in: modules },
        // Isolamento por escola (tenant).
        ...(schoolId ? { schoolId } : schoolScopeFilter(user)),
      },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, module: true, schoolId: true },
    });

    return NextResponse.json({ data });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: Request) {
  try {
    const parsed = createBody.safeParse(await request.json());
    if (!parsed.success) {
      throw new AppError('VALIDATION', 'Dados da categoria inválidos.');
    }
    const user = await requirePermission('catalog.manage', {
      schoolId: parsed.data.schoolId,
      module: parsed.data.module,
    });
    const schoolId = resolveSchoolId(user, parsed.data.schoolId);

    const category = await prisma.category.create({
      data: { schoolId, name: parsed.data.name, module: parsed.data.module },
    });
    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
