import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

import { clearSession, getSession } from '@/lib/auth';
import { ApiError, apiRequestWithMeta, isRecord } from '@/lib/api/client';

function extractVisitId(payload: unknown) {
  if (!isRecord(payload)) {
    return null;
  }

  const visit = isRecord(payload.visit) ? payload.visit : null;
  const visitId = Number(visit?.id);

  return Number.isFinite(visitId) && visitId > 0 ? visitId : null;
}

function revalidateVisitPaths(visitId: number | null) {
  revalidatePath('/');
  revalidatePath('/promotor');
  revalidatePath('/visitas/nova');

  if (visitId) {
    revalidatePath(`/visitas/${visitId}`);
    revalidatePath(`/visitas/${visitId}/editar`);
  }
}

export async function POST(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { success: false, error: 'Sessao expirada. Faca login novamente.', shouldRedirectToLogin: true },
      { status: 401 }
    );
  }

  try {
    const formData = await request.formData();
    const response = await apiRequestWithMeta('/promotor/visit', {
      method: 'POST',
      token: session.accessToken,
      body: formData,
    });
    const visitId = extractVisitId(response.data);

    revalidateVisitPaths(visitId);

    return NextResponse.json({ success: true, visitId });
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
