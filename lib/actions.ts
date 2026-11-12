'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { pool } from '@/lib/db';
import {
  clearSession,
  createSession,
  getAppEntryPath,
  getHomePath,
  getPromotorOpaqueIdFromSession,
  getSession,
} from '@/lib/auth';
import { getWeeklyVehicleCheckDateContext } from '@/lib/weekly-vehicle-check';
import { resolveRoleFromServer } from '@/lib/session-role';
import { toApiVisitDate } from '@/lib/commercial-dates';
import { ApiError } from '@/lib/api/client';
import {
  createPromotorMileage,
  createPromotorAgendaEntry,
  listPromotorAgendaByPromotorId,
  deleteDraftVisit,
  deletePromotorAgendaEntry,
  createPromotorVisit,
  getPromotorMe,
  signInPromotor,
  signUpPromotor,
  updatePromotorAgendaEntry,
  updatePromotorVisit,
  requestApiPasswordRecovery,
  verifyApiRecoveryCode,
  resetApiPassword,
} from '@/lib/api/promotor';
import { createCommercialVisit, updateCommercialVisit } from '@/lib/api/comercial';
import type { AttendedStore } from '@/types/promotor';
import type { AttendedStorePatch } from '@/lib/api/promotor';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const signupSchema = loginSchema.extend({
  fullName: z.string().min(3),
  confirmPassword: z.string().min(6),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

const recoveryRequestSchema = z.object({
  email: z.string().email(),
});

const recoveryVerifySchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

const recoveryResetSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
  password: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres'),
  confirmPassword: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas nao coincidem',
  path: ['confirmPassword'],
});

function parseIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split('-').map(Number);

  if (!year || !month || !day) {
    return null;
  }

  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

const INDEFINITE_EXPIRATION_LABEL = 'indefinido';

const INDEFINITE_EXPIRATION_PRODUCTS = new Set(
  [
    'Cajazinha',
    'Abacaxi Cortelã',
    'Tangerina com Acerola',
    'Pomar',
    'Pitaya com Melancia',
  ].map((productName) => productName.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase())
);

function normalizeProductName(productName: string) {
  return productName.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function isIndefiniteExpirationValue(value: string) {
  return value.trim().toLowerCase() === INDEFINITE_EXPIRATION_LABEL;
}

function shouldUseIndefiniteExpiration(productName: string, quantity: number) {
  if (quantity === 0 && productName.trim()) {
    return true;
  }

  return INDEFINITE_EXPIRATION_PRODUCTS.has(normalizeProductName(productName));
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
}

function isExpirationWithinVisitWindow(visitDate: string, expirationDate: string) {
  const parsedVisitDate = parseIsoDate(visitDate);
  const parsedExpirationDate = parseIsoDate(expirationDate);

  if (!parsedVisitDate || !parsedExpirationDate) {
    return false;
  }

  return parsedExpirationDate.getTime() <= addMonths(parsedVisitDate, 18).getTime();
}

const visitProductSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().min(0),
  unit: z.enum(['unidade', 'pack', 'caixa']),
  expirationDate: z.string().refine(
    (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) || isIndefiniteExpirationValue(value),
    'Informe uma validade valida.'
  ),
});

const visitImageSchema = z.object({
  filename: z.string().trim().min(1),
  contentType: z.string().trim().min(1),
  base64: z.string().trim().min(1),
});

const visitSchema = z.object({
  establishment: z.union([z.string().min(1), z.number().int().nonnegative()]).nullable().optional(),
  visitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  products: z.array(visitProductSchema).optional().default([]),
  isDraft: z.boolean().optional(),
  beforeImages: z.array(z.union([z.string().trim(), visitImageSchema])).optional(),
  afterImages: z.array(z.union([z.string().trim(), visitImageSchema])).optional(),
  observation: z.string().trim().nullable().optional(),
}).superRefine((visit, ctx) => {
  if (!visit.visitDate) {
    return;
  }

  visit.products.forEach((product, index) => {
    const requiresIndefiniteExpiration = shouldUseIndefiniteExpiration(product.name, product.quantity);

    if (requiresIndefiniteExpiration) {
      if (!isIndefiniteExpirationValue(product.expirationDate)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'A validade deve ser indefinido para este produto ou quando a quantidade e 0.',
          path: ['products', index, 'expirationDate'],
        });
      }

      return;
    }

    if (isIndefiniteExpirationValue(product.expirationDate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Informe uma data de validade valida para este produto.',
        path: ['products', index, 'expirationDate'],
      });
      return;
    }

    if (!isExpirationWithinVisitWindow(visit.visitDate as string, product.expirationDate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A validade deve ser uma data valida e nao pode passar de 18 meses apos a visita.',
        path: ['products', index, 'expirationDate'],
      });
    }
  });
});

