'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatQuantity } from '@/lib/number';
import { categoryGroupLabel } from '@/modules/compras/constants';
import type { PurchaseSuggestion } from '@/modules/compras/purchase-domain';
import { PriorityBadge, HealthBadge } from '@/components/compras/Badges';

export type SuggestionRow = PurchaseSuggestion;

/**
 * Lista de compras inteligente: o usuário marca os itens, ajusta a quantidade
 * se quiser e gera a lista de compras. A quantidade sugerida já considera
 * estoque atual, estoque mínimo, consumo médio e o que já foi solicitado.
 */
export function SuggestionTable({
  suggestions,
  module,
  canGenerate,
  days,
}: {
  suggestions: SuggestionRow[];
  module: 'FOOD' | 'SCHOOL_MATERIAL';
  canGenerate: boolean;
  days: number;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const totalSelected = selected.size;
  const highPriority = useMemo(
    () => suggestions.filter((s) => s.priority === 'ALTA').map((s) => s.itemId),
    [suggestions],
  );

  function toggle(itemId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(suggestions.map((s) => s.itemId)));
  }

  function selectCritical() {
    setSelected(new Set(highPriority));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function quantityOf(row: SuggestionRow): number {
    const raw = quantities[row.itemId];
    if (raw === undefined || raw === '') return row.suggestedQty;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : row.suggestedQty;
  }

  async function handleGenerate() {
    setLoading(true);
    setMessage(null);

    const items = suggestions
      .filter((s) => selected.has(s.itemId))
      .map((s) => ({ itemId: s.itemId, quantity: quantityOf(s) }));

    if (items.some((i) => !(i.quantity > 0))) {
      setMessage({
        kind: 'err',
        text: 'Informe uma quantidade maior que zero em todos os itens selecionados.',
      });
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/purchases/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module, days, items, ...(title ? { title } : {}) }),
      });
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        setMessage({
          kind: 'err',
          text: body?.error?.message ?? 'Não foi possível gerar a lista de compras.',
        });
        return;
      }

      router.push(`/compras/listas/${body.id}`);
      router.refresh();
    } catch {
      setMessage({ kind: 'err', text: 'Erro de conexão. Tente novamente.' });
    } finally {
      setLoading(false);
    }
  }

  if (suggestions.length === 0) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-center">
        <p className="text-sm font-medium text-emerald-800">Nenhuma reposição necessária.</p>
        <p className="mt-1 text-xs text-emerald-700">
          Todos os itens estão acima do estoque mínimo e com cobertura suficiente.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={selectAll} className={SECONDARY_BTN}>
          Selecionar todos ({suggestions.length})
        </button>
        <button type="button" onClick={selectCritical} className={SECONDARY_BTN}>
          Somente prioridade alta ({highPriority.length})
        </button>
        <button type="button" onClick={clearSelection} className={SECONDARY_BTN}>
          Limpar seleção
        </button>
        <span className="text-xs text-slate-500">{totalSelected} item(ns) selecionado(s)</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <caption className="sr-only">
            Materiais abaixo do estoque mínimo e sugestão de compra
          </caption>
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="w-10 px-3 py-2">
                <span className="sr-only">Selecionar</span>
              </th>
              <th className="px-3 py-2">Material</th>
              <th className="px-3 py-2">Grupo</th>
              <th className="px-3 py-2 text-right">Qtd. atual</th>
              <th className="px-3 py-2 text-right">Mínimo</th>
              <th className="px-3 py-2 text-right">Consumo/dia</th>
              <th className="px-3 py-2 text-right">Previsão</th>
              <th className="px-3 py-2 text-right">Sugestão</th>
              <th className="px-3 py-2">Prioridade</th>
            </tr>
          </thead>
          <tbody>
            {suggestions.map((s) => (
              <tr key={s.itemId} className="border-t border-slate-100 align-top">
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selected.has(s.itemId)}
                    onChange={() => toggle(s.itemId)}
                    aria-label={`Selecionar ${s.name}`}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                </td>
                <td className="px-3 py-2">
                  <span className="font-mono text-xs text-slate-500">{s.code}</span>{' '}
                  <span className="font-medium text-slate-900">{s.name}</span>
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs text-brand-700">
                      Por que comprar?
                    </summary>
                    <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
                      {s.messages.map((m) => (
                        <li key={m}>• {m}</li>
                      ))}
                    </ul>
                  </details>
                </td>
                <td className="px-3 py-2 text-xs text-slate-600">
                  {categoryGroupLabel(s.categoryGroup)}
                  <span className="block text-slate-400">{s.categoryName}</span>
                </td>
                <td className="px-3 py-2 text-right">
                  <span className="font-medium">{formatQuantity(s.balance)}</span>{' '}
                  <span className="text-xs text-slate-500">{s.unit}</span>
                  <span className="mt-1 block">
                    <HealthBadge health={s.health} />
                  </span>
                </td>
                <td className="px-3 py-2 text-right text-slate-500">
                  {formatQuantity(s.minStock)}
                </td>
                <td className="px-3 py-2 text-right text-slate-600">
                  {formatQuantity(Number(s.dailyAvg.toFixed(2)))}
                </td>
                <td className="px-3 py-2 text-right text-slate-600">
                  {s.coverageDays === null ? '—' : `${Math.floor(s.coverageDays)} dias`}
                </td>
                <td className="px-3 py-2 text-right">
                  <label className="sr-only" htmlFor={`qtd-${s.itemId}`}>
                    Quantidade a comprar de {s.name}
                  </label>
                  <input
                    id={`qtd-${s.itemId}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={quantities[s.itemId] ?? String(s.suggestedQty)}
                    onChange={(e) =>
                      setQuantities((prev) => ({ ...prev, [s.itemId]: e.target.value }))
                    }
                    className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-right text-sm"
                  />
                  <span className="ml-1 text-xs text-slate-500">{s.unit}</span>
                  {s.pendingQty > 0 && (
                    <span className="block text-xs text-amber-700">
                      {formatQuantity(s.pendingQty)} já solicitad(a/o)s
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <PriorityBadge priority={s.priority} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {message && (
        <p
          role="alert"
          className={`rounded-lg px-3 py-2 text-sm ${
            message.kind === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'
          }`}
        >
          {message.text}
        </p>
      )}

      {canGenerate ? (
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <div className="min-w-56 flex-1">
            <label htmlFor="titulo-lista" className="block text-sm font-medium text-slate-700">
              Título da lista (opcional)
            </label>
            <input
              id="titulo-lista"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Compra de merenda — setembro"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading || totalSelected === 0}
            className="rounded-lg bg-brand-600 px-5 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {loading ? 'Gerando...' : `Gerar lista de compras (${totalSelected})`}
          </button>
        </div>
      ) : (
        <p className="text-xs text-slate-500">
          Você pode consultar as sugestões, mas não possui autorização para gerar listas de compras.
        </p>
      )}
    </div>
  );
}

const SECONDARY_BTN =
  'rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50';
