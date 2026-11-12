import { describe, expect, it } from 'vitest';

import { toApiVisitDate, toDisplayVisitDate } from '@/lib/commercial-dates';

describe('datas de visita comercial', () => {
  it('converte dd/mm/aaaa para AAAA-MM-DD ao enviar', () => {
    expect(toApiVisitDate('10/11/2026')).toBe('2026-11-10');
    expect(toApiVisitDate('2026-11-10')).toBe('2026-11-10');
  });

  it('converte AAAA-MM-DD para dd/mm/aaaa ao exibir e mantém formatos antigos', () => {
    expect(toDisplayVisitDate('2026-11-10')).toBe('10/11/2026');
    expect(toDisplayVisitDate('10/11/2026')).toBe('10/11/2026');
  });
});
