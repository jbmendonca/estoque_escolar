// Guardas reutilizáveis de autenticação/autorização para Route Handlers e Server Actions.
// Regra: autorização SEMPRE verificada no servidor (nunca apenas ocultando botões).
import { AppError } from '@/lib/errors';
import { getCurrentUser } from '@/server/current-user';
import { can, type AccessContext, type AuthUser } from '@/server/rbac';

export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AppError('UNAUTHENTICATED', 'É necessário entrar no sistema para continuar.');
  }
  return user;
}

/**
 * Exige uma permissão no contexto informado (escola/módulo).
 * Lança FORBIDDEN quando negado — inclusive por acesso a escola não vinculada.
 */
export async function requirePermission(
  permissionKey: string,
  ctx: AccessContext = {},
): Promise<AuthUser> {
  const user = await requireAuth();
  if (!can(user, permissionKey, ctx)) {
    throw new AppError('FORBIDDEN', 'Você não possui autorização para esta operação.', {
      permission: permissionKey,
    });
  }
  return user;
}

/** Resolve a escola alvo: usa a informada (validando acesso) ou a única do usuário. */
export function resolveSchoolId(user: AuthUser, requested?: string | null): string {
  if (requested) return requested;
  const first = user.schoolIds[0];
  if (!first) {
    throw new AppError('BAD_REQUEST', 'Informe a escola para esta operação.');
  }
  return first;
}
