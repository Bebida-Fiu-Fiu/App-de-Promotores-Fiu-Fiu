'use client';

import { Building2, CalendarDays, ChevronDown, ImageIcon, Search, Trash2 } from 'lucide-react';
import NextImage from 'next/image';
import { startTransition, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';

import {
  createVisit,
  getSessionHomePath,
  saveVisitDraft,
  searchClients,
} from '@/lib/actions';
import { DeleteDraftButton } from '@/components/visits/delete-draft-button';

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
  'Licor Brigadeiro',
  'Licor Churros',
  'Licor Tortinha de Limão',
  'Licor Paçoca'
];

const productsWithIndefiniteExpiration = new Set([
  'Cajazinha',
  'Abacaxi Cortelâ',
  'Tangerina c/ Acerola',
  'Pomar',
]);

type PackageType = 'unidade' | 'pack';

function getDefaultPackageType(productName: string): PackageType {
  return productName.trim().toUpperCase().startsWith('ICE') ? 'pack' : 'unidade';
}

type VisitFormValues = {
  establishment: string;
  date: string;
  observation: string;
  beforeImage: string;
  afterImage: string;
  products: {
    name: string;
    quantity: number;
    packageType: PackageType;
    expirationDate: string;
  }[];
};

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
  id: number;
  nickname?: string;
  client_name: string;
  fantasy_name: string;
  document: string;
  city: string;
  address: string;
  address_number: string | null;
  neighborhood: string;
  state: string;
};

type InitialClientData = ClientSearchResult;

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

async function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('Nao foi possivel ler a imagem.'));
    reader.readAsDataURL(file);
  });
}

async function compressImageFile(file: File) {
  const dataUrl = await readFileAsDataUrl(file);

  return new Promise<string>((resolve, reject) => {
    const image = new window.Image();

    image.onload = () => {
      const maxDimension = 1280;
      const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement('canvas');

      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext('2d');

      if (!context) {
        resolve(dataUrl);
        return;
      }

      context.drawImage(image, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };

    image.onerror = () => reject(new Error('Nao foi possivel processar a imagem.'));
    image.src = dataUrl;
  });
}

function VisitImageField({
  inputId,
  label,
  value,
  onChange,
}: {
  inputId: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      setFieldError('Selecione um arquivo de imagem valido.');
      event.target.value = '';
      return;
    }

    setFieldError(null);
    setIsProcessing(true);

    try {
      const compressedImage = await compressImageFile(file);
      onChange(compressedImage);
    } catch {
      setFieldError('Nao foi possivel carregar essa imagem.');
    } finally {
      setIsProcessing(false);
      event.target.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <ImageIcon size={16} />
        <label htmlFor={inputId} className="block text-sm font-medium">
          {label}
        </label>
      </div>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => {
          void handleFileChange(event);
        }}
      />

      {value ? (
        <div className="overflow-hidden rounded-xl border border-[#707070] bg-black/15">
          <NextImage
            src={value}
            alt={`Preview ${label.toLowerCase()}`}
            width={800}
            height={500}
            unoptimized
            className="h-44 w-full object-cover"
          />
          <div className="flex items-center justify-between gap-2 border-t border-white/10 p-3">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={isProcessing}
              className="rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isProcessing ? 'Processando...' : 'Trocar imagem'}
            </button>
            <button
              type="button"
              onClick={() => onChange('')}
              className="rounded-md border border-[#ff8c8c]/30 bg-[#5c1f1f]/35 px-3 py-1.5 text-xs font-semibold text-[#ffd6d6] transition hover:bg-[#6f2626]/45"
            >
              Remover
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isProcessing}
          className="flex h-44 w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[#707070] bg-white/5 px-4 text-center transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <ImageIcon size={24} className="text-white/70" />
          <div>
            <p className="text-sm font-semibold text-white">
              {isProcessing ? 'Processando imagem...' : `Adicionar imagem ${label.toLowerCase()}`}
            </p>
            <p className="mt-1 text-xs text-white/65">Toque para selecionar e ver o preview</p>
          </div>
        </button>
      )}

      {fieldError && <p className="text-xs text-[#ffd6d6]">{fieldError}</p>}
    </div>
  );
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

