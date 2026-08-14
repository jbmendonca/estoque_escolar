// Helpers de HTTP: parsing de query de listagem e resposta padronizada.
import { z } from 'zod';

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  // Ordenação alfabética por nome é o padrão do sistema (FR-010).
  sort: z.string().default('name:asc'),
  q: z.string().optional(),
});

export type ListQuery = z.infer<typeof listQuerySchema>;

/** Extrai os parâmetros de listagem da URL, aplicando limites seguros. */
export function parseListQuery(url: URL): ListQuery {
  return listQuerySchema.parse({
    page: url.searchParams.get('page') ?? undefined,
    pageSize: url.searchParams.get('pageSize') ?? undefined,
    sort: url.searchParams.get('sort') ?? undefined,
    q: url.searchParams.get('q') ?? undefined,
  });
}

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function paginated<T>(data: T[], total: number, page: number, pageSize: number): Paginated<T> {
  return { data, page, pageSize, total, totalPages: Math.ceil(total / pageSize) || 1 };
}
