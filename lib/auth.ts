import { cookies } from 'next/headers';
import type { SessionData, SessionUser, UserRole } from '@/types/auth';

export const SESSION_COOKIE_NAME = 'ff_session';
export const SESSION_ROLE_COOKIE_NAME = 'ff_role';
export const SESSION_ACCESS_TOKEN_COOKIE_NAME = 'ff_access_token';
export const SESSION_USER_COOKIE_NAME = 'ff_user';

const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

function normalizeStoredAccessToken(token: string) {
  const trimmed = token.trim().replace(/^['"]|['"]$/g, '');

  if (!trimmed) {
    return '';
  }

  if (/^bearer\s+/i.test(trimmed)) {
    return trimmed.replace(/^bearer\s+/i, '').trim();
  }

  return trimmed;
}

function isUserRole(value: string | undefined): value is UserRole {
  return value === 'promotor' || value === 'comercial';
}

function decodeJwtPayload(token: string) {
  const parts = token.split('.');

  if (parts.length < 2) {
    return null;
  }

  try {
    const normalized = parts[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(parts[1].length / 4) * 4, '=');
    const json = Buffer.from(normalized, 'base64').toString('utf-8');

    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isJwtExpired(token: string) {
  const payload = decodeJwtPayload(token);
  const expiresAt = Number(payload?.exp);

  if (!Number.isFinite(expiresAt) || expiresAt <= 0) {
    return false;
  }

  const nowInSeconds = Math.floor(Date.now() / 1000);
  return expiresAt <= nowInSeconds;
}

export function getHomePath(role: UserRole | null | undefined) {
  return role === 'comercial' ? '/comercial' : '/promotor';
}

export function getAppEntryPath(role: UserRole | null | undefined) {
  return role === 'comercial' ? '/comercial' : '/checkin';
}

export function getPromotorIdFromSession(session: SessionData | null | undefined) {
  if (!session) {
    return null;
  }

  if (typeof session.user.id === 'number' && session.user.id > 0) {
    return session.user.id;
  }

  const jwtPayload = decodeJwtPayload(session.accessToken);
  const tokenSubject = Number(jwtPayload?.sub);

  return Number.isFinite(tokenSubject) && tokenSubject > 0 ? tokenSubject : null;
}

export async function getSession() {
  const cookieStore = await cookies();
  const accessToken = normalizeStoredAccessToken(
    cookieStore.get(SESSION_ACCESS_TOKEN_COOKIE_NAME)?.value ?? ''
  );
  const userCookie = cookieStore.get(SESSION_USER_COOKIE_NAME)?.value;
  const roleValue = cookieStore.get(SESSION_ROLE_COOKIE_NAME)?.value;

  if (!accessToken || !userCookie) {
    return null;
  }

  if (isJwtExpired(accessToken)) {
    return null;
  }

  try {
    const parsedUser = JSON.parse(userCookie) as Partial<SessionUser>;

    if (!parsedUser?.email) {
      return null;
    }

    return {
      accessToken,
      user: {
        id: typeof parsedUser.id === 'number' ? parsedUser.id : null,
        email: parsedUser.email,
        fullName: typeof parsedUser.fullName === 'string' ? parsedUser.fullName : null,
        role: isUserRole(parsedUser.role) ? parsedUser.role : isUserRole(roleValue) ? roleValue : 'promotor',
      },
    } satisfies SessionData;
  } catch {
    return null;
  }
}

export async function requireSessionUser() {
  const session = await getSession();

  if (!session) {
    return null;
  }

  return session.user;
}

export async function createSession(session: SessionData) {
  const cookieStore = await cookies();
  const accessToken = session.accessToken;
  const { user } = session;

  cookieStore.delete(SESSION_COOKIE_NAME);
  cookieStore.delete(SESSION_ROLE_COOKIE_NAME);
  cookieStore.delete(SESSION_ACCESS_TOKEN_COOKIE_NAME);
  cookieStore.delete(SESSION_USER_COOKIE_NAME);

  cookieStore.set(SESSION_COOKIE_NAME, user.email, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });

  cookieStore.set(SESSION_ROLE_COOKIE_NAME, user.role, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });

  cookieStore.set(SESSION_ACCESS_TOKEN_COOKIE_NAME, accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });

  cookieStore.set(SESSION_USER_COOKIE_NAME, JSON.stringify(user), {
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
  cookieStore.delete(SESSION_ACCESS_TOKEN_COOKIE_NAME);
  cookieStore.delete(SESSION_USER_COOKIE_NAME);
}
