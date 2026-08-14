import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { AppError, toErrorResponse } from '@/lib/errors';
import { requirePermission, resolveSchoolId } from '@/server/guard';
import { isSuperAdmin } from '@/server/rbac';

const createBody = z.object({
  name: z.string().trim().min(1, 'Informe o nome da unidade.'),
  abbreviation: z.string().trim().min(1, 'Informe a sigla.'),
  schoolId: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const schoolId = url.searchParams.get('schoolId') ?? undefined;
    const user = await requirePermission('item.view', { schoolId });

    const data = await prisma.unitOfMeasure.findMany({
      where: {
        active: true,
        ...(schoolId ? { schoolId } : isSuperAdmin(user) ? {} : { schoolId: { in: user.schoolIds } }),
      },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, abbreviation: true, schoolId: true },
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
      throw new AppError('VALIDATION', 'Dados da unidade inválidos.');
    }
    const user = await requirePermission('catalog.manage', { schoolId: parsed.data.schoolId });
    const schoolId = resolveSchoolId(user, parsed.data.schoolId);

    const unit = await prisma.unitOfMeasure.create({
      data: { schoolId, name: parsed.data.name, abbreviation: parsed.data.abbreviation },
    });
    return NextResponse.json(unit, { status: 201 });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
