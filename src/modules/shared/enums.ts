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
