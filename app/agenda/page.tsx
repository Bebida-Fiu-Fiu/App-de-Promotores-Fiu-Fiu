import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AppTabs } from '@/components/home/app-tabs';
import { Header } from '@/components/home/header';
import { WeeklyVehicleCheckGate } from '@/components/home/weekly-vehicle-check-gate';
import { getSession } from '@/lib/auth';
import { pool } from '@/lib/db';
import { getWeeklyVehicleCheckDateContext, hasWeeklyVehicleCheckForWeek } from '@/lib/weekly-vehicle-check';

const weekdayOrder = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'] as const;

type AgendaEntry = {
  id: number;
  weekday: string;
  nickname: string | null;
  frequency: string | null;
  notes: string | null;
  isPlanned: boolean;
  fantasyName: string;
  clientName: string;
  lastVisitDate: string | null;
};

type AgendaGroup = {
  weekday: string;
  regularEntries: AgendaEntry[];
  plannedEntries: AgendaEntry[];
};

function formatPromotorTitle(fullName: string | null) {
  if (!fullName) {
    return 'PROMOTOR';
  }

  return fullName.split(' ')[0]?.toUpperCase() ?? 'PROMOTOR';
}

function formatWeekdayLabel(value: string) {
  return value.toUpperCase();
}

function formatEntryLabel(entry: AgendaEntry) {
  const label = entry.nickname || entry.fantasyName || entry.clientName;
  const meta = [entry.frequency, entry.notes].filter(Boolean).join(' • ');

  if (!meta) {
    return label;
  }

  return `${label} (${meta})`;
}

