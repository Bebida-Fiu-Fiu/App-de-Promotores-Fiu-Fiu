import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createCommercialVisit,
  getCommercialVisitById,
  listAllCommercialVisits,
  updateCommercialVisit,
} from '@/lib/api/comercial';

const payload = {
  clientName: 'Bar do Zé',
  fantasyName: 'Zé',
  cnpj: '12345678000190',
  email: null,
  phone: '62999990000',
  address: 'Rua 1',
  value: 1500.5,
  salesQuantity: 3,
  sold: true,
  visitDates: ['2026-11-10'],
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function lastRequest() {
  const [url, init] = vi.mocked(fetch).mock.calls.at(-1) ?? [];
  return { url: String(url), method: (init as RequestInit | undefined)?.method ?? 'GET' };
}

describe('comercial api (FIUFIU-32)', () => {
  beforeEach(() => {
    process.env.BASE_URL = 'https://api.example.com';
    vi.stubGlobal('fetch', vi.fn());
  });

  it('cria em POST /commercial-visits e lê o envelope { commercialVisit }', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ commercialVisit: { id: 9, client_name: 'Bar do Zé', total_value: '1500.50' } }, 201)
    );

    const created = await createCommercialVisit('token', payload);

    expect(lastRequest()).toEqual({ url: 'https://api.example.com/commercial-visits', method: 'POST' });
    expect(created).toMatchObject({ id: 9, clientName: 'Bar do Zé', totalValue: 1500.5 });
  });

  it('atualiza em PUT /commercial-visits/{id}, nunca na rota de visita de promotor', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ commercialVisit: { id: 9 } }));

    await updateCommercialVisit('token', 9, payload);

    const request = lastRequest();
    expect(request).toEqual({ url: 'https://api.example.com/commercial-visits/9', method: 'PUT' });
    expect(request.url).not.toContain('/promotor/visit');
  });

  it('lista em GET /commercial-visits', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ commercialVisits: [{ id: 1 }, { id: 2 }] }));

    const visits = await listAllCommercialVisits('token');

    expect(lastRequest().url).toBe('https://api.example.com/commercial-visits');
    expect(visits.map((visit) => visit.id)).toEqual([1, 2]);
  });

  it('busca uma visita em GET /commercial-visits/{id} e devolve null no 404', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ commercialVisit: { id: 9 } }));
    expect(await getCommercialVisitById('token', 9)).toMatchObject({ id: 9 });
    expect(lastRequest().url).toBe('https://api.example.com/commercial-visits/9');

    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ message: 'Commercial visit not found' }, 404));
    expect(await getCommercialVisitById('token', 404)).toBeNull();
  });
});

describe('agenda api (FIUFIU-32)', () => {
  beforeEach(() => {
    process.env.BASE_URL = 'https://api.example.com';
    vi.stubGlobal('fetch', vi.fn());
  });

  it('cria loja atendida em POST /promotors/agenda (rota publicada no serverless.yml)', async () => {
    const { createPromotorAgendaEntry } = await import('@/lib/api/promotor');
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ agenda: { id: 1 } }, 201));

    await createPromotorAgendaEntry('token', { nickname: 'Loja', daysBetweenVisits: 7, promotorId: 7 });

    expect(lastRequest()).toEqual({ url: 'https://api.example.com/promotors/agenda', method: 'POST' });
  });
});

describe('perfil da sessão (GET /promotor/me)', () => {
  beforeEach(() => {
    process.env.BASE_URL = 'https://api.example.com';
    vi.stubGlobal('fetch', vi.fn());
  });

  it('lê o perfil no envelope { promotor } que a fiu-fiu-api devolve', async () => {
    const { getPromotorMe } = await import('@/lib/api/promotor');
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ promotor: { id: 3, email: 'carla@teste.com', fullName: 'Carla', role: 'comercial' } })
    );

    await expect(getPromotorMe('token')).resolves.toMatchObject({ id: 3, email: 'carla@teste.com', role: 'comercial' });
  });
});
