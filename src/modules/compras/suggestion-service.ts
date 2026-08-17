// Sugestão automática de compra: junta o estoque atual, o estoque mínimo, o
// consumo médio do histórico e o que já foi solicitado, e devolve a lista
// inteligente de compras. Sempre restrito à(s) escola(s) e módulos do usuário.
import { prisma } from '@/lib/prisma';
import { getItemUsage, type ItemUsage } from '@/modules/dashboard/analytics-service';
import { PurchaseListStatus, StockHealth, type ModuleType } from '@/modules/shared/enums';
import type { CategoryGroup } from '@/modules/shared/enums';
import { schoolScopeFilter, type AuthUser } from '@/server/rbac';
import { PURCHASE_DEFAULTS, type PurchaseParams } from '@/modules/compras/constants';
import {
  buildSuggestions,
  classifyHealth,
  computeCoverageDays,
  type PurchaseCandidate,
  type PurchaseSuggestion,
} from '@/modules/compras/purchase-domain';
import { OPEN_REQUEST_STATUSES } from '@/modules/compras/request-workflow';

export interface SuggestionQuery {
  /** Janela de histórico analisada (padrão: 90 dias). */
  days?: number;
  params?: Partial<PurchaseParams>;
  categoryGroup?: CategoryGroup;
}

/** Listas cujos itens ainda representam compras em andamento. */
const OPEN_LIST_STATUSES = [PurchaseListStatus.ABERTA, PurchaseListStatus.ENVIADA];

function schoolScope(user: AuthUser) {
  return schoolScopeFilter(user);
}

/**
 * Quantidade por item já solicitada e ainda não recebida.
 * Conta as solicitações abertas e os itens de listas abertas que NÃO vieram de
 * uma solicitação (senão a mesma quantidade seria contada duas vezes).
 */
export async function getPendingQuantities(user: AuthUser): Promise<Map<string, number>> {
  const scope = schoolScope(user);

  const [requests, listItems] = await Promise.all([
    prisma.purchaseRequest.groupBy({
      by: ['itemId'],
      where: { ...scope, status: { in: OPEN_REQUEST_STATUSES }, itemId: { not: null } },
      _sum: { quantity: true },
    }),
    prisma.purchaseListItem.groupBy({
      by: ['itemId'],
      where: { requestId: null, list: { ...scope, status: { in: OPEN_LIST_STATUSES } } },
      _sum: { quantity: true },
    }),
  ]);

  const pending = new Map<string, number>();
  for (const row of requests) {
    if (!row.itemId) continue;
    pending.set(row.itemId, Number(row._sum.quantity ?? 0));
  }
  for (const row of listItems) {
    pending.set(row.itemId, (pending.get(row.itemId) ?? 0) + Number(row._sum.quantity ?? 0));
  }
  return pending;
}

function toCandidate(usage: ItemUsage, pendingQty: number): PurchaseCandidate {
  return {
    itemId: usage.itemId,
    code: usage.code,
    name: usage.name,
    unit: usage.unit,
    module: usage.module,
    categoryName: usage.categoryName,
    categoryGroup: (usage.categoryGroup as CategoryGroup | null) ?? null,
    balance: usage.balance,
    minStock: usage.minStock,
    consumed: usage.consumed,
    dailyAvg: usage.dailyAvg,
    pendingQty,
  };
}

/** Todos os itens ativos do escopo, com os números necessários à análise. */
export async function getPurchaseCandidates(
  user: AuthUser,
  modules: ModuleType[],
  query: SuggestionQuery = {},
): Promise<PurchaseCandidate[]> {
  const days = query.days ?? PURCHASE_DEFAULTS.analysisDays;
  const [usage, pending] = await Promise.all([
    getItemUsage(user, modules, { days }),
    getPendingQuantities(user),
  ]);

  return usage
    .map((u) => toCandidate(u, pending.get(u.itemId) ?? 0))
    .filter((c) => !query.categoryGroup || c.categoryGroup === query.categoryGroup);
}

