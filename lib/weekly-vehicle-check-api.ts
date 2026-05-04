import 'server-only';

import { listPromotorMileage } from '@/lib/api/promotor';
import { getWeeklyVehicleCheckDateContext } from '@/lib/weekly-vehicle-check';

function decodeJwtSubject(token: string) {
  const parts = token.split('.');

  if (parts.length < 2) {
    return null;
  }

  try {
    const normalized = parts[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(parts[1].length / 4) * 4, '=');
    const json = Buffer.from(normalized, 'base64').toString('utf-8');
    const payload = JSON.parse(json) as { sub?: unknown };
    const subject = Number(payload.sub);

    return Number.isFinite(subject) && subject > 0 ? subject : null;
  } catch {
    return null;
  }
}

export async function hasWeeklyVehicleCheckFromApi(accessToken: string) {
  const { weekStartDateKey, weekEndDateKey } = getWeeklyVehicleCheckDateContext();
  const mileageRecords = await listPromotorMileage(accessToken);
  const currentPromotorId = decodeJwtSubject(accessToken);

  return mileageRecords.some((record) => {
    if (!record.checkDate) {
      return false;
    }

     if (
      typeof currentPromotorId === 'number' &&
      typeof record.promotorId === 'number' &&
      record.promotorId !== currentPromotorId
    ) {
      return false;
    }

    return record.checkDate >= weekStartDateKey && record.checkDate <= weekEndDateKey;
  });
}
