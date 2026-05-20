import 'server-only';
import { inspect } from 'node:util';

type PrimitiveRecord = Record<string, unknown>;

export class ApiError extends Error {
  status: number;

  details: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

function getApiBaseUrl() {
  const baseUrl =
    process.env.FIU_FIU_API_BASE_URL?.trim() ||
    process.env.BASE_URL?.trim();

  if (!baseUrl) {
    throw new Error('FIU_FIU_API_BASE_URL ou BASE_URL nao configurada.');
  }

  return baseUrl.replace(/\/+$/, '');
}

function tryParseJsonLikeText(text: string) {
  const trimmedText = text.trim();

  if (
    (!trimmedText.startsWith('{') || !trimmedText.endsWith('}')) &&
    (!trimmedText.startsWith('[') || !trimmedText.endsWith(']'))
  ) {
    return null;
  }

  try {
    return JSON.parse(trimmedText);
  } catch {
    const normalizedText = trimmedText
      .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*:)/g, '$1"$2"$3')
      .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_match, value: string) => JSON.stringify(value));

    try {
      return JSON.parse(normalizedText);
    } catch {
      return null;
    }
  }
}

async function parseResponseBody(response: Response) {
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    return response.json();
  }

  const text = await response.text();

  if (!text) {
    return null;
  }

  const trimmedText = text.trim();

  const parsedJsonLikeText = tryParseJsonLikeText(trimmedText);

  if (parsedJsonLikeText !== null) {
    return parsedJsonLikeText;
  }

  return { message: text };
}

function extractErrorMessage(payload: unknown, fallbackMessage: string) {
  if (!payload || typeof payload !== 'object') {
    return fallbackMessage;
  }

  const candidate = payload as PrimitiveRecord;
  const possibleMessage =
    candidate.message ??
    candidate.error ??
    candidate.detail ??
    candidate.title;

  return typeof possibleMessage === 'string' && possibleMessage.trim()
    ? possibleMessage
    : fallbackMessage;
}

function formatLogValue(value: unknown) {
  return inspect(value, {
    depth: null,
    colors: false,
    compact: false,
    breakLength: 120,
  });
}

type ApiRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  token?: string;
  body?: unknown;
  headers?: HeadersInit;
  cache?: RequestCache;
  next?: NextFetchRequestConfig;
};

function normalizeAuthorizationToken(token: string) {
  const trimmed = token.trim().replace(/^['"]|['"]$/g, '');

  if (!trimmed) {
    return '';
  }

  if (/^bearer\s+/i.test(trimmed)) {
    return trimmed.replace(/^bearer\s+/i, '').trim();
  }

  return trimmed;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}) {
  const result = await apiRequestWithMeta<T>(path, options);
  return result.data;
}

export async function apiRequestWithMeta<T>(path: string, options: ApiRequestOptions = {}) {
  const url = `${getApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = new Headers(options.headers);

  if (options.token) {
    const normalizedToken = normalizeAuthorizationToken(options.token);

    if (normalizedToken) {
      headers.set('Authorization', `Bearer ${normalizedToken}`);
    }
  }

  let body: BodyInit | undefined;

  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(options.body);
  }

  console.log('[FIU-FIU API REQUEST]', {
    method: options.method ?? 'GET',
    url,
    headers: Object.fromEntries(headers.entries()),
    body: formatLogValue(options.body ?? null),
  });

  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers,
    body,
    cache: options.cache ?? 'no-store',
    next: options.next,
  });

  const payload = await parseResponseBody(response);

  console.log('[FIU-FIU API RESPONSE]', {
    method: options.method ?? 'GET',
    url,
    status: response.status,
    ok: response.ok,
    headers: Object.fromEntries(response.headers.entries()),
    body: formatLogValue(payload),
  });

  if (!response.ok) {
    throw new ApiError(
      extractErrorMessage(payload, 'Nao foi possivel concluir a requisicao para a API externa.'),
      response.status,
      payload
    );
  }

  return {
    data: payload as T,
    headers: response.headers,
    status: response.status,
  };
}

export function isRecord(value: unknown): value is PrimitiveRecord {
  return typeof value === 'object' && value !== null;
}

export function readArrayPayload<T>(payload: unknown, keys: string[]) {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  if (!isRecord(payload)) {
    return [];
  }

  for (const key of keys) {
    const value = payload[key];

    if (Array.isArray(value)) {
      return value as T[];
    }
  }

  return [];
}
