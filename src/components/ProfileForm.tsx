'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Profile {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

type Feedback = { kind: 'ok' | 'err'; text: string } | null;

/** Redimensiona a imagem no navegador para um quadrado pequeno (data URI JPEG). */
function resizeToDataUrl(file: File, max = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Arquivo de imagem inválido.'));
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Não foi possível processar a imagem.'));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function Avatar({ src, name }: { src: string | null; name: string }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  if (src) {
    return <img src={src} alt="Foto de perfil" className="h-20 w-20 rounded-full object-cover" />;
  }
  return (
    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-100 text-xl font-semibold text-brand-700">
      {initials || '?'}
    </div>
  );
}

function Alert({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null;
  return (
    <p
      role="alert"
      className={`rounded-lg px-3 py-2 text-sm ${
        feedback.kind === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'
      }`}
    >
      {feedback.text}
    </p>
  );
}

const card = 'space-y-4 rounded-xl border border-slate-200 bg-white p-6';
const input = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm';
const label = 'block text-sm font-medium text-slate-700';
const primaryBtn =
  'rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60';

export function ProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();

  // --- Dados cadastrais ---
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [dataMsg, setDataMsg] = useState<Feedback>(null);
  const [dataLoading, setDataLoading] = useState(false);

  // --- Imagem de perfil ---
  const [avatar, setAvatar] = useState<string | null>(profile.avatarUrl);
  const [avatarMsg, setAvatarMsg] = useState<Feedback>(null);
  const [avatarLoading, setAvatarLoading] = useState(false);

  // --- Troca de senha ---
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwMsg, setPwMsg] = useState<Feedback>(null);
  const [pwLoading, setPwLoading] = useState(false);

  async function saveData(e: React.FormEvent) {
    e.preventDefault();
    setDataLoading(true);
    setDataMsg(null);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setDataMsg({ kind: 'err', text: body?.error?.message ?? 'Não foi possível salvar.' });
        return;
      }
      setDataMsg({ kind: 'ok', text: 'Dados atualizados.' });
      router.refresh();
    } catch {
      setDataMsg({ kind: 'err', text: 'Erro de conexão. Tente novamente.' });
    } finally {
      setDataLoading(false);
    }
  }

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite re-selecionar o mesmo arquivo
    if (!file) return;
    setAvatarMsg(null);
    setAvatarLoading(true);
    try {
      const dataUrl = await resizeToDataUrl(file);
      const res = await fetch('/api/profile/avatar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarUrl: dataUrl }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setAvatarMsg({ kind: 'err', text: body?.error?.message ?? 'Não foi possível salvar a foto.' });
        return;
      }
      setAvatar(body.avatarUrl ?? dataUrl);
      setAvatarMsg({ kind: 'ok', text: 'Foto atualizada.' });
      router.refresh();
    } catch (err) {
      setAvatarMsg({ kind: 'err', text: err instanceof Error ? err.message : 'Falha ao enviar a imagem.' });
    } finally {
      setAvatarLoading(false);
    }
  }

  async function removeImage() {
    setAvatarMsg(null);
    setAvatarLoading(true);
    try {
      const res = await fetch('/api/profile/avatar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarUrl: null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setAvatarMsg({ kind: 'err', text: body?.error?.message ?? 'Não foi possível remover a foto.' });
        return;
      }
      setAvatar(null);
      setAvatarMsg({ kind: 'ok', text: 'Foto removida.' });
      router.refresh();
    } catch {
      setAvatarMsg({ kind: 'err', text: 'Erro de conexão. Tente novamente.' });
    } finally {
      setAvatarLoading(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    if (newPassword !== confirmPassword) {
      setPwMsg({ kind: 'err', text: 'A confirmação não confere com a nova senha.' });
      return;
    }
    setPwLoading(true);
    try {
      const res = await fetch('/api/profile/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setPwMsg({ kind: 'err', text: body?.error?.message ?? 'Não foi possível trocar a senha.' });
        return;
      }
      setPwMsg({ kind: 'ok', text: 'Senha alterada com sucesso.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      setPwMsg({ kind: 'err', text: 'Erro de conexão. Tente novamente.' });
    } finally {
      setPwLoading(false);
    }
  }

  return (
    <div className="mt-4 grid max-w-3xl gap-6">
      {/* Imagem de perfil */}
      <section className={card}>
        <h2 className="font-semibold text-slate-900">Imagem de perfil</h2>
        <div className="flex items-center gap-4">
          <Avatar src={avatar} name={name || profile.name} />
          <div className="flex flex-wrap gap-2">
            <label className={`${primaryBtn} cursor-pointer ${avatarLoading ? 'opacity-60' : ''}`}>
              {avatarLoading ? 'Enviando…' : avatar ? 'Trocar foto' : 'Enviar foto'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                disabled={avatarLoading}
                onChange={onPickImage}
              />
            </label>
            {avatar && (
              <button
                type="button"
                onClick={removeImage}
                disabled={avatarLoading}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-60"
              >
                Remover
              </button>
            )}
          </div>
        </div>
        <p className="text-xs text-slate-500">
          A imagem é reduzida automaticamente para um quadrado pequeno. Formatos: PNG, JPEG ou WebP.
        </p>
        <Alert feedback={avatarMsg} />
      </section>

      {/* Dados cadastrais */}
      <form onSubmit={saveData} className={card}>
        <h2 className="font-semibold text-slate-900">Dados cadastrais</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="p-name" className={label}>
              Nome
            </label>
            <input
              id="p-name"
              required
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={input}
            />
          </div>
          <div>
            <label htmlFor="p-email" className={label}>
              E-mail (login)
            </label>
            <input
              id="p-email"
              type="email"
              required
              maxLength={160}
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={input}
            />
          </div>
        </div>
        <Alert feedback={dataMsg} />
        <div>
          <button type="submit" disabled={dataLoading} className={primaryBtn}>
            {dataLoading ? 'Salvando…' : 'Salvar dados'}
          </button>
        </div>
      </form>

      {/* Troca de senha */}
      <form onSubmit={changePassword} className={card}>
        <h2 className="font-semibold text-slate-900">Trocar senha</h2>
        <div>
          <label htmlFor="p-current" className={label}>
            Senha atual
          </label>
          <input
            id="p-current"
            type="password"
            required
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className={`${input} max-w-sm`}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="p-new" className={label}>
              Nova senha
            </label>
            <input
              id="p-new"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={input}
            />
            <p className="mt-1 text-xs text-slate-500">Mínimo de 8 caracteres.</p>
          </div>
          <div>
            <label htmlFor="p-confirm" className={label}>
              Confirmar nova senha
            </label>
            <input
              id="p-confirm"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={input}
            />
          </div>
        </div>
        <Alert feedback={pwMsg} />
        <div>
          <button type="submit" disabled={pwLoading} className={primaryBtn}>
            {pwLoading ? 'Alterando…' : 'Alterar senha'}
          </button>
        </div>
      </form>
    </div>
  );
}
