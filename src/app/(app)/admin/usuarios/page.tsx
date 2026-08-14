import { requirePermission } from '@/server/guard';
import { listUsers, listRoles } from '@/modules/usuarios/user-service';
import { listSchools } from '@/modules/escolas/school-service';
import { UserForm } from '@/components/UserForm';
import { UserActiveToggle } from '@/components/UserActiveToggle';

export const dynamic = 'force-dynamic';

export default async function UsuariosPage() {
  const actor = await requirePermission('user.manage');
  // Tudo restrito ao escopo do solicitante (admin de escola vê só a sua).
  const [users, roles, schools] = await Promise.all([
    listUsers(actor),
    listRoles(actor),
    listSchools(actor),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Usuários</h1>
      <p className="mt-1 text-sm text-slate-600">
        Usuários com movimentações são inativados, nunca excluídos, preservando o histórico.
      </p>

      <UserForm
        roles={roles}
        schools={schools.map((s) => ({ id: s.id, name: s.name, code: s.code }))}
      />

      <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">E-mail</th>
              <th className="px-3 py-2">Perfis</th>
              <th className="px-3 py-2">Escolas</th>
              <th className="px-3 py-2 text-right">Movim.</th>
              <th className="px-3 py-2">Situação</th>
              <th className="px-3 py-2">Ação</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium text-slate-900">{u.name}</td>
                <td className="px-3 py-2 text-slate-600">{u.email}</td>
                <td className="px-3 py-2">
                  <span className="text-xs text-slate-600">
                    {u.roles.map((r) => r.role.name).join(', ') || '—'}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-slate-500">
                  {u.schools.map((s) => s.school.code).join(', ') || '—'}
                </td>
                <td className="px-3 py-2 text-right text-slate-500">{u._count.movements}</td>
                <td className="px-3 py-2">
                  {u.active ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      Ativo
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
                      Inativo
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {u.id === actor.id ? (
                    <span className="text-xs text-slate-400">você</span>
                  ) : (
                    <UserActiveToggle userId={u.id} active={u.active} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-sm text-slate-600">
        {users.length} {users.length === 1 ? 'usuário' : 'usuários'}
      </p>
    </div>
  );
}
