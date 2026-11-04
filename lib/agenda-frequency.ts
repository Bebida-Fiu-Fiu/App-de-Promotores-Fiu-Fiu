import type { AttendedStore, PromotorVisit } from '@/types/promotor';
import type { OpaqueId } from '@/types/auth';

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

type CalendarDate = {
  year: number;
  month: number;
  day: number;
};

export type AgendaVisitStatus = {
  kind: 'on-time' | 'upcoming' | 'overdue' | 'first-visit' | 'unavailable';
  isFirstVisit: boolean;
  dueDate: string | null;
  daysRemaining: number | null;
  daysOverdue: number | null;
  lastVisitDate: string | null;
};

export function filterAgendaEntriesByPromotor(
  entries: AttendedStore[],
  promotorId: OpaqueId | null
): AttendedStore[] {
  if (promotorId === null) {
    return [];
  }

  return entries.filter(
    (entry) =>
      entry.promotorId !== null &&
      String(entry.promotorId) === String(promotorId)
  );
}

function parseCalendarDate(value: string | null): CalendarDate | null {
  if (!value) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

function toCalendarDay(date: CalendarDate): number {
  return Date.UTC(date.year, date.month - 1, date.day) / DAY_IN_MILLISECONDS;
}

function fromCalendarDay(calendarDay: number): CalendarDate {
  const date = new Date(calendarDay * DAY_IN_MILLISECONDS);

  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function toDateKey(date: CalendarDate): string {
  return `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
}

export function formatAgendaDate(value: string): string {
  const date = parseCalendarDate(value);
  if (!date) {
    return 'Data indisponivel';
  }

  return new Date(date.year, date.month - 1, date.day).toLocaleDateString('pt-BR');
}

export function getMostRecentAgendaVisitDate(
  visits: PromotorVisit[],
  promotorId: OpaqueId,
  clientId: OpaqueId | null,
  fallbackDate: string | null,
  clientNames: Array<string | null> = []
): string | null {
  const normalizedClientNames = new Set(
    clientNames
      .filter((name): name is string => Boolean(name))
      .map(normalizeStoreName)
      .filter(Boolean)
  );
  const matchingDates = visits
    .flatMap((visit) => {
      const visitDate = visit.visitDate;
      const belongsToStore =
        (visit.establishmentId !== null &&
          clientId !== null &&
          String(visit.establishmentId) === String(clientId)) ||
        (visit.establishmentId === null &&
          normalizedClientNames.has(normalizeStoreName(visit.establishment)));

      return visitDate !== null &&
        !visit.isDraft &&
        (visit.promotorId === null || String(visit.promotorId) === String(promotorId)) &&
        belongsToStore &&
        parseCalendarDate(visitDate)
        ? [visitDate]
        : [];
    });
  if (fallbackDate !== null && parseCalendarDate(fallbackDate)) {
    matchingDates.push(fallbackDate);
  }

  return matchingDates.sort((left, right) => right.localeCompare(left))[0] ?? null;
}

function normalizeStoreName(name: string): string {
  return name
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('pt-BR');
}

export function calculateAgendaVisitStatus({
  lastVisitDate,
  daysBetweenVisits,
  today = new Date(),
  visitHistoryAvailable = true,
}: {
  lastVisitDate: string | null;
  daysBetweenVisits: number;
  today?: Date;
  visitHistoryAvailable?: boolean;
}): AgendaVisitStatus {
  const lastVisit = parseCalendarDate(lastVisitDate);

  if (!lastVisit) {
    if (visitHistoryAvailable) {
      return {
        kind: 'first-visit',
        isFirstVisit: true,
        dueDate: null,
        daysRemaining: null,
        daysOverdue: null,
        lastVisitDate: null,
      };
    }

    return {
      kind: 'unavailable',
      isFirstVisit: false,
      dueDate: null,
      daysRemaining: null,
      daysOverdue: null,
      lastVisitDate: null,
    };
  }

  const interval =
    Number.isInteger(daysBetweenVisits) && daysBetweenVisits > 0 ? daysBetweenVisits : 7;
  const dueDate = toDateKey(fromCalendarDay(toCalendarDay(lastVisit) + interval));
  const todayDate = {
    year: today.getFullYear(),
    month: today.getMonth() + 1,
    day: today.getDate(),
  };
  const daysRemaining = toCalendarDay(parseCalendarDate(dueDate)!) - toCalendarDay(todayDate);

  return {
    kind: daysRemaining < 0 ? 'overdue' : daysRemaining <= 3 ? 'upcoming' : 'on-time',
    isFirstVisit: false,
    dueDate,
    daysRemaining,
    daysOverdue: daysRemaining < 0 ? Math.abs(daysRemaining) : null,
    lastVisitDate: toDateKey(lastVisit),
  };
}
