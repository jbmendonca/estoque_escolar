import { describe, it, expect } from 'vitest';
import { visibleNavigation } from '@/modules/shared/navigation';
import type { AuthUser } from '@/server/rbac';
import { ModuleType, RoleName } from '@/modules/shared/enums';

const SCHOOL = 'school-A';

const merendeira: AuthUser = {
  id: 'u-mer',
  roles: [RoleName.MERENDEIRA],
  schoolIds: [SCHOOL],
  permissions: [
    { key: 'item.view', moduleScope: ModuleType.FOOD },
    { key: 'movement.create', moduleScope: ModuleType.FOOD },
    { key: 'movement.view', moduleScope: ModuleType.FOOD },
    { key: 'dashboard.view', moduleScope: ModuleType.FOOD },
  ],
};

const assistente: AuthUser = {
  id: 'u-ass',
  roles: [RoleName.ASSISTENTE_ALUNO],
  schoolIds: [SCHOOL],
  permissions: [
    { key: 'item.view', moduleScope: ModuleType.SCHOOL_MATERIAL },
    { key: 'movement.create', moduleScope: ModuleType.SCHOOL_MATERIAL },
    { key: 'movement.view', moduleScope: ModuleType.SCHOOL_MATERIAL },
    { key: 'dashboard.view', moduleScope: ModuleType.SCHOOL_MATERIAL },
  ],
};

const admin: AuthUser = {
  id: 'u-admin',
  roles: [RoleName.ADMINISTRADOR],
  schoolIds: [],
  permissions: [],
};

function sectionTitles(user: AuthUser) {
  return visibleNavigation(user, SCHOOL).map((s) => s.title);
}

describe('Sidebar — oculta o que o perfil não pode acessar', () => {
  it('Merendeira vê Merenda, mas NÃO vê Materiais nem Administração', () => {
    const titles = sectionTitles(merendeira);
    expect(titles).toContain('Merenda Escolar');
    expect(titles).not.toContain('Materiais Escolares');
    expect(titles).not.toContain('Administração');
  });

  it('Assistente de Aluno vê Materiais, mas NÃO vê Merenda nem Administração', () => {
    const titles = sectionTitles(assistente);
    expect(titles).toContain('Materiais Escolares');
    expect(titles).not.toContain('Merenda Escolar');
    expect(titles).not.toContain('Administração');
  });

  it('Administrador vê todas as seções', () => {
    const titles = sectionTitles(admin);
    expect(titles).toEqual(
      expect.arrayContaining(['Início', 'Merenda Escolar', 'Materiais Escolares', 'Administração']),
    );
  });

  it('usuário sem permissões não vê nenhuma seção', () => {
    const nobody: AuthUser = { id: 'u-0', roles: [], schoolIds: [SCHOOL], permissions: [] };
    expect(visibleNavigation(nobody, SCHOOL)).toEqual([]);
  });
});
