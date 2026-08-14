import type { LowStockAlert } from '@/modules/dashboard/analytics-service';

const SEVERITY_STYLE: Record<LowStockAlert['severity'], { label: string; className: string }> = {
  ZERADO: { label: 'Zerado', className: 'bg-red-100 text-red-700' },
  CRITICO: { label: 'Crítico', className: 'bg-orange-100 text-orange-800' },
  BAIXO: { label: 'Baixo', className: 'bg-amber-100 text-amber-800' },
};

/** Alertas de estoque abaixo do mínimo, do mais crítico para o menos crítico. */
export function LowStockPanel({ alerts }: { alerts: LowStockAlert[] }) {
  if (alerts.length === 0) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-center">
        <p className="text-sm font-medium text-emerald-800">
          Nenhum item abaixo do estoque mínimo.
        </p>
        <p className="mt-1 text-xs text-emerald-700">Todos os níveis estão adequados.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <caption className="sr-only">Itens com estoque abaixo do mínimo</caption>
        <thead className="bg-slate-50 text-left text-slate-600">
          <tr>
            <th className="px-3 py-2">Item</th>
            <th className="px-3 py-2 text-right">Saldo</th>
            <th className="px-3 py-2 text-right">Mínimo</th>
            <th className="px-3 py-2">Nível</th>
            <th className="px-3 py-2 text-right">Cobertura</th>
            <th className="px-3 py-2">Situação</th>
          </tr>
        </thead>
        <tbody>
          {alerts.slice(0, 12).map((a) => {
            const style = SEVERITY_STYLE[a.severity];
            return (
              <tr key={a.itemId} className="border-t border-slate-100">
                <td className="px-3 py-2">
                  <span className="font-mono text-xs text-slate-500">{a.code}</span>{' '}
                  <span className="font-medium text-slate-900">{a.name}</span>
                  <span className="block text-xs text-slate-500">{a.categoryName}</span>
                </td>
                <td className="px-3 py-2 text-right font-medium">
                  {round(a.balance)} <span className="text-xs text-slate-500">{a.unit}</span>
                </td>
                <td className="px-3 py-2 text-right text-slate-500">{round(a.minStock)}</td>
                <td className="px-3 py-2">
                  <div
                    className="h-2 w-24 overflow-hidden rounded-full bg-slate-200"
                    role="img"
                    aria-label={`${Math.round(a.minPercent)}% do estoque mínimo`}
                  >
                    <div
                      className={
                        a.severity === 'ZERADO'
                          ? 'h-full bg-red-500'
                          : a.severity === 'CRITICO'
                            ? 'h-full bg-orange-500'
                            : 'h-full bg-amber-500'
                      }
                      style={{ width: `${Math.min(100, Math.max(2, a.minPercent))}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-500">{Math.round(a.minPercent)}% do mínimo</span>
                </td>
                <td className="px-3 py-2 text-right text-slate-600">
                  {a.coverageDays === null ? '—' : `${Math.floor(a.coverageDays)} dias`}
                </td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style.className}`}>
                    {style.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {alerts.length > 12 && (
        <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
          Exibindo os 12 mais críticos de {alerts.length} itens abaixo do mínimo.
        </p>
      )}
    </div>
  );
}

function round(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}
