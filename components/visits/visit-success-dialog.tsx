'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { CopyVisitButton } from '@/components/visits/copy-visit-button';

type VisitSuccessDialogProps = {
  isOpen: boolean;
  homePath: string;
  visitText: string;
  visitDate: string;
  onClose?: () => void;
};

export function VisitSuccessDialog({
  isOpen,
  homePath,
  visitText,
  visitDate,
}: VisitSuccessDialogProps) {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);

  if (!isOpen) {
    return null;
  }

  const handleDownloadVisit = () => {
    const file = new Blob([visitText], { type: 'text/plain;charset=utf-8' });
    const downloadUrl = URL.createObjectURL(file);
    const link = document.createElement('a');
    const dateForFilename = visitDate.replace(/\//g, '-');

    link.href = downloadUrl;
    link.download = `visita-${dateForFilename}.txt`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
  };

  const handleNewVisit = () => {
    setIsNavigating(true);
    router.push('/visitas/nova');
  };

  const handleHome = () => {
    setIsNavigating(true);
    router.push(homePath);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-3xl border border-white/10 bg-[#0f2d3d]/95 px-6 py-8 shadow-2xl">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20">
            <div className="text-3xl text-emerald-400">✓</div>
          </div>

          <h2 className="text-2xl font-bold text-white">Visita salva com sucesso!</h2>
          <p className="mt-2 text-sm text-white/70">
            A visita foi registrada corretamente no sistema.
          </p>
        </div>

        <div className="mt-8 space-y-3">
          <CopyVisitButton visitText={visitText} />

          <button
            onClick={handleDownloadVisit}
            className="w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
          >
            Baixar informações (.txt)
          </button>

          <button
            onClick={handleNewVisit}
            disabled={isNavigating}
            className="w-full rounded-xl bg-[#009c6c] px-4 py-3 text-sm font-bold text-white shadow-[0_12px_30px_rgba(0,156,108,0.28)] transition hover:bg-[#00b57d] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isNavigating ? 'Carregando...' : 'Registrar outra visita'}
          </button>

          <button
            onClick={handleHome}
            disabled={isNavigating}
            className="w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isNavigating ? 'Carregando...' : 'Voltar ao início'}
          </button>
        </div>
      </div>
    </div>
  );
}
