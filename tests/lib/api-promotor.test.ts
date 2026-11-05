import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createPromotorAgendaEntry,
  createPromotorVisit,
  getVisitById,
  listAllVisitsReportByPromotorId,
  listAllPromotorAgendas,
  listPromotorAgendaByPromotorId,
  signInPromotor,
  updatePromotorAgendaEntry,
  updatePromotorVisit,
} from '@/lib/api/promotor';
import type { AttendedStore } from '@/types/promotor';

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

  it('normalizes agenda visit frequency and defaults missing intervals to seven days', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          agendas: [
            { id: '0001', clientId: '00042', promotorId: '0017', daysBetweenVisits: 14, lastVisitDate: '2026-06-01' },
            { id: 2, clientId: 43, days_between_visits: 5, created_at: '2026-05-01' },
            { id: 3, clientId: 44, daysBetweenVisits: 0 },
          ],
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }
      )
    );

    const agenda = await listPromotorAgendaByPromotorId('token-123', 17);

    expect(agenda.map((entry) => entry.daysBetweenVisits)).toEqual([14, 5, 7]);
    expect(agenda[0]?.lastVisitDate).toBe('2026-06-01');
    expect(agenda[1]?.createdAt).toBe('2026-05-01');
    expect(agenda[0]).toMatchObject({
      id: '0001',
      clientId: '00042',
      promotorId: '0017',
    });
  });

  it('lists every store agenda and keeps opaque IDs unchanged', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          agendas: [
            { id: '0009', clientId: '00042', promotorId: '0017', promotorName: 'Joao' },
            { id: '0010', nickname: 'Loja sem vinculos' },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    const agendas = await listAllPromotorAgendas('token-123');
    expect(agendas[0]).toMatchObject({
      id: '0009',
      clientId: '00042',
      promotorId: '0017',
      promotorName: 'Joao',
    });
    expect(agendas[1]).toMatchObject({
      id: '0010',
      nickname: 'Loja sem vinculos',
      clientId: null,
      promotorId: null,
      daysBetweenVisits: 7,
    });
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toBe(
      'https://api.example.com/promotors/agendas'
    );
  });

  it('posts the selected IDs and custom visit interval without coercing IDs', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ id: '0009' }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      })
    );

    await createPromotorAgendaEntry('token-123', {
      clientId: '00042',
      promotorId: '0017',
      nickname: 'Loja Centro',
      daysBetweenVisits: 14,
    });

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(String(init?.body))).toEqual({
      clientId: '00042',
      promotorId: '0017',
      nickname: 'Loja Centro',
      daysBetweenVisits: 14,
    });
  });

  it('posts only the required nickname when a store has no optional links', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ id: '0010' }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      })
    );

    await createPromotorAgendaEntry('token-123', {
      nickname: 'Loja sem vinculos',
      daysBetweenVisits: 7,
    });

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(String(init?.body))).toEqual({
      nickname: 'Loja sem vinculos',
      daysBetweenVisits: 7,
    });
  });

  it('patches an attended store using its opaque ID and preserves explicit unlinks', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            id: '0009',
            nickname: 'Loja atualizada',
            client_id: null,
            promotor_id: null,
            days_between_visits: 14,
            notes: 'Nova observacao',
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );
    const currentStore: AttendedStore = {
      id: '0009',
      promotorId: '00017',
      promotorName: 'Promotor Teste',
      promotorEmail: null,
      clientId: '00042',
      clientName: 'Mercado Central',
      fantasyName: 'Central',
      city: 'Sao Paulo',
      state: 'SP',
      nickname: 'Loja Centro',
      notes: null,
      document: '',
      address: '',
      addressNumber: null,
      neighborhood: '',
      daysBetweenVisits: 7,
      lastVisitDate: null,
      createdAt: null,
      updatedAt: null,
    };

    const updatedStore = await updatePromotorAgendaEntry(
      'token-123',
      '0009',
      { nickname: 'Loja atualizada', clientId: null, promotorId: null },
      currentStore
    );

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe('https://api.example.com/promotor/agenda/0009');
    expect(init?.method).toBe('PATCH');
    expect(JSON.parse(String(init?.body))).toEqual({
      nickname: 'Loja atualizada',
      clientId: null,
      promotorId: null,
    });
    expect(updatedStore).toMatchObject({
      id: '0009',
      clientId: null,
      promotorId: null,
      daysBetweenVisits: 14,
      notes: 'Nova observacao',
    });
  });

  it('preserves a 409 conflict from creating a store agenda', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ message: 'Already assigned' }), {
        status: 409,
        headers: { 'content-type': 'application/json' },
      })
    );

    await expect(
      createPromotorAgendaEntry('token-123', {
        clientId: '00042',
        promotorId: '0017',
        nickname: 'Loja Centro',
        daysBetweenVisits: 7,
      })
    ).rejects.toMatchObject({ status: 409 });
  });

  it('loads all visits from the report endpoint used by the visits screen', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            visits: [
              {
                id: 1,
                establishment: 'teste',
                establishmentId: null,
                promotorId: null,
                visitDate: '2026-11-01',
              },
            ],
            hasNextPage: true,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ visits: [], hasNextPage: false }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      );

    const visits = await listAllVisitsReportByPromotorId('token-123', '0017');

    expect(visits).toHaveLength(1);
    expect(visits[0]).toMatchObject({
      establishment: 'teste',
      establishmentId: null,
      promotorId: null,
      visitDate: '2026-11-01',
    });
    expect(vi.mocked(fetch).mock.calls.map(([url]) => String(url))).toEqual([
      'https://api.example.com/visits/report?promotorId=0017&page=1&limit=100',
      'https://api.example.com/visits/report?promotorId=0017&page=2&limit=100',
    ]);
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

  it('sanitizes corrupted signed S3 urls embedded in image paths', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          visit: {
            id: 102,
            establishment: 'Cliente Teste',
            beforeImages: [
              'https://visit-bucket.s3.sa-east-1.amazonaws.com/visits/promotors/17/2026-05-21/before/photo.jpg%3FX-Amz-Algorithm%3DAWS4-HMAC-SHA256%26X-Amz-Signature%3Dold?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=new',
            ],
            afterImages: [],
            products: [],
          },
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }
      )
    );

    const result = await getVisitById('token-123', 102);

    expect(result?.beforeImages).toEqual([
      'https://visit-bucket.s3.sa-east-1.amazonaws.com/visits/promotors/17/2026-05-21/before/photo.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=new',
    ]);
  });
});
