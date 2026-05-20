import 'server-only';

import type { SessionUser } from '@/types/auth';
import type {
  PromotorAgendaEntry,
  PromotorMileageRecord,
  PromotorProfile,
  PromotorVisitListPage,
  PromotorVisit,
  PromotorVisitImageArrayInput,
  PromotorVisitPayload,
  PromotorVisitProduct,
} from '@/types/promotor';
import { apiRequest, apiRequestWithMeta, isRecord, readArrayPayload } from '@/lib/api/client';

type PromotorAuthPayload = {
  fullName?: string;
  email: string;
  password: string;
  role?: 'promotor' | 'comercial';
};

type AuthResult = {
  accessToken: string;
  user: SessionUser;
};

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toNullableNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toStringValue(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function toNullableString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null;
}

const INDEFINITE_EXPIRATION_PRODUCTS = new Set(
  [
    'Cajazinha',
    'Abacaxi Cortelã',
    'Tangerina com Acerola',
    'Pomar',
    'Pitaya com Melancia',
  ].map((productName) => productName.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase())
);

function normalizeProductName(productName: string) {
  return productName.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function shouldDisplayIndefiniteExpiration(product: Pick<PromotorVisitProduct, 'name' | 'quantity'>) {
  if (product.quantity === 0 && product.name.trim()) {
    return true;
  }

  return INDEFINITE_EXPIRATION_PRODUCTS.has(normalizeProductName(product.name));
}

function normalizeDateKey(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  const isoDateMatch = trimmedValue.match(/^(\d{4}-\d{2}-\d{2})/);

  if (isoDateMatch) {
    return isoDateMatch[1];
  }

  const brazilianDateMatch = trimmedValue.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (brazilianDateMatch) {
    return `${brazilianDateMatch[3]}-${brazilianDateMatch[2]}-${brazilianDateMatch[1]}`;
  }

  const parsedDate = new Date(trimmedValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate.toISOString().slice(0, 10);
}

function readNestedRecord(payload: unknown, keys: string[]) {
  if (!isRecord(payload)) {
    return null;
  }

  for (const key of keys) {
    const value = payload[key];

    if (isRecord(value)) {
      return value;
    }
  }

  return payload;
}

function readStringByPaths(payload: unknown, paths: string[][]) {
  for (const path of paths) {
    let current: unknown = payload;

    for (const segment of path) {
      if (!isRecord(current) || !(segment in current)) {
        current = null;
        break;
      }

      current = current[segment];
    }

    if (typeof current === 'string' && current.trim()) {
      return current;
    }
  }

  return '';
}

function parseEmbeddedJsonString(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmedValue = value.trim();

  if (
    (!trimmedValue.startsWith('{') || !trimmedValue.endsWith('}')) &&
    (!trimmedValue.startsWith('[') || !trimmedValue.endsWith(']'))
  ) {
    return null;
  }

  try {
    return JSON.parse(trimmedValue);
  } catch {
    return null;
  }
}

function normalizeUser(payload: unknown): SessionUser {
  const embeddedPayload =
    isRecord(payload) ? parseEmbeddedJsonString(payload.message) : null;
  const source = embeddedPayload ?? payload;
  const record = readNestedRecord(source, ['user', 'data']) ?? {};

  return {
    id: toNullableNumber(record.id ?? record.promotorId ?? record.userId),
    email: toStringValue(record.email),
    fullName: toNullableString(record.fullName ?? record.full_name ?? record.name),
    role: record.role === 'comercial' ? 'comercial' : 'promotor',
  };
}

function readBearerTokenFromHeader(value: string | null) {
  if (!value) {
    return '';
  }

  const trimmed = value.trim().replace(/^['"]|['"]$/g, '');

  if (!trimmed) {
    return '';
  }

  if (/^bearer\s+/i.test(trimmed)) {
    return trimmed.replace(/^bearer\s+/i, '').trim();
  }

  return trimmed;
}

function normalizeAuthResultWithHeaders(payload: unknown, headers: Headers): AuthResult {
  const embeddedPayload =
    isRecord(payload) ? parseEmbeddedJsonString(payload.message) : null;
  const source = embeddedPayload ?? payload;

  if (!isRecord(source)) {
    throw new Error('Resposta invalida da autenticacao externa.');
  }

  const tokenCandidates = [
    readStringByPaths(source, [
      ['accessToken'],
      ['access_token'],
      ['token'],
      ['jwt'],
      ['bearerToken'],
      ['bearer_token'],
      ['sessionToken'],
      ['session_token'],
      ['data', 'accessToken'],
      ['data', 'access_token'],
      ['data', 'token'],
      ['data', 'jwt'],
      ['data', 'sessionToken'],
      ['data', 'session_token'],
      ['auth', 'accessToken'],
      ['auth', 'access_token'],
      ['auth', 'token'],
      ['auth', 'jwt'],
      ['result', 'accessToken'],
      ['result', 'access_token'],
      ['result', 'token'],
      ['result', 'jwt'],
      ['payload', 'accessToken'],
      ['payload', 'access_token'],
      ['payload', 'token'],
      ['payload', 'jwt'],
    ]),
    readStringByPaths(source, [
      ['idToken'],
      ['id_token'],
      ['data', 'idToken'],
      ['data', 'id_token'],
      ['auth', 'idToken'],
      ['auth', 'id_token'],
      ['result', 'idToken'],
      ['result', 'id_token'],
      ['payload', 'idToken'],
      ['payload', 'id_token'],
    ]),
    headers.get('authorization'),
    headers.get('x-access-token'),
    headers.get('access-token'),
    headers.get('token'),
    headers.get('jwt'),
  ]
    .map((value) => readBearerTokenFromHeader(value))
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index);

  const accessToken = tokenCandidates[0] ?? '';

  if (!accessToken) {
    throw new Error('Access token nao retornado pela API externa.');
  }

  return {
    accessToken,
    user: normalizeUser(source),
  };
}

function normalizeVisitProduct(payload: unknown): PromotorVisitProduct {
  const record = isRecord(payload) ? payload : {};
  const unit = toStringValue(record.unit ?? record.packageType, 'unidade');
  const product = {
    name: toStringValue(record.name),
    quantity: toNumber(record.quantity),
    unit: unit === 'pack' || unit === 'caixa' ? unit : 'unidade',
    expirationDate: toStringValue(record.expirationDate ?? record.expiration_date),
  } satisfies PromotorVisitProduct;

  if (shouldDisplayIndefiniteExpiration(product)) {
    return {
      ...product,
      expirationDate: 'indefinido',
    };
  }

  return product;
}

function getCurrentIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeImageInputArray(value: PromotorVisitPayload['beforeImages'] | PromotorVisitPayload['afterImages']) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item) => {
    if (typeof item === 'string') {
      return Boolean(item.trim());
    }

    return isRecord(item);
  });
}

