'use client';

import { useState } from 'react';

export function CopyVisitButton({
  visitText,
  className = 'w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/20',
}: {
  visitText: string;
  className?: string;
}) {
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const handleCopyVisit = async () => {
    try {
      await navigator.clipboard.writeText(visitText);
      setCopyMessage('Informações copiadas.');
    } catch {
      setCopyMessage('Não foi possível copiar as informações.');
    }
  };

  return (
    <>
      <button
        onClick={handleCopyVisit}
        className={className}
      >
        Copiar informações da visita
      </button>
      {copyMessage && (
        <p role="status" className="text-center text-sm text-white/75">
          {copyMessage}
        </p>
      )}
    </>
  );
}
