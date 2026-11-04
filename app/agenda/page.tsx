import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AlertCircle, CalendarClock, CircleCheck, Store } from 'lucide-react';

import { DeleteAgendaEntryButton } from '@/components/agenda/delete-agenda-entry-button';
import { AppTabs } from '@/components/home/app-tabs';
import { Header } from '@/components/home/header';
import { ApiError } from '@/lib/api/client';
import {
  calculateAgendaVisitStatus,
  filterAgendaEntriesByPromotor,
  formatAgendaDate,
  getMostRecentAgendaVisitDate,
} from '@/lib/agenda-frequency';
import { listAllPromotorAgendas, listAllVisitsReportByPromotorId } from '@/lib/api/promotor';
import { getPromotorOpaqueIdFromSession, getSession } from '@/lib/auth';
import { getHeaderFullName } from '@/lib/header-user';
import type { AttendedStore, PromotorVisit } from '@/types/promotor';

function getPromotorFilterValue(id: NonNullable<AttendedStore['promotorId']>) {
  return `id:${typeof id}:${encodeURIComponent(String(id))}`;
}

function formatEntryTitle(entry: AttendedStore) {
  return entry.nickname || entry.fantasyName || entry.clientName || 'Loja atendida';
}

function formatEntrySubtitle(entry: AttendedStore) {
  return entry.notes;
}

