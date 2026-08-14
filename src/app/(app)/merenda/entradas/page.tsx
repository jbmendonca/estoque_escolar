import { MovementPage } from '@/components/MovementPage';
import { ModuleType } from '@/modules/shared/enums';

export const dynamic = 'force-dynamic';

export default async function MerendaEntradasPage() {
  return (
    <MovementPage
      module={ModuleType.FOOD}
      title="Entrada de Alimentos"
      description="Registre o recebimento informando o lote e a data de validade."
      types={[{ value: 'ENTRADA', label: 'Entrada' }]}
      requiresBatch
    />
  );
}
