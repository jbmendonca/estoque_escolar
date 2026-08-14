'use client';

import { useRouter } from 'next/navigation';

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
    >
      Sair
    </button>
  );
}
