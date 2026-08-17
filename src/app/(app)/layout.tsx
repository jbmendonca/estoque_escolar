import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser, getCurrentUserProfile } from '@/server/current-user';
import { visibleNavigation } from '@/modules/shared/navigation';
import { LogoutButton } from '@/components/LogoutButton';

// Toda a área autenticada é renderizada sob demanda (lê sessão/cookies); nunca
// pré-renderizada no build, portanto não exige segredos em build time.
export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const profile = await getCurrentUserProfile();
  const sections = visibleNavigation(user, user.schoolIds[0]);
  const initials = (profile?.name ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="w-full shrink-0 border-b border-slate-200 bg-white lg:w-64 lg:border-b-0 lg:border-r">
        <div className="p-4">
          <p className="text-sm font-bold text-brand-700">Estoque Escolar</p>
          <Link
            href="/perfil"
            title="Meu perfil"
            className="mt-2 flex items-center gap-2 rounded-lg p-1 hover:bg-slate-50"
          >
            {profile?.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt="Foto de perfil"
                className="h-9 w-9 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
                {initials || '?'}
              </span>
            )}
            <span className="min-w-0">
              <span className="block truncate text-xs font-medium text-slate-700">
                {profile?.name}
              </span>
              <span className="block truncate text-xs text-slate-400">{user.roles.join(', ')}</span>
            </span>
          </Link>
        </div>

        <nav aria-label="Menu principal" className="px-2 pb-4">
          {sections.map((section) => (
            <div key={section.title} className="mb-4">
              <p className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {section.title}
              </p>
              <ul className="mt-1 space-y-0.5">
                {section.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="block rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-brand-50 hover:text-brand-700"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="px-4 pb-4">
          <LogoutButton />
        </div>
      </aside>

      <main className="flex-1 p-4 lg:p-8">{children}</main>
    </div>
  );
}
