import Link from 'next/link';
import type { ModuleType } from '@/modules/shared/enums';

export interface StockRow {
  id: string;
  code: string;
  name: string;
  categoryName: string;
  unit: string;
  location: string | null;
  quantity: number;
  minStock: number;
  active: boolean;
  characteristics: Array<{ key: string; value: string }>;
}

function StatusBadge({ quantity, minStock }: { quantity: number; minStock: number }) {
  if (quantity <= 0) {
    return (
      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
        Sem estoque
      </span>
    );
  }
  if (minStock > 0 && quantity < minStock) {
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
        Estoque baixo
      </span>
    );
  }
  return (
    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
      Normal
    </span>
  );
}

export function StockTable({
  rows,
  page,
  totalPages,
  total,
  basePath,
  module: _module,
  query,
}: {
  rows: StockRow[];
  page: number;
  totalPages: number;
  total: number;
  basePath: string;
  module: ModuleType;
  query: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="mt-4 rounded-lg border border-dashed border-slate-300 p-8 text-center">
        <p className="text-sm text-slate-600">Nenhum item encontrado.</p>
        <p className="mt-1 text-xs text-slate-500">
          Ajuste a busca ou cadastre um novo item para começar.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2">Código</th>
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">Categoria</th>
              <th className="px-3 py-2">Local</th>
              <th className="px-3 py-2 text-right">Saldo</th>
              <th className="px-3 py-2 text-right">Mínimo</th>
              <th className="px-3 py-2">Situação</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2 font-mono text-xs">{r.code}</td>
                <td className="px-3 py-2">
                  <span className="font-medium text-slate-900">{r.name}</span>
                  {r.characteristics.length > 0 && (
                    <span className="mt-0.5 block text-xs text-slate-500">
                      {r.characteristics.map((c) => `${c.key}: ${c.value}`).join(' · ')}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-slate-600">{r.categoryName}</td>
                <td className="px-3 py-2 font-mono text-xs text-slate-500">{r.location ?? '—'}</td>
                <td className="px-3 py-2 text-right font-medium">
                  {r.quantity} <span className="text-xs text-slate-500">{r.unit}</span>
                </td>
                <td className="px-3 py-2 text-right text-slate-500">{r.minStock}</td>
                <td className="px-3 py-2">
                  <StatusBadge quantity={r.quantity} minStock={r.minStock} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
        <p>
          {total} {total === 1 ? 'item' : 'itens'} · página {page} de {totalPages}
        </p>
        <div className="flex gap-2">
          {page > 1 && (
            <Link
              href={`${basePath}?${query}&page=${page - 1}`}
              className="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-100"
            >
              Anterior
            </Link>
          )}
          {page < totalPages && (
            <Link
              href={`${basePath}?${query}&page=${page + 1}`}
              className="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-100"
            >
              Próxima
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
