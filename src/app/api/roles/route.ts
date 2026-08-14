import { NextResponse } from 'next/server';
import { toErrorResponse } from '@/lib/errors';
import { listRoles } from '@/modules/usuarios/user-service';
import { requirePermission } from '@/server/guard';

export async function GET() {
  try {
    const actor = await requirePermission('user.manage');
    // Devolve apenas os perfis que este usuário pode atribuir.
    const data = await listRoles(actor);
    return NextResponse.json({ data });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