function buildVisitRegistrationHref(entry: AttendedStore) {
  if (entry.clientId === null) {
    return '/visitas/nova';
  }

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

function AgendaVisitFrequency({ entry, lastVisitDate, visitHistoryAvailable }: {
  entry: AttendedStore;
  lastVisitDate: string | null;
  visitHistoryAvailable: boolean;
}) {
  const status = calculateAgendaVisitStatus({
    lastVisitDate,
    daysBetweenVisits: entry.daysBetweenVisits,
    visitHistoryAvailable,
  });

  if (status.kind === 'unavailable') {
    return (
      <div className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm text-white">
        <p className="flex items-center gap-2 font-semibold">
          <AlertCircle size={17} aria-hidden="true" />
          Frequencia indisponivel
        </p>
        <p className="mt-1 text-white/80">
          {visitHistoryAvailable
            ? 'A API nao retornou uma data de ultima visita.'
            : 'Historico de visitas indisponivel.'}
        </p>
      </div>
    );
  }

  const presentation = {
    'on-time': {
      className: 'border-emerald-300/50 bg-emerald-950/60 text-emerald-100',
      icon: <CircleCheck size={18} aria-hidden="true" />,
      title: 'Em dia',
      detail: `${status.daysRemaining} dias restantes`,
    },
    upcoming: {
      className: 'border-amber-300/60 bg-amber-950/65 text-amber-100',
      icon: <CalendarClock size={18} aria-hidden="true" />,
      title: status.daysRemaining === 0 ? 'Prazo hoje' : 'Prazo proximo',
      detail:
        status.daysRemaining === 0
          ? 'Vence hoje'
          : `${status.daysRemaining} ${status.daysRemaining === 1 ? 'dia' : 'dias'}`,
    },
    overdue: {
      className: 'border-red-300/60 bg-red-950/65 text-red-100',
      icon: <AlertCircle size={18} aria-hidden="true" />,
      title: 'Prazo vencido',
      detail: `Venceu ha ${status.daysOverdue} ${status.daysOverdue === 1 ? 'dia' : 'dias'}`,
    },
    'first-visit': {
      className: 'border-sky-300/50 bg-sky-950/60 text-sky-100',
      icon: <CalendarClock size={18} aria-hidden="true" />,
      title: 'Primeira visita',
      detail: 'Sem visitas anteriores',
    },
    unavailable: {
      className: '',
      icon: null,
      title: '',
      detail: '',
    },
  }[status.kind];

  return (
    <div className={`rounded-xl border px-3 py-2 text-sm ${presentation.className}`}>
      <p className="flex items-center gap-2 font-bold">
        {presentation.icon}
        {presentation.title}
      </p>
      <p className="mt-1 font-semibold">
        {status.kind === 'upcoming' && status.daysRemaining !== null && status.daysRemaining > 0
          ? `Faltam ${status.daysRemaining} ${status.daysRemaining === 1 ? 'dia' : 'dias'}`
          : presentation.detail}
      </p>
      {status.kind !== 'first-visit' ? (
        <p className="mt-1">
          Ultima visita: {status.lastVisitDate ? formatAgendaDate(status.lastVisitDate) : 'Data indisponivel'}
          {status.dueDate ? ` • Limite: ${formatAgendaDate(status.dueDate)}` : ''}
        </p>
      ) : null}
    </div>
  );
}

function AgendaEntryCard({ entry, lastVisitDate, visitHistoryAvailable }: {
  entry: AttendedStore;
  lastVisitDate: string | null;
  visitHistoryAvailable: boolean;
}) {
  const subtitle = formatEntrySubtitle(entry);

  return (
    <article className="flex h-full flex-col rounded-[1.5rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.035))] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.16)] transition hover:border-white/20 hover:bg-white/[0.07]">
      <header className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-[#00c98b]/25 bg-[#009c6c]/15 text-[#83f0ca]">
          <Store size={21} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="break-words text-lg font-bold leading-snug text-white">
            {formatEntryTitle(entry)}
          </h4>
          {subtitle ? <p className="mt-1 line-clamp-2 text-sm text-white/65">{subtitle}</p> : null}
        </div>
        <span className="shrink-0 rounded-full border border-white/10 bg-black/15 px-2.5 py-1 text-xs font-semibold text-white/70">
          A cada {entry.daysBetweenVisits} dias
        </span>
      </header>

      <div className="mt-4 flex-1">
        <AgendaVisitFrequency
          entry={entry}
          lastVisitDate={lastVisitDate}
          visitHistoryAvailable={visitHistoryAvailable}
        />
      </div>

      <footer className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
        {entry.clientId !== null ? (
          <Link
            href={buildVisitRegistrationHref(entry)}
            className="inline-flex min-h-10 flex-1 items-center justify-center rounded-xl bg-[#009c6c] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#009c6c]/80"
          >
            Registrar visita
          </Link>
        ) : null}
        {entry.id !== null ? <DeleteAgendaEntryButton agendaEntryId={entry.id} /> : null}
      </footer>
    </article>
  );
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; promotorId?: string }>;
}) {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const query = resolvedSearchParams.q?.trim() ?? '';
  const selectedPromotorId = resolvedSearchParams.promotorId ?? '';

  let fullName: string | null = session.user.fullName;
  let agendaEntries: AttendedStore[] = [];
  let allAgendaEntries: AttendedStore[] = [];
  const visitsByPromotor = new Map<string, PromotorVisit[]>();
  const unavailableVisitHistory = new Set<string>();
  let agendaUnavailableMessage: string | null = null;
  const currentPromotorId = getPromotorOpaqueIdFromSession(session);
  const isAdminView = session.user.role === 'comercial';

  fullName = await getHeaderFullName(session.accessToken, fullName);

  if (!isAdminView && currentPromotorId === null) {
    agendaUnavailableMessage = 'Nao foi possivel identificar o promotor da sessao para filtrar a agenda.';
  } else {
    try {
      allAgendaEntries = await listAllPromotorAgendas(session.accessToken);
      let entries = isAdminView
        ? allAgendaEntries
        : filterAgendaEntriesByPromotor(allAgendaEntries, currentPromotorId);

      if (isAdminView && selectedPromotorId) {
        entries = entries.filter((entry) =>
          selectedPromotorId === 'unassigned'
            ? entry.promotorId === null
            : entry.promotorId !== null &&
              getPromotorFilterValue(entry.promotorId) === selectedPromotorId
        );
      }

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
              entry.promotorName,
            ]
              .filter(Boolean)
              .join(' ')
              .toLocaleLowerCase('pt-BR');

            return haystack.includes(normalizedQuery);
          })
        : entries;

      const promotorIds = isAdminView
        ? Array.from(
            new Map(
              agendaEntries.flatMap((entry) =>
                entry.promotorId === null
                  ? []
                  : [[String(entry.promotorId), entry.promotorId] as const]
              )
            ).values()
          )
        : currentPromotorId === null
          ? []
          : [currentPromotorId];

      await Promise.all(
        promotorIds.map(async (promotorId) => {
          const promotorKey = String(promotorId);
          try {
            visitsByPromotor.set(
              promotorKey,
              await listAllVisitsReportByPromotorId(session.accessToken, promotorId)
            );
          } catch (error) {
            unavailableVisitHistory.add(promotorKey);
            console.error(`Agenda visit history lookup error for promotor ${promotorKey}:`, error);
          }
        })
      );
    } catch (error) {
      if (error instanceof ApiError && error.status >= 500) {
        agendaUnavailableMessage = `A API de lojas atendidas retornou um erro interno (HTTP ${error.status}). Tente novamente mais tarde.${error.requestId ? ` Informe o identificador ${error.requestId} ao suporte da API.` : ''}`;
      } else {
        agendaUnavailableMessage = 'Nao foi possivel carregar as lojas atendidas. Verifique a conexao e tente novamente.';
      }
      if (error instanceof ApiError) {
        console.error('Agenda lookup API error:', {
          status: error.status,
          requestId: error.requestId,
          message: error.message,
        });
      } else {
        console.error('Agenda lookup error:', error);
      }
    }
  }

  const content = (
    <main className="min-h-screen bg-[var(--background)] px-4 pt-15">
      <Header fullName={fullName} />
      <AppTabs current="agenda" role={session.user.role} />

      <section className="mx-auto w-full max-w-6xl px-6 pt-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/60">
              Lojas atendidas
            </p>
            <h2 className="mt-2 text-2xl font-bold text-white">Lojas e frequencia de visitas</h2>
          </div>

          <Link
            href="/agenda/novo"
            className="rounded-md bg-[#009c6c] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#009c6c]/80"
          >
            Adicionar loja atendida
          </Link>
        </div>

        <form
          className={`mt-6 grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 ${
            isAdminView
              ? 'sm:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_auto]'
              : 'sm:grid-cols-[minmax(0,1fr)_auto]'
          }`}
        >
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="Filtrar por apelido, cliente ou observacao"
            className="h-10 rounded-md border border-[#707070] bg-white/10 px-3 text-sm text-white outline-none placeholder:text-white/45"
          />
          {isAdminView ? (
            <select
              name="promotorId"
              defaultValue={selectedPromotorId}
              aria-label="Filtrar por promotor"
              className="h-10 rounded-md border border-[#707070] bg-[#173746] px-3 text-sm text-white outline-none"
            >
              <option value="">Todos os promotores e lojas sem responsavel</option>
              <option value="unassigned">Sem promotor atribuido</option>
              {Array.from(
                new Map(
                  allAgendaEntries.flatMap((entry) =>
                    entry.promotorId === null
                      ? []
                      : [
                          [
                            `${typeof entry.promotorId}:${String(entry.promotorId)}`,
                            {
                              id: entry.promotorId,
                              name: entry.promotorName || `Promotor ${String(entry.promotorId)}`,
                            },
                          ] as const,
                        ]
                  )
                ).values()
              )
                .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'))
                .map((promotor) => (
                  <option
                    key={getPromotorFilterValue(promotor.id)}
                    value={getPromotorFilterValue(promotor.id)}
                  >
                    {promotor.name}
                  </option>
                ))}
            </select>
          ) : null}
          <button
            type="submit"
            className="rounded-md border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
          >
            Filtrar
          </button>
        </form>

        <div className="mt-6 space-y-4">
          {agendaUnavailableMessage ? (
            <div className="rounded-2xl border border-[#ffb3b3]/30 bg-[#5c1f1f]/45 px-4 py-6 text-sm text-[#ffe2e2]">
              {agendaUnavailableMessage}
            </div>
          ) : null}

          {agendaEntries.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-white/75">
              Nenhuma loja atendida encontrada para os filtros atuais.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {agendaEntries.map((entry, index) => {
                const promotorId = entry.promotorId;
                const promotorKey = promotorId === null ? '' : String(promotorId);
                const visitHistoryAvailable =
                  promotorId !== null && !unavailableVisitHistory.has(promotorKey);

                return (
                  <AgendaEntryCard
                    key={`${String(entry.id)}-${index}`}
                    entry={entry}
                    lastVisitDate={getMostRecentAgendaVisitDate(
                      visitsByPromotor.get(promotorKey) ?? [],
                      promotorId ?? '',
                      entry.clientId,
                      entry.lastVisitDate,
                      [entry.nickname, entry.clientName, entry.fantasyName]
                    )}
                    visitHistoryAvailable={visitHistoryAvailable || Boolean(entry.lastVisitDate)}
                  />
                );
              })}
            </div>
          )}
          {agendaEntries.length > 0 ? (
            <aside
              aria-label="Legenda da frequencia de visitas"
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-xs leading-relaxed text-white/80 sm:text-sm"
            >
              <p className="font-bold text-white">Legenda da frequencia</p>
              <p className="mt-1">
                <span className="font-semibold text-emerald-200">● Em dia</span>: mais de 3 dias restantes
                {' · '}
                <span className="font-semibold text-amber-200">● Prazo proximo</span>: vence em ate 3 dias
                {' · '}
                <span className="font-semibold text-red-200">● Prazo vencido</span>: passou da data limite
                {' · '}
                <span className="font-semibold text-sky-200">● Primeira visita</span>: sem visita anterior
              </p>
            </aside>
          ) : null}
          <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs leading-relaxed text-white/70 sm:text-sm">
            A API atual nao oferece edicao dos vinculos. Para associar ou alterar cliente e promotor de uma
            loja atendida existente, e necessario disponibilizar uma rota de atualizacao.
          </p>
        </div>
      </section>
    </main>
  );

  return content;
}
