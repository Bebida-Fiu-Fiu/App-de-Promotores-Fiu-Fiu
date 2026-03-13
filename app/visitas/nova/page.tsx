import { redirect } from 'next/navigation';

import { Header } from '@/components/home/header';
import { NewVisitForm } from '@/components/visits/new-visit-form';
import { getSession } from '@/lib/auth';
import { pool } from '@/lib/db';

export default async function NewVisitPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  let fullName: string | null = null;

  try {
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT full_name FROM promotors WHERE email = $1', [
        session.email,
      ]);
      fullName = result.rows[0]?.full_name ?? null;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('New visit page user lookup error:', error);
  }

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <Header fullName={fullName} />
      <NewVisitForm />
    </main>
  );
}
