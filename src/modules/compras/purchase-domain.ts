// REGRA DE NEGÓCIO DA SUGESTÃO DE COMPRA — funções puras, sem banco.
// Combina estoque atual + estoque mínimo + consumo médio + o que já foi solicitado
// para calcular quanto comprar, com que urgência e em quantos dias o item acaba.
import { formatQuantity } from '@/lib/number';
import { PurchasePriority, StockHealth } from '@/modules/shared/enums';
import type { CategoryGroup } from '@/modules/shared/enums';
import {
  PRIORITY_ORDER,
  PURCHASE_DEFAULTS,
  type PurchaseParams,
} from '@/modules/compras/constants';

/** Item analisado: números crus vindos do estoque e do histórico de consumo. */
export interface PurchaseCandidate {
  itemId: string;
  code: string;
  name: string;
  unit: string;
  module: string;
  categoryName: string;
  categoryGroup: CategoryGroup | null;
  /** Saldo atual em estoque. */
  balance: number;
  minStock: number;
  /** Total consumido (saídas) na janela analisada. */
  consumed: number;
  /** Consumo médio por dia na janela analisada. */
  dailyAvg: number;
  /** Quantidade já solicitada/em lista aberta e ainda não recebida. */
  pendingQty: number;
}

export interface PurchaseSuggestion extends PurchaseCandidate {
  /** Dias de estoque restantes no ritmo atual (null = sem consumo no período). */
  coverageDays: number | null;
  /** Quantidade sugerida de compra (0 = não precisa comprar). */
  suggestedQty: number;
  priority: PurchasePriority;
  health: StockHealth;
  belowMin: boolean;
  /** Frases prontas explicando a sugestão ao usuário. */
  messages: string[];
}

export interface SuggestionOptions {
  /** Janela de histórico usada para o consumo médio (para as mensagens). */
  days?: number;
  params?: Partial<PurchaseParams>;
}

function resolveParams(overrides?: Partial<PurchaseParams>): PurchaseParams {
  return { ...PURCHASE_DEFAULTS, ...overrides };
}

/** Dias de cobertura restantes com o saldo atual. Sem consumo → indefinido. */
export function computeCoverageDays(balance: number, dailyAvg: number): number | null {
  if (dailyAvg <= 0) return null;
  return Math.max(0, balance) / dailyAvg;
}

/**
 * Quantidade a comprar: o alvo é cobrir o maior valor entre o estoque mínimo e
 * o consumo previsto para o período, descontando o que já existe e o que já foi
 * solicitado. Arredonda para cima (não se compra "meia caixa").
 */
export function computeSuggestedQty(
  candidate: Pick<PurchaseCandidate, 'balance' | 'minStock' | 'dailyAvg' | 'pendingQty'>,
  options: SuggestionOptions = {},
): number {
  const params = resolveParams(options.params);
  const forecastNeed = candidate.dailyAvg * params.coverageTargetDays;
  const target = Math.max(candidate.minStock, forecastNeed);
  const missing = target - candidate.balance - Math.max(0, candidate.pendingQty);
  if (missing <= 0) return 0;
  return Math.ceil(missing);
}

/** Urgência da compra: zerado ou prestes a acabar é alta prioridade. */
export function computePriority(
  candidate: Pick<PurchaseCandidate, 'balance' | 'minStock'> & { coverageDays: number | null },
  options: SuggestionOptions = {},
): PurchasePriority {
  const params = resolveParams(options.params);
  const { balance, minStock, coverageDays } = candidate;

  if (balance <= 0) return PurchasePriority.ALTA;
  if (coverageDays !== null && coverageDays <= params.leadTimeDays) return PurchasePriority.ALTA;
  if (minStock > 0 && balance <= minStock * 0.5) return PurchasePriority.ALTA;

  if (minStock > 0 && balance < minStock) return PurchasePriority.MEDIA;
  if (coverageDays !== null && coverageDays <= params.warningDays) return PurchasePriority.MEDIA;

  return PurchasePriority.BAIXA;
}

/** Semáforo do painel: 🔴 crítico, 🟡 próximo do mínimo, 🟢 adequado. */
export function classifyHealth(
  candidate: Pick<PurchaseCandidate, 'balance' | 'minStock'> & { coverageDays: number | null },
  options: SuggestionOptions = {},
): StockHealth {
  const params = resolveParams(options.params);
  const { balance, minStock, coverageDays } = candidate;

  if (balance <= 0) return StockHealth.CRITICO;
  if (minStock > 0 && balance < minStock) return StockHealth.CRITICO;
  if (coverageDays !== null && coverageDays <= params.leadTimeDays) return StockHealth.CRITICO;

  // "Próximo do mínimo": até 20% acima do mínimo, ou cobertura curta.
  if (minStock > 0 && balance <= minStock * 1.2) return StockHealth.ATENCAO;
  if (coverageDays !== null && coverageDays <= params.warningDays) return StockHealth.ATENCAO;

  return StockHealth.ADEQUADO;
}

