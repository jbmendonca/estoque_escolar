import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/server/current-user';

// Página autenticada (lê a sessão): sempre renderizada sob demanda, nunca
// pré-renderizada no build — assim não depende de SESSION_SECRET em build time.
export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await getCurrentUser();
  redirect(user ? '/dashboard' : '/login');
}
