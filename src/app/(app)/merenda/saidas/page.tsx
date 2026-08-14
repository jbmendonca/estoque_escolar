import { MovementPage } from '@/components/MovementPage';
import { ModuleType } from '@/modules/shared/enums';

export const dynamic = 'force-dynamic';

export default async function MerendaSaidasPage() {
  return (
    <MovementPage
      module={ModuleType.FOOD}
      title="Saída de Alimentos"
      description="O sistema consome automaticamente os lotes que vencem primeiro (FEFO)."
      types={[
        { value: 'CONSUMO', label: 'Consumo' },
        { value: 'PREPARO_MERENDA', label: 'Preparo de merenda' },
        { value: 'PERDA', label: 'Perda' },
        { value: 'PRODUTO_VENCIDO', label: 'Produto vencido' },
        { value: 'AVARIA', label: 'Avaria' },
        { value: 'AJUSTE', label: 'Ajuste' },
      ]}
      requiresBatch={false}
    />
  );
}
