import { pool } from '@/lib/db';

function getBrazilDateParts() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const [year, month, day] = formatter.format(new Date()).split('-').map(Number);

  return { year, month, day };
}

function formatUtcDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function getWeeklyVehicleCheckDateContext() {
  const { year, month, day } = getBrazilDateParts();
  const todayUtc = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = todayUtc.getUTCDay();

  const weekStartUtc = new Date(todayUtc);
  weekStartUtc.setUTCDate(todayUtc.getUTCDate() - dayOfWeek);

  const weekEndUtc = new Date(weekStartUtc);
  weekEndUtc.setUTCDate(weekStartUtc.getUTCDate() + 6);

  return {
    dateKey: formatUtcDateKey(todayUtc),
    weekStartDateKey: formatUtcDateKey(weekStartUtc),
    weekEndDateKey: formatUtcDateKey(weekEndUtc),
  };
}

export async function hasWeeklyVehicleCheckForWeek(
  promotorId: number,
  weekStartDateKey: string,
  weekEndDateKey: string
) {
  const client = await pool.connect();

  try {
    const result = await client.query(
      `SELECT 1
       FROM vehicle_mileage_checks
       WHERE promotor_id = $1
         AND check_date >= $2::date
         AND check_date <= $3::date
       LIMIT 1`,
      [promotorId, weekStartDateKey, weekEndDateKey]
    );

    return (result.rowCount ?? 0) > 0;
  } finally {
    client.release();
  }
}
