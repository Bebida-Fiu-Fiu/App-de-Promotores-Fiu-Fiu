'use client';

import { useEffect } from 'react';

import { isInternalNavigationClick } from '@/lib/unsaved-changes';

/**
 * Enquanto `enabled` for verdadeiro, pede confirmação antes de sair da página:
 * - fechar/recarregar a aba (aviso nativo do navegador via `beforeunload`);
 * - clicar em links internos (`<a>`/`<Link>`), com `window.confirm`.
 *
 * O App Router não tem API para bloquear navegação, então os cliques são
 * interceptados na fase de captura do `document`, antes do `onClick` do `<Link>`.
 */
export function useUnsavedChangesWarning(enabled: boolean, message: string) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Navegadores antigos só mostram o aviso com returnValue preenchido.
      event.returnValue = '';
    };

    const handleClick = (event: MouseEvent) => {
      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest('a[href]');

      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }

      const isNavigation = isInternalNavigationClick(
        event,
        { href: anchor.href, target: anchor.target, hasDownload: anchor.hasAttribute('download') },
        window.location.href
      );

      if (!isNavigation || window.confirm(message)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('click', handleClick, true);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('click', handleClick, true);
    };
  }, [enabled, message]);
}
