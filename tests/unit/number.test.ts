import { describe, it, expect } from 'vitest';
import { roundQuantity } from '@/lib/number';

describe('roundQuantity — elimina resíduo de ponto flutuante', () => {
  it('0,1 + 0,2 - 0,3 resulta exatamente em 0 (sem lote-fantasma)', () => {
    const residuo = 0.1 + 0.2 - 0.3; // ~4.4e-17 em float
    expect(residuo).not.toBe(0);
    expect(roundQuantity(residuo)).toBe(0);
  });

  it('preserva quantidades legítimas dentro da escala', () => {
    expect(roundQuantity(12.5)).toBe(12.5);
    expect(roundQuantity(0.125)).toBe(0.125);
    expect(roundQuantity(1000)).toBe(1000);
  });

  it('arredonda além da escala de 6 casas', () => {
    expect(roundQuantity(1.0000004)).toBe(1);
    expect(roundQuantity(2.9999999)).toBe(3);
  });

  it('mantém valores não finitos inalterados', () => {
    expect(roundQuantity(Number.NaN)).toBeNaN();
    expect(roundQuantity(Number.POSITIVE_INFINITY)).toBe(Number.POSITIVE_INFINITY);
  });
});
