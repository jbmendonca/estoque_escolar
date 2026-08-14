import { NextResponse } from 'next/server';
import { toErrorResponse } from '@/lib/errors';
import { getExpiryAlerts } from '@/modules/lotes/food-batch-service';
import { requirePermission } from '@/server/guard';
import { ModuleType } from '@/modules/shared/enums';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const schoolId = url.searchParams.get('schoolId') ?? undefined;

    const user = await requirePermission('item.view', { schoolId, module: ModuleType.FOOD });
    const alerts = await getExpiryAlerts(user, schoolId);

    return NextResponse.json({
      nearExpiryDays: alerts.nearExpiryDays,
      expiredCount: alerts.expired.length,
      nearExpiryCount: alerts.nearExpiry.length,
      expired: alerts.expired,
      nearExpiry: alerts.nearExpiry,
    });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
