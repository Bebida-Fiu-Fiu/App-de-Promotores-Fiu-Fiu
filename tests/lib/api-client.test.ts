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
    ).rejects.toEqual(expect.objectContaining<ApiError>({
      message: 'Invalid access token',
      status: 401,
    }));
  });
});
