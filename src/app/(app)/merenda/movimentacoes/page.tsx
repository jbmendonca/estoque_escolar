import { MovementsList } from '@/components/MovementsList';
import { ModuleType } from '@/modules/shared/enums';

export const dynamic = 'force-dynamic';

export default async function MerendaMovimentacoesPage() {
  return <MovementsList module={ModuleType.FOOD} title="Movimentações — Merenda Escolar" />;
}
