import { AppError } from '@/lib/errors';
import { listItems } from '@/modules/catalogo/item-service';
import { requireAuth } from '@/server/guard';
import { can, isAdmin } from '@/server/rbac';
import { MovementForm, type ItemOption } from '@/components/MovementForm';
import type { ModuleType } from '@/modules/shared/enums';

/** Carrega os itens do módulo e renderiza o formulário, validando permissão no servidor. */
export async function MovementPage({
  module,
  title,
  description,
  types,
  requiresBatch,
  showDistribution,
}: {
  module: ModuleType;
  title: string;
  description: string;
  types: Array<{ value: string; label: string }>;
  requiresBatch: boolean;
  showDistribution?: boolean;
}) {
  const user = await requireAuth();
  const schoolId = user.schoolIds[0];

  if (!can(user, 'movement.create', { schoolId, module })) {
    throw new AppError('FORBIDDEN', 'Você não possui autorização para movimentar este módulo.');
  }

  const result = await listItems({
    schoolIds: isAdmin(user) ? undefined : user.schoolIds,
    module,
    pageSize: 100,
    sort: 'name:asc',
  });

  const items: ItemOption[] = result.data.map((i) => ({
    id: i.id,
    code: i.code,
    name: i.name,
    unit: i.unitOfMeasure.abbreviation,
    quantity: Number(i.stock?.quantity ?? 0),
  }));

  return (
    <MovementForm
      module={module}
      items={items}
      types={types}
      title={title}
      description={description}
      requiresBatch={requiresBatch}
      showDistribution={showDistribution}
    />
  );
}
