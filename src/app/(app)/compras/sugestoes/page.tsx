import { AppError } from '@/lib/errors';
import {
  CATEGORY_GROUP_LABEL,
  groupsForModule,
  PURCHASE_DEFAULTS,
} from '@/modules/compras/constants';
import { getSuggestions } from '@/modules/compras/suggestion-service';
import { visibleModules } from '@/modules/dashboard/analytics-service';
import { CategoryGroup, ModuleType } from '@/modules/shared/enums';
import { requireAuth } from '@/server/guard';
import { can } from '@/server/rbac';
import { SuggestionTable } from '@/components/compras/SuggestionTable';

export const dynamic = 'force-dynamic';

const PERIODS = [30, 90, 180] as const;

const MODULE_LABEL: Record<ModuleType, string> = {
  FOOD: 'Merenda escolar',
  SCHOOL_MATERIAL: 'Materiais escolares',
};

/**
 * Lista de compras inteligente: materiais abaixo do estoque mínimo (ou prestes a
 * acabar), com quantidade sugerida, prioridade e seleção múltipla para gerar a lista.
 */
export default async function SugestoesPage({
  searchParams,
}: {
  searchParams: Promise<{ modulo?: string; grupo?: string; periodo?: string }>;
}) {
  const user = await requireAuth();
  const params = await searchParams;
  const schoolId = user.schoolIds[0];

  if (!can(user, 'purchase.view', { schoolId })) {
    throw new AppError('FORBIDDEN', 'Você não possui autorização para acessar as compras.');
  }

  const allowed = visibleModules(user, schoolId);
  if (allowed.length === 0) {
    throw new AppError('FORBIDDEN', 'Você não possui acesso a nenhum módulo de estoque.');
  }

  // Merendeira só enxerga merenda; Assistente de Aluno, só materiais.
  const requested = params.modulo as ModuleType | undefined;
  const module = requested && allowed.includes(requested) ? requested : allowed[0]!;

  const days = PERIODS.includes(Number(params.periodo) as (typeof PERIODS)[number])
    ? Number(params.periodo)
    : PURCHASE_DEFAULTS.analysisDays;

  const groupParam = params.grupo as CategoryGroup | undefined;
  const categoryGroup =
    groupParam && groupsForModule(module).includes(groupParam) ? groupParam : undefined;

  const suggestions = await getSuggestions(user, [module], { days, categoryGroup });
  const canGenerate = can(user, 'purchase.manage', { schoolId, module });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Lista de compras inteligente</h1>
        <p className="mt-1 text-sm text-slate-600">
          Considera estoque atual, estoque mínimo, consumo médio dos últimos {days} dias e o que já
          foi solicitado. Marque os itens desejados para gerar a lista.
        </p>
      </header>

      <form method="get" action="/compras/sugestoes" className="flex flex-wrap items-end gap-2">
        {allowed.length > 1 && (
          <div>
            <label htmlFor="modulo" className="block text-xs font-medium text-slate-600">
              Módulo
            </label>
            <select id="modulo" name="modulo" defaultValue={module} className={FIELD}>
              {allowed.map((m) => (
                <option key={m} value={m}>
                  {MODULE_LABEL[m]}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label htmlFor="grupo" className="block text-xs font-medium text-slate-600">
            Categoria
          </label>
          <select id="grupo" name="grupo" defaultValue={categoryGroup ?? ''} className={FIELD}>
            <option value="">Todas as categorias</option>
            {groupsForModule(module).map((g) => (
              <option key={g} value={g}>
                {CATEGORY_GROUP_LABEL[g]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="periodo" className="block text-xs font-medium text-slate-600">
            Histórico analisado
          </label>
          <select id="periodo" name="periodo" defaultValue={String(days)} className={FIELD}>
            {PERIODS.map((p) => (
              <option key={p} value={p}>
                Últimos {p} dias
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Aplicar
        </button>
      </form>

      <SuggestionTable
        suggestions={suggestions}
        module={module}
        canGenerate={canGenerate}
        days={days}
      />
    </div>
  );
}

const FIELD = 'mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm';
