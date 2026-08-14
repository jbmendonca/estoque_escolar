import { requirePermission } from '@/server/guard';
import { isSuperAdmin } from '@/server/rbac';
import { listSchools } from '@/modules/escolas/school-service';
import { TenantForm } from '@/components/TenantForm';

export const dynamic = 'force-dynamic';

export default async function EscolasPage() {
  // Autorização no servidor: sem 'school.manage' a página não carrega.
  const actor = await requirePermission('school.manage');
  const schools = await listSchools(actor);
  const podeCriarTenant = isSuperAdmin(actor);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Escolas</h1>
      <p className="mt-1 text-sm text-slate-600">
        Cada escola é um ambiente isolado: estoques, itens, movimentações e usuários pertencem
        somente a ela. Escolas com dados vinculados são inativadas, nunca excluídas.
      </p>

      {podeCriarTenant && <TenantForm />}

      <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2">Código</th>
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">Endereço</th>
              <th className="px-3 py-2 text-right">Usuários</th>
              <th className="px-3 py-2 text-right">Itens</th>
              <th className="px-3 py-2 text-right">Movimentações</th>
              <th className="px-3 py-2">Situação</th>
            </tr>
          </thead>
          <tbody>
            {schools.map((s) => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-mono text-xs">{s.code}</td>
                <td className="px-3 py-2 font-medium text-slate-900">{s.name}</td>
                <td className="px-3 py-2 text-slate-500">{s.address ?? '—'}</td>
                <td className="px-3 py-2 text-right">{s._count.users}</td>
                <td className="px-3 py-2 text-right">{s._count.items}</td>
                <td className="px-3 py-2 text-right">{s._count.movements}</td>
                <td className="px-3 py-2">
                  {s.active ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      Ativa
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
                      Inativa
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-sm text-slate-600">
        {schools.length} {schools.length === 1 ? 'escola cadastrada' : 'escolas cadastradas'}
      </p>
    </div>
  );
}
