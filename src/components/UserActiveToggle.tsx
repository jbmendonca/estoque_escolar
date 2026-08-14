'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Ativa/inativa um usuário. Nunca exclui — o histórico precisa ser preservado. */
export function UserActiveToggle({ userId, active }: { userId: string; active: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !active }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error?.message ?? 'Não foi possível alterar.');
        return;
      }
      router.refresh();
    } catch {
      setError('Erro de conexão.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        disabled={loading}
        className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-60"
      >
        {loading ? '...' : active ? 'Inativar' : 'Ativar'}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
