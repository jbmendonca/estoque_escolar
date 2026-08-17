import { NextResponse } from 'next/server';
import { toErrorResponse } from '@/lib/errors';
import { getSuggestions } from '@/modules/compras/suggestion-service';
import { visibleModules } from '@/modules/dashboard/analytics-service';
import { CategoryGroup, ModuleType } from '@/modules/shared/enums';
import { requirePermission } from '@/server/guard';

/** Lista de compras inteligente (sugestões calculadas, sem gravar nada). */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const moduleParam = url.searchParams.get('module') as ModuleType | null;
    const schoolId = url.searchParams.get('schoolId') ?? undefined;

    const user = await requirePermission('purchase.view', {
      schoolId,
      module: moduleParam ?? undefined,
    });

    // Nunca devolve módulo que o usuário não pode ver (Merendeira ↔ Assistente).
    const allowed = visibleModules(user, schoolId ?? user.schoolIds[0]);
    const modules = moduleParam ? allowed.filter((m) => m === moduleParam) : allowed;

    const daysParam = Number(url.searchParams.get('days'));
    const groupParam = url.searchParams.get('categoryGroup');

    const data = await getSuggestions(user, modules, {
      days: Number.isFinite(daysParam) && daysParam > 0 ? daysParam : undefined,
      categoryGroup: groupParam ? (groupParam as CategoryGroup) : undefined,
    });

    return NextResponse.json({ data });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
