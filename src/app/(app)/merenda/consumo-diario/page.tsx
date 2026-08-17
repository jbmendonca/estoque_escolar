import { AppError } from '@/lib/errors';
import { formatQuantity } from '@/lib/number';
import { categoryGroupLabel, FOOD_GROUPS } from '@/modules/compras/constants';
import { getDailyFoodConsumption } from '@/modules/dashboard/food-consumption-service';
import { CategoryGroup, ModuleType } from '@/modules/shared/enums';
import { requireAuth } from '@/server/guard';
import { can } from '@/server/rbac';
import { KpiCard } from '@/components/dashboard/KpiCard';

export const dynamic = 'force-dynamic';

const PERIODS = [7, 30, 90] as const;

/**
 * Quantidade de alimentos utilizada diariamente, separada por estivas,
 * proteínas, hortaliças, bebidas e frutas.
 */
export default async function ConsumoDiarioPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; grupo?: string }>;
}) {
  const user = await requireAuth();
  const params = await searchParams;
  const schoolId = user.schoolIds[0];

  if (!can(user, 'report.view', { schoolId, module: ModuleType.FOOD })) {
    throw new AppError('FORBIDDEN', 'Você não possui autorização para os relatórios da merenda.');
  }

  const days = PERIODS.includes(Number(params.periodo) as (typeof PERIODS)[number])
    ? Number(params.periodo)
    : 30;

  const groupFilter = FOOD_GROUPS.includes(params.grupo as CategoryGroup)
    ? (params.grupo as CategoryGroup)
    : undefined;

  const data = await getDailyFoodConsumption(user, { days });

  const byItem = groupFilter ? data.byItem.filter((i) => i.group === groupFilter) : data.byItem;
  const maxDay = Math.max(...data.byDay.map((d) => d.total), 1);
  const daysWithMovement = data.byDay.length;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Consumo diário de alimentos</h1>
          <p className="mt-1 text-sm text-slate-600">
            Quantidade utilizada por dia nos últimos {days} dias, separada por categoria. Perdas,
            avarias e produtos vencidos não entram no consumo.
          </p>
        </div>

        <nav aria-label="Período de análise" className="flex gap-1 rounded-lg bg-slate-100 p-1">
          {PERIODS.map((p) => (
            <a
              key={p}
              href={`/merenda/consumo-diario?periodo=${p}`}
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

      <section aria-labelledby="resumo">
        <h2 id="resumo" className="sr-only">
          Resumo do consumo
        </h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard label="Total utilizado no período" value={formatQuantity(data.total)} />
          <KpiCard
            label="Média por dia"
            value={formatQuantity(Number(data.dailyAvg.toFixed(2)))}
            hint={`considerando os ${days} dias`}
          />
          <KpiCard
            label="Dias com consumo"
            value={daysWithMovement}
            hint={`de ${days} dias analisados`}
          />
          <KpiCard
            label="Perdas no período"
            value={formatQuantity(data.wasteTotal)}
            tone={data.wasteTotal > 0 ? 'danger' : 'default'}
            hint="perdas, avarias e vencidos"
          />
        </div>
      </section>

      <section
        aria-labelledby="por-categoria"
        className="rounded-xl border border-slate-200 bg-white p-4"
      >
        <h2 id="por-categoria" className="font-semibold text-slate-900">
          Consumo por categoria
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Estivas, proteínas, hortaliças, bebidas e frutas.
        </p>

        {data.byGroup.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">Nenhuma saída de alimento no período.</p>
        ) : (
          <table className="mt-4 w-full text-sm">
            <caption className="sr-only">Consumo de alimentos por categoria</caption>
            <thead className="text-left text-xs text-slate-500">
              <tr>
                <th className="pb-1">Categoria</th>
                <th className="pb-1 text-right">Alimentos</th>
                <th className="pb-1 text-right">Total</th>
                <th className="pb-1 text-right">Média/dia</th>
                <th className="pb-1 text-right">Participação</th>
              </tr>
            </thead>
            <tbody>
              {data.byGroup.map((g) => (
                <tr key={g.group ?? 'sem-grupo'} className="border-t border-slate-100">
                  <td className="py-1.5 text-slate-700">{categoryGroupLabel(g.group)}</td>
                  <td className="py-1.5 text-right text-slate-500">{g.items}</td>
                  <td className="py-1.5 text-right font-medium text-slate-800">
                    {formatQuantity(g.total)}
                  </td>
                  <td className="py-1.5 text-right text-slate-600">
                    {formatQuantity(Number(g.dailyAvg.toFixed(2)))}
                  </td>
                  <td className="py-1.5 text-right text-slate-600">{Math.round(g.share * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section
        aria-labelledby="por-dia"
        className="rounded-xl border border-slate-200 bg-white p-4"
      >
        <h2 id="por-dia" className="font-semibold text-slate-900">
          Quantidade utilizada por dia
        </h2>

        {data.byDay.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">Nenhuma saída de alimento no período.</p>
        ) : (
          <ul className="mt-4 space-y-1.5">
            {data.byDay.map((d) => (
              <li key={d.day} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-xs text-slate-600">{formatDay(d.day)}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <span
                    className="block h-full bg-brand-500"
                    style={{ width: `${Math.max(2, (d.total / maxDay) * 100)}%` }}
                  />
                </span>
                <span className="w-20 shrink-0 text-right text-xs font-medium text-slate-700">
                  {formatQuantity(d.total)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="por-alimento" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="por-alimento" className="font-semibold text-slate-900">
              Quantidade diária por alimento
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Média no período e média nos dias em que o alimento foi efetivamente utilizado.
            </p>
          </div>

          <form method="get" action="/merenda/consumo-diario" className="flex items-end gap-2">
            <input type="hidden" name="periodo" value={days} />
            <div>
              <label htmlFor="grupo" className="block text-xs font-medium text-slate-600">
                Categoria
              </label>
              <select
                id="grupo"
                name="grupo"
                defaultValue={groupFilter ?? ''}
                className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Todas</option>
                {FOOD_GROUPS.map((g) => (
                  <option key={g} value={g}>
                    {categoryGroupLabel(g)}
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
        </div>

        {byItem.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600">
            Nenhum alimento utilizado no período com esse filtro.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <caption className="sr-only">Consumo diário por alimento</caption>
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-3 py-2">Alimento</th>
                  <th className="px-3 py-2">Categoria</th>
                  <th className="px-3 py-2 text-right">Total no período</th>
                  <th className="px-3 py-2 text-right">Média/dia</th>
                  <th className="px-3 py-2 text-right">Dias usados</th>
                  <th className="px-3 py-2 text-right">Média nos dias usados</th>
                  <th className="px-3 py-2 text-right">Saldo atual</th>
                </tr>
              </thead>
              <tbody>
                {byItem.map((i) => (
                  <tr key={i.itemId} className="border-t border-slate-100">
                    <td className="px-3 py-2">
                      <span className="font-mono text-xs text-slate-500">{i.code}</span>{' '}
                      <span className="font-medium text-slate-900">{i.name}</span>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {categoryGroupLabel(i.group)}
                      <span className="block text-slate-400">{i.categoryName}</span>
                    </td>
                    <td className="px-3 py-2 text-right font-medium">
                      {formatQuantity(i.total)}{' '}
                      <span className="text-xs text-slate-500">{i.unit}</span>
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      {formatQuantity(Number(i.dailyAvg.toFixed(2)))}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-500">{i.daysWithUse}</td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      {formatQuantity(Number(i.avgPerUseDay.toFixed(2)))}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-600">
                      {formatQuantity(i.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

/** "2026-08-14" → "14/08 (sex)". */
function formatDay(day: string): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  const weekday = date.toLocaleDateString('pt-BR', { weekday: 'short', timeZone: 'UTC' });
  return `${date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })} (${weekday.replace('.', '')})`;
}
