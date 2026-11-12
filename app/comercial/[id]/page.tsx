import { ArrowLeft, CalendarDays, ClipboardList, PencilLine } from 'lucide-react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { Header } from '@/components/home/header';
import { getSession } from '@/lib/auth';
import { getCommercialVisitById } from '@/lib/api/comercial';
import { toDisplayVisitDate } from '@/lib/commercial-dates';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export default async function CommercialClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }


  const resolvedParams = await params;
  const submissionId = Number(resolvedParams.id);

  if (!Number.isInteger(submissionId) || submissionId <= 0) {
    notFound();
  }

  const submission = await getCommercialVisitById(session.accessToken, submissionId).catch(() => null);

  if (!submission) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(0,156,108,0.12),_transparent_28%),linear-gradient(180deg,_#0f2d3d_0%,_var(--background)_46%,_#091c27_100%)] pb-12">
      <Header />

      <section className="mx-auto w-full max-w-6xl px-4 pb-12 pt-24">
        <Link
          href="/comercial"
          className="flex w-fit items-center gap-2 text-sm font-medium text-white/70 transition hover:text-white"
        >
          <ArrowLeft size={18} />
          Voltar para clientes
        </Link>

        <div className="mt-6 rounded-[2rem] border border-white/10 bg-white/6 p-6 shadow-2xl shadow-black/20 backdrop-blur md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#7fe7c5]">
                Relatorio geral
              </p>
              <h1 className="mt-3 text-3xl font-black text-white">{submission.clientName}</h1>
              <p className="mt-2 text-lg text-white/72">{submission.fantasyName}</p>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-white/68">
                Veja os dados principais do cliente, acompanhe o historico de visitas e atualize esse
                cadastro sempre que precisar.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <Link
                href={`/comercial/${submission.id}/editar`}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#009c6c] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#00805a]"
              >
                <PencilLine size={18} />
                Editar cliente
              </Link>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <article className="rounded-[1.5rem] border border-white/10 bg-[#112f3d]/85 p-5">
              <div className="flex items-center gap-3 text-[#7fe7c5]">
                <ClipboardList size={18} />
                <p className="text-xs font-semibold uppercase tracking-[0.18em]">Valor</p>
              </div>
              <p className="mt-4 text-2xl font-black text-white">{formatCurrency(submission.totalValue)}</p>
            </article>

            <article className="rounded-[1.5rem] border border-white/10 bg-[#112f3d]/85 p-5">
              <div className="flex items-center gap-3 text-[#7fe7c5]">
                <CalendarDays size={18} />
                <p className="text-xs font-semibold uppercase tracking-[0.18em]">Visitas</p>
              </div>
              <p className="mt-4 text-2xl font-black text-white">{submission.visitDates.length}</p>
            </article>

            <article className="rounded-[1.5rem] border border-white/10 bg-[#112f3d]/85 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7fe7c5]">Qtd vendas</p>
              <p className="mt-4 text-2xl font-black text-white">{submission.salesQuantity}</p>
            </article>
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
            <article className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6">
              <h2 className="text-lg font-black text-white">Historico de visitas</h2>
              {submission.visitDates.length === 0 ? (
                <p className="mt-4 text-sm text-white/68">Nenhuma visita registrada para esse cliente.</p>
              ) : (
                <div className="mt-4 flex flex-wrap gap-3">
                  {submission.visitDates.map((visitDate, index) => (
                    <span
                      key={`${visitDate}-${index}`}
                      className="rounded-full border border-[#7fe7c5]/25 bg-[#7fe7c5]/10 px-4 py-2 text-sm font-semibold text-[#d9fff1]"
                    >
                      {toDisplayVisitDate(visitDate)}
                    </span>
                  ))}
                </div>
              )}
            </article>

            <article className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6">
              <h2 className="text-lg font-black text-white">Dados do cliente</h2>
              <dl className="mt-4 space-y-4 text-sm text-white/72">
                <div>
                  <dt className="font-semibold text-white">Telefone</dt>
                  <dd className="mt-1">{submission.phone}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-white">Endereco</dt>
                  <dd className="mt-1">{submission.address}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-white">CNPJ</dt>
                  <dd className="mt-1">{submission.cnpj || 'Nao informado'}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-white">Email</dt>
                  <dd className="mt-1">{submission.email || 'Nao informado'}</dd>
                </div>
              </dl>
            </article>
          </div>
        </div>
      </section>
    </main>
  );
}
