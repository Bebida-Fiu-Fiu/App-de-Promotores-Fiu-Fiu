'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { deleteVisitDraft } from '@/lib/actions';

type DeleteDraftButtonProps = {
  visitId: number;
  className?: string;
  redirectTo?: string;
  onDeleted?: (visitId: number) => void;
};

export function DeleteDraftButton({
  visitId,
  className,
  redirectTo = '/promotor',
  onDeleted,
}: DeleteDraftButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
          setSuccess(null);

          startTransition(async () => {
            const result = await deleteVisitDraft(visitId);

            if (!result.success) {
              setError(result.error ?? 'Nao foi possivel excluir o rascunho.');

              if (result.shouldRedirectToLogin) {
                router.replace('/login');
              }

              return;
            }

            const successMessage = result.message ?? 'Rascunho excluido com sucesso.';
            setSuccess(successMessage);

            if (typeof onDeleted === 'function') {
              onDeleted(result.deletedVisitId ?? visitId);
            }

            router.replace(redirectTo);
          });
        }}
        className={className}
      >
        {isPending ? 'Excluindo...' : 'Excluir rascunho'}
      </button>

      {success && <p className="text-sm text-[#c7ffd9]">{success}</p>}
      {error && <p className="text-sm text-[#ffd1d1]">{error}</p>}
    </div>
  );
}
