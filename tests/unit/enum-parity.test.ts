import { describe, it, expect } from 'vitest';
import { $Enums } from '@prisma/client';
import {
  ModuleType,
  MovementType,
  MovementDirection,
  ReviewStatus,
  CategoryGroup,
  PurchasePriority,
  PurchaseRequestStatus,
  PurchaseListStatus,
  PurchaseItemSource,
} from '@/modules/shared/enums';

// Os enums de domínio (shared/enums.ts) são declarados à mão para desacoplar do
// Prisma. Este contrato garante que nenhum valor divirja do schema do banco:
// acrescentar um valor no schema e esquecer o enum de domínio quebra AQUI, e não
// em produção.
const sorted = (o: Record<string, string>) => Object.values(o).sort();

describe('paridade de enums domínio ↔ Prisma', () => {
  const cases: Array<[string, Record<string, string>, Record<string, string>]> = [
    ['ModuleType', ModuleType, $Enums.ModuleType],
    ['MovementType', MovementType, $Enums.MovementType],
    ['MovementDirection', MovementDirection, $Enums.MovementDirection],
    ['ReviewStatus', ReviewStatus, $Enums.ReviewStatus],
    ['CategoryGroup', CategoryGroup, $Enums.CategoryGroup],
    ['PurchasePriority', PurchasePriority, $Enums.PurchasePriority],
    ['PurchaseRequestStatus', PurchaseRequestStatus, $Enums.PurchaseRequestStatus],
    ['PurchaseListStatus', PurchaseListStatus, $Enums.PurchaseListStatus],
    ['PurchaseItemSource', PurchaseItemSource, $Enums.PurchaseItemSource],
  ];

  it.each(cases)('%s tem os mesmos valores do schema', (_name, domain, prisma) => {
    expect(sorted(domain)).toEqual(sorted(prisma));
  });
});