function resolveImageArrayPayload(
  images: PromotorVisitPayload['beforeImages'] | PromotorVisitPayload['afterImages']
): PromotorVisitImageArrayInput | undefined {
  const normalizedImages = normalizeImageInputArray(images);

  if (normalizedImages.length > 0) {
    return normalizedImages;
  }

  return undefined;
}

function buildPromotorVisitApiPayload(payload: PromotorVisitPayload) {
  const fallbackVisitDate = payload.visitDate ?? getCurrentIsoDate();
  const beforeImages = resolveImageArrayPayload(payload.beforeImages);
  const afterImages = resolveImageArrayPayload(payload.afterImages);

  return {
    establishmentId: payload.establishment ?? undefined,
    visitDate: payload.visitDate ?? undefined,
    products: payload.products.map((product) => ({
      name: product.name,
      quantity: product.quantity,
      unit: product.unit,
      expirationDate: (() => {
        const normalizedExpirationDate = product.expirationDate.trim().toLowerCase();

        if (normalizedExpirationDate === 'indefinido') {
          return 'indefinido';
        }

        return /^\d{4}-\d{2}-\d{2}$/.test(product.expirationDate) ? product.expirationDate : fallbackVisitDate;
      })(),
    })),
    beforeImages,
    afterImages,
    observation: payload.observation ?? undefined,
    isDraft: payload.isDraft ?? undefined,
  };
}

