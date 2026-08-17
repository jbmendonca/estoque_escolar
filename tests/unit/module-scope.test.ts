import { describe, it, expect } from 'vitest';
import { visibleModules, resolveVisibleModules, type AuthUser } from '@/server/rbac';
import { ModuleType, RoleName } from '@/modules/shared/enums';

const ESCOLA = 'school-A';

// Merendeira: só enxerga o módulo de merenda (item.view escopado a FOOD).
const merendeira: AuthUser = {
  id: 'u-mer',
  roles: [RoleName.MERENDEIRA],
  schoolIds: [ESCOLA],
  permissions: [{ key: 'item.view', moduleScope: ModuleType.FOOD }],
};

// Assistente de aluno: só materiais escolares.
const assistente: AuthUser = {
  id: 'u-ass',
  roles: [RoleName.ASSISTENTE_ALUNO],
  schoolIds: [ESCOLA],
  permissions: [{ key: 'item.view', moduleScope: ModuleType.SCHOOL_MATERIAL }],
};

const admin: AuthUser = {
  id: 'u-super',
  roles: [RoleName.ADMINISTRADOR],
  schoolIds: [],
  permissions: [],
};

describe('escopo de módulo — impede bypass por omissão do parâmetro', () => {
  it('merendeira só enxerga FOOD', () => {
    expect(visibleModules(merendeira, ESCOLA)).toEqual([ModuleType.FOOD]);
  });

  it('assistente só enxerga SCHOOL_MATERIAL', () => {
    expect(visibleModules(assistente, ESCOLA)).toEqual([ModuleType.SCHOOL_MATERIAL]);
  });

  it('admin global enxerga ambos', () => {
    expect(visibleModules(admin, ESCOLA).sort()).toEqual(
      [ModuleType.FOOD, ModuleType.SCHOOL_MATERIAL].sort(),
    );
  });

  it('sem module na query, restringe aos visíveis (merendeira nunca vê material)', () => {
    expect(resolveVisibleModules(merendeira, ESCOLA, null)).toEqual([ModuleType.FOOD]);
  });

  it('pedir um módulo não permitido resulta em lista vazia (nenhum resultado)', () => {
    // Merendeira tentando ler materiais explicitamente.
    expect(resolveVisibleModules(merendeira, ESCOLA, ModuleType.SCHOOL_MATERIAL)).toEqual([]);
  });

  it('pedir o próprio módulo é permitido', () => {
    expect(resolveVisibleModules(merendeira, ESCOLA, ModuleType.FOOD)).toEqual([ModuleType.FOOD]);
  });
});
