import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AppError, toErrorResponse } from '@/lib/errors';
import { requireAuth } from '@/server/guard';
import { updateAvatar } from '@/modules/usuarios/profile-service';

// avatarUrl: data URI (validado no serviço) ou null para remover a foto.
const schema = z.object({
  avatarUrl: z.string().max(800_000).nullable(),
});

export async function PUT(request: Request) {
  try {
    const user = await requireAuth();
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      throw new AppError('VALIDATION', 'Imagem inválida.');
    }
    const updated = await updateAvatar(user.id, parsed.data.avatarUrl);
    return NextResponse.json(updated);
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
