'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export interface ItemOption {
  id: string;
  code: string;
  name: string;
  unit: string;
  quantity: number;
}

const JUSTIFICATION_TYPES = ['PERDA', 'AVARIA', 'PRODUTO_VENCIDO', 'AJUSTE'];

export function MovementForm({
  module,
  items,
  types,
  title,
  description,
  requiresBatch,
  showDistribution = false,
}: {
  module: 'FOOD' | 'SCHOOL_MATERIAL';
  items: ItemOption[];
  types: Array<{ value: string; label: string }>;
  title: string;
  description: string;
  requiresBatch: boolean;
  showDistribution?: boolean;
}) {
  const router = useRouter();
  const [itemId, setItemId] = useState(items[0]?.id ?? '');
  const [type, setType] = useState(types[0]?.value ?? '');
  const [quantity, setQuantity] = useState('');
  const [justification, setJustification] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [target, setTarget] = useState('');
  const [targetLabel, setTargetLabel] = useState('');
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const needsJustification = JUSTIFICATION_TYPES.includes(type);
  const selected = items.find((i) => i.id === itemId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const payload: Record<string, unknown> = {
      module,
      type,
      items: [
        {
          itemId,
          quantity: Number(quantity),
          ...(requiresBatch && batchNumber
            ? { batchInput: { batchNumber, expiryDate } }
            : {}),
        },
      ],
      ...(needsJustification ? { justification } : {}),
      ...(showDistribution && target ? { distributionTarget: target, distributionTargetLabel: targetLabel } : {}),
    };

    try {
      const res = await fetch('/api/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        setMessage({
          kind: 'err',
          text: body?.error?.message ?? 'Não foi possível registrar a movimentação.',
        });
        return;
      }

      const line = body?.lines?.[0];
      setMessage({
        kind: 'ok',
        text: `Movimentação ${body.number} registrada. Saldo anterior: ${line?.previousBalance ?? '—'} → novo saldo: ${line?.newBalance ?? '—'}.`,
      });
      setQuantity('');
      setJustification('');
      setBatchNumber('');
      setExpiryDate('');
      router.refresh();
    } catch {
      setMessage({ kind: 'err', text: 'Erro de conexão. Tente novamente.' });
    } finally {
      setLoading(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center">
        <p className="text-sm text-slate-600">Nenhum item cadastrado neste módulo.</p>
        <p className="mt-1 text-xs text-slate-500">Cadastre um item antes de movimentar o estoque.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
      <p className="mt-1 text-sm text-slate-600">{description}</p>

      <form
        onSubmit={handleSubmit}
        className="mt-6 max-w-2xl space-y-4 rounded-xl border border-slate-200 bg-white p-6"
      >
        <div>
          <label htmlFor="item" className="block text-sm font-medium text-slate-700">
            Item
          </label>
          <select
            id="item"
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.code} — {i.name} (saldo: {i.quantity} {i.unit})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="type" className="block text-sm font-medium text-slate-700">
              Tipo de movimentação
            </label>
            <select
              id="type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {types.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="quantity" className="block text-sm font-medium text-slate-700">
              Quantidade {selected ? `(${selected.unit})` : ''}
            </label>
            <input
              id="quantity"
              type="number"
              min="0.01"
              step="0.01"
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        {requiresBatch && (
          <div className="grid grid-cols-1 gap-4 rounded-lg bg-slate-50 p-4 sm:grid-cols-2">
            <div>
              <label htmlFor="batch" className="block text-sm font-medium text-slate-700">
                Número do lote
              </label>
              <input
                id="batch"
                required
                value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="expiry" className="block text-sm font-medium text-slate-700">
                Data de validade
              </label>
              <input
                id="expiry"
                type="date"
                required
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <p className="text-xs text-slate-500 sm:col-span-2">
              Alimentos exigem lote e validade. Nas saídas, o sistema consome primeiro o lote que
              vence antes (FEFO).
            </p>
          </div>
        )}

        {showDistribution && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="target" className="block text-sm font-medium text-slate-700">
                Destino (opcional)
              </label>
              <select
                id="target"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">— Não informar —</option>
                <option value="ALUNO">Aluno</option>
                <option value="TURMA">Turma</option>
                <option value="PROFESSOR">Professor</option>
                <option value="SETOR">Setor</option>
                <option value="ATIVIDADE">Atividade</option>
                <option value="OUTRO">Outro</option>
              </select>
            </div>
            <div>
              <label htmlFor="targetLabel" className="block text-sm font-medium text-slate-700">
                Identificação do destino
              </label>
              <input
                id="targetLabel"
                value={targetLabel}
                onChange={(e) => setTargetLabel(e.target.value)}
                placeholder="Ex.: 5º A"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
        )}

        {needsJustification && (
          <div>
            <label htmlFor="justification" className="block text-sm font-medium text-slate-700">
              Justificativa <span className="text-red-600">*</span>
            </label>
            <textarea
              id="justification"
              required
              rows={2}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-slate-500">
              Obrigatória para perda, avaria, produto vencido e ajuste.
            </p>
          </div>
        )}

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

        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-brand-600 px-5 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? 'Registrando...' : 'Registrar movimentação'}
        </button>
      </form>
    </div>
  );
}
