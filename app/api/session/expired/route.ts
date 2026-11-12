import { NextResponse, type NextRequest } from 'next/server';

import { clearSession } from '@/lib/auth';

/**
 * Destino de Server Components que recebem 401 da API.
 * Server Components não podem apagar cookies, e sem apagar a sessão o /login
 * redireciona de volta para a home, criando um loop. Este handler limpa a sessão
 * e manda para o login com o aviso de sessão expirada.
 */
export async function GET(request: NextRequest) {
  await clearSession();

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('sessao', 'expirada');

  return NextResponse.redirect(loginUrl);
}
