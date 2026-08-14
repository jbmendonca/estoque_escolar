'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Option {
  id: string;
  name: string;
  code?: string;
}

export function UserForm({ roles, schools }: { roles: Option[]; schools: Option[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [schoolIds, setSchoolIds] = useState<string[]>([]);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  function toggle(list: string[], setList: (v: string[]) => void, id: string) {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, roleIds, schoolIds }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setMessage({ kind: 'err', text: body?.error?.message ?? 'Não foi possível cadastrar.' });
        return;
      }
      setMessage({ kind: 'ok', text: `Usuário "${body.name}" cadastrado.` });
      setName('');
      setEmail('');
      setPassword('');
      setRoleIds([]);
      setSchoolIds([]);
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
        + Novo usuário
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 max-w-3xl space-y-4 rounded-xl border border-slate-200 bg-white p-6"
    >
      <h2 className="font-semibold text-slate-900">Novo usuário</h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="user-name" className="block text-sm font-medium text-slate-700">
            Nome
          </label>
          <input
            id="user-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="user-email" className="block text-sm font-medium text-slate-700">
            E-mail
          </label>
          <input
            id="user-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <label htmlFor="user-password" className="block text-sm font-medium text-slate-700">
          Senha inicial
        </label>
        <input
          id="user-password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-slate-500">Mínimo de 8 caracteres.</p>
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-slate-700">Perfis de acesso</legend>
        <div className="mt-2 flex flex-wrap gap-3">
          {roles.map((r) => (
            <label key={r.id} className="flex items-center gap-1.5 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={roleIds.includes(r.id)}
                onChange={() => toggle(roleIds, setRoleIds, r.id)}
              />
              {r.name}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium text-slate-700">Escolas vinculadas</legend>
        <div className="mt-2 flex flex-wrap gap-3">
          {schools.map((s) => (
            <label key={s.id} className="flex items-center gap-1.5 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={schoolIds.includes(s.id)}
                onChange={() => toggle(schoolIds, setSchoolIds, s.id)}
              />
              {s.name}
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-slate-500">
          O Administrador tem acesso global e não depende deste vínculo.
        </p>
      </fieldset>

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
          {loading ? 'Salvando...' : 'Cadastrar usuário'}
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
