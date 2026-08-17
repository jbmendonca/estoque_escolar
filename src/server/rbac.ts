// Política de autorização (RBAC) + escopo de escola. Negar por padrão.
import { ModuleType, RoleName } from '@/modules/shared/enums';

export interface PermissionRef {
  key: string;
  /** Se definido, a permissão só vale para este módulo. */
  moduleScope?: ModuleType | null;
}

export interface AuthUser {
  id: string;
  roles: string[];
  /** Ids das escolas às quais o usuário está vinculado. */
  schoolIds: string[];
  /** Permissões efetivas (união das permissões dos papéis). */
  permissions: PermissionRef[];
}

export interface AccessContext {
  /** Escola alvo da operação (quando aplicável). */
  schoolId?: string;
  /** Módulo alvo da operação (FOOD / SCHOOL_MATERIAL). */
  module?: ModuleType;
}

/**
 * Administrador GLOBAL (Secretaria Municipal de Educação): enxerga e administra
 * todas as escolas/tenants. É o único papel que ignora o escopo de escola.
 */
export function isAdmin(user: AuthUser): boolean {
  return user.roles.includes(RoleName.ADMINISTRADOR);
}

/** Alias explícito para deixar clara a distinção nos pontos sensíveis. */
export const isSuperAdmin = isAdmin;

/**
 * Administrador DO TENANT (da escola): administra usuários e cadastros apenas
 * da(s) escola(s) às quais está vinculado. NÃO recebe acesso global.
 */
export function isTenantAdmin(user: AuthUser): boolean {
  return user.roles.includes(RoleName.ADMIN_ESCOLA);
}

/**
 * Papéis que um usuário pode ATRIBUIR a outros.
 * Impede escalonamento de privilégio: um administrador de tenant nunca pode
 * criar um administrador global nem outro administrador de tenant.
 */
export function assignableRoles(user: AuthUser): RoleName[] {
  if (isSuperAdmin(user)) {
    return Object.values(RoleName);
  }
  if (isTenantAdmin(user)) {
    return [
      RoleName.GESTOR_ESCOLAR,
      RoleName.SECRETARIO,
      RoleName.COORDENADOR,
      RoleName.MERENDEIRA,
      RoleName.ASSISTENTE_ALUNO,
    ];
  }
  return [];
}

/**
 * Escolas que o usuário pode administrar/atribuir a outros usuários.
 * `null` significa "todas" (apenas administrador global).
 */
export function manageableSchoolIds(user: AuthUser): string[] | null {
  return isSuperAdmin(user) ? null : user.schoolIds;
}

/** True se o usuário pode operar na escola informada (admin tem acesso global). */
export function canAccessSchool(user: AuthUser, schoolId: string | undefined): boolean {
  if (isAdmin(user)) return true;
  if (!schoolId) return true; // operação sem escopo de escola específico
  return user.schoolIds.includes(schoolId);
}

/**
 * Decisão central de autorização.
 * - Administrador: acesso global (ignora vínculo e escopo).
 * - Demais: precisa possuir a permissão, respeitando moduleScope, e ter acesso à escola.
 */
export function can(user: AuthUser, permissionKey: string, ctx: AccessContext = {}): boolean {
  if (isAdmin(user)) return true;

  if (!canAccessSchool(user, ctx.schoolId)) return false;

  const matches = user.permissions.filter((p) => p.key === permissionKey);
  if (matches.length === 0) return false;

  // Se a operação tem módulo, a permissão precisa ser sem escopo OU do mesmo módulo.
  if (ctx.module) {
    return matches.some((p) => !p.moduleScope || p.moduleScope === ctx.module);
  }
  return true;
}

/** Constrói o filtro de escola para consultas (isolamento multi-escola). */
export function schoolScopeFilter(user: AuthUser): { schoolId?: { in: string[] } } {
  if (isAdmin(user)) return {};
  return { schoolId: { in: user.schoolIds } };
}

const ALL_MODULES: ModuleType[] = [ModuleType.FOOD, ModuleType.SCHOOL_MATERIAL];

/**
 * Módulos que o usuário pode visualizar. Usa `item.view` como proxy do acesso a
 * cada módulo (os papéis têm as permissões espelhadas por módulo). Administrador
 * global enxerga ambos.
 */
export function visibleModules(user: AuthUser, schoolId?: string): ModuleType[] {
  if (isAdmin(user)) return ALL_MODULES;
  return ALL_MODULES.filter((module) => can(user, 'item.view', { schoolId, module }));
}

/**
 * Resolve os módulos a filtrar numa listagem: interseção entre os visíveis pelo
 * usuário e o módulo solicitado (quando informado). Lista vazia => a consulta
 * não deve retornar nada (o usuário pediu um módulo ao qual não tem acesso).
 * Impede o bypass de escopo por omissão do parâmetro `module`.
 */
export function resolveVisibleModules(
  user: AuthUser,
  schoolId: string | undefined,
  requested?: ModuleType | null,
): ModuleType[] {
  const allowed = visibleModules(user, schoolId);
  return requested ? allowed.filter((m) => m === requested) : allowed;
}
