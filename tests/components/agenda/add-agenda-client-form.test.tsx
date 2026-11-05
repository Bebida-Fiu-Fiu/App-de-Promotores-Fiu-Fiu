// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { createAgendaEntry, searchClients, push, refresh } = vi.hoisted(() => ({
  createAgendaEntry: vi.fn(),
  searchClients: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('@/lib/actions', () => ({
  createAgendaEntry,
  searchClients,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}));

import { AddAgendaClientForm } from '@/components/agenda/add-agenda-client-form';

let root: ReturnType<typeof createRoot> | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  container?.remove();
  container = null;
  vi.clearAllMocks();
});

describe('add attended store form', () => {
  it('locks the promoter field to the current user and submits the store', async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    createAgendaEntry.mockResolvedValue({ success: true });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <AddAgendaClientForm currentPromotor={{ id: '00017', name: 'Promotor Logado' }} />
      );
    });

    const promoterInput = container.querySelector<HTMLInputElement>('#agenda-promotor');
    expect(promoterInput?.readOnly).toBe(true);
    expect(promoterInput?.value).toBe('Promotor Logado');

    const nicknameInput = container.querySelector<HTMLInputElement>('#agenda-nickname');
    const setInputValue = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value'
    )?.set;
    await act(async () => {
      setInputValue?.call(nicknameInput, 'Loja vinculada');
      nicknameInput?.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await act(async () => {
      container
        ?.querySelector('form')
        ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(createAgendaEntry).toHaveBeenCalledWith({
      nickname: 'Loja vinculada',
      daysBetweenVisits: 7,
    });
  });
});
