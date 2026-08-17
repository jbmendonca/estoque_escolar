import { describe, it, expect } from 'vitest';
import { AppError } from '@/lib/errors';
import {
  assertTransition,
  availableActions,
  canCancelOwnRequest,
  canTransition,
  isFinalStatus,
  nextStatuses,
  permissionForTransition,
  stampsForTransition,
} from '@/modules/compras/request-workflow';
import { ModuleType, PurchaseRequestStatus, RoleName } from '@/modules/shared/enums';
import type { AuthUser } from '@/server/rbac';

const SCHOOL = 'school-A';

const professor: AuthUser = {
  id: 'u-prof',
  roles: [RoleName.COORDENADOR],
  schoolIds: [SCHOOL],
  permissions: [{ key: 'purchase.view' }, { key: 'purchase.request' }],
};

const gestor: AuthUser = {
  id: 'u-gestor',
  roles: [RoleName.GESTOR_ESCOLAR],
  schoolIds: [SCHOOL],
  permissions: [{ key: 'purchase.view' }, { key: 'purchase.approve' }, { key: 'purchase.manage' }],
};

const merendeira: AuthUser = {
  id: 'u-mer',
  roles: [RoleName.MERENDEIRA],
  schoolIds: [SCHOOL],
  permissions: [
    { key: 'purchase.view', moduleScope: ModuleType.FOOD },
    { key: 'purchase.request', moduleScope: ModuleType.FOOD },
  ],
};

function request(over: Partial<Parameters<typeof availableActions>[1]> = {}) {
  return {
    status: PurchaseRequestStatus.PENDENTE,
    schoolId: SCHOOL,
    module: ModuleType.SCHOOL_MATERIAL,
    requestedById: professor.id,
    ...over,
  };
}

describe('Fluxo da solicitação: pendente → aprovada → comprada → recebida', () => {
  it('segue a ordem do fluxo', () => {
    expect(canTransition('PENDENTE', 'APROVADA')).toBe(true);
    expect(canTransition('APROVADA', 'COMPRADA')).toBe(true);
    expect(canTransition('COMPRADA', 'RECEBIDA')).toBe(true);
  });

  it('não permite pular etapas', () => {
    expect(canTransition('PENDENTE', 'COMPRADA')).toBe(false);
    expect(canTransition('PENDENTE', 'RECEBIDA')).toBe(false);
    expect(canTransition('APROVADA', 'RECEBIDA')).toBe(false);
  });

  it('não permite voltar atrás', () => {
    expect(canTransition('APROVADA', 'PENDENTE')).toBe(false);
    expect(canTransition('RECEBIDA', 'COMPRADA')).toBe(false);
  });

  it('recebida, rejeitada e cancelada são finais', () => {
    expect(isFinalStatus('RECEBIDA')).toBe(true);
    expect(isFinalStatus('REJEITADA')).toBe(true);
    expect(isFinalStatus('CANCELADA')).toBe(true);
    expect(isFinalStatus('PENDENTE')).toBe(false);
  });

  it('rejeição só é possível enquanto pendente', () => {
    expect(nextStatuses('PENDENTE')).toContain('REJEITADA');
    expect(nextStatuses('COMPRADA')).not.toContain('REJEITADA');
  });
});

describe('Validação da transição', () => {
  it('exige motivo para rejeitar', () => {
    expect(() => assertTransition('PENDENTE', 'REJEITADA')).toThrow(AppError);
    expect(() =>
      assertTransition('PENDENTE', 'REJEITADA', { note: 'Sem orçamento' }),
    ).not.toThrow();
  });

  it('exige motivo para cancelar', () => {
    expect(() => assertTransition('PENDENTE', 'CANCELADA', { note: '   ' })).toThrow(AppError);
  });

  it('recusa transição inválida', () => {
    expect(() => assertTransition('PENDENTE', 'RECEBIDA')).toThrow(/Não é possível mudar/);
  });

  it('recusa repetir o mesmo status', () => {
    expect(() => assertTransition('APROVADA', 'APROVADA')).toThrow(/já está aprovada/);
  });
});

describe('Histórico de quem executou cada etapa', () => {
  const now = new Date('2026-08-14T12:00:00.000Z');

  it('grava quem aprovou, quem comprou e quem recebeu', () => {
    expect(stampsForTransition('APROVADA', 'u1', now)).toEqual({
      approvedById: 'u1',
      approvedAt: now,
    });
    expect(stampsForTransition('COMPRADA', 'u2', now)).toEqual({
      purchasedById: 'u2',
      purchasedAt: now,
    });
    expect(stampsForTransition('RECEBIDA', 'u3', now)).toEqual({
      receivedById: 'u3',
      receivedAt: now,
    });
  });

  it('rejeição e cancelamento não geram carimbo de execução', () => {
    expect(stampsForTransition('REJEITADA', 'u1', now)).toEqual({});
  });
});

describe('Autorização por etapa', () => {
  it('cada etapa exige a permissão correspondente', () => {
    expect(permissionForTransition('APROVADA')).toBe('purchase.approve');
    expect(permissionForTransition('COMPRADA')).toBe('purchase.manage');
    expect(permissionForTransition('RECEBIDA')).toBe('purchase.manage');
  });

  it('quem solicitou pode cancelar a própria solicitação pendente', () => {
    expect(canCancelOwnRequest('PENDENTE', professor.id, professor.id)).toBe(true);
    expect(canCancelOwnRequest('APROVADA', professor.id, professor.id)).toBe(false);
    expect(canCancelOwnRequest('PENDENTE', professor.id, 'outro')).toBe(false);
  });

  it('professor que solicitou só pode cancelar — não aprova a própria solicitação', () => {
    expect(availableActions(professor, request())).toEqual(['CANCELADA']);
  });

  it('gestor pode aprovar, rejeitar e cancelar uma solicitação pendente', () => {
    expect(availableActions(gestor, request())).toEqual(
      expect.arrayContaining(['APROVADA', 'REJEITADA', 'CANCELADA']),
    );
  });

  it('gestor avança a solicitação aprovada para comprada', () => {
    expect(availableActions(gestor, request({ status: PurchaseRequestStatus.APROVADA }))).toContain(
      'COMPRADA',
    );
  });

  it('merendeira não aprova solicitação de materiais escolares', () => {
    expect(availableActions(merendeira, request())).toEqual([]);
  });

  it('merendeira não aprova nem no seu próprio módulo (só solicita)', () => {
    const foodRequest = request({ module: ModuleType.FOOD, requestedById: 'outro' });
    expect(availableActions(merendeira, foodRequest)).toEqual([]);
  });

  it('nada a fazer quando a solicitação já está encerrada', () => {
    expect(availableActions(gestor, request({ status: PurchaseRequestStatus.RECEBIDA }))).toEqual(
      [],
    );
  });
});
