// Serviço de catálogo: criação com código único, características variáveis,
// listagem server-side (busca/filtros/paginação/ordenação alfabética por padrão).
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/errors';
import { formatItemCode, itemSequenceScope, assertItemCodeChangeAllowed } from '@/modules/catalogo/code';
import { nextSequenceValue } from '@/modules/catalogo/code-sequence';
import type { ModuleType } from '@/modules/shared/enums';

export interface CreateItemInput {
  schoolId: string;
  module: ModuleType;
  name: string;
  description?: string;
  categoryId: string;
  unitOfMeasureId: string;
  storageLocationId?: string;
  brand?: string;
  minStock?: number;
  characteristics?: Array<{ key: string; value: string }>;
}

export async function createItem(input: CreateItemInput, userId: string) {
  return prisma.$transaction(async (tx) => {
    const seq = await nextSequenceValue(tx, itemSequenceScope(input.module));
    const code = formatItemCode(input.module, seq);

    const item = await tx.item.create({
      data: {
        schoolId: input.schoolId,
        code,
        module: input.module,
        name: input.name,
        description: input.description ?? null,
        categoryId: input.categoryId,
        unitOfMeasureId: input.unitOfMeasureId,
        storageLocationId: input.storageLocationId ?? null,
        brand: input.brand ?? null,
        minStock: new Prisma.Decimal(input.minStock ?? 0),
        createdById: userId,
        characteristics: input.characteristics?.length
          ? { create: input.characteristics.map((c) => ({ key: c.key, value: c.value })) }
          : undefined,
        stock: { create: { schoolId: input.schoolId, quantity: new Prisma.Decimal(0) } },
      },
    });

    await tx.auditLog.create({
      data: {
        userId,
        schoolId: input.schoolId,
        action: 'ITEM_CREATE',
        resource: 'Item',
        resourceId: item.id,
        after: { code, name: item.name, module: item.module } as Prisma.InputJsonValue,
      },
    });

    return item;
  });
}

export interface ListItemsParams {
  schoolIds?: string[];
  module?: ModuleType;
  /** Restringe aos módulos visíveis ao usuário (isolamento Merenda ↔ Material). */
  modules?: ModuleType[];
  q?: string;
  categoryId?: string;
  storageLocationId?: string;
  characteristic?: { key: string; value: string };
  page?: number;
  pageSize?: number;
  sort?: string;
}

export async function listItems(params: ListItemsParams) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const [sortField, sortDir] = (params.sort ?? 'name:asc').split(':');
  const orderBy = buildOrderBy(sortField, sortDir);

  const where: Prisma.ItemWhereInput = {
    ...(params.schoolIds ? { schoolId: { in: params.schoolIds } } : {}),
    ...(params.modules ? { module: { in: params.modules } } : params.module ? { module: params.module } : {}),
    ...(params.categoryId ? { categoryId: params.categoryId } : {}),
    ...(params.storageLocationId ? { storageLocationId: params.storageLocationId } : {}),
    ...(params.q
      ? {
          OR: [
            { name: { contains: params.q, mode: 'insensitive' } },
            { code: { contains: params.q, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(params.characteristic
      ? {
          characteristics: {
            some: {
              key: params.characteristic.key,
              value: { contains: params.characteristic.value, mode: 'insensitive' },
            },
          },
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.item.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        category: { select: { name: true } },
        unitOfMeasure: { select: { abbreviation: true } },
        storageLocation: { select: { code: true } },
        stock: { select: { quantity: true } },
        characteristics: { select: { key: true, value: true } },
      },
    }),
    prisma.item.count({ where }),
  ]);

  return { data, page, pageSize, total, totalPages: Math.ceil(total / pageSize) || 1 };
}

function buildOrderBy(field?: string, dir?: string): Prisma.ItemOrderByWithRelationInput {
  const direction: Prisma.SortOrder = dir === 'desc' ? 'desc' : 'asc';
  switch (field) {
    case 'code':
      return { code: direction };
    case 'createdAt':
      return { createdAt: direction };
    // Ordenação alfabética por nome é o padrão (FR-010).
    default:
      return { name: direction };
  }
}

/** Atualiza um item, impedindo alteração de código quando já houve movimentação. */
export async function updateItem(
  itemId: string,
  data: { name?: string; code?: string; minStock?: number; active?: boolean },
  userId: string,
) {
  const item = await prisma.item.findUnique({ where: { id: itemId } });
  if (!item) throw new AppError('NOT_FOUND', 'Item não encontrado.');

  if (data.code && data.code !== item.code) {
    const movements = await prisma.stockMovementItem.count({ where: { itemId } });
    assertItemCodeChangeAllowed(movements > 0);
  }

  const updated = await prisma.item.update({
    where: { id: itemId },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.code !== undefined ? { code: data.code } : {}),
      ...(data.minStock !== undefined ? { minStock: new Prisma.Decimal(data.minStock) } : {}),
      ...(data.active !== undefined ? { active: data.active } : {}),
    },
  });

  await prisma.auditLog.create({
    data: {
      userId,
      schoolId: item.schoolId,
      action: 'ITEM_UPDATE',
      resource: 'Item',
      resourceId: itemId,
      before: { name: item.name, code: item.code } as Prisma.InputJsonValue,
      after: { name: updated.name, code: updated.code } as Prisma.InputJsonValue,
    },
  });

  return updated;
}
