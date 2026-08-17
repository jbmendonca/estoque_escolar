import { describe, it, expect } from 'vitest';
import {
  buildSuggestion,
  buildSuggestions,
  classifyHealth,
  computeCoverageDays,
  computePriority,
  computeSuggestedQty,
  formatPeriod,
  type PurchaseCandidate,
} from '@/modules/compras/purchase-domain';

/** Candidato base: 30 dias de janela, consumo informado por dia. */
function candidate(over: Partial<PurchaseCandidate> & { itemId: string }): PurchaseCandidate {
  return {
    code: 'MAT-000001',
    name: 'Papel A4',
    unit: 'cx',
    module: 'SCHOOL_MATERIAL',
    categoryName: 'Material de escritório',
    categoryGroup: 'MATERIAL_ESCRITORIO',
    balance: 0,
    minStock: 0,
    consumed: 0,
    dailyAvg: 0,
    pendingQty: 0,
    ...over,
  };
}

describe('Previsão de necessidade', () => {
  it('estima em quantos dias o estoque acaba no ritmo atual', () => {
    // 2 caixas em estoque, 3 caixas/mês = 0,1/dia → 20 dias.
    expect(computeCoverageDays(2, 0.1)).toBeCloseTo(20);
  });

  it('sem consumo no período a cobertura é indefinida', () => {
    expect(computeCoverageDays(10, 0)).toBeNull();
  });
});

describe('Quantidade sugerida', () => {
  it('cobre o consumo previsto para o próximo período', () => {
    // 0,1 cx/dia × 30 dias = 3; já existem 2 → faltam 1 (arredondado para cima).
    const qty = computeSuggestedQty({ balance: 2, minStock: 0, dailyAvg: 0.1, pendingQty: 0 });
    expect(qty).toBe(1);
  });

  it('usa o estoque mínimo quando ele é maior que o consumo previsto', () => {
    const qty = computeSuggestedQty({ balance: 2, minStock: 10, dailyAvg: 0.1, pendingQty: 0 });
    expect(qty).toBe(8);
  });

  it('desconta o que já foi solicitado e ainda não chegou', () => {
    const qty = computeSuggestedQty({ balance: 2, minStock: 10, dailyAvg: 0, pendingQty: 5 });
    expect(qty).toBe(3);
  });

  it('não sugere compra quando o estoque já cobre o período', () => {
    const qty = computeSuggestedQty({ balance: 50, minStock: 10, dailyAvg: 0.1, pendingQty: 0 });
    expect(qty).toBe(0);
  });

  it('arredonda para cima — não se compra fração de embalagem', () => {
    const qty = computeSuggestedQty({ balance: 0, minStock: 0, dailyAvg: 0.11, pendingQty: 0 });
    expect(qty).toBe(4); // 0,11 × 30 = 3,3 → 4
  });
});

describe('Prioridade da compra', () => {
  it('estoque zerado é sempre prioridade alta', () => {
    expect(computePriority({ balance: 0, minStock: 10, coverageDays: null })).toBe('ALTA');
  });

  it('acabar dentro do prazo de reposição é prioridade alta', () => {
    expect(computePriority({ balance: 5, minStock: 0, coverageDays: 5 })).toBe('ALTA');
  });

  it('metade do estoque mínimo ou menos é prioridade alta', () => {
    expect(computePriority({ balance: 4, minStock: 10, coverageDays: null })).toBe('ALTA');
  });

  it('abaixo do mínimo, mas com folga, é prioridade média', () => {
    expect(computePriority({ balance: 8, minStock: 10, coverageDays: null })).toBe('MEDIA');
  });

  it('cobertura curta sem estoque mínimo definido é prioridade média', () => {
    expect(computePriority({ balance: 20, minStock: 0, coverageDays: 18 })).toBe('MEDIA');
  });

  it('estoque confortável é prioridade baixa', () => {
    expect(computePriority({ balance: 100, minStock: 10, coverageDays: 200 })).toBe('BAIXA');
  });
});