function normalizeImageUrlArray(value: unknown) {
  const parsedValue = parseEmbeddedJsonString(value);

  if (Array.isArray(parsedValue)) {
    return normalizeImageUrlArray(parsedValue);
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') {
          return item.trim();
        }

        if (isRecord(item)) {
          const nestedImage = isRecord(item.image) ? item.image : null;

          return toStringValue(
            item.url ??
              item.path ??
              item.src ??
              item.imageUrl ??
              item.image_url ??
              item.fileUrl ??
              item.file_url ??
              item.downloadUrl ??
              item.download_url ??
              nestedImage?.url ??
              nestedImage?.path ??
              nestedImage?.src ??
              nestedImage?.imageUrl ??
              nestedImage?.image_url
          );
        }

        return '';
      })
      .filter(Boolean);
  }

  return [];
}

function normalizeVisit(payload: unknown): PromotorVisit {
  const record = isRecord(payload) ? payload : {};
  const establishmentId = toNullableNumber(
    record.establishmentId ?? record.establishment_id ?? record.clientId ?? record.client_id ?? record.establishment
  );
  const rawEstablishment =
    record.establishmentName ??
    record.establishment_name ??
    record.clientName ??
    record.client_name ??
    record.fantasyName ??
    record.fantasy_name ??
    record.establishment;
  const beforeImages = normalizeImageUrlArray(record.beforeImages ?? record.before_images);
  const afterImages = normalizeImageUrlArray(record.afterImages ?? record.after_images);

  return {
    id: toNumber(record.id),
    promotorId: toNullableNumber(record.promotorId ?? record.promotor_id),
    establishmentId,
    establishment:
      typeof rawEstablishment === 'number'
        ? String(rawEstablishment)
        : toStringValue(rawEstablishment, 'Rascunho sem estabelecimento'),
    visitDate: toNullableString(record.visitDate ?? record.visit_date ?? record.date),
    products: Array.isArray(record.products) ? record.products.map(normalizeVisitProduct) : [],
    beforeImages,
    afterImages,
    observation: toNullableString(record.observation ?? record.observacao),
    isDraft: Boolean(record.isDraft ?? record.is_draft),
    canEdit:
      typeof record.canEdit === 'boolean'
        ? record.canEdit
        : typeof record.can_edit === 'boolean'
          ? record.can_edit
          : true,
    createdAt: toNullableString(record.createdAt ?? record.created_at),
    updatedAt: toNullableString(record.updatedAt ?? record.updated_at),
  };
}

function normalizeVisitReportPage(payload: unknown, fallbackPage: number, fallbackPageSize: number): PromotorVisitListPage {
  if (Array.isArray(payload)) {
    return {
      items: payload.map(normalizeVisit),
      page: fallbackPage,
      pageSize: fallbackPageSize,
      total: null,
      hasNextPage: payload.length === fallbackPageSize,
    };
  }

  const record = isRecord(payload) ? payload : {};
  const pagination = isRecord(record.pagination) ? record.pagination : {};
  const items = readArrayPayload(record, [
    'reports',
    'visits',
    'items',
    'data',
    'results',
    'rows',
    'report',
  ]).map(normalizeVisit);
  const total = toNullableNumber(
    pagination.total ??
    record.total ??
    record.count ??
    record.totalItems ??
    record.total_items ??
    record.totalCount ??
    record.total_count
  );
  const page = toNumber(
    pagination.page ??
    record.page ??
    record.currentPage ??
    record.current_page,
    fallbackPage
  );
  const pageSize = toNumber(
    pagination.pageSize ??
    pagination.limit ??
    record.limit ??
    record.pageSize ??
    record.page_size ??
    record.perPage ??
    record.per_page,
    fallbackPageSize
  );
  const totalPages = toNullableNumber(
    pagination.totalPages ??
    pagination.total_pages ??
    record.totalPages ??
    record.total_pages ??
    record.pages
  );
  const hasNextPage =
    typeof record.hasNextPage === 'boolean'
      ? record.hasNextPage
      : typeof record.has_next_page === 'boolean'
        ? record.has_next_page
        : totalPages !== null
          ? page < totalPages
          : total !== null
            ? page * pageSize < total
            : items.length === pageSize;

  return {
    items,
    page,
    pageSize,
    total,
    hasNextPage,
  };
}

