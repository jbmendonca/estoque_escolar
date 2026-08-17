import Link from 'next/link';
import { AppError } from '@/lib/errors';
import { formatQuantity } from '@/lib/number';
import { categoryGroupLabel, HEALTH_ICON } from '@/modules/compras/constants';
import { getPurchaseDashboard } from '@/modules/compras/suggestion-service';
import { visibleModules } from '@/modules/dashboard/analytics-service';
import { requireAuth } from '@/server/guard';
import { can } from '@/server/rbac';
import { KpiCard } from '@/components/dashboard/KpiCard';

export const dynamic = 'force-dynamic';

const PERIODS = [30, 90, 180] as const;

/** Painel do módulo Compras e Sugestões. */
export default async function ComprasPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const user = await requireAuth();
  const params = await searchParams;
  const schoolId = user.schoolIds[0];

  if (!can(user, 'purchase.view', { schoolId })) {
    throw new AppError('FORBIDDEN', 'Você não possui autorização para acessar as compras.');
  }

  const days = PERIODS.includes(Number(params.periodo) as (typeof PERIODS)[number])
    ? Number(params.periodo)
    : 90;

  const modules = visibleModules(user, schoolId);
  const dashboard = await getPurchaseDashboard(user, modules, { days });
  const maxConsumed = Math.max(...dashboard.topConsumed.map((t) => t.consumed), 1);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Compras e Sugestões</h1>
          <p className="mt-1 text-sm text-slate-600">
            Situação do estoque, solicitações em andamento e o que o sistema recomenda comprar, com
            base no consumo dos últimos {days} dias.
          </p>
        </div>

        <nav aria-label="Período de análise" className="flex gap-1 rounded-lg bg-slate-100 p-1">
          {PERIODS.map((p) => (
            <a
              key={p}
              href={`/compras?periodo=${p}`}
              aria-current={p === days ? 'page' : undefined}
              className={`rounded-md px-3 py-1 text-sm ${
                p === days ? 'bg-white font-medium text-brand-700 shadow-sm' : 'text-slate-600'
              }`}
            >
              {p} dias
            </a>
          ))}
        </nav>
      </header>

      <section aria-labelledby="indicadores">
        <h2 id="indicadores" className="sr-only">
          Indicadores de compras
        </h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
          <KpiCard
            label={`${HEALTH_ICON.CRITICO} Materiais críticos`}
            value={dashboard.health.CRITICO}
            tone={dashboard.health.CRITICO > 0 ? 'danger' : 'default'}
            hint="zerados, abaixo do mínimo ou acabando"
          />
          <KpiCard
            label={`${HEALTH_ICON.ATENCAO} Próximos do mínimo`}
            value={dashboard.health.ATENCAO}
            tone={dashboard.health.ATENCAO > 0 ? 'warn' : 'default'}
          />
          <KpiCard
            label={`${HEALTH_ICON.ADEQUADO} Estoque adequado`}
            value={dashboard.health.ADEQUADO}
            tone="good"
          />
          <KpiCard
            label="🛒 Itens na lista de compras"
            value={dashboard.itemsInLists}
            hint={`${dashboard.openLists} lista(s) em aberto`}
          />
          <KpiCard
            label="📋 Solicitações pendentes"
            value={dashboard.pendingRequests}
            tone={dashboard.pendingRequests > 0 ? 'warn' : 'default'}
            hint={`${dashboard.approvedRequests} aprovada(s) aguardando compra`}
          />
          <KpiCard
            label="Sugestões de compra"
            value={dashboard.suggestionsCount}
            tone={dashboard.highPriority > 0 ? 'danger' : 'info'}
            hint={`${dashboard.highPriority} de prioridade alta`}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/compras/sugestoes" className={PRIMARY_LINK}>
            Ver lista inteligente
          </Link>
          <Link href="/compras/solicitacoes" className={SECONDARY_LINK}>
            Solicitações de aquisição
          </Link>
          <Link href="/compras/listas" className={SECONDARY_LINK}>
            Listas de compras
          </Link>
        </div>
      </section>

      <section aria-labelledby="mais-consumidos" className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 id="mais-consumidos" className="font-semibold text-slate-900">
            📊 Materiais mais consumidos
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Volume de saída nos últimos {days} dias e média por dia.
          </p>

          {dashboard.topConsumed.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">Nenhuma saída registrada no período.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {dashboard.topConsumed.map((t) => (
                <li key={t.itemId} className="flex items-center gap-3">
                  <span className="w-44 shrink-0 truncate text-xs text-slate-700" title={t.name}>
                    {t.name}
                  </span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <span
                      className="block h-full bg-brand-500"
                      style={{ width: `${Math.max(2, (t.consumed / maxConsumed) * 100)}%` }}
                    />
                  </span>
                  <span className="w-28 shrink-0 text-right text-xs font-medium text-slate-700">
                    {formatQuantity(t.consumed)} {t.unit}
                    <span className="block font-normal text-slate-400">
                      {formatQuantity(Number(t.dailyAvg.toFixed(2)))}/dia
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-900">Consumo por categoria</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Alimentos separados por estivas, proteínas, hortaliças, bebidas e frutas; materiais por
            escritório, escolar, limpeza, informática, artes e pedagógico.
          </p>

          <table className="mt-4 w-full text-sm">
            <caption className="sr-only">Consumo por grupo de categoria</caption>
            <thead className="text-left text-xs text-slate-500">
              <tr>
                <th className="pb-1">Categoria</th>
                <th className="pb-1 text-right">Itens</th>
                <th className="pb-1 text-right">Consumo</th>
                <th className="pb-1 text-right">Média/dia</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.byGroup.map((g) => (
                <tr key={g.group ?? 'sem-grupo'} className="border-t border-slate-100">
                  <td className="py-1.5 text-slate-700">{categoryGroupLabel(g.group)}</td>
                  <td className="py-1.5 text-right text-slate-500">{g.items}</td>
                  <td className="py-1.5 text-right font-medium text-slate-800">
                    {formatQuantity(g.consumed)}
                  </td>
                  <td className="py-1.5 text-right text-slate-600">
                    {formatQuantity(Number(g.dailyAvg.toFixed(2)))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

const PRIMARY_LINK =
  'rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700';
const SECONDARY_LINK =
  'rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50';
