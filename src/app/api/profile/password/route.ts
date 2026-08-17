import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AppError, toErrorResponse } from '@/lib/errors';
import { requireAuth } from '@/server/guard';
import { changePassword } from '@/modules/usuarios/profile-service';

const schema = z.object({
  currentPassword: z.string().min(1, 'Informe a senha atual.'),
  newPassword: z
    .string()
    .min(8, 'A nova senha deve ter ao menos 8 caracteres.')
    .max(200),
});

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      throw new AppError('VALIDATION', 'Dados inválidos.', {
        issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    await changePassword(user.id, parsed.data.currentPassword, parsed.data.newPassword);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
