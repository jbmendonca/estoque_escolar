// Incremento atômico de sequências de código dentro de uma transação.
// `scope` é único: sequências globais usam o nome puro ("ITEM_MER"),
// sequências por escola embutem o id ("MOVEMENT:<schoolId>").
import type { Prisma } from '@prisma/client';
import { AppError } from '@/lib/errors';
import { itemSequenceScope } from '@/modules/catalogo/code';
import type { ModuleType } from '@/modules/shared/enums';

type Tx = Prisma.TransactionClient;

export function movementScope(schoolId: string): string {
  return `MOVEMENT:${schoolId}`;
}

export function itemScope(module: ModuleType): string {
  return itemSequenceScope(module);
}

/**
 * Reserva o próximo valor da sequência de forma atômica (UPSERT + RETURNING).
 * Concorrência segura: o UPDATE serializa na linha da sequência.
 */
export async function nextSequenceValue(tx: Tx, scope: string): Promise<number> {
  const rows = await tx.$queryRaw<Array<{ nextValue: number }>>`
    INSERT INTO "CodeSequence" ("id", "scope", "nextValue", "updatedAt")
    VALUES (gen_random_uuid()::text, ${scope}, 2, NOW())
    ON CONFLICT ("scope")
    DO UPDATE SET "nextValue" = "CodeSequence"."nextValue" + 1, "updatedAt" = NOW()
    RETURNING ("CodeSequence"."nextValue" - 1) AS "nextValue"
  `;
  const value = rows[0]?.nextValue;
  if (value === undefined) {
    throw new AppError('CONFLICT', 'Falha ao gerar código sequencial.');
  }
  return Number(value);
}
