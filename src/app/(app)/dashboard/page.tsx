import { requireAuth } from '@/server/guard';
import {
  analyzeUsage,
  buildLowStockAlerts,
  getConsumptionByCategory,
  getConsumptionSeries,
  getItemUsage,
  getKpis,
  visibleModules,
} from '@/modules/dashboard/analytics-service';
import { getNearExpiryDays } from '@/modules/lotes/food-batch-service';
import { ModuleType } from '@/modules/shared/enums';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { ConsumptionChart } from '@/components/dashboard/ConsumptionChart';
import { LowStockPanel } from '@/components/dashboard/LowStockPanel';
import { UsageRanking } from '@/components/dashboard/UsageRanking';
import { SmartPanel } from '@/components/dashboard/SmartPanel';

export const dynamic = 'force-dynamic';

const PERIODS = [7, 30, 90] as const;
const RISK_DAYS = 15;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const user = await requireAuth();
  const params = await searchParams;

  const days = PERIODS.includes(Number(params.periodo) as (typeof PERIODS)[number])
    ? Number(params.periodo)
    : 30;

  const schoolId = user.schoolIds[0];
  // Merendeira vê só Merenda; Assistente de Aluno, só Materiais.
  const modules = visibleModules(user, schoolId);

  if (modules.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-2 text-sm text-slate-600">
          Você ainda não possui permissão para visualizar indicadores de estoque.
        </p>
      </div>
    );
  }

  const nearExpiryDays = schoolId ? await getNearExpiryDays(schoolId) : 30;

  const [kpis, series, usage, categories] = await Promise.all([
    getKpis(user, modules, { days, nearExpiryDays }),
    getConsumptionSeries(user, modules, { days }),
    getItemUsage(user, modules, { days }),
    getConsumptionByCategory(user, modules, { days }),
  ]);

  const analysis = analyzeUsage(usage, { riskDays: RISK_DAYS });
  const lowStock = buildLowStockAlerts(usage);

  const consumed = [...usage].filter((u) => u.consumed > 0).sort((a, b) => b.consumed - a.consumed);
  const topItems = consumed.slice(0, 5);
  // Menos utilizados: os que tiveram algum consumo, do menor para o maior.
  const bottomItems = [...consumed].reverse().slice(0, 5);

  const showFood = modules.includes(ModuleType.FOOD);
  const showMaterial = modules.includes(ModuleType.SCHOOL_MATERIAL);
  const maxCategory = Math.max(...categories.map((c) => c.consumed), 1);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Painel analítico</h1>
          <p className="mt-1 text-sm text-slate-600">
            Consumo, alertas e utilização do estoque da sua escola nos últimos {days} dias.
          </p>
        </div>

        <nav aria-label="Período de análise" className="flex gap-1 rounded-lg bg-slate-100 p-1">
          {PERIODS.map((p) => (
            <a
              key={p}
              href={`/dashboard?periodo=${p}`}
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

      {/* ---------------- Indicadores ---------------- */}
      <section aria-labelledby="kpis">
        <h2 id="kpis" className="sr-only">
          Indicadores gerais
        </h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {showFood && (
            <KpiCard label="Produtos de merenda" value={kpis.itemsFood} tone="info" />
          )}
          {showMaterial && (
            <KpiCard label="Materiais escolares" value={kpis.itemsMaterial} tone="info" />
          )}
          <KpiCard
            label="Saídas no período"
            value={round(kpis.consumedQty)}
            hint={`${kpis.movements} movimentações`}
          />
          <KpiCard label="Entradas no período" value={round(kpis.receivedQty)} tone="good" />
          <KpiCard
            label="Estoque baixo"
            value={kpis.lowStock}
            tone={kpis.lowStock > 0 ? 'warn' : 'default'}
            hint="abaixo do mínimo"
          />
          <KpiCard
            label="Sem estoque"
            value={kpis.outOfStock}
            tone={kpis.outOfStock > 0 ? 'danger' : 'default'}
          />
          {showFood && (
            <>
              <KpiCard
                label="Próximos do vencimento"
                value={kpis.nearExpiry}
                tone={kpis.nearExpiry > 0 ? 'warn' : 'default'}
                hint={`até ${nearExpiryDays} dias`}
              />
              <KpiCard
                label="Lotes vencidos"
                value={kpis.expired}
                tone={kpis.expired > 0 ? 'danger' : 'default'}
              />
            </>
          )}
          {kpis.lossQty > 0 && (
            <KpiCard
              label="Perdas e avarias"
              value={round(kpis.lossQty)}
              tone="danger"
              hint="no período"
            />
          )}
        </div>
      </section>

      {/* ---------------- Consumo ---------------- */}
      <section aria-labelledby="consumo" className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 id="consumo" className="font-semibold text-slate-900">
          Análise de consumo
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Entradas e saídas por dia. Compare o ritmo de reposição com o de utilização.
        </p>
        <div className="mt-4">
          <ConsumptionChart data={series} days={days} />
        </div>

        {categories.length > 0 && (
          <div className="mt-6 border-t border-slate-100 pt-4">
            <h3 className="text-sm font-semibold text-slate-900">Consumo por categoria</h3>
            <ul className="mt-3 space-y-2">
              {categories.slice(0, 8).map((c) => (
                <li key={`${c.module}-${c.category}`} className="flex items-center gap-3">
                  <span className="w-40 shrink-0 truncate text-xs text-slate-600">{c.category}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <span
                      className="block h-full bg-brand-500"
                      style={{ width: `${Math.max(2, (c.consumed / maxCategory) * 100)}%` }}
                    />
                  </span>
                  <span className="w-16 shrink-0 text-right text-xs font-medium text-slate-700">
                    {round(c.consumed)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* ---------------- Alertas ---------------- */}
      <section aria-labelledby="alertas">
        <h2 id="alertas" className="font-semibold text-slate-900">
          Alertas de estoque baixo
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Itens abaixo do estoque mínimo, do mais crítico ao menos crítico.
        </p>
        <div className="mt-3">
          <LowStockPanel alerts={lowStock} />
        </div>
      </section>

      {/* ---------------- Análise inteligente ---------------- */}
      <section aria-labelledby="inteligente">
        <h2 id="inteligente" className="font-semibold text-slate-900">
          Análise inteligente de utilização
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Previsão de ruptura, concentração do consumo e capital parado.
        </p>
        <div className="mt-3">
          <SmartPanel analysis={analysis} riskDays={RISK_DAYS} />
        </div>
      </section>

      {/* ---------------- Ranking ---------------- */}
      <section aria-labelledby="ranking" className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <h2 id="ranking" className="sr-only">
          Produtos mais e menos utilizados
        </h2>
        <UsageRanking
          items={topItems}
          title="Produtos mais utilizados"
          description={`Maior volume de saída nos últimos ${days} dias.`}
          emptyText="Nenhuma saída registrada no período."
        />
        <UsageRanking
          items={bottomItems}
          title="Produtos menos utilizados"
          description="Menor volume de saída entre os que tiveram movimento."
          emptyText="Nenhuma saída registrada no período."
          variant="bottom"
        />
      </section>
    </div>
  );
}

function round(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
