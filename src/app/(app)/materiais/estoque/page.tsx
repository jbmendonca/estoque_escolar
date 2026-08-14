import { StockPage } from '@/components/StockPage';
import { ModuleType } from '@/modules/shared/enums';

export const dynamic = 'force-dynamic';

export default async function MateriaisEstoquePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; sort?: string }>;
}) {
  const params = await searchParams;
  return (
    <StockPage
      module={ModuleType.SCHOOL_MATERIAL}
      title="Estoque — Materiais Escolares"
      basePath="/materiais/estoque"
      searchParams={params}
    />
  );
}
