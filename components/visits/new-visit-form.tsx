'use client';

import { Building2, CalendarDays, Search } from 'lucide-react';
import { startTransition, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';

import { createVisit, searchClients } from '@/lib/actions';

const productSuggestions = [
  'Cajazinha',
  'Abacaxi Cortelâ',
  'Tangerina c/ Acerola',
  'Pomar',
  'ICE Cajalemon',
  'ICE Chicletin',
  'ICE Limonada Rosa',
  'ICE Três Limões',
  'ICE Maracujá e Morango',
  'Licor Banoffe',
  'Licor Suspiro',
  'Licor Churros',
  'Licor Tortinha de Limão',
  'Licor Paçoca'
];

const packageOptions = ['unidade', 'pack', 'caixa'] as const;

type VisitFormValues = {
  establishment: string;
  date: string;
  products: {
    name: string;
    quantity: number;
    packageType: (typeof packageOptions)[number];
    expirationDate: string;
  }[];
};

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

function formatDateToDisplay(value: string) {
  if (!value) {
    return '';
  }

  const [year, month, day] = value.split('-');

  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

function ProductExpirationDateField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const expirationPickerRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="flex h-8 items-center rounded-md border border-[#707070] bg-white/20">
      <input
        type="text"
        inputMode="numeric"
        placeholder="Val. dd/mm/aaaa"
        value={value}
        className="h-full w-full bg-transparent px-3 text-center text-sm outline-none"
        onChange={(event) => onChange(event.target.value)}
      />

      <button
        type="button"
        onClick={() => expirationPickerRef.current?.showPicker?.()}
        className="flex h-full items-center justify-center border-l border-[#707070] px-2 text-white transition hover:bg-white/10"
        aria-label="Selecionar data de validade"
      >
        <CalendarDays size={14} />
      </button>

      <input
        ref={expirationPickerRef}
        type="date"
        className="sr-only"
        onChange={(event) => onChange(formatDateToDisplay(event.target.value))}
      />
    </div>
  );
}

function buildEstablishmentLabel(client: ClientSearchResult) {
  return client.fantasy_name || client.client_name;
}

function buildClientSubtitle(client: ClientSearchResult) {
  const addressParts = [
    client.address,
    client.address_number,
    client.neighborhood,
    client.city,
    client.state,
  ].filter(Boolean);

  return addressParts.join(', ');
}

