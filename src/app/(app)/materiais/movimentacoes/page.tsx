import { MovementsList } from '@/components/MovementsList';
import { ModuleType } from '@/modules/shared/enums';

export const dynamic = 'force-dynamic';

export default async function MateriaisMovimentacoesPage() {
  return (
    <MovementsList module={ModuleType.SCHOOL_MATERIAL} title="Movimentações — Materiais Escolares" />
  );
}
