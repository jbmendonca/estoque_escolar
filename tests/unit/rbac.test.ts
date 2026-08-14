import { describe, it, expect } from 'vitest';
import { can, canAccessSchool, isAdmin, schoolScopeFilter, type AuthUser } from '@/server/rbac';
import { ModuleType, RoleName } from '@/modules/shared/enums';

const admin: AuthUser = {
  id: 'u-admin',
  roles: [RoleName.ADMINISTRADOR],
  schoolIds: [],
  permissions: [],
};

const merendeira: AuthUser = {
  id: 'u-mer',
  roles: [RoleName.MERENDEIRA],
  schoolIds: ['school-A'],
  permissions: [
    { key: 'item.view', moduleScope: ModuleType.FOOD },
    { key: 'movement.create', moduleScope: ModuleType.FOOD },
  ],
};

const assistente: AuthUser = {
  id: 'u-ass',
  roles: [RoleName.ASSISTENTE_ALUNO],
  schoolIds: ['school-A'],
  permissions: [
    { key: 'item.view', moduleScope: ModuleType.SCHOOL_MATERIAL },
    { key: 'movement.create', moduleScope: ModuleType.SCHOOL_MATERIAL },
  ],
};

describe('RBAC — negar por padrão', () => {
  it('admin tem acesso global (ignora escola e escopo)', () => {
    expect(isAdmin(admin)).toBe(true);
    expect(can(admin, 'qualquer.permissao', { schoolId: 'school-Z' })).toBe(true);
    expect(canAccessSchool(admin, 'school-Z')).toBe(true);
  });

  it('usuário sem a permissão é negado', () => {
    expect(can(merendeira, 'user.manage', { schoolId: 'school-A' })).toBe(false);
  });

  it('Merendeira NÃO acessa módulo de Materiais', () => {
    expect(
      can(merendeira, 'movement.create', { schoolId: 'school-A', module: ModuleType.SCHOOL_MATERIAL }),
    ).toBe(false);
    expect(
      can(merendeira, 'movement.create', { schoolId: 'school-A', module: ModuleType.FOOD }),
    ).toBe(true);
  });

  it('Assistente de Aluno NÃO acessa módulo de Merenda', () => {
    expect(
      can(assistente, 'movement.create', { schoolId: 'school-A', module: ModuleType.FOOD }),
    ).toBe(false);
    expect(
      can(assistente, 'movement.create', { schoolId: 'school-A', module: ModuleType.SCHOOL_MATERIAL }),
    ).toBe(true);
  });

  it('isolamento por escola: nega acesso a escola não vinculada', () => {
    expect(can(merendeira, 'item.view', { schoolId: 'school-B', module: ModuleType.FOOD })).toBe(false);
    expect(canAccessSchool(merendeira, 'school-B')).toBe(false);
  });

  it('schoolScopeFilter restringe não-admin às suas escolas e libera admin', () => {
    expect(schoolScopeFilter(merendeira)).toEqual({ schoolId: { in: ['school-A'] } });
    expect(schoolScopeFilter(admin)).toEqual({});
  });
});
