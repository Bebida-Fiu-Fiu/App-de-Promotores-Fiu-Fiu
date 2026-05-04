import 'server-only';

import type { SessionUser } from '@/types/auth';
import type {
  PromotorMileageRecord,
  PromotorProfile,
  PromotorVisit,
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

  const trimmed = value.trim();

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

  const accessToken =
    readStringByPaths(source, [
      ['accessToken'],
      ['access_token'],
      ['token'],
      ['jwt'],
      ['idToken'],
      ['id_token'],
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
    ]) ||
    readBearerTokenFromHeader(headers.get('authorization')) ||
    readBearerTokenFromHeader(headers.get('x-access-token')) ||
    readBearerTokenFromHeader(headers.get('access-token')) ||
    readBearerTokenFromHeader(headers.get('token')) ||
    readBearerTokenFromHeader(headers.get('jwt'));

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

  return {
    name: toStringValue(record.name),
    quantity: toNumber(record.quantity),
    unit: toStringValue(record.unit ?? record.packageType, 'unidade'),
    expirationDate: toStringValue(record.expirationDate ?? record.expiration_date),
  };
}

function normalizeVisit(payload: unknown): PromotorVisit {
  const record = isRecord(payload) ? payload : {};

  return {
    id: toNumber(record.id),
    promotorId: toNullableNumber(record.promotorId ?? record.promotor_id),
    establishment: toStringValue(record.establishment, 'Rascunho sem estabelecimento'),
    visitDate: toNullableString(record.visitDate ?? record.visit_date ?? record.date),
    products: Array.isArray(record.products) ? record.products.map(normalizeVisitProduct) : [],
    beforeImage: toStringValue(record.beforeImage ?? record.before_image),
    afterImage: toStringValue(record.afterImage ?? record.after_image),
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

export async function listAllPromotorVisits(token: string) {
  const response = await apiRequest('/promotor/visits', {
    token,
  });

  return readArrayPayload(response, ['visits', 'data', 'items']).map(normalizeVisit);
}

export async function createPromotorVisit(token: string, payload: PromotorVisitPayload) {
  const response = await apiRequest('/promotor/visit', {
    method: 'POST',
    token,
    body: payload,
  });

  return isRecord(response) ? normalizeVisit(response) : null;
}

export async function updatePromotorVisit(token: string, visitId: number, payload: PromotorVisitPayload) {
  const response = await apiRequest(`/promotor/visit/${visitId}`, {
    method: 'PUT',
    token,
    body: payload,
  });

  return isRecord(response) ? normalizeVisit(response) : null;
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
