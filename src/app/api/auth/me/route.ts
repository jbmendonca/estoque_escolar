import { NextResponse } from 'next/server';
import { getCurrentUser, getCurrentUserProfile } from '@/server/current-user';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Sessão não encontrada.' } },
      { status: 401 },
    );
  }
  const profile = await getCurrentUserProfile();
  const schools = await prisma.school.findMany({
    where: user.roles.includes('ADMINISTRADOR') ? {} : { id: { in: user.schoolIds } },
    select: { id: true, name: true, code: true },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json({
    user: profile,
    roles: user.roles,
    permissions: user.permissions,
    schools,
  });
}
