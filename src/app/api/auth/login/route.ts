import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { hashPassword, verifyPassword } from '@/modules/auth/password';
import { getSession } from '@/modules/auth/session';
import { toErrorResponse } from '@/lib/errors';
import { writeAuditLog } from '@/modules/auditoria/audit-service';
import { rateLimit, rateLimitReset } from '@/lib/rate-limit';

const loginSchema = z.object({
  email: z.string().email('Informe um e-mail válido.'),
  password: z.string().min(1, 'Informe a senha.'),
});

// Janela de proteção contra força bruta.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_IP = 20;
const MAX_PER_EMAIL = 8;

function clientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]?.trim() || 'desconhecido';
  return request.headers.get('x-real-ip') ?? 'desconhecido';
}

export async function POST(request: Request) {
  try {
    const ip = clientIp(request);

    // Limite por IP primeiro (barra varredura ampla sem tocar no banco).
    const byIp = rateLimit(`login:ip:${ip}`, MAX_PER_IP, WINDOW_MS);
    if (!byIp.allowed) {
      return tooManyRequests(byIp.retryAfterSeconds);
    }

    const body = await request.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION', message: 'Dados inválidos.' } },
        { status: 422 },
      );
    }

    const email = parsed.data.email.toLowerCase();
    const byEmail = rateLimit(`login:email:${email}`, MAX_PER_EMAIL, WINDOW_MS);
    if (!byEmail.allowed) {
      return tooManyRequests(byEmail.retryAfterSeconds);
    }

    const user = await prisma.user.findUnique({ where: { email } });
    // Mensagem genérica: não revela se o e-mail existe.
    const invalid = NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'E-mail ou senha incorretos.' } },
      { status: 401 },
    );

    // Contra timing/enumeração: mesmo sem usuário (ou inativo), gasta o custo do
    // Argon2 para que a resposta demore o mesmo de uma senha incorreta.
    if (!user || !user.active) {
      await hashPassword(parsed.data.password);
      await recordFailedLogin(email, ip);
      return invalid;
    }

    const ok = await verifyPassword(user.passwordHash, parsed.data.password);
    if (!ok) {
      await recordFailedLogin(email, ip, user.id);
      return invalid;
    }

    const session = await getSession();
    session.userId = user.id;
    await session.save();

    // Sucesso: libera os contadores desta identidade.
    rateLimitReset(`login:email:${email}`);
    rateLimitReset(`login:ip:${ip}`);

    await writeAuditLog({
      userId: user.id,
      action: 'LOGIN',
      resource: 'User',
      resourceId: user.id,
      ip,
    });

    return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email } });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

function tooManyRequests(retryAfterSeconds: number) {
  return NextResponse.json(
    {
      error: {
        code: 'RATE_LIMITED',
        message: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
      },
    },
    { status: 429, headers: { 'Retry-After': String(Math.max(1, retryAfterSeconds)) } },
  );
}

/** Registra a falha de login na trilha de auditoria (nunca grava a senha). */
async function recordFailedLogin(email: string, ip: string, userId?: string): Promise<void> {
  try {
    await writeAuditLog({
      userId: userId ?? null,
      action: 'LOGIN_FAILED',
      resource: 'User',
      resourceId: userId ?? null,
      after: { email, ip },
      ip,
    });
  } catch {
    // Auditoria de falha nunca deve mascarar o 401 nem derrubar o fluxo.
  }
}
