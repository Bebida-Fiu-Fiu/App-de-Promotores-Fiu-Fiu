import { cookies } from 'next/headers';

export const SESSION_COOKIE_NAME = 'ff_session';
export const SESSION_ROLE_COOKIE_NAME = 'ff_role';

export const USER_ROLES = ['promotor', 'comercial'] as const;

export type UserRole = (typeof USER_ROLES)[number];

const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

function isUserRole(value: string | undefined): value is UserRole {
  return value === 'promotor' || value === 'comercial';
}

export function getHomePath(role: UserRole | null | undefined) {
  return role === 'comercial' ? '/comercial' : '/promotor';
}

export async function getSession() {
  const cookieStore = await cookies();
  const email = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const roleValue = cookieStore.get(SESSION_ROLE_COOKIE_NAME)?.value;

  if (!email) {
    return null;
  }

  return {
    email,
    role: isUserRole(roleValue) ? roleValue : 'promotor',
  };
}

export async function requireSessionUser() {
  const session = await getSession();

  if (!session) {
    return null;
  }

  return session;
}

export async function createSession(email: string, role: UserRole = 'promotor') {
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, email, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });

  cookieStore.set(SESSION_ROLE_COOKIE_NAME, role, {
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
  cookieStore.delete(SESSION_ROLE_COOKIE_NAME);
}