function normalizeMileageRecord(payload: unknown): PromotorMileageRecord {
  const record = isRecord(payload) ? payload : {};
  const checkDate =
    normalizeDateKey(
      record.checkDate ??
      record.check_date ??
      record.date ??
      record.createdAt ??
      record.created_at ??
      record.updatedAt ??
      record.updated_at ??
      record.registeredAt ??
      record.registered_at ??
      record.timestamp
    );

  return {
    id: toNumber(record.id),
    promotorId: toNullableNumber(record.promotorId ?? record.promotor_id),
    mileage: toNumber(record.mileage),
    checkDate,
    imageUrl: toNullableString(record.imageUrl ?? record.image_url ?? record.image),
    createdAt: toNullableString(record.createdAt ?? record.created_at),
    updatedAt: toNullableString(record.updatedAt ?? record.updated_at),
  };
}

function normalizeAgendaEntry(payload: unknown): PromotorAgendaEntry {
  const record = isRecord(payload) ? payload : {};

  return {
    id: toNumber(record.id),
    promotorId: toNullableNumber(record.promotorId ?? record.promotor_id),
    promotorName: toNullableString(record.promotorName ?? record.promotor_name),
    promotorEmail: toNullableString(record.promotorEmail ?? record.promotor_email),
    clientId: toNumber(record.clientId ?? record.client_id),
    clientName: toStringValue(record.clientName ?? record.client_name),
    fantasyName: toStringValue(record.fantasyName ?? record.fantasy_name),
    city: toStringValue(record.city),
    state: toStringValue(record.state),
    nickname: toNullableString(record.nickname),
    notes: toNullableString(record.notes),
    document: toStringValue(record.document),
    address: toStringValue(record.address),
    addressNumber: toNullableString(record.addressNumber ?? record.address_number),
    neighborhood: toStringValue(record.neighborhood),
    lastVisitDate: toNullableString(record.lastVisitDate ?? record.last_visit_date),
    createdAt: toNullableString(record.createdAt ?? record.created_at),
    updatedAt: toNullableString(record.updatedAt ?? record.updated_at),
  };
}

export async function signInPromotor(payload: PromotorAuthPayload) {
  const response = await apiRequestWithMeta('/promotor/signin', {
    method: 'POST',
    body: {
      email: payload.email,
      password: payload.password,
    },
  });

  return normalizeAuthResultWithHeaders(response.data, response.headers);
}

export async function signUpPromotor(payload: PromotorAuthPayload) {
  const response = await apiRequestWithMeta('/promotor/signup', {
    method: 'POST',
    body: {
      fullName: payload.fullName,
      full_name: payload.fullName,
      email: payload.email,
      password: payload.password,
      role: payload.role,
    },
  });

  return normalizeAuthResultWithHeaders(response.data, response.headers);
}

export async function getPromotorMe(token: string): Promise<PromotorProfile> {
  const response = await apiRequest('/promotor/me', {
    token,
  });

  return normalizeUser(response);
}

