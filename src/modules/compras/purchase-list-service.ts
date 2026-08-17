// Listas de compras: geradas a partir das sugestões selecionadas e/ou das
// solicitações de aquisição. Os números do estoque são congelados na geração,
// para que a lista continue auditável depois que o saldo mudar.
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/errors';
import { formatPurchaseListNumber } from '@/modules/catalogo/code';
import { nextSequenceValue, purchaseListScope } from '@/modules/catalogo/code-sequence';
import { writeAuditLog } from '@/modules/auditoria/audit-service';
import {
  PurchaseItemSource,
  PurchaseListStatus,
  PurchaseRequestStatus,
  type ModuleType,
} from '@/modules/shared/enums';
import { canAccessSchool, schoolScopeFilter, type AuthUser } from '@/server/rbac';
import { PURCHASE_DEFAULTS } from '@/modules/compras/constants';
import { buildSuggestion } from '@/modules/compras/purchase-domain';
import { getPurchaseCandidates } from '@/modules/compras/suggestion-service';
import type { CreatePurchaseListInput } from '@/modules/compras/purchase.schema';

const LIST_INCLUDE = {
  items: {
    include: {
      item: {
        select: {
          id: true,
          code: true,
          name: true,
          unitOfMeasure: { select: { abbreviation: true } },
          category: { select: { name: true, group: true } },
        },
      },
      request: { select: { id: true, number: true, requestedById: true } },
    },
  },
  requests: {
    select: { id: true, number: true, itemDescription: true, quantity: true, status: true },
  },
} satisfies Prisma.PurchaseListInclude;

/** Linha da lista pronta para gravar, já com os números congelados. */
interface PreparedLine {
  itemId: string;
  quantity: number;
  currentQuantity: number;
  minStock: number;
  dailyAvg: number;
  coverageDays: number | null;
  priority: string;
  source: PurchaseItemSource;
  requestId: string | null;
  notes: string | null;
}

/** Transições válidas do ciclo de vida da lista. */
const LIST_TRANSITIONS: Record<PurchaseListStatus, PurchaseListStatus[]> = {
  ABERTA: [PurchaseListStatus.ENVIADA, PurchaseListStatus.CONCLUIDA, PurchaseListStatus.CANCELADA],
  ENVIADA: [PurchaseListStatus.CONCLUIDA, PurchaseListStatus.CANCELADA],
  CONCLUIDA: [],
  CANCELADA: [],
};

export async function createPurchaseList(
  user: AuthUser,
  input: CreatePurchaseListInput,
  ctx: { schoolId: string },
) {
  const { schoolId } = ctx;
  const days = input.days ?? PURCHASE_DEFAULTS.analysisDays;

  // Números atuais de todos os itens do escopo — base para congelar a lista.
  const candidates = await getPurchaseCandidates(user, [input.module], { days });
  const byItem = new Map(candidates.map((c) => [c.itemId, c]));

  // Todos os itens precisam ser da escola e do módulo informados (isolamento).
  const requestedItemIds = input.items.map((i) => i.itemId);
  if (requestedItemIds.length > 0) {
    const valid = await prisma.item.findMany({
      where: { id: { in: requestedItemIds }, schoolId, module: input.module },
      select: { id: true },
    });
    if (valid.length !== new Set(requestedItemIds).size) {
      throw new AppError('FORBIDDEN', 'Item inexistente ou fora do escopo desta escola/módulo.');
    }
  }

  const lines = new Map<string, PreparedLine>();

  for (const chosen of input.items) {
    const candidate = byItem.get(chosen.itemId);
    if (!candidate) throw new AppError('NOT_FOUND', 'Item não encontrado para gerar a sugestão.');

    const suggestion = buildSuggestion(candidate, { days });
    const quantity = chosen.quantity ?? suggestion.suggestedQty;
    if (quantity <= 0) {
      throw new AppError('VALIDATION', `Informe a quantidade a comprar de ${candidate.name}.`);
    }

    lines.set(chosen.itemId, {
      itemId: chosen.itemId,
      quantity,
      currentQuantity: suggestion.balance,
      minStock: suggestion.minStock,
      dailyAvg: suggestion.dailyAvg,
      coverageDays: suggestion.coverageDays === null ? null : Math.floor(suggestion.coverageDays),
      priority: suggestion.priority,
      source: chosen.source ?? PurchaseItemSource.SUGESTAO,
      requestId: null,
      notes: chosen.notes ?? null,
    });
  }

  // Solicitações incorporadas à lista.
  const requests = input.requestIds.length
    ? await prisma.purchaseRequest.findMany({
        where: { id: { in: input.requestIds }, schoolId, module: input.module },
        select: {
          id: true,
          itemId: true,
          quantity: true,
          status: true,
          priority: true,
          purchaseListId: true,
        },
      })
    : [];

  if (requests.length !== new Set(input.requestIds).size) {
    throw new AppError(
      'FORBIDDEN',
      'Solicitação inexistente ou fora do escopo desta escola/módulo.',
    );
  }

  for (const request of requests) {
    if (request.purchaseListId) {
      throw new AppError('CONFLICT', 'Solicitação já vinculada a outra lista de compras.');
    }
    const openStatuses: string[] = [PurchaseRequestStatus.PENDENTE, PurchaseRequestStatus.APROVADA];
    if (!openStatuses.includes(request.status)) {
      throw new AppError(
        'CONFLICT',
        'Somente solicitações pendentes ou aprovadas entram em uma lista de compras.',
      );
    }
    if (!request.itemId) continue; // material sem cadastro: fica só vinculado à lista

    const candidate = byItem.get(request.itemId);
    const existing = lines.get(request.itemId);
    const quantity = Number(request.quantity) + (existing?.quantity ?? 0);

    lines.set(request.itemId, {
      itemId: request.itemId,
      quantity,
      currentQuantity: existing?.currentQuantity ?? candidate?.balance ?? 0,
      minStock: existing?.minStock ?? candidate?.minStock ?? 0,
      dailyAvg: existing?.dailyAvg ?? candidate?.dailyAvg ?? 0,
      coverageDays:
        existing?.coverageDays ??
        (candidate && candidate.dailyAvg > 0
          ? Math.floor(candidate.balance / candidate.dailyAvg)
          : null),
      priority: existing?.priority ?? request.priority,
      source: PurchaseItemSource.SOLICITACAO,
      requestId: request.id,
      notes: existing?.notes ?? null,
    });
  }

  if (lines.size === 0 && requests.length === 0) {
    throw new AppError('VALIDATION', 'Nenhum item selecionado para a lista de compras.');
  }

  return prisma.$transaction(async (tx) => {
    const seq = await nextSequenceValue(tx, purchaseListScope(schoolId));
    const number = formatPurchaseListNumber(seq);

    const list = await tx.purchaseList.create({
      data: {
        number,
        schoolId,
        module: input.module,
        title: input.title ?? null,
        notes: input.notes ?? null,
        periodDays: days,
        createdById: user.id,
        items: {
          create: [...lines.values()].map((line) => ({
            itemId: line.itemId,
            requestId: line.requestId,
            quantity: new Prisma.Decimal(line.quantity),
            currentQuantity: new Prisma.Decimal(line.currentQuantity),
            minStock: new Prisma.Decimal(line.minStock),
            dailyAvg: new Prisma.Decimal(line.dailyAvg),
            coverageDays: line.coverageDays,
            priority: line.priority as 'BAIXA' | 'MEDIA' | 'ALTA',
            source: line.source,
            notes: line.notes,
          })),
        },
      },
      include: LIST_INCLUDE,
    });

    if (requests.length > 0) {
      await tx.purchaseRequest.updateMany({
        where: { id: { in: requests.map((r) => r.id) } },
        data: { purchaseListId: list.id },
      });
    }

    await writeAuditLog(
      {
        userId: user.id,
        schoolId,
        action: 'PURCHASE_LIST',
        resource: 'PurchaseList',
        resourceId: list.id,
        after: { number, items: lines.size, requests: requests.length },
      },
      tx,
    );

    return list;
  });
}

