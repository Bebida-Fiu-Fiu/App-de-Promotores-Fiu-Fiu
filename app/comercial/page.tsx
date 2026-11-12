import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Header } from '@/components/home/header';
import { getSession } from '@/lib/auth';
import { listAllCommercialVisits } from '@/lib/api/comercial';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export default async function ComercialHomePage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }


  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const query = resolvedSearchParams?.q?.trim() ?? '';

  const submissions = await listAllCommercialVisits(session.accessToken).catch(() => []);

  const normalizedQuery = query
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  const filteredSubmissions = submissions.filter((submission) => {
    const matchesQuery =
      !normalizedQuery ||
      [submission.clientName, submission.fantasyName, submission.phone, submission.email ?? '']
        .join(' ')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .includes(normalizedQuery);

    return matchesQuery;
  });

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(0,156,108,0.12),_transparent_28%),linear-gradient(180deg,_#0f2d3d_0%,_var(--background)_46%,_#091c27_100%)]">
      <Header />

      <section className="mx-auto w-full max-w-6xl px-4 pb-12 pt-24">
        <div className="flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-white/6 p-6 shadow-2xl shadow-black/20 backdrop-blur md:flex-row md:items-end md:justify-between md:p-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#7fe7c5]">
              Comercial
            </p>
            <h1 className="mt-3 text-3xl font-black text-white">Clientes cadastrados</h1>
            <p className="mt-3 text-sm leading-6 text-white/72">
              Acompanhe cada cliente, veja o resumo das visitas e abra rapidamente um novo cadastro.
            </p>
          </div>

          <Link
            href="/comercial/novo"
            className="inline-flex items-center justify-center rounded-full bg-[#009c6c] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#00805a]"
          >
            Abrir formulario
          </Link>
        </div>

        <form className="mt-8 grid gap-4 rounded-[1.75rem] border border-white/10 bg-white/5 p-4 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <label htmlFor="q" className="text-sm font-semibold text-white">
              Pesquisar cliente
            </label>
            <input
              id="q"
              name="q"
              defaultValue={query}
              placeholder="Buscar por cliente, fantasia, telefone ou email"
              className="mt-2 block w-full rounded-2xl border border-white/12 bg-white px-4 py-3 text-gray-900 shadow-sm outline-none transition focus:border-[#009c6c] focus:ring-4 focus:ring-[#009c6c]/15"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-full bg-[#009c6c] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#00805a]"
            >
              Filtrar
            </button>

            <Link
              href="/comercial"
              className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/10"
            >
              Limpar
            </Link>
          </div>
        </form>

        {submissions.length === 0 ? (
          <div className="mt-8 rounded-[2rem] border border-dashed border-white/15 bg-white/5 px-6 py-12 text-center text-white/72">
            Nenhum cliente cadastrado ainda. Use o botao acima para criar o primeiro.
          </div>
        ) : filteredSubmissions.length === 0 ? (
          <div className="mt-8 rounded-[2rem] border border-dashed border-white/15 bg-white/5 px-6 py-12 text-center text-white/72">
            Nenhum cliente encontrado para os filtros atuais.
          </div>
        ) : (
          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredSubmissions.map((submission) => (
              <Link
                key={submission.id}
                href={`/comercial/${submission.id}`}
                className="group rounded-[1.75rem] border border-white/10 bg-white/7 p-6 shadow-xl shadow-black/15 transition hover:-translate-y-1 hover:border-[#7fe7c5]/35 hover:bg-white/10"
              >
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7fe7c5]">
                    Cliente
                  </p>
                  <h2 className="mt-2 text-xl font-black text-white">{submission.clientName}</h2>
                  <p className="mt-1 text-sm text-white/65">{submission.fantasyName}</p>
                </div>

                <dl className="mt-6 space-y-3 text-sm text-white/72">
                  <div className="flex items-center justify-between gap-3">
                    <dt>Telefone</dt>
                    <dd className="font-semibold text-white">{submission.phone}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt>Valor</dt>
                    <dd className="font-semibold text-white">{formatCurrency(submission.totalValue)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt>Qtd visitas</dt>
                    <dd className="font-semibold text-white">{submission.visitDates.length}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt>Qtd vendas</dt>
                    <dd className="font-semibold text-white">{submission.salesQuantity}</dd>
                  </div>
                </dl>

                <p className="mt-6 text-sm font-semibold text-white transition group-hover:text-[#7fe7c5]">
                  Abrir relatorio
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
