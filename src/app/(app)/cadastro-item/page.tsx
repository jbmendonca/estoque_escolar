import { prisma } from '@/lib/prisma';
import { requirePermission, resolveSchoolId } from '@/server/guard';
import { ModuleType } from '@/modules/shared/enums';
import { ItemForm } from '@/components/ItemForm';

export const dynamic = 'force-dynamic';

function parseModule(value?: string): ModuleType {
  return value === ModuleType.SCHOOL_MATERIAL ? ModuleType.SCHOOL_MATERIAL : ModuleType.FOOD;
}

export default async function CadastroItemPage({
  searchParams,
}: {
  searchParams: Promise<{ module?: string }>;
}) {
  const user = await requirePermission('item.create');
  const sp = await searchParams;
  const initialModule = parseModule(sp.module);

  // Categorias e unidades da escola alvo (a mesma onde o item será criado).
  const schoolId = resolveSchoolId(user);
  const [categories, units] = await Promise.all([
    prisma.category.findMany({
      where: { active: true, schoolId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, module: true },
    }),
    prisma.unitOfMeasure.findMany({
      where: { active: true, schoolId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, abbreviation: true },
    }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Cadastrar item</h1>
      <p className="mt-1 text-sm text-slate-600">
        Formulário único para <strong>Merenda Escolar</strong> e{' '}
        <strong>Material Escolar</strong>. Escolha o tipo, e a categoria se ajusta automaticamente.
        Cada item recebe um código único e entra no estoque com saldo zero.
      </p>

      <ItemForm categories={categories} units={units} initialModule={initialModule} />
    </div>
  );
}
