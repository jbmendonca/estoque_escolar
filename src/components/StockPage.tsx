import Link from 'next/link';
import { AppError } from '@/lib/errors';
import { listItems } from '@/modules/catalogo/item-service';
import { requireAuth } from '@/server/guard';
import { can, isAdmin } from '@/server/rbac';
import { StockTable, type StockRow } from '@/components/StockTable';
import type { ModuleType } from '@/modules/shared/enums';

/**
 * Página de estoque compartilhada entre Merenda e Materiais.
 * A autorização é verificada NO SERVIDOR pelo módulo — a Merendeira não
 * consegue abrir /materiais/estoque nem o Assistente /merenda/estoque.
 */
export async function StockPage({
  module,
  title,
  basePath,
  searchParams,
}: {
  module: ModuleType;
  title: string;
  basePath: string;
  searchParams: { q?: string; page?: string; sort?: string };
}) {
  const user = await requireAuth();
  const schoolId = user.schoolIds[0];

  if (!can(user, 'item.view', { schoolId, module })) {
    throw new AppError('FORBIDDEN', 'Você não possui autorização para acessar este módulo.');
  }

  const q = searchParams.q ?? '';
  const page = Number(searchParams.page ?? 1);
  const sort = searchParams.sort ?? 'name:asc';

  const result = await listItems({
    schoolIds: isAdmin(user) ? undefined : user.schoolIds,
    module,
    q: q || undefined,
    page,
    pageSize: 20,
    sort,
  });

  const rows: StockRow[] = result.data.map((i) => ({
    id: i.id,
    code: i.code,
    name: i.name,
    categoryName: i.category.name,
    unit: i.unitOfMeasure.abbreviation,
    location: i.storageLocation?.code ?? null,
    quantity: Number(i.stock?.quantity ?? 0),
    minStock: Number(i.minStock),
    active: i.active,
    characteristics: i.characteristics,
  }));

  const canCreate = can(user, 'item.create', { schoolId, module });

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          <p className="mt-1 text-sm text-slate-600">
            Itens em ordem alfabética. Busca, filtros e paginação são feitos no servidor.
          </p>
        </div>
        {canCreate && (
          <Link
            href={`/cadastro-item?module=${module}`}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            + Cadastrar item
          </Link>
        )}
      </div>

      <form method="get" action={basePath} className="mt-4 flex flex-wrap gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Buscar por nome ou código..."
          aria-label="Buscar itens"
          className="min-w-56 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          name="sort"
          defaultValue={sort}
          aria-label="Ordenação"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="name:asc">Nome (A-Z)</option>
          <option value="name:desc">Nome (Z-A)</option>
          <option value="code:asc">Código</option>
        </select>
        <button
          type="submit"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Buscar
        </button>
      </form>

      <StockTable
        rows={rows}
        page={result.page}
        totalPages={result.totalPages}
        total={result.total}
        basePath={basePath}
        module={module}
        query={`q=${encodeURIComponent(q)}&sort=${sort}`}
      />
    </div>
  );
}
