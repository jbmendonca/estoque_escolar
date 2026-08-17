import { describe, it, expect } from 'vitest';
import { analyzeUsage, buildLowStockAlerts, type ItemUsage } from '@/modules/dashboard/analytics-service';

function item(over: Partial<ItemUsage> & { itemId: string }): ItemUsage {
  const consumed = over.consumed ?? 0;
  const days = 30;
  const dailyAvg = consumed / days;
  const balance = over.balance ?? 0;
  return {
    code: 'X',
    name: 'Item',
    unit: 'un',
    module: 'FOOD',
    categoryName: 'Cat',
    categoryGroup: null,
    consumed,
    movements: 0,
    balance,
    minStock: 0,
    dailyAvg,
    coverageDays: dailyAvg > 0 ? balance / dailyAvg : null,
    ...over,
  };
}

describe('Curva ABC (Pareto do consumo)', () => {
  it('classifica os itens de maior consumo como A', () => {
    const usage = [
      item({ itemId: '1', consumed: 800 }),
      item({ itemId: '2', consumed: 120 }),
      item({ itemId: '3', consumed: 50 }),
      item({ itemId: '4', consumed: 30 }),
    ];
    const { abc } = analyzeUsage(usage);
    expect(abc.a.map((i) => i.itemId)).toContain('1');
    // O total é 1000: 800 (80%) fecha a classe A.
    expect(abc.a).toHaveLength(1);
    expect(abc.b.map((i) => i.itemId)).toContain('2');
  });

  it('itens sem consumo caem sempre na classe C', () => {
    const usage = [item({ itemId: '1', consumed: 100 }), item({ itemId: '2', consumed: 0 })];
    const { abc } = analyzeUsage(usage);
    expect(abc.c.map((i) => i.itemId)).toContain('2');
  });
});

describe('Risco de ruptura', () => {
  it('lista itens que acabam dentro da janela, do mais urgente ao menos', () => {
    const usage = [
      item({ itemId: 'urgente', consumed: 300, balance: 20 }), // 10/dia -> 2 dias
      item({ itemId: 'ok', consumed: 30, balance: 300 }), // 1/dia -> 300 dias
      item({ itemId: 'medio', consumed: 150, balance: 50 }), // 5/dia -> 10 dias
    ];
    const { ruptureRisk } = analyzeUsage(usage, { riskDays: 15 });
    expect(ruptureRisk.map((i) => i.itemId)).toEqual(['urgente', 'medio']);
  });

  it('item sem consumo não entra em risco de ruptura (cobertura indefinida)', () => {
    const usage = [item({ itemId: 'parado', consumed: 0, balance: 5 })];
    expect(analyzeUsage(usage).ruptureRisk).toHaveLength(0);
  });
});

describe('Estoque parado', () => {
  it('identifica itens com saldo e sem nenhuma saída', () => {
    const usage = [
      item({ itemId: 'parado', consumed: 0, balance: 100 }),
      item({ itemId: 'zerado', consumed: 0, balance: 0 }), // sem saldo não é "parado"
      item({ itemId: 'ativo', consumed: 10, balance: 50 }),
    ];
    const { idleItems } = analyzeUsage(usage);
    expect(idleItems.map((i) => i.itemId)).toEqual(['parado']);
  });
});

describe('Alertas de estoque baixo', () => {
  it('classifica a severidade e ordena do mais crítico', () => {
    const usage = [
      item({ itemId: 'baixo', balance: 8, minStock: 10 }), // 80%
      item({ itemId: 'zerado', balance: 0, minStock: 5 }), // 0%
      item({ itemId: 'critico', balance: 2, minStock: 10 }), // 20%
      item({ itemId: 'normal', balance: 50, minStock: 10 }), // acima do mínimo
    ];
    const alerts = buildLowStockAlerts(usage);
    expect(alerts.map((a) => a.itemId)).toEqual(['zerado', 'critico', 'baixo']);
    expect(alerts[0]?.severity).toBe('ZERADO');
    expect(alerts[1]?.severity).toBe('CRITICO');
    expect(alerts[2]?.severity).toBe('BAIXO');
  });

  it('ignora itens sem estoque mínimo definido', () => {
    const usage = [item({ itemId: 'sem-min', balance: 0, minStock: 0 })];
    expect(buildLowStockAlerts(usage)).toHaveLength(0);
  });
});

describe('Indicadores de utilização', () => {
  it('calcula giro e percentual de itens com movimento', () => {
    const usage = [
      item({ itemId: '1', consumed: 100, balance: 100 }),
      item({ itemId: '2', consumed: 0, balance: 100 }),
    ];
    const { turnover, activeRatio } = analyzeUsage(usage);
    expect(turnover).toBeCloseTo(0.5); // 100 consumido / 200 de saldo
    expect(activeRatio).toBeCloseTo(0.5); // 1 de 2 itens teve movimento
  });
});
