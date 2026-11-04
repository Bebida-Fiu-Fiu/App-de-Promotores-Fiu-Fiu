'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Building2, CalendarDays, ImageIcon, Search, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { DeleteDraftButton } from '@/components/visits/delete-draft-button';
import { formatVisitCopyText } from '@/lib/visit-copy';
import { VisitImageLightbox } from '@/components/visits/visit-image-lightbox';
import { VisitSuccessDialog } from '@/components/visits/visit-success-dialog';
import { createVisit, getSessionHomePath, saveVisitDraft, searchClients } from '@/lib/actions';
import { isAcceptedImageFile, mapFilesToUploadPayload, optimizeVisitImageFile } from '@/lib/file-utils';
import type { OpaqueId, PromotorVisitImageArrayInput, PromotorVisitProduct } from '@/types/promotor';

const PRODUCT_OPTIONS = [
  'Cajazinha',
  'Abacaxi Cortelã',
  'Tangerina com Acerola',
  'Pomar',
  'Pitaya com Melancia',
  'ICE Cajalemon',
  'ICE Chicletin',
  'ICE Limonada Rosa',
  'ICE Três Limões',
  'ICE Maracujá e Morango',
  'Licor Suspiro',
  'Licor Churros',
  'Licor Banoffe',
  'Licor Brigadeiro',
  'Licor Tortinha de Limão',
  'Licor Paçoca',
] as const;

const INDEFINITE_EXPIRATION_LABEL = 'indefinido';
const MAX_IMAGES_PER_CATEGORY = 5;
const MAX_IMAGE_SIZE_IN_BYTES = 10 * 1024 * 1024;

const INDEFINITE_EXPIRATION_PRODUCTS = new Set(
  [
    'Cajazinha',
    'Abacaxi Cortelã',
    'Tangerina com Acerola',
    'Pomar',
    'Pitaya com Melancia',
  ].map((productName) => productName.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase())
);

function getProductUnit(productName: string): 'unidade' | 'pack' {
  return productName.trim().toUpperCase().startsWith('ICE') ? 'pack' : 'unidade';
}

function normalizeProductName(productName: string) {
  return productName.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function isIndefiniteExpirationValue(value: string) {
  return value.trim().toLowerCase() === INDEFINITE_EXPIRATION_LABEL;
}

function shouldUseIndefiniteExpiration(productName: string, quantity: number) {
  if (quantity === 0 && productName.trim()) {
    return true;
  }

  return INDEFINITE_EXPIRATION_PRODUCTS.has(normalizeProductName(productName));
}

const visitProductSchema = z.object({
  name: z.string().trim(),
  quantity: z.preprocess((value) => {
    if (value === '' || value === null || value === undefined) {
      return 0;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : value;
  }, z.number().min(0, 'Informe uma quantidade valida.')),
  unit: z.enum(['unidade', 'pack', 'caixa']),
  expirationDate: z.string(),
});

const visitFormSchema = z.object({
  establishmentId: z.preprocess((value) => {
    if (value === '' || value === null || value === undefined) {
      return null;
    }

    if (typeof value === 'string') {
      return value;
    }

    return value;
  }, z.union([z.number().int().nonnegative(), z.string().min(1)]).nullable()),
  establishmentLabel: z.string().trim(),
  visitDate: z.string(),
  observation: z.string().trim().max(1000, 'A observacao deve ter no maximo 1000 caracteres.'),
  products: z.array(visitProductSchema),
});

type VisitFormInput = z.input<typeof visitFormSchema>;
type VisitFormValues = z.output<typeof visitFormSchema>;

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

type VisitImageState = {
  id: string;
  previewUrl: string;
  existingValue: string | null;
  file: File | null;
};

type VisitImageGalleryState = VisitImageState[];

type NewVisitFormProps = {
  visitId?: number;
  isDraft?: boolean;
  userFullName: string | null;
  initialData?: Partial<VisitFormValues> & {
    beforeImages?: string[];
    afterImages?: string[];
  };
  initialClient?: InitialClientData | null;
};

function formatDateInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }

  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function getTodayDisplayDate() {
  const today = new Date();
  const day = String(today.getDate()).padStart(2, '0');
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const year = today.getFullYear();

  return `${day}/${month}/${year}`;
}

function parseDisplayDate(value: string) {
  const trimmedValue = value.trim();

  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(trimmedValue)) {
    return null;
  }

  const [day, month, year] = trimmedValue.split('/').map(Number);

  if (!day || !month || !year) {
    return null;
  }

  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function isValidDisplayDate(value: string) {
  return parseDisplayDate(value) !== null;
}

function displayDateToIso(value: string) {
  const parsedDate = parseDisplayDate(value);

  if (!parsedDate) {
    return null;
  }

  const day = String(parsedDate.getDate()).padStart(2, '0');
  const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
  const year = parsedDate.getFullYear();

  return `${year}-${month}-${day}`;
}

function isoDateToDisplay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return '';
  }

  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
}

function isExpirationWithinVisitWindow(visitDate: string, expirationDate: string) {
  const parsedVisitDate = parseDisplayDate(visitDate);
  const parsedExpirationDate = parseDisplayDate(expirationDate);

  if (!parsedVisitDate || !parsedExpirationDate) {
    return false;
  }

  const maxExpirationDate = addMonths(parsedVisitDate, 18);

  return parsedExpirationDate.getTime() <= maxExpirationDate.getTime();
}

function buildEstablishmentLabel(client: ClientSearchResult) {
  return client.nickname || client.fantasy_name || client.client_name;
}

function buildClientSubtitle(client: ClientSearchResult) {
  return [
    client.address,
    client.address_number,
    client.neighborhood,
    client.city,
    client.state,
  ]
    .filter(Boolean)
    .join(', ');
}

function buildClientSecondaryLabel(client: ClientSearchResult) {
  return client.fantasy_name?.trim() || client.client_name;
}