export function NewVisitForm() {
  const router = useRouter();
  const visitDatePickerRef = useRef<HTMLInputElement | null>(null);
  const [modalMessage, setModalMessage] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<'success' | 'error' | null>(null);
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
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<ClientSearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    reset,
    formState: { isSubmitting },
  } = useForm<VisitFormValues>({
    defaultValues: {
      establishment: '',
      date: formatDateToDisplay(new Date().toISOString().split('T')[0]),
      products: [
        {
          name: '',
          quantity: 0,
          packageType: 'unidade',
          expirationDate: '',
        },
      ],
    },
  });

  const visitDate = useWatch({
    control,
    name: 'date',
  }) ?? '';
  const watchedProducts = useWatch({
    control,
    name: 'products',
  }) ?? [];

  const { fields, append } = useFieldArray({
    control,
    name: 'products',
  });

  const handleFilterChange = (field: keyof ClientSearchFilters, value: string) => {
    setSearchFilters((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSearchClients = async () => {
    setSearchError(null);
    setIsSearching(true);

    const result = await searchClients(searchFilters);

    startTransition(() => {
      setIsSearching(false);

      if (!result.success) {
        setSearchResults([]);
        setSearchError(result.error ?? 'Nao foi possivel buscar os estabelecimentos.');
        return;
      }

      setSearchResults(result.clients as ClientSearchResult[]);

      if (result.clients.length === 0) {
        setSearchError('Nenhum estabelecimento encontrado com esses filtros.');
      }
    });
  };

  const handleSelectClient = (client: ClientSearchResult) => {
    setSelectedClient(client);
    setValue('establishment', buildEstablishmentLabel(client), {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    setSearchError(null);
  };

  const onSubmit = async (data: VisitFormValues) => {
    const result = await createVisit(data);

    if (!result.success) {
      setModalMode('error');
      setModalMessage(result.error ?? 'Nao foi possivel salvar a visita.');
      return;
    }

    reset({
      establishment: '',
      date: formatDateToDisplay(new Date().toISOString().split('T')[0]),
      products: [
        {
          name: '',
          quantity: 0,
          packageType: 'unidade',
          expirationDate: '',
        },
      ],
    });

    setSelectedClient(null);
    setSearchResults([]);
    setSearchError(null);
    setModalMode('success');
    setModalMessage('Visita cadastrada com sucesso.');
  };

  return (
    <section className="flex w-full justify-center px-4 py-10">
      {modalMessage && modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center text-white shadow-xl">
            <h2 className="text-xl font-bold">
              {modalMode === 'success' ? 'Visita salva' : 'Erro ao salvar'}
            </h2>
            <p className="mt-3 text-sm">{modalMessage}</p>
            <div className="mt-5 flex justify-center gap-3">
              {modalMode === 'success' && (
                <button
                  type="button"
                  onClick={() => {
                    setModalMessage(null);
                    setModalMode(null);
                    router.push('/');
                    router.refresh();
                  }}
                  className="rounded-md bg-[#009c6c] px-4 py-2 font-semibold text-white transition hover:bg-[#007a55]"
                >
                  Ir para home
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setModalMessage(null);
                  setModalMode(null);
                }}
                className="rounded-md border border-[#707070] bg-white px-4 py-2 text-sm transition hover:bg-[#f3f3ef]"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="w-full max-w-xs rounded-[1.25rem] border border-[#5b5b5b] bg-white/10 px-3 py-6 text-[#ffffff] shadow-[0_12px_30px_rgba(0,0,0,0.08)]"
      >
        <div className="space-y-3">
          <div className="space-y-3 rounded-lg border border-[#cfcfc86a] bg-white/10 p-3">
            <div className="flex items-center gap-2">
              <Building2 size={16} />
              <label className="block text-sm font-medium">Buscar estabelecimento</label>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <input type="hidden" {...register('establishment')} />

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
                onClick={handleSearchClients}
                disabled={isSearching}
                className="flex h-9 items-center justify-center gap-2 rounded-md border border-[#707070] bg-white/20 px-4 text-sm font-medium text-white transition hover:bg-[#e9e9e4] disabled:cursor-not-allowed disabled:opacity-70"
              >
                <Search size={14} />
                {isSearching ? 'Buscando...' : 'Buscar estabelecimento'}
              </button>

              {selectedClient && (
                <div className="rounded-md border border-[#009c6c] bg-[#009c6c]/15 p-3 text-sm">
                  <p className="font-semibold text-white">{buildEstablishmentLabel(selectedClient)}</p>
                  <p className="mt-1 text-xs text-white/75">{buildClientSubtitle(selectedClient)}</p>
                  <p className="mt-1 text-xs text-white/75">Documento: {selectedClient.document}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedClient(null);
                      setValue('establishment', '', {
                        shouldDirty: true,
                        shouldTouch: true,
                        shouldValidate: true,
                      });
                    }}
                    className="mt-3 text-xs font-medium text-white underline underline-offset-2"
                  >
                    Limpar selecao
                  </button>
                </div>
              )}

              {searchError && <p className="text-sm text-[#ffd6d6]">{searchError}</p>}

              {searchResults.length > 0 && (
                <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border border-[#707070] bg-black/10 p-2">
                  {searchResults.map((client) => {
                    const isSelected = selectedClient?.id === client.id;

                    return (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() => handleSelectClient(client)}
                        className={`w-full rounded-md border px-3 py-2 text-left text-sm transition ${
                          isSelected
                            ? 'border-[#009c6c] bg-[#009c6c]/20'
                            : 'border-[#707070] bg-white/10 hover:bg-white/20'
                        }`}
                      >
                        <p className="font-semibold text-white">
                          {buildEstablishmentLabel(client)}
                        </p>
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

          <div className="space-y-1">
            <label className="block text-sm font-medium">Data</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                placeholder="dd/mm/aaaa"
                value={visitDate}
                className="h-8 w-full rounded-md border border-[#707070] bg-white/20 px-3 text-center text-sm outline-none"
                onChange={(event) => {
                  let v = event.target.value.replace(/\D/g, '');
                  if (v.length > 8) v = v.slice(0, 8);
                  if (v.length > 4) {
                    v = `${v.slice(0, 2)}/${v.slice(2, 4)}/${v.slice(4)}`;
                  } else if (v.length > 2) {
                    v = `${v.slice(0, 2)}/${v.slice(2)}`;
                  }
                  setValue('date', v, {
                    shouldDirty: true,
                    shouldTouch: true,
                    shouldValidate: true,
                  });
                }}
              />

              <button
                type="button"
                onClick={() => visitDatePickerRef.current?.showPicker?.()}
                className="rounded-md border border-[#707070] bg-white/20 p-2 text-white transition hover:bg-[#e9e9e4]"
                aria-label="Selecionar data da visita"
              >
                <CalendarDays size={16} />
              </button>

              <input
                ref={visitDatePickerRef}
                type="date"
                className="sr-only"
                onChange={(event) => {
                  setValue('date', formatDateToDisplay(event.target.value), {
                    shouldDirty: true,
                    shouldTouch: true,
                  });
                }}
              />
            </div>
          </div>
        </div>

        <div className="mt-7 space-y-3">
          {fields.map((field, productIndex) => (
            <div key={field.id} className="space-y-3 rounded-lg border border-[#cfcfc86a] bg-white/10 p-3">
              <div className="space-y-1">
                <label className="block text-sm font-medium">Produto</label>
                <input
                  list={`product-suggestions-${productIndex}`}
                  placeholder="Digite ou selecione um produto"
                  className="h-8 w-full rounded-md border border-[#707070] bg-white/20 px-3 text-center text-sm outline-none"
                  {...register(`products.${productIndex}.name`)}
                />
              </div>

              <datalist id={`product-suggestions-${productIndex}`}>
                {productSuggestions.map((product) => (
                  <option key={product} value={product} />
                ))}
              </datalist>

              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-1">
                  <label className="block text-sm font-medium">Quantidade</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Qtd"
                    className="h-8 w-full rounded-md border border-[#707070] bg-white/20 px-2 text-center text-sm outline-none"
                    {...register(`products.${productIndex}.quantity`, {
                      valueAsNumber: true,
                    })}
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-sm font-medium">Unidade de medida</label>
                  <select
                    className="h-8 w-full rounded-md border border-[#707070] bg-white/20 px-2 text-sm outline-none"
                    {...register(`products.${productIndex}.packageType`)}
                  >
                    {packageOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-sm font-medium">Validade</label>
                  <ProductExpirationDateField
                    value={watchedProducts[productIndex]?.expirationDate ?? ''}
                    onChange={(value) => {
                      let v = value.replace(/\D/g, '');
                      if (v.length > 8) v = v.slice(0, 8);
                      if (v.length > 4) {
                        v = `${v.slice(0, 2)}/${v.slice(2, 4)}/${v.slice(4)}`;
                      } else if (v.length > 2) {
                        v = `${v.slice(0, 2)}/${v.slice(2)}`;
                      }
                      setValue(`products.${productIndex}.expirationDate`, v, {
                        shouldDirty: true,
                        shouldTouch: true,
                        shouldValidate: true,
                      });
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex justify-start">
          <button
            type="button"
            onClick={() =>
              append({
                name: '',
                quantity: 0,
                packageType: 'unidade',
                expirationDate: '',
              })
            }
            className="rounded-md border border-[#707070] bg-white/20 px-3 py-1.5 text-sm text-white transition hover:bg-[#e9e9e4]"
          >
            + Adicionar produto
          </button>
        </div>

        <div className="mt-7 flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="min-w-28 rounded-md border border-[#707070] bg-white/20 px-4 py-1.5 text-sm text-white transition hover:bg-[#e9e9e4]"
          >
            {isSubmitting ? 'Salvando...' : 'Enviar'}
          </button>
        </div>
      </form>
    </section>
  );
}
