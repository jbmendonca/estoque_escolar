// Auditoria independente do histórico de movimentações (append-only).
// Registra ações críticas e alterações administrativas.
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export type AuditActionKey =
  | 'LOGIN'
  | 'LOGIN_FAILED'
  | 'USER_CREATE'
  | 'USER_UPDATE'
  | 'ITEM_CREATE'
  | 'ITEM_UPDATE'
  | 'MOVEMENT'
  | 'ADJUSTMENT'
  | 'ADJUSTMENT_REVIEW'
  | 'CANCELLATION'
  | 'PERMISSION_CHANGE'
  | 'SCHOOL_CREATE'
  | 'SCHOOL_UPDATE'
  | 'PURCHASE_REQUEST'
  | 'PURCHASE_REVIEW'
  | 'PURCHASE_LIST';

export interface AuditInput {
  userId?: string | null;
  schoolId?: string | null;
  action: AuditActionKey;
  resource: string;
  resourceId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
}

/**
 * Grava um evento de auditoria. Aceita um cliente de transação para que o
 * registro participe da mesma transação da operação auditada.
 */
export async function writeAuditLog(
  input: AuditInput,
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<void> {
  await client.auditLog.create({
    data: {
      userId: input.userId ?? null,
      schoolId: input.schoolId ?? null,
      action: input.action,
      resource: input.resource,
      resourceId: input.resourceId ?? null,
      before: (input.before ?? null) as Prisma.InputJsonValue,
      after: (input.after ?? null) as Prisma.InputJsonValue,
      ip: input.ip ?? null,
    },
  });
}
