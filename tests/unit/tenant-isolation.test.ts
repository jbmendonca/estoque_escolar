import { describe, it, expect } from 'vitest';
import {
  assignableRoles,
  can,
  canAccessSchool,
  isSuperAdmin,
  isTenantAdmin,
  manageableSchoolIds,
  schoolScopeFilter,
  type AuthUser,
} from '@/server/rbac';
import { ModuleType, RoleName } from '@/modules/shared/enums';

const ESCOLA_A = 'school-A';
const ESCOLA_B = 'school-B';

/** Administrador GLOBAL da rede municipal. */
const superAdmin: AuthUser = {
  id: 'u-super',
  roles: [RoleName.ADMINISTRADOR],
  schoolIds: [],
  permissions: [],
};

/** Administrador do TENANT (escola A). */
const adminEscolaA: AuthUser = {
  id: 'u-admin-a',
  roles: [RoleName.ADMIN_ESCOLA],
  schoolIds: [ESCOLA_A],
  permissions: [
    { key: 'user.manage' },
    { key: 'item.view' },
    { key: 'audit.view' },
    { key: 'catalog.manage' },
  ],
};

const secretarioA: AuthUser = {
  id: 'u-sec-a',
  roles: [RoleName.SECRETARIO],
  schoolIds: [ESCOLA_A],
  permissions: [{ key: 'item.view' }, { key: 'item.create' }],
};

describe('Papéis: global x tenant', () => {
  it('distingue administrador da rede de administrador da escola', () => {
    expect(isSuperAdmin(superAdmin)).toBe(true);
    expect(isTenantAdmin(superAdmin)).toBe(false);

    expect(isSuperAdmin(adminEscolaA)).toBe(false);
    expect(isTenantAdmin(adminEscolaA)).toBe(true);
  });

  it('administrador do tenant NÃO tem acesso global', () => {
    expect(canAccessSchool(superAdmin, ESCOLA_B)).toBe(true);
    expect(canAccessSchool(adminEscolaA, ESCOLA_B)).toBe(false);
    expect(canAccessSchool(adminEscolaA, ESCOLA_A)).toBe(true);
  });
});

describe('Isolamento de dados entre escolas (tenants)', () => {
  it('o filtro de consulta limita o tenant à própria escola', () => {
    expect(schoolScopeFilter(adminEscolaA)).toEqual({ schoolId: { in: [ESCOLA_A] } });
    expect(schoolScopeFilter(secretarioA)).toEqual({ schoolId: { in: [ESCOLA_A] } });
    // Administrador da rede consulta sem restrição.
    expect(schoolScopeFilter(superAdmin)).toEqual({});
  });

  it('nega qualquer permissão sobre escola de outro tenant', () => {
    expect(can(adminEscolaA, 'user.manage', { schoolId: ESCOLA_B })).toBe(false);
    expect(can(adminEscolaA, 'item.view', { schoolId: ESCOLA_B, module: ModuleType.FOOD })).toBe(false);
    expect(can(secretarioA, 'item.create', { schoolId: ESCOLA_B })).toBe(false);
  });

  it('permite as mesmas ações dentro da própria escola', () => {
    expect(can(adminEscolaA, 'user.manage', { schoolId: ESCOLA_A })).toBe(true);
    expect(can(secretarioA, 'item.create', { schoolId: ESCOLA_A })).toBe(true);
  });

  it('escopo administrável: null (todas) para a rede, lista para o tenant', () => {
    expect(manageableSchoolIds(superAdmin)).toBeNull();
    expect(manageableSchoolIds(adminEscolaA)).toEqual([ESCOLA_A]);
  });
});

describe('Prevenção de escalonamento de privilégio', () => {
  it('administrador do tenant não pode conceder perfis administrativos', () => {
    const permitidos = assignableRoles(adminEscolaA);
    expect(permitidos).not.toContain(RoleName.ADMINISTRADOR);
    expect(permitidos).not.toContain(RoleName.ADMIN_ESCOLA);
  });

  it('administrador do tenant pode conceder os perfis operacionais da escola', () => {
    const permitidos = assignableRoles(adminEscolaA);
    expect(permitidos).toEqual(
      expect.arrayContaining([
        RoleName.GESTOR_ESCOLAR,
        RoleName.SECRETARIO,
        RoleName.COORDENADOR,
        RoleName.MERENDEIRA,
        RoleName.ASSISTENTE_ALUNO,
      ]),
    );
  });

  it('administrador da rede pode conceder qualquer perfil', () => {
    expect(assignableRoles(superAdmin)).toContain(RoleName.ADMINISTRADOR);
    expect(assignableRoles(superAdmin)).toContain(RoleName.ADMIN_ESCOLA);
  });

  it('usuário sem papel administrativo não concede nada', () => {
    expect(assignableRoles(secretarioA)).toEqual([]);
  });
});

describe('Isolamento de módulo dentro do tenant', () => {
  const merendeiraA: AuthUser = {
    id: 'u-mer-a',
    roles: [RoleName.MERENDEIRA],
    schoolIds: [ESCOLA_A],
    permissions: [{ key: 'item.view', moduleScope: ModuleType.FOOD }],
  };

  it('merendeira do tenant A não acessa materiais nem a escola B', () => {
    expect(can(merendeiraA, 'item.view', { schoolId: ESCOLA_A, module: ModuleType.FOOD })).toBe(true);
    expect(
      can(merendeiraA, 'item.view', { schoolId: ESCOLA_A, module: ModuleType.SCHOOL_MATERIAL }),
    ).toBe(false);
    expect(can(merendeiraA, 'item.view', { schoolId: ESCOLA_B, module: ModuleType.FOOD })).toBe(false);
  });
});
