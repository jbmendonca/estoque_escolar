import { ReportsPage, type ReportsSearchParams } from '@/components/reports/ReportsPage';
import { ModuleType } from '@/modules/shared/enums';

export const dynamic = 'force-dynamic';

export default async function MateriaisRelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<ReportsSearchParams>;
}) {
  const params = await searchParams;
  return (
    <ReportsPage
      module={ModuleType.SCHOOL_MATERIAL}
      title="Relatórios — Materiais Escolares"
      basePath="/materiais/relatorios"
      searchParams={params}
    />
  );
}
