import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api/client';

const revalidatePath = vi.fn();
const clearSession = vi.fn();
const createSession = vi.fn();
const getSession = vi.fn();
const signInPromotor = vi.fn();
const signUpPromotor = vi.fn();
const getPromotorMe = vi.fn();
const createPromotorVisit = vi.fn();
const updatePromotorVisit = vi.fn();
const deleteDraftVisit = vi.fn();
const createPromotorMileage = vi.fn();
const deletePromotorAgendaEntry = vi.fn();
const createCommercialVisit = vi.fn();
const updateCommercialVisit = vi.fn();

vi.mock('next/cache', () => ({
  revalidatePath,
}));

vi.mock('@/lib/auth', () => ({
  clearSession,
  createSession,
  getAppEntryPath: vi.fn((role: string) => (role === 'comercial' ? '/comercial' : '/checkin')),
  getHomePath: vi.fn((role: string) => (role === 'comercial' ? '/comercial' : '/promotor')),
  getSession,
}));

vi.mock('@/lib/db', () => ({
  pool: {
    connect: vi.fn(),
  },
}));

vi.mock('@/lib/api/promotor', () => ({
  createPromotorMileage,
  createPromotorVisit,
  deleteDraftVisit,
  deletePromotorAgendaEntry,
  getPromotorMe,
  signInPromotor,
  signUpPromotor,
  updatePromotorVisit,
}));

vi.mock('@/lib/api/comercial', () => ({
  createCommercialVisit,
  updateCommercialVisit,
}));

describe('actions flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stores the exact token returned by login and replaces the session cookies', async () => {
    signInPromotor.mockResolvedValue({
      accessToken: 'Bearer access-token-from-login',
      user: {
        id: 10,
        email: 'promotor@fiu-fiu.com',
        fullName: 'Promotor Login',
        role: 'promotor',
      },
    });
    getPromotorMe.mockResolvedValue({
      id: 10,
      email: 'promotor@fiu-fiu.com',
      fullName: 'Promotor Login',
      role: 'promotor',
    });

    const { login } = await import('@/lib/actions');
    const result = await login({
      email: 'promotor@fiu-fiu.com',
      password: '123456',
    });

    expect(result).toEqual({
      success: true,
      homePath: '/checkin',
    });
    expect(clearSession).toHaveBeenCalledTimes(1);
    expect(createSession).toHaveBeenCalledWith({
      accessToken: 'Bearer access-token-from-login',
      user: expect.objectContaining({
        email: 'promotor@fiu-fiu.com',
      }),
    });
    expect(clearSession.mock.invocationCallOrder[0]).toBeLessThan(
      createSession.mock.invocationCallOrder[0]
    );
  });

  it('creates a visit with the current session token and normalized payload', async () => {
    getSession.mockResolvedValue({
      accessToken: 'session-token',
      user: {
        id: 20,
        email: 'promotor@fiu-fiu.com',
        fullName: 'Promotor Visita',
        role: 'promotor',
      },
    });
    createPromotorVisit.mockResolvedValue({ id: 55 });

    const { createVisit } = await import('@/lib/actions');
    const result = await createVisit({
      establishment: 999,
      visitDate: '2026-05-20',
      products: [
        {
          name: 'ICE Cajalemon',
          quantity: 4,
          unit: 'pack',
          expirationDate: '2026-06-10',
        },
      ],
      beforeImages: [],
      afterImages: [],
      observation: 'Cadastro via teste',
      isDraft: false,
    });

    expect(result).toEqual({
      success: true,
      visitId: 55,
    });
    expect(createPromotorVisit).toHaveBeenCalledWith(
      'session-token',
      expect.objectContaining({
        establishment: 999,
        visitDate: '2026-05-20',
        observation: 'Cadastro via teste',
        isDraft: false,
      })
    );
    expect(revalidatePath).toHaveBeenCalledWith('/visitas/nova');
  });

  it('clears the session and requests login again when visit creation returns 401', async () => {
    getSession.mockResolvedValue({
      accessToken: 'expired-token',
      user: {
        id: 21,
        email: 'promotor@fiu-fiu.com',
        fullName: 'Promotor Expirado',
        role: 'promotor',
      },
    });
    createPromotorVisit.mockRejectedValue(new ApiError('Invalid access token', 401));

    const { createVisit } = await import('@/lib/actions');
    const result = await createVisit({
      establishment: 999,
      visitDate: '2026-05-20',
      products: [],
      beforeImages: [],
      afterImages: [],
      observation: null,
      isDraft: false,
    });

    expect(result).toEqual({
      success: false,
      error: 'Invalid access token',
      shouldRedirectToLogin: true,
    });
    expect(clearSession).toHaveBeenCalledTimes(1);
  });

  it('saves a visit draft with the active session token', async () => {
    getSession.mockResolvedValue({
      accessToken: 'draft-token',
      user: {
        id: 22,
        email: 'promotor@fiu-fiu.com',
        fullName: 'Promotor Rascunho',
        role: 'promotor',
      },
    });
    createPromotorVisit.mockResolvedValue({ id: 77 });

    const { saveVisitDraft } = await import('@/lib/actions');
    const result = await saveVisitDraft({
      establishment: 321,
      visitDate: '2026-05-20',
      products: [
        {
          name: 'ICE Cajalemon',
          quantity: 0,
          unit: 'pack',
          expirationDate: 'indefinido',
        },
      ],
      beforeImages: [],
      afterImages: [],
      observation: 'Rascunho',
      isDraft: true,
    });

    expect(result).toEqual({
      success: true,
      visitId: 77,
    });
    expect(createPromotorVisit).toHaveBeenCalledWith(
      'draft-token',
      expect.objectContaining({
        isDraft: true,
      })
    );
  });
});
