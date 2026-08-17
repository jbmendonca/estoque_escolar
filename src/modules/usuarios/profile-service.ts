// Autoatendimento de perfil: cada usuário edita apenas os PRÓPRIOS dados.
// Nenhuma permissão administrativa é exigida — só autenticação (o userId vem
// sempre da sessão, nunca do corpo da requisição).
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/errors';
import { hashPassword, verifyPassword } from '@/modules/auth/password';
import { writeAuditLog } from '@/modules/auditoria/audit-service';

const MAX_AVATAR_BYTES = 512 * 1024; // ~512 KB do data URI (após redução no cliente)
const AVATAR_PREFIX = /^data:image\/(png|jpeg|jpg|webp);base64,/;

export interface ProfileView {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

export async function getProfile(userId: string): Promise<ProfileView> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, avatarUrl: true },
  });
  if (!user) throw new AppError('NOT_FOUND', 'Usuário não encontrado.');
  return user;
}

/** Atualiza nome e/ou e-mail do próprio usuário (e-mail é o login: único). */
export async function updateProfile(
  userId: string,
  data: { name?: string; email?: string },
): Promise<ProfileView> {
  const before = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });
  if (!before) throw new AppError('NOT_FOUND', 'Usuário não encontrado.');

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: userId },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.email !== undefined ? { email: data.email } : {}),
        },
        select: { id: true, name: true, email: true, avatarUrl: true },
      });
      await writeAuditLog(
        {
          userId,
          action: 'USER_UPDATE',
          resource: 'User',
          resourceId: userId,
          before: { name: before.name, email: before.email },
          after: { name: user.name, email: user.email },
        },
        tx,
      );
      return user;
    });
    return updated;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AppError('CONFLICT', 'Já existe um usuário com este e-mail.');
    }
    throw err;
  }
}

/** Troca a senha do próprio usuário, exigindo a senha atual. */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!user) throw new AppError('NOT_FOUND', 'Usuário não encontrado.');

  const ok = await verifyPassword(user.passwordHash, currentPassword);
  if (!ok) throw new AppError('VALIDATION', 'A senha atual está incorreta.');

  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { passwordHash } });
    await writeAuditLog(
      { userId, action: 'USER_UPDATE', resource: 'User', resourceId: userId, after: { passwordChanged: true } },
      tx,
    );
  });
}

/** Define ou remove a imagem de perfil (data URI). Passe null para remover. */
export async function updateAvatar(userId: string, avatarUrl: string | null): Promise<ProfileView> {
  if (avatarUrl !== null) {
    if (!AVATAR_PREFIX.test(avatarUrl)) {
      throw new AppError('VALIDATION', 'Imagem inválida. Envie um arquivo PNG, JPEG ou WebP.');
    }
    // Tamanho aproximado do binário a partir do base64.
    const base64 = avatarUrl.slice(avatarUrl.indexOf(',') + 1);
    const bytes = Math.floor((base64.length * 3) / 4);
    if (bytes > MAX_AVATAR_BYTES) {
      throw new AppError('VALIDATION', 'Imagem muito grande. Use uma foto menor.');
    }
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl },
    select: { id: true, name: true, email: true, avatarUrl: true },
  });
  return user;
}
