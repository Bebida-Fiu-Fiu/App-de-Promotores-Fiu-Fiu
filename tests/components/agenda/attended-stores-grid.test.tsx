// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AttendedStoresGrid } from '@/components/agenda/attended-stores-grid';
import type { AttendedStore } from '@/types/promotor';

const { updateAgendaEntry, searchClients, removeAgendaEntry } = vi.hoisted(() => ({
  updateAgendaEntry: vi.fn(),
  searchClients: vi.fn(),
  removeAgendaEntry: vi.fn(),
}));

vi.mock('@/lib/actions', () => ({
  updateAgendaEntry,
  searchClients,
  removeAgendaEntry,
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/components/agenda/delete-agenda-entry-button', () => ({
  DeleteAgendaEntryButton: () => null,
}));

const store: AttendedStore = {
  id: '0009',
  promotorId: '00017',
  promotorName: 'Promotor Teste',
  promotorEmail: null,
  clientId: '00042',
  clientName: 'Mercado Central',
  fantasyName: 'Central',
  city: 'Sao Paulo',
  state: 'SP',
  nickname: 'Loja Centro',
  notes: 'Observacao atual',
  document: '',
  address: '',
  addressNumber: null,
  neighborhood: '',
  daysBetweenVisits: 7,
  lastVisitDate: null,
  createdAt: null,
  updatedAt: null,
};

let root: ReturnType<typeof createRoot> | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
  }
  root = null;
  container?.remove();
  container = null;
  vi.clearAllMocks();
});

describe('attended stores editor', () => {
  it('cancels editing without calling the update action', async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <AttendedStoresGrid
          canEdit
          promotors={[{ id: '00017', name: 'Promotor Teste' }]}
          entries={[
            {
              entry: store,
              visitHistoryAvailable: true,
              visits: [],
            },
          ]}
        />
      );
    });

    const editButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Editar'
    );
    expect(editButton).toBeDefined();
    await act(async () => editButton?.click());
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();

    const cancelButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Cancelar'
    );
    await act(async () => cancelButton?.click());

    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(updateAgendaEntry).not.toHaveBeenCalled();
  });
});
