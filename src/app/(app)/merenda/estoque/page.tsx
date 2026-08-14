import { StockPage } from '@/components/StockPage';
import { ModuleType } from '@/modules/shared/enums';

export const dynamic = 'force-dynamic';

export default async function MerendaEstoquePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; sort?: string }>;
}) {
  const params = await searchParams;
  return (
    <StockPage
      module={ModuleType.FOOD}
      title="Estoque — Merenda Escolar"
      basePath="/merenda/estoque"
      searchParams={params}
    />
  );
}