const visitDraftSchema = visitSchema;

const clientSearchSchema = z.object({
  clientId: z.string().trim().optional().default(''),
  clientName: z.string().trim().optional().default(''),
  fantasyName: z.string().trim().optional().default(''),
  document: z.string().trim().optional().default(''),
  city: z.string().trim().optional().default(''),
  address: z.string().trim().optional().default(''),
  addressNumber: z.string().trim().optional().default(''),
  neighborhood: z.string().trim().optional().default(''),
  state: z.string().trim().optional().default(''),
});

const agendaEntrySchema = z.object({
  clientId: z.union([z.string().min(1), z.number().int().nonnegative()]).optional(),
  nickname: z.string().trim().min(1, 'Informe o apelido da loja.'),
  daysBetweenVisits: z.preprocess(
    (value) => (value === '' || value === null ? 7 : value),
    z.coerce.number().int().positive().default(7)
  ),
});

const attendedStorePatchSchema = z.object({
  nickname: z.string().trim().min(1, 'O apelido da loja e obrigatorio.').optional(),
  clientId: z.union([z.string().min(1), z.number().int().nonnegative()]).nullable().optional(),
  promotorId: z.union([z.string().min(1), z.number().int().nonnegative()]).nullable().optional(),
  daysBetweenVisits: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() ? Number(value) : value),
    z.number().int().positive('A frequencia deve ser um inteiro positivo.').optional()
  ),
  notes: z.string().trim().nullable().optional(),
});

const weeklyVehicleCheckSchema = z.object({
  mileage: z.coerce.number().int().min(0),
});

const commercialSubmissionSchema = z.object({
  clientName: z.string().trim().min(1, 'Informe o cliente.'),
  fantasyName: z.string().trim().min(1, 'Informe a fantasia.'),
  cnpj: z
    .string()
    .trim()
    .refine((value) => !value || normalizeDigits(value).length === 14, 'Informe um CNPJ valido.'),
  email: z
    .string()
    .trim()
    .refine((value) => !value || z.email().safeParse(value).success, 'Informe um email valido.'),
  phone: z.string().trim().min(1, 'Informe o telefone.'),
  address: z.string().trim().min(1, 'Informe o endereco.'),
  value: z.coerce.number({ message: 'Informe o valor.' }).min(0, 'Informe um valor valido.'),
  salesQuantity: z.coerce
    .number({ message: 'Informe a quantidade de vendas.' })
    .int('Informe um numero inteiro.')
    .min(0, 'Informe uma quantidade valida.'),
  sold: z.boolean(),
  visitDates: z
    .array(z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, 'Informe uma data de visita valida.'))
    .min(1, 'Informe pelo menos uma data de visita.'),
});

const commercialSubmissionUpdateSchema = commercialSubmissionSchema.extend({
  submissionId: z.coerce.number().int().positive(),
});

function normalizeDigits(value: string) {
  return value.replace(/\D/g, '');
}

function normalizeTextSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function matchesAttendedStoreFilter(value: string | null | undefined, query: string) {
  return normalizeTextSearch(value ?? '').includes(normalizeTextSearch(query.trim()));
}

function matchesAnyAttendedStoreFilter(values: Array<string | null | undefined>, query: string) {
  return !query.trim() || values.some((value) => matchesAttendedStoreFilter(value, query));
}

