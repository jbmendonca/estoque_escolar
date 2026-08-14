import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AppError, toErrorResponse } from '@/lib/errors';
import { createUser, listUsers } from '@/modules/usuarios/user-service';
import { requirePermission } from '@/server/guard';

const createUserBody = z.object({
  name: z.string().trim().min(1, 'Informe o nome.'),
  email: z.string().trim().email('Informe um e-mail válido.').toLowerCase(),
  password: z.string().min(8, 'A senha deve ter ao menos 8 caracteres.'),
  roleIds: z.array(z.string()).min(1, 'Selecione ao menos um perfil.'),
  schoolIds: z.array(z.string()).default([]),
});

export async function GET() {
  try {
    const actor = await requirePermission('user.manage');
    // Escopo de tenant: administrador de escola só enxerga usuários da sua escola.
    const data = await listUsers(actor);
    return NextResponse.json({ data });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requirePermission('user.manage');
    const parsed = createUserBody.safeParse(await request.json());
    if (!parsed.success) {
      throw new AppError('VALIDATION', 'Dados do usuário inválidos.', {
        issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }

    const user = await createUser(parsed.data, actor);
    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
