// Exportação PDF (A4 paisagem) com cabeçalho, tabela paginada, resumo e rodapé numerado.
import PDFDocument from 'pdfkit';
import type { ReportDataset, ReportCell } from '@/modules/relatorios/types';

const MARGIN = 28;
const FONT = 'Helvetica';
const FONT_BOLD = 'Helvetica-Bold';

export function toPdf(dataset: ReportDataset): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: MARGIN });
    const chunks: Buffer[] = [];

    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width - MARGIN * 2;

    // Larguras proporcionais às definidas no dataset.
    const totalWeight = dataset.columns.reduce((acc, c) => acc + (c.width ?? 16), 0);
    const widths = dataset.columns.map((c) => ((c.width ?? 16) / totalWeight) * pageWidth);

    const drawHeader = () => {
      doc.font(FONT_BOLD).fontSize(14).fillColor('#0f172a').text(dataset.title, MARGIN, MARGIN);
      doc.font(FONT).fontSize(10).fillColor('#475569').text(dataset.subtitle);
      doc.fontSize(8).fillColor('#64748b');
      for (const f of dataset.filtersDescription) doc.text(f);
      doc.text(
        `Emitido em ${dataset.generatedAt.toLocaleString('pt-BR')} por ${dataset.generatedBy}`,
      );
      doc.moveDown(0.6);
    };

    const drawTableHeader = () => {
      const y = doc.y;
      doc.rect(MARGIN, y - 2, pageWidth, 16).fill('#155a97');
      doc.font(FONT_BOLD).fontSize(7.5).fillColor('#ffffff');
      let x = MARGIN;
      dataset.columns.forEach((col, i) => {
        const w = widths[i] ?? 40;
        doc.text(col.header, x + 3, y + 2, {
          width: w - 6,
          align: col.align === 'right' ? 'right' : 'left',
          lineBreak: false,
        });
        x += w;
      });
      doc.y = y + 18;
      doc.fillColor('#0f172a');
    };

    drawHeader();
    drawTableHeader();

    const bottomLimit = doc.page.height - MARGIN - 24;

    doc.font(FONT).fontSize(7);
    dataset.rows.forEach((row, index) => {
      if (doc.y > bottomLimit) {
        doc.addPage();
        drawHeader();
        drawTableHeader();
        doc.font(FONT).fontSize(7);
      }

      const y = doc.y;
      // Zebra para facilitar a leitura em impressões longas.
      if (index % 2 === 1) {
        doc.rect(MARGIN, y - 2, pageWidth, 13).fill('#f1f5f9').fillColor('#0f172a');
      }

      let x = MARGIN;
      dataset.columns.forEach((col, i) => {
        const w = widths[i] ?? 40;
        doc.fillColor('#0f172a').text(formatCell(row[col.key]), x + 3, y, {
          width: w - 6,
          align: col.align === 'right' ? 'right' : 'left',
          lineBreak: false,
          ellipsis: true,
        });
        x += w;
      });
      doc.y = y + 13;
    });

    if (dataset.rows.length === 0) {
      doc.moveDown(1);
      doc
        .font(FONT)
        .fontSize(9)
        .fillColor('#64748b')
        .text('Nenhum registro encontrado para os filtros informados.', MARGIN, doc.y, {
          width: pageWidth,
          align: 'center',
        });
    }

    // ---- Resumo ----
    if (dataset.summary?.length) {
      if (doc.y > bottomLimit - 60) doc.addPage();
      doc.moveDown(1);
      doc.font(FONT_BOLD).fontSize(9).fillColor('#0f172a').text('Resumo', MARGIN, doc.y);
      doc.moveDown(0.3);
      doc.font(FONT).fontSize(8).fillColor('#334155');
      for (const s of dataset.summary) {
        doc.text(`${s.label}: ${s.value}`, MARGIN, doc.y);
      }
    }

    // ---- Rodapé com numeração ----
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      doc
        .font(FONT)
        .fontSize(7)
        .fillColor('#94a3b8')
        .text(
          `Página ${i + 1} de ${range.count}  ·  Sistema de Controle de Estoque Escolar`,
          MARGIN,
          doc.page.height - MARGIN - 8,
          { width: pageWidth, align: 'center', lineBreak: false },
        );
    }

    doc.end();
  });
}

function formatCell(value: ReportCell | undefined): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : value.toFixed(2).replace('.', ',');
  }
  return String(value);
}
