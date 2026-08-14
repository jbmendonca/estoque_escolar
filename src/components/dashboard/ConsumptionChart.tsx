import type { ConsumptionPoint } from '@/modules/dashboard/analytics-service';

/**
 * Gráfico de barras entrada x saída por dia, em SVG puro (sem biblioteca externa).
 * Acessível: descrito por <title> e com tabela textual alternativa para leitores de tela.
 */
export function ConsumptionChart({ data, days }: { data: ConsumptionPoint[]; days: number }) {
  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center">
        <p className="text-sm text-slate-600">Sem movimentações no período.</p>
        <p className="mt-1 text-xs text-slate-500">
          Registre entradas e saídas para acompanhar o consumo aqui.
        </p>
      </div>
    );
  }

  const max = Math.max(...data.map((d) => Math.max(d.entrada, d.saida)), 1);
  const width = 720;
  const height = 200;
  const padLeft = 8;
  const padBottom = 24;
  const usableH = height - padBottom;
  const slot = (width - padLeft * 2) / data.length;
  const barW = Math.max(2, Math.min(14, slot / 2.6));

  const fmt = (iso: string) => {
    const [, m, d] = iso.split('-');
    return `${d}/${m}`;
  };
  // Mostra no máximo ~8 rótulos no eixo X para não poluir.
  const labelStep = Math.max(1, Math.ceil(data.length / 8));

  return (
    <figure>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-52 w-full"
        role="img"
        aria-label={`Entradas e saídas por dia nos últimos ${days} dias`}
      >
        <title>Entradas e saídas por dia nos últimos {days} dias</title>
        {/* linha de base */}
        <line x1={0} y1={usableH} x2={width} y2={usableH} stroke="#cbd5e1" strokeWidth={1} />

        {data.map((d, i) => {
          const x = padLeft + i * slot + slot / 2;
          const hIn = (d.entrada / max) * (usableH - 8);
          const hOut = (d.saida / max) * (usableH - 8);
          return (
            <g key={d.day}>
              <rect
                x={x - barW - 1}
                y={usableH - hIn}
                width={barW}
                height={hIn}
                rx={2}
                fill="#10b981"
              >
                <title>{`${fmt(d.day)} — entrada: ${d.entrada}`}</title>
              </rect>
              <rect x={x + 1} y={usableH - hOut} width={barW} height={hOut} rx={2} fill="#1d6fb8">
                <title>{`${fmt(d.day)} — saída: ${d.saida}`}</title>
              </rect>
              {i % labelStep === 0 && (
                <text
                  x={x}
                  y={height - 6}
                  textAnchor="middle"
                  fontSize={10}
                  fill="#64748b"
                >
                  {fmt(d.day)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <figcaption className="mt-2 flex flex-wrap gap-4 text-xs text-slate-600">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Entradas
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-brand-500" /> Saídas
        </span>
        <span className="text-slate-400">Máximo no período: {max}</span>
      </figcaption>
    </figure>
  );
}
