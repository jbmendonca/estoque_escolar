// Carrega o usuário autenticado com papéis, permissões efetivas e escolas vinculadas.
import { prisma } from '@/lib/prisma';
import { getSession } from '@/modules/auth/session';
import type { AuthUser } from '@/server/rbac';

export async function getCurrentUser(): Promise<AuthUser | null> {
  const session = await getSession();
  if (!session.userId) return null;
  return loadAuthUser(session.userId);
}

export async function loadAuthUser(userId: string): Promise<AuthUser | null> {
  const user = await prisma.user.findFirst({
    where: { id: userId, active: true },
    include: {
      roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
      schools: { where: { active: true } },
    },
  });
  if (!user) return null;

  const roles = user.roles.map((ur) => ur.role.name);
  // Permissões escopadas são persistidas como "chave:MODULO" (a chave é única no banco).
  // Aqui normalizamos de volta para { key, moduleScope } consumido pela política RBAC.
  const permissions = user.roles.flatMap((ur) =>
    ur.role.permissions.map((rp) => {
      const [baseKey] = rp.permission.key.split(':');
      return {
        key: baseKey ?? rp.permission.key,
        moduleScope: rp.permission.moduleScope,
      };
    }),
  );

  return {
    id: user.id,
    roles,
    schoolIds: user.schools.map((us) => us.schoolId),
    permissions,
  };
}

/** Dados de exibição do usuário (nome/e-mail) para a UI. */
export async function getCurrentUserProfile() {
  const session = await getSession();
  if (!session.userId) return null;
  return prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, avatarUrl: true },
  });
}
