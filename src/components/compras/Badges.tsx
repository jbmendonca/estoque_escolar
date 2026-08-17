// Selos de prioridade, situação e saúde do estoque usados em todo o módulo.
import {
  HEALTH_ICON,
  HEALTH_LABEL,
  LIST_STATUS_LABEL,
  PRIORITY_LABEL,
  REQUEST_STATUS_LABEL,
} from '@/modules/compras/constants';
import type {
  PurchaseListStatus,
  PurchasePriority,
  PurchaseRequestStatus,
  StockHealth,
} from '@/modules/shared/enums';

const BASE = 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium';

const PRIORITY_STYLE: Record<PurchasePriority, string> = {
  ALTA: 'bg-red-100 text-red-700',
  MEDIA: 'bg-amber-100 text-amber-800',
  BAIXA: 'bg-slate-100 text-slate-600',
};

export function PriorityBadge({ priority }: { priority: PurchasePriority }) {
  return <span className={`${BASE} ${PRIORITY_STYLE[priority]}`}>{PRIORITY_LABEL[priority]}</span>;
}

const REQUEST_STATUS_STYLE: Record<PurchaseRequestStatus, string> = {
  PENDENTE: 'bg-amber-100 text-amber-800',
  APROVADA: 'bg-brand-100 text-brand-700',
  COMPRADA: 'bg-indigo-100 text-indigo-700',
  RECEBIDA: 'bg-emerald-100 text-emerald-700',
  REJEITADA: 'bg-red-100 text-red-700',
  CANCELADA: 'bg-slate-100 text-slate-600',
};

export function RequestStatusBadge({ status }: { status: PurchaseRequestStatus }) {
  return (
    <span className={`${BASE} ${REQUEST_STATUS_STYLE[status]}`}>
      {REQUEST_STATUS_LABEL[status]}
    </span>
  );
}

const LIST_STATUS_STYLE: Record<PurchaseListStatus, string> = {
  ABERTA: 'bg-brand-100 text-brand-700',
  ENVIADA: 'bg-indigo-100 text-indigo-700',
  CONCLUIDA: 'bg-emerald-100 text-emerald-700',
  CANCELADA: 'bg-slate-100 text-slate-600',
};

export function ListStatusBadge({ status }: { status: PurchaseListStatus }) {
  return (
    <span className={`${BASE} ${LIST_STATUS_STYLE[status]}`}>{LIST_STATUS_LABEL[status]}</span>
  );
}

const HEALTH_STYLE: Record<StockHealth, string> = {
  CRITICO: 'bg-red-100 text-red-700',
  ATENCAO: 'bg-amber-100 text-amber-800',
  ADEQUADO: 'bg-emerald-100 text-emerald-700',
};

export function HealthBadge({ health }: { health: StockHealth }) {
  return (
    <span className={`${BASE} ${HEALTH_STYLE[health]}`}>
      <span aria-hidden="true">{HEALTH_ICON[health]}</span>
      {HEALTH_LABEL[health]}
    </span>
  );
}
