// Hash de senha com argon2id (padrão recomendado). Nunca armazenar senha em texto claro.
import { hash, verify } from '@node-rs/argon2';

const OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
} as const;

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTIONS);
}

export async function verifyPassword(passwordHash: string, plain: string): Promise<boolean> {
  try {
    return await verify(passwordHash, plain, OPTIONS);
  } catch {
    return false;
  }
}
