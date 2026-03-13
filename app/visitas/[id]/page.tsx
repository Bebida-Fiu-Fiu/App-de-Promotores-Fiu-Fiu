import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { Header } from '@/components/home/header';
import { getSession } from '@/lib/auth';
import { pool } from '@/lib/db';

type VisitProduct = {
  name: string;
  quantity: number;
  unit: string;
  expirationDate: string;
};

function formatDatabaseDateToDisplay(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

export default async function VisitDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  const { id } = await params;

  let fullName: string | null = null;
  let visit:
    | {
        establishment: string;
        visitDate: string;
        promotorName: string | null;
        products: VisitProduct[];
      }
    | null = null;

  try {
    const client = await pool.connect();
    try {
      const [userResult, visitResult] = await Promise.all([
        client.query('SELECT id, full_name FROM promotors WHERE email = $1', [session.email]),
        client.query(
          `SELECT v.establishment, v.visit_date, v.products, p.full_name
           FROM visits v
           INNER JOIN promotors p ON p.id = v.promotor_id
           WHERE v.id = $1 AND p.email = $2`,
          [id, session.email]
        ),
      ]);

      fullName = userResult.rows[0]?.full_name ?? null;

      if (visitResult.rowCount) {
        const row = visitResult.rows[0];
        visit = {
          establishment: row.establishment,
          visitDate: formatDatabaseDateToDisplay(row.visit_date),
          promotorName: row.full_name ?? null,
          products: Array.isArray(row.products) ? row.products : [],
        };
      }
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Visit details lookup error:', error);
  }

  if (!visit) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-10">
      <Header fullName={fullName} />

      <section className="mx-auto w-full max-w-4xl px-6 pt-24">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">{visit.establishment}</h2>
            <p className="mt-2 text-sm opacity-80">Data da visita: {visit.visitDate}</p>
            {visit.promotorName && (
              <p className="mt-1 text-sm opacity-80">Promotor: {visit.promotorName}</p>
            )}
          </div>

          <Link
            href="/"
            className="rounded-md border border-white/20 px-4 py-2 text-sm font-semibold transition hover:bg-white/10"
          >
            Voltar
          </Link>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="grid grid-cols-[1.4fr_120px_140px_140px] border-b border-white/10 px-4 py-3 text-sm font-semibold">
            <span>Produto</span>
            <span>Quantidade</span>
            <span>Unidade</span>
            <span>Validade</span>
          </div>

          {visit.products.length === 0 ? (
            <div className="px-4 py-6 text-sm opacity-80">Nenhum produto registrado nesta visita.</div>
          ) : (
            visit.products.map((product, index) => (
              <div
                key={`${product.name}-${index}`}
                className="grid grid-cols-[1.4fr_120px_140px_140px] px-4 py-3 text-sm odd:bg-white/5"
              >
                <span>{product.name}</span>
                <span>{product.quantity}</span>
                <span>{product.unit}</span>
                <span>{product.expirationDate}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
