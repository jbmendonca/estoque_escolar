'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface PerfilTenant {
  role: string;
  label: string;
  hint: string;
  required?: boolean;
}

/** Perfis provisionados junto com a escola. O admin do tenant é obrigatório. */
const PERFIS: PerfilTenant[] = [
  {
    role: 'ADMIN_ESCOLA',
    label: 'Administrador da Escola',
    hint: 'Gerencia usuários e cadastros apenas desta escola',
    required: true,
  },
  { role: 'GESTOR_ESCOLAR', label: 'Gestor Escolar', hint: 'Acompanha indicadores e aprova ajustes' },
  { role: 'SECRETARIO', label: 'Secretário', hint: 'Cadastra itens e registra entradas/saídas' },
  { role: 'MERENDEIRA', label: 'Merendeira', hint: 'Acesso exclusivo ao módulo de Merenda' },
  {
    role: 'ASSISTENTE_ALUNO',
    label: 'Assistente de Aluno',
    hint: 'Acesso exclusivo ao módulo de Materiais',
  },
];

type UserDraft = { enabled: boolean; name: string; email: string; password: string };

const emptyDraft = (): UserDraft => ({ enabled: false, name: '', email: '', password: '' });

export function TenantForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [address, setAddress] = useState('');
  const [drafts, setDrafts] = useState<Record<string, UserDraft>>(() =>
    Object.fromEntries(
      PERFIS.map((p) => [p.role, { ...emptyDraft(), enabled: Boolean(p.required) }]),
    ),
  );
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  function update(role: string, patch: Partial<UserDraft>) {
    setDrafts((d) => ({ ...d, [role]: { ...d[role]!, ...patch } }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const users = PERFIS.filter((p) => drafts[p.role]?.enabled).map((p) => ({
      role: p.role,
      name: drafts[p.role]!.name,
      email: drafts[p.role]!.email,
      password: drafts[p.role]!.password,
    }));

    try {
      const res = await fetch('/api/schools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, code, address: address || undefined, users }),
      });
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        setMessage({
          kind: 'err',
          text: body?.error?.message ?? 'Não foi possível criar a escola.',
        });
        return;
      }

      setMessage({
        kind: 'ok',
        text: `Escola "${body.school?.name ?? name}" criada com ${body.users?.length ?? 0} usuário(s), categorias e unidades padrão.`,
      });
      setName('');
      setCode('');
      setAddress('');
      setDrafts(
        Object.fromEntries(
          PERFIS.map((p) => [p.role, { ...emptyDraft(), enabled: Boolean(p.required) }]),
        ),
      );
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
      className="mt-4 space-y-5 rounded-xl border border-slate-200 bg-white p-6"
    >
      <div>
        <h2 className="font-semibold text-slate-900">Nova escola</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          A escola é criada com estoque próprio e isolado, categorias e unidades de medida padrão,
          e os usuários informados — todos com acesso restrito a esta escola.
        </p>
      </div>

      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <legend className="mb-2 text-sm font-medium text-slate-700">Dados da escola</legend>
        <div className="sm:col-span-2">
          <label htmlFor="t-name" className="block text-sm font-medium text-slate-700">
            Nome da escola
          </label>
          <input
            id="t-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: EMEF Monte Cristo"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="t-code" className="block text-sm font-medium text-slate-700">
            Código
          </label>
          <input
            id="t-code"
            required
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Ex.: BV-001"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="sm:col-span-3">
          <label htmlFor="t-address" className="block text-sm font-medium text-slate-700">
            Endereço (opcional)
          </label>
          <input
            id="t-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-slate-700">Usuários da escola</legend>
        {PERFIS.map((p) => {
          const draft = drafts[p.role]!;
          return (
            <div
              key={p.role}
              className={`rounded-lg border p-3 ${
                draft.enabled ? 'border-brand-200 bg-brand-50/40' : 'border-slate-200'
              }`}
            >
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={draft.enabled}
                  disabled={p.required}
                  onChange={(e) => update(p.role, { enabled: e.target.checked })}
                />
                <span>
                  <span className="text-sm font-medium text-slate-900">
                    {p.label}
                    {p.required && <span className="ml-1 text-xs text-brand-700">(obrigatório)</span>}
                  </span>
                  <span className="block text-xs text-slate-500">{p.hint}</span>
                </span>
              </label>

              {draft.enabled && (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <input
                    required
                    aria-label={`Nome do ${p.label}`}
                    placeholder="Nome completo"
                    value={draft.name}
                    onChange={(e) => update(p.role, { name: e.target.value })}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <input
                    required
                    type="email"
                    aria-label={`E-mail do ${p.label}`}
                    placeholder="email@escola.gov.br"
                    value={draft.email}
                    onChange={(e) => update(p.role, { email: e.target.value })}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <input
                    required
                    type="password"
                    minLength={8}
                    autoComplete="new-password"
                    aria-label={`Senha inicial do ${p.label}`}
                    placeholder="Senha inicial (8+)"
                    value={draft.password}
                    onChange={(e) => update(p.role, { password: e.target.value })}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              )}
            </div>
          );
        })}
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
          {loading ? 'Criando escola...' : 'Criar escola'}
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
