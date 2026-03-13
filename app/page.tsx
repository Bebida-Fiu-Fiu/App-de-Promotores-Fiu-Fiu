import { redirect } from 'next/navigation';

import { getSession } from '@/lib/auth';
import { pool } from '@/lib/db';
import { Header } from '@/components/home/header';
import { VisitList } from '@/components/home/visitList';

type VisitListItem = {
  id: number;
  establishment: string;
  visitDate: string;
};

function formatDatabaseDateToDisplay(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

export default async function HomePage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  let fullName: string | null = null;
  let visits: VisitListItem[] = [];

  try {
    const client = await pool.connect();
    try {
      const [userResult, visitsResult] = await Promise.all([
        client.query('SELECT id, full_name FROM promotors WHERE email = $1', [session.email]),
        client.query(
          `SELECT v.id, v.establishment, v.visit_date
           FROM visits v
           INNER JOIN promotors p ON p.id = v.promotor_id
           WHERE p.email = $1
           ORDER BY v.visit_date DESC, v.id DESC`,
          [session.email]
        ),
      ]);

      const result = userResult;
      fullName = result.rows[0]?.full_name ?? null;
      visits = visitsResult.rows.map((row) => ({
        id: row.id,
        establishment: row.establishment,
        visitDate: formatDatabaseDateToDisplay(row.visit_date),
      }));
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Home user lookup error:', error);
  }

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-10">
      <Header fullName={fullName} />
      <VisitList visits={visits} />
    </main>
  );
}
