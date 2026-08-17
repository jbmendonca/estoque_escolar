// Rótulos e parâmetros do módulo Compras e Sugestões.
// Todo texto visível ao usuário fica aqui para manter a interface consistente.
import {
  CategoryGroup,
  ModuleType,
  PurchaseItemSource,
  PurchaseListStatus,
  PurchasePriority,
  PurchaseRequestStatus,
  StockHealth,
} from '@/modules/shared/enums';

export const CATEGORY_GROUP_LABEL: Record<CategoryGroup, string> = {
  ESTIVAS: 'Estivas',
  PROTEINAS: 'Proteínas',
  HORTALICAS: 'Hortaliças',
  FRUTAS: 'Frutas',
  BEBIDAS: 'Bebidas',
  MATERIAL_ESCRITORIO: 'Material de escritório',
  MATERIAL_ESCOLAR: 'Material escolar',
  LIMPEZA: 'Limpeza',
  INFORMATICA: 'Informática',
  ARTES: 'Artes',
  MATERIAL_PEDAGOGICO: 'Material pedagógico',
  OUTROS: 'Outros',
};

/** Grupos de alimentos, na ordem em que aparecem nas telas de merenda. */
export const FOOD_GROUPS: CategoryGroup[] = [
  CategoryGroup.ESTIVAS,
  CategoryGroup.PROTEINAS,
  CategoryGroup.HORTALICAS,
  CategoryGroup.BEBIDAS,
  CategoryGroup.FRUTAS,
];

/** Grupos de materiais escolares, na ordem em que aparecem nas telas. */
export const MATERIAL_GROUPS: CategoryGroup[] = [
  CategoryGroup.MATERIAL_ESCRITORIO,
  CategoryGroup.MATERIAL_ESCOLAR,
  CategoryGroup.LIMPEZA,
  CategoryGroup.INFORMATICA,
  CategoryGroup.ARTES,
  CategoryGroup.MATERIAL_PEDAGOGICO,
  CategoryGroup.OUTROS,
];

export function groupsForModule(module: ModuleType): CategoryGroup[] {
  return module === ModuleType.FOOD ? FOOD_GROUPS : MATERIAL_GROUPS;
}

export function categoryGroupLabel(group: string | null | undefined): string {
  if (!group) return 'Sem grupo';
  return CATEGORY_GROUP_LABEL[group as CategoryGroup] ?? group;
}

export const PRIORITY_LABEL: Record<PurchasePriority, string> = {
  ALTA: 'Alta',
  MEDIA: 'Média',
  BAIXA: 'Baixa',
};

/** Ordem de exibição: o mais urgente primeiro. */
export const PRIORITY_ORDER: Record<PurchasePriority, number> = {
  ALTA: 0,
  MEDIA: 1,
  BAIXA: 2,
};

export const REQUEST_STATUS_LABEL: Record<PurchaseRequestStatus, string> = {
  PENDENTE: 'Pendente',
  APROVADA: 'Aprovada',
  REJEITADA: 'Rejeitada',
  COMPRADA: 'Comprada',
  RECEBIDA: 'Recebida',
  CANCELADA: 'Cancelada',
};

export const LIST_STATUS_LABEL: Record<PurchaseListStatus, string> = {
  ABERTA: 'Aberta',
  ENVIADA: 'Enviada',
  CONCLUIDA: 'Concluída',
  CANCELADA: 'Cancelada',
};

export const SOURCE_LABEL: Record<PurchaseItemSource, string> = {
  SUGESTAO: 'Sugestão do sistema',
  SOLICITACAO: 'Solicitação de aquisição',
  MANUAL: 'Inclusão manual',
};

export const HEALTH_LABEL: Record<StockHealth, string> = {
  CRITICO: 'Crítico',
  ATENCAO: 'Próximo do mínimo',
  ADEQUADO: 'Adequado',
};

export const HEALTH_ICON: Record<StockHealth, string> = {
  CRITICO: '🔴',
  ATENCAO: '🟡',
  ADEQUADO: '🟢',
};

/**
 * Parâmetros padrão do cálculo de sugestão. Podem ser sobrescritos por escola
 * (AppConfig) sem alterar a regra de negócio.
 */
export const PURCHASE_DEFAULTS = {
  /** Janela de histórico analisada para calcular o consumo médio. */
  analysisDays: 90,
  /** Para quantos dias de consumo a compra deve durar. */
  coverageTargetDays: 30,
  /** Prazo estimado entre solicitar e receber; abaixo disso a compra é urgente. */
  leadTimeDays: 7,
  /** Cobertura a partir da qual o item entra em atenção. */
  warningDays: 20,
} as const;

export type PurchaseParams = typeof PURCHASE_DEFAULTS;
