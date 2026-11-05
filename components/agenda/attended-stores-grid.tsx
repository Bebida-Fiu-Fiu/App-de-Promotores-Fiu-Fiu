'use client';

import Link from 'next/link';
import { AlertCircle, CalendarClock, CircleCheck, Pencil, Search, Store, X } from 'lucide-react';
import { useRef, useState } from 'react';

import { searchClients, updateAgendaEntry } from '@/lib/actions';
import { DeleteAgendaEntryButton } from '@/components/agenda/delete-agenda-entry-button';
import {
  calculateAgendaVisitStatus,
  formatAgendaDate,
  getMostRecentAgendaVisitDate,
} from '@/lib/agenda-frequency';
import type { AttendedStore, OpaqueId, PromotorVisit } from '@/types/promotor';

type PromotorOption = {
  id: OpaqueId;
  name: string;
};

type ClientOption = {
  id: OpaqueId;
  client_name: string;
  fantasy_name: string;
  document: string;
  city: string;
  address: string;
  address_number: string | null;
  neighborhood: string;
  state: string;
};

type EditableStore = {
  entry: AttendedStore;
  visitHistoryAvailable: boolean;
  visits: PromotorVisit[];
};

type AttendedStoresGridProps = {
  entries: EditableStore[];
  promotors: PromotorOption[];
  canEdit: boolean;
};

function getIdKey(id: OpaqueId) {
  return `${typeof id}:${String(id)}`;
}

function sameOpaqueId(left: OpaqueId | null, right: OpaqueId | null) {
  return left === null || right === null
    ? left === right
    : typeof left === typeof right && String(left) === String(right);
}

function formatEntryTitle(entry: AttendedStore) {
  return entry.nickname || entry.fantasyName || entry.clientName || 'Loja atendida';
}

function buildVisitRegistrationHref(entry: AttendedStore) {
  if (entry.clientId === null) {
    return '/visitas/nova';
  }

  const params = new URLSearchParams({
    clientId: String(entry.clientId),
    nickname: entry.nickname,
    clientName: entry.clientName,
    fantasyName: entry.fantasyName,
    document: entry.document,
    city: entry.city,
    address: entry.address,
    neighborhood: entry.neighborhood,
    state: entry.state,
  });

  if (entry.addressNumber) {
    params.set('addressNumber', entry.addressNumber);
  }

  return `/visitas/nova?${params.toString()}`;
}

function VisitFrequency({
  entry,
  lastVisitDate,
  visitHistoryAvailable,
}: {
  entry: AttendedStore;
  lastVisitDate: string | null;
  visitHistoryAvailable: boolean;
}) {
  const status = calculateAgendaVisitStatus({
    lastVisitDate,
    daysBetweenVisits: entry.daysBetweenVisits,
    visitHistoryAvailable,
  });

  if (status.kind === 'unavailable') {
    return (
      <div className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm text-white">
        <p className="flex items-center gap-2 font-semibold">
          <AlertCircle size={17} aria-hidden="true" />
          Frequencia indisponivel
        </p>
        <p className="mt-1 text-white/80">
          {visitHistoryAvailable
            ? 'A API nao retornou uma data de ultima visita.'
            : 'Historico de visitas indisponivel.'}
        </p>
      </div>
    );
  }

  const presentation = {
    'on-time': {
      className: 'border-emerald-300/50 bg-emerald-950/60 text-emerald-100',
      icon: <CircleCheck size={18} aria-hidden="true" />,
      title: 'Em dia',
      detail: `${status.daysRemaining} dias restantes`,
    },
    upcoming: {
      className: 'border-amber-300/60 bg-amber-950/65 text-amber-100',
      icon: <CalendarClock size={18} aria-hidden="true" />,
      title: status.daysRemaining === 0 ? 'Prazo hoje' : 'Prazo proximo',
      detail:
        status.daysRemaining === 0
          ? 'Vence hoje'
          : `${status.daysRemaining} ${status.daysRemaining === 1 ? 'dia' : 'dias'}`,
    },
    overdue: {
      className: 'border-red-300/60 bg-red-950/65 text-red-100',
      icon: <AlertCircle size={18} aria-hidden="true" />,
      title: 'Prazo vencido',
      detail: `Venceu ha ${status.daysOverdue} ${status.daysOverdue === 1 ? 'dia' : 'dias'}`,
    },
    'first-visit': {
      className: 'border-sky-300/50 bg-sky-950/60 text-sky-100',
      icon: <CalendarClock size={18} aria-hidden="true" />,
      title: 'Primeira visita',
      detail: 'Sem visitas anteriores',
    },
    unavailable: {
      className: '',
      icon: null,
      title: '',
      detail: '',
    },
  }[status.kind];

  return (
    <div className={`rounded-xl border px-3 py-2 text-sm ${presentation.className}`}>
      <p className="flex items-center gap-2 font-bold">
        {presentation.icon}
        {presentation.title}
      </p>
      <p className="mt-1 font-semibold">
        {status.kind === 'upcoming' && status.daysRemaining !== null && status.daysRemaining > 0
          ? `Faltam ${status.daysRemaining} ${status.daysRemaining === 1 ? 'dia' : 'dias'}`
          : presentation.detail}
      </p>
      {status.kind !== 'first-visit' ? (
        <p className="mt-1">
          Ultima visita:{' '}
          {status.lastVisitDate ? formatAgendaDate(status.lastVisitDate) : 'Data indisponivel'}
          {status.dueDate ? ` • Limite: ${formatAgendaDate(status.dueDate)}` : ''}
        </p>
      ) : null}
    </div>
  );
}

