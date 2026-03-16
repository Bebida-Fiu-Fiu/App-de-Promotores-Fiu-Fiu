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
        products: VisitProduct[];
      }
    | null = null;

  try {
    const client = await pool.connect();
    try {
      const [userResult, visitResult] = await Promise.all([
        client.query('SELECT id, full_name FROM promotors WHERE email = $1', [session.email]),
        client.query(
          `SELECT v.establishment, v.visit_date, v.products
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
    <main className="min-h-screen bg-[var(--background)] px-4 py-10 pb-28">
      <Header fullName={fullName} />

      <section className="mx-auto w-full max-w-4xl px-6 pt-24">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">{visit.establishment}</h2>
            <p className="mt-2 text-sm opacity-80">Data da visita: {visit.visitDate}</p>
          </div>

          <Link
            href="/"
            className="rounded-md border border-white/20 px-4 py-2 text-sm font-semibold transition hover:bg-white/10"
          >
            Voltar
          </Link>
        </div>

        <div className="mt-6">
          {visit.products.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm opacity-80">
              Nenhum produto registrado nesta visita.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {visit.products.map((product, index) => (
                <article
                  key={`${product.name}-${index}`}
                  className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-[0_12px_30px_rgba(0,0,0,0.08)]"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/55">
                    Produto {index + 1}
                  </p>
                  <h3 className="mt-2 text-lg font-bold text-white">{product.name}</h3>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-white/10 bg-black/10 px-3 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/50">Quantidade</p>
                      <p className="mt-2 text-sm font-semibold text-white">{product.quantity}</p>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-black/10 px-3 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/50">Unidade</p>
                      <p className="mt-2 text-sm font-semibold text-white">{product.unit}</p>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-black/10 px-3 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/50">Validade</p>
                      <p className="mt-2 text-sm font-semibold text-white">{product.expirationDate}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
