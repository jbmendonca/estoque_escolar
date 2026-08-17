// Indicadores do dashboard via consultas agregadas, sempre restritas ao escopo de escola.
import { prisma } from '@/lib/prisma';
import { classifyExpiry } from '@/modules/lotes/expiry';
import { ExpiryStatus, ModuleType } from '@/modules/shared/enums';
import type { AuthUser } from '@/server/rbac';
import { schoolScopeFilter } from '@/server/rbac';

export interface DashboardData {
  itemsCount: { food: number; material: number };
  lowStock: number;
  outOfStock: number;
  nearExpiry: number;
  expired: number;
  movementsInPeriod: number;
  recentMovements: Array<{
    number: string;
    type: string;
    itemName: string;
    quantity: number;
    createdAt: Date;
  }>;
}

export async function getDashboard(
  user: AuthUser,
  options: { nearExpiryDays?: number; days?: number } = {},
): Promise<DashboardData> {
  const nearExpiryDays = options.nearExpiryDays ?? 30;
  const days = options.days ?? 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Isolamento multi-escola: admin vê tudo, demais apenas suas escolas.
  const schoolFilter = schoolScopeFilter(user);

  const [food, material, stocks, batches, movementsInPeriod, recent] = await Promise.all([
    prisma.item.count({ where: { ...schoolFilter, module: ModuleType.FOOD, active: true } }),
    prisma.item.count({
      where: { ...schoolFilter, module: ModuleType.SCHOOL_MATERIAL, active: true },
    }),
    prisma.stock.findMany({
      where: schoolFilter,
      select: { quantity: true, item: { select: { minStock: true, active: true } } },
    }),
    prisma.foodBatch.findMany({
      where: { ...schoolFilter, active: true, quantity: { gt: 0 } },
      select: { expiryDate: true },
    }),
    prisma.stockMovement.count({ where: { ...schoolFilter, createdAt: { gte: since } } }),
    prisma.stockMovement.findMany({
      where: schoolFilter,
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        number: true,
        type: true,
        createdAt: true,
        items: { select: { quantity: true, item: { select: { name: true } } }, take: 1 },
      },
    }),
  ]);

  const activeStocks = stocks.filter((s) => s.item.active);
  const outOfStock = activeStocks.filter((s) => Number(s.quantity) <= 0).length;
  const lowStock = activeStocks.filter((s) => {
    const qty = Number(s.quantity);
    const min = Number(s.item.minStock);
    return qty > 0 && min > 0 && qty < min;
  }).length;

  let nearExpiry = 0;
  let expired = 0;
  for (const b of batches) {
    const status = classifyExpiry(b.expiryDate, nearExpiryDays);
    if (status === ExpiryStatus.EXPIRED) expired += 1;
    else if (status === ExpiryStatus.NEAR_EXPIRY) nearExpiry += 1;
  }

  return {
    itemsCount: { food, material },
    lowStock,
    outOfStock,
    nearExpiry,
    expired,
    movementsInPeriod,
    recentMovements: recent.map((m) => ({
      number: m.number,
      type: m.type,
      itemName: m.items[0]?.item.name ?? '—',
      quantity: Number(m.items[0]?.quantity ?? 0),
      createdAt: m.createdAt,
    })),
  };
}
