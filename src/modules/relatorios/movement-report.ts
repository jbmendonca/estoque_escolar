// Relatório 1 — Movimentação por Período (entradas e saídas).
// Rastreia o fluxo do estoque em um intervalo de tempo, com responsável e origem/destino.
import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/errors';
import { formatDateOnly } from '@/lib/date';
import { ModuleType } from '@/modules/shared/enums';
import { isAdmin, type AuthUser } from '@/server/rbac';
import type { ReportDataset } from '@/modules/relatorios/types';

export type MovementFilter = 'TODOS' | 'ENTRADAS' | 'SAIDAS';

export interface MovementReportParams {
  module: ModuleType;
  /** Data inicial (YYYY-MM-DD) — obrigatória. */
  from: string;
  /** Data final (YYYY-MM-DD) — obrigatória. */
  to: string;
  tipo?: MovementFilter;
  schoolId?: string;
}

const MODULE_LABEL: Record<ModuleType, string> = {
  [ModuleType.FOOD]: 'Merenda Escolar',
  [ModuleType.SCHOOL_MATERIAL]: 'Materiais Escolares',
};

const TYPE_LABEL: Record<string, string> = {
  ENTRADA: 'Entrada',
  DEVOLUCAO: 'Devolução',
  SAIDA: 'Saída',
  CONSUMO: 'Consumo',
  PREPARO_MERENDA: 'Preparo de merenda',
  DISTRIBUICAO: 'Distribuição',
  PERDA: 'Perda',
  AVARIA: 'Avaria',
  PRODUTO_VENCIDO: 'Produto vencido',
  TRANSFERENCIA_INTERNA: 'Transferência interna',
  AJUSTE: 'Ajuste',
};

const TARGET_LABEL: Record<string, string> = {
  ALUNO: 'Aluno',
  TURMA: 'Turma',
  PROFESSOR: 'Professor',
  SETOR: 'Setor',
  ATIVIDADE: 'Atividade',
  OUTRO: 'Outro',
};

