// Análises do painel: consumo, alertas, utilização inteligente e ranking de itens.
// Tudo por consultas agregadas no banco (nunca carregando listas grandes na aplicação)
// e sempre restrito à(s) escola(s) e aos módulos permitidos ao usuário.
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { classifyExpiry } from '@/modules/lotes/expiry';
import { ExpiryStatus, ModuleType } from '@/modules/shared/enums';
import { can, isAdmin, type AuthUser } from '@/server/rbac';

export interface AnalyticsOptions {
  /** Janela de análise em dias (padrão 30). */
  days?: number;
  nearExpiryDays?: number;
}

/** Módulos que o usuário pode ver (Merendeira só FOOD, Assistente só MATERIAL). */
export function visibleModules(user: AuthUser, schoolId?: string): ModuleType[] {
  return [ModuleType.FOOD, ModuleType.SCHOOL_MATERIAL].filter((module) =>
    can(user, 'item.view', { schoolId, module }),
  );
}

/** Filtro SQL de escola: admin vê tudo; demais, apenas as suas. */
function schoolSql(user: AuthUser): Prisma.Sql {
  if (isAdmin(user)) return Prisma.sql`TRUE`;
  if (user.schoolIds.length === 0) return Prisma.sql`FALSE`;
  return Prisma.sql`m."schoolId" IN (${Prisma.join(user.schoolIds)})`;
}

function itemSchoolSql(user: AuthUser): Prisma.Sql {
  if (isAdmin(user)) return Prisma.sql`TRUE`;
  if (user.schoolIds.length === 0) return Prisma.sql`FALSE`;
  return Prisma.sql`i."schoolId" IN (${Prisma.join(user.schoolIds)})`;
}

function modulesSql(modules: ModuleType[], alias: string): Prisma.Sql {
  if (modules.length === 0) return Prisma.sql`FALSE`;
  return Prisma.sql`${Prisma.raw(`${alias}."module"`)}::text IN (${Prisma.join(modules)})`;
}

// ---------------------------------------------------------------- KPIs

export interface Kpis {
  itemsFood: number;
  itemsMaterial: number;
  lowStock: number;
  outOfStock: number;
  nearExpiry: number;
  expired: number;
  movements: number;
  consumedQty: number;
  receivedQty: number;
  lossQty: number;
}

export async function getKpis(
  user: AuthUser,
  modules: ModuleType[],
  options: AnalyticsOptions = {},
): Promise<Kpis> {
  const days = options.days ?? 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const scope = isAdmin(user) ? {} : { schoolId: { in: user.schoolIds } };

  const [itemsFood, itemsMaterial, stocks, batches, movements, flows] = await Promise.all([
    modules.includes(ModuleType.FOOD)
      ? prisma.item.count({ where: { ...scope, module: ModuleType.FOOD, active: true } })
      : 0,
    modules.includes(ModuleType.SCHOOL_MATERIAL)
      ? prisma.item.count({ where: { ...scope, module: ModuleType.SCHOOL_MATERIAL, active: true } })
      : 0,
    prisma.stock.findMany({
      where: { ...scope, item: { active: true, module: { in: modules } } },
      select: { quantity: true, item: { select: { minStock: true } } },
    }),
    modules.includes(ModuleType.FOOD)
      ? prisma.foodBatch.findMany({
          where: { ...scope, active: true, quantity: { gt: 0 } },
          select: { expiryDate: true },
        })
      : [],
    prisma.stockMovement.count({
      where: { ...scope, module: { in: modules }, createdAt: { gte: since } },
    }),
    prisma.stockMovementItem.groupBy({
      by: ['movementId'],
      where: { movement: { ...scope, module: { in: modules }, createdAt: { gte: since } } },
      _sum: { quantity: true },
    }),
  ]);

  // Totais por natureza da movimentação (entrada, consumo, perda).
  const flowTotals = await prisma.stockMovement.findMany({
    where: { ...scope, module: { in: modules }, createdAt: { gte: since } },
    select: { type: true, direction: true, items: { select: { quantity: true } } },
  });

  let consumedQty = 0;
  let receivedQty = 0;
  let lossQty = 0;
  for (const m of flowTotals) {
    const total = m.items.reduce((acc, i) => acc + Number(i.quantity), 0);
    if (m.direction === 'IN') receivedQty += total;
    else if (m.type === 'PERDA' || m.type === 'AVARIA' || m.type === 'PRODUTO_VENCIDO')
      lossQty += total;
    else consumedQty += total;
  }

  const outOfStock = stocks.filter((s) => Number(s.quantity) <= 0).length;
  const lowStock = stocks.filter((s) => {
    const q = Number(s.quantity);
    const min = Number(s.item.minStock);
    return q > 0 && min > 0 && q < min;
  }).length;

  const nearExpiryDays = options.nearExpiryDays ?? 30;
  let nearExpiry = 0;
  let expired = 0;
  for (const b of batches) {
    const status = classifyExpiry(b.expiryDate, nearExpiryDays);
    if (status === ExpiryStatus.EXPIRED) expired += 1;
    else if (status === ExpiryStatus.NEAR_EXPIRY) nearExpiry += 1;
  }

  void flows;
  return {
    itemsFood,
    itemsMaterial,
    lowStock,
    outOfStock,
    nearExpiry,
    expired,
    movements,
    consumedQty,
    receivedQty,
    lossQty,
  };
}

