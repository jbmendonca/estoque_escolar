'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function SchoolForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [address, setAddress] = useState('');
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/schools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, code, address: address || undefined }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setMessage({ kind: 'err', text: body?.error?.message ?? 'Não foi possível cadastrar.' });
        return;
      }
      setMessage({ kind: 'ok', text: `Escola "${body.name}" cadastrada.` });
      setName('');
      setCode('');
      setAddress('');
      router.refresh();
    } catch {
      setMessage({ kind: 'err', text: 'Erro de conexão. Tente novamente.' });
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        + Nova escola
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 max-w-2xl space-y-4 rounded-xl border border-slate-200 bg-white p-6"
    >
      <h2 className="font-semibold text-slate-900">Nova escola</h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="school-name" className="block text-sm font-medium text-slate-700">
            Nome
          </label>
          <input
            id="school-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="school-code" className="block text-sm font-medium text-slate-700">
            Código
          </label>
          <input
            id="school-code"
            required
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Ex.: ESC-002"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <label htmlFor="school-address" className="block text-sm font-medium text-slate-700">
          Endereço (opcional)
        </label>
        <input
          id="school-address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
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

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? 'Salvando...' : 'Cadastrar escola'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
