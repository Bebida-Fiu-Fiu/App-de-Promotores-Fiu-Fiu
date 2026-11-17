export const UNSAVED_VISIT_CHANGES_MESSAGE =
  'Esta visita tem alteracoes que ainda nao foram enviadas. Elas continuam salvas neste aparelho. Deseja sair mesmo assim?';

type ClickLike = {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
};

type AnchorLike = {
  href: string;
  target?: string | null;
  hasDownload?: boolean;
};

/**
 * Diz se um clique em link vai trocar de página dentro do app, na mesma aba.
 * Cliques que abrem nova aba, downloads, links externos e âncoras na mesma
 * página não tiram o usuário do formulário, então não pedem confirmação.
 */
export function isInternalNavigationClick(event: ClickLike, anchor: AnchorLike, currentUrl: string) {
  if (event.defaultPrevented || event.button !== 0) {
    return false;
  }

  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return false;
  }

  if (anchor.hasDownload || (anchor.target && anchor.target !== '_self')) {
    return false;
  }

  let current: URL;
  let next: URL;

  try {
    current = new URL(currentUrl);
    next = new URL(anchor.href, current);
  } catch {
    return false;
  }

  if (next.origin !== current.origin) {
    return false;
  }

  return next.pathname !== current.pathname || next.search !== current.search;
}
