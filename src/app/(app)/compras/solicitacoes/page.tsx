import Link from 'next/link';
import { AppError } from '@/lib/errors';
import { formatDateTime } from '@/lib/date';
import { formatQuantity } from '@/lib/number';
import { listItems } from '@/modules/catalogo/item-service';
import {
  categoryGroupLabel,
  groupsForModule,
  REQUEST_STATUS_LABEL,
} from '@/modules/compras/constants';
import { listPurchaseRequests, loadUserNames } from '@/modules/compras/purchase-request-service';
import { availableActions } from '@/modules/compras/request-workflow';
import { visibleModules } from '@/modules/dashboard/analytics-service';
import { ModuleType, PurchaseRequestStatus } from '@/modules/shared/enums';
import { requireAuth } from '@/server/guard';
import { can, isAdmin } from '@/server/rbac';
import { PriorityBadge, RequestStatusBadge } from '@/components/compras/Badges';
import {
  PurchaseRequestForm,
  type RequestItemOption,
} from '@/components/compras/PurchaseRequestForm';
import { RequestActions } from '@/components/compras/RequestActions';

export const dynamic = 'force-dynamic';

const MODULE_LABEL: Record<ModuleType, string> = {
  FOOD: 'Merenda escolar',
  SCHOOL_MATERIAL: 'Materiais escolares',
};

const STATUS_FILTERS = [
  'PENDENTE',
  'APROVADA',
  'COMPRADA',
  'RECEBIDA',
  'REJEITADA',
  'CANCELADA',
] as const;

