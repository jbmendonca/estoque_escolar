import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { AppError, toErrorResponse } from '@/lib/errors';
import { requirePermission, resolveSchoolId } from '@/server/guard';
import { isSuperAdmin } from '@/server/rbac';
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

    const data = await prisma.category.findMany({
      where: {
        active: true,
        ...(moduleParam ? { module: moduleParam } : {}),
        // Isolamento por escola (tenant).
        ...(schoolId ? { schoolId } : isSuperAdmin(user) ? {} : { schoolId: { in: user.schoolIds } }),
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
