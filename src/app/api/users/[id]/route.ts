import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AppError, toErrorResponse } from '@/lib/errors';
import { updateUser } from '@/modules/usuarios/user-service';
import { requirePermission } from '@/server/guard';

const updateUserBody = z.object({
  name: z.string().trim().min(1).optional(),
  active: z.boolean().optional(),
  roleIds: z.array(z.string()).optional(),
  schoolIds: z.array(z.string()).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission('user.manage');
    const { id } = await params;

    const parsed = updateUserBody.safeParse(await request.json());
    if (!parsed.success) {
      throw new AppError('VALIDATION', 'Dados do usuário inválidos.', {
        issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }

    // Impede que o administrador desative a si mesmo e perca o acesso.
    if (parsed.data.active === false && id === actor.id) {
      throw new AppError('VALIDATION', 'Você não pode desativar o seu próprio usuário.');
    }

    const user = await updateUser(id, parsed.data, actor);
    return NextResponse.json(user);
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
