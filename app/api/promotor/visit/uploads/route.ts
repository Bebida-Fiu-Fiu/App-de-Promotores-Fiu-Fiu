import { NextResponse } from 'next/server';

import { clearSession, getSession } from '@/lib/auth';
import { ApiError, apiRequestWithMeta } from '@/lib/api/client';

export async function POST(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { success: false, error: 'Sessao expirada. Faca login novamente.', shouldRedirectToLogin: true },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const response = await apiRequestWithMeta('/promotor/visit/uploads', {
      method: 'POST',
      token: session.accessToken,
      body,
    });

    return NextResponse.json({
      success: true,
      uploads:
        response.data &&
        typeof response.data === 'object' &&
        'uploads' in response.data &&
        Array.isArray((response.data as { uploads?: unknown[] }).uploads)
          ? (response.data as { uploads: unknown[] }).uploads
          : [],
    });
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
        { success: false, error: error.message || 'Nao foi possivel preparar o upload das imagens.' },
        { status: error.status || 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Nao foi possivel preparar o upload das imagens.' },
      { status: 500 }
    );
  }
}
