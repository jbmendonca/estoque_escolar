import type { SmartAnalysis } from '@/modules/dashboard/analytics-service';

/**
 * Análise inteligente de utilização do estoque:
 * - Risco de ruptura (o que vai acabar antes do prazo)
 * - Curva ABC (Pareto do consumo)
 * - Estoque parado (capital imobilizado sem giro)
 */
export function SmartPanel({ analysis, riskDays }: { analysis: SmartAnalysis; riskDays: number }) {
  const { abc, ruptureRisk, idleItems, turnover, activeRatio } = analysis;
  const abcTotal = abc.a.length + abc.b.length + abc.c.length;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* -------- Risco de ruptura -------- */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="font-semibold text-slate-900">Risco de ruptura</h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Itens cujo saldo deve acabar em até {riskDays} dias, no ritmo de consumo atual.
        </p>

        {ruptureRisk.length === 0 ? (
          <p className="mt-3 rounded-lg bg-emerald-50 p-4 text-center text-sm text-emerald-800">
            Nenhum item com previsão de ruptura no período.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {ruptureRisk.slice(0, 6).map((item) => {
              const dias = Math.floor(item.coverageDays);
              const urgente = dias <= 5;
              return (
                <li
                  key={item.itemId}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 p-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{item.name}</p>
                    <p className="text-xs text-slate-500">
                      saldo {round(item.balance)} {item.unit} · consome {item.dailyAvg.toFixed(1)}/dia
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                      urgente ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {dias === 0 ? 'hoje' : `${dias} dias`}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {ruptureRisk.length > 6 && (
          <p className="mt-2 text-xs text-slate-500">
            +{ruptureRisk.length - 6} outros itens em risco.
          </p>
        )}
      </section>

      {/* -------- Curva ABC + indicadores -------- */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="font-semibold text-slate-900">Curva ABC do consumo</h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Classificação de Pareto: poucos itens (A) concentram a maior parte do consumo.
        </p>

        <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-slate-100">
          <div
            className="bg-brand-600"
            style={{ width: `${pct(abc.a.length, abcTotal)}%` }}
            title={`Classe A: ${abc.a.length} itens`}
          />
          <div
            className="bg-brand-500/60"
            style={{ width: `${pct(abc.b.length, abcTotal)}%` }}
            title={`Classe B: ${abc.b.length} itens`}
          />
          <div
            className="bg-slate-300"
            style={{ width: `${pct(abc.c.length, abcTotal)}%` }}
            title={`Classe C: ${abc.c.length} itens`}
          />
        </div>

        <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
          <AbcBox label="A" count={abc.a.length} hint="80% do consumo" tone="text-brand-700" />
          <AbcBox label="B" count={abc.b.length} hint="15% seguintes" tone="text-brand-600" />
          <AbcBox label="C" count={abc.c.length} hint="baixo giro" tone="text-slate-500" />
        </dl>

        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
          <div>
            <p className="text-xs text-slate-500">Giro do estoque</p>
            <p className="text-lg font-bold text-slate-900">{turnover.toFixed(2)}x</p>
            <p className="text-xs text-slate-400">consumo ÷ saldo</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Itens com movimento</p>
            <p className="text-lg font-bold text-slate-900">{Math.round(activeRatio * 100)}%</p>
            <p className="text-xs text-slate-400">do catálogo ativo</p>
          </div>
        </div>

        {abc.a.length > 0 && (
          <p className="mt-3 rounded-lg bg-brand-50 p-2.5 text-xs text-brand-700">
            <strong>Priorize a classe A:</strong> {abc.a.length}{' '}
            {abc.a.length === 1 ? 'item concentra' : 'itens concentram'} a maior parte do consumo —
            são os que não podem faltar.
          </p>
        )}
      </section>

      {/* -------- Estoque parado -------- */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-2">
        <h3 className="font-semibold text-slate-900">Estoque parado</h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Itens com saldo em estoque e nenhuma saída no período — risco de vencimento e de compra
          desnecessária.
        </p>

        {idleItems.length === 0 ? (
          <p className="mt-3 rounded-lg bg-emerald-50 p-4 text-center text-sm text-emerald-800">
            Todo o estoque com saldo teve movimento no período.
          </p>
        ) : (
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {idleItems.slice(0, 9).map((item) => (
              <li key={item.itemId} className="rounded-lg border border-slate-100 p-2.5">
                <p className="truncate text-sm font-medium text-slate-900">{item.name}</p>
                <p className="text-xs text-slate-500">
                  {round(item.balance)} {item.unit} parados · {item.categoryName}
                </p>
              </li>
            ))}
          </ul>
        )}
        {idleItems.length > 9 && (
          <p className="mt-2 text-xs text-slate-500">
            +{idleItems.length - 9} outros itens sem movimento.
          </p>
        )}
      </section>
    </div>
  );
}

function AbcBox({
  label,
  count,
  hint,
  tone,
}: {
  label: string;
  count: number;
  hint: string;
  tone: string;
}) {
  return (
    <div className="rounded-lg bg-slate-50 p-2">
      <dt className={`text-xs font-semibold ${tone}`}>Classe {label}</dt>
      <dd className="text-lg font-bold text-slate-900">{count}</dd>
      <dd className="text-xs text-slate-400">{hint}</dd>
    </div>
  );
}

function pct(part: number, total: number): number {
  return total > 0 ? (part / total) * 100 : 0;
}

function round(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}
