import { cookies } from 'next/headers';

export const SESSION_COOKIE_NAME = 'ff_session';

const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export async function getSession() {
  const cookieStore = await cookies();
  const email = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!email) {
    return null;
  }

  return { email };
}

export async function requireSessionUser() {
  const session = await getSession();

  if (!session) {
    return null;
  }

  return session;
}

export async function createSession(email: string) {
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, email, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
