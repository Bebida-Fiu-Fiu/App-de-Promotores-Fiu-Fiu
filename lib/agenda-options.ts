import type { OpaqueId } from '@/types/auth';

export type PromotorOption = {
  id: OpaqueId;
  name: string;
};

function normalizeSearch(value: string) {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
}

export function filterPromotorOptions(promotors: PromotorOption[], query: string) {
  const normalizedQuery = normalizeSearch(query);
  if (!normalizedQuery) {
    return promotors;
  }

  return promotors.filter((promotor) =>
    normalizeSearch(`${promotor.name} ${String(promotor.id)}`).includes(normalizedQuery)
  );
}
