// Classificação de validade de lotes (alertas de vencimento).
import { ExpiryStatus } from '@/modules/shared/enums';

/** Dias inteiros entre duas datas (b - a), truncando horas. */
export function daysBetween(a: Date, b: Date): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const startOfDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.round((startOfDay(b) - startOfDay(a)) / MS_PER_DAY);
}

/**
 * Classifica um lote conforme a validade em relação a `now`:
 * - EXPIRED: já vencido (validade < hoje)
 * - NEAR_EXPIRY: vence dentro de `nearExpiryDays` dias (inclusive hoje)
 * - OK: caso contrário
 */
export function classifyExpiry(
  expiryDate: Date,
  nearExpiryDays: number,
  now: Date = new Date(),
): ExpiryStatus {
  const days = daysBetween(now, expiryDate);
  if (days < 0) return ExpiryStatus.EXPIRED;
  if (days <= nearExpiryDays) return ExpiryStatus.NEAR_EXPIRY;
  return ExpiryStatus.OK;
}

export function isExpired(expiryDate: Date, now: Date = new Date()): boolean {
  return classifyExpiry(expiryDate, 0, now) === ExpiryStatus.EXPIRED;
}