/** Solicitações de aquisição: registro, acompanhamento do fluxo e histórico. */
export default async function SolicitacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; minhas?: string; page?: string }>;
}) {
  const user = await requireAuth();
  const params = await searchParams;
  const schoolId = user.schoolIds[0];

  if (!can(user, 'purchase.view', { schoolId })) {
    throw new AppError('FORBIDDEN', 'Você não possui autorização para acessar as compras.');
  }

  const allowed = visibleModules(user, schoolId);
  const canRequest = allowed.some((m) => can(user, 'purchase.request', { schoolId, module: m }));

  const status = STATUS_FILTERS.includes(params.status as (typeof STATUS_FILTERS)[number])
    ? (params.status as PurchaseRequestStatus)
    : undefined;
  const mine = params.minhas === '1';

  const result = await listPurchaseRequests(user, {
    status,
    requestedById: mine ? user.id : undefined,
    page: Number(params.page ?? 1),
    pageSize: 20,
  });

  const names = await loadUserNames(
    result.data.flatMap((r) => [r.requestedById, r.approvedById, r.purchasedById, r.receivedById]),
  );

  // Opções do formulário: itens de cada módulo que o solicitante pode pedir.
  const itemsByModule: Record<string, RequestItemOption[]> = {};
  const groupsByModule: Record<string, ReturnType<typeof groupsForModule>> = {};
  const requestModules = allowed.filter((m) =>
    can(user, 'purchase.request', { schoolId, module: m }),
  );

  for (const module of requestModules) {
    const items = await listItems({
      schoolIds: isAdmin(user) ? undefined : user.schoolIds,
      module,
      pageSize: 100,
      sort: 'name:asc',
    });
    itemsByModule[module] = items.data.map((i) => ({
      id: i.id,
      code: i.code,
      name: i.name,
      unit: i.unitOfMeasure.abbreviation,
      quantity: Number(i.stock?.quantity ?? 0),
    }));
    groupsByModule[module] = groupsForModule(module);
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Solicitações de aquisição</h1>
        <p className="mt-1 text-sm text-slate-600">
          Fluxo: pendente → aprovada → comprada → recebida. Cada etapa registra quem executou e
          quando.
        </p>
      </header>

      {canRequest && requestModules.length > 0 && (
        <section aria-labelledby="nova-solicitacao">
          <h2 id="nova-solicitacao" className="font-semibold text-slate-900">
            Nova solicitação
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Informe o material, a quantidade e a justificativa. A solicitação segue para aprovação.
          </p>
          <div className="mt-3">
            <PurchaseRequestForm
              modules={requestModules.map((m) => ({ value: m, label: MODULE_LABEL[m] }))}
              items={itemsByModule}
              groups={groupsByModule}
            />
          </div>
        </section>
      )}

      <section aria-labelledby="lista-solicitacoes" className="space-y-3">
        <h2 id="lista-solicitacoes" className="font-semibold text-slate-900">
          Solicitações registradas
        </h2>

        <form
          method="get"
          action="/compras/solicitacoes"
          className="flex flex-wrap items-end gap-2"
        >
          <div>
            <label htmlFor="status" className="block text-xs font-medium text-slate-600">
              Situação
            </label>
            <select
              id="status"
              name="status"
              defaultValue={status ?? ''}
              className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Todas</option>
              {STATUS_FILTERS.map((s) => (
                <option key={s} value={s}>
                  {REQUEST_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 py-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="minhas"
              value="1"
              defaultChecked={mine}
              className="h-4 w-4"
            />
            Somente as minhas
          </label>
          <button
            type="submit"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Filtrar
          </button>
        </form>

        {result.data.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600">
            Nenhuma solicitação encontrada com esse filtro.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <caption className="sr-only">Solicitações de aquisição</caption>
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-3 py-2">Nº</th>
                  <th className="px-3 py-2">Material</th>
                  <th className="px-3 py-2 text-right">Quantidade</th>
                  <th className="px-3 py-2">Prioridade</th>
                  <th className="px-3 py-2">Situação</th>
                  <th className="px-3 py-2">Histórico</th>
                  <th className="px-3 py-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {result.data.map((r) => {
                  const actions = availableActions(user, {
                    status: r.status as PurchaseRequestStatus,
                    schoolId: r.schoolId,
                    module: r.module as ModuleType,
                    requestedById: r.requestedById,
                  });
                  return (
                    <tr key={r.id} className="border-t border-slate-100 align-top">
                      <td className="px-3 py-2">
                        <Link
                          href={`/compras/solicitacoes/${r.id}`}
                          className="font-mono text-xs text-brand-700 hover:underline"
                        >
                          {r.number}
                        </Link>
                        <span className="block text-xs text-slate-400">
                          {formatDateTime(r.createdAt)}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-medium text-slate-900">
                          {r.item?.name ?? r.itemDescription}
                        </span>
                        <span className="block text-xs text-slate-500">
                          {r.item ? r.item.code : categoryGroupLabel(r.categoryGroup)} ·{' '}
                          {MODULE_LABEL[r.module as ModuleType]}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-medium">
                        {formatQuantity(Number(r.quantity))}{' '}
                        <span className="text-xs text-slate-500">
                          {r.item?.unitOfMeasure.abbreviation ?? ''}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <PriorityBadge priority={r.priority} />
                      </td>
                      <td className="px-3 py-2">
                        <RequestStatusBadge status={r.status} />
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600">
                        <span className="block">
                          Solicitou: {names.get(r.requestedById) ?? '—'}
                        </span>
                        {r.approvedById && (
                          <span className="block">Aprovou: {names.get(r.approvedById) ?? '—'}</span>
                        )}
                        {r.purchasedById && (
                          <span className="block">
                            Comprou: {names.get(r.purchasedById) ?? '—'}
                          </span>
                        )}
                        {r.receivedById && (
                          <span className="block">Recebeu: {names.get(r.receivedById) ?? '—'}</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <RequestActions requestId={r.id} actions={actions} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {result.totalPages > 1 && (
          <p className="text-xs text-slate-500">
            Página {result.page} de {result.totalPages} — {result.total} solicitações.
          </p>
        )}
      </section>
    </div>
  );
}
