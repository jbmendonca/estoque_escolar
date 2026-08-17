import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { toErrorResponse, AppError } from '@/lib/errors';
import { createMovementSchema } from '@/modules/movimentacoes/movement.schema';
import { createMovement } from '@/modules/movimentacoes/movement-service';
import { requirePermission, resolveSchoolId } from '@/server/guard';
import { resolveVisibleModules, schoolScopeFilter } from '@/server/rbac';
import type { ModuleType } from '@/modules/shared/enums';

export async function POST(request: Request) {
  try {
    const raw = await request.json();
    const parsed = createMovementSchema.safeParse(raw);
    if (!parsed.success) {
      throw new AppError('VALIDATION', 'Dados da movimentação inválidos.', {
        issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    const input = parsed.data;
    const schoolId = (raw?.schoolId as string | undefined) ?? undefined;

    // Autorização no servidor, com escopo de escola E de módulo
    // (Merendeira só FOOD; Assistente de Aluno só SCHOOL_MATERIAL).
    const user = await requirePermission('movement.create', {
      schoolId,
      module: input.module,
    });
    const targetSchool = resolveSchoolId(user, schoolId);

    const result = await createMovement(input, { userId: user.id, schoolId: targetSchool });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const moduleParam = url.searchParams.get('module') as ModuleType | null;
    const schoolId = url.searchParams.get('schoolId') ?? undefined;

    const user = await requirePermission('movement.view', {
      schoolId,
      module: moduleParam ?? undefined,
    });

    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize') ?? 20)));

    // Isolamento de módulo mesmo sem `module` na query (Merenda ↔ Material).
    const modules = resolveVisibleModules(user, schoolId, moduleParam);

    const where = {
      ...schoolScopeFilter(user),
      ...(schoolId ? { schoolId } : {}),
      module: { in: modules },
    };

    const [data, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: { select: { name: true } },
          items: { include: { item: { select: { name: true, code: true } } } },
        },
      }),
      prisma.stockMovement.count({ where }),
    ]);

    return NextResponse.json({
      data,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize) || 1,
    });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
