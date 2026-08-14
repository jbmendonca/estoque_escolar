// Constantes de movimentação para validação (Zod) — reexporta enums de domínio.
export { ModuleType, MovementType } from '@/modules/shared/enums';

/** Valores de destino de distribuição como tupla (para z.enum). */
export const DistributionTargetValues = [
  'ALUNO',
  'TURMA',
  'PROFESSOR',
  'SETOR',
  'ATIVIDADE',
  'OUTRO',
] as const;
export type DistributionTargetValue = (typeof DistributionTargetValues)[number];
