'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { REQUEST_STATUS_LABEL } from '@/modules/compras/constants';
import type { PurchaseRequestStatus } from '@/modules/shared/enums';

/** Rótulo do botão de cada etapa do fluxo. */
const ACTION_LABEL: Partial<Record<PurchaseRequestStatus, string>> = {
  APROVADA: 'Aprovar',
  REJEITADA: 'Rejeitar',
  COMPRADA: 'Marcar como comprada',
  RECEBIDA: 'Confirmar recebimento',
  CANCELADA: 'Cancelar',
};

const DESTRUCTIVE: PurchaseRequestStatus[] = ['REJEITADA', 'CANCELADA'];

/**
 * Botões de avanço do fluxo da solicitação.
 * As opções vêm do servidor já filtradas pelas permissões do usuário — o
 * servidor valida novamente a cada requisição.
 */
export function RequestActions({
  requestId,
  actions,
}: {
  requestId: string;
  actions: PurchaseRequestStatus[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState<PurchaseRequestStatus | null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (actions.length === 0) {
    return <p className="text-xs text-slate-500">Nenhuma ação disponível para você nesta etapa.</p>;
  }

  async function send(status: PurchaseRequestStatus, reason?: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/purchases/requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ...(reason ? { note: reason } : {}) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error?.message ?? 'Não foi possível atualizar a solicitação.');
        return;
      }
      setPending(null);
      setNote('');
      router.refresh();
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  function handleClick(status: PurchaseRequestStatus) {
    // Rejeitar e cancelar exigem motivo: abre o campo antes de enviar.
    if (DESTRUCTIVE.includes(status)) {
      setPending(status);
      return;
    }
    void send(status);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {actions.map((status) => (
          <button
            key={status}
            type="button"
            disabled={loading}
            onClick={() => handleClick(status)}
            className={
              DESTRUCTIVE.includes(status)
                ? 'rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60'
                : 'rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60'
            }
          >
            {ACTION_LABEL[status] ?? REQUEST_STATUS_LABEL[status]}
          </button>
        ))}
      </div>

      {pending && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <label
            htmlFor={`motivo-${requestId}`}
            className="block text-sm font-medium text-slate-700"
          >
            Motivo {ACTION_LABEL[pending]?.toLowerCase()} <span className="text-red-600">*</span>
          </label>
          <textarea
            id={`motivo-${requestId}`}
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={loading || note.trim().length < 3}
              onClick={() => send(pending, note)}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
            >
              Confirmar
            </button>
            <button
              type="button"
              onClick={() => setPending(null)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-white"
            >
              Voltar
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