function ProductSelectField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [isOpen]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredProducts = productSuggestions.filter((product) =>
    product.toLowerCase().includes(normalizedQuery)
  );

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex h-8 w-full items-center justify-between rounded-md border border-[#707070] bg-[#355061] px-3 text-sm text-white transition hover:bg-[#416174]"
      >
        <span className={value ? 'text-white' : 'text-white/60'}>
          {value || 'Selecione um produto'}
        </span>
        <ChevronDown size={14} className={`transition ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-20 rounded-md border border-[#707070] bg-[#0c2432] p-2 shadow-[0_18px_40px_rgba(0,0,0,0.35)]">
          <input
            type="text"
            value={query}
            placeholder="Pesquisar produto"
            className="h-8 w-full rounded-md border border-[#707070] bg-white/10 px-3 text-sm text-white outline-none placeholder:text-white/45"
            onChange={(event) => setQuery(event.target.value)}
          />

          <div className="mt-2 max-h-44 space-y-1 overflow-y-auto">
            {filteredProducts.length > 0 ? (
              filteredProducts.map((product) => (
                <button
                  key={product}
                  type="button"
                  onClick={() => {
                    onChange(product);
                    setQuery(product);
                    setIsOpen(false);
                  }}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm text-white transition ${
                    value === product ? 'bg-[#009c6c]/25' : 'bg-white/5 hover:bg-white/10'
                  }`}
                >
                  {product}
                </button>
              ))
            ) : (
              <p className="px-3 py-2 text-sm text-white/65">Nenhum produto encontrado.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function buildEstablishmentLabel(client: ClientSearchResult) {
  return client.nickname || client.fantasy_name || client.client_name;
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

function isCompleteDate(value: string) {
  return /^\d{2}\/\d{2}\/\d{4}$/.test(value.trim());
}

function hasIndefiniteExpiration(productName: string) {
  return productsWithIndefiniteExpiration.has(productName.trim());
}

function shouldSkipExpiration(product: VisitFormValues['products'][number] | undefined) {
  if (!product) {
    return false;
  }

  return hasIndefiniteExpiration(product.name) || Number(product.quantity) <= 0;
}

function getMissingInformationMessage(data: VisitFormValues) {
  if (!data.establishment.trim()) {
    return 'Selecione um estabelecimento antes de enviar a visita.';
  }

  if (!isCompleteDate(data.date)) {
    return 'Informe a data da visita no formato dd/mm/aaaa.';
  }

  const firstIncompleteProduct = data.products.findIndex((product) => {
    return (
      !product.name.trim() ||
      !Number.isFinite(product.quantity) ||
      product.quantity < 0 ||
      (!shouldSkipExpiration(product) && !isCompleteDate(product.expirationDate))
    );
  });

  if (firstIncompleteProduct >= 0) {
    const productNumber = firstIncompleteProduct + 1;
    const product = data.products[firstIncompleteProduct];

    if (!product.name.trim()) {
      return `Preencha o nome do produto ${productNumber}.`;
    }

    if (!Number.isFinite(product.quantity) || product.quantity < 0) {
      return `Informe uma quantidade zero ou maior para o produto ${productNumber}.`;
    }

    return `Informe a validade do produto ${productNumber} no formato dd/mm/aaaa.`;
  }

  return null;
}

type NewVisitFormProps = {
  visitId?: number;
  isDraft?: boolean;
  initialData?: Partial<VisitFormValues>;
  initialClient?: InitialClientData | null;
};

export function NewVisitForm({
  visitId,
  isDraft = false,
  initialData,
  initialClient = null,
}: NewVisitFormProps) {
  const router = useRouter();
  const visitDatePickerRef = useRef<HTMLInputElement | null>(null);
  const [modalMessage, setModalMessage] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<'success' | 'error' | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
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
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<ClientSearchResult | null>(initialClient);
  const [isSearching, setIsSearching] = useState(false);
  const [clientSearchMode, setClientSearchMode] = useState<'agenda' | 'general'>('agenda');
  const [showAdvancedAgendaSearch, setShowAdvancedAgendaSearch] = useState(false);
  const [homePath, setHomePath] = useState('/promotor');

  const {
    register,
    control,
    handleSubmit,
    getValues,
    setValue,
    reset,
    formState: { isSubmitting },
  } = useForm<VisitFormValues>({
    defaultValues: {
      establishment: initialData?.establishment ?? '',
      date: initialData?.date ?? formatDateToDisplay(new Date().toISOString().split('T')[0]),
      observation: initialData?.observation ?? '',
      beforeImage: initialData?.beforeImage ?? '',
      afterImage: initialData?.afterImage ?? '',
      products: initialData?.products?.length
        ? initialData.products
        : [
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
  const watchedEstablishment = useWatch({
    control,
    name: 'establishment',
  }) ?? '';
  const watchedBeforeImage = useWatch({
    control,
    name: 'beforeImage',
  }) ?? '';
  const watchedAfterImage = useWatch({
    control,
    name: 'afterImage',
  }) ?? '';
  const watchedProducts = useWatch({
    control,
    name: 'products',
  }) ?? [];

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'products',
  });

  useEffect(() => {
    let isMounted = true;

    void getSessionHomePath().then((path) => {
      if (isMounted && path) {
        setHomePath(path);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleFilterChange = (field: keyof ClientSearchFilters, value: string) => {
    setFormError(null);
    setSearchFilters((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSearchModeChange = (mode: 'agenda' | 'general') => {
    setClientSearchMode(mode);
    setShowAdvancedAgendaSearch(false);
    setSearchResults([]);
    setSearchError(null);
    setSelectedClient(null);
    setValue('establishment', '', {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  };

  const handleSearchClients = async () => {
    setSearchError(null);
    setIsSearching(true);

    const result = await searchClients(searchFilters, clientSearchMode);

    startTransition(() => {
      setIsSearching(false);

      if (!result.success) {
        setSearchResults([]);
        setSearchError(result.error ?? 'Nao foi possivel buscar os estabelecimentos.');
        return;
      }

      setSearchResults(result.clients as ClientSearchResult[]);

      if (result.clients.length === 0) {
        setSearchError(
          clientSearchMode === 'agenda'
            ? 'Nenhum cliente encontrado na agenda com esses filtros.'
            : 'Nenhum estabelecimento encontrado na busca geral com esses filtros.'
        );
      }
    });
  };

  const handleSelectClient = (client: ClientSearchResult) => {
    setSelectedClient(client);
    setFormError(null);
    setValue('establishment', buildEstablishmentLabel(client), {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    setSearchError(null);
  };

  const onSubmit = async (data: VisitFormValues) => {
    const missingInformationMessage = getMissingInformationMessage(data);

    if (missingInformationMessage) {
      setFormError(missingInformationMessage);
      return;
    }

    setFormError(null);
    const result = await createVisit(data, visitId);

    if (!result.success) {
      setModalMode('error');
      setModalMessage(result.error ?? 'Nao foi possivel salvar a visita.');
      return;
    }

    reset({
      establishment: '',
      date: formatDateToDisplay(new Date().toISOString().split('T')[0]),
      observation: '',
      beforeImage: '',
      afterImage: '',
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
    setModalMode('success');
    setModalMessage(visitId ? 'Visita atualizada com sucesso.' : 'Visita cadastrada com sucesso.');
  };

  const handleSaveDraft = async () => {
    setFormError(null);

    const result = await saveVisitDraft(getValues(), visitId);

    if (!result.success) {
      setModalMode('error');
      setModalMessage(result.error ?? 'Nao foi possivel salvar o rascunho.');
      return;
    }

    if (result.visitId) {
      router.push(`/visitas/${result.visitId}/editar`);
      router.refresh();
      return;
    }

    router.refresh();
  };

  return (
    <section className="flex w-full justify-center px-4 py-10">
      {modalMessage && modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0c2432] p-6 text-center text-white shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
            <h2 className="text-xl font-bold">
              {modalMode === 'success' ? 'Visita salva' : 'Erro ao salvar'}
            </h2>
            <p className="mt-3 text-sm text-white/85">{modalMessage}</p>
            <div className="mt-5 flex justify-center gap-3">
              {modalMode === 'success' && (
                <button
                  type="button"
                  onClick={() => {
                    setModalMessage(null);
                    setModalMode(null);
                    router.push(homePath);
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
                className="rounded-md border border-white/20 bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/20"
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

              <div className="space-y-2">
                <label className="block text-xs font-medium text-white/80">Modo de pesquisa</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleSearchModeChange('agenda')}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      clientSearchMode === 'agenda'
                        ? 'border-[#009c6c] bg-[#009c6c] text-white'
                        : 'border-white/15 bg-white/5 text-white/75 hover:bg-white/10'
                    }`}
                  >
                    Agenda
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSearchModeChange('general')}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      clientSearchMode === 'general'
                        ? 'border-[#009c6c] bg-[#009c6c] text-white'
                        : 'border-white/15 bg-white/5 text-white/75 hover:bg-white/10'
                    }`}
                  >
                    Geral
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-white/80">ID do cliente</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={searchFilters.clientId}
                  placeholder="Ex.: 123"
                  className="h-8 w-full rounded-md border border-[#707070] bg-white/20 px-3 text-sm outline-none"
                  onChange={(event) =>
                    handleFilterChange('clientId', event.target.value.replace(/\D/g, ''))
                  }
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-white/80">
                  {clientSearchMode === 'agenda' ? 'Apelido' : 'Nome'}
                </label>
                <input
                  type="text"
                  value={searchFilters.clientName}
                  placeholder={clientSearchMode === 'agenda' ? 'Apelido salvo na agenda' : 'Razao social'}
                  className="h-8 w-full rounded-md border border-[#707070] bg-white/20 px-3 text-sm outline-none"
                  onChange={(event) => handleFilterChange('clientName', event.target.value)}
                />
              </div>

              {clientSearchMode === 'agenda' && (
                <button
                  type="button"
                  onClick={() => setShowAdvancedAgendaSearch((current) => !current)}
                  className="rounded-md border border-white/20 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
                >
                  {showAdvancedAgendaSearch ? 'Ocultar mais informações' : 'Pesquisar com mais informações'}
                </button>
              )}

              {(clientSearchMode === 'general' || showAdvancedAgendaSearch) && (
                <>
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
                </>
              )}

              <button
                type="button"
                onClick={handleSearchClients}
                disabled={isSearching}
                className="flex h-9 items-center justify-center gap-2 rounded-md border border-[#707070] bg-white/20 px-4 text-sm font-medium text-white transition hover:bg-[#e9e9e4] disabled:cursor-not-allowed disabled:opacity-70"
              >
                <Search size={14} />
                {isSearching ? 'Buscando...' : 'Buscar estabelecimento'}
              </button>

              {(selectedClient || watchedEstablishment) && (
                <div className="rounded-md border border-[#009c6c] bg-[#009c6c]/15 p-3 text-sm">
                  <p className="font-semibold text-white">
                    {selectedClient ? buildEstablishmentLabel(selectedClient) : watchedEstablishment}
                  </p>
                  {selectedClient && (
                    <>
                      <p className="mt-1 text-xs text-white/75">{buildClientSubtitle(selectedClient)}</p>
                      <p className="mt-1 text-xs text-white/75">Documento: {selectedClient.document}</p>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedClient(null);
                      setFormError(null);
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
                  setFormError(null);
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
                  setFormError(null);
                  setValue('date', formatDateToDisplay(event.target.value), {
                    shouldDirty: true,
                    shouldTouch: true,
                  });
                }}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="visit-observation" className="block text-sm font-medium">
              Observacao
            </label>
            <textarea
              id="visit-observation"
              rows={4}
              placeholder="Digite uma observacao sobre a visita"
              className="w-full rounded-md border border-[#707070] bg-white/20 px-3 py-2 text-sm outline-none"
              {...register('observation', {
                onChange: () => setFormError(null),
              })}
            />
          </div>

          <div className="space-y-3 rounded-lg border border-[#cfcfc86a] bg-white/10 p-3">
            <input type="hidden" {...register('beforeImage')} />
            <input type="hidden" {...register('afterImage')} />

            <div className="grid grid-cols-1 gap-3">
              <VisitImageField
                inputId="visit-before-image"
                label="Imagem antes"
                value={watchedBeforeImage}
                onChange={(value) => {
                  setFormError(null);
                  setValue('beforeImage', value, {
                    shouldDirty: true,
                    shouldTouch: true,
                    shouldValidate: true,
                  });
                }}
              />

              <VisitImageField
                inputId="visit-after-image"
                label="Imagem depois"
                value={watchedAfterImage}
                onChange={(value) => {
                  setFormError(null);
                  setValue('afterImage', value, {
                    shouldDirty: true,
                    shouldTouch: true,
                    shouldValidate: true,
                  });
                }}
              />
            </div>
          </div>
        </div>

        <div className="mt-7 space-y-3">
          {fields.map((field, productIndex) => (
            <div key={field.id} className="space-y-3 rounded-lg border border-[#cfcfc86a] bg-white/10 p-3">
              <div className="flex items-end justify-between gap-3">
                <div className="flex-1 space-y-1">
                  <label className="block text-sm font-medium">Produto</label>
                  <input type="hidden" {...register(`products.${productIndex}.name`)} />
                  <ProductSelectField
                    value={watchedProducts[productIndex]?.name ?? ''}
                    onChange={(value) => {
                      setFormError(null);
                      setValue(`products.${productIndex}.name`, value, {
                        shouldDirty: true,
                        shouldTouch: true,
                        shouldValidate: true,
                      });
                      setValue(`products.${productIndex}.packageType`, getDefaultPackageType(value), {
                        shouldDirty: true,
                        shouldTouch: true,
                        shouldValidate: true,
                      });
                    }}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setFormError(null);

                    if (fields.length === 1) {
                      setValue('products', [
                        {
                          name: '',
                          quantity: 0,
                          packageType: 'unidade',
                          expirationDate: '',
                        },
                      ], {
                        shouldDirty: true,
                        shouldTouch: true,
                        shouldValidate: true,
                      });
                      return;
                    }

                    remove(productIndex);
                  }}
                  className="inline-flex h-8 items-center justify-center rounded-md border border-[#ff8c8c]/30 bg-[#5c1f1f]/35 px-3 text-sm text-[#ffd6d6] transition hover:bg-[#6f2626]/45"
                  aria-label={`Excluir produto ${productIndex + 1}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>

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
                      onChange: (event) => {
                        setFormError(null);

                        if (Number(event.target.value) <= 0) {
                          setValue(`products.${productIndex}.expirationDate`, '', {
                            shouldDirty: true,
                            shouldTouch: true,
                            shouldValidate: true,
                          });
                        }
                      },
                    })}
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-sm font-medium">Unidade de medida</label>
                  <input type="hidden" {...register(`products.${productIndex}.packageType`)} />
                  <div className="flex h-8 items-center rounded-md border border-[#707070] bg-[#355061] px-3 text-sm text-white/85">
                    {watchedProducts[productIndex]?.packageType ?? 'unidade'}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-sm font-medium">Validade</label>
                  {hasIndefiniteExpiration(watchedProducts[productIndex]?.name ?? '') ? (
                    <div className="flex h-8 items-center rounded-md border border-[#707070] bg-[#355061] px-3 text-sm text-white/85">
                      Validade indeterminada
                    </div>
                  ) : Number(watchedProducts[productIndex]?.quantity ?? 0) <= 0 ? (
                    <div className="flex h-8 items-center rounded-md border border-[#707070] bg-[#355061] px-3 text-sm text-white/85">
                      Sem validade
                    </div>
                  ) : (
                    <ProductExpirationDateField
                      value={watchedProducts[productIndex]?.expirationDate ?? ''}
                      onChange={(value) => {
                        setFormError(null);
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
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex justify-start">
          <button
            type="button"
            onClick={() => {
              setFormError(null);
              append({
                name: '',
                quantity: 0,
                packageType: 'unidade',
                expirationDate: '',
              });
            }}
            className="rounded-md border border-[#707070] bg-white/20 px-3 py-1.5 text-sm text-white transition hover:bg-[#e9e9e4]"
          >
            + Adicionar produto
          </button>
        </div>

        {formError && (
          <p className="mt-4 rounded-md border border-[#ffb3b3]/30 bg-[#5c1f1f]/45 px-3 py-2 text-sm text-[#ffe2e2]">
            {formError}
          </p>
        )}

        <div className="mt-7 flex flex-wrap justify-end gap-3">
          {visitId && isDraft && (
            <DeleteDraftButton
              visitId={visitId}
              className="min-w-28 rounded-md border border-[#ff8c8c]/30 bg-[#5c1f1f]/35 px-4 py-1.5 text-sm font-semibold text-[#ffd6d6] transition hover:bg-[#6f2626]/45"
            />
          )}
          <button
            type="button"
            onClick={() => void handleSaveDraft()}
            className="min-w-28 rounded-md border border-white/20 bg-white/10 px-4 py-1.5 text-sm text-white transition hover:bg-white/20"
          >
            Salvar rascunho
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="min-w-28 rounded-md border border-[#707070] bg-white/20 px-4 py-1.5 text-sm text-white transition hover:bg-[#e9e9e4]"
          >
            {isSubmitting ? 'Salvando...' : isDraft ? 'Publicar visita' : visitId ? 'Salvar alterações' : 'Enviar'}
          </button>
        </div>
      </form>
    </section>
  );
}