function formatLastVisitDate(value: string | null) {
  if (!value) {
    return 'Sem visitas registradas';
  }

  return new Date(value).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

function buildAgendaGroups(entries: AgendaEntry[]) {
  const groups = new Map<string, AgendaGroup>();

  for (const entry of entries) {
    const current = groups.get(entry.weekday);

    if (!current) {
      groups.set(entry.weekday, {
        weekday: entry.weekday,
        regularEntries: entry.isPlanned ? [] : [entry],
        plannedEntries: entry.isPlanned ? [entry] : [],
      });
      continue;
    }

    if (entry.isPlanned) {
      current.plannedEntries.push(entry);
    } else {
      current.regularEntries.push(entry);
    }
  }

  return Array.from(groups.values());
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; day?: string }>;
}) {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const query = resolvedSearchParams.q?.trim() ?? '';
  const selectedDay = resolvedSearchParams.day?.trim().toLowerCase() ?? '';
  const shouldShowWeeklyVehicleCheck = session.role === 'promotor';

  let fullName: string | null = null;
  let agendaEntries: AgendaEntry[] = [];
  let hasCompletedWeeklyVehicleCheck = false;

  try {
    const client = await pool.connect();

    try {
      const values: string[] = [session.email];
      const filters: string[] = ['p.email = $1'];

      if (selectedDay) {
        values.push(selectedDay);
        filters.push(`LOWER(a.weekday) = $${values.length}`);
      }

      if (query) {
        values.push(`%${query}%`);
        filters.push(
          `(c.fantasy_name ILIKE $${values.length} OR c.client_name ILIKE $${values.length} OR a.nickname ILIKE $${values.length})`
        );
      }

      const whereClause = `WHERE ${filters.join(' AND ')}`;

      const [userResult, agendaResult] = await Promise.all([
        client.query('SELECT id, full_name FROM promotors WHERE email = $1', [session.email]),
        client.query(
          `SELECT
             a.id,
             a.weekday,
             a.nickname,
             a.frequency,
             a.notes,
             a.is_planned,
             c.fantasy_name,
             c.client_name,
             latest_visit.visit_date AS last_visit_date
           FROM promotor_client_agenda a
           INNER JOIN promotors p ON p.id = a.promotor_id
           INNER JOIN clients c ON c.id = a.client_id
           LEFT JOIN LATERAL (
             SELECT v.visit_date
             FROM visits v
             WHERE v.promotor_id = p.id
               AND (
                 v.establishment = c.fantasy_name
                 OR v.establishment = c.client_name
               )
             ORDER BY v.visit_date DESC, v.id DESC
             LIMIT 1
           ) latest_visit ON TRUE
           ${whereClause}
           ORDER BY
             CASE LOWER(a.weekday)
               WHEN 'segunda' THEN 1
               WHEN 'terca' THEN 2
               WHEN 'quarta' THEN 3
               WHEN 'quinta' THEN 4
               WHEN 'sexta' THEN 5
               WHEN 'sabado' THEN 6
               WHEN 'domingo' THEN 7
               ELSE 99
             END,
             a.is_planned ASC,
             c.fantasy_name ASC,
             c.client_name ASC`,
          values
        ),
      ]);

      fullName = userResult.rows[0]?.full_name ?? null;
      const promotorId = Number(userResult.rows[0]?.id ?? 0);
      agendaEntries = agendaResult.rows.map((row) => ({
        id: Number(row.id),
        weekday: row.weekday,
        nickname: row.nickname ?? null,
        frequency: row.frequency,
        notes: row.notes,
        isPlanned: row.is_planned,
        fantasyName: row.fantasy_name ?? '',
        clientName: row.client_name ?? '',
        lastVisitDate: row.last_visit_date ?? null,
      }));

      if (shouldShowWeeklyVehicleCheck && promotorId) {
        const { weekStartDateKey, weekEndDateKey } = getWeeklyVehicleCheckDateContext();
        hasCompletedWeeklyVehicleCheck = await hasWeeklyVehicleCheckForWeek(
          promotorId,
          weekStartDateKey,
          weekEndDateKey
        );
      }
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Agenda lookup error:', error);
  }

  const groups = buildAgendaGroups(agendaEntries);

  const content = (
    <main className="min-h-screen bg-[var(--background)] px-4 pt-15">
      <Header fullName={fullName} />
      <AppTabs current="agenda" role={session.role} />

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

        <form className="mt-6 grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 sm:grid-cols-[minmax(0,1fr)_180px_auto]">
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="Filtrar por cliente"
            className="h-10 rounded-md border border-[#707070] bg-white/10 px-3 text-sm text-white outline-none placeholder:text-white/45"
          />
          <select
            name="day"
            defaultValue={selectedDay}
            className="h-10 rounded-md border border-[#707070] bg-[#355061] px-3 text-sm text-white outline-none"
          >
            <option value="">Todos os dias</option>
            {weekdayOrder.map((day) => (
              <option key={day} value={day} className="bg-[#0c2432] text-white">
                {formatWeekdayLabel(day)}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-md border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
          >
            Filtrar
          </button>
        </form>

        <div className="mt-6 space-y-5">
          {groups.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-white/75">
              Nenhum cliente encontrado para os filtros atuais. Se a agenda ainda nao foi cadastrada no banco,
              execute a migration e adicione os itens na tabela `promotor_client_agenda`.
            </div>
          ) : (
            groups.map((group) => (
              <article
                key={group.weekday}
                className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-[0_12px_30px_rgba(0,0,0,0.08)]"
              >
                <h3 className="text-lg font-bold text-white">{formatWeekdayLabel(group.weekday)}</h3>

                {group.regularEntries.length > 0 && (
                  <ul className="mt-4 space-y-2 text-sm text-white/85">
                    {group.regularEntries.map((entry) => (
                      <li key={entry.id}>
                        • {formatEntryLabel(entry)}
                        <span className="ml-2 text-white/55">
                          Ultima visita: {formatLastVisitDate(entry.lastVisitDate)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {group.plannedEntries.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-semibold text-white/75">Visitas programadas</p>
                    <ul className="mt-2 space-y-2 text-sm text-white/85">
                      {group.plannedEntries.map((entry) => (
                        <li key={entry.id}>
                          • {formatEntryLabel(entry)}
                          <span className="ml-2 text-white/55">
                            Ultima visita: {formatLastVisitDate(entry.lastVisitDate)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );

  if (!shouldShowWeeklyVehicleCheck) {
    return content;
  }

  return (
    <WeeklyVehicleCheckGate
      initialCompletedForToday={hasCompletedWeeklyVehicleCheck}
    >
      {content}
    </WeeklyVehicleCheckGate>
  );
}
