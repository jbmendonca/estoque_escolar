// Ponto único de geração de relatórios: escolhe o dataset e o formato de saída.
import { AppError } from '@/lib/errors';
import { toCsv } from '@/modules/relatorios/export-csv';
import { toXlsx } from '@/modules/relatorios/export-xlsx';
import { toPdf } from '@/modules/relatorios/export-pdf';
import type { ReportDataset, ReportFormat } from '@/modules/relatorios/types';

export interface RenderedReport {
  body: string | Buffer;
  contentType: string;
  extension: string;
}

/** Converte o dataset (neutro) no formato solicitado. */
export async function renderReport(
  dataset: ReportDataset,
  format: ReportFormat,
): Promise<RenderedReport> {
  switch (format) {
    case 'csv':
      return {
        body: toCsv(dataset),
        contentType: 'text/csv; charset=utf-8',
        extension: 'csv',
      };
    case 'xlsx':
      return {
        body: await toXlsx(dataset),
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        extension: 'xlsx',
      };
    case 'pdf':
      return {
        body: await toPdf(dataset),
        contentType: 'application/pdf',
        extension: 'pdf',
      };
    case 'json':
      return {
        body: JSON.stringify(dataset),
        contentType: 'application/json; charset=utf-8',
        extension: 'json',
      };
    default:
      throw new AppError('BAD_REQUEST', 'Formato de exportação não suportado.');
  }
}

/** Nome de arquivo previsível: relatorio-saldo-merenda-2026-08-14.xlsx */
export function reportFilename(base: string, extension: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  const slug = base
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return `${slug}-${stamp}.${extension}`;
}

export * from '@/modules/relatorios/types';
