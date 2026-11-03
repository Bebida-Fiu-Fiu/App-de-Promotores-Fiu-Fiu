import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { notFound, redirect } from 'next/navigation';

import { NewVisitForm } from '@/components/visits/new-visit-form';
import { getSession } from '@/lib/auth';
import { getVisitById } from '@/lib/api/promotor';
import { getVisitConfirmationFullName } from '@/lib/header-user';
import type { PromotorVisitProduct } from '@/types/promotor';

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

function shouldDisplayIndefiniteExpiration(productName: string, quantity: number) {
  if (quantity === 0 && productName.trim()) {
    return true;
  }

  return INDEFINITE_EXPIRATION_PRODUCTS.has(normalizeProductName(productName));
}

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

  const userFullName = await getVisitConfirmationFullName(
    session.accessToken,
    session.user.email,
    session.user.fullName
  );
  const { id } = await params;

  let visit:
      | {
        establishmentLabel: string;
        establishmentId: number | null;
        visitDate: string;
        observation: string;
        products: PromotorVisitProduct[];
        beforeImages: string[];
        afterImages: string[];
        isDraft: boolean;
        canEdit: boolean;
      }
    | null = null;

  try {
    const row = await getVisitById(session.accessToken, Number(id));

    if (row) {
      visit = {
        establishmentLabel: row.establishment ?? '',
        establishmentId: row.establishmentId,
        visitDate: formatDatabaseDateToDisplay(row.visitDate),
        observation: row.observation ?? '',
        beforeImages: row.beforeImages ?? [],
        afterImages: row.afterImages ?? [],
        products: Array.isArray(row.products)
          ? row.products.map((product) => ({
              name: product.name ?? '',
              quantity: Number(product.quantity ?? 0),
              unit: product.unit === 'pack' || product.unit === 'caixa' ? product.unit : 'unidade',
              expirationDate: shouldDisplayIndefiniteExpiration(
                product.name ?? '',
                Number(product.quantity ?? 0)
              )
                ? 'indefinido'
                : formatDatabaseDateToDisplay(product.expirationDate ?? ''),
            }))
          : [],
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
        userFullName={userFullName}
        initialData={{
          establishmentLabel: visit.establishmentLabel,
          establishmentId: visit.establishmentId,
          visitDate: visit.visitDate,
          observation: visit.observation,
          products: visit.products,
          beforeImages: visit.beforeImages,
          afterImages: visit.afterImages,
        }}
      />
    </main>
  );
}
