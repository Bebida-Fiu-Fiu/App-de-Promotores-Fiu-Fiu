'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { pool } from '@/lib/db';
import { clearSession, createSession, getSession } from '@/lib/auth';

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

const visitProductSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().min(0),
  packageType: z.enum(['unidade', 'pack', 'caixa']),
  expirationDate: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/),
});

const visitSchema = z.object({
  establishment: z.string().min(1),
  date: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/),
  products: z.array(visitProductSchema).min(1),
});

const clientSearchSchema = z.object({
  clientName: z.string().trim().optional().default(''),
  fantasyName: z.string().trim().optional().default(''),
  document: z.string().trim().optional().default(''),
  city: z.string().trim().optional().default(''),
  address: z.string().trim().optional().default(''),
  addressNumber: z.string().trim().optional().default(''),
  neighborhood: z.string().trim().optional().default(''),
  state: z.string().trim().optional().default(''),
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

      if (!user || user.password !== password) {
        return { success: false, error: 'Invalid credentials' };
      }
    } finally {
      client.release();
    }

    await createSession(email);

    return { success: true };
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

  const { email, fullName, password } = validation.data;

  try {
    const client = await pool.connect();

    try {
      const existingUser = await client.query('SELECT 1 FROM promotors WHERE email = $1', [email]);

      if (existingUser.rowCount) {
        return { success: false, error: 'Email already registered' };
      }

      await client.query(
        'INSERT INTO promotors (full_name, email, password) VALUES ($1, $2, $3)',
        [fullName, email, password]
      );
    } finally {
      client.release();
    }

    await createSession(email);

    return { success: true };
  } catch (error) {
    console.error('Signup error:', error);
    return { success: false, error: 'Could not create account' };
  }
}

export async function logout() {
  await clearSession();
}

export async function searchClients(filters: z.infer<typeof clientSearchSchema>) {
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

export async function createVisit(data: z.infer<typeof visitSchema>) {
  const session = await getSession();

  if (!session) {
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
    const expirationDate = parseDisplayDateToDatabase(product.expirationDate);

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
      const userResult = await client.query('SELECT id FROM promotors WHERE email = $1', [
        session.email,
      ]);

      const promotorId = userResult.rows[0]?.id;

      if (!promotorId) {
        return { success: false, error: 'Usuario nao encontrado.' };
      }

      await client.query(
        'INSERT INTO visits (promotor_id, establishment, visit_date, products) VALUES ($1, $2, $3, $4::jsonb)',
        [promotorId, validation.data.establishment, visitDate, JSON.stringify(products)]
      );
    } finally {
      client.release();
    }

    revalidatePath('/');
    revalidatePath('/visitas/nova');

    return { success: true };
  } catch (error) {
    console.error('Create visit error:', error);
    return { success: false, error: 'Nao foi possivel salvar a visita.' };
  }
}