// ------------------------------------------------- Série de consumo (por dia)

export interface ConsumptionPoint {
  day: string;
  saida: number;
  entrada: number;
}

export async function getConsumptionSeries(
  user: AuthUser,
  modules: ModuleType[],
  options: AnalyticsOptions = {},
): Promise<ConsumptionPoint[]> {
  const days = options.days ?? 30;
  const rows = await prisma.$queryRaw<Array<{ day: Date; direction: string; total: number }>>(
    Prisma.sql`
      SELECT date_trunc('day', m."createdAt") AS day,
             m."direction"::text AS direction,
             SUM(smi."quantity")::float8 AS total
      FROM "StockMovementItem" smi
      JOIN "StockMovement" m ON m."id" = smi."movementId"
      WHERE ${schoolSql(user)}
        AND ${modulesSql(modules, 'm')}
        AND m."createdAt" >= NOW() - (${days} || ' days')::interval
      GROUP BY 1, 2
      ORDER BY 1
    `,
  );

  const byDay = new Map<string, ConsumptionPoint>();
  for (const r of rows) {
    const key = new Date(r.day).toISOString().slice(0, 10);
    const point = byDay.get(key) ?? { day: key, saida: 0, entrada: 0 };
    if (r.direction === 'IN') point.entrada += Number(r.total);
    else point.saida += Number(r.total);
    byDay.set(key, point);
  }

  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}

// ------------------------------------------------- Ranking de itens (mais/menos usados)

export interface ItemUsage {
  itemId: string;
  code: string;
  name: string;
  unit: string;
  module: string;
  categoryName: string;
  consumed: number;
  movements: number;
  balance: number;
  minStock: number;
  /** Consumo médio por dia na janela analisada. */
  dailyAvg: number;
  /** Dias de cobertura estimados com o saldo atual (null = sem consumo). */
  coverageDays: number | null;
}

/** Consumo por item (apenas saídas), com saldo e cobertura estimada. */
export async function getItemUsage(
  user: AuthUser,
  modules: ModuleType[],
  options: AnalyticsOptions = {},
): Promise<ItemUsage[]> {
  const days = options.days ?? 30;

  const rows = await prisma.$queryRaw<
    Array<{
      itemId: string;
      code: string;
      name: string;
      unit: string;
      module: string;
      categoryName: string;
      consumed: number | null;
      movements: number | null;
      balance: number | null;
      minStock: number;
    }>
  >(
    Prisma.sql`
      SELECT i."id"            AS "itemId",
             i."code"          AS code,
             i."name"          AS name,
             u."abbreviation"  AS unit,
             i."module"::text  AS module,
             c."name"          AS "categoryName",
             COALESCE(SUM(smi."quantity") FILTER (WHERE m."direction" = 'OUT'), 0)::float8 AS consumed,
             COUNT(smi."id")   FILTER (WHERE m."direction" = 'OUT')                        AS movements,
             COALESCE(MAX(s."quantity"), 0)::float8                                        AS balance,
             i."minStock"::float8                                                          AS "minStock"
      FROM "Item" i
      JOIN "Category" c        ON c."id" = i."categoryId"
      JOIN "UnitOfMeasure" u   ON u."id" = i."unitOfMeasureId"
      LEFT JOIN "Stock" s      ON s."itemId" = i."id"
      LEFT JOIN "StockMovementItem" smi ON smi."itemId" = i."id"
      LEFT JOIN "StockMovement" m
             ON m."id" = smi."movementId"
            AND m."createdAt" >= NOW() - (${days} || ' days')::interval
      WHERE ${itemSchoolSql(user)}
        AND ${modulesSql(modules, 'i')}
        AND i."active" = TRUE
      GROUP BY i."id", i."code", i."name", u."abbreviation", i."module", c."name", i."minStock"
    `,
  );

  return rows.map((r) => {
    const consumed = Number(r.consumed ?? 0);
    const dailyAvg = consumed / days;
    const balance = Number(r.balance ?? 0);
    return {
      itemId: r.itemId,
      code: r.code,
      name: r.name,
      unit: r.unit,
      module: r.module,
      categoryName: r.categoryName,
      consumed,
      movements: Number(r.movements ?? 0),
      balance,
      minStock: Number(r.minStock),
      dailyAvg,
      coverageDays: dailyAvg > 0 ? balance / dailyAvg : null,
    };
  });
}

