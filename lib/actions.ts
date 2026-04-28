'use server';

import { revalidatePath } from 'next/cache';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { pool } from '@/lib/db';
import { clearSession, createSession, getHomePath, getSession } from '@/lib/auth';
import { getWeeklyVehicleCheckDateContext } from '@/lib/weekly-vehicle-check';

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

const productsWithIndefiniteExpiration = new Set([
  'Cajazinha',
  'Abacaxi Cortelâ',
  'Tangerina c/ Acerola',
  'Pomar',
]);

function productHasIndefiniteExpiration(name: string) {
  return productsWithIndefiniteExpiration.has(name.trim());
}

const visitProductSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().min(0),
  packageType: z.enum(['unidade', 'pack', 'caixa']),
  expirationDate: z.string(),
}).superRefine((product, ctx) => {
  if (productHasIndefiniteExpiration(product.name) || product.quantity <= 0) {
    return;
  }

  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(product.expirationDate)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Data de validade invalida.',
      path: ['expirationDate'],
    });
  }
});

const visitSchema = z.object({
  establishment: z.string().min(1),
  date: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/),
  products: z.array(visitProductSchema).min(1),
  beforeImage: z.string().trim().optional().default(''),
  afterImage: z.string().trim().optional().default(''),
});

const visitDraftSchema = z.object({
  establishment: z.string().trim().optional().default(''),
  date: z.string().trim().optional().default(''),
  products: z.array(
    z.object({
      name: z.string().trim().optional().default(''),
      quantity: z.number().optional().default(0),
      packageType: z.enum(['unidade', 'pack', 'caixa']).optional().default('unidade'),
      expirationDate: z.string().trim().optional().default(''),
    })
  ).optional().default([]),
  beforeImage: z.string().trim().optional().default(''),
  afterImage: z.string().trim().optional().default(''),
});

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

function parseDisplayDateToDatabase(value: string) {
  const [day, month, year] = value.split('/');

  if (!day || !month || !year) {
    return null;
  }

  return `${year}-${month}-${day}`;
}

function normalizeDigits(value: string) {
  return value.replace(/\D/g, '');
}

function normalizeTextSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function looksLikePasswordHash(password: string) {
  return password.startsWith('$2a$') || password.startsWith('$2b$') || password.startsWith('$2y$');
}

async function getCurrentPromotorId() {
  const session = await getSession();

  if (!session) {
    return null;
  }

  const client = await pool.connect();

  try {
    const result = await client.query('SELECT id FROM promotors WHERE email = $1', [session.email]);
    return result.rows[0]?.id ?? null;
  } finally {
    client.release();
  }
}

function normalizeDraftProducts(products: z.infer<typeof visitDraftSchema>['products']) {
  return products
    .filter((product) => {
      return (
        product.name.trim() ||
        Number(product.quantity) > 0 ||
        product.expirationDate.trim()
      );
    })
    .map((product) => ({
      name: product.name.trim(),
      quantity: Number(product.quantity) || 0,
      unit: product.packageType,
      expirationDate: product.expirationDate.trim(),
    }));
}

function isVisitEditable(createdAt: string | Date, isDraft: boolean) {
  if (isDraft) {
    return true;
  }

  const createdAtDate = createdAt instanceof Date ? createdAt : new Date(createdAt);
  const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;

  return Date.now() - createdAtDate.getTime() <= sevenDaysInMs;
}

function isMissingVisitImageColumnError(error: unknown) {
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return false;
  }

  const databaseError = error as { code?: string; message?: string };

  return (
    databaseError.code === '42703' &&
    typeof databaseError.message === 'string' &&
    (databaseError.message.includes('before_image') || databaseError.message.includes('after_image'))
  );
}

