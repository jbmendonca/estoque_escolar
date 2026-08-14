'use client';

import Link from 'next/link';

/** Tela amigável para erros (inclusive 403 de autorização negada no servidor). */
export default function AppError({ error }: { error: Error & { digest?: string } }) {
  const isForbidden = /autoriza|permiss/i.test(error.message);

  return (
    <div className="mx-auto max-w-lg rounded-xl border border-slate-200 bg-white p-8 text-center">
      <h1 className="text-xl font-bold text-slate-900">
        {isForbidden ? 'Acesso não autorizado' : 'Ocorreu um erro'}
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        {isForbidden
          ? 'Você não possui autorização para acessar esta área. Fale com o administrador se acredita que isso é um engano.'
          : 'Não foi possível concluir a operação. Tente novamente.'}
      </p>
      <Link
        href="/dashboard"
        className="mt-6 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        Voltar ao Dashboard
      </Link>
    </div>
  );
}
