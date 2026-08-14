import type { ReportDataset } from '@/modules/relatorios/types';

/** Renderização Web do dataset (mesma fonte de dados do PDF e do Excel). */
export function ReportTable({ dataset }: { dataset: ReportDataset }) {
  if (dataset.rows.length === 0) {
    return (
      <div className="mt-4 rounded-lg border border-dashed border-slate-300 p-8 text-center">
        <p className="text-sm text-slate-600">Nenhum registro encontrado para os filtros informados.</p>
        <p className="mt-1 text-xs text-slate-500">Ajuste o período ou os filtros e consulte novamente.</p>
      </div>
    );
  }

  return (
    <>
      {dataset.summary && dataset.summary.length > 0 && (
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {dataset.summary.map((s) => (
            <div key={s.label} className="rounded-lg border border-slate-200 bg-white p-3">
              <dt className="text-xs text-slate-500">{s.label}</dt>
              <dd className="mt-0.5 text-lg font-bold text-slate-900">{s.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <caption className="sr-only">{dataset.title}</caption>
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              {dataset.columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={`whitespace-nowrap px-3 py-2 ${c.align === 'right' ? 'text-right' : ''}`}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataset.rows.slice(0, 300).map((row, i) => (
              <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                {dataset.columns.map((c) => (
                  <td
                    key={c.key}
                    className={`px-3 py-2 ${c.align === 'right' ? 'text-right' : ''} ${
                      c.key === 'codigo' ? 'font-mono text-xs' : ''
                    }`}
                  >
                    {render(row[c.key], c.key)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs text-slate-500">
        {dataset.rows.length} {dataset.rows.length === 1 ? 'registro' : 'registros'}
        {dataset.rows.length > 300 && ' — exibindo os 300 primeiros na tela; a exportação traz todos'}
        {' · '}Emitido em {dataset.generatedAt.toLocaleString('pt-BR')} por {dataset.generatedBy}
      </p>
    </>
  );
}

function render(value: unknown, key: string) {
  if (value === null || value === undefined || value === '') return '—';
  if (key === 'situacao') {
    const text = String(value);
    const cls =
      text === 'Sem estoque'
        ? 'bg-red-100 text-red-700'
        : text === 'Abaixo do mínimo'
          ? 'bg-amber-100 text-amber-800'
          : 'bg-emerald-100 text-emerald-700';
    return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{text}</span>;
  }
  if (key === 'natureza') {
    const isIn = String(value) === 'Entrada';
    return (
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
          isIn ? 'bg-emerald-100 text-emerald-700' : 'bg-brand-100 text-brand-700'
        }`}
      >
        {String(value)}
      </span>
    );
  }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? value : value.toFixed(2).replace('.', ',');
  }
  return String(value);
}
