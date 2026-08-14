import { AppError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { formatDateOnly } from '@/lib/date';
import { requireAuth } from '@/server/guard';
import { can, isAdmin } from '@/server/rbac';
import type { ModuleType } from '@/modules/shared/enums';

/** Histórico de movimentações (imutável) com saldo anterior/posterior e responsável. */
export async function MovementsList({ module, title }: { module: ModuleType; title: string }) {
  const user = await requireAuth();
  const schoolId = user.schoolIds[0];

  if (!can(user, 'movement.view', { schoolId, module })) {
    throw new AppError('FORBIDDEN', 'Você não possui autorização para ver estas movimentações.');
  }

  const movements = await prisma.stockMovement.findMany({
    where: {
      module,
      ...(isAdmin(user) ? {} : { schoolId: { in: user.schoolIds } }),
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      user: { select: { name: true } },
      items: {
        include: {
          item: { select: { name: true, code: true } },
          foodBatch: { select: { batchNumber: true, expiryDate: true } },
        },
      },
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
      <p className="mt-1 text-sm text-slate-600">
        Registro permanente — cada linha guarda o saldo anterior e o saldo resultante.
      </p>

      {movements.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          Nenhuma movimentação registrada ainda.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2">Número</th>
                <th className="px-3 py-2">Data/Hora</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Item</th>
                <th className="px-3 py-2">Lote</th>
                <th className="px-3 py-2 text-right">Qtd.</th>
                <th className="px-3 py-2 text-right">Saldo ant.</th>
                <th className="px-3 py-2 text-right">Saldo post.</th>
                <th className="px-3 py-2">Responsável</th>
              </tr>
            </thead>
            <tbody>
              {movements.flatMap((m) =>
                m.items.map((line) => (
                  <tr key={line.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-mono text-xs">{m.number}</td>
                    <td className="px-3 py-2 text-slate-500">
                      {m.createdAt.toLocaleString('pt-BR')}
                    </td>
                    <td className="px-3 py-2">{m.type}</td>
                    <td className="px-3 py-2">
                      <span className="font-mono text-xs text-slate-500">{line.item.code}</span>{' '}
                      {line.item.name}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">
                      {line.foodBatch
                        ? `${line.foodBatch.batchNumber} · ${formatDateOnly(line.foodBatch.expiryDate)}`
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-right">{Number(line.quantity)}</td>
                    <td className="px-3 py-2 text-right text-slate-500">
                      {Number(line.previousBalance)}
                    </td>
                    <td className="px-3 py-2 text-right font-medium">{Number(line.newBalance)}</td>
                    <td className="px-3 py-2 text-slate-600">{m.user.name}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
