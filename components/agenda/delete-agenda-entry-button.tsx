'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { removeAgendaEntry } from '@/lib/actions';
import type { OpaqueId } from '@/types/promotor';

type DeleteAgendaEntryButtonProps = {
  agendaEntryId: OpaqueId;
};

export function DeleteAgendaEntryButton({ agendaEntryId }: DeleteAgendaEntryButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          const shouldDelete = window.confirm('Deseja excluir esta loja atendida?');

          if (!shouldDelete) {
            return;
          }

          setError(null);

          startTransition(async () => {
            const result = await removeAgendaEntry(agendaEntryId);

            if (!result.success) {
              setError(result.error ?? 'Nao foi possivel excluir a loja atendida.');
              return;
            }

            router.refresh();
          });
        }}
        className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[#ff8c8c]/35 bg-[#5c1f1f]/40 px-4 py-2 text-sm font-bold text-[#ffe2e2] transition hover:bg-[#5c1f1f]/60 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isPending ? 'Excluindo...' : 'Excluir'}
      </button>

      {error ? <p className="text-sm text-[#ffd1d1]">{error}</p> : null}
    </div>
  );
}
