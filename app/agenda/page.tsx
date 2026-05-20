import Link from 'next/link';
import { redirect } from 'next/navigation';

import { DeleteAgendaEntryButton } from '@/components/agenda/delete-agenda-entry-button';
import { AppTabs } from '@/components/home/app-tabs';
import { Header } from '@/components/home/header';
import { listPromotorAgendaByPromotorId } from '@/lib/api/promotor';
import { getPromotorIdFromSession, getSession } from '@/lib/auth';
import { getHeaderFullName } from '@/lib/header-user';
import type { PromotorAgendaEntry as AgendaEntry } from '@/types/promotor';

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

        <div className="flex flex-col gap-2 sm:items-end">
          <Link
            href={buildVisitRegistrationHref(entry)}
            className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[#009c6c] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#009c6c]/80"
          >
            Registrar visita
          </Link>
          <DeleteAgendaEntryButton agendaEntryId={entry.id} />
        </div>
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

  let fullName: string | null = session.user.fullName;
  let agendaEntries: AgendaEntry[] = [];
  let agendaUnavailableMessage: string | null = null;

  fullName = await getHeaderFullName(session.accessToken, fullName);

  const promotorId = getPromotorIdFromSession(session);

  if (typeof promotorId !== 'number') {
    agendaUnavailableMessage = 'Promotor nao identificado para carregar a agenda.';
  } else {
    try {
      const entries = await listPromotorAgendaByPromotorId(session.accessToken, promotorId);

      agendaEntries = query
        ? entries.filter((entry) => {
            const normalizedQuery = query.toLocaleLowerCase('pt-BR');
            const haystack = [
              entry.nickname,
              entry.clientName,
              entry.fantasyName,
              entry.notes,
              entry.city,
              entry.state,
            ]
              .filter(Boolean)
              .join(' ')
              .toLocaleLowerCase('pt-BR');

            return haystack.includes(normalizedQuery);
          })
        : entries;

      if (!fullName) {
        fullName = entries[0]?.promotorName ?? fullName;
      }
    } catch (error) {
      agendaUnavailableMessage = 'Nao foi possivel carregar a agenda da API neste ambiente.';
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
