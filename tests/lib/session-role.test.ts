import { describe, expect, it } from 'vitest';

import { resolveRoleFromServer } from '@/lib/session-role';

describe('resolveRoleFromServer', () => {
  it('usa o perfil comercial apenas quando a API o confirma', () => {
    expect(resolveRoleFromServer({ role: 'comercial' })).toBe('comercial');
  });

  it('cai para promotor em qualquer outro caso', () => {
    expect(resolveRoleFromServer({ role: 'promotor' })).toBe('promotor');
    expect(resolveRoleFromServer({ role: 'admin' })).toBe('promotor');
    expect(resolveRoleFromServer({})).toBe('promotor');
    expect(resolveRoleFromServer(null)).toBe('promotor');
    expect(resolveRoleFromServer(undefined)).toBe('promotor');
  });
});
