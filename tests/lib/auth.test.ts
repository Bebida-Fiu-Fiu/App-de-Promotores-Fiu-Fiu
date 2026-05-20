import { beforeEach, describe, expect, it, vi } from 'vitest';

type CookieValue = { value: string };

function createCookieStore(initial: Record<string, string> = {}) {
  const values = new Map<string, string>(Object.entries(initial));

  return {
    get: vi.fn((name: string): CookieValue | undefined => {
      const value = values.get(name);
      return value === undefined ? undefined : { value };
    }),
    set: vi.fn((name: string, value: string) => {
      values.set(name, value);
    }),
    delete: vi.fn((name: string) => {
      values.delete(name);
    }),
  };
}

describe('auth session helpers', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('replaces existing cookies and stores the exact access token on createSession', async () => {
    const cookieStore = createCookieStore({
      ff_access_token: 'old-token',
    });

    vi.doMock('next/headers', () => ({
      cookies: vi.fn(async () => cookieStore),
    }));

    const auth = await import('@/lib/auth');

    await auth.createSession({
      accessToken: 'Bearer token-from-api',
      user: {
        id: 1,
        email: 'promotor@fiu-fiu.com',
        fullName: 'Promotor Teste',
        role: 'promotor',
      },
    });

    expect(cookieStore.delete).toHaveBeenCalledWith(auth.SESSION_ACCESS_TOKEN_COOKIE_NAME);
    expect(cookieStore.set).toHaveBeenCalledWith(
      auth.SESSION_ACCESS_TOKEN_COOKIE_NAME,
      'Bearer token-from-api',
      expect.any(Object)
    );
  });

  it('returns null when the stored token is expired', async () => {
    const expiredPayload = Buffer.from(JSON.stringify({
      exp: Math.floor(Date.now() / 1000) - 60,
    })).toString('base64url');
    const expiredToken = `header.${expiredPayload}.signature`;

    const cookieStore = createCookieStore({
      ff_access_token: expiredToken,
      ff_user: JSON.stringify({
        email: 'promotor@fiu-fiu.com',
        role: 'promotor',
      }),
    });

    vi.doMock('next/headers', () => ({
      cookies: vi.fn(async () => cookieStore),
    }));

    const auth = await import('@/lib/auth');

    await expect(auth.getSession()).resolves.toBeNull();
  });
});
