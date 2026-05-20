'use client';

import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import Image from 'next/image';
import { useEffect } from 'react';

type VisitImageLightboxProps = {
  images: string[];
  altPrefix: string;
  selectedIndex: number | null;
  onClose: () => void;
  onSelect: (index: number) => void;
};

export function VisitImageLightbox({
  images,
  altPrefix,
  selectedIndex,
  onClose,
  onSelect,
}: VisitImageLightboxProps) {
  const hasSelection = selectedIndex !== null && selectedIndex >= 0 && selectedIndex < images.length;

  useEffect(() => {
    if (!hasSelection) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }

      if (event.key === 'ArrowLeft' && selectedIndex !== null && selectedIndex > 0) {
        onSelect(selectedIndex - 1);
      }

      if (event.key === 'ArrowRight' && selectedIndex !== null && selectedIndex < images.length - 1) {
        onSelect(selectedIndex + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [hasSelection, images.length, onClose, onSelect, selectedIndex]);

  if (!hasSelection || selectedIndex === null) {
    return null;
  }

  const currentImage = images[selectedIndex];
  const canGoBack = selectedIndex > 0;
  const canGoForward = selectedIndex < images.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/88 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Visualizacao ampliada da imagem"
    >
      <div
        className="relative w-full max-w-5xl"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white transition hover:bg-black/65"
          aria-label="Fechar visualizacao"
        >
          <X size={18} />
        </button>

        {canGoBack && (
          <button
            type="button"
            onClick={() => onSelect(selectedIndex - 1)}
            className="absolute left-3 top-1/2 z-10 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white transition hover:bg-black/65"
            aria-label="Imagem anterior"
          >
            <ChevronLeft size={20} />
          </button>
        )}

        {canGoForward && (
          <button
            type="button"
            onClick={() => onSelect(selectedIndex + 1)}
            className="absolute right-3 top-1/2 z-10 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white transition hover:bg-black/65"
            aria-label="Proxima imagem"
          >
            <ChevronRight size={20} />
          </button>
        )}

        <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#07141c] shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
          <Image
            src={currentImage}
            alt={`${altPrefix} ${selectedIndex + 1}`}
            width={1800}
            height={1400}
            unoptimized
            className="max-h-[82vh] w-full object-contain"
          />
        </div>

        <div className="mt-3 text-center text-xs font-medium uppercase tracking-[0.18em] text-white/60">
          {selectedIndex + 1} de {images.length}
        </div>
      </div>
    </div>
  );
}
