'use client';

import { Building2, Search } from 'lucide-react';
import { startTransition, useState } from 'react';
import { useRouter } from 'next/navigation';

import { createAgendaEntry, searchClients } from '@/lib/actions';
import { filterPromotorOptions, type PromotorOption } from '@/lib/agenda-options';
import type { OpaqueId } from '@/types/promotor';

type ClientSearchFilters = {
  clientId: string;
  clientName: string;
  fantasyName: string;
  document: string;
  city: string;
  address: string;
  addressNumber: string;
  neighborhood: string;
  state: string;
};

type ClientSearchResult = {
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

function getIdKey(id: OpaqueId) {
  return `${typeof id}:${String(id)}`;
}

function buildClientLabel(client: ClientSearchResult) {
  return client.fantasy_name || client.client_name;
}

function buildClientSubtitle(client: ClientSearchResult) {
  return [client.address, client.address_number, client.neighborhood, client.city, client.state]
    .filter(Boolean)
    .join(', ');
}

function RequiredAsterisk() {
  return <span className="ml-1 text-[#ff6b6b]">*</span>;
}

function hasAtLeastOneSearchFilter(filters: ClientSearchFilters) {
  return Object.values(filters).some((value) => value.trim().length > 0);
}

export function AddAgendaClientForm({
  promotors,
  promoterListMessage,
}: {
  promotors: PromotorOption[];
  promoterListMessage: string | null;
}) {
  const router = useRouter();
  const [searchFilters, setSearchFilters] = useState<ClientSearchFilters>({
    clientId: '',
    clientName: '',
    fantasyName: '',
    document: '',
    city: '',
    address: '',
    addressNumber: '',
    neighborhood: '',
    state: '',
  });
  const [searchResults, setSearchResults] = useState<ClientSearchResult[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientSearchResult | null>(null);
  const [selectedPromotorKey, setSelectedPromotorKey] = useState('');
  const [promotorSearch, setPromotorSearch] = useState('');
  const [isPromotorListOpen, setIsPromotorListOpen] = useState(false);
  const [activePromotorIndex, setActivePromotorIndex] = useState(0);
  const [nickname, setNickname] = useState('');
  const [daysBetweenVisits, setDaysBetweenVisits] = useState('7');
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleFilterChange = (field: keyof ClientSearchFilters, value: string) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setSearchFilters((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSearch = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!hasAtLeastOneSearchFilter(searchFilters)) {
      setSearchResults([]);
      setErrorMessage('Preencha pelo menos um filtro em "Buscar cliente na base".');
      return;
    }

    setIsSearching(true);

    const result = await searchClients(searchFilters);

    startTransition(() => {
      setIsSearching(false);

      if (!result.success) {
        setSearchResults([]);
        setErrorMessage(result.error ?? 'Nao foi possivel pesquisar os clientes.');
        return;
      }

      setSearchResults(result.clients as ClientSearchResult[]);

      if (result.clients.length === 0) {
        setErrorMessage('Nenhum cliente encontrado com esses filtros.');
      }
    });
  };

  const resetForm = () => {
    setSearchFilters({
      clientId: '',
      clientName: '',
      fantasyName: '',
      document: '',
      city: '',
      address: '',
      addressNumber: '',
      neighborhood: '',
      state: '',
    });
    setSearchResults([]);
    setSelectedClient(null);
    setSelectedPromotorKey('');
    setPromotorSearch('');
    setIsPromotorListOpen(false);
    setActivePromotorIndex(0);
    setNickname('');
    setDaysBetweenVisits('7');
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedNickname = nickname.trim();
    if (!trimmedNickname) {
      setErrorMessage('Informe o apelido da loja atendida.');
      return;
    }

    const selectedPromotor = promotors.find(
      (promotor) => getIdKey(promotor.id) === selectedPromotorKey
    );

    const parsedFrequency = daysBetweenVisits.trim() ? Number(daysBetweenVisits) : 7;
    if (!Number.isInteger(parsedFrequency) || parsedFrequency <= 0) {
      setErrorMessage('A frequencia deve ser um numero inteiro positivo de dias.');
      return;
    }

    setIsSaving(true);

    const result = await createAgendaEntry({
      ...(selectedClient ? { clientId: selectedClient.id } : {}),
      ...(selectedPromotor ? { promotorId: selectedPromotor.id } : {}),
      nickname: trimmedNickname,
      daysBetweenVisits: parsedFrequency,
    });

    startTransition(() => {
      setIsSaving(false);

      if (!result.success) {
        setErrorMessage(result.error ?? 'Nao foi possivel salvar o cliente na agenda.');
        return;
      }

      setSuccessMessage('Loja atendida adicionada com sucesso.');
      resetForm();
      router.push('/agenda');
      router.refresh();
    });
  };

  const filteredPromotors = filterPromotorOptions(promotors, promotorSearch);
  const selectedPromotor = promotors.find(
    (promotor) => getIdKey(promotor.id) === selectedPromotorKey
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_12px_30px_rgba(0,0,0,0.08)]"
    >
      <div>
        <h3 className="text-lg font-bold text-white">Cadastrar loja atendida</h3>
        <p className="mt-1 text-sm text-white/70">
          Informe um apelido. Cliente e promotor podem ficar sem vinculo.
        </p>
      </div>

      {promoterListMessage ? (
        <p className="mt-4 rounded-md border border-amber-300/40 bg-amber-950/50 px-3 py-2 text-sm text-amber-100">
          {promoterListMessage}
        </p>
      ) : null}

      <div className="mt-4 rounded-xl border border-white/10 bg-black/10 p-3">
        <div className="flex items-center gap-2">
          <Building2 size={16} />
          <label className="block text-sm font-medium text-white">
            Cliente vinculado
            <span className="ml-2 text-xs font-normal text-white/55">(Opcional)</span>
          </label>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-white/80">ID do cliente</label>
            <input
              type="text"
              inputMode="numeric"
              value={searchFilters.clientId}
              placeholder="Ex.: 123"
              className="h-8 w-full rounded-md border border-[#707070] bg-white/20 px-3 text-sm outline-none"
              onChange={(event) => handleFilterChange('clientId', event.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-white/80">Nome</label>
            <input
              type="text"
              value={searchFilters.clientName}
              placeholder="Razao social"
              className="h-8 w-full rounded-md border border-[#707070] bg-white/20 px-3 text-sm outline-none"
              onChange={(event) => handleFilterChange('clientName', event.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-white/80">Nome fantasia</label>
            <input
              type="text"
              value={searchFilters.fantasyName}
              placeholder="Nome fantasia"
              className="h-8 w-full rounded-md border border-[#707070] bg-white/20 px-3 text-sm outline-none"
              onChange={(event) => handleFilterChange('fantasyName', event.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-white/80">Documento</label>
              <input
                type="text"
                value={searchFilters.document}
                placeholder="CPF/CNPJ"
                className="h-8 w-full rounded-md border border-[#707070] bg-white/20 px-3 text-sm outline-none"
                onChange={(event) => handleFilterChange('document', event.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-white/80">Cidade</label>
              <input
                type="text"
                value={searchFilters.city}
                placeholder="Cidade"
                className="h-8 w-full rounded-md border border-[#707070] bg-white/20 px-3 text-sm outline-none"
                onChange={(event) => handleFilterChange('city', event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-white/80">Endereco</label>
            <input
              type="text"
              value={searchFilters.address}
              placeholder="Rua, avenida..."
              className="h-8 w-full rounded-md border border-[#707070] bg-white/20 px-3 text-sm outline-none"
              onChange={(event) => handleFilterChange('address', event.target.value)}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-white/80">Numero</label>
              <input
                type="text"
                value={searchFilters.addressNumber}
                placeholder="Numero"
                className="h-8 w-full rounded-md border border-[#707070] bg-white/20 px-3 text-sm outline-none"
                onChange={(event) => handleFilterChange('addressNumber', event.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-white/80">Bairro</label>
              <input
                type="text"
                value={searchFilters.neighborhood}
                placeholder="Bairro"
                className="h-8 w-full rounded-md border border-[#707070] bg-white/20 px-3 text-sm outline-none"
                onChange={(event) => handleFilterChange('neighborhood', event.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-white/80">Estado</label>
              <input
                type="text"
                value={searchFilters.state}
                placeholder="UF"
                maxLength={2}
                className="h-8 w-full rounded-md border border-[#707070] bg-white/20 px-3 text-sm uppercase outline-none"
                onChange={(event) => handleFilterChange('state', event.target.value.toUpperCase())}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleSearch}
            disabled={isSearching}
            className="flex h-9 items-center justify-center gap-2 rounded-md border border-[#707070] bg-white/20 px-4 text-sm font-medium text-white transition hover:bg-[#e9e9e4] disabled:cursor-not-allowed disabled:opacity-70"
          >
            <Search size={14} />
            {isSearching ? 'Buscando...' : 'Buscar cliente para vincular'}
          </button>

          {selectedClient && (
            <div className="rounded-md border border-[#009c6c] bg-[#009c6c]/15 p-3 text-sm">
              <p className="font-semibold text-white">{buildClientLabel(selectedClient)}</p>
              <p className="mt-1 text-xs text-white/75">{buildClientSubtitle(selectedClient)}</p>
              <p className="mt-1 text-xs text-white/75">Documento: {selectedClient.document}</p>
              <button
                type="button"
                onClick={() => setSelectedClient(null)}
                className="mt-3 text-xs font-medium text-white underline underline-offset-2"
              >
                Limpar selecao
              </button>
            </div>
          )}

          {searchResults.length > 0 && (
            <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border border-[#707070] bg-black/10 p-2">
              {searchResults.map((client) => {
                const isSelected = selectedClient?.id === client.id;

                return (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => setSelectedClient(client)}
                    className={`w-full rounded-md border px-3 py-2 text-left text-sm transition ${
                      isSelected
                        ? 'border-[#009c6c] bg-[#009c6c]/20'
                        : 'border-[#707070] bg-white/10 hover:bg-white/20'
                    }`}
                  >
                    <p className="font-semibold text-white">{buildClientLabel(client)}</p>
                    <p className="mt-1 text-xs text-white/80">{client.client_name}</p>
                    <p className="mt-1 text-xs text-white/70">{buildClientSubtitle(client)}</p>
                    <p className="mt-1 text-xs text-white/70">Documento: {client.document}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="agenda-promotor" className="block text-sm font-medium text-white">
            Promotor responsavel
            <span className="ml-2 text-xs font-normal text-white/55">(Opcional)</span>
          </label>
          <div className="relative">
          <input
            id="agenda-promotor"
            type="text"
            role="combobox"
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={isPromotorListOpen && promotors.length > 0}
            aria-controls="agenda-promotor-options"
            aria-activedescendant={
              isPromotorListOpen && filteredPromotors[activePromotorIndex]
                ? `agenda-promotor-option-${activePromotorIndex}`
                : undefined
            }
            value={selectedPromotor ? selectedPromotor.name : promotorSearch}
            placeholder={promotors.length ? 'Buscar por nome ou ID do promotor' : 'Sem promotor atribuido'}
            disabled={promotors.length === 0}
            className="h-10 w-full rounded-md border border-[#707070] bg-white/10 px-3 text-sm text-white outline-none placeholder:text-white/45 disabled:cursor-not-allowed disabled:opacity-60"
            onFocus={() => {
              setPromotorSearch('');
              setIsPromotorListOpen(true);
            }}
            onChange={(event) => {
              setPromotorSearch(event.target.value);
              setSelectedPromotorKey('');
              setActivePromotorIndex(0);
              setIsPromotorListOpen(true);
              setErrorMessage(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setIsPromotorListOpen(false);
                return;
              }

              if (event.key === 'ArrowDown' && filteredPromotors.length > 0) {
                event.preventDefault();
                setIsPromotorListOpen(true);
                setActivePromotorIndex((index) => (index + 1) % filteredPromotors.length);
              }

              if (event.key === 'ArrowUp' && filteredPromotors.length > 0) {
                event.preventDefault();
                setIsPromotorListOpen(true);
                setActivePromotorIndex(
                  (index) => (index - 1 + filteredPromotors.length) % filteredPromotors.length
                );
              }

              if (
                event.key === 'Enter' &&
                isPromotorListOpen &&
                filteredPromotors[activePromotorIndex]
              ) {
                event.preventDefault();
                const promotor = filteredPromotors[activePromotorIndex];
                setSelectedPromotorKey(getIdKey(promotor.id));
                setPromotorSearch('');
                setIsPromotorListOpen(false);
              }
            }}
          />
          {isPromotorListOpen && promotors.length > 0 ? (
            <ul
              id="agenda-promotor-options"
              role="listbox"
              aria-label="Promotores disponiveis"
              className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-white/20 bg-[#173746] p-1 shadow-xl"
            >
              {filteredPromotors.length > 0 ? (
                filteredPromotors.map((promotor, index) => (
                  <li
                    id={`agenda-promotor-option-${index}`}
                    key={getIdKey(promotor.id)}
                    role="option"
                    aria-selected={getIdKey(promotor.id) === selectedPromotorKey}
                  >
                    <button
                      type="button"
                      className={`w-full rounded-md px-3 py-2 text-left text-sm text-white transition ${
                        index === activePromotorIndex
                          ? 'bg-[#009c6c]/35'
                          : 'hover:bg-white/10'
                      }`}
                      onMouseEnter={() => setActivePromotorIndex(index)}
                      onClick={() => {
                        setSelectedPromotorKey(getIdKey(promotor.id));
                        setPromotorSearch('');
                        setIsPromotorListOpen(false);
                        setErrorMessage(null);
                      }}
                    >
                      <span className="block font-semibold">{promotor.name}</span>
                      <span className="mt-0.5 block text-xs text-white/70">
                        ID {String(promotor.id)}
                      </span>
                    </button>
                  </li>
                ))
              ) : (
                <li className="px-3 py-2 text-sm text-white/75">Nenhum promotor encontrado.</li>
              )}
            </ul>
          ) : null}
          <p className="mt-1 text-xs text-white/60">
            {selectedPromotor
              ? `Selecionado: ${selectedPromotor.name} • ID ${String(selectedPromotor.id)}`
              : 'Opcional. Digite parte do nome ou ID e escolha um promotor da lista.'}
          </p>
          {selectedPromotor ? (
            <button
              type="button"
              onClick={() => {
                setSelectedPromotorKey('');
                setPromotorSearch('');
                setErrorMessage(null);
              }}
              className="mt-1 text-xs font-medium text-white underline underline-offset-2"
            >
              Remover vínculo do promotor
            </button>
          ) : null}
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="agenda-frequency" className="block text-sm font-medium text-white">
            Frequencia entre visitas (dias)
            <span className="ml-2 text-xs font-normal text-white/55">(Padrao: 7 dias)</span>
          </label>
          <input
            id="agenda-frequency"
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={daysBetweenVisits}
            className="h-10 w-full rounded-md border border-[#707070] bg-white/10 px-3 text-sm text-white outline-none placeholder:text-white/45"
            onChange={(event) => setDaysBetweenVisits(event.target.value)}
          />
        </div>

        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="agenda-nickname" className="block text-sm font-medium text-white">
            Apelido da loja
            <RequiredAsterisk />
          </label>
          <input
            id="agenda-nickname"
            type="text"
            value={nickname}
            placeholder="Ex.: unidade Centro"
            className="h-10 w-full rounded-md border border-[#707070] bg-white/10 px-3 text-sm text-white outline-none placeholder:text-white/45"
            onChange={(event) => setNickname(event.target.value)}
            required
          />
        </div>
      </div>

      {errorMessage && (
        <p className="mt-4 rounded-md border border-[#ffb3b3]/30 bg-[#5c1f1f]/45 px-3 py-2 text-sm text-[#ffe2e2]">
          {errorMessage}
        </p>
      )}

      {successMessage && (
        <p className="mt-4 rounded-md border border-[#009c6c]/30 bg-[#063c2c] px-3 py-2 text-sm text-[#d4fff0]">
          {successMessage}
        </p>
      )}

      <div className="mt-5 flex justify-end">
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-md bg-[#009c6c] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#007a55] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? 'Salvando...' : 'Adicionar loja atendida'}
        </button>
      </div>
    </form>
  );
}
