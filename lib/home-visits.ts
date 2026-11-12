import 'server-only';

import { redirect } from 'next/navigation';

import { ApiError } from '@/lib/api/client';
import { listVisitsReportByPromotorId } from '@/lib/api/promotor';
import { getPromotorOpaqueIdFromSession, SESSION_EXPIRED_PATH } from '@/lib/auth';
import type { SessionData } from '@/types/auth';
import type { PromotorVisit } from '@/types/promotor';

export const VISITS_PAGE_SIZE = 10;

export const HOME_VISITS_ERRORS = {
  missingPromotor: 'Não foi possível identificar o promotor da sessão. Saia e entre novamente.',
  unavailable: 'Não foi possível carregar suas visitas. Verifique a conexão e tente novamente.',
} as const;

export type HomeVisitsPage = {
  visits: PromotorVisit[];
  hasNextPage: boolean;
  totalVisits: number | null;
  loadError: string | null;
};

function failedPage(loadError: string): HomeVisitsPage {
  return { visits: [], hasNextPage: false, totalVisits: null, loadError };
}

/**
 * Carrega uma página das visitas do promotor logado para a home.
 * Falhas viram `loadError` para a tela mostrar uma mensagem e um "Tentar novamente",
 * em vez de uma lista vazia que parece "nenhuma visita cadastrada".
 * Sessão recusada pela API (401) limpa a sessão e leva ao login.
 */
export async function loadHomeVisitsPage(session: SessionData, page: number): Promise<HomeVisitsPage> {
  const promotorId = getPromotorOpaqueIdFromSession(session);

  if (promotorId === null) {
    return failedPage(HOME_VISITS_ERRORS.missingPromotor);
  }

  try {
    const result = await listVisitsReportByPromotorId(session.accessToken, promotorId, {
      page,
      pageSize: VISITS_PAGE_SIZE,
    });

    return {
      visits: result.items,
      hasNextPage: result.hasNextPage,
      totalVisits: result.total,
      loadError: null,
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect(SESSION_EXPIRED_PATH);
    }

    if (error instanceof ApiError) {
      console.error('Home visits lookup API error:', {
        status: error.status,
        requestId: error.requestId,
        message: error.message,
      });
    } else {
      console.error('Home visits lookup error:', error);
    }

    return failedPage(HOME_VISITS_ERRORS.unavailable);
  }
}