/** Converte "YYYY-MM-DD" no início/fim do dia no fuso local do servidor. */
function dayRange(from: string, to: string): { start: Date; end: Date } {
  const isoDate = /^\d{4}-\d{2}-\d{2}$/;
  if (!isoDate.test(from) || !isoDate.test(to)) {
    throw new AppError('VALIDATION', 'Informe a data inicial e a data final (formato AAAA-MM-DD).');
  }
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T23:59:59.999`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new AppError('VALIDATION', 'Datas inválidas.');
  }
  if (start > end) {
    throw new AppError('VALIDATION', 'A data inicial não pode ser posterior à data final.');
  }
  return { start, end };
}

export async function buildMovementReport(
  user: AuthUser,
  userName: string,
  params: MovementReportParams,
): Promise<ReportDataset> {
  const { start, end } = dayRange(params.from, params.to);
  const tipo = params.tipo ?? 'TODOS';

  const schoolFilter = params.schoolId
    ? { schoolId: params.schoolId }
    : isAdmin(user)
      ? {}
      : { schoolId: { in: user.schoolIds } };

  const directionFilter =
    tipo === 'ENTRADAS' ? { direction: 'IN' as const } : tipo === 'SAIDAS' ? { direction: 'OUT' as const } : {};

  const lines = await prisma.stockMovementItem.findMany({
    where: {
      movement: {
        ...schoolFilter,
        ...directionFilter,
        module: params.module,
        createdAt: { gte: start, lte: end },
      },
    },
    orderBy: { movement: { createdAt: 'desc' } },
    include: {
      item: { select: { code: true, name: true, unitOfMeasure: { select: { abbreviation: true } } } },
      foodBatch: {
        select: { batchNumber: true, expiryDate: true, supplier: { select: { name: true } } },
      },
      movement: {
        select: {
          number: true,
          type: true,
          direction: true,
          createdAt: true,
          referenceDocument: true,
          distributionTarget: true,
          distributionTargetLabel: true,
          justification: true,
          user: { select: { name: true } },
          school: { select: { name: true, code: true } },
        },
      },
    },
  });

  let totalEntradas = 0;
  let totalSaidas = 0;

  const rows = lines.map((line) => {
    const m = line.movement;
    const qty = Number(line.quantity);
    if (m.direction === 'IN') totalEntradas += qty;
    else totalSaidas += qty;

    return {
      data: m.createdAt.toLocaleString('pt-BR'),
      numero: m.number,
      codigo: line.item.code,
      item: line.item.name,
      tipo: TYPE_LABEL[m.type] ?? m.type,
      natureza: m.direction === 'IN' ? 'Entrada' : 'Saída',
      quantidade: qty,
      unidade: line.item.unitOfMeasure.abbreviation,
      lote: line.foodBatch
        ? `${line.foodBatch.batchNumber} (val. ${formatDateOnly(line.foodBatch.expiryDate)})`
        : '—',
      origemDestino: originOrTarget(line),
      usuario: m.user.name,
      escola: m.school.name,
      observacao: m.justification ?? '—',
    };
  });

  const schools = await resolveSchoolLabel(user, params.schoolId);

  return {
    title: 'Relatório de Movimentação por Período',
    subtitle: `${MODULE_LABEL[params.module]} — ${schools}`,
    filtersDescription: [
      `Período: ${formatBr(params.from)} a ${formatBr(params.to)}`,
      `Tipo de movimentação: ${tipo === 'TODOS' ? 'Todas' : tipo === 'ENTRADAS' ? 'Apenas entradas' : 'Apenas saídas'}`,
    ],
    columns: [
      { key: 'data', header: 'Data', width: 18 },
      { key: 'numero', header: 'Documento', width: 12 },
      { key: 'codigo', header: 'Código', width: 12 },
      { key: 'item', header: 'Item', width: 32 },
      { key: 'tipo', header: 'Tipo', width: 18 },
      { key: 'natureza', header: 'Entrada/Saída', width: 12 },
      { key: 'quantidade', header: 'Quantidade', align: 'right', width: 11 },
      { key: 'unidade', header: 'Un.', width: 6 },
      { key: 'lote', header: 'Lote', width: 22 },
      { key: 'origemDestino', header: 'Origem/Destino', width: 26 },
      { key: 'usuario', header: 'Responsável', width: 22 },
    ],
    rows,
    summary: [
      { label: 'Movimentações no período', value: String(rows.length) },
      { label: 'Total de entradas', value: formatNumber(totalEntradas) },
      { label: 'Total de saídas', value: formatNumber(totalSaidas) },
      { label: 'Saldo do período', value: formatNumber(totalEntradas - totalSaidas) },
    ],
    generatedAt: new Date(),
    generatedBy: userName,
  };
}

/** Origem (fornecedor/documento) nas entradas; destino (turma/setor) nas saídas. */
function originOrTarget(line: {
  movement: {
    direction: string;
    referenceDocument: string | null;
    distributionTarget: string | null;
    distributionTargetLabel: string | null;
  };
  foodBatch: { supplier: { name: string } | null } | null;
}): string {
  const m = line.movement;
  if (m.direction === 'IN') {
    const fornecedor = line.foodBatch?.supplier?.name;
    if (fornecedor) return `Fornecedor: ${fornecedor}`;
    if (m.referenceDocument) return `Doc.: ${m.referenceDocument}`;
    return '—';
  }
  if (m.distributionTarget) {
    const tipo = TARGET_LABEL[m.distributionTarget] ?? m.distributionTarget;
    return m.distributionTargetLabel ? `${tipo}: ${m.distributionTargetLabel}` : tipo;
  }
  return m.referenceDocument ? `Doc.: ${m.referenceDocument}` : '—';
}

export async function resolveSchoolLabel(user: AuthUser, schoolId?: string): Promise<string> {
  if (schoolId) {
    const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { name: true } });
    return school?.name ?? 'Escola';
  }
  if (isAdmin(user)) return 'Todas as escolas';
  const schools = await prisma.school.findMany({
    where: { id: { in: user.schoolIds } },
    select: { name: true },
    orderBy: { name: 'asc' },
  });
  return schools.map((s) => s.name).join(', ') || 'Escola';
}

export function formatBr(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function formatNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ',');
}
