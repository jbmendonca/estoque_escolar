import { AppError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/server/guard';
import { can, isAdmin } from '@/server/rbac';
import { buildMovementReport, type MovementFilter } from '@/modules/relatorios/movement-report';
import { buildStockReport, type StockStatusFilter } from '@/modules/relatorios/stock-report';
import { ReportTable } from '@/components/reports/ReportTable';
import { ExportButtons } from '@/components/reports/ExportButtons';
import type { ModuleType } from '@/modules/shared/enums';

export interface ReportsSearchParams {
  rel?: string;
  from?: string;
  to?: string;
  tipo?: string;
  categoria?: string;
  status?: string;
}

const MOVEMENT_FILTERS: MovementFilter[] = ['TODOS', 'ENTRADAS', 'SAIDAS'];
const STATUS_FILTERS: StockStatusFilter[] = ['TODOS', 'COM_SALDO', 'ZERADOS'];

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}
function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
}

/** Página de relatórios compartilhada entre Merenda e Materiais. */
export async function ReportsPage({
  module,
  title,
  basePath,
  searchParams,
}: {
  module: ModuleType;
  title: string;
  basePath: string;
  searchParams: ReportsSearchParams;
}) {
  const user = await requireAuth();
  const schoolId = user.schoolIds[0];

  // Autorização verificada no servidor, por módulo.
  if (!can(user, 'report.view', { schoolId, module })) {
    throw new AppError('FORBIDDEN', 'Você não possui autorização para ver relatórios deste módulo.');
  }

  const rel = searchParams.rel === 'saldo' ? 'saldo' : 'movimentacao';
  const from = searchParams.from || isoDaysAgo(30);
  const to = searchParams.to || isoToday();
  const tipo = (MOVEMENT_FILTERS.includes(searchParams.tipo as MovementFilter)
    ? searchParams.tipo
    : 'TODOS') as MovementFilter;
  const status = (STATUS_FILTERS.includes(searchParams.status as StockStatusFilter)
    ? searchParams.status
    : 'TODOS') as StockStatusFilter;
  const categoria = searchParams.categoria || '';

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: { name: true },
  });
  const userName = profile?.name ?? 'Usuário';

  const categories = await prisma.category.findMany({
    where: {
      module,
      active: true,
      ...(isAdmin(user) ? {} : { schoolId: { in: user.schoolIds } }),
    },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  const dataset =
    rel === 'saldo'
      ? await buildStockReport(user, userName, {
          module,
          categoryId: categoria || undefined,
          status,
        })
      : await buildMovementReport(user, userName, { module, from, to, tipo });

  const exportQuery =
    rel === 'saldo'
      ? `module=${module}&status=${status}${categoria ? `&categoryId=${categoria}` : ''}`
      : `module=${module}&from=${from}&to=${to}&tipo=${tipo}`;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
      <p className="mt-1 text-sm text-slate-600">
        Consulte na tela e exporte em PDF ou Excel para auditoria e fechamento de inventário.
      </p>

      {/* ---- Seleção do relatório ---- */}
      <nav aria-label="Tipo de relatório" className="mt-4 flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
        <a
          href={`${basePath}?rel=movimentacao`}
          aria-current={rel === 'movimentacao' ? 'page' : undefined}
          className={`rounded-md px-3 py-1.5 text-sm ${
            rel === 'movimentacao' ? 'bg-white font-medium text-brand-700 shadow-sm' : 'text-slate-600'
          }`}
        >
          Movimentação por período
        </a>
        <a
          href={`${basePath}?rel=saldo`}
          aria-current={rel === 'saldo' ? 'page' : undefined}
          className={`rounded-md px-3 py-1.5 text-sm ${
            rel === 'saldo' ? 'bg-white font-medium text-brand-700 shadow-sm' : 'text-slate-600'
          }`}
        >
          Saldo atual
        </a>
      </nav>

      {/* ---- Filtros ---- */}
      <form method="get" action={basePath} className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
        <input type="hidden" name="rel" value={rel} />

        {rel === 'movimentacao' ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div>
              <label htmlFor="from" className="block text-sm font-medium text-slate-700">
                Data inicial <span className="text-red-600">*</span>
              </label>
              <input
                id="from"
                type="date"
                name="from"
                required
                defaultValue={from}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="to" className="block text-sm font-medium text-slate-700">
                Data final <span className="text-red-600">*</span>
              </label>
              <input
                id="to"
                type="date"
                name="to"
                required
                defaultValue={to}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="tipo" className="block text-sm font-medium text-slate-700">
                Tipo de movimentação
              </label>
              <select
                id="tipo"
                name="tipo"
                defaultValue={tipo}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="TODOS">Todos</option>
                <option value="ENTRADAS">Apenas entradas</option>
                <option value="SAIDAS">Apenas saídas</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                Consultar
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="categoria" className="block text-sm font-medium text-slate-700">
                Categoria
              </label>
              <select
                id="categoria"
                name="categoria"
                defaultValue={categoria}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Todas as categorias</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-slate-700">
                Status
              </label>
              <select
                id="status"
                name="status"
                defaultValue={status}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="TODOS">Todos</option>
                <option value="COM_SALDO">Apenas itens com saldo</option>
                <option value="ZERADOS">Apenas itens zerados</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                Consultar
              </button>
            </div>
          </div>
        )}
      </form>

      {/* ---- Exportação ---- */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-600">
          <p className="font-medium text-slate-900">{dataset.title}</p>
          <p className="text-xs">{dataset.filtersDescription.join(' · ')}</p>
        </div>
        <ExportButtons reportType={rel} query={exportQuery} />
      </div>

      <ReportTable dataset={dataset} />
    </div>
  );
}
