import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createPromotorVisit, getVisitById, signInPromotor, updatePromotorVisit } from '@/lib/api/promotor';

describe('promotor api', () => {
  beforeEach(() => {
    process.env.BASE_URL = 'https://api.example.com';
    vi.stubGlobal('fetch', vi.fn());
  });

  it('prefers the accessToken returned by /promotor/signin', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          accessToken: 'access-token-from-api',
          idToken: 'id-token-from-api',
          user: {
            email: 'promotor@fiu-fiu.com',
            role: 'promotor',
          },
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }
      )
    );

    const result = await signInPromotor({
      email: 'promotor@fiu-fiu.com',
      password: '123456',
    });

    expect(result.accessToken).toBe('access-token-from-api');
  });

  it('builds the visit payload with establishmentId and forwards the token', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ id: 99 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );

    await createPromotorVisit('token-123', {
      establishment: 321,
      visitDate: '2026-05-20',
      products: [
        {
          name: 'ICE Cajalemon',
          quantity: 2,
          unit: 'pack',
          expirationDate: '2026-06-01',
        },
      ],
      observation: 'Visita de teste',
      isDraft: false,
    });

    const [, init] = vi.mocked(fetch).mock.calls[0];
    const headers = new Headers(init?.headers);
    const parsedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;

    expect(headers.get('Authorization')).toBe('Bearer token-123');
    expect(parsedBody.establishmentId).toBe(321);
    expect(parsedBody).not.toHaveProperty('stabilishmentId');
    expect(parsedBody.visitDate).toBe('2026-05-20');
    expect(parsedBody).not.toHaveProperty('beforeImage');
    expect(parsedBody).not.toHaveProperty('afterImage');
  });

  it('keeps indefinido as expirationDate when creating a visit', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ id: 99 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );

    await createPromotorVisit('token-123', {
      establishment: 321,
      visitDate: '2026-05-20',
      products: [
        {
          name: 'Licor Banoffe',
          quantity: 0,
          unit: 'unidade',
          expirationDate: 'indefinido',
        },
      ],
      observation: null,
      isDraft: false,
    });

    const [, init] = vi.mocked(fetch).mock.calls[0];
    const parsedBody = JSON.parse(String(init?.body)) as {
      products: Array<{ expirationDate: string }>;
    };

    expect(parsedBody.products[0]?.expirationDate).toBe('indefinido');
  });

  it('reads beforeImages and afterImages from the nested visit response on create', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          visit: {
            id: 99,
            establishment: 'Cliente Teste',
            beforeImages: ['https://cdn.example.com/before-1.jpg'],
            afterImages: ['https://cdn.example.com/after-1.jpg'],
            products: [],
          },
        }),
        {
          status: 201,
          headers: { 'content-type': 'application/json' },
        }
      )
    );

    const result = await createPromotorVisit('token-123', {
      establishment: 321,
      visitDate: '2026-05-20',
      products: [],
      observation: null,
      isDraft: false,
    });

    expect(result?.beforeImages).toEqual(['https://cdn.example.com/before-1.jpg']);
    expect(result?.afterImages).toEqual(['https://cdn.example.com/after-1.jpg']);
  });

  it('accepts image arrays serialized as json strings on update responses', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          visit: {
            id: 100,
            establishment: 'Cliente Teste',
            before_images: '["https://cdn.example.com/before-2.jpg"]',
            after_images: '["https://cdn.example.com/after-2.jpg"]',
            products: [],
          },
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }
      )
    );

    const result = await updatePromotorVisit('token-123', 100, {
      establishment: 321,
      visitDate: '2026-05-20',
      products: [],
      observation: null,
      isDraft: false,
    });

    expect(result?.beforeImages).toEqual(['https://cdn.example.com/before-2.jpg']);
    expect(result?.afterImages).toEqual(['https://cdn.example.com/after-2.jpg']);
  });

  it('reads image links from object arrays on getVisitById', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          visit: {
            id: 101,
            establishment: 'Cliente Teste',
            beforeImages: [
              { imageUrl: 'https://cdn.example.com/before-3.jpg' },
              { image_url: 'https://cdn.example.com/before-4.jpg' },
            ],
            afterImages: [
              { image: { url: 'https://cdn.example.com/after-3.jpg' } },
              { downloadUrl: 'https://cdn.example.com/after-4.jpg' },
            ],
            products: [],
          },
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }
      )
    );

    const result = await getVisitById('token-123', 101);

    expect(result?.beforeImages).toEqual([
      'https://cdn.example.com/before-3.jpg',
      'https://cdn.example.com/before-4.jpg',
    ]);
    expect(result?.afterImages).toEqual([
      'https://cdn.example.com/after-3.jpg',
      'https://cdn.example.com/after-4.jpg',
    ]);
  });
});
