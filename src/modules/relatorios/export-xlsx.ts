// Exportação Excel (.xlsx) com cabeçalho, filtros aplicados, congelamento de painel,
// autofiltro e linha de resumo.
import ExcelJS from 'exceljs';
import type { ReportDataset } from '@/modules/relatorios/types';

export async function toXlsx(dataset: ReportDataset): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sistema de Controle de Estoque Escolar';
  wb.created = dataset.generatedAt;

  const ws = wb.addWorksheet('Relatório', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
  });

  const lastCol = dataset.columns.length;

  // ---- Cabeçalho ----
  const titleRow = ws.addRow([dataset.title]);
  titleRow.font = { bold: true, size: 14 };
  ws.mergeCells(titleRow.number, 1, titleRow.number, lastCol);

  const subtitleRow = ws.addRow([dataset.subtitle]);
  subtitleRow.font = { size: 11, color: { argb: 'FF475569' } };
  ws.mergeCells(subtitleRow.number, 1, subtitleRow.number, lastCol);

  for (const filter of dataset.filtersDescription) {
    const r = ws.addRow([filter]);
    r.font = { size: 10, color: { argb: 'FF64748B' } };
    ws.mergeCells(r.number, 1, r.number, lastCol);
  }

  const metaRow = ws.addRow([
    `Emitido em ${dataset.generatedAt.toLocaleString('pt-BR')} por ${dataset.generatedBy}`,
  ]);
  metaRow.font = { size: 9, italic: true, color: { argb: 'FF94A3B8' } };
  ws.mergeCells(metaRow.number, 1, metaRow.number, lastCol);

  ws.addRow([]);

  // ---- Cabeçalho da tabela ----
  const headerRow = ws.addRow(dataset.columns.map((c) => c.header));
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF155A97' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } } };
  });

  // ---- Dados ----
  for (const row of dataset.rows) {
    const values = dataset.columns.map((c) => {
      const v = row[c.key];
      return v === null || v === undefined ? '' : v;
    });
    const r = ws.addRow(values);
    r.eachCell((cell, colNumber) => {
      const col = dataset.columns[colNumber - 1];
      cell.alignment = { horizontal: col?.align ?? 'left', vertical: 'middle' };
      if (typeof cell.value === 'number') cell.numFmt = '#,##0.##';
    });
  }

  // Larguras e recursos de navegação
  ws.columns.forEach((col, i) => {
    col.width = dataset.columns[i]?.width ?? 16;
  });
  ws.views = [{ state: 'frozen', ySplit: headerRow.number }];
  ws.autoFilter = {
    from: { row: headerRow.number, column: 1 },
    to: { row: headerRow.number + dataset.rows.length, column: lastCol },
  };

  // ---- Resumo ----
  if (dataset.summary?.length) {
    ws.addRow([]);
    const resumo = ws.addRow(['Resumo']);
    resumo.font = { bold: true, size: 12 };
    for (const s of dataset.summary) {
      const r = ws.addRow([s.label, s.value]);
      r.getCell(1).font = { bold: true };
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
