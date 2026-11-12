import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api/client';
import type { SessionData } from '@/types/auth';

const { listVisitsReportByPromotorId, redirect } = vi.hoisted(() => ({
  listVisitsReportByPromotorId: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

vi.mock('next/navigation', () => ({ redirect }));

vi.mock('@/lib/api/promotor', () => ({ listVisitsReportByPromotorId }));

import { HOME_VISITS_ERRORS, loadHomeVisitsPage, VISITS_PAGE_SIZE } from '@/lib/home-visits';

function buildSession(id: SessionData['user']['id'] = 42): SessionData {
  return {
    accessToken: 'token-abc',
    user: { id, email: 'promotor@fiufiu.com', fullName: 'Ana Promotora', role: 'promotor' },
  };
}

const visit = {
  id: 7,
  establishment: 'Mercado Centro',
  visitDate: '2026-11-09',
  isDraft: false,
  canEdit: true,
  products: [],
  observation: null,
};

describe('loadHomeVisitsPage', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('busca a página pedida das visitas do promotor da sessão', async () => {
    listVisitsReportByPromotorId.mockResolvedValue({ items: [visit], hasNextPage: true, total: 23 });

    const result = await loadHomeVisitsPage(buildSession(), 2);

    expect(listVisitsReportByPromotorId).toHaveBeenCalledWith('token-abc', 42, {
      page: 2,
      pageSize: VISITS_PAGE_SIZE,
    });
    expect(result).toEqual({ visits: [visit], hasNextPage: true, totalVisits: 23, loadError: null });
  });

  it('aceita ID opaco (string) do promotor', async () => {
    listVisitsReportByPromotorId.mockResolvedValue({ items: [], hasNextPage: false, total: 0 });

    await loadHomeVisitsPage(buildSession('prm_9f2'), 1);

    expect(listVisitsReportByPromotorId).toHaveBeenCalledWith('token-abc', 'prm_9f2', expect.any(Object));
  });

  it('avisa quando não identifica o promotor, sem chamar a API', async () => {
    const session = buildSession(null);
    session.accessToken = 'token-sem-sub';

    const result = await loadHomeVisitsPage(session, 1);

    expect(listVisitsReportByPromotorId).not.toHaveBeenCalled();
    expect(result.loadError).toBe(HOME_VISITS_ERRORS.missingPromotor);
    expect(result.visits).toEqual([]);
  });

  it('mostra erro tratável quando a API falha, em vez de lista vazia silenciosa', async () => {
    listVisitsReportByPromotorId.mockRejectedValue(new ApiError('boom', 500, null, 'req-1'));

    const result = await loadHomeVisitsPage(buildSession(), 1);

    expect(result).toEqual({
      visits: [],
      hasNextPage: false,
      totalVisits: null,
      loadError: HOME_VISITS_ERRORS.unavailable,
    });
    expect(console.error).toHaveBeenCalledWith(
      'Home visits lookup API error:',
      expect.objectContaining({ status: 500, requestId: 'req-1' })
    );
  });

  it('mostra erro tratável em falha de rede', async () => {
    listVisitsReportByPromotorId.mockRejectedValue(new TypeError('fetch failed'));

    const result = await loadHomeVisitsPage(buildSession(), 1);

    expect(result.loadError).toBe(HOME_VISITS_ERRORS.unavailable);
  });

  it('limpa a sessão e leva ao login quando a API recusa a sessão', async () => {
    listVisitsReportByPromotorId.mockRejectedValue(new ApiError('Invalid access token', 401));

    await expect(loadHomeVisitsPage(buildSession(), 1)).rejects.toThrow(
      'NEXT_REDIRECT:/api/session/expired'
    );
    expect(redirect).toHaveBeenCalledWith('/api/session/expired');
  });
});
