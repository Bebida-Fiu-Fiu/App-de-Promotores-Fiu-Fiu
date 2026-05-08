import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { notFound, redirect } from 'next/navigation';

import { NewVisitForm } from '@/components/visits/new-visit-form';
import { getSession } from '@/lib/auth';
import { getVisitById } from '@/lib/api/promotor';

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
        products: EditableVisitProduct[];
        beforeImage: string;
        afterImage: string;
        isDraft: boolean;
        canEdit: boolean;
      }
    | null = null;

  try {
    const row = await getVisitById(session.accessToken, Number(id));

    if (row) {
      visit = {
        establishment: row.establishment ?? '',
        date: formatDatabaseDateToDisplay(row.visitDate),
        beforeImage: row.beforeImage ?? '',
        afterImage: row.afterImage ?? '',
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
        isDraft: Boolean(row.isDraft),
        canEdit: row.canEdit,
      };
    }
  } catch (error) {
    console.error('Edit visit API lookup error:', error);
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
          products: visit.products,
          beforeImage: visit.beforeImage,
          afterImage: visit.afterImage,
        }}
      />
    </main>
  );
}