function isBlankProduct(product: VisitFormValues['products'][number]) {
  return (
    !product.name.trim() &&
    Number(product.quantity || 0) === 0 &&
    product.unit === 'unidade' &&
    !product.expirationDate
  );
}

function isCompleteProduct(product: VisitFormValues['products'][number]) {
  return Boolean(
    product.name.trim() &&
    Number.isFinite(product.quantity) &&
    product.quantity >= 0 &&
    product.unit &&
    (isIndefiniteExpirationValue(product.expirationDate) || isValidDisplayDate(product.expirationDate))
  );
}

function getFriendlyApiMessage(error: string | null | undefined) {
  if (!error) {
    return 'Nao foi possivel salvar a visita. Tente novamente.';
  }

  const normalizedError = error.toLowerCase();

  if (
    normalizedError.includes('body exceeded') ||
    normalizedError.includes('413') ||
    normalizedError.includes('payload too large')
  ) {
    return 'As fotos selecionadas ainda estao muito pesadas para envio. Tente menos imagens por vez ou arquivos menores.';
  }

  if (normalizedError.includes('unauthorized') || normalizedError.includes('sessao')) {
    return 'Sua sessao expirou. Entre novamente para continuar.';
  }

  if (normalizedError.includes('establishment')) {
    return 'Selecione um estabelecimento valido antes de continuar.';
  }

  if (normalizedError.includes('visitdate') || normalizedError.includes('data')) {
    return 'Revise a data da visita e tente novamente.';
  }

  if (normalizedError.includes('product')) {
    return 'Revise os produtos informados e tente novamente.';
  }

  if (normalizedError.includes('image') || normalizedError.includes('imagem')) {
    return 'Nao foi possivel processar uma das imagens. Tente selecionar o arquivo novamente.';
  }

  return error;
}

function buildImageItemId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createImageState(previewUrl: string, existingValue: string | null, file: File | null): VisitImageState {
  return {
    id: buildImageItemId(),
    previewUrl,
    existingValue,
    file,
  };
}

function buildInitialGalleryState(images: string[] | undefined) {
  return (Array.isArray(images) ? images : [])
    .filter((imageUrl) => Boolean(imageUrl))
    .map((imageUrl) => createImageState(imageUrl, imageUrl, null));
}

type SignedUploadResponse = {
  filename: string;
  contentType: string;
  uploadUrl: string;
  fileUrl: string;
  key: string;
};

function buildVisitSubmitFormData(params: {
  establishment: OpaqueId | null;
  visitDate: string | null;
  products: PromotorVisitProduct[];
  observation: string | null;
  beforeImages: string[];
  afterImages: string[];
  isDraft: boolean;
}) {
  const formData = new FormData();
  const payload = {
    establishment: params.establishment,
    visitDate: params.visitDate,
    products: params.products,
    observation: params.observation,
    isDraft: params.isDraft,
    beforeImages: params.beforeImages,
    afterImages: params.afterImages,
  };

  formData.append('payload', JSON.stringify(payload));

  return formData;
}

async function submitVisitFormData(formData: FormData, visitId?: number) {
  const endpoint = visitId ? `/api/promotor/visit/${visitId}` : '/api/promotor/visit';
  const response = await fetch(endpoint, {
    method: visitId ? 'PUT' : 'POST',
    body: formData,
  });
  const payload = await response.json().catch(() => null);

  if (
    payload &&
    typeof payload === 'object' &&
    'success' in payload &&
    typeof payload.success === 'boolean'
  ) {
    return payload as {
      success: boolean;
      error?: string;
      visitId?: number;
      shouldRedirectToLogin?: boolean;
    };
  }

  return {
    success: false,
    error: response.ok ? 'Nao foi possivel salvar a visita.' : `Erro ${response.status}.`,
  };
}

async function requestSignedUploads(params: {
  files: File[];
  imageType: 'before' | 'after';
  visitDate: string | null;
}) {
  const response = await fetch('/api/promotor/visit/uploads', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      imageType: params.imageType,
      visitDate: params.visitDate,
      files: params.files.map((file) => ({
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
        size: file.size,
      })),
    }),
  });
  const payload = await response.json().catch(() => null);

  if (!payload || typeof payload !== 'object' || !('success' in payload)) {
    throw new Error('Nao foi possivel preparar o upload das imagens.');
  }

  const typedPayload = payload as {
    success: boolean;
    error?: string;
    uploads?: SignedUploadResponse[];
    shouldRedirectToLogin?: boolean;
  };

  if (!typedPayload.success) {
    const error = new Error(typedPayload.error || 'Nao foi possivel preparar o upload das imagens.');
    (error as Error & { shouldRedirectToLogin?: boolean }).shouldRedirectToLogin =
      typedPayload.shouldRedirectToLogin;
    throw error;
  }

  return typedPayload.uploads ?? [];
}

async function uploadGalleryFiles(
  images: VisitImageGalleryState,
  imageType: 'before' | 'after',
  visitDate: string | null
) {
  const existingImages = images
    .map((image) => image.existingValue)
    .filter((image): image is string => Boolean(image));
  const newFiles = images
    .map((image) => image.file)
    .filter((file): file is File => file instanceof File);

  if (newFiles.length === 0) {
    return existingImages;
  }

  const optimizedFiles: File[] = [];

  for (const file of newFiles) {
    optimizedFiles.push(await optimizeVisitImageFile(file));
  }

  const uploads = await requestSignedUploads({
    files: optimizedFiles,
    imageType,
    visitDate,
  });

  if (uploads.length !== optimizedFiles.length) {
    throw new Error('Nao foi possivel preparar todas as imagens para upload.');
  }

  for (let index = 0; index < optimizedFiles.length; index += 1) {
    const file = optimizedFiles[index];
    const upload = uploads[index];
    const uploadResponse = await fetch(upload.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type || upload.contentType || 'application/octet-stream',
      },
      body: file,
    });

    if (!uploadResponse.ok) {
      throw new Error('Nao foi possivel enviar uma das imagens selecionadas.');
    }
  }

  return [...existingImages, ...uploads.map((upload) => upload.fileUrl)];
}

