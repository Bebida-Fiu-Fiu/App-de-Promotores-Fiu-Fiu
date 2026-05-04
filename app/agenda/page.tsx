import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AppTabs } from '@/components/home/app-tabs';
import { Header } from '@/components/home/header';
import { getSession } from '@/lib/auth';
import { pool } from '@/lib/db';
import { getHeaderFullName } from '@/lib/header-user';

type AgendaEntry = {
  id: number;
  nickname: string | null;
  notes: string | null;
  clientId: number;
  fantasyName: string;
  clientName: string;
  document: string;
  city: string;
  address: string;
  addressNumber: string | null;
  neighborhood: string;
  state: string;
  lastVisitDate: string | null;
};

function formatPromotorTitle(fullName: string | null) {
  if (!fullName) {
    return 'PROMOTOR';
  }

  return fullName.split(' ')[0]?.toUpperCase() ?? 'PROMOTOR';
}

function formatEntryTitle(entry: AgendaEntry) {
  return entry.nickname || entry.fantasyName || entry.clientName;
}

function formatEntrySubtitle(entry: AgendaEntry) {
  const title = formatEntryTitle(entry);
  const parts = [
    entry.clientName && entry.clientName !== title ? entry.clientName : null,
    entry.notes,
  ].filter(Boolean);

  return parts.join(' • ');
}

function formatEntryAddress(entry: AgendaEntry) {
  return [entry.address, entry.addressNumber, entry.neighborhood, entry.city, entry.state]
    .filter(Boolean)
    .join(', ');
}

function buildVisitRegistrationHref(entry: AgendaEntry) {
  const params = new URLSearchParams({
    clientId: String(entry.clientId),
    nickname: entry.nickname ?? '',
    clientName: entry.clientName,
    fantasyName: entry.fantasyName,
    document: entry.document,
    city: entry.city,
    address: entry.address,
    neighborhood: entry.neighborhood,
    state: entry.state,
  });

  if (entry.addressNumber) {
    params.set('addressNumber', entry.addressNumber);
  }

  return `/visitas/nova?${params.toString()}`;
}

