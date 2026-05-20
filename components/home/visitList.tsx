'use client';

import Link from 'next/link';
import { useState } from 'react';

import { DeleteDraftButton } from '@/components/visits/delete-draft-button';
import type { PromotorVisit } from '@/types/promotor';

type VisitListProps = {
  visits: PromotorVisit[];
  page: number;
  hasNextPage: boolean;
  totalVisits: number | null;
  pageSize: number;
};

export function VisitList({ visits, page, hasNextPage, totalVisits, pageSize }: VisitListProps) {
  const [items, setItems] = useState(visits);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const hasPreviousPage = page > 1;
  const visibleTotalVisits =
    totalVisits === null ? null : Math.max(totalVisits - (visits.length - items.length), 0);

  const handleDeleted = (visitId: number) => {
    setItems((currentItems) => currentItems.filter((visit) => visit.id !== visitId));
    setSuccessMessage('Rascunho excluido com sucesso.');
  };

  return (
    <section className="mx-auto w-full max-w-4xl px-6 pt-24">
      <div className="flex flex-col gap-4 rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] px-5 py-5 shadow-[0_20px_50px_rgba(0,0,0,0.2)] sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#8eb4c4]">
            Painel de visitas
          </p>
          <div className="space-y-1">
            <h2 className="text-3xl font-bold tracking-tight text-white">Visitas</h2>
            <p className="max-w-xl text-sm text-[#b6cfd9]">
              Acompanhe rascunhos e relatórios recentes em uma lista mais clara e rápida de usar.
            </p>
          </div>
        </div>

        <Link
          href="/visitas/nova"
          className="inline-flex h-11 items-center justify-center rounded-xl bg-[#009c6c] px-5 text-sm font-bold text-white shadow-[0_12px_30px_rgba(0,156,108,0.28)] transition hover:-translate-y-0.5 hover:bg-[#00b57d]"
        >
          Nova Visita
        </Link>
      </div>

      <div className="mt-6 grid gap-4">
        {successMessage ? (
          <div className="rounded-[20px] border border-[#8ef0b4]/20 bg-[#0d3a26]/50 px-5 py-4 text-sm font-medium text-[#d7ffe4] shadow-[0_16px_35px_rgba(0,0,0,0.16)]">
            {successMessage}
          </div>
        ) : null}

        {items.length === 0 ? (
          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] px-5 py-7 text-sm text-white/75 shadow-[0_16px_35px_rgba(0,0,0,0.16)]">
            Nenhuma visita cadastrada ainda.
          </div>
        ) : (
          items.map((visit) => (
            <article
              key={visit.id}
              className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] p-5 shadow-[0_20px_45px_rgba(0,0,0,0.18)] transition hover:border-white/20 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.1),rgba(255,255,255,0.05))]"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-bold leading-tight text-white">{visit.establishment}</h3>
                    {visit.isDraft && (
                      <span className="rounded-full border border-[#ffe39d]/25 bg-[#ffe39d]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-[#ffe39d]">
                        Rascunho
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#b9d0d9]">
                    <span className="rounded-full border border-white/10 bg-black/10 px-3 py-1 font-medium">
                      {visit.visitDate ? visit.visitDate.split('-').reverse().join('/') : 'Data nao definida'}
                    </span>
                  </div>

                  {visit.products && visit.products.length > 0 && (
                    <div className="space-y-1 border-t border-white/10 pt-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-white/60">Produtos</p>
                      <div className="grid gap-1">
                        {visit.products.slice(0, 3).map((product, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-xs text-white/70">
                            <span className="mt-0.5">•</span>
                            <span>
                              {product.name} ({product.quantity} {product.unit})
                              {product.expirationDate && product.expirationDate !== 'indefinido' && (
                                <span className="ml-1 text-white/50">- {product.expirationDate.split('-').reverse().join('/')}</span>
                              )}
                            </span>
                          </div>
                        ))}
                        {visit.products.length > 3 && (
                          <div className="text-xs text-white/50">
                            +{visit.products.length - 3} produto{visit.products.length - 3 > 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {visit.observation && (
                    <div className="border-t border-white/10 pt-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-white/60">Observação</p>
                      <p className="text-xs text-white/70">{visit.observation}</p>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 sm:items-start sm:justify-end">
                  <Link
                    href={`/visitas/${visit.id}`}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-4 text-sm font-semibold text-white transition hover:bg-white/[0.1]"
                  >
                    Ver
                  </Link>
                  {visit.canEdit && (
                    <Link
                      href={`/visitas/${visit.id}/editar`}
                      className="inline-flex h-10 items-center justify-center rounded-xl border border-[#00c487]/35 bg-[#009c6c]/18 px-4 text-sm font-semibold text-[#dcfff3] transition hover:bg-[#009c6c]/28"
                    >
                      {visit.isDraft ? 'Continuar' : 'Editar'}
                    </Link>
                  )}
                  {visit.isDraft && (
                    <DeleteDraftButton
                      visitId={visit.id}
                      onDeleted={handleDeleted}
                      className="inline-flex h-10 items-center justify-center rounded-xl border border-[#ff8c8c]/25 bg-[#5c1f1f]/30 px-4 text-sm font-semibold text-[#ffd6d6] transition hover:bg-[#6f2626]/45"
                    />
                  )}
                </div>
              </div>
            </article>
          ))
        )}
      </div>

      <div className="mt-6 flex flex-col gap-3 rounded-[24px] border border-white/10 bg-white/[0.04] px-5 py-4 text-sm text-[#b6cfd9] shadow-[0_16px_35px_rgba(0,0,0,0.16)] sm:flex-row sm:items-center sm:justify-between">
        <span>
          Pagina {page}
          {visibleTotalVisits !== null
            ? ` de ${Math.max(1, Math.ceil(visibleTotalVisits / pageSize))} · ${visibleTotalVisits} visitas`
            : ''}
        </span>

        <div className="flex gap-2">
          <Link
            href={hasPreviousPage ? `/promotor?page=${page - 1}` : '/promotor'}
            aria-disabled={!hasPreviousPage}
            className={`inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold transition ${
              hasPreviousPage
                ? 'border border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.1]'
                : 'cursor-not-allowed border border-white/10 bg-white/[0.02] text-white/35 pointer-events-none'
            }`}
          >
            Anterior
          </Link>
          <Link
            href={`/promotor?page=${page + 1}`}
            aria-disabled={!hasNextPage}
            className={`inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold transition ${
              hasNextPage
                ? 'border border-[#00c487]/35 bg-[#009c6c]/18 text-[#dcfff3] hover:bg-[#009c6c]/28'
                : 'cursor-not-allowed border border-white/10 bg-white/[0.02] text-white/35 pointer-events-none'
            }`}
          >
            Proxima
          </Link>
        </div>
      </div>
    </section>
  );
}
