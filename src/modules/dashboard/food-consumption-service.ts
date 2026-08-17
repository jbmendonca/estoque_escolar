// Quantidade de alimentos utilizada diariamente, separada pelos grupos
// canônicos (estivas, proteínas, hortaliças, bebidas, frutas).
// Perdas/avarias/vencidos NÃO entram no "utilizado" — são somadas à parte.
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { isAdmin, type AuthUser } from '@/server/rbac';

const WASTE_TYPES = ['PERDA', 'AVARIA', 'PRODUTO_VENCIDO'];

function schoolSql(user: AuthUser): Prisma.Sql {
  if (isAdmin(user)) return Prisma.sql`TRUE`;
  if (user.schoolIds.length === 0) return Prisma.sql`FALSE`;
  return Prisma.sql`m."schoolId" IN (${Prisma.join(user.schoolIds)})`;
}

export interface DailyFoodPoint {
  /** Dia no formato YYYY-MM-DD. */
  day: string;
  total: number;
  /** Total por grupo de categoria naquele dia. */
  byGroup: Record<string, number>;
}

export interface FoodGroupUsage {
  group: string | null;
  total: number;
  /** Média por dia na janela analisada. */
  dailyAvg: number;
  /** Participação no total consumido (0..1). */
  share: number;
  items: number;
}

export interface FoodItemUsage {
  itemId: string;
  code: string;
  name: string;
  unit: string;
  group: string | null;
  categoryName: string;
  total: number;
  /** Média diária considerando toda a janela. */
  dailyAvg: number;
  /** Dias em que houve efetivamente saída deste alimento. */
  daysWithUse: number;
  /** Média nos dias em que o alimento foi usado. */
  avgPerUseDay: number;
  balance: number;
}

export interface DailyFoodConsumption {
  days: number;
  total: number;
  /** Média diária geral (total ÷ dias da janela). */
  dailyAvg: number;
  wasteTotal: number;
  byDay: DailyFoodPoint[];
  byGroup: FoodGroupUsage[];
  byItem: FoodItemUsage[];
}

/**
 * Consumo diário de alimentos na janela informada.
 * Duas consultas agregadas: uma por dia/grupo (série) e outra por item.
 */
export async function getDailyFoodConsumption(
  user: AuthUser,
  options: { days?: number } = {},
): Promise<DailyFoodConsumption> {
  const days = options.days ?? 30;
  const wasteList = Prisma.join(WASTE_TYPES);

  const [dayRows, itemRows] = await Promise.all([
    prisma.$queryRaw<Array<{ day: Date; group: string | null; total: number; waste: number }>>(
      Prisma.sql`
        SELECT date_trunc('day', m."createdAt")                    AS day,
               c."group"::text                                     AS "group",
               COALESCE(SUM(smi."quantity") FILTER (WHERE m."type"::text NOT IN (${wasteList})), 0)::float8 AS total,
               COALESCE(SUM(smi."quantity") FILTER (WHERE m."type"::text IN (${wasteList})), 0)::float8     AS waste
        FROM "StockMovementItem" smi
        JOIN "StockMovement" m ON m."id" = smi."movementId"
        JOIN "Item" i          ON i."id" = smi."itemId"
        JOIN "Category" c      ON c."id" = i."categoryId"
        WHERE ${schoolSql(user)}
          AND i."module" = 'FOOD'
          AND m."direction" = 'OUT'
          AND m."createdAt" >= NOW() - (${days} || ' days')::interval
        GROUP BY 1, 2
        ORDER BY 1
      `,
    ),
    prisma.$queryRaw<
      Array<{
        itemId: string;
        code: string;
        name: string;
        unit: string;
        group: string | null;
        categoryName: string;
        total: number;
        daysWithUse: number;
        balance: number;
      }>
    >(
      Prisma.sql`
        SELECT i."id"           AS "itemId",
               i."code"         AS code,
               i."name"         AS name,
               u."abbreviation" AS unit,
               c."group"::text  AS "group",
               c."name"         AS "categoryName",
               SUM(smi."quantity")::float8                              AS total,
               COUNT(DISTINCT date_trunc('day', m."createdAt"))          AS "daysWithUse",
               COALESCE(MAX(s."quantity"), 0)::float8                    AS balance
        FROM "StockMovementItem" smi
        JOIN "StockMovement" m   ON m."id" = smi."movementId"
        JOIN "Item" i            ON i."id" = smi."itemId"
        JOIN "Category" c        ON c."id" = i."categoryId"
        JOIN "UnitOfMeasure" u   ON u."id" = i."unitOfMeasureId"
        LEFT JOIN "Stock" s      ON s."itemId" = i."id"
        WHERE ${schoolSql(user)}
          AND i."module" = 'FOOD'
          AND m."direction" = 'OUT'
          AND m."type"::text NOT IN (${wasteList})
          AND m."createdAt" >= NOW() - (${days} || ' days')::interval
        GROUP BY i."id", i."code", i."name", u."abbreviation", c."group", c."name"
        ORDER BY 7 DESC
      `,
    ),
  ]);

  const byDayMap = new Map<string, DailyFoodPoint>();
  let total = 0;
  let wasteTotal = 0;

  for (const row of dayRows) {
    const key = new Date(row.day).toISOString().slice(0, 10);
    const point = byDayMap.get(key) ?? { day: key, total: 0, byGroup: {} };
    const value = Number(row.total);
    const groupKey = row.group ?? 'SEM_GRUPO';
    point.total += value;
    point.byGroup[groupKey] = (point.byGroup[groupKey] ?? 0) + value;
    byDayMap.set(key, point);
    total += value;
    wasteTotal += Number(row.waste);
  }

  const groupTotals = new Map<string | null, { total: number; items: number }>();
  for (const row of itemRows) {
    const entry = groupTotals.get(row.group) ?? { total: 0, items: 0 };
    entry.total += Number(row.total);
    entry.items += 1;
    groupTotals.set(row.group, entry);
  }

  const byGroup: FoodGroupUsage[] = [...groupTotals.entries()]
    .map(([group, value]) => ({
      group,
      total: value.total,
      dailyAvg: value.total / days,
      share: total > 0 ? value.total / total : 0,
      items: value.items,
    }))
    .sort((a, b) => b.total - a.total);

  const byItem: FoodItemUsage[] = itemRows.map((row) => {
    const itemTotal = Number(row.total);
    const daysWithUse = Number(row.daysWithUse);
    return {
      itemId: row.itemId,
      code: row.code,
      name: row.name,
      unit: row.unit,
      group: row.group,
      categoryName: row.categoryName,
      total: itemTotal,
      dailyAvg: itemTotal / days,
      daysWithUse,
      avgPerUseDay: daysWithUse > 0 ? itemTotal / daysWithUse : 0,
      balance: Number(row.balance),
    };
  });

  return {
    days,
    total,
    dailyAvg: total / days,
    wasteTotal,
    byDay: [...byDayMap.values()].sort((a, b) => a.day.localeCompare(b.day)),
    byGroup,
    byItem,
  };
}
