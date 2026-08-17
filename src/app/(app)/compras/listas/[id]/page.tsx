import Link from 'next/link';
import { AppError } from '@/lib/errors';
import { formatDateTime } from '@/lib/date';
import { formatQuantity } from '@/lib/number';
import { categoryGroupLabel, SOURCE_LABEL } from '@/modules/compras/constants';
import { getPurchaseList } from '@/modules/compras/purchase-list-service';
import { loadUserNames } from '@/modules/compras/purchase-request-service';
import { ModuleType, PurchaseListStatus } from '@/modules/shared/enums';
import { requireAuth } from '@/server/guard';
import { can } from '@/server/rbac';
import { ListStatusBadge, PriorityBadge } from '@/components/compras/Badges';
import { ListStatusActions } from '@/components/compras/ListStatusActions';

export const dynamic = 'force-dynamic';

const MODULE_LABEL: Record<ModuleType, string> = {
  FOOD: 'Merenda escolar',
  SCHOOL_MATERIAL: 'Materiais escolares',
};

const NEXT_STATUSES: Record<PurchaseListStatus, PurchaseListStatus[]> = {
  ABERTA: ['ENVIADA', 'CONCLUIDA', 'CANCELADA'],
  ENVIADA: ['CONCLUIDA', 'CANCELADA'],
  CONCLUIDA: [],
  CANCELADA: [],
};

/** Detalhe da lista de compras, pronto para conferência e impressão. */
export default async function ListaDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  const { id } = await params;

  if (!can(user, 'purchase.view')) {
    throw new AppError('FORBIDDEN', 'Você não possui autorização para acessar as compras.');
  }

  const list = await getPurchaseList(user, id);
  const names = await loadUserNames([list.createdById, list.closedById]);
  const canManage = can(user, 'purchase.manage', {
    schoolId: list.schoolId,
    module: list.module as ModuleType,
  });

  const totalItems = list.items.length;
  const freeRequests = list.requests.filter((r) => r.itemDescription);

  return (
    <div className="space-y-6">
      <nav aria-label="Voltar">
        <Link href="/compras/listas" className="text-sm text-brand-700 hover:underline">
          ← Listas de compras
        </Link>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Lista {list.number}
            {list.title ? ` — ${list.title}` : ''}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {MODULE_LABEL[list.module as ModuleType]} · gerada por{' '}
            {names.get(list.createdById) ?? '—'} em {formatDateTime(list.createdAt)} · consumo
            analisado: {list.periodDays} dias
          </p>
          {list.closedAt && (
            <p className="text-xs text-slate-500">
              Encerrada por {names.get(list.closedById ?? '') ?? '—'} em{' '}
              {formatDateTime(list.closedAt)}
            </p>
          )}
        </div>
        <ListStatusBadge status={list.status} />
      </header>

      {list.notes && (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{list.notes}</p>
      )}

      <section aria-labelledby="itens">
        <h2 id="itens" className="font-semibold text-slate-900">
          Itens ({totalItems})
        </h2>

        <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <caption className="sr-only">Itens da lista de compras</caption>
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2">Material</th>
                <th className="px-3 py-2">Categoria</th>
                <th className="px-3 py-2 text-right">A comprar</th>
                <th className="px-3 py-2 text-right">Saldo na geração</th>
                <th className="px-3 py-2 text-right">Mínimo</th>
                <th className="px-3 py-2 text-right">Consumo/dia</th>
                <th className="px-3 py-2 text-right">Previsão</th>
                <th className="px-3 py-2">Prioridade</th>
                <th className="px-3 py-2">Origem</th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((line) => (
                <tr key={line.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">
                    <span className="font-mono text-xs text-slate-500">{line.item.code}</span>{' '}
                    <span className="font-medium text-slate-900">{line.item.name}</span>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {categoryGroupLabel(line.item.category.group)}
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-slate-900">
                    {formatQuantity(Number(line.quantity))}{' '}
                    <span className="text-xs text-slate-500">
                      {line.item.unitOfMeasure.abbreviation}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-slate-600">
                    {formatQuantity(Number(line.currentQuantity))}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-500">
                    {formatQuantity(Number(line.minStock))}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-600">
                    {formatQuantity(Number(Number(line.dailyAvg).toFixed(2)))}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-600">
                    {line.coverageDays === null ? '—' : `${line.coverageDays} dias`}
                  </td>
                  <td className="px-3 py-2">
                    <PriorityBadge priority={line.priority} />
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">
                    {SOURCE_LABEL[line.source]}
                    {line.request && (
                      <Link
                        href={`/compras/solicitacoes/${line.request.id}`}
                        className="block font-mono text-brand-700 hover:underline"
                      >
                        {line.request.number}
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {freeRequests.length > 0 && (
        <section aria-labelledby="sem-cadastro">
          <h2 id="sem-cadastro" className="font-semibold text-slate-900">
            Materiais solicitados sem cadastro
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Descritos livremente pelo solicitante; cadastre o item ao receber a compra.
          </p>
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            {freeRequests.map((r) => (
              <li key={r.id}>
                <span className="font-mono text-xs text-slate-500">{r.number}</span>{' '}
                {r.itemDescription} — {formatQuantity(Number(r.quantity))}
              </li>
            ))}
          </ul>
        </section>
      )}

      {canManage && (
        <section
          aria-labelledby="situacao"
          className="rounded-xl border border-slate-200 bg-white p-4"
        >
          <h2 id="situacao" className="font-semibold text-slate-900">
            Situação da lista
          </h2>
          <div className="mt-3">
            <ListStatusActions
              listId={list.id}
              actions={NEXT_STATUSES[list.status as PurchaseListStatus]}
            />
          </div>
        </section>
      )}
    </div>
  );
}
