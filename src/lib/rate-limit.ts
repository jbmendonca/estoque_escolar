// Limitador de taxa em memória (janela fixa por chave). Suficiente para uma
// única instância da aplicação; com múltiplas réplicas atrás do Traefik, trocar
// por um store compartilhado (ex.: Redis) para que o limite seja global.

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  /** Segundos até a janela reabrir (0 quando permitido). */
  retryAfterSeconds: number;
}

/** Remove janelas expiradas para o mapa não crescer indefinidamente. */
function purgeExpired(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Consome uma tentativa para `key`. Permite até `limit` tentativas por janela
 * de `windowMs`. Não permitido => a janela está cheia.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): RateLimitResult {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size > 5000) purgeExpired(now);
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (bucket.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  bucket.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Zera o contador de uma chave (ex.: após autenticação bem-sucedida). */
export function rateLimitReset(key: string): void {
  buckets.delete(key);
}
