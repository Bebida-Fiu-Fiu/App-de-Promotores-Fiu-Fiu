import { describe, expect, it } from 'vitest';

import { isInternalNavigationClick } from '@/lib/unsaved-changes';

const CURRENT = 'https://app.teste/visitas/nova?clientId=1';
const plainClick = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false };

describe('isInternalNavigationClick', () => {
  it('confirma ao ir para outra página do app', () => {
    expect(isInternalNavigationClick(plainClick, { href: '/promotor' }, CURRENT)).toBe(true);
    expect(isInternalNavigationClick(plainClick, { href: 'https://app.teste/agenda' }, CURRENT)).toBe(true);
    expect(isInternalNavigationClick(plainClick, { href: '/visitas/nova?clientId=2' }, CURRENT)).toBe(true);
    expect(isInternalNavigationClick(plainClick, { href: '/promotor', target: '_self' }, CURRENT)).toBe(true);
  });

  it('não confirma quando o formulário continua aberto', () => {
    expect(isInternalNavigationClick(plainClick, { href: '/visitas/nova?clientId=1#fotos' }, CURRENT)).toBe(false);
    expect(isInternalNavigationClick(plainClick, { href: '/promotor', target: '_blank' }, CURRENT)).toBe(false);
    expect(isInternalNavigationClick(plainClick, { href: '/arquivo.txt', hasDownload: true }, CURRENT)).toBe(false);
    expect(isInternalNavigationClick({ ...plainClick, ctrlKey: true }, { href: '/promotor' }, CURRENT)).toBe(false);
    expect(isInternalNavigationClick({ ...plainClick, metaKey: true }, { href: '/promotor' }, CURRENT)).toBe(false);
    expect(isInternalNavigationClick({ ...plainClick, button: 1 }, { href: '/promotor' }, CURRENT)).toBe(false);
    expect(isInternalNavigationClick({ ...plainClick, defaultPrevented: true }, { href: '/promotor' }, CURRENT)).toBe(false);
  });

  it('ignora links externos e endereços inválidos', () => {
    expect(isInternalNavigationClick(plainClick, { href: 'https://wa.me/5511999999999' }, CURRENT)).toBe(false);
    expect(isInternalNavigationClick(plainClick, { href: 'mailto:contato@teste.local' }, CURRENT)).toBe(false);
    expect(isInternalNavigationClick(plainClick, { href: '/promotor' }, 'nao-e-url')).toBe(false);
  });
});
