import { describe, expect, it } from 'vitest';

import {
  calculateAgendaVisitStatus,
  filterAgendaEntriesByPromotor,
  getMostRecentAgendaVisitDate,
} from '@/lib/agenda-frequency';
import type { AttendedStore, PromotorVisit } from '@/types/promotor';

const today = new Date(2026, 5, 10);

describe('agenda visit frequency', () => {
  it('only includes stores assigned to the exact logged-in promoter ID', () => {
    const agendaEntry = (promotorId: string | number | null): AttendedStore => ({
      id: '0001',
      promotorId,
      promotorName: 'Promotor',
      promotorEmail: null,
      clientId: '00042',
      clientName: 'Loja',
      fantasyName: 'Loja',
      city: '',
      state: '',
      nickname: '',
      notes: null,
      document: '',
      address: '',
      addressNumber: null,
      neighborhood: '',
      daysBetweenVisits: 7,
      lastVisitDate: null,
      createdAt: null,
      updatedAt: null,
    });

    const entries = [agendaEntry('00017'), agendaEntry('0017'), agendaEntry(null)];

    expect(filterAgendaEntriesByPromotor(entries, '00017')).toEqual([entries[0]]);
    expect(filterAgendaEntriesByPromotor(entries, 17)).toEqual([]);
    expect(filterAgendaEntriesByPromotor(entries, null)).toEqual([]);
  });

  it('shows an on-time status when more than three days remain', () => {
    const status = calculateAgendaVisitStatus({
      lastVisitDate: '2026-06-09',
      daysBetweenVisits: 7,
      today,
    });

    expect(status).toMatchObject({
      kind: 'on-time',
      dueDate: '2026-06-16',
      daysRemaining: 6,
      lastVisitDate: '2026-06-09',
    });
  });

  it('shows the upcoming status with exactly three days remaining', () => {
    const status = calculateAgendaVisitStatus({
      lastVisitDate: '2026-06-06',
      daysBetweenVisits: 7,
      today,
    });

    expect(status).toMatchObject({
      kind: 'upcoming',
      dueDate: '2026-06-13',
      daysRemaining: 3,
    });
  });

  it('shows how many calendar days the deadline is overdue', () => {
    const status = calculateAgendaVisitStatus({
      lastVisitDate: '2026-06-01',
      daysBetweenVisits: 7,
      today,
    });

    expect(status).toMatchObject({
      kind: 'overdue',
      dueDate: '2026-06-08',
      daysOverdue: 2,
    });
  });

  it('shows first visit without inventing a deadline when there is no visit history', () => {
    const status = calculateAgendaVisitStatus({
      lastVisitDate: null,
      daysBetweenVisits: 10,
      today,
    });

    expect(status).toMatchObject({
      kind: 'first-visit',
      isFirstVisit: true,
      dueDate: null,
      daysRemaining: null,
    });
  });

  it('uses the latest completed visit for the matching store and promoter', () => {
    const visit = (
      id: number,
      promotorId: string | number | null,
      establishmentId: string | number | null,
      visitDate: string,
      isDraft = false
    ): PromotorVisit => ({
      id,
      promotorId,
      establishmentId,
      establishment: 'Loja',
      visitDate,
      products: [],
      beforeImages: [],
      afterImages: [],
      observation: null,
      isDraft,
      canEdit: true,
      createdAt: null,
      updatedAt: null,
    });

    const visits = [
      visit(1, 7, 42, '2026-06-04'),
      visit(2, 8, 42, '2026-06-09'),
      visit(3, 7, 43, '2026-06-10'),
      visit(4, 7, 42, '2026-06-11', true),
      visit(5, 7, 42, '2026-06-08'),
    ];

    expect(getMostRecentAgendaVisitDate(visits, 7, 42, '2026-06-01')).toBe('2026-06-08');
  });

  it('matches a report visit by exact store name when the API omits IDs', () => {
    const visit: PromotorVisit = {
      id: 6,
      promotorId: null,
      establishmentId: null,
      establishment: '  Teste  ',
      visitDate: '2026-06-09',
      products: [],
      beforeImages: [],
      afterImages: [],
      observation: null,
      isDraft: false,
      canEdit: true,
      createdAt: null,
      updatedAt: null,
    };

    expect(
      getMostRecentAgendaVisitDate([visit], 7, 42, null, ['teste', 'Comercial Super Siao'])
    ).toBe('2026-06-09');
  });

  it('matches opaque IDs without stripping leading zeroes', () => {
    const visit: PromotorVisit = {
      id: 7,
      promotorId: '0017',
      establishmentId: '00042',
      establishment: 'Loja',
      visitDate: '2026-06-09',
      products: [],
      beforeImages: [],
      afterImages: [],
      observation: null,
      isDraft: false,
      canEdit: true,
      createdAt: null,
      updatedAt: null,
    };

    expect(getMostRecentAgendaVisitDate([visit], '0017', '00042', null)).toBe('2026-06-09');
    expect(getMostRecentAgendaVisitDate([visit], 17, 42, null)).toBeNull();
  });
});
