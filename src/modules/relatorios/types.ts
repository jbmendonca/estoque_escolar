// Contrato comum dos relatórios: um dataset neutro de formato.
// A geração (consulta) é totalmente separada da apresentação (web/PDF/Excel).

export type ColumnAlign = 'left' | 'right' | 'center';

export interface ReportColumn {
  key: string;
  header: string;
  align?: ColumnAlign;
  /** Largura relativa usada nas exportações (Excel/PDF). */
  width?: number;
}

export type ReportCell = string | number | null;

export interface ReportDataset {
  /** Título exibido no cabeçalho do relatório. */
  title: string;
  /** Subtítulo com o escopo (escola/módulo). */
  subtitle: string;
  /** Descrição dos filtros aplicados, para constar na exportação. */
  filtersDescription: string[];
  columns: ReportColumn[];
  rows: Array<Record<string, ReportCell>>;
  /** Linha de totais/resumo (opcional). */
  summary?: Array<{ label: string; value: string }>;
  generatedAt: Date;
  generatedBy: string;
}

export const REPORT_FORMATS = ['json', 'csv', 'xlsx', 'pdf'] as const;
export type ReportFormat = (typeof REPORT_FORMATS)[number];

export const REPORT_TYPES = ['movimentacao', 'saldo'] as const;
export type ReportType = (typeof REPORT_TYPES)[number];
