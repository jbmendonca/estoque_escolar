// Exportação CSV (abre no Excel/LibreOffice).
// Usa ponto e vírgula + BOM UTF-8, padrão que o Excel em português reconhece.
import type { ReportDataset } from '@/modules/relatorios/types';

const SEP = ';';
const BOM = '﻿';

// Caracteres que, no início de uma célula, fazem o Excel/LibreOffice
// interpretá-la como fórmula (CSV formula / DDE injection).
const FORMULA_LEAD = /^[=+\-@\t\r]/;

/** Aplica as regras de citação do CSV (separador, aspas, quebras de linha). */
function quote(text: string): string {
  if (
    text.includes(SEP) ||
    text.includes('"') ||
    text.includes('\n') ||
    text.includes('\r')
  ) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/**
 * Escapa um valor de TEXTO para CSV, neutralizando injeção de fórmula:
 * células iniciadas por `= + - @` TAB ou CR são prefixadas com aspa simples,
 * que o Excel/LibreOffice tratam como texto literal.
 */
function escape(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  const safe = FORMULA_LEAD.test(text) ? `'${text}` : text;
  return quote(safe);
}

/** Números com vírgula decimal (gerados pelo sistema — sem risco de fórmula). */
function cell(value: unknown): string {
  if (typeof value === 'number') return quote(String(value).replace('.', ','));
  return escape(value);
}

export function toCsv(dataset: ReportDataset): string {
  const lines: string[] = [];

  lines.push(escape(dataset.title));
  lines.push(escape(dataset.subtitle));
  for (const f of dataset.filtersDescription) lines.push(escape(f));
  lines.push(
    escape(
      `Emitido em ${dataset.generatedAt.toLocaleString('pt-BR')} por ${dataset.generatedBy}`,
    ),
  );
  lines.push('');

  lines.push(dataset.columns.map((c) => escape(c.header)).join(SEP));
  for (const row of dataset.rows) {
    lines.push(dataset.columns.map((c) => cell(row[c.key])).join(SEP));
  }

  if (dataset.summary?.length) {
    lines.push('');
    lines.push(escape('Resumo'));
    for (const s of dataset.summary) {
      lines.push([escape(s.label), escape(s.value)].join(SEP));
    }
  }

  return BOM + lines.join('\r\n');
}
