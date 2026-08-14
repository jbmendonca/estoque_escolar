import { AppError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/server/guard';
import { can, isAdmin } from '@/server/rbac';
import { classifyExpiry } from '@/modules/lotes/expiry';
import { formatDateOnly } from '@/lib/date';
import { ExpiryStatus, ModuleType } from '@/modules/shared/enums';

export const dynamic = 'force-dynamic';

const NEAR_EXPIRY_DAYS = Number(process.env.NEAR_EXPIRY_DAYS_DEFAULT ?? 30);

function ExpiryBadge({ status }: { status: ExpiryStatus }) {
  if (status === ExpiryStatus.EXPIRED) {
    return (
      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
        Vencido
      </span>
    );
  }
  if (status === ExpiryStatus.NEAR_EXPIRY) {
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
        Próximo do vencimento
      </span>
    );
  }
  return (
    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
      No prazo
    </span>
  );
}

export default async function LotesPage() {
  const user = await requireAuth();
  const schoolId = user.schoolIds[0];

  if (!can(user, 'item.view', { schoolId, module: ModuleType.FOOD })) {
    throw new AppError('FORBIDDEN', 'Você não possui autorização para acessar a merenda.');
  }

  const batches = await prisma.foodBatch.findMany({
    where: {
      ...(isAdmin(user) ? {} : { schoolId: { in: user.schoolIds } }),
      active: true,
    },
    orderBy: { expiryDate: 'asc' }, // FEFO: o que vence antes aparece primeiro
    include: { item: { select: { code: true, name: true, unitOfMeasure: { select: { abbreviation: true } } } } },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Lotes e Validades</h1>
      <p className="mt-1 text-sm text-slate-600">
        Ordenado por validade (FEFO). Considera-se &quot;próximo do vencimento&quot; até{' '}
        {NEAR_EXPIRY_DAYS} dias.
      </p>

      {batches.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          Nenhum lote cadastrado. Registre uma entrada de alimento para criar lotes.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2">Produto</th>
                <th className="px-3 py-2">Lote</th>
                <th className="px-3 py-2">Validade</th>
                <th className="px-3 py-2 text-right">Saldo</th>
                <th className="px-3 py-2">Situação</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">
                    <span className="font-mono text-xs text-slate-500">{b.item.code}</span>{' '}
                    {b.item.name}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{b.batchNumber}</td>
                  <td className="px-3 py-2">{formatDateOnly(b.expiryDate)}</td>
                  <td className="px-3 py-2 text-right">
                    {Number(b.quantity)}{' '}
                    <span className="text-xs text-slate-500">
                      {b.item.unitOfMeasure.abbreviation}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <ExpiryBadge status={classifyExpiry(b.expiryDate, NEAR_EXPIRY_DAYS)} />
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
