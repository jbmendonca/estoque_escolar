import { NextResponse } from 'next/server';
import { AppError, toErrorResponse } from '@/lib/errors';
import { buildMovementReport, type MovementFilter } from '@/modules/relatorios/movement-report';
import { buildStockReport, type StockStatusFilter } from '@/modules/relatorios/stock-report';
import { renderReport, reportFilename } from '@/modules/relatorios';
import { REPORT_FORMATS, type ReportFormat } from '@/modules/relatorios/types';
import { ModuleType } from '@/modules/shared/enums';
import { requirePermission } from '@/server/guard';
import { getCurrentUserProfile } from '@/server/current-user';

const MOVEMENT_FILTERS: MovementFilter[] = ['TODOS', 'ENTRADAS', 'SAIDAS'];
const STATUS_FILTERS: StockStatusFilter[] = ['TODOS', 'COM_SALDO', 'ZERADOS'];

export async function GET(request: Request, { params }: { params: Promise<{ type: string }> }) {
  try {
    const { type } = await params;
    const url = new URL(request.url);

    const moduleParam = url.searchParams.get('module');
    if (moduleParam !== ModuleType.FOOD && moduleParam !== ModuleType.SCHOOL_MATERIAL) {
      throw new AppError('BAD_REQUEST', 'Informe o módulo (FOOD ou SCHOOL_MATERIAL).');
    }
    const schoolId = url.searchParams.get('schoolId') ?? undefined;

    // Autorização no servidor, respeitando o escopo de escola e de módulo.
    const user = await requirePermission('report.view', { schoolId, module: moduleParam });
    const profile = await getCurrentUserProfile();
    const userName = profile?.name ?? 'Usuário';

    const formatParam = (url.searchParams.get('format') ?? 'json') as ReportFormat;
    if (!REPORT_FORMATS.includes(formatParam)) {
      throw new AppError('BAD_REQUEST', 'Formato inválido. Use json, csv, xlsx ou pdf.');
    }

    let dataset;
    let baseName: string;

    if (type === 'movimentacao') {
      const from = url.searchParams.get('from');
      const to = url.searchParams.get('to');
      if (!from || !to) {
        throw new AppError('VALIDATION', 'Data inicial e data final são obrigatórias.');
      }
      const tipoParam = (url.searchParams.get('tipo') ?? 'TODOS') as MovementFilter;
      if (!MOVEMENT_FILTERS.includes(tipoParam)) {
        throw new AppError('BAD_REQUEST', 'Tipo de movimentação inválido.');
      }

      dataset = await buildMovementReport(user, userName, {
        module: moduleParam,
        from,
        to,
        tipo: tipoParam,
        schoolId,
      });
      baseName = `relatorio-movimentacao-${moduleParam === ModuleType.FOOD ? 'merenda' : 'materiais'}`;
    } else if (type === 'saldo') {
      const statusParam = (url.searchParams.get('status') ?? 'TODOS') as StockStatusFilter;
      if (!STATUS_FILTERS.includes(statusParam)) {
        throw new AppError('BAD_REQUEST', 'Status inválido.');
      }

      dataset = await buildStockReport(user, userName, {
        module: moduleParam,
        categoryId: url.searchParams.get('categoryId') ?? undefined,
        status: statusParam,
        schoolId,
      });
      baseName = `relatorio-saldo-${moduleParam === ModuleType.FOOD ? 'merenda' : 'materiais'}`;
    } else {
      throw new AppError('NOT_FOUND', 'Relatório não encontrado.');
    }

    const rendered = await renderReport(dataset, formatParam);

    if (formatParam === 'json') {
      return NextResponse.json(dataset);
    }

    const filename = reportFilename(baseName, rendered.extension);
    const body =
      typeof rendered.body === 'string' ? Buffer.from(rendered.body, 'utf-8') : rendered.body;

    return new NextResponse(new Uint8Array(body), {
      status: 200,
      headers: {
        'Content-Type': rendered.contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(body.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
