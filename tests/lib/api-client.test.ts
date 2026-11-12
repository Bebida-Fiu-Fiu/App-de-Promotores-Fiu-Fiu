import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, apiRequestWithMeta } from '@/lib/api/client';

describe('api client', () => {
  beforeEach(() => {
    process.env.BASE_URL = 'https://api.example.com';
    vi.stubGlobal('fetch', vi.fn());
  });

  it('normalizes bearer tokens before sending the Authorization header', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );

    await apiRequestWithMeta('/promotor/visit', {
      method: 'POST',
      token: 'Bearer token-from-cookie',
      body: { id: 1 },
    });

    expect(fetch).toHaveBeenCalledTimes(1);

    const [, init] = vi.mocked(fetch).mock.calls[0];
    const headers = new Headers(init?.headers);

    expect(headers.get('Authorization')).toBe('Bearer token-from-cookie');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(init?.body).toBe(JSON.stringify({ id: 1 }));
  });

  it('extracts a useful error message from json-like text responses', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response("{ message: 'Invalid access token' }", {
        status: 401,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      })
    );

    await expect(
      apiRequestWithMeta('/promotor/visit', {
        method: 'POST',
        token: 'abc',
      })
    ).rejects.toEqual(expect.objectContaining<Partial<ApiError>>({
      message: 'Invalid access token',
      status: 401,
    }));
  });

  it('includes the API request ID on errors and never logs credentials or payloads', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ message: 'Internal Server Error', accessToken: 'response-secret' }),
        {
          status: 500,
          headers: {
            'content-type': 'application/json',
            'apigw-requestid': 'request-123',
          },
        }
      )
    );

    try {
      await expect(
        apiRequestWithMeta('/promotors/agendas', {
          token: 'request-secret',
          method: 'POST',
          body: { password: 'password-secret' },
        })
      ).rejects.toMatchObject({
        status: 500,
        requestId: 'request-123',
      });

      const loggedOutput = JSON.stringify(logSpy.mock.calls);
      expect(loggedOutput).not.toContain('request-secret');
      expect(loggedOutput).not.toContain('password-secret');
      expect(loggedOutput).not.toContain('response-secret');
      expect(loggedOutput).toContain('request-123');
    } finally {
      logSpy.mockRestore();
    }
  });
});