export async function login(data: z.infer<typeof loginSchema>) {
  const validation = loginSchema.safeParse(data);

  if (!validation.success) {
    return { success: false, error: 'Invalid data' };
  }

  const { email, password } = validation.data;

  try {
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT * FROM promotors WHERE email = $1', [email]);
      const user = result.rows[0];

      if (!user) {
        return { success: false, error: 'Invalid credentials' };
      }

      let passwordMatches = false;

      if (looksLikePasswordHash(user.password)) {
        passwordMatches = await bcrypt.compare(password, user.password);
      } else {
        passwordMatches = user.password === password;

        if (passwordMatches) {
          const hashedPassword = await bcrypt.hash(password, 12);

          await client.query('UPDATE promotors SET password = $1 WHERE id = $2', [
            hashedPassword,
            user.id,
          ]);
        }
      }

      if (!passwordMatches) {
        return { success: false, error: 'Invalid credentials' };
      }

      const role = user.role === 'comercial' ? 'comercial' : 'promotor';

      await createSession(email, role);

      return { success: true, homePath: getHomePath(role) };
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: 'Database connection failed' };
  }
}

export async function signUp(data: z.infer<typeof signupSchema>) {
  const validation = signupSchema.safeParse(data);

  if (!validation.success) {
    return { success: false, error: 'Invalid data' };
  }

  const { email, fullName, password, role } = validation.data;

  try {
    const client = await pool.connect();

    try {
      const existingUser = await client.query('SELECT 1 FROM promotors WHERE email = $1', [email]);

      if (existingUser.rowCount) {
        return { success: false, error: 'Email already registered' };
      }

      const hashedPassword = await bcrypt.hash(password, 12);

      await client.query(
        'INSERT INTO promotors (full_name, email, password, role) VALUES ($1, $2, $3, $4)',
        [fullName, email, hashedPassword, role]
      );
    } finally {
      client.release();
    }

    await createSession(email, role);

    return { success: true, homePath: getHomePath(role) };
  } catch (error) {
    console.error('Signup error:', error);
    return { success: false, error: 'Could not create account' };
  }
}

export async function logout() {
  await clearSession();
}