export async function listPromotorVisitsByPromotorId(token: string, promotorId: number) {
  const response = await apiRequest(`/promotor/visit/${promotorId}`, {
    token,
  });

  return readArrayPayload(response, ['visits', 'data', 'items']).map(normalizeVisit);
}

export async function getVisitById(token: string, visitId: number) {
  const response = await apiRequest(`/visits/${visitId}`, {
    token,
  });

  if (!isRecord(response)) {
    return null;
  }

  const source = readNestedRecord(response, ['visit', 'data', 'report']) ?? response;
  return normalizeVisit(source);
}

export async function listVisitsReportByPromotorId(
  token: string,
  promotorId: number,
  options?: {
    page?: number;
    pageSize?: number;
  }
) {
  const page = options?.page && options.page > 0 ? options.page : 1;
  const pageSize = options?.pageSize && options.pageSize > 0 ? options.pageSize : 10;
  const searchParams = new URLSearchParams({
    promotorId: String(promotorId),
    page: String(page),
    limit: String(pageSize),
  });
  const response = await apiRequest(`/visits/report?${searchParams.toString()}`, {
    token,
  });

  return normalizeVisitReportPage(response, page, pageSize);
}

export async function listAllPromotorVisits(token: string) {
  const response = await apiRequest('/promotor/visits', {
    token,
  });

  return readArrayPayload(response, ['visits', 'data', 'items']).map(normalizeVisit);
}

export async function listPromotorAgendaByPromotorId(token: string, promotorId: number) {
  const response = await apiRequest(`/promotors/agenda/${promotorId}`, {
    token,
  });

  return readArrayPayload(response, ['agendas', 'agenda', 'data', 'items']).map(normalizeAgendaEntry);
}

export async function deletePromotorAgendaEntry(token: string, agendaEntryId: number) {
  await apiRequest(`/promotor/agenda/${agendaEntryId}`, {
    method: 'DELETE',
    token,
  });

  return true;
}

export async function createPromotorVisit(token: string, payload: PromotorVisitPayload) {
  const response = await apiRequest('/promotor/visit', {
    method: 'POST',
    token,
    body: buildPromotorVisitApiPayload(payload),
  });

  if (!isRecord(response)) {
    return null;
  }

  const source = readNestedRecord(response, ['visit', 'data', 'report']) ?? response;
  return normalizeVisit(source);
}

export async function updatePromotorVisit(token: string, visitId: number, payload: PromotorVisitPayload) {
  const response = await apiRequest(`/promotor/visit/${visitId}`, {
    method: 'PUT',
    token,
    body: buildPromotorVisitApiPayload(payload),
  });

  if (!isRecord(response)) {
    return null;
  }

  const source = readNestedRecord(response, ['visit', 'data', 'report']) ?? response;
  return normalizeVisit(source);
}

export async function createVisit(token: string, payload: PromotorVisitPayload) {
  return createPromotorVisit(token, payload);
}

export async function updateVisit(token: string, visitId: number, payload: PromotorVisitPayload) {
  return updatePromotorVisit(token, visitId, payload);
}

export async function deleteDraftVisit(token: string, visitId: number) {
  const response = await apiRequest(`/promotor/visit/${visitId}`, {
    method: 'DELETE',
    token,
  });

  if (!isRecord(response)) {
    return null;
  }

  return {
    id: toNumber(response.id),
  };
}

export async function createPromotorMileage(
  token: string,
  payload: {
    promotorId: number;
    mileage: number;
    imageBase64: string;
    imageMimeType: string;
    checkDate?: string;
  }
) {
  const response = await apiRequest('/promotor/mileage', {
    method: 'POST',
    token,
    body: payload,
  });

  return isRecord(response) ? normalizeMileageRecord(response) : null;
}

export async function listPromotorMileage(token: string) {
  const response = await apiRequest('/promotor/mileage', {
    token,
  });

  return readArrayPayload(response, ['checks', 'mileages', 'mileage', 'data', 'items']).map(
    normalizeMileageRecord
  );
}