describe('Semáforo do estoque', () => {
  it('abaixo do mínimo é crítico (🔴)', () => {
    expect(classifyHealth({ balance: 9, minStock: 10, coverageDays: 100 })).toBe('CRITICO');
  });

  it('logo acima do mínimo é atenção (🟡)', () => {
    expect(classifyHealth({ balance: 11, minStock: 10, coverageDays: 100 })).toBe('ATENCAO');
  });

  it('acima do mínimo e com cobertura longa é adequado (🟢)', () => {
    expect(classifyHealth({ balance: 100, minStock: 10, coverageDays: 300 })).toBe('ADEQUADO');
  });
});

describe('Mensagens da sugestão automática', () => {
  it('descreve o consumo, a recomendação e a previsão', () => {
    // Papel A4: 2 caixas em estoque, 9 consumidas em 90 dias (0,1/dia).
    const suggestion = buildSuggestion(
      candidate({
        itemId: '1',
        name: 'Papel A4',
        unit: 'cx',
        balance: 2,
        consumed: 9,
        dailyAvg: 0.1,
      }),
      { days: 90 },
    );

    expect(suggestion.messages).toContain('Foram consumidas 9 cx de Papel A4 nos últimos 3 meses.');
    expect(suggestion.messages).toContain('Recomenda-se comprar 1 cx para os próximos 30 dias.');
    expect(suggestion.messages).toContain('Estoque suficiente para aproximadamente 20 dias.');
  });

  it('avisa quando o material está acabando', () => {
    const suggestion = buildSuggestion(
      candidate({ itemId: '1', name: 'Papel A4', balance: 1, consumed: 30, dailyAvg: 1 }),
      { days: 30 },
    );
    expect(suggestion.messages[0]).toBe('Papel A4 está acabando.');
  });

  it('avisa quando o material está sem estoque', () => {
    const suggestion = buildSuggestion(
      candidate({ itemId: '1', name: 'Papel A4', balance: 0, minStock: 5 }),
      { days: 30 },
    );
    expect(suggestion.messages[0]).toBe('Papel A4 está sem estoque.');
  });

  it('informa o que já foi solicitado e ainda não chegou', () => {
    const suggestion = buildSuggestion(
      candidate({ itemId: '1', balance: 0, minStock: 10, pendingQty: 4 }),
      { days: 30 },
    );
    expect(suggestion.messages).toContain('Já existem 4 cx solicitadas e ainda não recebidas.');
  });

  it('descreve a janela em meses quando é múltipla de 30', () => {
    expect(formatPeriod(90)).toBe('3 meses');
    expect(formatPeriod(30)).toBe('30 dias');
  });
});

describe('Lista de compras inteligente', () => {
  const itens = [
    candidate({
      itemId: 'ok',
      name: 'Caderno',
      balance: 500,
      minStock: 10,
      consumed: 30,
      dailyAvg: 1,
    }),
    candidate({ itemId: 'zerado', name: 'Cola', balance: 0, minStock: 20 }),
    candidate({
      itemId: 'baixo',
      name: 'Lápis',
      balance: 8,
      minStock: 10,
      consumed: 3,
      dailyAvg: 0.1,
    }),
    candidate({
      itemId: 'urgente',
      name: 'Papel A4',
      balance: 2,
      minStock: 10,
      consumed: 60,
      dailyAvg: 2,
    }),
  ];

  it('lista apenas os itens que precisam de reposição', () => {
    const ids = buildSuggestions(itens, { days: 30 }).map((s) => s.itemId);
    expect(ids).not.toContain('ok');
    expect(ids).toEqual(expect.arrayContaining(['zerado', 'baixo', 'urgente']));
  });

  it('ordena por prioridade e, dentro dela, por quem acaba primeiro', () => {
    const ordered = buildSuggestions(itens, { days: 30 });
    expect(ordered[0]?.priority).toBe('ALTA');
    expect(ordered.at(-1)?.itemId).toBe('baixo');
    // 'urgente' acaba em 1 dia; 'zerado' já está em zero → zerado vem antes.
    expect(ordered.slice(0, 2).map((s) => s.itemId)).toEqual(['zerado', 'urgente']);
  });

  it('marca corretamente quem está abaixo do mínimo', () => {
    const suggestion = buildSuggestions(itens, { days: 30 }).find((s) => s.itemId === 'baixo');
    expect(suggestion?.belowMin).toBe(true);
    expect(suggestion?.priority).toBe('MEDIA');
  });
});
