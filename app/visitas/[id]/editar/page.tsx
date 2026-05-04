import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { notFound, redirect } from 'next/navigation';

import { NewVisitForm } from '@/components/visits/new-visit-form';
import { getSession } from '@/lib/auth';
import { pool } from '@/lib/db';

type EditableVisitProduct = {
  name: string;
  quantity: number;
  packageType: 'unidade' | 'pack' | 'caixa';
  expirationDate: string;
};

type StoredVisitProduct = {
  name?: string;
  quantity?: number;
  unit?: string;
  expirationDate?: string;
};

function formatDatabaseDateToDisplay(value: string | Date | null) {
  if (!value) {
    return '';
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

export default async function EditVisitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  const { id } = await params;

  let visit:
    | {
        establishment: string;
        date: string;
        observation: string;
        products: EditableVisitProduct[];
        beforeImage: string;
        afterImage: string;
        isDraft: boolean;
        canEdit: boolean;
      }
    | null = null;

  try {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT v.establishment, v.visit_date, v.observation, v.products, v.before_image, v.after_image, v.is_draft, v.created_at
         FROM visits v
         INNER JOIN promotors p ON p.id = v.promotor_id
         WHERE v.id = $1 AND p.email = $2`,
        [id, session.email]
      );

      if (result.rowCount) {
        const row = result.rows[0];
        const canEdit =
          Boolean(row.is_draft) ||
          Date.now() - new Date(row.created_at).getTime() <= 7 * 24 * 60 * 60 * 1000;

        visit = {
          establishment: row.establishment ?? '',
          date: formatDatabaseDateToDisplay(row.visit_date),
          observation: row.observation ?? '',
          beforeImage: row.before_image ?? '',
          afterImage: row.after_image ?? '',
          products: Array.isArray(row.products) && row.products.length > 0
            ? (row.products as StoredVisitProduct[]).map((product) => ({
                name: product.name ?? '',
                quantity: Number(product.quantity ?? 0),
                packageType:
                  product.unit === 'pack' || product.unit === 'caixa' ? product.unit : 'unidade',
                expirationDate: product.expirationDate ?? '',
              }))
            : [
                {
                  name: '',
                  quantity: 0,
                  packageType: 'unidade',
                  expirationDate: '',
                },
              ],
          isDraft: Boolean(row.is_draft),
          canEdit,
        };
      }
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Edit visit lookup error:', error);
  }

  if (!visit) {
    notFound();
  }

  if (!visit.canEdit) {
    redirect(`/visitas/${id}`);
  }

  return (
    <main className="min-h-screen bg-[var(--background)] pb-28">
      <div className="mx-auto w-full max-w-xs px-4 pt-10">
        <Link
          href={`/visitas/${id}`}
          className="flex w-fit items-center gap-2 text-sm font-medium text-white/70 transition hover:text-white"
        >
          <ArrowLeft size={18} />
          Voltar para a visita
        </Link>
      </div>
      <NewVisitForm
        visitId={Number(id)}
        isDraft={visit.isDraft}
        initialData={{
          establishment: visit.establishment,
          date: visit.date,
          observation: visit.observation,
          products: visit.products,
          beforeImage: visit.beforeImage,
          afterImage: visit.afterImage,
        }}
      />
    </main>
  );
}
