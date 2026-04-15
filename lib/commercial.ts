import { pool } from '@/lib/db';

export type CommercialSubmissionRecord = {
  id: number;
  clientName: string;
  fantasyName: string;
  cnpj: string | null;
  email: string | null;
  phone: string;
  address: string;
  totalValue: number;
  salesQuantity: number;
  sold: boolean;
  visitDates: string[];
  submittedByEmail: string;
  createdAt: string;
};

function normalizeVisitDates(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }

  if (typeof value === 'string') {
    try {
      const parsedValue = JSON.parse(value);

      if (Array.isArray(parsedValue)) {
        return parsedValue.map((item) => String(item));
      }
    } catch {
      return [];
    }
  }

  return [];
}

function mapCommercialSubmissionRow(row: Record<string, unknown>): CommercialSubmissionRecord {
  return {
    id: Number(row.id),
    clientName: String(row.client_name ?? ''),
    fantasyName: String(row.fantasy_name ?? ''),
    cnpj: row.cnpj ? String(row.cnpj) : null,
    email: row.email ? String(row.email) : null,
    phone: String(row.phone ?? ''),
    address: String(row.address ?? ''),
    totalValue: Number(row.total_value ?? 0),
    salesQuantity: Number(row.sales_quantity ?? 0),
    sold: Boolean(row.sold),
    visitDates: normalizeVisitDates(row.visit_dates),
    submittedByEmail: String(row.submitted_by_email ?? ''),
    createdAt: String(row.created_at ?? ''),
  };
}

export async function getCommercialSubmissions() {
  const client = await pool.connect();

  try {
    const result = await client.query(
      `SELECT
         id,
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
         submitted_by_email,
         created_at
       FROM commercial_submissions
       ORDER BY created_at DESC, id DESC`
    );

    return result.rows.map((row) => mapCommercialSubmissionRow(row));
  } finally {
    client.release();
  }
}

export async function getCommercialSubmissionById(id: number) {
  const client = await pool.connect();

  try {
    const result = await client.query(
      `SELECT
         id,
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
         submitted_by_email,
         created_at
       FROM commercial_submissions
       WHERE id = $1`,
      [id]
    );

    const row = result.rows[0];

    return row ? mapCommercialSubmissionRow(row) : null;
  } finally {
    client.release();
  }
}

export async function getPromotorFullNameByEmail(email: string) {
  const client = await pool.connect();

  try {
    const result = await client.query('SELECT full_name FROM promotors WHERE email = $1', [email]);
    return result.rows[0]?.full_name ?? null;
  } finally {
    client.release();
  }
}
