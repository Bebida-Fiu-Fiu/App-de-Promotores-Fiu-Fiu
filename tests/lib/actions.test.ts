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
const createPromotorAgendaEntry = vi.fn();
const updatePromotorVisit = vi.fn();
const deleteDraftVisit = vi.fn();
const createPromotorMileage = vi.fn();
const deletePromotorAgendaEntry = vi.fn();
const createCommercialVisit = vi.fn();
const updateCommercialVisit = vi.fn();
const requestApiPasswordRecovery = vi.fn();
const verifyApiRecoveryCode = vi.fn();
const resetApiPassword = vi.fn();

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
  createPromotorAgendaEntry,
  createPromotorVisit,
  deleteDraftVisit,
  deletePromotorAgendaEntry,
  getPromotorMe,
  signInPromotor,
  signUpPromotor,
  updatePromotorVisit,
  requestApiPasswordRecovery,
  verifyApiRecoveryCode,
  resetApiPassword,
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

  it('creates a store agenda with the selected promoter and custom frequency', async () => {
    getSession.mockResolvedValue({
      accessToken: 'session-token',
      user: {
        id: 20,
        email: 'comercial@fiu-fiu.com',
        fullName: 'Equipe Comercial',
        role: 'comercial',
      },
    });

    const { createAgendaEntry } = await import('@/lib/actions');
    const result = await createAgendaEntry({
      clientId: '00042',
      promotorId: '0017',
      nickname: 'Loja Centro',
      daysBetweenVisits: 14,
    });

    expect(result).toEqual({ success: true });
    expect(createPromotorAgendaEntry).toHaveBeenCalledWith('session-token', {
      clientId: '00042',
      promotorId: '0017',
      nickname: 'Loja Centro',
      daysBetweenVisits: 14,
    });
    expect(revalidatePath).toHaveBeenCalledWith('/agenda');
  });

  it('uses the seven-day default when creating an agenda without a custom interval', async () => {
    getSession.mockResolvedValue({
      accessToken: 'session-token',
      user: {
        id: 20,
        email: 'comercial@fiu-fiu.com',
        fullName: 'Equipe Comercial',
        role: 'comercial',
      },
    });

    const { createAgendaEntry } = await import('@/lib/actions');
    const result = await createAgendaEntry({
      clientId: '00042',
      promotorId: '0017',
      nickname: 'Loja Centro',
    });

    expect(result).toEqual({ success: true });
    expect(createPromotorAgendaEntry).toHaveBeenCalledWith('session-token', {
      clientId: '00042',
      promotorId: '0017',
      nickname: 'Loja Centro',
      daysBetweenVisits: 7,
    });
  });

  it('creates an attended store using only its required nickname', async () => {
    getSession.mockResolvedValue({
      accessToken: 'session-token',
      user: {
        id: 20,
        email: 'comercial@fiu-fiu.com',
        fullName: 'Equipe Comercial',
        role: 'comercial',
      },
    });

    const { createAgendaEntry } = await import('@/lib/actions');
    const result = await createAgendaEntry({ nickname: 'Loja sem vinculos' });

    expect(result).toEqual({ success: true });
    expect(createPromotorAgendaEntry).toHaveBeenCalledWith('session-token', {
      nickname: 'Loja sem vinculos',
      daysBetweenVisits: 7,
    });
  });

  it('allows linking a client without assigning a promoter', async () => {
    getSession.mockResolvedValue({
      accessToken: 'session-token',
      user: {
        id: 20,
        email: 'comercial@fiu-fiu.com',
        fullName: 'Equipe Comercial',
        role: 'comercial',
      },
    });

    const { createAgendaEntry } = await import('@/lib/actions');
    const result = await createAgendaEntry({
      clientId: '00042',
      nickname: 'Loja sem promotor',
      daysBetweenVisits: 14,
    });

    expect(result).toEqual({ success: true });
    expect(createPromotorAgendaEntry).toHaveBeenCalledWith('session-token', {
      clientId: '00042',
      nickname: 'Loja sem promotor',
      daysBetweenVisits: 14,
    });
  });

  it('explains that a 409 client conflict means the client is already linked', async () => {
    getSession.mockResolvedValue({
      accessToken: 'session-token',
      user: {
        id: 21,
        email: 'comercial@fiu-fiu.com',
        fullName: 'Equipe Comercial',
        role: 'comercial',
      },
    });
    createPromotorAgendaEntry.mockRejectedValue(new ApiError('Already assigned', 409));

    const { createAgendaEntry } = await import('@/lib/actions');
    const result = await createAgendaEntry({
      clientId: '00042',
      promotorId: '0017',
      nickname: 'Loja Centro',
      daysBetweenVisits: 7,
    });

    expect(result).toMatchObject({
      success: false,
      error: expect.stringContaining('cliente escolhido ja esta vinculado a outra loja atendida'),
    });
  });

  it('rejects an empty nickname before calling the API', async () => {
    getSession.mockResolvedValue({
      accessToken: 'session-token',
      user: {
        id: 22,
        email: 'comercial@fiu-fiu.com',
        fullName: 'Equipe Comercial',
        role: 'comercial',
      },
    });

    const { createAgendaEntry } = await import('@/lib/actions');
    const result = await createAgendaEntry({ nickname: '   ' });

    expect(result.success).toBe(false);
    expect(createPromotorAgendaEntry).not.toHaveBeenCalled();
  });

  it('rejects a non-positive or fractional agenda frequency before the API request', async () => {
    getSession.mockResolvedValue({
      accessToken: 'session-token',
      user: {
        id: 22,
        email: 'comercial@fiu-fiu.com',
        fullName: 'Equipe Comercial',
        role: 'comercial',
      },
    });

    const { createAgendaEntry } = await import('@/lib/actions');
    const result = await createAgendaEntry({
      clientId: '00042',
      promotorId: '0017',
      nickname: 'Loja Centro',
      daysBetweenVisits: 2.5,
    });

    expect(result.success).toBe(false);
    expect(createPromotorAgendaEntry).not.toHaveBeenCalled();
  });

  it('shows a clear message when the API rejects the request with 400 or 500', async () => {
    getSession.mockResolvedValue({
      accessToken: 'session-token',
      user: {
        id: 22,
        email: 'comercial@fiu-fiu.com',
        fullName: 'Equipe Comercial',
        role: 'comercial',
      },
    });
    const { createAgendaEntry } = await import('@/lib/actions');

    createPromotorAgendaEntry.mockRejectedValueOnce(new ApiError('Bad request', 400));
    const badRequestResult = await createAgendaEntry({ nickname: 'Loja teste' });
    expect(badRequestResult).toMatchObject({
      success: false,
      error: expect.stringContaining('API rejeitou os dados'),
    });

    createPromotorAgendaEntry.mockRejectedValueOnce(new ApiError('Server error', 500));
    const serverErrorResult = await createAgendaEntry({ nickname: 'Loja teste' });
    expect(serverErrorResult).toMatchObject({
      success: false,
      error: expect.stringContaining('servico de lojas atendidas esta indisponivel'),
    });
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

  describe('password recovery flows', () => {
    it('requests recovery code successfully', async () => {
      requestApiPasswordRecovery.mockResolvedValue(true);
      const { requestPasswordRecovery } = await import('@/lib/actions');
      const result = await requestPasswordRecovery('promotor@example.com');
      expect(result).toEqual({ success: true });
      expect(requestApiPasswordRecovery).toHaveBeenCalledWith('promotor@example.com');
    });

    it('returns error when request recovery code validation fails', async () => {
      const { requestPasswordRecovery } = await import('@/lib/actions');
      const result = await requestPasswordRecovery('invalid-email');
      expect(result).toEqual({ success: false, error: 'E-mail invalido.' });
      expect(requestApiPasswordRecovery).not.toHaveBeenCalled();
    });

    it('verifies recovery code successfully', async () => {
      verifyApiRecoveryCode.mockResolvedValue({ valid: true });
      const { verifyRecoveryCode } = await import('@/lib/actions');
      const result = await verifyRecoveryCode('promotor@example.com', '123456');
      expect(result).toEqual({ success: true, error: null });
      expect(verifyApiRecoveryCode).toHaveBeenCalledWith('promotor@example.com', '123456');
    });

    it('returns error when verify recovery code is invalid', async () => {
      verifyApiRecoveryCode.mockResolvedValue({ valid: false });
      const { verifyRecoveryCode } = await import('@/lib/actions');
      const result = await verifyRecoveryCode('promotor@example.com', '111111');
      expect(result).toEqual({ success: false, error: 'Codigo invalido ou expirado.' });
    });

    it('resets password successfully when valid', async () => {
      resetApiPassword.mockResolvedValue(true);
      const { resetPassword } = await import('@/lib/actions');
      const result = await resetPassword({
        email: 'promotor@example.com',
        code: '123456',
        password: 'NewSecurePass123',
        confirmPassword: 'NewSecurePass123',
      });
      expect(result).toEqual({ success: true });
      expect(resetApiPassword).toHaveBeenCalledWith({
        email: 'promotor@example.com',
        code: '123456',
        password: 'NewSecurePass123',
        confirmPassword: 'NewSecurePass123',
      });
    });

    it('returns error when reset password is too short (< 8 chars)', async () => {
      const { resetPassword } = await import('@/lib/actions');
      const result = await resetPassword({
        email: 'promotor@example.com',
        code: '123456',
        password: 'short',
        confirmPassword: 'short',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('A senha deve ter pelo menos 8 caracteres');
    });

    it('returns error when reset passwords mismatch', async () => {
      const { resetPassword } = await import('@/lib/actions');
      const result = await resetPassword({
        email: 'promotor@example.com',
        code: '123456',
        password: 'NewSecurePass123',
        confirmPassword: 'DifferentPass123',
      });
      expect(result).toEqual({ success: false, error: 'As senhas nao coincidem' });
    });
  });
});