/** Descreve a janela analisada: 90 → "3 meses"; 15 → "15 dias". */
export function formatPeriod(days: number): string {
  if (days >= 60 && days % 30 === 0) {
    return `${days / 30} meses`;
  }
  return `${days} dias`;
}

/**
 * Frases da sugestão automática, na ordem em que fazem sentido para quem lê:
 * o que está acontecendo, quanto se consumiu, quanto comprar e por quanto tempo dura.
 */
export function buildSuggestionMessages(
  suggestion: Omit<PurchaseSuggestion, 'messages'>,
  options: SuggestionOptions = {},
): string[] {
  const params = resolveParams(options.params);
  const days = options.days ?? params.analysisDays;
  const qty = (value: number) => `${formatQuantity(value)} ${suggestion.unit}`;
  const messages: string[] = [];

  if (suggestion.balance <= 0) {
    messages.push(`${suggestion.name} está sem estoque.`);
  } else if (suggestion.priority === PurchasePriority.ALTA) {
    messages.push(`${suggestion.name} está acabando.`);
  } else if (suggestion.belowMin) {
    messages.push(`${suggestion.name} está abaixo do estoque mínimo.`);
  }

  if (suggestion.consumed > 0) {
    messages.push(
      `Foram consumidas ${qty(suggestion.consumed)} de ${suggestion.name} nos últimos ${formatPeriod(days)}.`,
    );
  } else {
    messages.push(
      `Nenhuma saída de ${suggestion.name} registrada nos últimos ${formatPeriod(days)}.`,
    );
  }

  if (suggestion.suggestedQty > 0) {
    messages.push(
      `Recomenda-se comprar ${qty(suggestion.suggestedQty)} para os próximos ${params.coverageTargetDays} dias.`,
    );
  }

  if (suggestion.pendingQty > 0) {
    messages.push(`Já existem ${qty(suggestion.pendingQty)} solicitadas e ainda não recebidas.`);
  }

  if (suggestion.coverageDays === null) {
    messages.push('Sem consumo no período — não é possível prever a duração do estoque.');
  } else if (suggestion.coverageDays <= 0) {
    messages.push('Estoque zerado: reposição imediata.');
  } else {
    messages.push(
      `Estoque suficiente para aproximadamente ${Math.floor(suggestion.coverageDays)} dias.`,
    );
  }

  return messages;
}

/** Monta a sugestão completa de um item. */
export function buildSuggestion(
  candidate: PurchaseCandidate,
  options: SuggestionOptions = {},
): PurchaseSuggestion {
  const coverageDays = computeCoverageDays(candidate.balance, candidate.dailyAvg);
  const base = {
    ...candidate,
    coverageDays,
    suggestedQty: computeSuggestedQty(candidate, options),
    priority: computePriority({ ...candidate, coverageDays }, options),
    health: classifyHealth({ ...candidate, coverageDays }, options),
    belowMin: candidate.minStock > 0 && candidate.balance < candidate.minStock,
  };
  return { ...base, messages: buildSuggestionMessages(base, options) };
}

/**
 * Lista de compras inteligente: sugestões dos itens que precisam de reposição,
 * do mais urgente para o menos urgente.
 */
export function buildSuggestions(
  candidates: PurchaseCandidate[],
  options: SuggestionOptions = {},
): PurchaseSuggestion[] {
  return candidates
    .map((c) => buildSuggestion(c, options))
    .filter((s) => s.suggestedQty > 0 || s.belowMin || s.balance <= 0)
    .sort(comparePriority);
}

/**
 * Ordena por prioridade e, dentro dela, por quem acaba primeiro.
 * Item sem saldo vem sempre na frente: já acabou, não há o que prever.
 */
export function comparePriority(a: PurchaseSuggestion, b: PurchaseSuggestion): number {
  const byPriority = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
  if (byPriority !== 0) return byPriority;

  const coverageA = effectiveCoverage(a);
  const coverageB = effectiveCoverage(b);
  if (coverageA !== coverageB) return coverageA - coverageB;

  return a.name.localeCompare(b.name, 'pt-BR');
}

function effectiveCoverage(suggestion: PurchaseSuggestion): number {
  if (suggestion.balance <= 0) return 0;
  return suggestion.coverageDays ?? Number.POSITIVE_INFINITY;
}
