import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

import { clearSession, getSession } from '@/lib/auth';
import { ApiError, apiRequestWithMeta, isRecord } from '@/lib/api/client';

function extractVisitId(payload: unknown, fallbackVisitId: number) {
  if (!isRecord(payload)) {
    return fallbackVisitId;
  }

  const visit = isRecord(payload.visit) ? payload.visit : null;
  const visitId = Number(visit?.id);

  return Number.isFinite(visitId) && visitId > 0 ? visitId : fallbackVisitId;
}

function revalidateVisitPaths(visitId: number) {
  revalidatePath('/');
  revalidatePath('/promotor');
  revalidatePath('/visitas/nova');
  revalidatePath(`/visitas/${visitId}`);
  revalidatePath(`/visitas/${visitId}/editar`);
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ visitId: string }> }
) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { success: false, error: 'Sessao expirada. Faca login novamente.', shouldRedirectToLogin: true },
      { status: 401 }
    );
  }

  const { visitId: rawVisitId } = await context.params;
  const visitId = Number(rawVisitId);

  if (!Number.isFinite(visitId) || visitId <= 0) {
    return NextResponse.json(
      { success: false, error: 'Visita invalida.' },
      { status: 400 }
    );
  }

  try {
    const formData = await request.formData();
    const response = await apiRequestWithMeta(`/promotor/visit/${visitId}`, {
      method: 'PUT',
      token: session.accessToken,
      body: formData,
    });
    const nextVisitId = extractVisitId(response.data, visitId);

    revalidateVisitPaths(nextVisitId);

    return NextResponse.json({ success: true, visitId: nextVisitId });
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 401) {
        await clearSession();

        return NextResponse.json(
          {
            success: false,
            error: error.message || 'Sessao expirada. Faca login novamente.',
            shouldRedirectToLogin: true,
          },
          { status: 401 }
        );
      }

      return NextResponse.json(
        { success: false, error: error.message || 'Nao foi possivel salvar a visita.' },
        { status: error.status || 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Nao foi possivel salvar a visita.' },
      { status: 500 }
    );
  }
}
