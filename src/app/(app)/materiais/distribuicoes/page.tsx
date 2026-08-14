import { MovementPage } from '@/components/MovementPage';
import { ModuleType } from '@/modules/shared/enums';

export const dynamic = 'force-dynamic';

export default async function MateriaisDistribuicoesPage() {
  return (
    <MovementPage
      module={ModuleType.SCHOOL_MATERIAL}
      title="Distribuição / Saída de Materiais"
      description="Informe opcionalmente o destino (aluno, turma, professor, setor ou atividade)."
      types={[
        { value: 'DISTRIBUICAO', label: 'Distribuição' },
        { value: 'SAIDA', label: 'Saída' },
        { value: 'PERDA', label: 'Perda' },
        { value: 'AVARIA', label: 'Avaria' },
        { value: 'AJUSTE', label: 'Ajuste' },
      ]}
      requiresBatch={false}
      showDistribution
    />
  );
}
