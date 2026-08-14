import { NextResponse } from 'next/server';
import { getSession } from '@/modules/auth/session';

export async function POST() {
  const session = await getSession();
  session.destroy();
  return new NextResponse(null, { status: 204 });
}