function getEntryLastVisit(entry: AttendedStore, visits: PromotorVisit[]) {
  return getMostRecentAgendaVisitDate(
    visits,
    entry.promotorId ?? '',
    entry.clientId,
    entry.lastVisitDate,
    [entry.nickname, entry.clientName, entry.fantasyName]
  );
}

function initialClientOption(entry: AttendedStore): ClientOption | null {
  if (entry.clientId === null) {
    return null;
  }

  return {
    id: entry.clientId,
    client_name: entry.clientName,
    fantasy_name: entry.fantasyName,
    document: entry.document,
    city: entry.city,
    address: entry.address,
    address_number: entry.addressNumber,
    neighborhood: entry.neighborhood,
    state: entry.state,
  };
}

function clientLabel(client: ClientOption) {
  return client.fantasy_name || client.client_name || `Cliente ${String(client.id)}`;
}

function StoreEditor({
  entry,
  promotors,
  onCancel,
  onSave,
}: {
  entry: AttendedStore;
  promotors: PromotorOption[];
  onCancel: () => void;
  onSave: (store: AttendedStore) => void;
}) {
  const [nickname, setNickname] = useState(entry.nickname);
  const [frequency, setFrequency] = useState(String(entry.daysBetweenVisits));
  const [notes, setNotes] = useState(entry.notes ?? '');
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(
    initialClientOption(entry)
  );
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState<ClientOption[]>([]);
  const [selectedPromotorKey, setSelectedPromotorKey] = useState(
    entry.promotorId === null ? '' : getIdKey(entry.promotorId)
  );
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const savingRef = useRef(false);

  const availablePromotors = [...promotors];
  if (
    entry.promotorId !== null &&
    !availablePromotors.some((promotor) => getIdKey(promotor.id) === getIdKey(entry.promotorId!))
  ) {
    availablePromotors.push({
      id: entry.promotorId,
      name: entry.promotorName || `Promotor ${String(entry.promotorId)}`,
    });
  }

  const handleClientSearch = async () => {
    const query = clientSearch.trim();
    if (!query) {
      setErrorMessage('Informe o nome ou apelido do cliente para pesquisar.');
      return;
    }

    setIsSearching(true);
    setErrorMessage(null);
    const result = await searchClients({
      clientId: '',
      clientName: query,
      fantasyName: '',
      document: '',
      city: '',
      address: '',
      addressNumber: '',
      neighborhood: '',
      state: '',
    });
    setIsSearching(false);

    if (!result.success) {
      setClientResults([]);
      setErrorMessage(result.error ?? 'Nao foi possivel pesquisar os clientes.');
      return;
    }

    setClientResults(result.clients as ClientOption[]);
    if (result.clients.length === 0) {
      setErrorMessage('Nenhum cliente encontrado com esse nome ou apelido.');
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (savingRef.current) return;
    setErrorMessage(null);

    const trimmedNickname = nickname.trim();
    if (!trimmedNickname) {
      setErrorMessage('O apelido da loja e obrigatorio.');
      return;
    }

    const parsedFrequency = Number(frequency);
    if (!Number.isInteger(parsedFrequency) || parsedFrequency <= 0) {
      setErrorMessage('A frequencia deve ser um inteiro positivo.');
      return;
    }

    const selectedPromotor =
      availablePromotors.find((promotor) => getIdKey(promotor.id) === selectedPromotorKey) ?? null;
    const patch: {
      nickname?: string;
      daysBetweenVisits?: number;
      notes?: string | null;
      clientId?: OpaqueId | null;
      promotorId?: OpaqueId | null;
    } = {};

    if (trimmedNickname !== entry.nickname) patch.nickname = trimmedNickname;
    if (parsedFrequency !== entry.daysBetweenVisits) patch.daysBetweenVisits = parsedFrequency;
    const normalizedNotes = notes.trim() || null;
    if (normalizedNotes !== entry.notes) patch.notes = normalizedNotes;
    if (!sameOpaqueId(selectedClient?.id ?? null, entry.clientId)) {
      patch.clientId = selectedClient?.id ?? null;
    }
    if (!sameOpaqueId(selectedPromotor?.id ?? null, entry.promotorId)) {
      patch.promotorId = selectedPromotor?.id ?? null;
    }

    if (Object.keys(patch).length === 0) {
      setErrorMessage('Nenhuma alteracao foi feita.');
      return;
    }

    savingRef.current = true;
    setIsSaving(true);
    let result: Awaited<ReturnType<typeof updateAgendaEntry>>;
    try {
      result = await updateAgendaEntry(entry.id, patch, entry);
    } catch {
      savingRef.current = false;
      setIsSaving(false);
      setErrorMessage('Ocorreu um erro inesperado. Os dados continuam preenchidos para nova tentativa.');
      return;
    }
    savingRef.current = false;
    setIsSaving(false);

    if (!result.success) {
      setErrorMessage(result.error ?? 'Nao foi possivel atualizar a loja atendida.');
      return;
    }

    onSave(result.store ?? { ...entry, ...patch });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) onCancel();
      }}
    >
      <section
        aria-labelledby="attended-store-editor-title"
        aria-modal="true"
        className="my-auto max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/15 bg-[#12313f] p-5 shadow-2xl sm:p-7"
        role="dialog"
      >
        <header className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id="attended-store-editor-title" className="text-xl font-bold text-white">
              Editar loja atendida
            </h2>
            <p className="mt-1 text-sm text-white/65">Atualize os dados e salve para confirmar.</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            aria-label="Cancelar edicao"
            className="rounded-xl border border-white/15 p-2 text-white/75 transition hover:bg-white/10 disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </header>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="edit-store-nickname" className="block text-sm font-semibold text-white">
              Apelido da loja *
            </label>
            <input
              id="edit-store-nickname"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              required
              className="mt-1 h-11 w-full rounded-xl border border-white/20 bg-white/10 px-3 text-white outline-none focus:border-[#00c48c]"
            />
          </div>

          <div>
            <label htmlFor="edit-store-frequency" className="block text-sm font-semibold text-white">
              Frequencia entre visitas (dias) *
            </label>
            <input
              id="edit-store-frequency"
              type="number"
              min="1"
              step="1"
              value={frequency}
              onChange={(event) => setFrequency(event.target.value)}
              required
              className="mt-1 h-11 w-full rounded-xl border border-white/20 bg-white/10 px-3 text-white outline-none focus:border-[#00c48c]"
            />
          </div>

          <div>
            <label htmlFor="edit-store-client-search" className="block text-sm font-semibold text-white">
              Cliente vinculado <span className="font-normal text-white/60">(opcional)</span>
            </label>
            <div className="mt-1 flex gap-2">
              <input
                id="edit-store-client-search"
                value={clientSearch}
                onChange={(event) => setClientSearch(event.target.value)}
                placeholder="Buscar por nome ou apelido"
                className="h-11 min-w-0 flex-1 rounded-xl border border-white/20 bg-white/10 px-3 text-white outline-none placeholder:text-white/45 focus:border-[#00c48c]"
              />
              <button
                type="button"
                onClick={handleClientSearch}
                disabled={isSearching || !clientSearch.trim()}
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                <Search size={16} />
                {isSearching ? 'Buscando...' : 'Buscar'}
              </button>
            </div>
            {selectedClient ? (
              <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-[#00c48c]/30 bg-[#009c6c]/10 px-3 py-2">
                <span className="text-sm text-white">{clientLabel(selectedClient)}</span>
                <button
                  type="button"
                  onClick={() => setSelectedClient(null)}
                  className="text-xs font-semibold text-white underline underline-offset-2"
                >
                  Desvincular cliente
                </button>
              </div>
            ) : (
              <p className="mt-2 text-xs text-white/60">Sem cliente vinculado.</p>
            )}
            {clientResults.length > 0 ? (
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-xl border border-white/15 bg-black/20 p-2">
                {clientResults.map((client) => (
                  <li key={getIdKey(client.id)}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedClient(client);
                        setClientResults([]);
                        setErrorMessage(null);
                      }}
                      className="w-full rounded-lg px-3 py-2 text-left text-sm text-white hover:bg-white/10"
                    >
                      <span className="block font-semibold">{clientLabel(client)}</span>
                      <span className="text-xs text-white/60">
                        {client.client_name} {client.id ? `• ID ${String(client.id)}` : ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div>
            <label htmlFor="edit-store-promotor" className="block text-sm font-semibold text-white">
              Promotor responsavel <span className="font-normal text-white/60">(opcional)</span>
            </label>
            <select
              id="edit-store-promotor"
              value={selectedPromotorKey}
              onChange={(event) => setSelectedPromotorKey(event.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-white/20 bg-[#173746] px-3 text-white outline-none focus:border-[#00c48c]"
            >
              <option value="">Sem promotor atribuido</option>
              {availablePromotors.map((promotor) => (
                <option key={getIdKey(promotor.id)} value={getIdKey(promotor.id)}>
                  {promotor.name} • ID {String(promotor.id)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="edit-store-notes" className="block text-sm font-semibold text-white">
              Observacoes <span className="font-normal text-white/60">(opcional)</span>
            </label>
            <textarea
              id="edit-store-notes"
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="mt-1 w-full resize-y rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-white outline-none focus:border-[#00c48c]"
            />
          </div>

          {errorMessage ? (
            <p role="alert" className="rounded-xl border border-red-300/30 bg-red-950/40 px-3 py-2 text-sm text-red-100">
              {errorMessage}
            </p>
          ) : null}

          <footer className="flex flex-col-reverse justify-end gap-2 border-t border-white/10 pt-4 sm:flex-row">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSaving}
              className="min-h-11 rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="min-h-11 rounded-xl bg-[#009c6c] px-5 py-2 text-sm font-bold text-white hover:bg-[#007a55] disabled:cursor-wait disabled:opacity-60"
            >
              {isSaving ? 'Salvando...' : 'Salvar alteracoes'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

export function AttendedStoresGrid({ entries, promotors, canEdit }: AttendedStoresGridProps) {
  const [stores, setStores] = useState(entries);
  const [editingStoreKey, setEditingStoreKey] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const editingStore = stores.find(
    ({ entry }) =>
      `${typeof entry.id}:${String(entry.id)}` === editingStoreKey
  );

  const handleSave = (oldEntry: AttendedStore, updatedStore: AttendedStore) => {
    setStores((current) =>
      current.map((store) =>
        store.entry.id !== null &&
        oldEntry.id !== null &&
        getIdKey(store.entry.id) === getIdKey(oldEntry.id)
          ? { ...store, entry: updatedStore }
          : store
      )
    );
    setEditingStoreKey(null);
    setSuccessMessage('Loja atendida atualizada com sucesso.');
  };

  return (
    <>
      {successMessage ? (
        <p role="status" className="rounded-xl border border-emerald-300/30 bg-emerald-950/50 px-4 py-3 text-sm font-semibold text-emerald-100">
          {successMessage}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {stores.map(({ entry, visitHistoryAvailable, visits }, index) => {
          const lastVisitDate = getEntryLastVisit(entry, visits);
          const storeKey = `${typeof entry.id}:${String(entry.id)}`;

          return (
            <article
              key={`${storeKey}-${index}`}
              className="flex h-full flex-col rounded-[1.5rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.035))] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.16)] transition hover:border-white/20 hover:bg-white/[0.07]"
            >
              <header className="flex items-start gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-[#00c98b]/25 bg-[#009c6c]/15 text-[#83f0ca]">
                  <Store size={21} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="break-words text-lg font-bold leading-snug text-white">
                    {formatEntryTitle(entry)}
                  </h3>
                  {entry.notes ? (
                    <p className="mt-1 line-clamp-2 text-sm text-white/65">{entry.notes}</p>
                  ) : null}
                </div>
                <span className="shrink-0 rounded-full border border-white/10 bg-black/15 px-2.5 py-1 text-xs font-semibold text-white/70">
                  A cada {entry.daysBetweenVisits} dias
                </span>
              </header>

              <div className="mt-4 flex-1">
                <VisitFrequency
                  entry={entry}
                  lastVisitDate={lastVisitDate}
                  visitHistoryAvailable={visitHistoryAvailable || Boolean(entry.lastVisitDate)}
                />
              </div>

              <footer className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
                {entry.clientId !== null ? (
                  <Link
                    href={buildVisitRegistrationHref(entry)}
                    className="inline-flex min-h-10 flex-1 items-center justify-center rounded-xl bg-[#009c6c] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#009c6c]/80"
                  >
                    Registrar visita
                  </Link>
                ) : null}
                {canEdit && entry.id !== null ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSuccessMessage(null);
                      setEditingStoreKey(storeKey);
                    }}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/15"
                  >
                    <Pencil size={15} aria-hidden="true" />
                    Editar
                  </button>
                ) : null}
                {entry.id !== null ? <DeleteAgendaEntryButton agendaEntryId={entry.id} /> : null}
              </footer>
            </article>
          );
        })}
      </div>
      {editingStore ? (
        <StoreEditor
          key={editingStoreKey}
          entry={editingStore.entry}
          promotors={promotors}
          onCancel={() => setEditingStoreKey(null)}
          onSave={(updatedStore) => handleSave(editingStore.entry, updatedStore)}
        />
      ) : null}
    </>
  );
}
