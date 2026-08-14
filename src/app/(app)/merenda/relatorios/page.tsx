import { ReportsPage, type ReportsSearchParams } from '@/components/reports/ReportsPage';
import { ModuleType } from '@/modules/shared/enums';

export const dynamic = 'force-dynamic';

export default async function MerendaRelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<ReportsSearchParams>;
}) {
  const params = await searchParams;
  return (
    <ReportsPage
      module={ModuleType.FOOD}
      title="Relatórios — Merenda Escolar"
      basePath="/merenda/relatorios"
      searchParams={params}
    />
  );
}
