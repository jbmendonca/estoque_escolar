// Máquina de estados da solicitação de aquisição — função pura, sem banco.
// Fluxo: pendente → aprovada → comprada → recebida.
// Rejeição e cancelamento são saídas terminais. Nenhum atalho é permitido.
import { AppError } from '@/lib/errors';
import { PurchaseRequestStatus, type ModuleType } from '@/modules/shared/enums';
import { REQUEST_STATUS_LABEL } from '@/modules/compras/constants';
import { can, type AuthUser } from '@/server/rbac';

const TRANSITIONS: Record<PurchaseRequestStatus, PurchaseRequestStatus[]> = {
  PENDENTE: [
    PurchaseRequestStatus.APROVADA,
    PurchaseRequestStatus.REJEITADA,
    PurchaseRequestStatus.CANCELADA,
  ],
  APROVADA: [PurchaseRequestStatus.COMPRADA, PurchaseRequestStatus.CANCELADA],
  COMPRADA: [PurchaseRequestStatus.RECEBIDA],
  RECEBIDA: [],
  REJEITADA: [],
  CANCELADA: [],
};

/**
 * Permissão exigida para cada destino.
 * Cancelar é o único caso em que o próprio solicitante também pode agir
 * (ver `canCancel`), por isso exige a permissão de aprovação para terceiros.
 */
const PERMISSION_BY_TARGET: Record<PurchaseRequestStatus, string> = {
  APROVADA: 'purchase.approve',
  REJEITADA: 'purchase.approve',
  COMPRADA: 'purchase.manage',
  RECEBIDA: 'purchase.manage',
  CANCELADA: 'purchase.approve',
  PENDENTE: 'purchase.request',
};

/** Status a partir dos quais nada mais muda. */
export function isFinalStatus(status: PurchaseRequestStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

/** Próximos status possíveis a partir do atual. */
export function nextStatuses(status: PurchaseRequestStatus): PurchaseRequestStatus[] {
  return TRANSITIONS[status];
}

export function canTransition(from: PurchaseRequestStatus, to: PurchaseRequestStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function permissionForTransition(to: PurchaseRequestStatus): string {
  return PERMISSION_BY_TARGET[to];
}

/** O próprio solicitante pode cancelar enquanto a solicitação estiver pendente. */
export function canCancelOwnRequest(
  status: PurchaseRequestStatus,
  requestedById: string,
  userId: string,
): boolean {
  return status === PurchaseRequestStatus.PENDENTE && requestedById === userId;
}

/**
 * Valida a transição, lançando erro de domínio quando inválida.
 * Rejeição e cancelamento exigem motivo — a decisão precisa ser justificada.
 */
export function assertTransition(
  from: PurchaseRequestStatus,
  to: PurchaseRequestStatus,
  options: { note?: string | null } = {},
): void {
  if (from === to) {
    throw new AppError(
      'CONFLICT',
      `A solicitação já está ${REQUEST_STATUS_LABEL[to].toLowerCase()}.`,
    );
  }
  if (!canTransition(from, to)) {
    throw new AppError(
      'CONFLICT',
      `Não é possível mudar de "${REQUEST_STATUS_LABEL[from]}" para "${REQUEST_STATUS_LABEL[to]}".`,
    );
  }
  const needsNote =
    to === PurchaseRequestStatus.REJEITADA || to === PurchaseRequestStatus.CANCELADA;
  if (needsNote && !options.note?.trim()) {
    throw new AppError('VALIDATION', 'Informe o motivo da rejeição ou do cancelamento.');
  }
}

/** Campos de histórico gravados a cada transição (quem fez e quando). */
export function stampsForTransition(
  to: PurchaseRequestStatus,
  userId: string,
  now: Date,
): Record<string, string | Date> {
  switch (to) {
    case PurchaseRequestStatus.APROVADA:
      return { approvedById: userId, approvedAt: now };
    case PurchaseRequestStatus.COMPRADA:
      return { purchasedById: userId, purchasedAt: now };
    case PurchaseRequestStatus.RECEBIDA:
      return { receivedById: userId, receivedAt: now };
    default:
      return {};
  }
}

/**
 * Ações que ESTE usuário pode executar na solicitação.
 * Usada para montar os botões; o servidor revalida a cada requisição.
 */
export function availableActions(
  user: AuthUser,
  request: {
    status: PurchaseRequestStatus;
    schoolId: string;
    module: ModuleType;
    requestedById: string;
  },
): PurchaseRequestStatus[] {
  return nextStatuses(request.status).filter((target) => {
    if (canCancelOwnRequest(request.status, request.requestedById, user.id)) {
      if (target === PurchaseRequestStatus.CANCELADA) return true;
    }
    return can(user, permissionForTransition(target), {
      schoolId: request.schoolId,
      module: request.module,
    });
  });
}

/** Solicitações que ainda vão consumir orçamento/estoque futuro. */
export const OPEN_REQUEST_STATUSES: PurchaseRequestStatus[] = [
  PurchaseRequestStatus.PENDENTE,
  PurchaseRequestStatus.APROVADA,
  PurchaseRequestStatus.COMPRADA,
];
