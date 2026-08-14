import type { ItemUsage } from '@/modules/dashboard/analytics-service';

/** Ranking de itens por consumo, com barra proporcional ao maior valor. */
export function UsageRanking({
  items,
  title,
  description,
  emptyText,
  variant = 'top',
}: {
  items: ItemUsage[];
  title: string;
  description: string;
  emptyText: string;
  variant?: 'top' | 'bottom';
}) {
  const max = Math.max(...items.map((i) => i.consumed), 1);
  const barColor = variant === 'top' ? 'bg-brand-500' : 'bg-slate-400';

  return (
    <section>
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <p className="mt-0.5 text-xs text-slate-500">{description}</p>

      {items.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          {emptyText}
        </p>
      ) : (
        <ol className="mt-3 space-y-2">
          {items.map((item, index) => (
            <li key={item.itemId} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 text-sm">
                  <span className="mr-1.5 text-xs font-medium text-slate-400">{index + 1}.</span>
                  <span className="font-medium text-slate-900">{item.name}</span>
                  <span className="ml-1.5 font-mono text-xs text-slate-400">{item.code}</span>
                </p>
                <p className="shrink-0 text-sm font-semibold text-slate-900">
                  {round(item.consumed)}
                  <span className="ml-1 text-xs font-normal text-slate-500">{item.unit}</span>
                </p>
              </div>

              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full ${barColor}`}
                  style={{ width: `${Math.max(2, (item.consumed / max) * 100)}%` }}
                />
              </div>

              <p className="mt-1 text-xs text-slate-500">
                {item.categoryName} · saldo {round(item.balance)} {item.unit}
                {item.consumed > 0 && ` · média ${item.dailyAvg.toFixed(1)}/dia`}
                {item.coverageDays !== null && ` · cobertura ${Math.floor(item.coverageDays)} dias`}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function round(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}
