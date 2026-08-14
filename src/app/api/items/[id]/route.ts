import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { AppError, toErrorResponse } from '@/lib/errors';
import { updateItem } from '@/modules/catalogo/item-service';
import { requirePermission } from '@/server/guard';
import { canAccessSchool } from '@/server/rbac';
import type { ModuleType } from '@/modules/shared/enums';

const updateItemBody = z.object({
  name: z.string().min(1).optional(),
  code: z.string().min(1).optional(),
  minStock: z.number().nonnegative().optional(),
  active: z.boolean().optional(),
});

async function loadItem(id: string) {
  const item = await prisma.item.findUnique({
    where: { id },
    include: {
      category: { select: { name: true } },
      unitOfMeasure: { select: { abbreviation: true } },
      storageLocation: { select: { code: true } },
      stock: { select: { quantity: true } },
      characteristics: { select: { key: true, value: true } },
      foodBatches: {
        where: { active: true },
        orderBy: { expiryDate: 'asc' },
        select: { id: true, batchNumber: true, expiryDate: true, quantity: true },
      },
    },
  });
  if (!item) throw new AppError('NOT_FOUND', 'Item não encontrado.');
  return item;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const item = await loadItem(id);

    const user = await requirePermission('item.view', {
      schoolId: item.schoolId,
      module: item.module as ModuleType,
    });
    if (!canAccessSchool(user, item.schoolId)) {
      throw new AppError('FORBIDDEN', 'Item fora do escopo da sua escola.');
    }

    return NextResponse.json(item);
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const item = await loadItem(id);

    const user = await requirePermission('item.update', {
      schoolId: item.schoolId,
      module: item.module as ModuleType,
    });
    if (!canAccessSchool(user, item.schoolId)) {
      throw new AppError('FORBIDDEN', 'Item fora do escopo da sua escola.');
    }

    const parsed = updateItemBody.safeParse(await request.json());
    if (!parsed.success) {
      throw new AppError('VALIDATION', 'Dados do item inválidos.', {
        issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }

    // updateItem bloqueia alteração de código quando já existe movimentação.
    const updated = await updateItem(id, parsed.data, user.id);
    return NextResponse.json(updated);
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
