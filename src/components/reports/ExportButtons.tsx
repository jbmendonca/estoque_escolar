/** Links de exportação — o navegador baixa o arquivo gerado pelo servidor. */
export function ExportButtons({ reportType, query }: { reportType: string; query: string }) {
  const base = `/api/reports/${reportType}?${query}`;

  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={`${base}&format=pdf`}
        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        Exportar PDF
      </a>
      <a
        href={`${base}&format=xlsx`}
        className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
      >
        Exportar Excel
      </a>
      <a
        href={`${base}&format=csv`}
        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
      >
        CSV
      </a>
    </div>
  );
}
