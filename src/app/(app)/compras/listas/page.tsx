import Link from 'next/link';
import { AppError } from '@/lib/errors';
import { formatDateTime } from '@/lib/date';
import { LIST_STATUS_LABEL } from '@/modules/compras/constants';
import { listPurchaseLists } from '@/modules/compras/purchase-list-service';
import { loadUserNames } from '@/modules/compras/purchase-request-service';
import { ModuleType, PurchaseListStatus } from '@/modules/shared/enums';
import { requireAuth } from '@/server/guard';
import { can } from '@/server/rbac';
import { ListStatusBadge } from '@/components/compras/Badges';

export const dynamic = 'force-dynamic';

const MODULE_LABEL: Record<ModuleType, string> = {
  FOOD: 'Merenda escolar',
  SCHOOL_MATERIAL: 'Materiais escolares',
};

const STATUS_FILTERS = ['ABERTA', 'ENVIADA', 'CONCLUIDA', 'CANCELADA'] as const;

/** Listas de compras geradas a partir das sugestões e solicitações. */
export default async function ListasPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const user = await requireAuth();
  const params = await searchParams;

  if (!can(user, 'purchase.view')) {
    throw new AppError('FORBIDDEN', 'Você não possui autorização para acessar as compras.');
  }

  const status = STATUS_FILTERS.includes(params.status as (typeof STATUS_FILTERS)[number])
    ? (params.status as PurchaseListStatus)
    : undefined;

  const result = await listPurchaseLists(user, {
    status,
    page: Number(params.page ?? 1),
    pageSize: 20,
  });
  const names = await loadUserNames(result.data.map((l) => l.createdById));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Listas de compras</h1>
          <p className="mt-1 text-sm text-slate-600">
            Cada lista guarda os números do estoque no momento em que foi gerada.
          </p>
        </div>
        <Link
          href="/compras/sugestoes"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Gerar nova lista
        </Link>
      </header>

      <form method="get" action="/compras/listas" className="flex flex-wrap items-end gap-2">
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
                {LIST_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Filtrar
        </button>
      </form>

      {result.data.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600">
          Nenhuma lista de compras gerada até agora.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <caption className="sr-only">Listas de compras</caption>
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2">Nº</th>
                <th className="px-3 py-2">Título</th>
                <th className="px-3 py-2">Módulo</th>
                <th className="px-3 py-2 text-right">Itens</th>
                <th className="px-3 py-2 text-right">Solicitações</th>
                <th className="px-3 py-2">Situação</th>
                <th className="px-3 py-2">Gerada por</th>
              </tr>
            </thead>
            <tbody>
              {result.data.map((l) => (
                <tr key={l.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">
                    <Link
                      href={`/compras/listas/${l.id}`}
                      className="font-mono text-xs text-brand-700 hover:underline"
                    >
                      {l.number}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-slate-800">{l.title ?? '—'}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {MODULE_LABEL[l.module as ModuleType]}
                  </td>
                  <td className="px-3 py-2 text-right font-medium">{l._count.items}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{l._count.requests}</td>
                  <td className="px-3 py-2">
                    <ListStatusBadge status={l.status} />
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {names.get(l.createdById) ?? '—'}
                    <span className="block text-slate-400">{formatDateTime(l.createdAt)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result.totalPages > 1 && (
        <p className="text-xs text-slate-500">
          Página {result.page} de {result.totalPages} — {result.total} listas.
        </p>
      )}
    </div>
  );
}
