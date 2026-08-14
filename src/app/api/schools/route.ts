import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AppError, toErrorResponse } from '@/lib/errors';
import { createSchool, listSchools, provisionTenant } from '@/modules/escolas/school-service';
import { requirePermission } from '@/server/guard';

const TENANT_ROLES = [
  'ADMIN_ESCOLA',
  'GESTOR_ESCOLAR',
  'SECRETARIO',
  'COORDENADOR',
  'MERENDEIRA',
  'ASSISTENTE_ALUNO',
] as const;

const tenantUserSchema = z.object({
  role: z.enum(TENANT_ROLES),
  name: z.string().trim().min(1, 'Informe o nome do usuário.'),
  email: z.string().trim().email('E-mail inválido.').toLowerCase(),
  password: z.string().min(8, 'A senha deve ter ao menos 8 caracteres.'),
});

const createSchoolBody = z.object({
  name: z.string().trim().min(1, 'Informe o nome da escola.'),
  code: z.string().trim().min(1, 'Informe o código da escola.').toUpperCase(),
  address: z.string().trim().optional(),
  /** Quando informado, provisiona o tenant completo (escola + usuários + cadastros). */
  users: z.array(tenantUserSchema).optional(),
  seedCatalog: z.boolean().optional(),
});

export async function GET() {
  try {
    const user = await requirePermission('school.manage');
    const data = await listSchools(user);
    return NextResponse.json({ data });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requirePermission('school.manage');
    const parsed = createSchoolBody.safeParse(await request.json());
    if (!parsed.success) {
      throw new AppError('VALIDATION', 'Dados da escola inválidos.', {
        issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }

    // Com usuários → provisiona o tenant completo; sem → apenas a escola.
    if (parsed.data.users && parsed.data.users.length > 0) {
      const result = await provisionTenant(
        {
          name: parsed.data.name,
          code: parsed.data.code,
          address: parsed.data.address,
          users: parsed.data.users,
          seedCatalog: parsed.data.seedCatalog,
        },
        actor,
      );
      return NextResponse.json(result, { status: 201 });
    }

    const school = await createSchool(parsed.data, actor);
    return NextResponse.json(school, { status: 201 });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
