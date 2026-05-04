import Link from 'next/link';
import Image from 'next/image';
import { notFound, redirect } from 'next/navigation';

import { Header } from '@/components/home/header';
import { DeleteDraftButton } from '@/components/visits/delete-draft-button';
import { getHomePath, getSession } from '@/lib/auth';
import { pool } from '@/lib/db';

type VisitProduct = {
  name: string;
  quantity: number;
  unit: string;
  expirationDate: string;
};

function formatDatabaseDateToDisplay(value: string | Date | null) {
  if (!value) {
    return 'Data nao definida';
  }

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
        observation: string;
        products: VisitProduct[];
        beforeImage: string;
        afterImage: string;
        isDraft: boolean;
        canEdit: boolean;
      }
    | null = null;

  try {
    const client = await pool.connect();
    try {
      const [userResult, visitResult] = await Promise.all([
        client.query('SELECT id, full_name FROM promotors WHERE email = $1', [session.email]),
        client.query(
          `SELECT v.establishment, v.visit_date, v.observation, v.products, v.before_image, v.after_image, v.is_draft, v.created_at
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
          establishment: row.establishment ?? 'Rascunho sem estabelecimento',
          visitDate: formatDatabaseDateToDisplay(row.visit_date),
          observation: row.observation ?? '',
          products: Array.isArray(row.products) ? row.products : [],
          beforeImage: row.before_image ?? '',
          afterImage: row.after_image ?? '',
          isDraft: Boolean(row.is_draft),
          canEdit:
            Boolean(row.is_draft) ||
            Date.now() - new Date(row.created_at).getTime() <= 7 * 24 * 60 * 60 * 1000,
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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(0,156,108,0.12),_transparent_32%),linear-gradient(180deg,_#0f2d3d_0%,_var(--background)_42%,_#091c27_100%)] px-4 py-10 pb-28">
      <Header fullName={fullName} />

      <section className="mx-auto w-full max-w-4xl px-6 pt-24">
        <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.2)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#8eb4c4]">
                Detalhes da visita
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-3xl font-bold tracking-tight text-white">{visit.establishment}</h2>
                {visit.isDraft && (
                  <span className="rounded-full border border-[#ffe39d]/25 bg-[#ffe39d]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-[#ffe39d]">
                    Rascunho
                  </span>
                )}
              </div>
              <div className="inline-flex items-center rounded-full border border-white/10 bg-black/10 px-3 py-1 text-xs font-medium text-[#b9d0d9]">
                Data da visita: {visit.visitDate}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 lg:max-w-[360px] lg:justify-end">
              {visit.canEdit && (
                <Link
                  href={`/visitas/${id}/editar`}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-[#00c487]/35 bg-[#009c6c]/18 px-4 text-sm font-semibold text-[#dcfff3] transition hover:bg-[#009c6c]/28"
                >
                  {visit.isDraft ? 'Continuar rascunho' : 'Editar'}
                </Link>
              )}
              {visit.isDraft && (
                <DeleteDraftButton
                  visitId={Number(id)}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-[#ff8c8c]/30 bg-[#5c1f1f]/35 px-4 text-sm font-semibold text-[#ffd6d6] transition hover:bg-[#6f2626]/45"
                />
              )}
              <Link
                href={getHomePath(session.role)}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-4 text-sm font-semibold text-white transition hover:bg-white/[0.1]"
              >
                Voltar
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-6">
          {visit.observation && (
            <article className="mb-6 rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] p-5 shadow-[0_20px_45px_rgba(0,0,0,0.18)]">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/55">
                Observacao
              </p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-white/85">
                {visit.observation}
              </p>
            </article>
          )}

          {(visit.beforeImage || visit.afterImage) && (
            <div className="mb-6 grid gap-4 sm:grid-cols-2">
              {visit.beforeImage && (
                <article className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] p-4 shadow-[0_20px_45px_rgba(0,0,0,0.18)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/55">
                    Antes
                  </p>
                  <Image
                    src={visit.beforeImage}
                    alt="Imagem de antes da visita"
                    width={1200}
                    height={900}
                    unoptimized
                    className="mt-3 h-64 w-full rounded-[18px] object-cover"
                  />
                </article>
              )}

              {visit.afterImage && (
                <article className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] p-4 shadow-[0_20px_45px_rgba(0,0,0,0.18)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/55">
                    Depois
                  </p>
                  <Image
                    src={visit.afterImage}
                    alt="Imagem de depois da visita"
                    width={1200}
                    height={900}
                    unoptimized
                    className="mt-3 h-64 w-full rounded-[18px] object-cover"
                  />
                </article>
              )}
            </div>
          )}

          {visit.products.length === 0 ? (
            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] px-5 py-7 text-sm text-white/75 shadow-[0_16px_35px_rgba(0,0,0,0.16)]">
              Nenhum produto registrado nesta visita.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {visit.products.map((product, index) => (
                <article
                  key={`${product.name}-${index}`}
                  className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] p-5 shadow-[0_20px_45px_rgba(0,0,0,0.18)]"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/55">
                    Produto {index + 1}
                  </p>
                  <h3 className="mt-2 text-lg font-bold text-white">{product.name || 'Produto sem nome'}</h3>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-white/10 bg-black/10 px-3 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/50">Quantidade</p>
                      <p className="mt-2 text-sm font-semibold text-white">{product.quantity ?? 0}</p>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-black/10 px-3 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/50">Unidade</p>
                      <p className="mt-2 text-sm font-semibold text-white">{product.unit || '-'}</p>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-black/10 px-3 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/50">Validade</p>
                      <p className="mt-2 text-sm font-semibold text-white">{product.expirationDate || '-'}</p>
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
