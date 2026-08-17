import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AppError, toErrorResponse } from '@/lib/errors';
import { requireAuth } from '@/server/guard';
import { getProfile, updateProfile } from '@/modules/usuarios/profile-service';

const patchSchema = z
  .object({
    name: z.string().trim().min(1, 'Informe o nome.').max(120).optional(),
    email: z.string().trim().email('Informe um e-mail válido.').max(160).optional(),
  })
  .refine((d) => d.name !== undefined || d.email !== undefined, {
    message: 'Nada para atualizar.',
  });

export async function GET() {
  try {
    const user = await requireAuth();
    return NextResponse.json(await getProfile(user.id));
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireAuth();
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new AppError('VALIDATION', 'Dados do perfil inválidos.', {
        issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    const updated = await updateProfile(user.id, {
      name: parsed.data.name,
      email: parsed.data.email?.toLowerCase(),
    });
    return NextResponse.json(updated);
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
