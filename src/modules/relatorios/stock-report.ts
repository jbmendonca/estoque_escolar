// Relatório 2 — Saldo Atual (Posição de Estoque / Disponibilidade).
// Fotografia do que existe fisicamente no estoque no momento da consulta.
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { ModuleType } from '@/modules/shared/enums';
import { isAdmin, type AuthUser } from '@/server/rbac';
import { resolveSchoolLabel, formatNumber } from '@/modules/relatorios/movement-report';
import type { ReportDataset } from '@/modules/relatorios/types';

export type StockStatusFilter = 'TODOS' | 'COM_SALDO' | 'ZERADOS';

export interface StockReportParams {
  module: ModuleType;
  categoryId?: string;
  status?: StockStatusFilter;
  schoolId?: string;
}

const MODULE_LABEL: Record<ModuleType, string> = {
  [ModuleType.FOOD]: 'Merenda Escolar',
  [ModuleType.SCHOOL_MATERIAL]: 'Materiais Escolares',
};

const STATUS_LABEL: Record<StockStatusFilter, string> = {
  TODOS: 'Todos os itens',
  COM_SALDO: 'Apenas itens com saldo',
  ZERADOS: 'Apenas itens zerados',
};

export async function buildStockReport(
  user: AuthUser,
  userName: string,
  params: StockReportParams,
): Promise<ReportDataset> {
  const status = params.status ?? 'TODOS';

  const where: Prisma.ItemWhereInput = {
    module: params.module,
    active: true,
    ...(params.schoolId
      ? { schoolId: params.schoolId }
      : isAdmin(user)
        ? {}
        : { schoolId: { in: user.schoolIds } }),
    ...(params.categoryId ? { categoryId: params.categoryId } : {}),
  };

  const items = await prisma.item.findMany({
    where,
    // Ordenação alfabética por padrão (FR-010), com collation pt-BR no banco.
    orderBy: { name: 'asc' },
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      minStock: true,
      brand: true,
      category: { select: { name: true } },
      unitOfMeasure: { select: { abbreviation: true } },
      storageLocation: { select: { code: true } },
      stock: { select: { quantity: true } },
    },
  });

  // O filtro de status depende do saldo, aplicado após a consulta (1 saldo por item).
  const filtered = items.filter((item) => {
    const qty = Number(item.stock?.quantity ?? 0);
    if (status === 'COM_SALDO') return qty > 0;
    if (status === 'ZERADOS') return qty <= 0;
    return true;
  });

  let comSaldo = 0;
  let zerados = 0;
  let abaixoMinimo = 0;

  const rows = filtered.map((item) => {
    const qty = Number(item.stock?.quantity ?? 0);
    const min = Number(item.minStock);
    if (qty > 0) comSaldo += 1;
    else zerados += 1;
    if (min > 0 && qty < min) abaixoMinimo += 1;

    return {
      codigo: item.code,
      item: item.name,
      categoria: item.category.name,
      marca: item.brand ?? '—',
      unidade: item.unitOfMeasure.abbreviation,
      saldo: qty,
      minimo: min,
      situacao: qty <= 0 ? 'Sem estoque' : min > 0 && qty < min ? 'Abaixo do mínimo' : 'Normal',
      localizacao: item.storageLocation?.code ?? '—',
    };
  });

  const filters = [`Status: ${STATUS_LABEL[status]}`];
  if (params.categoryId) {
    const cat = await prisma.category.findUnique({
      where: { id: params.categoryId },
      select: { name: true },
    });
    filters.unshift(`Categoria: ${cat?.name ?? '—'}`);
  } else {
    filters.unshift('Categoria: Todas');
  }

  return {
    title: 'Relatório de Saldo Atual (Posição de Estoque)',
    subtitle: `${MODULE_LABEL[params.module]} — ${await resolveSchoolLabel(user, params.schoolId)}`,
    filtersDescription: filters,
    columns: [
      { key: 'codigo', header: 'Código', width: 12 },
      { key: 'item', header: 'Descrição', width: 36 },
      { key: 'categoria', header: 'Categoria', width: 20 },
      { key: 'marca', header: 'Marca', width: 18 },
      { key: 'unidade', header: 'Un. medida', width: 11 },
      { key: 'saldo', header: 'Qtd. disponível', align: 'right', width: 14 },
      { key: 'minimo', header: 'Estoque mínimo', align: 'right', width: 14 },
      { key: 'situacao', header: 'Situação', width: 17 },
      { key: 'localizacao', header: 'Localização', width: 14 },
    ],
    rows,
    summary: [
      { label: 'Itens listados', value: String(rows.length) },
      { label: 'Com saldo', value: String(comSaldo) },
      { label: 'Zerados', value: String(zerados) },
      { label: 'Abaixo do estoque mínimo', value: String(abaixoMinimo) },
      {
        label: 'Quantidade total em estoque',
        value: formatNumber(rows.reduce((acc, r) => acc + Number(r.saldo), 0)),
      },
    ],
    generatedAt: new Date(),
    generatedBy: userName,
  };
}
