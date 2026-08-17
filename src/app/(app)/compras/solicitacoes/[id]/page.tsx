import Link from 'next/link';
import { AppError } from '@/lib/errors';
import { formatDateTime } from '@/lib/date';
import { formatQuantity } from '@/lib/number';
import { categoryGroupLabel, REQUEST_STATUS_LABEL } from '@/modules/compras/constants';
import { getPurchaseRequest, loadUserNames } from '@/modules/compras/purchase-request-service';
import { availableActions } from '@/modules/compras/request-workflow';
import { ModuleType, PurchaseRequestStatus } from '@/modules/shared/enums';
import { requireAuth } from '@/server/guard';
import { can } from '@/server/rbac';
import { PriorityBadge, RequestStatusBadge } from '@/components/compras/Badges';
import { RequestActions } from '@/components/compras/RequestActions';

export const dynamic = 'force-dynamic';

const MODULE_LABEL: Record<ModuleType, string> = {
  FOOD: 'Merenda escolar',
  SCHOOL_MATERIAL: 'Materiais escolares',
};

/** Detalhe da solicitação com a trilha completa de quem fez o quê. */
export default async function SolicitacaoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAuth();
  const { id } = await params;

  if (!can(user, 'purchase.view')) {
    throw new AppError('FORBIDDEN', 'Você não possui autorização para acessar as compras.');
  }

  const request = await getPurchaseRequest(user, id);
  const names = await loadUserNames([
    request.requestedById,
    request.approvedById,
    request.purchasedById,
    request.receivedById,
    ...request.events.map((e) => e.userId),
  ]);

  const actions = availableActions(user, {
    status: request.status as PurchaseRequestStatus,
    schoolId: request.schoolId,
    module: request.module as ModuleType,
    requestedById: request.requestedById,
  });

  return (
    <div className="max-w-3xl space-y-6">
      <nav aria-label="Voltar">
        <Link href="/compras/solicitacoes" className="text-sm text-brand-700 hover:underline">
          ← Solicitações
        </Link>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Solicitação {request.number}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {MODULE_LABEL[request.module as ModuleType]} · registrada em{' '}
            {formatDateTime(request.createdAt)}
          </p>
        </div>
        <div className="flex gap-2">
          <PriorityBadge priority={request.priority} />
          <RequestStatusBadge status={request.status} />
        </div>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-slate-500">Material</dt>
            <dd className="text-sm font-medium text-slate-900">
              {request.item?.name ?? request.itemDescription}
              {request.item && (
                <span className="ml-1 font-mono text-xs text-slate-500">{request.item.code}</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Categoria</dt>
            <dd className="text-sm text-slate-700">{categoryGroupLabel(request.categoryGroup)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Quantidade</dt>
            <dd className="text-sm font-medium text-slate-900">
              {formatQuantity(Number(request.quantity))}{' '}
              {request.item?.unitOfMeasure.abbreviation ?? ''}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Lista de compras</dt>
            <dd className="text-sm text-slate-700">
              {request.purchaseList ? (
                <Link
                  href={`/compras/listas/${request.purchaseList.id}`}
                  className="text-brand-700 hover:underline"
                >
                  {request.purchaseList.number}
                </Link>
              ) : (
                '—'
              )}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-slate-500">Justificativa</dt>
            <dd className="text-sm text-slate-700">{request.justification}</dd>
          </div>
          {request.decisionNote && (
            <div className="sm:col-span-2">
              <dt className="text-xs text-slate-500">Observação da última decisão</dt>
              <dd className="text-sm text-slate-700">{request.decisionNote}</dd>
            </div>
          )}
        </dl>
      </section>

      <section aria-labelledby="acoes" className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 id="acoes" className="font-semibold text-slate-900">
          Ações
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          O recebimento aqui registra a etapa da compra. A entrada no estoque continua sendo feita
          pela tela de Entradas, com nota e lote.
        </p>
        <div className="mt-3">
          <RequestActions requestId={request.id} actions={actions} />
        </div>
      </section>

      <section aria-labelledby="historico">
        <h2 id="historico" className="font-semibold text-slate-900">
          Histórico
        </h2>
        <ol className="mt-3 space-y-3 border-l-2 border-slate-200 pl-4">
          {request.events.map((event) => (
            <li key={event.id} className="relative">
              <span
                aria-hidden="true"
                className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-brand-500"
              />
              <p className="text-sm font-medium text-slate-900">
                {event.fromStatus
                  ? `${REQUEST_STATUS_LABEL[event.fromStatus]} → ${REQUEST_STATUS_LABEL[event.toStatus]}`
                  : REQUEST_STATUS_LABEL[event.toStatus]}
              </p>
              <p className="text-xs text-slate-500">
                {names.get(event.userId) ?? 'Usuário removido'} · {formatDateTime(event.createdAt)}
              </p>
              {event.note && <p className="mt-0.5 text-xs text-slate-600">{event.note}</p>}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