export async function getSessionHomePath() {
  const session = await getSession();

  return getHomePath(session?.role);
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

export async function createVisit(data: z.infer<typeof visitSchema>, visitId?: number) {
  const promotorId = await getCurrentPromotorId();

  if (!promotorId) {
    return { success: false, error: 'Sessao expirada. Faca login novamente.' };
  }

  const validation = visitSchema.safeParse(data);

  if (!validation.success) {
    return { success: false, error: 'Dados da visita invalidos.' };
  }

  const visitDate = parseDisplayDateToDatabase(validation.data.date);

  if (!visitDate) {
    return { success: false, error: 'Data da visita invalida.' };
  }

  const products = validation.data.products.map((product) => {
    const expirationDate = productHasIndefiniteExpiration(product.name)
      ? 'indeterminado'
      : product.quantity <= 0
        ? ''
        : parseDisplayDateToDatabase(product.expirationDate);

    return {
      name: product.name,
      quantity: product.quantity,
      unit: product.packageType,
      expirationDate: expirationDate ?? product.expirationDate,
    };
  });

  try {
    const client = await pool.connect();

    try {
      if (visitId) {
        const existingVisit = await client.query(
          'SELECT id, created_at, is_draft FROM visits WHERE id = $1 AND promotor_id = $2',
          [visitId, promotorId]
        );

        if (!existingVisit.rowCount) {
          return { success: false, error: 'Visita nao encontrada.' };
        }

        const visit = existingVisit.rows[0];

        if (!isVisitEditable(visit.created_at, Boolean(visit.is_draft))) {
          return { success: false, error: 'O prazo de 7 dias para editar esta visita já expirou.' };
        }

        await client.query(
          `UPDATE visits
           SET establishment = $1,
               visit_date = $2,
               products = $3::jsonb,
               before_image = $4,
               after_image = $5,
               is_draft = FALSE,
               updated_at = NOW()
           WHERE id = $6 AND promotor_id = $7`,
          [
            validation.data.establishment,
            visitDate,
            JSON.stringify(products),
            validation.data.beforeImage || null,
            validation.data.afterImage || null,
            visitId,
            promotorId,
          ]
        );
      } else {
        await client.query(
          `INSERT INTO visits (
             promotor_id,
             establishment,
             visit_date,
             products,
             before_image,
             after_image,
             is_draft
           )
           VALUES ($1, $2, $3, $4::jsonb, $5, $6, FALSE)`,
          [
            promotorId,
            validation.data.establishment,
            visitDate,
            JSON.stringify(products),
            validation.data.beforeImage || null,
            validation.data.afterImage || null,
          ]
        );
      }
    } finally {
      client.release();
    }

    revalidatePath('/');
    revalidatePath('/visitas/nova');
    if (visitId) {
      revalidatePath(`/visitas/${visitId}`);
      revalidatePath(`/visitas/${visitId}/editar`);
    }

    return { success: true };
  } catch (error) {
    console.error('Create visit error:', error);
    if (isMissingVisitImageColumnError(error)) {
      return {
        success: false,
        error: 'O banco ainda nao foi atualizado para salvar as imagens. Execute a migration add_visit_images_to_visits.sql.',
      };
    }
    return { success: false, error: 'Nao foi possivel salvar a visita.' };
  }
}

export async function saveVisitDraft(
  data: z.infer<typeof visitDraftSchema>,
  visitId?: number
) {
  const promotorId = await getCurrentPromotorId();

  if (!promotorId) {
    return { success: false, error: 'Sessao expirada. Faca login novamente.' };
  }

  const validation = visitDraftSchema.safeParse(data);

  if (!validation.success) {
    return { success: false, error: 'Nao foi possivel salvar o rascunho.' };
  }

  const establishment = validation.data.establishment.trim() || null;
  const visitDate = /^\d{2}\/\d{2}\/\d{4}$/.test(validation.data.date)
    ? parseDisplayDateToDatabase(validation.data.date)
    : null;
  const draftProducts = normalizeDraftProducts(validation.data.products);

  try {
    const client = await pool.connect();

    try {
      if (visitId) {
        const existingVisit = await client.query(
          'SELECT id FROM visits WHERE id = $1 AND promotor_id = $2',
          [visitId, promotorId]
        );

        if (!existingVisit.rowCount) {
          return { success: false, error: 'Visita nao encontrada.' };
        }

        await client.query(
          `UPDATE visits
           SET establishment = $1,
               visit_date = $2,
               products = $3::jsonb,
               before_image = $4,
               after_image = $5,
               is_draft = TRUE,
               updated_at = NOW()
           WHERE id = $6 AND promotor_id = $7`,
          [
            establishment,
            visitDate,
            JSON.stringify(draftProducts),
            validation.data.beforeImage || null,
            validation.data.afterImage || null,
            visitId,
            promotorId,
          ]
        );

        revalidatePath('/');
        revalidatePath(`/visitas/${visitId}`);
        revalidatePath(`/visitas/${visitId}/editar`);

        return { success: true, visitId };
      }

      const result = await client.query(
        `INSERT INTO visits (
           promotor_id,
           establishment,
           visit_date,
           products,
           before_image,
           after_image,
           is_draft
         )
         VALUES ($1, $2, $3, $4::jsonb, $5, $6, TRUE)
         RETURNING id`,
        [
          promotorId,
          establishment,
          visitDate,
          JSON.stringify(draftProducts),
          validation.data.beforeImage || null,
          validation.data.afterImage || null,
        ]
      );

      const createdVisitId = Number(result.rows[0]?.id);

      revalidatePath('/');
      revalidatePath('/visitas/nova');
      revalidatePath(`/visitas/${createdVisitId}`);
      revalidatePath(`/visitas/${createdVisitId}/editar`);

      return { success: true, visitId: createdVisitId };
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Save visit draft error:', error);
    if (isMissingVisitImageColumnError(error)) {
      return {
        success: false,
        error: 'O banco ainda nao foi atualizado para salvar as imagens. Execute a migration add_visit_images_to_visits.sql.',
      };
    }
    return { success: false, error: 'Nao foi possivel salvar o rascunho.' };
  }
}

export async function deleteVisitDraft(visitId: number) {
  const promotorId = await getCurrentPromotorId();

  if (!promotorId) {
    return { success: false, error: 'Sessao expirada. Faca login novamente.' };
  }

  try {
    const client = await pool.connect();

    try {
      const existingVisit = await client.query(
        'SELECT id, is_draft FROM visits WHERE id = $1 AND promotor_id = $2',
        [visitId, promotorId]
      );

      if (!existingVisit.rowCount) {
        return { success: false, error: 'Rascunho nao encontrado.' };
      }

      if (!existingVisit.rows[0].is_draft) {
        return { success: false, error: 'Apenas rascunhos podem ser excluidos.' };
      }

      await client.query('DELETE FROM visits WHERE id = $1 AND promotor_id = $2', [visitId, promotorId]);
    } finally {
      client.release();
    }

    revalidatePath('/');
    revalidatePath('/visitas/nova');
    revalidatePath(`/visitas/${visitId}`);
    revalidatePath(`/visitas/${visitId}/editar`);

    return { success: true };
  } catch (error) {
    console.error('Delete visit draft error:', error);
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
    const client = await pool.connect();

    try {
      const result = await client.query(
        `INSERT INTO commercial_submissions (
           client_name,
           fantasy_name,
           cnpj,
           email,
           phone,
           address,
           total_value,
           sales_quantity,
           sold,
           visit_dates,
           submitted_by_email
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11)
         RETURNING id`,
        [
          clientName,
          fantasyName,
          cnpj ? normalizeDigits(cnpj) : null,
          email || null,
          phone,
          address,
          value,
          salesQuantity,
          sold,
          JSON.stringify(visitDates),
          session.email,
        ]
      );

      const submissionId = Number(result.rows[0]?.id ?? 0);

      revalidatePath('/comercial');

      return { success: true, submissionId };
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Create commercial submission error:', error);
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
    const client = await pool.connect();

    try {
      const existingSubmission = await client.query(
        'SELECT id FROM commercial_submissions WHERE id = $1',
        [submissionId]
      );

      if (!existingSubmission.rowCount) {
        return { success: false, error: 'Cliente do comercial nao encontrado.' };
      }

      await client.query(
        `UPDATE commercial_submissions
         SET client_name = $1,
             fantasy_name = $2,
             cnpj = $3,
             email = $4,
             phone = $5,
             address = $6,
             total_value = $7,
             sales_quantity = $8,
             sold = $9,
             visit_dates = $10::jsonb
         WHERE id = $11`,
        [
          clientName,
          fantasyName,
          cnpj ? normalizeDigits(cnpj) : null,
          email || null,
          phone,
          address,
          value,
          salesQuantity,
          sold,
          JSON.stringify(visitDates),
          submissionId,
        ]
      );
    } finally {
      client.release();
    }

    revalidatePath('/comercial');
    revalidatePath(`/comercial/${submissionId}`);
    revalidatePath(`/comercial/${submissionId}/editar`);

    return { success: true, submissionId };
  } catch (error) {
    console.error('Update commercial submission error:', error);
    return { success: false, error: 'Nao foi possivel atualizar o cliente do comercial.' };
  }
}

export async function saveWeeklyVehicleCheck(
  formData: FormData,
  options?: { allowWithoutPhoto?: boolean }
) {
  const promotorId = await getCurrentPromotorId();

  if (!promotorId) {
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

  try {
    const placeholderBase64 =
      '/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxAQEBUQEBAVFRUVFRUVFRUVFRUVFRUVFRUWFhUVFRUYHSggGBolGxUVITEhJSkrLi4uFx8zODMsNygtLisBCgoKDg0OGhAQGi0fHyUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAAEAAQMBIgACEQEDEQH/xAAXAAADAQAAAAAAAAAAAAAAAAAAAQID/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEAMQAAAB6A//xAAZEAEBAAMBAAAAAAAAAAAAAAABEQIhMUH/2gAIAQEAAT8ApY0m2uP/xAAVEQEBAAAAAAAAAAAAAAAAAAABEP/aAAgBAgEBPwCf/8QAFBEBAAAAAAAAAAAAAAAAAAAAEP/aAAgBAwEBPwCf/9k=';
    const fallbackImageBuffer = Buffer.from(placeholderBase64, 'base64');
    const hasImage = image instanceof File && image.size > 0;
    const imageBuffer = hasImage
      ? Buffer.from(await image.arrayBuffer())
      : fallbackImageBuffer;
    const imageMimeType = hasImage ? image.type : 'image/jpeg';
    const imageName = hasImage ? image.name || null : 'teste-sem-foto.jpg';
    const client = await pool.connect();

    try {
      await client.query(
        `INSERT INTO vehicle_mileage_checks (
           promotor_id,
           check_date,
           mileage,
           image_data,
           image_mime_type,
           image_name
         ) VALUES ($1, $2::date, $3, $4, $5, $6)
         ON CONFLICT (promotor_id, check_date)
         DO UPDATE SET
           mileage = EXCLUDED.mileage,
           image_data = EXCLUDED.image_data,
           image_mime_type = EXCLUDED.image_mime_type,
           image_name = EXCLUDED.image_name,
           updated_at = NOW()`,
        [
          promotorId,
          dateKey,
          validation.data.mileage,
          imageBuffer,
          imageMimeType,
          imageName,
        ]
      );
    } finally {
      client.release();
    }

    revalidatePath('/');
    revalidatePath('/agenda');

    return { success: true };
  } catch (error) {
    console.error('Save weekly vehicle check error:', error);
    return { success: false, error: 'Nao foi possivel salvar a quilometragem.' };
  }
}

export async function skipWeeklyVehicleCheck() {
  const promotorId = await getCurrentPromotorId();

  if (!promotorId) {
    return { success: false, error: 'Sessao expirada. Faca login novamente.' };
  }

  const { dateKey } = getWeeklyVehicleCheckDateContext();

  try {
    const placeholderBase64 =
      '/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxAQEBUQEBAVFRUVFRUVFRUVFRUVFRUVFRUWFhUVFRUYHSggGBolGxUVITEhJSkrLi4uFx8zODMsNygtLisBCgoKDg0OGhAQGi0fHyUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAAEAAQMBIgACEQEDEQH/xAAXAAADAQAAAAAAAAAAAAAAAAAAAQID/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEAMQAAAB6A//xAAZEAEBAAMBAAAAAAAAAAAAAAABEQIhMUH/2gAIAQEAAT8ApY0m2uP/xAAVEQEBAAAAAAAAAAAAAAAAAAABEP/aAAgBAgEBPwCf/8QAFBEBAAAAAAAAAAAAAAAAAAAAEP/aAAgBAwEBPwCf/9k=';
    const imageBuffer = Buffer.from(placeholderBase64, 'base64');
    const client = await pool.connect();

    try {
      await client.query(
        `INSERT INTO vehicle_mileage_checks (
           promotor_id,
           check_date,
           mileage,
           image_data,
           image_mime_type,
           image_name
         ) VALUES ($1, $2::date, $3, $4, $5, $6)
         ON CONFLICT (promotor_id, check_date)
         DO UPDATE SET
           mileage = EXCLUDED.mileage,
           image_data = EXCLUDED.image_data,
           image_mime_type = EXCLUDED.image_mime_type,
           image_name = EXCLUDED.image_name,
           updated_at = NOW()`,
        [promotorId, dateKey, 0, imageBuffer, 'image/jpeg', 'quilometragem-pulada.jpg']
      );
    } finally {
      client.release();
    }

    revalidatePath('/');
    revalidatePath('/agenda');

    return { success: true };
  } catch (error) {
    console.error('Skip weekly vehicle check error:', error);
    return { success: false, error: 'Nao foi possivel registrar o pulo da quilometragem.' };
  }
}
