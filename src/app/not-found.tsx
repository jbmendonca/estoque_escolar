import Link from 'next/link';

/** Página não encontrada — em português e com caminho de volta. */
export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="max-w-lg rounded-xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-4xl font-bold text-brand-600">404</p>
        <h1 className="mt-2 text-xl font-bold text-slate-900">Página não encontrada</h1>
        <p className="mt-2 text-sm text-slate-600">
          O endereço acessado não existe ou foi movido.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Ir para o Dashboard
        </Link>
      </div>
    </main>
  );
}
