import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { Header } from '@/components/home/header';
import { CopyVisitButton } from '@/components/visits/copy-visit-button';
import { DeleteDraftButton } from '@/components/visits/delete-draft-button';
import { VisitImageThumbnailGallery } from '@/components/visits/visit-image-thumbnail-gallery';
import { getHomePath, getSession } from '@/lib/auth';
import { getVisitById } from '@/lib/api/promotor';
import { getVisitConfirmationFullName } from '@/lib/header-user';
import { formatVisitCopyText } from '@/lib/visit-copy';
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
    return 'Data nao definida';
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

export default async function VisitDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  const fullName = await getVisitConfirmationFullName(
    session.accessToken,
    session.user.email,
    session.user.fullName
  );

  const { id } = await params;

  let visit:
      | {
        establishment: string;
        establishmentId: number | null;
        visitDate: string;
        products: PromotorVisitProduct[];
        beforeImages: string[];
        afterImages: string[];
        observation: string | null;
        isDraft: boolean;
        canEdit: boolean;
      }
    | null = null;

  try {
    const currentVisit = await getVisitById(session.accessToken, Number(id));

    if (currentVisit) {
      visit = {
        establishment: currentVisit.establishment ?? 'Rascunho sem estabelecimento',
        establishmentId: currentVisit.establishmentId,
        visitDate: formatDatabaseDateToDisplay(currentVisit.visitDate),
        products: currentVisit.products.map((product) => ({
          ...product,
          expirationDate: shouldDisplayIndefiniteExpiration(product.name, Number(product.quantity ?? 0))
            ? 'indefinido'
            : product.expirationDate,
        })),
        beforeImages: currentVisit.beforeImages ?? [],
        afterImages: currentVisit.afterImages ?? [],
        observation: currentVisit.observation,
        isDraft: Boolean(currentVisit.isDraft),
        canEdit: currentVisit.canEdit,
      };
    }
  } catch (error) {
    console.error('Visit details API lookup error:', error);
  }

  if (!visit) {
    notFound();
  }

  const visitCopyText = formatVisitCopyText({
    visitDate: visit.visitDate,
    userFullName: fullName,
    establishment: visit.establishment,
    establishmentId: visit.establishmentId,
    products: visit.products,
  });

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(0,156,108,0.12),_transparent_32%),linear-gradient(180deg,_#0f2d3d_0%,_var(--background)_42%,_#091c27_100%)] px-4 py-10 pb-28">
      <Header fullName={fullName} />

      <section className="mx-auto w-full max-w-4xl px-6 pt-24">
        <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.2)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#8eb4c4]">
                Detalhes da visita
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-3xl font-bold tracking-tight text-white">{visit.establishment}</h2>
                {visit.isDraft && (
                  <span className="rounded-full border border-[#ffe39d]/25 bg-[#ffe39d]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-[#ffe39d]">
                    Rascunho
                  </span>
                )}
              </div>
              <div className="inline-flex items-center rounded-full border border-white/10 bg-black/10 px-3 py-1 text-xs font-medium text-[#b9d0d9]">
                Data da visita: {visit.visitDate}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 lg:max-w-[360px] lg:justify-end">
              <CopyVisitButton
                visitText={visitCopyText}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-4 text-sm font-semibold text-white transition hover:bg-white/[0.1]"
              />
              {visit.canEdit && (
                <Link
                  href={`/visitas/${id}/editar`}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-[#00c487]/35 bg-[#009c6c]/18 px-4 text-sm font-semibold text-[#dcfff3] transition hover:bg-[#009c6c]/28"
                >
                  {visit.isDraft ? 'Continuar rascunho' : 'Editar'}
                </Link>
              )}
              {visit.isDraft && (
                <DeleteDraftButton
                  visitId={Number(id)}
                  redirectTo={getHomePath(session.user.role)}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-[#ff8c8c]/30 bg-[#5c1f1f]/35 px-4 text-sm font-semibold text-[#ffd6d6] transition hover:bg-[#6f2626]/45"
                />
              )}
              <Link
                href={getHomePath(session.user.role)}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-4 text-sm font-semibold text-white transition hover:bg-white/[0.1]"
              >
                Voltar
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-6">
          {visit.observation && (
            <div className="mb-6 rounded-[24px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_16px_35px_rgba(0,0,0,0.16)]">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/55">
                Observacao
              </p>
              <p className="mt-3 text-sm leading-6 text-white/80">{visit.observation}</p>
            </div>
          )}

          {(visit.beforeImages.length > 0 || visit.afterImages.length > 0) && (
            <div className="mb-6 grid gap-4 lg:grid-cols-2">
              {visit.beforeImages.length > 0 && (
                <VisitImageThumbnailGallery
                  images={visit.beforeImages}
                  sectionTitle="Antes"
                  altPrefix="Imagem de antes da visita"
                />
              )}

              {visit.afterImages.length > 0 && (
                <VisitImageThumbnailGallery
                  images={visit.afterImages}
                  sectionTitle="Depois"
                  altPrefix="Imagem de depois da visita"
                />
              )}
            </div>
          )}

          {visit.products.length === 0 ? (
            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] px-5 py-7 text-sm text-white/75 shadow-[0_16px_35px_rgba(0,0,0,0.16)]">
              Nenhum produto registrado nesta visita.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {visit.products.map((product, index) => (
                <article
                  key={`${product.name}-${index}`}
                  className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] p-5 shadow-[0_20px_45px_rgba(0,0,0,0.18)]"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/55">
                    Produto {index + 1}
                  </p>
                  <h3 className="mt-2 text-lg font-bold text-white">{product.name || 'Produto sem nome'}</h3>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-white/10 bg-black/10 px-3 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/50">Quantidade</p>
                      <p className="mt-2 text-sm font-semibold text-white">{product.quantity ?? 0}</p>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-black/10 px-3 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/50">Unidade</p>
                      <p className="mt-2 text-sm font-semibold text-white">{product.unit || '-'}</p>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-black/10 px-3 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/50">Validade</p>
                      <p className="mt-2 text-sm font-semibold text-white">{product.expirationDate || '-'}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
