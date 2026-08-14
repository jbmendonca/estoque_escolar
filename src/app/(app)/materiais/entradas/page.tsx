import { MovementPage } from '@/components/MovementPage';
import { ModuleType } from '@/modules/shared/enums';

export const dynamic = 'force-dynamic';

export default async function MateriaisEntradasPage() {
  return (
    <MovementPage
      module={ModuleType.SCHOOL_MATERIAL}
      title="Entrada de Materiais"
      description="Registre o recebimento de materiais escolares no estoque."
      types={[
        { value: 'ENTRADA', label: 'Entrada' },
        { value: 'DEVOLUCAO', label: 'Devolução' },
      ]}
      requiresBatch={false}
    />
  );
}