function filterAttendedStoresForVisit(
  stores: AttendedStore[],
  filters: z.infer<typeof clientSearchSchema>
) {
  const normalizedDocument = normalizeDigits(filters.document);

  return stores
    .filter((store) =>
      [
        matchesAnyAttendedStoreFilter(
          store.clientId === null ? [] : [String(store.clientId)],
          filters.clientId
        ),
        matchesAnyAttendedStoreFilter(
          [store.nickname, store.clientName, store.fantasyName],
          filters.clientName
        ),
        matchesAnyAttendedStoreFilter(
          [store.clientName, store.fantasyName, store.nickname],
          filters.fantasyName
        ),
        matchesAttendedStoreFilter(normalizeDigits(store.document), normalizedDocument),
        matchesAttendedStoreFilter(store.city, filters.city),
        matchesAttendedStoreFilter(store.address, filters.address),
        matchesAttendedStoreFilter(store.addressNumber, filters.addressNumber),
        matchesAttendedStoreFilter(store.neighborhood, filters.neighborhood),
        matchesAttendedStoreFilter(store.state, filters.state),
      ].every(Boolean)
    )
    .slice(0, 30)
    .flatMap((store) =>
      store.clientId === null
        ? []
        : [
            {
              id: store.clientId,
              nickname: store.nickname,
              client_name: store.clientName,
              fantasy_name: store.fantasyName,
              document: store.document,
              city: store.city,
              address: store.address,
              address_number: store.addressNumber,
              neighborhood: store.neighborhood,
              state: store.state,
            },
          ]
    );
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
    const parsed = JSON.parse(json) as Record<string, unknown>;

    return parsed;
  } catch {
    return null;
  }
}

async function getCurrentPromotorId() {
  const session = await getSession();

  if (!session) {
    return null;
  }

  if (typeof session.user.id === 'number') {
    return session.user.id;
  }

  const jwtPayload = decodeJwtPayload(session.accessToken);
  const tokenSubject = Number(jwtPayload?.sub);

  if (Number.isFinite(tokenSubject) && tokenSubject > 0) {
    return tokenSubject;
  }

  const client = await pool.connect();

  try {
    const result = await client.query('SELECT id FROM promotors WHERE email = $1', [session.user.email]);
    return result.rows[0]?.id ?? null;
  } finally {
    client.release();
  }
}

function normalizeDraftProducts(products: z.infer<typeof visitDraftSchema>['products']) {
  return products.filter((product) => {
    return (
      product.name.trim() &&
      Number.isFinite(Number(product.quantity)) &&
      Number(product.quantity) >= 0 &&
      (/^\d{4}-\d{2}-\d{2}$/.test(product.expirationDate) ||
        isIndefiniteExpirationValue(product.expirationDate))
    );
  });
}

export async function login(data: z.infer<typeof loginSchema>) {
  const validation = loginSchema.safeParse(data);

  if (!validation.success) {
    return { success: false, error: 'Dados invalidos.' };
  }

  try {
    const authResult = await signInPromotor(validation.data);
    const me = await getPromotorMe(authResult.accessToken).catch(() => null);
    const user = {
      ...authResult.user,
      ...me,
      role: resolveRoleFromServer(me),
      email: me?.email || authResult.user.email || validation.data.email,
      fullName: me?.fullName ?? authResult.user.fullName,
      id: me?.id ?? authResult.user.id,
    };

    await clearSession();
    await createSession({
      accessToken: authResult.accessToken,
      user,
    });

    return { success: true, homePath: getAppEntryPath(user.role) };
  } catch (error) {
    console.error('Login API error:', error);
    if (error instanceof ApiError) {
      return { success: false, error: error.message || 'Credenciais invalidas.' };
    }
    return { success: false, error: 'Nao foi possivel entrar com a API externa.' };
  }
}

export async function signUp(data: z.infer<typeof signupSchema>) {
  const validation = signupSchema.safeParse(data);

  if (!validation.success) {
    return { success: false, error: 'Dados invalidos.' };
  }

  try {
    const authResult = await signUpPromotor(validation.data);
    const me = await getPromotorMe(authResult.accessToken).catch(() => null);
    const user = {
      ...authResult.user,
      ...me,
      role: resolveRoleFromServer(me),
      email: me?.email || authResult.user.email || validation.data.email,
      fullName: me?.fullName ?? authResult.user.fullName ?? validation.data.fullName,
      id: me?.id ?? authResult.user.id,
    };

    await clearSession();
    await createSession({
      accessToken: authResult.accessToken,
      user,
    });

    return { success: true, homePath: getAppEntryPath(user.role) };
  } catch (error) {
    console.error('Signup API error:', error);
    if (error instanceof ApiError) {
      return { success: false, error: error.message || 'Nao foi possivel criar a conta.' };
    }
    return { success: false, error: 'Nao foi possivel criar a conta.' };
  }
}

