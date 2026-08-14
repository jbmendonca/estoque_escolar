import { describe, it, expect } from 'vitest';
import { classifyExpiry, daysBetween, isExpired } from '@/modules/lotes/expiry';
import { ExpiryStatus } from '@/modules/shared/enums';

const now = new Date('2026-08-14T12:00:00Z');

describe('Alertas de validade', () => {
  it('daysBetween ignora horas', () => {
    expect(daysBetween(new Date('2026-08-14T23:00:00Z'), new Date('2026-08-19T01:00:00Z'))).toBe(5);
  });

  it('classifica como VENCIDO quando a validade já passou', () => {
    expect(classifyExpiry(new Date('2026-08-10'), 7, now)).toBe(ExpiryStatus.EXPIRED);
  });

  it('classifica como PRÓXIMO DO VENCIMENTO dentro da janela configurada', () => {
    expect(classifyExpiry(new Date('2026-08-19'), 7, now)).toBe(ExpiryStatus.NEAR_EXPIRY);
    expect(classifyExpiry(new Date('2026-08-14'), 7, now)).toBe(ExpiryStatus.NEAR_EXPIRY);
  });

  it('classifica como OK fora da janela', () => {
    expect(classifyExpiry(new Date('2026-09-30'), 7, now)).toBe(ExpiryStatus.OK);
  });

  it('a janela é configurável (nearExpiryDays)', () => {
    expect(classifyExpiry(new Date('2026-09-10'), 7, now)).toBe(ExpiryStatus.OK);
    expect(classifyExpiry(new Date('2026-09-10'), 30, now)).toBe(ExpiryStatus.NEAR_EXPIRY);
  });

  it('isExpired', () => {
    expect(isExpired(new Date('2026-08-13'), now)).toBe(true);
    expect(isExpired(new Date('2026-08-20'), now)).toBe(false);
  });
});
