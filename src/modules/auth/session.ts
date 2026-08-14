// Sessão por cookie assinado, HttpOnly + Secure + SameSite (iron-session).
import { getIronSession, type SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';

export interface SessionData {
  userId?: string;
  /** Escola em contexto quando o usuário pertence a várias. */
  activeSchoolId?: string;
}

const password = process.env.SESSION_SECRET ?? '';

export const sessionOptions: SessionOptions = {
  password,
  cookieName: 'estoque_escolar_session',
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8, // 8 horas
  },
};

export async function getSession() {
  if (!password || password.length < 32) {
    throw new Error('SESSION_SECRET ausente ou muito curto (mínimo 32 caracteres).');
  }
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}