function formatLastVisitDate(value: string | null) {
  if (!value) {
    return 'Sem visitas registradas';
  }

  return new Date(value).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

function AgendaEntryCard({ entry }: { entry: AgendaEntry }) {
  const subtitle = formatEntrySubtitle(entry);
  const address = formatEntryAddress(entry);

  return (
    <article className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_12px_30px_rgba(0,0,0,0.08)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div>
            <h4 className="text-base font-bold text-white">{formatEntryTitle(entry)}</h4>
            {subtitle ? <p className="mt-1 text-sm text-white/70">{subtitle}</p> : null}
          </div>

          <div className="space-y-1 text-sm text-white/75">
            <p>Ultima visita: {formatLastVisitDate(entry.lastVisitDate)}</p>
            {address ? <p>{address}</p> : null}
          </div>
        </div>

        <Link
          href={buildVisitRegistrationHref(entry)}
          className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[#009c6c] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#009c6c]/80"
        >
          Registrar visita
        </Link>
      </div>
    </article>
  );
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const query = resolvedSearchParams.q?.trim() ?? '';
  const hasDatabaseConfig = Boolean(process.env.DATABASE_URL?.trim());

  let fullName: string | null = session.user.fullName;
  let agendaEntries: AgendaEntry[] = [];
  let agendaUnavailableMessage: string | null = null;

  fullName = await getHeaderFullName(session.accessToken, fullName);

  if (!hasDatabaseConfig) {
    agendaUnavailableMessage = 'A agenda local ainda nao esta configurada neste ambiente.';
  } else {
    try {
      const client = await pool.connect();

      try {
        const values: string[] = [session.user.email];
        const filters: string[] = ['p.email = $1'];

        if (query) {
          values.push(`%${query}%`);
          filters.push(
            `(c.fantasy_name ILIKE $${values.length} OR c.client_name ILIKE $${values.length} OR a.nickname ILIKE $${values.length} OR a.notes ILIKE $${values.length})`
          );
        }

        const whereClause = `WHERE ${filters.join(' AND ')}`;

        const [userResult, agendaResult] = await Promise.all([
          client.query('SELECT id, full_name FROM promotors WHERE email = $1', [session.user.email]),
          client.query(
            `SELECT
               a.id,
               a.nickname,
               a.notes,
               c.id AS client_id,
               c.fantasy_name,
               c.client_name,
               c.document,
               c.city,
               c.address,
               c.address_number,
               c.neighborhood,
               c.state,
               latest_visit.visit_date AS last_visit_date
             FROM promotor_client_agenda a
             INNER JOIN promotors p ON p.id = a.promotor_id
             INNER JOIN clients c ON c.id = a.client_id
             LEFT JOIN LATERAL (
               SELECT v.visit_date
               FROM visits v
               WHERE v.promotor_id = p.id
                 AND (
                   v.establishment = coalesce(a.nickname, '')
                   OR v.establishment = c.fantasy_name
                   OR v.establishment = c.client_name
                 )
               ORDER BY v.visit_date DESC, v.id DESC
               LIMIT 1
             ) latest_visit ON TRUE
             ${whereClause}
             ORDER BY
               coalesce(nullif(a.nickname, ''), nullif(c.fantasy_name, ''), c.client_name) ASC,
               a.created_at DESC`,
            values
          ),
        ]);

        fullName = userResult.rows[0]?.full_name ?? fullName;
        agendaEntries = agendaResult.rows.map((row) => ({
          id: Number(row.id),
          nickname: row.nickname ?? null,
          notes: row.notes,
          clientId: Number(row.client_id),
          fantasyName: row.fantasy_name ?? '',
          clientName: row.client_name ?? '',
          document: row.document ?? '',
          city: row.city ?? '',
          address: row.address ?? '',
          addressNumber: row.address_number ?? null,
          neighborhood: row.neighborhood ?? '',
          state: row.state ?? '',
          lastVisitDate: row.last_visit_date ?? null,
        }));
      } finally {
        client.release();
      }
    } catch (error) {
      agendaUnavailableMessage = 'Nao foi possivel carregar a agenda local neste ambiente.';
      console.error('Agenda lookup error:', error);
    }
  }

  const content = (
    <main className="min-h-screen bg-[var(--background)] px-4 pt-15">
      <Header fullName={fullName} />
      <AppTabs current="agenda" role={session.user.role} />

      <section className="mx-auto w-full max-w-4xl px-6 pt-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/60">
              Agenda de clientes
            </p>
            <h2 className="mt-2 text-2xl font-bold text-white">
              Rota promotor - {formatPromotorTitle(fullName)}
            </h2>
          </div>

          <Link
            href="/agenda/novo"
            className="rounded-md bg-[#009c6c] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#009c6c]/80"
          >
            Adicionar cliente
          </Link>
        </div>

        <form className="mt-6 grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 sm:grid-cols-[minmax(0,1fr)_auto]">
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="Filtrar por apelido, cliente ou observacao"
            className="h-10 rounded-md border border-[#707070] bg-white/10 px-3 text-sm text-white outline-none placeholder:text-white/45"
          />
          <button
            type="submit"
            className="rounded-md border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
          >
            Filtrar
          </button>
        </form>

        <div className="mt-6 space-y-3">
          {agendaUnavailableMessage ? (
            <div className="rounded-2xl border border-[#ffb3b3]/30 bg-[#5c1f1f]/45 px-4 py-6 text-sm text-[#ffe2e2]">
              {agendaUnavailableMessage}
            </div>
          ) : null}

          {agendaEntries.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-white/75">
              Nenhum cliente encontrado para os filtros atuais.
            </div>
          ) : (
            agendaEntries.map((entry) => <AgendaEntryCard key={entry.id} entry={entry} />)
          )}
        </div>
      </section>
    </main>
  );

  return content;
}
