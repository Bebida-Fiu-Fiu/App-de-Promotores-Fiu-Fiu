import { redirect } from 'next/navigation';

import { getSession } from '@/lib/auth';
import { pool } from '@/lib/db';
import { Header } from '@/components/home/header';
import { AppTabs } from '@/components/home/app-tabs';
import { VisitList } from '@/components/home/visitList';

type VisitListItem = {
  id: number;
  establishment: string;
  visitDate: string;
  isDraft: boolean;
  canEdit: boolean;
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
          `SELECT v.id, v.establishment, v.visit_date, v.is_draft, v.created_at
           FROM visits v
           INNER JOIN promotors p ON p.id = v.promotor_id
           WHERE p.email = $1
           ORDER BY v.is_draft DESC, v.visit_date DESC NULLS LAST, v.id DESC`,
          [session.email]
        ),
      ]);

      const result = userResult;
      fullName = result.rows[0]?.full_name ?? null;
      visits = visitsResult.rows.map((row) => ({
        id: row.id,
        establishment: row.establishment ?? 'Rascunho sem estabelecimento',
        visitDate: row.visit_date ? formatDatabaseDateToDisplay(row.visit_date) : 'Data nao definida',
        isDraft: Boolean(row.is_draft),
        canEdit:
          Boolean(row.is_draft) ||
          Date.now() - new Date(row.created_at).getTime() <= 7 * 24 * 60 * 60 * 1000,
      }));
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Home user lookup error:', error);
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(0,156,108,0.12),_transparent_32%),linear-gradient(180deg,_#0f2d3d_0%,_var(--background)_42%,_#091c27_100%)] px-4 py-15">
      <Header fullName={fullName} />
      <AppTabs current="visitas" />
      <VisitList visits={visits} />
    </main>
  );
}
