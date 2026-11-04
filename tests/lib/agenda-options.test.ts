import { describe, expect, it } from 'vitest';

import { filterPromotorOptions } from '@/lib/agenda-options';

const promotors = [
  { id: '00017', name: 'Joao da Silva' },
  { id: '00023', name: 'Maria Souza' },
];

describe('agenda promoter autocomplete', () => {
  it('filters promoters by accent-insensitive name', () => {
    expect(filterPromotorOptions(promotors, 'joão')).toEqual([promotors[0]]);
  });

  it('filters by opaque ID without removing leading zeroes', () => {
    expect(filterPromotorOptions(promotors, '00023')).toEqual([promotors[1]]);
    expect(filterPromotorOptions(promotors, '00024')).toEqual([]);
  });
});
