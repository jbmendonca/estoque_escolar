'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LIST_STATUS_LABEL } from '@/modules/compras/constants';
import type { PurchaseListStatus } from '@/modules/shared/enums';

const ACTION_LABEL: Partial<Record<PurchaseListStatus, string>> = {
  ENVIADA: 'Marcar como enviada',
  CONCLUIDA: 'Concluir lista',
  CANCELADA: 'Cancelar lista',
};

/** Muda a situação da lista de compras (aberta → enviada → concluída). */
export function ListStatusActions({
  listId,
  actions,
}: {
  listId: string;
  actions: PurchaseListStatus[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (actions.length === 0) return null;

  async function send(status: PurchaseListStatus) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/purchases/lists/${listId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error?.message ?? 'Não foi possível atualizar a lista.');
        return;
      }
      router.refresh();
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {actions.map((status) => (
          <button
            key={status}
            type="button"
            disabled={loading}
            onClick={() => send(status)}
            className={
              status === 'CANCELADA'
                ? 'rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60'
                : 'rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60'
            }
          >
            {ACTION_LABEL[status] ?? LIST_STATUS_LABEL[status]}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
