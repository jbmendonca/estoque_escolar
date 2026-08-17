// Formatação numérica em português: vírgula decimal e sem casas inúteis.

/**
 * Casas decimais significativas para quantidades de estoque (grama/mililitro).
 * Além do necessário para merenda escolar, e o bastante para neutralizar o
 * resíduo de ponto flutuante (ex.: 0,1 + 0,2 = 0,30000000000000004).
 */
export const QUANTITY_SCALE = 6;

/**
 * Arredonda uma quantidade à escala de estoque, eliminando o resíduo de
 * representação binária que, acumulado, criava "lotes-fantasma" (saldos como
 * 4,4e-17 que nunca zeravam). Determinística e pura.
 */
export function roundQuantity(value: number): number {
  if (!Number.isFinite(value)) return value;
  const factor = 10 ** QUANTITY_SCALE;
  return Math.round((value + Number.EPSILON * Math.sign(value)) * factor) / factor;
}

/** Formata uma quantidade (até 2 casas, sem zeros à direita): 8 → "8"; 2.5 → "2,5". */
export function formatQuantity(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value);
}

/** Formata uma quantidade junto da unidade: "10 cx". */
export function formatQuantityWithUnit(value: number, unit?: string | null): string {
  return unit ? `${formatQuantity(value)} ${unit}` : formatQuantity(value);
}

/** Plural simples de dias/meses usado nas mensagens de sugestão. */
export function pluralize(count: number, singular: string, plural: string): string {
  return `${formatQuantity(count)} ${count === 1 ? singular : plural}`;
}
