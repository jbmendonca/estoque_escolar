'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CATEGORY_GROUP_LABEL, PRIORITY_LABEL } from '@/modules/compras/constants';
import type { CategoryGroup, PurchasePriority } from '@/modules/shared/enums';

export interface RequestItemOption {
  id: string;
  code: string;
  name: string;
  unit: string;
  quantity: number;
}

/** Formulário de solicitação de aquisição (funcionário/professor). */
export function PurchaseRequestForm({
  modules,
  items,
  groups,
}: {
  modules: Array<{ value: 'FOOD' | 'SCHOOL_MATERIAL'; label: string }>;
  /** Itens do catálogo por módulo, para o solicitante escolher. */
  items: Record<string, RequestItemOption[]>;
  groups: Record<string, CategoryGroup[]>;
}) {
  const router = useRouter();
  const [module, setModule] = useState(modules[0]?.value ?? 'SCHOOL_MATERIAL');
  const [itemId, setItemId] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [categoryGroup, setCategoryGroup] = useState<string>('');
  const [quantity, setQuantity] = useState('');
  const [priority, setPriority] = useState<PurchasePriority>('MEDIA');
  const [justification, setJustification] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const moduleItems = items[module] ?? [];
  const moduleGroups = groups[module] ?? [];
  const selected = moduleItems.find((i) => i.id === itemId);
  const isFreeText = itemId === '';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const payload = {
      module,
      quantity: Number(quantity),
      justification,
      priority,
      ...(itemId ? { itemId } : { itemDescription }),
      ...(categoryGroup ? { categoryGroup } : {}),
    };

    try {
      const res = await fetch('/api/purchases/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        setMessage({
          kind: 'err',
          text: body?.error?.message ?? 'Não foi possível registrar a solicitação.',
        });
        return;
      }

      setMessage({
        kind: 'ok',
        text: `Solicitação ${body.number} registrada e aguardando aprovação.`,
      });
      setQuantity('');
      setJustification('');
      setItemDescription('');
      router.refresh();
    } catch {
      setMessage({ kind: 'err', text: 'Erro de conexão. Tente novamente.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-slate-200 bg-white p-6"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="modulo" className="block text-sm font-medium text-slate-700">
            Módulo
          </label>
          <select
            id="modulo"
            value={module}
            onChange={(e) => {
              setModule(e.target.value as typeof module);
              setItemId('');
              setCategoryGroup('');
            }}
            className={FIELD}
          >
            {modules.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="item" className="block text-sm font-medium text-slate-700">
            Material
          </label>
          <select
            id="item"
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
            className={FIELD}
          >
            <option value="">— Material ainda não cadastrado —</option>
            {moduleItems.map((i) => (
              <option key={i.id} value={i.id}>
                {i.code} — {i.name} (saldo: {i.quantity} {i.unit})
              </option>
            ))}
          </select>
        </div>
      </div>

      {isFreeText && (
        <div className="grid grid-cols-1 gap-4 rounded-lg bg-slate-50 p-4 sm:grid-cols-2">
          <div>
            <label htmlFor="descricao" className="block text-sm font-medium text-slate-700">
              Descreva o material <span className="text-red-600">*</span>
            </label>
            <input
              id="descricao"
              required
              value={itemDescription}
              onChange={(e) => setItemDescription(e.target.value)}
              placeholder="Ex.: Papel A4 75g, resma com 500 folhas"
              className={FIELD}
            />
          </div>
          <div>
            <label htmlFor="grupo" className="block text-sm font-medium text-slate-700">
              Categoria
            </label>
            <select
              id="grupo"
              value={categoryGroup}
              onChange={(e) => setCategoryGroup(e.target.value)}
              className={FIELD}
            >
              <option value="">— Não informar —</option>
              {moduleGroups.map((g) => (
                <option key={g} value={g}>
                  {CATEGORY_GROUP_LABEL[g]}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="quantidade" className="block text-sm font-medium text-slate-700">
            Quantidade {selected ? `(${selected.unit})` : ''}{' '}
            <span className="text-red-600">*</span>
          </label>
          <input
            id="quantidade"
            type="number"
            min="0.01"
            step="0.01"
            required
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className={FIELD}
          />
        </div>
        <div>
          <label htmlFor="prioridade" className="block text-sm font-medium text-slate-700">
            Prioridade
          </label>
          <select
            id="prioridade"
            value={priority}
            onChange={(e) => setPriority(e.target.value as PurchasePriority)}
            className={FIELD}
          >
            {(['ALTA', 'MEDIA', 'BAIXA'] as const).map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="justificativa" className="block text-sm font-medium text-slate-700">
          Justificativa <span className="text-red-600">*</span>
        </label>
        <textarea
          id="justificativa"
          required
          rows={3}
          minLength={5}
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
          placeholder="Ex.: material necessário para as atividades do 3º bimestre da turma 5º A"
          className={FIELD}
        />
        <p className="mt-1 text-xs text-slate-500">
          A justificativa fica registrada no histórico junto com quem solicitou e quem aprovou.
        </p>
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

      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-brand-600 px-5 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {loading ? 'Enviando...' : 'Enviar solicitação'}
      </button>
    </form>
  );
}

const FIELD = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm';
