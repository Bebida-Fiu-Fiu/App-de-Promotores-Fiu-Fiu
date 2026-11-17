'use client';

import { History } from 'lucide-react';

type VisitRecoveryBannerProps = {
  savedAt: number;
  photoCount: number;
  isBusy?: boolean;
  onRestore: () => void;
  onDiscard: () => void;
};

function formatSavedAt(savedAt: number) {
  const date = new Date(savedAt);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function VisitRecoveryBanner({
  savedAt,
  photoCount,
  isBusy = false,
  onRestore,
  onDiscard,
}: VisitRecoveryBannerProps) {
  const formattedSavedAt = formatSavedAt(savedAt);

  return (
    <div
      role="region"
      aria-label="Visita nao enviada encontrada"
      className="mt-6 rounded-2xl border border-[#7fe7c5]/35 bg-[#009c6c]/12 p-4"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-[#009c6c]/20 p-2 text-[#c8ffe7]">
          <History size={18} />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-white">Voce tem uma visita nao enviada neste aparelho</p>
          <p className="mt-1 text-sm text-white/75">
            {formattedSavedAt ? `Salva automaticamente em ${formattedSavedAt}` : 'Salva automaticamente'}
            {photoCount > 0 ? `, com ${photoCount} ${photoCount === 1 ? 'foto' : 'fotos'}.` : '.'}
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap justify-end gap-3">
        <button
          type="button"
          disabled={isBusy}
          onClick={onDiscard}
          className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-70"
        >
          Descartar
        </button>
        <button
          type="button"
          disabled={isBusy}
          onClick={onRestore}
          className="rounded-xl bg-[#009c6c] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#00b57d] disabled:cursor-not-allowed disabled:opacity-70"
        >
          Continuar de onde parou
        </button>
      </div>
    </div>
  );
}
