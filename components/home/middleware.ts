import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession, getAppEntryPath } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const session = await getSession();
  const { pathname } = request.nextUrl;

  const publicPaths = ['/login', '/signup'];
  const isPublicPath = publicPaths.includes(pathname);

  // Se o usuário está autenticado
  if (session) {
    // Se tentar acessar uma rota pública (login/signup), redireciona para a página inicial do usuário
    if (isPublicPath) {
      const homePath = getAppEntryPath(session.user.role);
      return NextResponse.redirect(new URL(homePath, request.url));
    }
    // Caso contrário, permite que prossiga para a página autenticada solicitada
    return NextResponse.next();
  }

  // Se o usuário NÃO está autenticado
  // Se tentar acessar uma rota protegida, redireciona para a página de login
  if (!isPublicPath) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Se tentar acessar uma rota pública (login/signup) e não está autenticado, permite que prossiga
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|Texture|manifest.ts|service-worker.js).*)'],
};