// Validação (Zod) da entrada de movimentação na fronteira da API/Server Actions.
import { z } from 'zod';
import { ModuleType, MovementType, DistributionTargetValues } from '@/modules/movimentacoes/constants';

/**
 * Datas "somente data" (validade/fabricação) são normalizadas para meia-noite UTC,
 * evitando que o fuso local desloque o dia do vencimento.
 */
const dateOnly = z.union([z.string(), z.date()]).transform((value, ctx) => {
  if (value instanceof Date) return value;
  const isoDateOnly = /^\d{4}-\d{2}-\d{2}$/;
  const parsed = isoDateOnly.test(value) ? new Date(`${value}T00:00:00.000Z`) : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Data inválida.' });
    return z.NEVER;
  }
  return parsed;
});

const batchInputSchema = z.object({
  batchNumber: z.string().min(1, 'Informe o número do lote.'),
  expiryDate: dateOnly,
  manufactureDate: dateOnly.optional(),
  supplierId: z.string().optional(),
  receivedAt: dateOnly.optional(),
});

const movementItemSchema = z.object({
  itemId: z.string().min(1),
  quantity: z.number().positive('A quantidade deve ser maior que zero.'),
  foodBatchId: z.string().optional(),
  batchInput: batchInputSchema.optional(),
});

export const createMovementSchema = z
  .object({
    module: z.nativeEnum(ModuleType),
    type: z.nativeEnum(MovementType),
    justification: z.string().trim().min(1).max(1000).optional(),
    notes: z.string().max(1000).optional(),
    referenceDocument: z.string().max(200).optional(),
    distributionTarget: z.enum(DistributionTargetValues).optional(),
    distributionTargetLabel: z.string().max(200).optional(),
    signedDelta: z.number().optional(),
    items: z.array(movementItemSchema).min(1, 'Informe ao menos um item.'),
  })
  .superRefine((data, ctx) => {
    const justificationRequired: MovementType[] = [
      MovementType.PERDA,
      MovementType.AVARIA,
      MovementType.PRODUTO_VENCIDO,
      MovementType.AJUSTE,
    ];
    if (justificationRequired.includes(data.type) && !data.justification) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['justification'],
        message: 'Justificativa é obrigatória para este tipo de movimentação.',
      });
    }
    // Entrada de alimento exige controle de lote (número + validade).
    if (data.module === ModuleType.FOOD && data.type === MovementType.ENTRADA) {
      data.items.forEach((item, idx) => {
        if (!item.batchInput) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['items', idx, 'batchInput'],
            message: 'Entrada de alimento exige informar lote e validade.',
          });
        }
      });
    }
  });

export type CreateMovementInput = z.infer<typeof createMovementSchema>;
