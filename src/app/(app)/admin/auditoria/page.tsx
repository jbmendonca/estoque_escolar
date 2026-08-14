import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/server/guard';
import { isAdmin } from '@/server/rbac';

export const dynamic = 'force-dynamic';

export default async function AuditoriaPage() {
  // Autorização no servidor: sem 'audit.view' a página nem carrega.
  const user = await requirePermission('audit.view');

  const logs = await prisma.auditLog.findMany({
    where: isAdmin(user) ? {} : { schoolId: { in: user.schoolIds } },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { user: { select: { name: true, email: true } } },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Auditoria</h1>
      <p className="mt-1 text-sm text-slate-600">
        Registro permanente das operações importantes do sistema.
      </p>

      {logs.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          Nenhum registro de auditoria encontrado.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2">Data/Hora</th>
                <th className="px-3 py-2">Usuário</th>
                <th className="px-3 py-2">Ação</th>
                <th className="px-3 py-2">Recurso</th>
                <th className="px-3 py-2">Identificador</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-500">
                    {l.createdAt.toLocaleString('pt-BR')}
                  </td>
                  <td className="px-3 py-2">{l.user?.name ?? '—'}</td>
                  <td className="px-3 py-2">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium">
                      {l.action}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{l.resource}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-400">
                    {l.resourceId ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
