import { describe, it, expect } from 'vitest';
import {
  formatItemCode,
  formatMovementNumber,
  itemSequenceScope,
  assertItemCodeChangeAllowed,
} from '@/modules/catalogo/code';
import { AppError } from '@/lib/errors';
import { ModuleType } from '@/modules/shared/enums';

describe('Geração de código único', () => {
  it('formata código de merenda e material com prefixo e zero-padding', () => {
    expect(formatItemCode(ModuleType.FOOD, 1)).toBe('MER-000001');
    expect(formatItemCode(ModuleType.FOOD, 2)).toBe('MER-000002');
    expect(formatItemCode(ModuleType.SCHOOL_MATERIAL, 1)).toBe('MAT-000001');
    expect(formatItemCode(ModuleType.SCHOOL_MATERIAL, 123456)).toBe('MAT-123456');
  });

  it('gera número de movimentação', () => {
    expect(formatMovementNumber(123)).toBe('MOV-000123');
  });

  it('usa scopes de sequência distintos por módulo (não reutilizável entre módulos)', () => {
    expect(itemSequenceScope(ModuleType.FOOD)).toBe('ITEM_MER');
    expect(itemSequenceScope(ModuleType.SCHOOL_MATERIAL)).toBe('ITEM_MAT');
  });

  it('rejeita sequência inválida', () => {
    expect(() => formatItemCode(ModuleType.FOOD, 0)).toThrowError(AppError);
    expect(() => formatItemCode(ModuleType.FOOD, -1)).toThrowError(AppError);
  });

  it('bloqueia alteração de código quando há movimentação (imutável)', () => {
    expect(() => assertItemCodeChangeAllowed(false)).not.toThrow();
    try {
      assertItemCodeChangeAllowed(true);
      expect.unreachable();
    } catch (e) {
      expect((e as AppError).code).toBe('IMMUTABLE');
    }
  });
});
