import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/modules/auth/password';
import { getSession } from '@/modules/auth/session';
import { toErrorResponse } from '@/lib/errors';

const loginSchema = z.object({
  email: z.string().email('Informe um e-mail válido.'),
  password: z.string().min(1, 'Informe a senha.'),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION', message: 'Dados inválidos.' } },
        { status: 422 },
      );
    }

    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    // Mensagem genérica: não revela se o e-mail existe.
    const invalid = NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'E-mail ou senha incorretos.' } },
      { status: 401 },
    );
    if (!user || !user.active) return invalid;

    const ok = await verifyPassword(user.passwordHash, parsed.data.password);
    if (!ok) return invalid;

    const session = await getSession();
    session.userId = user.id;
    await session.save();

    await prisma.auditLog.create({
      data: { userId: user.id, action: 'LOGIN', resource: 'User', resourceId: user.id },
    });

    return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email } });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
