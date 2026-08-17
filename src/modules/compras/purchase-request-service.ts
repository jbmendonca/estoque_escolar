// Solicitações de aquisição: criação pelo funcionário/professor e avanço do
// fluxo (pendente → aprovada → comprada → recebida) com histórico de quem fez o quê.
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/errors';
import { formatPurchaseRequestNumber } from '@/modules/catalogo/code';
import { nextSequenceValue, purchaseRequestScope } from '@/modules/catalogo/code-sequence';
import { writeAuditLog } from '@/modules/auditoria/audit-service';
import { PurchaseRequestStatus, type ModuleType } from '@/modules/shared/enums';
import { can, canAccessSchool, schoolScopeFilter, type AuthUser } from '@/server/rbac';
import {
  assertTransition,
  canCancelOwnRequest,
  permissionForTransition,
  stampsForTransition,
} from '@/modules/compras/request-workflow';
import type { CreatePurchaseRequestInput } from '@/modules/compras/purchase.schema';

const REQUEST_INCLUDE = {
  item: {
    select: { id: true, code: true, name: true, unitOfMeasure: { select: { abbreviation: true } } },
  },
  purchaseList: { select: { id: true, number: true, status: true } },
} satisfies Prisma.PurchaseRequestInclude;

/** Nomes dos usuários envolvidos, para exibir o histórico sem N+1. */
export async function loadUserNames(userIds: Array<string | null | undefined>) {
  const ids = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return new Map<string, string>();
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  });
  return new Map(users.map((u) => [u.id, u.name]));
}

export async function createPurchaseRequest(
  input: CreatePurchaseRequestInput,
  ctx: { userId: string; schoolId: string },
) {
  const { userId, schoolId } = ctx;

  // Isolamento: o item precisa ser da mesma escola e do mesmo módulo.
  if (input.itemId) {
    const item = await prisma.item.findFirst({
      where: { id: input.itemId, schoolId, module: input.module },
      select: { id: true },
    });
    if (!item) {
      throw new AppError('FORBIDDEN', 'Item inexistente ou fora do escopo desta escola/módulo.');
    }
  }

  return prisma.$transaction(async (tx) => {
    const seq = await nextSequenceValue(tx, purchaseRequestScope(schoolId));
    const number = formatPurchaseRequestNumber(seq);

    const request = await tx.purchaseRequest.create({
      data: {
        number,
        schoolId,
        module: input.module,
        itemId: input.itemId ?? null,
        itemDescription: input.itemDescription ?? null,
        categoryGroup: input.categoryGroup ?? null,
        quantity: new Prisma.Decimal(input.quantity),
        justification: input.justification,
        priority: input.priority ?? 'MEDIA',
        status: PurchaseRequestStatus.PENDENTE,
        requestedById: userId,
        events: {
          create: {
            toStatus: PurchaseRequestStatus.PENDENTE,
            userId,
            note: 'Solicitação registrada.',
          },
        },
      },
      include: REQUEST_INCLUDE,
    });

    await writeAuditLog(
      {
        userId,
        schoolId,
        action: 'PURCHASE_REQUEST',
        resource: 'PurchaseRequest',
        resourceId: request.id,
        after: { number, quantity: input.quantity, itemId: input.itemId ?? null },
      },
      tx,
    );

    return request;
  });
}

export interface ListRequestsParams {
  module?: ModuleType;
  modules?: ModuleType[];
  status?: PurchaseRequestStatus;
  /** Somente as solicitações do próprio usuário. */
  requestedById?: string;
  page?: number;
  pageSize?: number;
}

export async function listPurchaseRequests(user: AuthUser, params: ListRequestsParams = {}) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));

  const where: Prisma.PurchaseRequestWhereInput = {
    ...schoolScopeFilter(user),
    ...(params.modules
      ? { module: { in: params.modules } }
      : params.module
        ? { module: params.module }
        : {}),
    ...(params.status ? { status: params.status } : {}),
    ...(params.requestedById ? { requestedById: params.requestedById } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.purchaseRequest.findMany({
      where,
      // Pendentes primeiro (é o que exige ação), depois as mais recentes.
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: REQUEST_INCLUDE,
    }),
    prisma.purchaseRequest.count({ where }),
  ]);

  return { data, page, pageSize, total, totalPages: Math.ceil(total / pageSize) || 1 };
}

/** Solicitação com o histórico completo (quem solicitou, aprovou, comprou, recebeu). */
export async function getPurchaseRequest(user: AuthUser, id: string) {
  const request = await prisma.purchaseRequest.findUnique({
    where: { id },
    include: { ...REQUEST_INCLUDE, events: { orderBy: { createdAt: 'asc' } } },
  });
  if (!request) throw new AppError('NOT_FOUND', 'Solicitação não encontrada.');
  if (!canAccessSchool(user, request.schoolId)) {
    throw new AppError('FORBIDDEN', 'Solicitação de outra escola.');
  }
  return request;
}

/**
 * Avança o fluxo da solicitação.
 * A autorização é decidida aqui (e não só na rota) porque depende do registro:
 * o próprio solicitante pode cancelar a sua solicitação ainda pendente.
 */
export async function transitionPurchaseRequest(
  user: AuthUser,
  id: string,
  input: { status: PurchaseRequestStatus; note?: string },
) {
  const current = await prisma.purchaseRequest.findUnique({
    where: { id },
    select: {
      id: true,
      schoolId: true,
      module: true,
      status: true,
      requestedById: true,
      number: true,
    },
  });
  if (!current) throw new AppError('NOT_FOUND', 'Solicitação não encontrada.');
  if (!canAccessSchool(user, current.schoolId)) {
    throw new AppError('FORBIDDEN', 'Solicitação de outra escola.');
  }

  const from = current.status as PurchaseRequestStatus;
  const to = input.status;

  const ownCancel =
    to === PurchaseRequestStatus.CANCELADA &&
    canCancelOwnRequest(from, current.requestedById, user.id);

  if (!ownCancel) {
    const permission = permissionForTransition(to);
    if (!can(user, permission, { schoolId: current.schoolId, module: current.module })) {
      throw new AppError('FORBIDDEN', 'Você não possui autorização para esta etapa da compra.', {
        permission,
      });
    }
  }

  assertTransition(from, to, { note: input.note });

  const now = new Date();
  return prisma.$transaction(async (tx) => {
    // Guarda de estado (compare-and-set): a escrita só ocorre se o status ainda
    // for `from`. Sob duas decisões concorrentes sobre a mesma solicitação, a
    // segunda encontra count === 0 e é rejeitada, preservando a trilha coerente.
    const { count } = await tx.purchaseRequest.updateMany({
      where: { id, status: from },
      data: {
        status: to,
        ...stampsForTransition(to, user.id, now),
        ...(input.note ? { decisionNote: input.note } : {}),
      },
    });
    if (count === 0) {
      throw new AppError(
        'CONFLICT',
        'A solicitação foi alterada por outro usuário. Recarregue a página e tente novamente.',
      );
    }

    await tx.purchaseRequestEvent.create({
      data: { requestId: id, fromStatus: from, toStatus: to, userId: user.id, note: input.note ?? null },
    });

    const updated = await tx.purchaseRequest.findUniqueOrThrow({
      where: { id },
      include: REQUEST_INCLUDE,
    });

    await writeAuditLog(
      {
        userId: user.id,
        schoolId: current.schoolId,
        action: 'PURCHASE_REVIEW',
        resource: 'PurchaseRequest',
        resourceId: id,
        before: { status: from },
        after: { number: current.number, status: to, note: input.note ?? null },
      },
      tx,
    );

    return updated;
  });
}
