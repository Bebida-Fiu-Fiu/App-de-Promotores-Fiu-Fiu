'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { pool } from '@/lib/db';
import { clearSession, createSession, getAppEntryPath, getHomePath, getSession } from '@/lib/auth';
import { getWeeklyVehicleCheckDateContext } from '@/lib/weekly-vehicle-check';
import { ApiError } from '@/lib/api/client';
import {
  createPromotorMileage,
  deleteDraftVisit,
  deletePromotorAgendaEntry,
  createPromotorVisit,
  getPromotorMe,
  signInPromotor,
  signUpPromotor,
  updatePromotorVisit,
} from '@/lib/api/promotor';
import { createCommercialVisit, updateCommercialVisit } from '@/lib/api/comercial';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const signupSchema = loginSchema.extend({
  fullName: z.string().min(3),
  confirmPassword: z.string().min(6),
  role: z.enum(['promotor', 'comercial']),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
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
  establishment: z.number().int().positive().nullable().optional(),
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
  clientId: z.coerce.number().int().positive(),
  nickname: z.string().trim().optional().default(''),
  notes: z.string().trim().optional().default(''),
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
    const me = await getPromotorMe(authResult.accessToken).catch(() => authResult.user);
    const user = {
      ...authResult.user,
      ...me,
      role: me.role === 'comercial' ? 'comercial' : authResult.user.role,
      email: me.email || authResult.user.email || validation.data.email,
      fullName: me.fullName ?? authResult.user.fullName,
      id: me.id ?? authResult.user.id,
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
    const me = await getPromotorMe(authResult.accessToken).catch(() => authResult.user);
    const user = {
      ...authResult.user,
      ...me,
      role: validation.data.role,
      email: me.email || authResult.user.email || validation.data.email,
      fullName: me.fullName ?? authResult.user.fullName ?? validation.data.fullName,
      id: me.id ?? authResult.user.id,
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
  filters: z.infer<typeof clientSearchSchema>,
  scope: 'agenda' | 'general' = 'general'
) {
  const validation = clientSearchSchema.safeParse(filters);

  if (!validation.success) {
    return { success: false, error: 'Filtros invalidos.', clients: [] };
  }

  const {
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
    const promotorId = await getCurrentPromotorId();

    if (!promotorId) {
      return { success: false, error: 'Sessao expirada. Faca login novamente.', clients: [] };
    }

    const agendaConditions: string[] = [];
    const agendaValues: Array<string | number> = [promotorId];
    const textNormalizationSql = "translate(lower($VALUE), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')";

    const addAgendaCondition = (sql: string, value: string) => {
      const trimmedValue = value.trim();

      if (!trimmedValue) {
        return;
      }

      agendaValues.push(`%${normalizeTextSearch(trimmedValue)}%`);
      agendaConditions.push(sql.replaceAll('$VALUE', `$${agendaValues.length}`));
    };

    addAgendaCondition(
      `(
        translate(lower(c.client_name), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') ILIKE ${textNormalizationSql}
        OR translate(lower(c.fantasy_name), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') ILIKE ${textNormalizationSql}
        OR translate(lower(coalesce(a.nickname, '')), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') ILIKE ${textNormalizationSql}
      )`,
      clientName
    );
    addAgendaCondition(
      `(
        translate(lower(c.fantasy_name), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') ILIKE ${textNormalizationSql}
        OR translate(lower(coalesce(a.nickname, '')), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') ILIKE ${textNormalizationSql}
      )`,
      fantasyName
    );
    addAgendaCondition(
      `translate(lower(c.city), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') ILIKE ${textNormalizationSql}`,
      city
    );
    addAgendaCondition(
      `translate(lower(c.address), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') ILIKE ${textNormalizationSql}`,
      address
    );
    addAgendaCondition('c.address_number ILIKE $VALUE', addressNumber);
    addAgendaCondition(
      `translate(lower(c.neighborhood), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') ILIKE ${textNormalizationSql}`,
      neighborhood
    );
    addAgendaCondition(
      `translate(lower(c.state), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') ILIKE ${textNormalizationSql}`,
      state
    );

    if (normalizedDocument) {
      agendaValues.push(`%${normalizedDocument}%`);
      agendaConditions.push(
        `regexp_replace(c.document, '[^0-9]', '', 'g') ILIKE $${agendaValues.length}`
      );
    }

    try {
      const client = await pool.connect();

      try {
        const result = await client.query(
          `SELECT DISTINCT
             c.id,
             a.nickname,
             c.client_name,
             c.fantasy_name,
             c.document,
             c.city,
             c.address,
             c.address_number,
             c.neighborhood,
             c.state
           FROM promotor_client_agenda a
           INNER JOIN clients c ON c.id = a.client_id
           WHERE a.promotor_id = $1
           ${agendaConditions.length > 0 ? `AND ${agendaConditions.join(' AND ')}` : ''}
           ORDER BY c.fantasy_name ASC, c.client_name ASC
           LIMIT 30`,
          agendaValues
        );

        return { success: true, clients: result.rows };
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Search agenda clients error:', error);
      return { success: false, error: 'Nao foi possivel buscar os clientes da agenda.', clients: [] };
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

export async function createAgendaEntry(data: z.infer<typeof agendaEntrySchema>) {
  const promotorId = await getCurrentPromotorId();

  if (!promotorId) {
    return { success: false, error: 'Sessao expirada. Faca login novamente.' };
  }

  const validation = agendaEntrySchema.safeParse(data);

  if (!validation.success) {
    const fieldLabels: Record<string, string> = {
      clientId: 'Buscar cliente na base',
    };

    const firstIssue = validation.error.issues[0];
    const fieldName = firstIssue?.path[0];
    const label =
      typeof fieldName === 'string' ? fieldLabels[fieldName] : null;

    return {
      success: false,
      error: label
        ? `Preencha o campo obrigatório "${label}".`
        : 'Preencha os dados obrigatórios da agenda.',
    };
  }

  const { clientId, nickname, notes } = validation.data;

  try {
    const client = await pool.connect();

    try {
      const existingClient = await client.query('SELECT 1 FROM clients WHERE id = $1', [clientId]);

      if (!existingClient.rowCount) {
        return { success: false, error: 'Cliente nao encontrado na base.' };
      }

      const existingAgendaEntry = await client.query(
        'SELECT 1 FROM promotor_client_agenda WHERE promotor_id = $1 AND client_id = $2 LIMIT 1',
        [promotorId, clientId]
      );

      if (existingAgendaEntry.rowCount) {
        return { success: false, error: 'Esse cliente ja esta na agenda.' };
      }

      await client.query(
        `INSERT INTO promotor_client_agenda (
           promotor_id,
           client_id,
           nickname,
           notes
         ) VALUES ($1, $2, $3, $4)`,
        [
          promotorId,
          clientId,
          nickname || null,
          notes || null,
        ]
      );
    } finally {
      client.release();
    }

    revalidatePath('/agenda');

    return { success: true };
  } catch (error) {
    console.error('Create agenda entry error:', error);
    return { success: false, error: 'Nao foi possivel adicionar o cliente na agenda.' };
  }
}

export async function removeAgendaEntry(agendaEntryId: number) {
  const session = await getSession();

  if (!session) {
    return { success: false, error: 'Sessao expirada. Faca login novamente.' };
  }

  if (!Number.isFinite(agendaEntryId) || agendaEntryId <= 0) {
    return { success: false, error: 'Cliente da agenda invalido.' };
  }

  try {
    await deletePromotorAgendaEntry(session.accessToken, agendaEntryId);

    revalidatePath('/agenda');

    return { success: true };
  } catch (error) {
    console.error('Delete agenda entry API error:', error);
    if (error instanceof ApiError) {
      return { success: false, error: error.message || 'Nao foi possivel excluir o cliente da agenda.' };
    }
    return { success: false, error: 'Nao foi possivel excluir o cliente da agenda.' };
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
      visitDates,
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
      visitDates,
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
