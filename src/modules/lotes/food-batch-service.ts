// Consultas de lotes de alimento e alertas de validade.
// A criação/baixa de lote acontece SOMENTE via serviço de movimentação.
import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/errors';
import { classifyExpiry } from '@/modules/lotes/expiry';
import { orderByFefo } from '@/modules/lotes/fefo';
import { ExpiryStatus } from '@/modules/shared/enums';
import type { AuthUser } from '@/server/rbac';
import { canAccessSchool, schoolScopeFilter } from '@/server/rbac';

export const DEFAULT_NEAR_EXPIRY_DAYS = Number(process.env.NEAR_EXPIRY_DAYS_DEFAULT ?? 30);

/** Dias configurados como "próximo do vencimento" para a escola. */
export async function getNearExpiryDays(schoolId: string): Promise<number> {
  const config = await prisma.appConfig.findUnique({
    where: { schoolId_key: { schoolId, key: 'nearExpiryDays' } },
  });
  const parsed = Number(config?.value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_NEAR_EXPIRY_DAYS;
}

export async function setNearExpiryDays(schoolId: string, days: number, userId: string) {
  return prisma.appConfig.upsert({
    where: { schoolId_key: { schoolId, key: 'nearExpiryDays' } },
    create: { schoolId, key: 'nearExpiryDays', value: String(days), updatedById: userId },
    update: { value: String(days), updatedById: userId },
  });
}

function scopeFor(user: AuthUser, schoolId?: string) {
  if (schoolId) {
    // Valida posse antes de confiar no schoolId recebido (defesa contra IDOR).
    if (!canAccessSchool(user, schoolId)) {
      throw new AppError('FORBIDDEN', 'Você não tem acesso à escola informada.');
    }
    return { schoolId };
  }
  return schoolScopeFilter(user);
}

/** Lotes com saldo, ordenados por validade (FEFO). */
export async function listBatches(
  user: AuthUser,
  params: { itemId?: string; schoolId?: string } = {},
) {
  const batches = await prisma.foodBatch.findMany({
    where: {
      ...scopeFor(user, params.schoolId),
      ...(params.itemId ? { itemId: params.itemId } : {}),
      active: true,
    },
    orderBy: { expiryDate: 'asc' },
    include: { item: { select: { code: true, name: true } } },
  });

  return orderByFefo(
    batches.map((b) => ({
      id: b.id,
      expiryDate: b.expiryDate,
      quantity: Number(b.quantity),
      batchNumber: b.batchNumber,
      itemId: b.itemId,
      itemCode: b.item.code,
      itemName: b.item.name,
    })),
  );
}

/** Alertas de validade: lotes vencidos e próximos do vencimento. */
export async function getExpiryAlerts(user: AuthUser, schoolId?: string) {
  const targetSchool = schoolId ?? user.schoolIds[0];
  const nearExpiryDays = targetSchool
    ? await getNearExpiryDays(targetSchool)
    : DEFAULT_NEAR_EXPIRY_DAYS;

  const batches = await listBatches(user, { schoolId });
  const withStock = batches.filter((b) => b.quantity > 0);

  const expired = withStock.filter(
    (b) => classifyExpiry(b.expiryDate, nearExpiryDays) === ExpiryStatus.EXPIRED,
  );
  const nearExpiry = withStock.filter(
    (b) => classifyExpiry(b.expiryDate, nearExpiryDays) === ExpiryStatus.NEAR_EXPIRY,
  );

  return { nearExpiryDays, expired, nearExpiry };
}
