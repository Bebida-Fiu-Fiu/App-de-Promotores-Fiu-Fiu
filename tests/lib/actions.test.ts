import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api/client';
import type { AttendedStore } from '@/types/promotor';

const revalidatePath = vi.fn();
const clearSession = vi.fn();
const createSession = vi.fn();
const getSession = vi.fn();
const signInPromotor = vi.fn();
const signUpPromotor = vi.fn();
const getPromotorMe = vi.fn();
const createPromotorVisit = vi.fn();
const createPromotorAgendaEntry = vi.fn();
const listPromotorAgendaByPromotorId = vi.fn();
const updatePromotorAgendaEntry = vi.fn();
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
  getPromotorOpaqueIdFromSession: vi.fn(
    (session: { user: { id: string | number | null } } | null) => session?.user.id ?? null
  ),
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
  listPromotorAgendaByPromotorId,
  updatePromotorAgendaEntry,
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

const attendedStore: AttendedStore = {
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
  notes: 'Observacao atual',
  document: '123456789',
  address: 'Rua Um',
  addressNumber: null,
  neighborhood: 'Centro',
  daysBetweenVisits: 7,
  lastVisitDate: null,
  createdAt: null,
  updatedAt: null,
};

describe('actions flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('searches attended stores from the promoter agenda API and matches nickname without changing IDs', async () => {
    getSession.mockResolvedValue({
      accessToken: 'session-token',
      user: {
        id: '00017',
        email: 'promotor@fiu-fiu.com',
        fullName: 'Promotor Teste',
        role: 'promotor',
      },
    });
    listPromotorAgendaByPromotorId.mockResolvedValue([
      {
        id: '0009',
        clientId: '00042',
        promotorId: '00017',
        promotorName: 'Promotor Teste',
        promotorEmail: null,
        clientName: 'Mercado Central',
        fantasyName: 'Central',
        city: 'Sao Paulo',
        state: 'SP',
        nickname: 'Loja São Paulo',
        notes: null,
        document: '12.345.678/0001-90',
        address: 'Rua Um',
        addressNumber: null,
        neighborhood: 'Centro',
        daysBetweenVisits: 7,
        lastVisitDate: null,
        createdAt: null,
        updatedAt: null,
      },
      {
        id: '0010',
        clientId: null,
        promotorId: '00017',
        promotorName: 'Promotor Teste',
        promotorEmail: null,
        clientName: '',
        fantasyName: '',
        city: '',
        state: '',
        nickname: 'Loja sem cliente',
        notes: null,
        document: '',
        address: '',
        addressNumber: null,
        neighborhood: '',
        daysBetweenVisits: 7,
        lastVisitDate: null,
        createdAt: null,
        updatedAt: null,
      },
    ]);

    const { searchClients } = await import('@/lib/actions');
    const result = await searchClients({ clientName: 'sao paulo' }, 'agenda');

    expect(listPromotorAgendaByPromotorId).toHaveBeenCalledWith('session-token', '00017');
    expect(result).toEqual({
      success: true,
      clients: [
        {
          id: '00042',
          nickname: 'Loja São Paulo',
          client_name: 'Mercado Central',
          fantasy_name: 'Central',
          document: '12.345.678/0001-90',
          city: 'Sao Paulo',
          address: 'Rua Um',
          address_number: null,
          neighborhood: 'Centro',
          state: 'SP',
        },
      ],
    });
  });

  it('patches only changed attended-store fields and returns the API store', async () => {
    getSession.mockResolvedValue({
      accessToken: 'session-token',
      user: {
        id: '00017',
        email: 'comercial@fiu-fiu.com',
        fullName: 'Equipe Comercial',
        role: 'comercial',
      },
    });
    const updatedStore = { ...attendedStore, nickname: 'Loja Nova', daysBetweenVisits: 14 };
    updatePromotorAgendaEntry.mockResolvedValue(updatedStore);

    const { updateAgendaEntry } = await import('@/lib/actions');
    const result = await updateAgendaEntry(
      '0009',
      { nickname: ' Loja Nova ', daysBetweenVisits: 14 },
      attendedStore
    );

    expect(result).toEqual({ success: true, store: updatedStore });
    expect(updatePromotorAgendaEntry).toHaveBeenCalledWith(
      'session-token',
      '0009',
      { nickname: 'Loja Nova', daysBetweenVisits: 14 },
      attendedStore
    );
    expect(revalidatePath).toHaveBeenCalledWith('/agenda');
  });

  it('sends null explicitly when unlinking the client and promoter', async () => {
    getSession.mockResolvedValue({
      accessToken: 'session-token',
      user: {
        id: '00017',
        email: 'comercial@fiu-fiu.com',
        fullName: 'Equipe Comercial',
        role: 'comercial',
      },
    });
    updatePromotorAgendaEntry.mockResolvedValue({
      ...attendedStore,
      clientId: null,
      promotorId: null,
    });

    const { updateAgendaEntry } = await import('@/lib/actions');
    const result = await updateAgendaEntry(
      '0009',
      { clientId: null, promotorId: null },
      attendedStore
    );

    expect(result.success).toBe(true);
    expect(updatePromotorAgendaEntry).toHaveBeenCalledWith(
      'session-token',
      '0009',
      { clientId: null, promotorId: null },
      attendedStore
    );
  });

  it('rejects empty nicknames and invalid frequencies before calling the API', async () => {
    getSession.mockResolvedValue({
      accessToken: 'session-token',
      user: {
        id: '00017',
        email: 'comercial@fiu-fiu.com',
        fullName: 'Equipe Comercial',
        role: 'comercial',
      },
    });
    const { updateAgendaEntry } = await import('@/lib/actions');

    const emptyNickname = await updateAgendaEntry('0009', { nickname: '  ' }, attendedStore);
    const invalidFrequency = await updateAgendaEntry(
      '0009',
      { daysBetweenVisits: 0 },
      attendedStore
    );

    expect(emptyNickname).toMatchObject({
      success: false,
      error: expect.stringContaining('apelido'),
    });
    expect(invalidFrequency).toMatchObject({
      success: false,
      error: expect.stringContaining('inteiro positivo'),
    });
    expect(updatePromotorAgendaEntry).not.toHaveBeenCalled();
  });

  it.each([
    [400, 'rejeitou as alteracoes'],
    [404, 'nao foi encontrada'],
    [409, 'cliente escolhido ja esta vinculado'],
    [500, 'indisponivel'],
  ])('shows a clear message for PATCH HTTP %i', async (status, message) => {
    getSession.mockResolvedValue({
      accessToken: 'session-token',
      user: {
        id: '00017',
        email: 'comercial@fiu-fiu.com',
        fullName: 'Equipe Comercial',
        role: 'comercial',
      },
    });
    updatePromotorAgendaEntry.mockRejectedValue(new ApiError('API failure', status));

    const { updateAgendaEntry } = await import('@/lib/actions');
    const result = await updateAgendaEntry('0009', { nickname: 'Loja Atualizada' }, attendedStore);

    expect(result).toMatchObject({
      success: false,
      error: expect.stringContaining(message),
    });
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

  it('signUp ignores any role sent by the browser and uses the one from /promotor/me (FIUFIU-33)', async () => {
    signUpPromotor.mockResolvedValue({
      accessToken: 'token-signup',
      user: { id: 11, email: 'novo@fiu-fiu.com', fullName: 'Novo Usuario', role: 'comercial' },
    });
    getPromotorMe.mockResolvedValue({ id: 11, email: 'novo@fiu-fiu.com', fullName: 'Novo Usuario', role: 'promotor' });

    const { signUp } = await import('@/lib/actions');
    const result = await signUp({
      fullName: 'Novo Usuario',
      email: 'novo@fiu-fiu.com',
      password: '123456',
      confirmPassword: '123456',
      role: 'comercial',
    } as Parameters<typeof signUp>[0]);

    expect(result).toEqual({ success: true, homePath: '/checkin' });
    expect(signUpPromotor.mock.calls[0][0]).not.toHaveProperty('role');
    expect(createSession).toHaveBeenCalledWith({
      accessToken: 'token-signup',
      user: expect.objectContaining({ role: 'promotor' }),
    });
  });

  it('login falls back to the least privileged role when /promotor/me fails', async () => {
    signInPromotor.mockResolvedValue({
      accessToken: 'token-login',
      user: { id: 12, email: 'x@fiu-fiu.com', fullName: 'X', role: 'comercial' },
    });
    getPromotorMe.mockRejectedValue(new ApiError('down', 503));

    const { login } = await import('@/lib/actions');
    await login({ email: 'x@fiu-fiu.com', password: '123456' });

    expect(createSession).toHaveBeenCalledWith({
      accessToken: 'token-login',
      user: expect.objectContaining({ role: 'promotor' }),
    });
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

  it('creates a store agenda assigned to the logged-in user with custom frequency', async () => {
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
      nickname: 'Loja Centro',
      daysBetweenVisits: 14,
    });

    expect(result).toEqual({ success: true });
    expect(createPromotorAgendaEntry).toHaveBeenCalledWith('session-token', {
      clientId: '00042',
      promotorId: 20,
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
      nickname: 'Loja Centro',
    });

    expect(result).toEqual({ success: true });
    expect(createPromotorAgendaEntry).toHaveBeenCalledWith('session-token', {
      clientId: '00042',
      promotorId: 20,
      nickname: 'Loja Centro',
      daysBetweenVisits: 7,
    });
  });

  it('creates an attended store using its nickname and the logged-in promoter', async () => {
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
      promotorId: 20,
    });
  });

  it('allows linking a client while assigning the logged-in promoter', async () => {
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
      promotorId: 20,
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
      promotorId: 21,
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
