import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser, getCurrentUserProfile } from '@/server/current-user';
import { visibleNavigation } from '@/modules/shared/navigation';
import { LogoutButton } from '@/components/LogoutButton';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const profile = await getCurrentUserProfile();
  const sections = visibleNavigation(user, user.schoolIds[0]);

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="w-full shrink-0 border-b border-slate-200 bg-white lg:w-64 lg:border-b-0 lg:border-r">
        <div className="p-4">
          <p className="text-sm font-bold text-brand-700">Estoque Escolar</p>
          <p className="mt-1 truncate text-xs text-slate-500">{profile?.name}</p>
          <p className="truncate text-xs text-slate-400">{user.roles.join(', ')}</p>
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