// ------------------------------------------------- Análise inteligente

export interface SmartAnalysis {
  /** Curva ABC por volume consumido (Pareto). */
  abc: { a: ItemUsage[]; b: ItemUsage[]; c: ItemUsage[] };
  /** Itens que devem acabar antes do prazo de reposição. */
  ruptureRisk: Array<ItemUsage & { coverageDays: number }>;
  /** Itens ativos sem nenhuma saída na janela (estoque parado). */
  idleItems: ItemUsage[];
  /** Giro do estoque: consumo total / saldo médio. */
  turnover: number;
  /** Percentual do estoque (em itens) que teve movimento. */
  activeRatio: number;
}

export function analyzeUsage(usage: ItemUsage[], options: { riskDays?: number } = {}): SmartAnalysis {
  const riskDays = options.riskDays ?? 15;

  // Curva ABC: ordena por consumo e acumula até 80% / 95%.
  const consumedTotal = usage.reduce((acc, u) => acc + u.consumed, 0);
  const ordered = [...usage].sort((a, b) => b.consumed - a.consumed);
  const abc: SmartAnalysis['abc'] = { a: [], b: [], c: [] };
  let cumulative = 0;
  for (const item of ordered) {
    if (item.consumed <= 0) {
      abc.c.push(item);
      continue;
    }
    cumulative += item.consumed;
    const share = consumedTotal > 0 ? cumulative / consumedTotal : 1;
    if (share <= 0.8) abc.a.push(item);
    else if (share <= 0.95) abc.b.push(item);
    else abc.c.push(item);
  }

  const ruptureRisk = usage
    .filter((u): u is ItemUsage & { coverageDays: number } => u.coverageDays !== null)
    .filter((u) => u.coverageDays <= riskDays)
    .sort((a, b) => a.coverageDays - b.coverageDays);

  const idleItems = usage
    .filter((u) => u.consumed === 0 && u.balance > 0)
    .sort((a, b) => b.balance - a.balance);

  const balanceTotal = usage.reduce((acc, u) => acc + u.balance, 0);
  const turnover = balanceTotal > 0 ? consumedTotal / balanceTotal : 0;
  const withMovement = usage.filter((u) => u.consumed > 0).length;
  const activeRatio = usage.length > 0 ? withMovement / usage.length : 0;

  return { abc, ruptureRisk, idleItems, turnover, activeRatio };
}

// ------------------------------------------------- Alertas de estoque baixo

export interface LowStockAlert extends ItemUsage {
  /** Percentual do estoque mínimo já disponível (0 = zerado). */
  minPercent: number;
  severity: 'ZERADO' | 'CRITICO' | 'BAIXO';
}

export function buildLowStockAlerts(usage: ItemUsage[]): LowStockAlert[] {
  return usage
    .filter((u) => u.minStock > 0 && u.balance < u.minStock)
    .map((u) => {
      const minPercent = u.minStock > 0 ? (u.balance / u.minStock) * 100 : 0;
      const severity: LowStockAlert['severity'] =
        u.balance <= 0 ? 'ZERADO' : minPercent <= 50 ? 'CRITICO' : 'BAIXO';
      return { ...u, minPercent, severity };
    })
    .sort((a, b) => a.minPercent - b.minPercent);
}

// ------------------------------------------------- Consumo por categoria

export interface CategoryConsumption {
  category: string;
  module: string;
  consumed: number;
}

export async function getConsumptionByCategory(
  user: AuthUser,
  modules: ModuleType[],
  options: AnalyticsOptions = {},
): Promise<CategoryConsumption[]> {
  const days = options.days ?? 30;
  const rows = await prisma.$queryRaw<
    Array<{ category: string; module: string; consumed: number }>
  >(
    Prisma.sql`
      SELECT c."name" AS category,
             i."module"::text AS module,
             SUM(smi."quantity")::float8 AS consumed
      FROM "StockMovementItem" smi
      JOIN "StockMovement" m ON m."id" = smi."movementId"
      JOIN "Item" i          ON i."id" = smi."itemId"
      JOIN "Category" c      ON c."id" = i."categoryId"
      WHERE ${schoolSql(user)}
        AND ${modulesSql(modules, 'm')}
        AND m."direction" = 'OUT'
        AND m."createdAt" >= NOW() - (${days} || ' days')::interval
      GROUP BY 1, 2
      ORDER BY 3 DESC
    `,
  );
  return rows.map((r) => ({ ...r, consumed: Number(r.consumed) }));
}
