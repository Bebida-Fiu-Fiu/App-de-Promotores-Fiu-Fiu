'use client';

import { Building2, Search } from 'lucide-react';
import { startTransition, useState } from 'react';
import { useRouter } from 'next/navigation';

import { createAgendaEntry, searchClients } from '@/lib/actions';

type ClientSearchFilters = {
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
  id: number;
  client_name: string;
  fantasy_name: string;
  document: string;
  city: string;
  address: string;
  address_number: string | null;
  neighborhood: string;
  state: string;
};

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

export function AddAgendaClientForm() {
  const router = useRouter();
  const [searchFilters, setSearchFilters] = useState<ClientSearchFilters>({
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
  const [nickname, setNickname] = useState('');
  const [notes, setNotes] = useState('');
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
    setNickname('');
    setNotes('');
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!selectedClient) {
      setErrorMessage('Preencha o campo obrigatório "Buscar cliente na base" e selecione um cliente.');
      return;
    }

    setIsSaving(true);

    const result = await createAgendaEntry({
      clientId: selectedClient.id,
      nickname,
      notes,
    });

    startTransition(() => {
      setIsSaving(false);

      if (!result.success) {
        setErrorMessage(result.error ?? 'Nao foi possivel salvar o cliente na agenda.');
        return;
      }

      setSuccessMessage('Cliente adicionado na agenda com sucesso.');
      resetForm();
      router.push('/agenda');
      router.refresh();
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_12px_30px_rgba(0,0,0,0.08)]"
    >
      <div>
        <h3 className="text-lg font-bold text-white">Adicionar cliente na agenda</h3>
        <p className="mt-1 text-sm text-white/70">
          Busque o cliente com os mesmos filtros da visita e defina como ele deve aparecer na agenda.
        </p>
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-black/10 p-3">
        <div className="flex items-center gap-2">
          <Building2 size={16} />
          <label className="block text-sm font-medium text-white">
            Buscar cliente na base
            <RequiredAsterisk />
          </label>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3">
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
            {isSearching ? 'Buscando...' : 'Buscar cliente'}
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

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-white">
            Apelido
          </label>
          <input
            type="text"
            value={nickname}
            placeholder="Ex.: foco distribuicao, loja principal"
            className="h-10 w-full rounded-md border border-[#707070] bg-white/10 px-3 text-sm text-white outline-none placeholder:text-white/45"
            onChange={(event) => setNickname(event.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-white">
            Observacao
            <span className="ml-2 text-xs font-normal text-white/55">(Opcional)</span>
          </label>
          <input
            type="text"
            value={notes}
            placeholder="Ex.: visita importante"
            className="h-10 w-full rounded-md border border-[#707070] bg-white/10 px-3 text-sm text-white outline-none placeholder:text-white/45"
            onChange={(event) => setNotes(event.target.value)}
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
          {isSaving ? 'Salvando...' : 'Adicionar cliente'}
        </button>
      </div>
    </form>
  );
}