export async function logout() {
  await clearSession();
}

export async function getSessionHomePath() {
  const session = await getSession();

  return getHomePath(session?.user.role);
}

export async function searchClients(
  // z.input: os filtros têm default no schema, então quem chama pode omitir os vazios.
  filters: z.input<typeof clientSearchSchema>,
  scope: 'agenda' | 'general' = 'general'
) {
  const validation = clientSearchSchema.safeParse(filters);

  if (!validation.success) {
    return { success: false, error: 'Filtros invalidos.', clients: [] };
  }

  const {
    clientId,
    clientName,
    fantasyName,
    document,
    city,
    address,
    addressNumber,
    neighborhood,
    state,
  } = validation.data;

  const conditions: string[] = [];
  const values: string[] = [];

  const addCondition = (sql: string, value: string) => {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return;
    }

    values.push(`%${trimmedValue}%`);
    conditions.push(sql.replace('$VALUE', `$${values.length}`));
  };

  addCondition('id::text ILIKE $VALUE', clientId);
  addCondition('client_name ILIKE $VALUE', clientName);
  addCondition('fantasy_name ILIKE $VALUE', fantasyName);
  addCondition('city ILIKE $VALUE', city);
  addCondition('address ILIKE $VALUE', address);
  addCondition('address_number ILIKE $VALUE', addressNumber);
  addCondition('neighborhood ILIKE $VALUE', neighborhood);
  addCondition('state ILIKE $VALUE', state);

  const normalizedDocument = normalizeDigits(document);
  if (normalizedDocument) {
    values.push(`%${normalizedDocument}%`);
    conditions.push(
      `regexp_replace(document, '[^0-9]', '', 'g') ILIKE $${values.length}`
    );
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  if (scope === 'agenda') {
    const session = await getSession();
    const promotorId = getPromotorOpaqueIdFromSession(session);

    if (!session || promotorId === null) {
      return { success: false, error: 'Sessao expirada. Faca login novamente.', clients: [] };
    }

    try {
      const stores = await listPromotorAgendaByPromotorId(session.accessToken, promotorId);
      return {
        success: true,
        clients: filterAttendedStoresForVisit(stores, validation.data),
      };
    } catch (error) {
      console.error('Search attended stores by promoter error:', error);
      return {
        success: false,
        error: 'Nao foi possivel buscar as lojas atendidas do promotor. Tente novamente.',
        clients: [],
      };
    }
  }

  try {
    const client = await pool.connect();

    try {
      const result = await client.query(
        `SELECT id, client_name, fantasy_name, document, city, address, address_number, neighborhood, state
         FROM clients
         ${whereClause}
         ORDER BY fantasy_name ASC, client_name ASC
         LIMIT 30`
        ,
        values
      );

      return { success: true, clients: result.rows };
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Search clients error:', error);
    return { success: false, error: 'Nao foi possivel buscar os estabelecimentos.', clients: [] };
  }
}

export async function createAgendaEntry(data: unknown) {
  const session = await getSession();
  if (!session) {
    return { success: false, error: 'Sessao expirada. Faca login novamente.' };
  }
  const promotorId = getPromotorOpaqueIdFromSession(session);
  if (promotorId === null) {
    return {
      success: false,
      error: 'Nao foi possivel identificar seu usuario para atribuir como promotor responsavel.',
    };
  }

  const validation = agendaEntrySchema.safeParse(data);
  if (!validation.success) {
    return {
      success: false,
      error: 'Informe o apelido da loja e uma frequencia inteira positiva.',
    };
  }

  try {
    const payload = {
      nickname: validation.data.nickname,
      daysBetweenVisits: validation.data.daysBetweenVisits,
      ...(validation.data.clientId !== undefined ? { clientId: validation.data.clientId } : {}),
      promotorId,
    };
    await createPromotorAgendaEntry(session.accessToken, payload);
    revalidatePath('/agenda');
    return { success: true };
  } catch (error) {
    console.error('Create agenda entry error:', error);
    if (error instanceof ApiError && error.status === 409) {
      return {
        success: false,
        error: validation.data.clientId !== undefined
          ? 'O cliente escolhido ja esta vinculado a outra loja atendida.'
          : 'Nao foi possivel cadastrar a loja porque existe um conflito com outro registro.',
      };
    }

    if (error instanceof ApiError) {
      if (error.status === 400) {
        return {
          success: false,
          error: 'A API rejeitou os dados. Confira o apelido, os vinculos e a frequencia informados.',
        };
      }

      if (error.status >= 500) {
        return {
          success: false,
          error: 'O servico de lojas atendidas esta indisponivel. Tente novamente mais tarde.',
        };
      }

      return { success: false, error: error.message || 'Nao foi possivel adicionar a loja na agenda.' };
    }

    return { success: false, error: 'Nao foi possivel adicionar a loja atendida.' };
  }
}

export async function updateAgendaEntry(
  attendedStoreId: unknown,
  data: unknown,
  currentStore: AttendedStore
) {
  const session = await getSession();
  if (!session) {
    return { success: false, error: 'Sessao expirada. Faca login novamente.' };
  }

  const idValidation = z.union([z.string().min(1), z.number().int().nonnegative()]).safeParse(attendedStoreId);
  if (!idValidation.success) {
    return { success: false, error: 'Identificador da loja atendida invalido.' };
  }

  const validation = attendedStorePatchSchema.safeParse(data);
  if (!validation.success) {
    const firstIssue = validation.error.issues[0];
    return {
      success: false,
      error: firstIssue?.message ?? 'Confira os dados informados para a loja atendida.',
    };
  }

  if (typeof data !== 'object' || data === null) {
    return { success: false, error: 'Dados invalidos para atualizar a loja atendida.' };
  }

  const input = data;
  const patch: AttendedStorePatch = {};
  const fields: Array<keyof AttendedStorePatch> = [
    'nickname',
    'clientId',
    'promotorId',
    'daysBetweenVisits',
    'notes',
  ];

  for (const field of fields) {
    if (
      Object.prototype.hasOwnProperty.call(input, field) &&
      validation.data[field] !== undefined
    ) {
      Object.assign(patch, { [field]: validation.data[field] });
    }
  }

  if (Object.keys(patch).length === 0) {
    return { success: false, error: 'Nenhuma alteracao foi informada.' };
  }

  try {
    const store = await updatePromotorAgendaEntry(
      session.accessToken,
      idValidation.data,
      patch,
      currentStore
    );
    revalidatePath('/agenda');
    return { success: true, store };
  } catch (error) {
    console.error('Update attended store error:', error);
    if (error instanceof ApiError) {
      if (error.status === 400) {
        return {
          success: false,
          error: 'A API rejeitou as alteracoes. Confira o apelido e a frequencia informados.',
        };
      }

      if (error.status === 404) {
        return {
          success: false,
          error: 'Esta loja atendida nao foi encontrada. Atualize a pagina e tente novamente.',
        };
      }

      if (error.status === 409) {
        return {
          success: false,
          error: 'O cliente escolhido ja esta vinculado a outra loja atendida.',
        };
      }

      if (error.status >= 500) {
        return {
          success: false,
          error: 'O servico de lojas atendidas esta indisponivel. Tente novamente mais tarde.',
        };
      }

      return { success: false, error: error.message || 'Nao foi possivel atualizar a loja atendida.' };
    }

    return { success: false, error: 'Ocorreu um erro inesperado ao atualizar a loja atendida.' };
  }
}

export async function removeAgendaEntry(agendaEntryId: unknown) {
  const session = await getSession();

  if (!session) {
    return { success: false, error: 'Sessao expirada. Faca login novamente.' };
  }

  const validation = z.union([z.string().min(1), z.number().int().nonnegative()]).safeParse(agendaEntryId);
  if (!validation.success) {
    return { success: false, error: 'Loja atendida invalida.' };
  }

  try {
    await deletePromotorAgendaEntry(session.accessToken, validation.data);

    revalidatePath('/agenda');

    return { success: true };
  } catch (error) {
    console.error('Delete agenda entry API error:', error);
    if (error instanceof ApiError) {
      return { success: false, error: error.message || 'Nao foi possivel excluir a loja atendida.' };
    }
    return { success: false, error: 'Nao foi possivel excluir a loja atendida.' };
  }
}

export async function createVisit(data: z.infer<typeof visitSchema>, visitId?: number) {
  const session = await getSession();

  if (!session) {
    return { success: false, error: 'Sessao expirada. Faca login novamente.' };
  }

  const validation = visitSchema.safeParse(data);

  if (!validation.success) {
    return { success: false, error: 'Dados da visita invalidos.' };
  }

  if (!validation.data.establishment) {
    return { success: false, error: 'Selecione um estabelecimento valido antes de enviar a visita.' };
  }

  if (!validation.data.visitDate) {
    return { success: false, error: 'Informe uma data de visita valida.' };
  }

  try {
    const payload = {
      establishment: validation.data.establishment,
      visitDate: validation.data.visitDate,
      products: validation.data.products,
      beforeImages: validation.data.beforeImages ?? [],
      afterImages: validation.data.afterImages ?? [],
      observation: validation.data.observation ?? null,
      isDraft: false,
    };

    const savedVisit = visitId
      ? await updatePromotorVisit(session.accessToken, visitId, payload)
      : await createPromotorVisit(session.accessToken, payload);
    const nextVisitId = savedVisit?.id ?? visitId;

    revalidatePath('/');
    revalidatePath('/agenda');
    revalidatePath('/visitas/nova');
    if (nextVisitId) {
      revalidatePath(`/visitas/${nextVisitId}`);
      revalidatePath(`/visitas/${nextVisitId}/editar`);
    }

    return { success: true, visitId: nextVisitId };
  } catch (error) {
    console.error('Create visit API error:', error);
    if (error instanceof ApiError) {
      if (error.status === 401) {
        await clearSession();

        return {
          success: false,
          error: error.message || 'Sessao expirada. Faca login novamente.',
          shouldRedirectToLogin: true,
        };
      }

      return { success: false, error: error.message || 'Nao foi possivel salvar a visita.' };
    }
    return { success: false, error: 'Nao foi possivel salvar a visita.' };
  }
}

export async function saveVisitDraft(
  data: z.infer<typeof visitDraftSchema>,
  visitId?: number
) {
  const session = await getSession();

  if (!session) {
    return { success: false, error: 'Sessao expirada. Faca login novamente.' };
  }

  const validation = visitDraftSchema.safeParse(data);

  if (!validation.success) {
    return { success: false, error: 'Nao foi possivel salvar o rascunho.' };
  }

  const draftProducts = normalizeDraftProducts(validation.data.products);

  try {
    const payload = {
      establishment: validation.data.establishment ?? null,
      visitDate: validation.data.visitDate ?? null,
      products: draftProducts,
      beforeImages: validation.data.beforeImages ?? [],
      afterImages: validation.data.afterImages ?? [],
      observation: validation.data.observation ?? null,
      isDraft: true,
    };

    const savedVisit = visitId
      ? await updatePromotorVisit(session.accessToken, visitId, payload)
      : await createPromotorVisit(session.accessToken, payload);

    const nextVisitId = savedVisit?.id ?? visitId;

    revalidatePath('/');
    revalidatePath('/visitas/nova');
    if (nextVisitId) {
      revalidatePath(`/visitas/${nextVisitId}`);
      revalidatePath(`/visitas/${nextVisitId}/editar`);
    }

    return { success: true, visitId: nextVisitId };
  } catch (error) {
    console.error('Save visit draft API error:', error);
    if (error instanceof ApiError) {
      if (error.status === 401) {
        await clearSession();

        return {
          success: false,
          error: error.message || 'Sessao expirada. Faca login novamente.',
          shouldRedirectToLogin: true,
        };
      }

      return { success: false, error: error.message || 'Nao foi possivel salvar o rascunho.' };
    }
    return { success: false, error: 'Nao foi possivel salvar o rascunho.' };
  }
}

export async function deleteVisitDraft(visitId: number) {
  const session = await getSession();

  if (!session) {
    return { success: false, error: 'Sessao expirada. Faca login novamente.', shouldRedirectToLogin: true };
  }

  if (!Number.isFinite(visitId) || visitId <= 0) {
    return { success: false, error: 'Visita invalida.' };
  }

  try {
    const deletedVisit = await deleteDraftVisit(session.accessToken, visitId);

    revalidatePath('/');
    revalidatePath('/promotor');
    revalidatePath('/visitas/nova');
    revalidatePath(`/visitas/${visitId}`);
    revalidatePath(`/visitas/${visitId}/editar`);

    return {
      success: true,
      deletedVisitId: deletedVisit?.id ?? visitId,
      message: 'Rascunho excluido com sucesso.',
    };
  } catch (error) {
    console.error('Delete visit draft API error:', error);

    if (error instanceof ApiError) {
      if (error.status === 401) {
        await clearSession();

        return {
          success: false,
          error: error.message || 'Sessao expirada. Faca login novamente.',
          shouldRedirectToLogin: true,
        };
      }

      return {
        success: false,
        error: error.message || 'Nao foi possivel excluir o rascunho.',
      };
    }

    return { success: false, error: 'Nao foi possivel excluir o rascunho.' };
  }
}

export async function createCommercialSubmission(
  data: z.infer<typeof commercialSubmissionSchema>
) {
  const session = await getSession();

  if (!session) {
    return { success: false, error: 'Sessao expirada. Faca login novamente.' };
  }

  const validation = commercialSubmissionSchema.safeParse(data);

  if (!validation.success) {
    const firstIssue = validation.error.issues[0];
    return { success: false, error: firstIssue?.message ?? 'Preencha os campos obrigatorios.' };
  }

  const {
    clientName,
    fantasyName,
    cnpj,
    email,
    phone,
    address,
    value,
    salesQuantity,
    sold,
    visitDates,
  } = validation.data;

  try {
    const createdVisit = await createCommercialVisit(session.accessToken, {
      clientName,
      fantasyName,
      cnpj: cnpj ? normalizeDigits(cnpj) : null,
      email: email || null,
      phone,
      address,
      value,
      salesQuantity,
      sold,
      visitDates: visitDates.map(toApiVisitDate),
    });

    revalidatePath('/comercial');

    return { success: true, submissionId: createdVisit?.id ?? 0 };
  } catch (error) {
    console.error('Create commercial submission API error:', error);
    if (error instanceof ApiError) {
      return {
        success: false,
        error: error.message || 'Nao foi possivel salvar o formulario do comercial.',
      };
    }
    return { success: false, error: 'Nao foi possivel salvar o formulario do comercial.' };
  }
}

export async function updateCommercialSubmission(
  data: z.infer<typeof commercialSubmissionUpdateSchema>
) {
  const session = await getSession();

  if (!session) {
    return { success: false, error: 'Sessao expirada. Faca login novamente.' };
  }

  const validation = commercialSubmissionUpdateSchema.safeParse(data);

  if (!validation.success) {
    const firstIssue = validation.error.issues[0];
    return { success: false, error: firstIssue?.message ?? 'Preencha os campos obrigatorios.' };
  }

  const {
    submissionId,
    clientName,
    fantasyName,
    cnpj,
    email,
    phone,
    address,
    value,
    salesQuantity,
    sold,
    visitDates,
  } = validation.data;

  try {
    await updateCommercialVisit(session.accessToken, submissionId, {
      clientName,
      fantasyName,
      cnpj: cnpj ? normalizeDigits(cnpj) : null,
      email: email || null,
      phone,
      address,
      value,
      salesQuantity,
      sold,
      visitDates: visitDates.map(toApiVisitDate),
    });

    revalidatePath('/comercial');
    revalidatePath(`/comercial/${submissionId}`);
    revalidatePath(`/comercial/${submissionId}/editar`);

    return { success: true, submissionId };
  } catch (error) {
    console.error('Update commercial submission API error:', error);
    if (error instanceof ApiError) {
      return {
        success: false,
        error: error.message || 'Nao foi possivel atualizar o cliente do comercial.',
      };
    }
    return { success: false, error: 'Nao foi possivel atualizar o cliente do comercial.' };
  }
}

export async function saveWeeklyVehicleCheck(
  formData: FormData,
  options?: { allowWithoutPhoto?: boolean }
) {
  const session = await getSession();

  if (!session) {
    return { success: false, error: 'Sessao expirada. Faca login novamente.' };
  }

  const validation = weeklyVehicleCheckSchema.safeParse({
    mileage: formData.get('mileage'),
  });

  if (!validation.success) {
    return { success: false, error: 'Informe uma quilometragem valida.' };
  }

  const image = formData.get('image');
  const allowWithoutPhoto = Boolean(options?.allowWithoutPhoto);

  if (!allowWithoutPhoto && (!(image instanceof File) || image.size === 0)) {
    return { success: false, error: 'Tire uma foto antes de confirmar.' };
  }

  if (image instanceof File && image.size > 0 && !image.type.startsWith('image/')) {
    return { success: false, error: 'Envie um arquivo de imagem valido.' };
  }

  const maxImageSizeInBytes = 8 * 1024 * 1024;

  if (image instanceof File && image.size > maxImageSizeInBytes) {
    return { success: false, error: 'A imagem deve ter no maximo 8 MB.' };
  }

  const { dateKey } = getWeeklyVehicleCheckDateContext();
  const promotorId = await getCurrentPromotorId();

  if (!promotorId) {
    return { success: false, error: 'Promotor nao identificado para registrar a quilometragem.' };
  }

  try {
    const imageBase64 =
      image instanceof File && image.size > 0
        ? Buffer.from(await image.arrayBuffer()).toString('base64')
        : 'b2zDoSA=';
    const imageMimeType =
      image instanceof File && image.size > 0
        ? image.type || 'image/jpeg'
        : '';

    await createPromotorMileage(session.accessToken, {
      promotorId,
      mileage: validation.data.mileage,
      checkDate: dateKey,
      imageBase64,
      imageMimeType,
    });

    revalidatePath('/');
    revalidatePath('/agenda');

    return { success: true };
  } catch (error) {
    console.error('Save weekly vehicle check API error:', error);
    if (error instanceof ApiError) {
      return { success: false, error: error.message || 'Nao foi possivel salvar a quilometragem.' };
    }
    return { success: false, error: 'Nao foi possivel salvar a quilometragem.' };
  }
}

export async function skipWeeklyVehicleCheck() {
  const session = await getSession();

  if (!session) {
    return { success: false, error: 'Sessao expirada. Faca login novamente.' };
  }

  const { dateKey } = getWeeklyVehicleCheckDateContext();
  const promotorId = await getCurrentPromotorId();

  if (!promotorId) {
    return { success: false, error: 'Promotor nao identificado para registrar a quilometragem.' };
  }

  try {
    await createPromotorMileage(session.accessToken, {
      promotorId,
      mileage: 0,
      checkDate: dateKey,
      imageBase64: 'b2zDoSA=',
      imageMimeType: '',
    });

    revalidatePath('/');
    revalidatePath('/agenda');

    return { success: true };
  } catch (error) {
    console.error('Skip weekly vehicle check API error:', error);
    if (error instanceof ApiError) {
      return {
        success: false,
        error: error.message || 'Nao foi possivel registrar o pulo da quilometragem.',
      };
    }
    return { success: false, error: 'Nao foi possivel registrar o pulo da quilometragem.' };
  }
}

/**
 * Fluxo de Recuperação de Senha
 */

export async function requestPasswordRecovery(email: string) {
  const validation = recoveryRequestSchema.safeParse({ email });
  if (!validation.success) return { success: false, error: 'E-mail invalido.' };

  try {
    await requestApiPasswordRecovery(validation.data.email);
    return { success: true };
  } catch (error) {
    console.error(error);
    return { success: false, error: error instanceof ApiError ? error.message : 'Erro ao solicitar codigo de recuperacao.' };
  }
}

export async function verifyRecoveryCode(email: string, code: string) {
  const validation = recoveryVerifySchema.safeParse({ email, code });
  if (!validation.success) return { success: false, error: 'Dados invalidos.' };

  try {
    const result = await verifyApiRecoveryCode(validation.data.email, validation.data.code);
    return { success: result.valid, error: result.valid ? null : 'Codigo invalido ou expirado.' };
  } catch (error) {
    return { success: false, error: error instanceof ApiError ? error.message : 'Erro ao verificar codigo.' };
  }
}

export async function resetPassword(data: z.infer<typeof recoveryResetSchema>) {
  const validation = recoveryResetSchema.safeParse(data);
  if (!validation.success) return { success: false, error: validation.error.issues[0].message };

  try {
    await resetApiPassword(validation.data);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof ApiError ? error.message : 'Erro ao redefinir a senha.' };
  }
}