export async function listPurchaseLists(
  user: AuthUser,
  params: {
    module?: ModuleType;
    modules?: ModuleType[];
    status?: PurchaseListStatus;
    page?: number;
    pageSize?: number;
  } = {},
) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));

  const where: Prisma.PurchaseListWhereInput = {
    ...schoolScopeFilter(user),
    ...(params.modules
      ? { module: { in: params.modules } }
      : params.module
        ? { module: params.module }
        : {}),
    ...(params.status ? { status: params.status } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.purchaseList.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { _count: { select: { items: true, requests: true } } },
    }),
    prisma.purchaseList.count({ where }),
  ]);

  return { data, page, pageSize, total, totalPages: Math.ceil(total / pageSize) || 1 };
}

export async function getPurchaseList(user: AuthUser, id: string) {
  const list = await prisma.purchaseList.findUnique({ where: { id }, include: LIST_INCLUDE });
  if (!list) throw new AppError('NOT_FOUND', 'Lista de compras não encontrada.');
  if (!canAccessSchool(user, list.schoolId)) {
    throw new AppError('FORBIDDEN', 'Lista de compras de outra escola.');
  }
  return list;
}

export async function updatePurchaseListStatus(
  user: AuthUser,
  id: string,
  status: PurchaseListStatus,
) {
  const list = await prisma.purchaseList.findUnique({
    where: { id },
    select: { id: true, schoolId: true, status: true, number: true },
  });
  if (!list) throw new AppError('NOT_FOUND', 'Lista de compras não encontrada.');
  if (!canAccessSchool(user, list.schoolId)) {
    throw new AppError('FORBIDDEN', 'Lista de compras de outra escola.');
  }

  const from = list.status as PurchaseListStatus;
  if (!LIST_TRANSITIONS[from].includes(status)) {
    throw new AppError('CONFLICT', 'Mudança de situação não permitida para esta lista.');
  }

  const isClosing =
    status === PurchaseListStatus.CONCLUIDA || status === PurchaseListStatus.CANCELADA;

  return prisma.$transaction(async (tx) => {
    // Guarda de estado: a transição só se aplica se o status ainda for `from`,
    // impedindo que concluir e cancelar concorrentes se sobrescrevam.
    const { count } = await tx.purchaseList.updateMany({
      where: { id, status: from },
      data: {
        status,
        ...(isClosing ? { closedById: user.id, closedAt: new Date() } : {}),
      },
    });
    if (count === 0) {
      throw new AppError(
        'CONFLICT',
        'A lista foi alterada por outro usuário. Recarregue a página e tente novamente.',
      );
    }

    const updated = await tx.purchaseList.findUniqueOrThrow({ where: { id } });

    await writeAuditLog(
      {
        userId: user.id,
        schoolId: list.schoolId,
        action: 'PURCHASE_LIST',
        resource: 'PurchaseList',
        resourceId: id,
        before: { status: from },
        after: { number: list.number, status },
      },
      tx,
    );

    return updated;
  });
}
