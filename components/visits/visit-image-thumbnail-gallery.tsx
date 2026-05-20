'use client';

import Image from 'next/image';
import { useState } from 'react';

import { VisitImageLightbox } from '@/components/visits/visit-image-lightbox';

type VisitImageThumbnailGalleryProps = {
  images: string[];
  sectionTitle: string;
  altPrefix: string;
};

export function VisitImageThumbnailGallery({
  images,
  sectionTitle,
  altPrefix,
}: VisitImageThumbnailGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (images.length === 0) {
    return null;
  }

  return (
    <>
      <article className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] p-4 shadow-[0_20px_45px_rgba(0,0,0,0.18)]">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/55">
            {sectionTitle}
          </p>
          <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/45">
            Clique para ampliar
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((imageUrl, index) => (
            <button
              key={`${imageUrl}-${index}`}
              type="button"
              onClick={() => setSelectedIndex(index)}
              className="group overflow-hidden rounded-[18px] border border-white/12 bg-white/5 text-left transition hover:border-white/25 hover:bg-white/10"
              aria-label={`Abrir ${altPrefix.toLowerCase()} ${index + 1}`}
            >
              <Image
                src={imageUrl}
                alt={`${altPrefix} ${index + 1}`}
                width={800}
                height={600}
                unoptimized
                className="h-28 w-full object-cover transition duration-200 group-hover:scale-[1.03]"
              />
              <div className="border-t border-white/10 px-3 py-2 text-[11px] font-medium uppercase tracking-[0.16em] text-white/60">
                Foto {index + 1}
              </div>
            </button>
          ))}
        </div>
      </article>

      <VisitImageLightbox
        images={images}
        altPrefix={altPrefix}
        selectedIndex={selectedIndex}
        onClose={() => setSelectedIndex(null)}
        onSelect={setSelectedIndex}
      />
    </>
  );
}