async function mapGalleryToLegacyPayload(images: VisitImageGalleryState): Promise<PromotorVisitImageArrayInput> {
  const existingImages = images
    .map((image) => image.existingValue)
    .filter((image): image is string => Boolean(image));
  const newFiles = images
    .map((image) => image.file)
    .filter((file): file is File => file instanceof File);
  const uploadedFiles = await mapFilesToUploadPayload(newFiles);

  return [...existingImages, ...uploadedFiles];
}

function shouldUseLegacyVisitFallback(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const normalizedMessage = error.message.trim().toLowerCase();

  return normalizedMessage === 'not found' || normalizedMessage.includes('404');
}

function VisitImageGalleryField({
  idPrefix,
  label,
  helperText,
  images,
  onChange,
}: {
  idPrefix: string;
  label: string;
  helperText: string;
  images: VisitImageGalleryState;
  onChange: (nextValue: VisitImageGalleryState) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);

    if (selectedFiles.length === 0) {
      return;
    }

    const invalidFile = selectedFiles.find((file) => !isAcceptedImageFile(file));

    if (invalidFile) {
      setFieldError('Selecione um arquivo de imagem valido.');
      event.target.value = '';
      return;
    }

    if (images.length + selectedFiles.length > MAX_IMAGES_PER_CATEGORY) {
      setFieldError(`Voce pode adicionar no maximo ${MAX_IMAGES_PER_CATEGORY} fotos em ${label.toLowerCase()}.`);
      event.target.value = '';
      return;
    }

    const oversizedFile = selectedFiles.find((file) => file.size > MAX_IMAGE_SIZE_IN_BYTES);

    if (oversizedFile) {
      setFieldError('Cada foto deve ter no maximo 10 MB.');
      event.target.value = '';
      return;
    }

    setFieldError(null);
    onChange([
      ...images,
      ...selectedFiles.map((selectedFile) =>
        createImageState(URL.createObjectURL(selectedFile), null, selectedFile)
      ),
    ]);

    event.target.value = '';
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <ImageIcon size={16} />
        <label htmlFor={`${idPrefix}-input`} className="text-sm font-medium text-white">
          {label}
        </label>
      </div>

      <input
        ref={inputRef}
        id={`${idPrefix}-input`}
        type="file"
        accept="image/*,.avif,.bmp,.cr2,.cr3,.dng,.gif,.heic,.heif,.ico,.jfif,.jpe,.jpeg,.jpg,.nef,.nrw,.orf,.pef,.png,.psd,.raf,.raw,.rw2,.sr2,.srw,.svg,.tif,.tiff,.webp"
        multiple
        className="sr-only"
        onChange={handleFileChange}
      />

      <div className="rounded-2xl border border-white/12 bg-white/5 p-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex h-32 w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/20 bg-white/5 px-4 text-center transition hover:bg-white/10"
        >
          <ImageIcon size={22} className="text-white/65" />
          <div>
            <p className="text-sm font-semibold text-white">Adicionar fotos de {label.toLowerCase()}</p>
            <p className="mt-1 text-xs text-white/60">{helperText}</p>
          </div>
        </button>

        {images.length > 0 ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {images.map((image, index) => (
              <div key={image.id} className="overflow-hidden rounded-2xl border border-white/12 bg-white/5">
                <button
                  type="button"
                  onClick={() => setSelectedImageIndex(index)}
                  className="block w-full overflow-hidden"
                  aria-label={`Abrir foto de ${label.toLowerCase()} ${index + 1}`}
                >
                  <Image
                    src={image.previewUrl}
                    alt={`${label} ${index + 1}`}
                    width={1200}
                    height={900}
                    unoptimized
                    className="h-32 w-full object-cover transition hover:scale-[1.02]"
                  />
                </button>
                <div className="flex items-center justify-between gap-2 border-t border-white/10 p-3">
                  <span className="text-xs font-medium text-white/70">
                    {image.file ? 'Nova foto' : 'Foto salva'}
                  </span>
                  <button
                    type="button"
                    onClick={() => onChange(images.filter((currentImage) => currentImage.id !== image.id))}
                    className="rounded-xl border border-[#ff8c8c]/30 bg-[#5c1f1f]/35 px-3 py-2 text-xs font-semibold text-[#ffd6d6] transition hover:bg-[#6f2626]/45"
                  >
                    Remover
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-xs text-white/55">
            Nenhuma foto adicionada para {label.toLowerCase()}.
          </p>
        )}
      </div>

      {fieldError && <p className="text-xs text-red-200">{fieldError}</p>}

      <VisitImageLightbox
        images={images.map((image) => image.previewUrl)}
        altPrefix={`Imagem de ${label.toLowerCase()}`}
        selectedIndex={selectedImageIndex}
        onClose={() => setSelectedImageIndex(null)}
        onSelect={setSelectedImageIndex}
      />
    </div>
  );
}

export function NewVisitForm({
  visitId,
  isDraft = false,
  userFullName,
  initialData,
  initialClient = null,
}: NewVisitFormProps) {
  const router = useRouter();
  const visitDatePickerRef = useRef<HTMLInputElement | null>(null);
  const beforeImagesRef = useRef<VisitImageGalleryState>([]);
  const afterImagesRef = useRef<VisitImageGalleryState>([]);
  const [homePath, setHomePath] = useState('/promotor');
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitMode, setSubmitMode] = useState<'draft' | 'final' | null>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [visitConfirmationText, setVisitConfirmationText] = useState('');
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
  const [isSearching, setIsSearching] = useState(false);
  const [clientSearchMode, setClientSearchMode] = useState<'agenda' | 'general'>('agenda');
  const [showAdvancedAgendaSearch, setShowAdvancedAgendaSearch] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientSearchResult | null>(initialClient);
  const [beforeImages, setBeforeImages] = useState<VisitImageGalleryState>(
    buildInitialGalleryState(initialData?.beforeImages)
  );
  const [afterImages, setAfterImages] = useState<VisitImageGalleryState>(
    buildInitialGalleryState(initialData?.afterImages)
  );

  const defaultValues = useMemo<VisitFormInput>(() => ({
    establishmentId: initialData?.establishmentId ?? initialClient?.id ?? null,
    establishmentLabel:
      initialData?.establishmentLabel ??
      (initialClient ? buildEstablishmentLabel(initialClient) : ''),
    visitDate: initialData?.visitDate ?? getTodayDisplayDate(),
    observation: initialData?.observation ?? '',
    products: initialData?.products ?? [],
  }), [initialClient, initialData]);

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<VisitFormInput, unknown, VisitFormValues>({
    resolver: zodResolver(visitFormSchema),
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'products',
  });

  const watchedEstablishment = useWatch({
    control,
    name: 'establishmentLabel',
  });
  const watchedProducts = useWatch({
    control,
    name: 'products',
  });
  const watchedVisitDate = useWatch({
    control,
    name: 'visitDate',
  });
  const watchedEstablishmentId = useWatch({
    control,
    name: 'establishmentId',
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

  useEffect(() => {
    beforeImagesRef.current = beforeImages;
  }, [beforeImages]);

  useEffect(() => {
    afterImagesRef.current = afterImages;
  }, [afterImages]);

  useEffect(() => {
    return () => {
      beforeImagesRef.current.forEach((image) => {
        if (image.file && image.previewUrl) {
          URL.revokeObjectURL(image.previewUrl);
        }
      });

      afterImagesRef.current.forEach((image) => {
        if (image.file && image.previewUrl) {
          URL.revokeObjectURL(image.previewUrl);
        }
      });
    };
  }, []);

  const syncGalleryState = (
    setGallery: Dispatch<SetStateAction<VisitImageGalleryState>>,
    nextImages: VisitImageGalleryState
  ) => {
    setGallery((currentImages) => {
      currentImages.forEach((image) => {
        const stillExists = nextImages.some((nextImage) => nextImage.id === image.id);

        if (!stillExists && image.file && image.previewUrl) {
          URL.revokeObjectURL(image.previewUrl);
        }
      });

      return nextImages;
    });
  };

  const handleBeforeImagesChange = (nextImages: VisitImageGalleryState) => {
    syncGalleryState(setBeforeImages, nextImages);
  };

  const handleAfterImagesChange = (nextImages: VisitImageGalleryState) => {
    syncGalleryState(setAfterImages, nextImages);
  };

  useEffect(() => {
    watchedProducts?.forEach((product, index) => {
      if (!product) {
        return;
      }

      const shouldUseIndefinite = shouldUseIndefiniteExpiration(
        product.name ?? '',
        Number(product.quantity ?? 0)
      );
      const currentExpiration = product.expirationDate ?? '';

      if (shouldUseIndefinite && currentExpiration !== INDEFINITE_EXPIRATION_LABEL) {
        setValue(`products.${index}.expirationDate`, INDEFINITE_EXPIRATION_LABEL, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }

      if (
        !shouldUseIndefinite &&
        isIndefiniteExpirationValue(currentExpiration)
      ) {
        setValue(`products.${index}.expirationDate`, '', {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
    });
  }, [setValue, watchedProducts]);

  const handleFilterChange = (field: keyof ClientSearchFilters, value: string) => {
    setSearchFilters((current) => ({
      ...current,
      [field]: value,
    }));
    setSearchError(null);
    setFormError(null);
  };

  const handleSearchModeChange = (mode: 'agenda' | 'general') => {
    setClientSearchMode(mode);
    setShowAdvancedAgendaSearch(false);
    setSearchError(null);
    setSearchResults([]);
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
    setValue('establishmentId', client.id, { shouldDirty: true, shouldValidate: true });
    setValue('establishmentLabel', buildEstablishmentLabel(client), {
      shouldDirty: true,
      shouldValidate: true,
    });
    setSearchError(null);
    setFormError(null);
  };

  const clearSelectedClient = () => {
    setSelectedClient(null);
    setValue('establishmentId', null, { shouldDirty: true, shouldValidate: true });
    setValue('establishmentLabel', '', { shouldDirty: true, shouldValidate: true });
    setFormError(null);
  };

  const validateBeforeSubmit = (values: VisitFormValues, mode: 'draft' | 'final') => {
    if (beforeImages.length > MAX_IMAGES_PER_CATEGORY || afterImages.length > MAX_IMAGES_PER_CATEGORY) {
      return `Envie no maximo ${MAX_IMAGES_PER_CATEGORY} fotos em cada categoria.`;
    }

    const oversizedImage = [...beforeImages, ...afterImages].find(
      (image) => image.file && image.file.size > MAX_IMAGE_SIZE_IN_BYTES
    );

    if (oversizedImage) {
      return 'Cada foto deve ter no maximo 10 MB.';
    }

    if (mode === 'final' && !values.establishmentId) {
      return 'Selecione um estabelecimento antes de enviar a visita.';
    }

    if (mode === 'final' && !values.visitDate) {
      return 'Selecione a data da visita.';
    }

    if (mode === 'final' && !isValidDisplayDate(values.visitDate)) {
      return 'Informe uma data da visita valida no formato dd/mm/aaaa.';
    }

    const firstPartialProduct = values.products.findIndex(
      (product) => !isBlankProduct(product) && !isCompleteProduct(product)
    );

    if (mode === 'final' && firstPartialProduct >= 0) {
      return `Complete os dados do produto ${firstPartialProduct + 1} antes de enviar a visita.`;
    }

    const invalidExpirationProduct = values.products.findIndex(
      (product) =>
        !isBlankProduct(product) &&
        isCompleteProduct(product) &&
        !isIndefiniteExpirationValue(product.expirationDate) &&
        !isExpirationWithinVisitWindow(values.visitDate, product.expirationDate)
    );

    if (invalidExpirationProduct >= 0) {
      return `A validade do produto ${invalidExpirationProduct + 1} nao pode passar de 18 meses apos a data da visita.`;
    }

    return null;
  };

  const onSubmit = async (values: VisitFormValues, mode: 'draft' | 'final') => {
    setFormError(null);
    setSuccessMessage(null);

    const validationMessage = validateBeforeSubmit(values, mode);

    if (validationMessage) {
      setFormError(validationMessage);
      return;
    }

    const visitDateIso = values.visitDate ? displayDateToIso(values.visitDate) : null;
    const normalizedProducts = values.products
      .filter((product) => isCompleteProduct(product))
      .map((product) => ({
        ...product,
        expirationDate: isIndefiniteExpirationValue(product.expirationDate)
          ? INDEFINITE_EXPIRATION_LABEL
          : (displayDateToIso(product.expirationDate) ?? product.expirationDate),
      })) as PromotorVisitProduct[];
    const observation = values.observation.trim() || null;

    try {
      let result:
        | {
          success: boolean;
          error?: string;
          visitId?: number;
          shouldRedirectToLogin?: boolean;
        };

      try {
        const uploadedBeforeImages = await uploadGalleryFiles(beforeImages, 'before', visitDateIso);
        const uploadedAfterImages = await uploadGalleryFiles(afterImages, 'after', visitDateIso);
        const payload = {
          establishment: values.establishmentId,
          visitDate: visitDateIso,
          products: normalizedProducts,
          observation,
          beforeImages: uploadedBeforeImages,
          afterImages: uploadedAfterImages,
          isDraft: mode === 'draft',
        };

        result = await submitVisitFormData(buildVisitSubmitFormData(payload), visitId);
      } catch (error) {
        if (!shouldUseLegacyVisitFallback(error)) {
          throw error;
        }

        const legacyPayload = {
          establishment: values.establishmentId,
          visitDate: visitDateIso,
          products: normalizedProducts,
          observation,
          beforeImages: await mapGalleryToLegacyPayload(beforeImages),
          afterImages: await mapGalleryToLegacyPayload(afterImages),
          isDraft: mode === 'draft',
        } as const;

        result =
          mode === 'draft'
            ? await saveVisitDraft(legacyPayload, visitId)
            : await createVisit(legacyPayload, visitId);
      }

      if (!result.success) {
        setFormError(getFriendlyApiMessage(result.error));

        if (result.shouldRedirectToLogin) {
          router.replace('/login');
        }

        return;
      }

      const successCopy =
        mode === 'draft' ? 'Rascunho salvo com sucesso.' : 'Visita salva com sucesso.';
      setSuccessMessage(successCopy);

      const nextVisitId = result.visitId ?? visitId;

      if (!nextVisitId && mode === 'final') {
        reset({
          establishmentId: null,
          establishmentLabel: '',
          visitDate: getTodayDisplayDate(),
          observation: '',
          products: [],
        });
        setSelectedClient(null);
        handleBeforeImagesChange([]);
        handleAfterImagesChange([]);
        return;
      }

      if (mode === 'final' && nextVisitId) {
        const confirmationText = formatVisitCopyText({
          visitDate: values.visitDate,
          userFullName,
          establishment: values.establishmentLabel,
          establishmentId: values.establishmentId,
          products: values.products.filter((product) => isCompleteProduct(product)),
        });
        setVisitConfirmationText(confirmationText);
        setShowSuccessDialog(true);
        return;
      }

      if (nextVisitId && mode === 'draft') {
        router.push(`/visitas/${nextVisitId}`);
        router.refresh();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : null;
      if (
        error &&
        typeof error === 'object' &&
        'shouldRedirectToLogin' in error &&
        (error as { shouldRedirectToLogin?: boolean }).shouldRedirectToLogin
      ) {
        router.replace('/login');
      }
      setFormError(getFriendlyApiMessage(errorMessage));
    }
  };

  return (
    <section className="mx-auto w-full max-w-4xl px-4 pb-12 pt-8">
      <div className="rounded-[2rem] border border-white/10 bg-white/6 p-6 shadow-2xl shadow-black/20 backdrop-blur md:p-8">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#7fe7c5]">
            {visitId ? 'Editar visita' : 'Nova visita'}
          </p>
          <h1 className="mt-3 text-3xl font-black text-white">
            {isDraft ? 'Continuar rascunho' : visitId ? 'Atualizar visita' : 'Registrar visita'}
          </h1>
          <p className="mt-3 text-sm leading-6 text-white/72">
            Preencha os dados abaixo para salvar a visita do promotor como rascunho ou envio final.
          </p>
        </div>

        <form
          onSubmit={handleSubmit((values) => onSubmit(values, submitMode ?? 'final'))}
          className="mt-8 space-y-6"
        >
          {successMessage && (
            <div className="rounded-2xl border border-emerald-300/35 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
              {successMessage}
            </div>
          )}

          <div className="rounded-2xl border border-white/20 bg-[#3b5160] px-3 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <div className="flex items-center gap-2 text-white">
              <Building2 size={16} className="text-white/85" />
              <h2 className="text-sm font-semibold">Buscar estabelecimento</h2>
            </div>

            <div className="mt-4">
              <p className="text-xs font-semibold text-white/90">Modo de pesquisa</p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSearchModeChange('agenda')}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    clientSearchMode === 'agenda'
                      ? 'border-[#00c48c] bg-[#00c48c] text-white'
                      : 'border-white/25 bg-[#566977] text-white/85 hover:bg-[#617583]'
                  }`}
                >
                  Agenda
                </button>
                <button
                  type="button"
                  onClick={() => handleSearchModeChange('general')}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    clientSearchMode === 'general'
                      ? 'border-[#00c48c] bg-[#00c48c] text-white'
                      : 'border-white/25 bg-[#566977] text-white/85 hover:bg-[#617583]'
                  }`}
                >
                  Geral
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="text-sm font-semibold text-white">ID do cliente</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={searchFilters.clientId}
                  onChange={(event) => handleFilterChange('clientId', event.target.value)}
                  className="mt-2 block h-11 w-full rounded-lg border border-transparent bg-[#738390] px-4 text-base text-white placeholder:text-white/60 outline-none transition focus:border-[#00c48c] focus:ring-2 focus:ring-[#00c48c]/20"
                  placeholder="Ex.: 123"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-white">
                  {clientSearchMode === 'agenda' ? 'Apelido' : 'Nome'}
                </label>
                <input
                  type="text"
                  value={searchFilters.clientName}
                  onChange={(event) => handleFilterChange('clientName', event.target.value)}
                  className="mt-2 block h-11 w-full rounded-lg border border-transparent bg-[#738390] px-4 text-base text-white placeholder:text-white/60 outline-none transition focus:border-[#00c48c] focus:ring-2 focus:ring-[#00c48c]/20"
                  placeholder={clientSearchMode === 'agenda' ? 'Apelido salvo na agenda' : 'Razao social'}
                />
              </div>

              {clientSearchMode === 'agenda' && (
                <button
                  type="button"
                  onClick={() => setShowAdvancedAgendaSearch((current) => !current)}
                  className="flex h-11 w-full items-center justify-center rounded-lg border border-white/25 bg-[#4f6371] px-4 text-sm font-semibold text-white transition hover:bg-[#5a6e7c]"
                >
                  {showAdvancedAgendaSearch ? 'Ocultar mais informações' : 'Pesquisar com mais informações'}
                </button>
              )}

              {(clientSearchMode === 'general' || showAdvancedAgendaSearch) && (
                <>
                  <div>
                    <label className="text-sm font-semibold text-white">Nome fantasia</label>
                    <input
                      type="text"
                      value={searchFilters.fantasyName}
                      onChange={(event) => handleFilterChange('fantasyName', event.target.value)}
                      className="mt-2 block h-11 w-full rounded-lg border border-transparent bg-[#738390] px-4 text-base text-white placeholder:text-white/60 outline-none transition focus:border-[#00c48c] focus:ring-2 focus:ring-[#00c48c]/20"
                      placeholder="Nome fantasia"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-semibold text-white">Documento</label>
                      <input
                        type="text"
                        value={searchFilters.document}
                        onChange={(event) => handleFilterChange('document', event.target.value)}
                        className="mt-2 block h-11 w-full rounded-lg border border-transparent bg-[#738390] px-4 text-base text-white placeholder:text-white/60 outline-none transition focus:border-[#00c48c] focus:ring-2 focus:ring-[#00c48c]/20"
                        placeholder="CPF/CNPJ"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-white">Cidade</label>
                      <input
                        type="text"
                        value={searchFilters.city}
                        onChange={(event) => handleFilterChange('city', event.target.value)}
                        className="mt-2 block h-11 w-full rounded-lg border border-transparent bg-[#738390] px-4 text-base text-white placeholder:text-white/60 outline-none transition focus:border-[#00c48c] focus:ring-2 focus:ring-[#00c48c]/20"
                        placeholder="Cidade"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-white">Endereco</label>
                    <input
                      type="text"
                      value={searchFilters.address}
                      onChange={(event) => handleFilterChange('address', event.target.value)}
                      className="mt-2 block h-11 w-full rounded-lg border border-transparent bg-[#738390] px-4 text-base text-white placeholder:text-white/60 outline-none transition focus:border-[#00c48c] focus:ring-2 focus:ring-[#00c48c]/20"
                      placeholder="Rua, avenida..."
                    />
                  </div>

                  <div className="grid grid-cols-[1fr_1fr_0.8fr] gap-3">
                    <div>
                      <label className="text-sm font-semibold text-white">Numero</label>
                      <input
                        type="text"
                        value={searchFilters.addressNumber}
                        onChange={(event) => handleFilterChange('addressNumber', event.target.value)}
                        className="mt-2 block h-11 w-full rounded-lg border border-transparent bg-[#738390] px-4 text-base text-white placeholder:text-white/60 outline-none transition focus:border-[#00c48c] focus:ring-2 focus:ring-[#00c48c]/20"
                        placeholder="Numero"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-white">Bairro</label>
                      <input
                        type="text"
                        value={searchFilters.neighborhood}
                        onChange={(event) => handleFilterChange('neighborhood', event.target.value)}
                        className="mt-2 block h-11 w-full rounded-lg border border-transparent bg-[#738390] px-4 text-base text-white placeholder:text-white/60 outline-none transition focus:border-[#00c48c] focus:ring-2 focus:ring-[#00c48c]/20"
                        placeholder="Bairro"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-white">Estado</label>
                      <input
                        type="text"
                        maxLength={2}
                        value={searchFilters.state}
                        onChange={(event) => handleFilterChange('state', event.target.value.toUpperCase())}
                        className="mt-2 block h-11 w-full rounded-lg border border-transparent bg-[#738390] px-4 text-base text-white placeholder:text-white/60 uppercase outline-none transition focus:border-[#00c48c] focus:ring-2 focus:ring-[#00c48c]/20"
                        placeholder="UF"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={handleSearchClients}
              disabled={isSearching}
              className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#738390] px-5 text-sm font-semibold text-white transition hover:bg-[#80919e] disabled:cursor-not-allowed disabled:opacity-70"
            >
              <Search size={16} />
              {isSearching ? 'Buscando...' : 'Buscar estabelecimento'}
            </button>

            {(selectedClient || watchedEstablishment) && (
              <div className="mt-4 rounded-2xl border border-[#009c6c]/35 bg-[#009c6c]/10 p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-[#009c6c]/20 p-2 text-[#c8ffe7]">
                    <Building2 size={18} />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-white">
                      {selectedClient ? buildEstablishmentLabel(selectedClient) : watchedEstablishment}
                    </p>
                    {selectedClient && (
                      <>
                        <p className="mt-1 text-sm text-white/75">{buildClientSecondaryLabel(selectedClient)}</p>
                        <p className="mt-1 text-xs text-white/65">{buildClientSubtitle(selectedClient)}</p>
                        <p className="mt-1 text-xs text-white/65">Documento: {selectedClient.document}</p>
                      </>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={clearSelectedClient}
                  className="mt-3 text-xs font-semibold text-white underline underline-offset-2"
                >
                  Limpar selecao
                </button>
              </div>
            )}

            {searchError && <p className="mt-4 text-sm text-red-200">{searchError}</p>}

            {searchResults.length > 0 && (
              <div className="mt-4 max-h-72 space-y-2 overflow-y-auto rounded-2xl border border-white/10 bg-black/10 p-2">
                {searchResults.map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => handleSelectClient(client)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                      selectedClient?.id === client.id
                        ? 'border-[#009c6c] bg-[#009c6c]/15'
                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <p className="font-semibold text-white">{buildEstablishmentLabel(client)}</p>
                    <p className="mt-1 text-sm text-white/75">{buildClientSecondaryLabel(client)}</p>
                    <p className="mt-1 text-xs text-white/65">{buildClientSubtitle(client)}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label htmlFor="visitDate" className="text-sm font-semibold text-white">
                Data da visita
              </label>
              <div className="relative">
                <input
                  id="visitDate"
                  type="text"
                  inputMode="numeric"
                  placeholder="dd/mm/aaaa"
                  className="mt-2 block w-full rounded-2xl border border-white/12 bg-white px-4 py-3 pr-12 text-gray-900 shadow-sm outline-none transition focus:border-[#009c6c] focus:ring-4 focus:ring-[#009c6c]/15"
                  {...register('visitDate', {
                    onChange: (event) => {
                      setValue('visitDate', formatDateInput(event.target.value), {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    },
                  })}
                />
                <button
                  type="button"
                  onClick={() => visitDatePickerRef.current?.showPicker?.()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 text-[#0f2d3d] transition hover:bg-[#0f2d3d]/8"
                  aria-label="Abrir calendario da data da visita"
                >
                  <CalendarDays size={18} />
                </button>
                <input
                  ref={visitDatePickerRef}
                  type="date"
                  tabIndex={-1}
                  className="pointer-events-none absolute h-0 w-0 opacity-0"
                  value={displayDateToIso(watchedVisitDate ?? '') ?? ''}
                  onChange={(event) => {
                    setValue('visitDate', isoDateToDisplay(event.target.value), {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                  }}
                />
              </div>
              {errors.visitDate && <p className="mt-2 text-sm text-red-200">{errors.visitDate.message}</p>}
            </div>

            <div>
              <label className="text-sm font-semibold text-white">Estabelecimento selecionado</label>
              <input
                type="text"
                readOnly
                value={watchedEstablishment || ''}
                className="mt-2 block w-full rounded-2xl border border-white/12 bg-white/80 px-4 py-3 text-gray-700 shadow-sm outline-none"
                placeholder="Selecione um estabelecimento na busca acima"
              />
            </div>
          </div>

          <div>
            <label htmlFor="observation" className="text-sm font-semibold text-white">
              Observacao
            </label>
            <textarea
              id="observation"
              rows={4}
              className="mt-2 block w-full rounded-2xl border border-white/12 bg-white px-4 py-3 text-gray-900 shadow-sm outline-none transition focus:border-[#009c6c] focus:ring-4 focus:ring-[#009c6c]/15"
              placeholder="Adicione observacoes relevantes sobre a visita"
              {...register('observation')}
            />
            {errors.observation && (
              <p className="mt-2 text-sm text-red-200">{errors.observation.message}</p>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <VisitImageGalleryField
              idPrefix="before-images"
              label="Antes"
              helperText="Selecione zero, uma ou varias fotos do ambiente antes da visita."
              images={beforeImages}
              onChange={handleBeforeImagesChange}
            />
            <VisitImageGalleryField
              idPrefix="after-images"
              label="Depois"
              helperText="Selecione zero, uma ou varias fotos do ambiente depois da visita."
              images={afterImages}
              onChange={handleAfterImagesChange}
            />
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div>
              <h2 className="text-lg font-bold text-white">Produtos</h2>
              <p className="mt-1 text-sm text-white/65">
                Adicione os produtos encontrados na visita. A lista comeca vazia por padrao.
              </p>
            </div>

            <div className="mt-4 space-y-4">
              {fields.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/15 px-4 py-6 text-sm text-white/65">
                  Nenhum produto adicionado ainda.
                </div>
              ) : (
                fields.map((field, index) => (
                  <div key={field.id} className="rounded-2xl border border-white/10 bg-black/10 p-4">
                    {(() => {
                      const currentProduct = watchedProducts?.[index];
                      const usesIndefiniteExpiration = shouldUseIndefiniteExpiration(
                        currentProduct?.name ?? '',
                        Number(currentProduct?.quantity ?? 0)
                      );

                      return (
                        <>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-white">Produto {index + 1}</p>
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="inline-flex h-9 items-center justify-center rounded-xl border border-[#ff8c8c]/30 bg-[#5c1f1f]/35 px-3 text-sm text-[#ffd6d6] transition hover:bg-[#6f2626]/45"
                        aria-label={`Remover produto ${index + 1}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="text-sm font-semibold text-white">Nome</label>
                        <select
                          className="mt-2 block w-full rounded-2xl border border-white/12 bg-white px-4 py-3 text-gray-900 shadow-sm outline-none transition focus:border-[#009c6c] focus:ring-4 focus:ring-[#009c6c]/15"
                          {...register(`products.${index}.name`, {
                            onChange: (event) => {
                              setValue(`products.${index}.unit`, getProductUnit(event.target.value), {
                                shouldDirty: true,
                                shouldValidate: true,
                              });
                            },
                          })}
                        >
                          <option value="">Selecione um produto</option>
                          {PRODUCT_OPTIONS.map((productName) => (
                            <option key={productName} value={productName}>
                              {productName}
                            </option>
                          ))}
                        </select>
                        {errors.products?.[index]?.name && (
                          <p className="mt-2 text-sm text-red-200">{errors.products[index]?.name?.message}</p>
                        )}
                      </div>

                      <div>
                        <label className="text-sm font-semibold text-white">Quantidade</label>
                        <input
                          type="number"
                          min="0"
                          className="mt-2 block w-full rounded-2xl border border-white/12 bg-white px-4 py-3 text-gray-900 shadow-sm outline-none transition focus:border-[#009c6c] focus:ring-4 focus:ring-[#009c6c]/15"
                          {...register(`products.${index}.quantity`)}
                        />
                        {errors.products?.[index]?.quantity && (
                          <p className="mt-2 text-sm text-red-200">{errors.products[index]?.quantity?.message}</p>
                        )}
                      </div>

                      <div>
                        <label className="text-sm font-semibold text-white">Unidade</label>
                        <input
                          readOnly
                          value={getProductUnit(watchedProducts?.[index]?.name ?? '')}
                          className="mt-2 block w-full rounded-2xl border border-white/12 bg-white/80 px-4 py-3 text-gray-700 shadow-sm outline-none"
                        />
                        <input type="hidden" {...register(`products.${index}.unit`)} />
                      </div>

                      <div>
                        <label className="text-sm font-semibold text-white">Validade</label>
                        <div className="relative">
                          <input
                            type="text"
                            inputMode={usesIndefiniteExpiration ? undefined : 'numeric'}
                            readOnly={usesIndefiniteExpiration}
                            placeholder={usesIndefiniteExpiration ? INDEFINITE_EXPIRATION_LABEL : 'dd/mm/aaaa'}
                            className={`mt-2 block w-full rounded-2xl border border-white/12 px-4 py-3 pr-12 shadow-sm outline-none transition ${
                              usesIndefiniteExpiration
                                ? 'bg-white/80 text-gray-700'
                                : 'bg-white text-gray-900 focus:border-[#009c6c] focus:ring-4 focus:ring-[#009c6c]/15'
                            }`}
                            {...register(`products.${index}.expirationDate`, {
                              onChange: (event) => {
                                if (usesIndefiniteExpiration) {
                                  setValue(`products.${index}.expirationDate`, INDEFINITE_EXPIRATION_LABEL, {
                                    shouldDirty: true,
                                    shouldValidate: true,
                                  });
                                  return;
                                }

                                setValue(`products.${index}.expirationDate`, formatDateInput(event.target.value), {
                                  shouldDirty: true,
                                  shouldValidate: true,
                                });
                              },
                            })}
                          />
                          <button
                            type="button"
                            disabled={usesIndefiniteExpiration}
                            onClick={() => {
                              const picker = document.getElementById(`product-expiration-${field.id}`) as HTMLInputElement | null;
                              picker?.showPicker?.();
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 text-[#0f2d3d] transition hover:bg-[#0f2d3d]/8 disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label={`Abrir calendario da validade do produto ${index + 1}`}
                          >
                            <CalendarDays size={18} />
                          </button>
                          <input
                            id={`product-expiration-${field.id}`}
                            type="date"
                            tabIndex={-1}
                            className="pointer-events-none absolute h-0 w-0 opacity-0"
                            value={displayDateToIso(watchedProducts?.[index]?.expirationDate ?? '') ?? ''}
                            onChange={(event) => {
                              if (usesIndefiniteExpiration) {
                                return;
                              }

                              setValue(`products.${index}.expirationDate`, isoDateToDisplay(event.target.value), {
                                shouldDirty: true,
                                shouldValidate: true,
                              });
                            }}
                          />
                        </div>
                        {errors.products?.[index]?.expirationDate && (
                          <p className="mt-2 text-sm text-red-200">
                            {errors.products[index]?.expirationDate?.message}
                          </p>
                        )}
                        {usesIndefiniteExpiration && (
                          <p className="mt-2 text-xs text-white/55">
                            A validade fica como indefinido para este produto ou quando a quantidade e 0.
                          </p>
                        )}
                      </div>
                    </div>
                        </>
                      );
                    })()}
                  </div>
                ))
              )}
            </div>

            <button
              type="button"
              onClick={() =>
                append({
                  name: '',
                  quantity: 0,
                  unit: 'unidade',
                  expirationDate: '',
                })
              }
              className="mt-4 block w-full rounded-2xl border border-white/15 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Adicionar produto
            </button>

            {watchedProducts?.length > 0 && (
              <p className="mt-4 text-xs text-white/55">
                Todos os produtos enviados precisam ter nome, quantidade, unidade e validade. Nos sabores especiais e quando a quantidade e 0, a validade sera indefinido.
              </p>
            )}
          </div>

          <input
            type="hidden"
            value={typeof watchedEstablishmentId === 'number' ? String(watchedEstablishmentId) : ''}
            {...register('establishmentId')}
          />
          <input type="hidden" {...register('establishmentLabel')} />

          <div className="flex flex-wrap justify-end gap-3">
            {visitId && isDraft && (
              <DeleteDraftButton
                visitId={visitId}
                redirectTo={homePath}
                className="rounded-xl border border-[#ff8c8c]/30 bg-[#5c1f1f]/35 px-4 py-3 text-sm font-semibold text-[#ffd6d6] transition hover:bg-[#6f2626]/45"
              />
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              onClick={() => setSubmitMode('draft')}
              className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting && submitMode === 'draft' ? 'Salvando rascunho...' : 'Salvar rascunho'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              onClick={() => setSubmitMode('final')}
              className="rounded-xl bg-[#009c6c] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_30px_rgba(0,156,108,0.28)] transition hover:bg-[#00b57d] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting && submitMode === 'final'
                ? 'Enviando...'
                : isDraft
                  ? 'Publicar visita'
                  : visitId
                    ? 'Salvar alteracoes'
                    : 'Enviar visita'}
            </button>
          </div>

          {formError && (
            <div className="rounded-2xl border border-red-300/35 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {formError}
            </div>
          )}
        </form>
      </div>
      <VisitSuccessDialog
        isOpen={showSuccessDialog}
        homePath={homePath}
        visitText={visitConfirmationText}
        visitDate={watchedVisitDate}
      />
    </section>
  );
}
