// Enums de domínio (independentes do Prisma) usados pela lógica de negócio e testes.

export const ModuleType = {
  FOOD: 'FOOD',
  SCHOOL_MATERIAL: 'SCHOOL_MATERIAL',
} as const;
export type ModuleType = (typeof ModuleType)[keyof typeof ModuleType];

export const MovementType = {
  ENTRADA: 'ENTRADA',
  SAIDA: 'SAIDA',
  CONSUMO: 'CONSUMO',
  PREPARO_MERENDA: 'PREPARO_MERENDA',
  DISTRIBUICAO: 'DISTRIBUICAO',
  DEVOLUCAO: 'DEVOLUCAO',
  PERDA: 'PERDA',
  AVARIA: 'AVARIA',
  PRODUTO_VENCIDO: 'PRODUTO_VENCIDO',
  TRANSFERENCIA_INTERNA: 'TRANSFERENCIA_INTERNA',
  AJUSTE: 'AJUSTE',
} as const;
export type MovementType = (typeof MovementType)[keyof typeof MovementType];

export const MovementDirection = {
  IN: 'IN',
  OUT: 'OUT',
} as const;
export type MovementDirection = (typeof MovementDirection)[keyof typeof MovementDirection];

export const ReviewStatus = {
  NAO_APLICAVEL: 'NAO_APLICAVEL',
  PENDENTE_REVISAO: 'PENDENTE_REVISAO',
  REVISADO: 'REVISADO',
} as const;
export type ReviewStatus = (typeof ReviewStatus)[keyof typeof ReviewStatus];

/**
 * Grupo canônico das categorias. O nome da categoria continua livre por escola;
 * o grupo é o que o sistema usa para separar alimentos (estivas, proteínas,
 * hortaliças, bebidas, frutas) e materiais (escritório, limpeza, informática...).
 */
export const CategoryGroup = {
  ESTIVAS: 'ESTIVAS',
  PROTEINAS: 'PROTEINAS',
  HORTALICAS: 'HORTALICAS',
  FRUTAS: 'FRUTAS',
  BEBIDAS: 'BEBIDAS',
  MATERIAL_ESCRITORIO: 'MATERIAL_ESCRITORIO',
  MATERIAL_ESCOLAR: 'MATERIAL_ESCOLAR',
  LIMPEZA: 'LIMPEZA',
  INFORMATICA: 'INFORMATICA',
  ARTES: 'ARTES',
  MATERIAL_PEDAGOGICO: 'MATERIAL_PEDAGOGICO',
  OUTROS: 'OUTROS',
} as const;
export type CategoryGroup = (typeof CategoryGroup)[keyof typeof CategoryGroup];

export const PurchasePriority = {
  BAIXA: 'BAIXA',
  MEDIA: 'MEDIA',
  ALTA: 'ALTA',
} as const;
export type PurchasePriority = (typeof PurchasePriority)[keyof typeof PurchasePriority];

export const PurchaseRequestStatus = {
  PENDENTE: 'PENDENTE',
  APROVADA: 'APROVADA',
  REJEITADA: 'REJEITADA',
  COMPRADA: 'COMPRADA',
  RECEBIDA: 'RECEBIDA',
  CANCELADA: 'CANCELADA',
} as const;
export type PurchaseRequestStatus =
  (typeof PurchaseRequestStatus)[keyof typeof PurchaseRequestStatus];

export const PurchaseListStatus = {
  ABERTA: 'ABERTA',
  ENVIADA: 'ENVIADA',
  CONCLUIDA: 'CONCLUIDA',
  CANCELADA: 'CANCELADA',
} as const;
export type PurchaseListStatus = (typeof PurchaseListStatus)[keyof typeof PurchaseListStatus];

export const PurchaseItemSource = {
  SUGESTAO: 'SUGESTAO',
  SOLICITACAO: 'SOLICITACAO',
  MANUAL: 'MANUAL',
} as const;
export type PurchaseItemSource = (typeof PurchaseItemSource)[keyof typeof PurchaseItemSource];

/** Saúde do estoque exibida no painel: 🔴 crítico, 🟡 atenção, 🟢 adequado. */
export const StockHealth = {
  CRITICO: 'CRITICO',
  ATENCAO: 'ATENCAO',
  ADEQUADO: 'ADEQUADO',
} as const;
export type StockHealth = (typeof StockHealth)[keyof typeof StockHealth];

export const ExpiryStatus = {
  OK: 'OK',
  NEAR_EXPIRY: 'NEAR_EXPIRY',
  EXPIRED: 'EXPIRED',
} as const;
export type ExpiryStatus = (typeof ExpiryStatus)[keyof typeof ExpiryStatus];

/**
 * Perfis padrão do sistema (RBAC).
 * ADMINISTRADOR = global (Secretaria Municipal); ADMIN_ESCOLA = administrador do
 * tenant, restrito à própria escola.
 */
export const RoleName = {
  ADMINISTRADOR: 'ADMINISTRADOR',
  ADMIN_ESCOLA: 'ADMIN_ESCOLA',
  GESTOR_ESCOLAR: 'GESTOR_ESCOLAR',
  SECRETARIO: 'SECRETARIO',
  COORDENADOR: 'COORDENADOR',
  MERENDEIRA: 'MERENDEIRA',
  ASSISTENTE_ALUNO: 'ASSISTENTE_ALUNO',
} as const;
export type RoleName = (typeof RoleName)[keyof typeof RoleName];
