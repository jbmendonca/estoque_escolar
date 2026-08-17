// Definição do menu lateral. Cada item declara a permissão (e módulo) exigida.
// A sidebar apenas OCULTA o que o usuário não pode ver — a autorização real é no servidor.
import { ModuleType } from '@/modules/shared/enums';
import { can, type AuthUser } from '@/server/rbac';

export interface NavItem {
  label: string;
  href: string;
  permission?: string;
  module?: ModuleType;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAVIGATION: NavSection[] = [
  {
    title: 'Início',
    items: [{ label: 'Dashboard', href: '/dashboard', permission: 'dashboard.view' }],
  },
  {
    title: 'Merenda Escolar',
    items: [
      { label: 'Estoque', href: '/merenda/estoque', permission: 'item.view', module: ModuleType.FOOD },
      { label: 'Entradas', href: '/merenda/entradas', permission: 'movement.create', module: ModuleType.FOOD },
      { label: 'Saídas', href: '/merenda/saidas', permission: 'movement.create', module: ModuleType.FOOD },
      { label: 'Lotes e Validades', href: '/merenda/lotes', permission: 'item.view', module: ModuleType.FOOD },
      { label: 'Movimentações', href: '/merenda/movimentacoes', permission: 'movement.view', module: ModuleType.FOOD },
      { label: 'Consumo diário', href: '/merenda/consumo-diario', permission: 'report.view', module: ModuleType.FOOD },
      { label: 'Relatórios', href: '/merenda/relatorios', permission: 'report.view', module: ModuleType.FOOD },
    ],
  },
  {
    title: 'Materiais Escolares',
    items: [
      { label: 'Estoque', href: '/materiais/estoque', permission: 'item.view', module: ModuleType.SCHOOL_MATERIAL },
      { label: 'Entradas', href: '/materiais/entradas', permission: 'movement.create', module: ModuleType.SCHOOL_MATERIAL },
      { label: 'Distribuições/Saídas', href: '/materiais/distribuicoes', permission: 'movement.create', module: ModuleType.SCHOOL_MATERIAL },
      { label: 'Movimentações', href: '/materiais/movimentacoes', permission: 'movement.view', module: ModuleType.SCHOOL_MATERIAL },
      { label: 'Relatórios', href: '/materiais/relatorios', permission: 'report.view', module: ModuleType.SCHOOL_MATERIAL },
    ],
  },
  {
    title: 'Compras e Sugestões',
    items: [
      { label: 'Painel de compras', href: '/compras', permission: 'purchase.view' },
      { label: 'Lista inteligente', href: '/compras/sugestoes', permission: 'purchase.view' },
      { label: 'Solicitações', href: '/compras/solicitacoes', permission: 'purchase.view' },
      { label: 'Listas de compras', href: '/compras/listas', permission: 'purchase.view' },
    ],
  },
  {
    title: 'Administração',
    items: [
      { label: 'Escolas', href: '/admin/escolas', permission: 'school.manage' },
      { label: 'Usuários', href: '/admin/usuarios', permission: 'user.manage' },
      { label: 'Auditoria', href: '/admin/auditoria', permission: 'audit.view' },
    ],
  },
];

/** Filtra o menu conforme as permissões efetivas do usuário. */
export function visibleNavigation(user: AuthUser, schoolId?: string): NavSection[] {
  return NAVIGATION.map((section) => ({
    title: section.title,
    items: section.items.filter(
      (item) => !item.permission || can(user, item.permission, { schoolId, module: item.module }),
    ),
  })).filter((section) => section.items.length > 0);
}
