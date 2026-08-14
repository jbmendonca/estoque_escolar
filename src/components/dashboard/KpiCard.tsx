const TONES = {
  default: 'border-slate-200 bg-white',
  good: 'border-emerald-200 bg-emerald-50',
  warn: 'border-amber-200 bg-amber-50',
  danger: 'border-red-200 bg-red-50',
  info: 'border-brand-100 bg-brand-50',
} as const;

export type Tone = keyof typeof TONES;

export function KpiCard({
  label,
  value,
  hint,
  tone = 'default',
  unit,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: Tone;
  unit?: string;
}) {
  return (
    <div className={`rounded-xl border p-4 ${TONES[tone]}`}>
      <p className="text-sm text-slate-600">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-slate-500">{unit}</span>}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
