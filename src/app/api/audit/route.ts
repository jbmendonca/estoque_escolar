import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { toErrorResponse } from '@/lib/errors';
import { paginated } from '@/lib/http';
import { requirePermission } from '@/server/guard';
import { isAdmin } from '@/server/rbac';

export async function GET(request: Request) {
  try {
    const user = await requirePermission('audit.view');
    const url = new URL(request.url);

    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize') ?? 20)));
    const action = url.searchParams.get('action') ?? undefined;
    const resource = url.searchParams.get('resource') ?? undefined;

    const where = {
      // Admin vê tudo; demais só a(s) própria(s) escola(s).
      ...(isAdmin(user) ? {} : { schoolId: { in: user.schoolIds } }),
      ...(action ? { action: action as never } : {}),
      ...(resource ? { resource } : {}),
    };

    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { user: { select: { name: true, email: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return NextResponse.json(paginated(data, total, page, pageSize));
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
