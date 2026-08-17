// Contratos de entrada do módulo de compras (validação com zod).
import { z } from 'zod';
import {
  CategoryGroup,
  ModuleType,
  PurchaseItemSource,
  PurchaseListStatus,
  PurchasePriority,
  PurchaseRequestStatus,
} from '@/modules/shared/enums';

export const createPurchaseRequestSchema = z
  .object({
    module: z.nativeEnum(ModuleType),
    /** Item do catálogo... */
    itemId: z.string().min(1).optional(),
    /** ...ou descrição livre, quando o material ainda não é cadastrado. */
    itemDescription: z
      .string()
      .trim()
      .min(3, 'Descreva o material solicitado.')
      .max(300, 'Descrição muito longa (máx. 300 caracteres).')
      .optional(),
    categoryGroup: z.nativeEnum(CategoryGroup).optional(),
    quantity: z.number().positive('Informe uma quantidade maior que zero.'),
    justification: z
      .string()
      .trim()
      .min(5, 'Descreva a justificativa da solicitação.')
      .max(1000, 'Justificativa muito longa (máx. 1000 caracteres).'),
    priority: z.nativeEnum(PurchasePriority).optional(),
    schoolId: z.string().optional(),
  })
  .refine((data) => Boolean(data.itemId || data.itemDescription), {
    message: 'Selecione um item do catálogo ou descreva o material.',
    path: ['itemId'],
  });

export type CreatePurchaseRequestInput = z.infer<typeof createPurchaseRequestSchema>;

const TERMINAL_NOTE_STATUSES: PurchaseRequestStatus[] = [
  PurchaseRequestStatus.REJEITADA,
  PurchaseRequestStatus.CANCELADA,
];

export const transitionPurchaseRequestSchema = z
  .object({
    status: z.nativeEnum(PurchaseRequestStatus),
    note: z.string().trim().min(3).max(1000).optional(),
  })
  .superRefine((data, ctx) => {
    // Rejeitar ou cancelar exige motivo registrado (trilha de auditoria).
    if (TERMINAL_NOTE_STATUSES.includes(data.status) && !data.note) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['note'],
        message: 'Informe o motivo da rejeição ou cancelamento.',
      });
    }
  });

export type TransitionPurchaseRequestInput = z.infer<typeof transitionPurchaseRequestSchema>;

export const createPurchaseListSchema = z
  .object({
    module: z.nativeEnum(ModuleType),
    schoolId: z.string().optional(),
    title: z.string().trim().min(1).max(200).optional(),
    notes: z.string().trim().min(1).max(1000).optional(),
    /** Janela de consumo usada nas sugestões desta lista. */
    days: z.number().int().min(7).max(365).optional(),
    /** Itens escolhidos na lista de sugestões (quantidade sugerida pelo sistema). */
    items: z
      .array(
        z.object({
          itemId: z.string().min(1),
          quantity: z.number().positive().optional(),
          source: z.nativeEnum(PurchaseItemSource).optional(),
          notes: z.string().trim().min(1).optional(),
        }),
      )
      .default([]),
    /** Solicitações aprovadas a incorporar na mesma lista. */
    requestIds: z.array(z.string().min(1)).default([]),
  })
  .refine((data) => data.items.length > 0 || data.requestIds.length > 0, {
    message: 'Selecione ao menos um item ou solicitação para gerar a lista.',
    path: ['items'],
  });

export type CreatePurchaseListInput = z.infer<typeof createPurchaseListSchema>;

export const updatePurchaseListSchema = z.object({
  status: z.nativeEnum(PurchaseListStatus),
});