/** Lista de compras inteligente: só os itens que precisam de reposição. */
export async function getSuggestions(
  user: AuthUser,
  modules: ModuleType[],
  query: SuggestionQuery = {},
): Promise<PurchaseSuggestion[]> {
  const days = query.days ?? PURCHASE_DEFAULTS.analysisDays;
  const candidates = await getPurchaseCandidates(user, modules, query);
  return buildSuggestions(candidates, { days, params: query.params });
}

export interface PurchaseDashboard {
  /** 🔴 / 🟡 / 🟢 — quantidade de itens em cada faixa. */
  health: Record<StockHealth, number>;
  /** 🛒 itens em listas de compras abertas. */
  itemsInLists: number;
  openLists: number;
  /** 📋 solicitações aguardando aprovação. */
  pendingRequests: number;
  approvedRequests: number;
  /** Itens com sugestão de compra de prioridade alta. */
  highPriority: number;
  suggestionsCount: number;
  /** 📊 materiais mais consumidos na janela analisada. */
  topConsumed: Array<{
    itemId: string;
    name: string;
    unit: string;
    categoryGroup: string | null;
    consumed: number;
    dailyAvg: number;
  }>;
  /** Consumo agregado por grupo de categoria. */
  byGroup: Array<{ group: string | null; consumed: number; dailyAvg: number; items: number }>;
  days: number;
}

/** Indicadores do painel de compras. */
export async function getPurchaseDashboard(
  user: AuthUser,
  modules: ModuleType[],
  query: SuggestionQuery = {},
): Promise<PurchaseDashboard> {
  const days = query.days ?? PURCHASE_DEFAULTS.analysisDays;
  const scope = schoolScope(user);

  const [candidates, itemsInLists, openLists, pendingRequests, approvedRequests] =
    await Promise.all([
      getPurchaseCandidates(user, modules, query),
      prisma.purchaseListItem.count({
        where: { list: { ...scope, status: { in: OPEN_LIST_STATUSES }, module: { in: modules } } },
      }),
      prisma.purchaseList.count({
        where: { ...scope, status: { in: OPEN_LIST_STATUSES }, module: { in: modules } },
      }),
      prisma.purchaseRequest.count({
        where: { ...scope, status: 'PENDENTE', module: { in: modules } },
      }),
      prisma.purchaseRequest.count({
        where: { ...scope, status: 'APROVADA', module: { in: modules } },
      }),
    ]);

  const health: Record<StockHealth, number> = { CRITICO: 0, ATENCAO: 0, ADEQUADO: 0 };
  for (const c of candidates) {
    const coverageDays = computeCoverageDays(c.balance, c.dailyAvg);
    health[classifyHealth({ ...c, coverageDays }, { days, params: query.params })] += 1;
  }

  const suggestions = buildSuggestions(candidates, { days, params: query.params });

  const topConsumed = [...candidates]
    .filter((c) => c.consumed > 0)
    .sort((a, b) => b.consumed - a.consumed)
    .slice(0, 8)
    .map((c) => ({
      itemId: c.itemId,
      name: c.name,
      unit: c.unit,
      categoryGroup: c.categoryGroup,
      consumed: c.consumed,
      dailyAvg: c.dailyAvg,
    }));

  const groups = new Map<string | null, { consumed: number; dailyAvg: number; items: number }>();
  for (const c of candidates) {
    const key = c.categoryGroup;
    const entry = groups.get(key) ?? { consumed: 0, dailyAvg: 0, items: 0 };
    entry.consumed += c.consumed;
    entry.dailyAvg += c.dailyAvg;
    entry.items += 1;
    groups.set(key, entry);
  }

  return {
    health,
    itemsInLists,
    openLists,
    pendingRequests,
    approvedRequests,
    highPriority: suggestions.filter((s) => s.priority === 'ALTA').length,
    suggestionsCount: suggestions.length,
    topConsumed,
    byGroup: [...groups.entries()]
      .map(([group, v]) => ({ group, ...v }))
      .sort((a, b) => b.consumed - a.consumed),
    days,
  };
}
