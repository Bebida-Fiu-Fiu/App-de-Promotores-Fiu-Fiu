'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { deleteVisitDraft } from '@/lib/actions';

type DeleteDraftButtonProps = {
  visitId: number;
  redirectTo?: string;
  className?: string;
};

export function DeleteDraftButton({
  visitId,
  redirectTo = '/',
  className,
}: DeleteDraftButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          const shouldDelete = window.confirm('Deseja excluir este rascunho?');

          if (!shouldDelete) {
            return;
          }

          setError(null);

          startTransition(async () => {
            const result = await deleteVisitDraft(visitId);

            if (!result.success) {
              setError(result.error ?? 'Nao foi possivel excluir o rascunho.');
              return;
            }

            router.push(redirectTo);
            router.refresh();
          });
        }}
        className={className}
      >
        {isPending ? 'Excluindo...' : 'Excluir rascunho'}
      </button>

      {error && <p className="text-sm text-[#ffd1d1]">{error}</p>}
    </div>
  );
}
