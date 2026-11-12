import 'server-only';

import type { CommercialVisit, CommercialVisitPayload } from '@/types/comercial';
import { ApiError, apiRequest, isRecord, readArrayPayload } from '@/lib/api/client';

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toStringValue(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function toNullableString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null;
}

function normalizeVisitDates(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => String(item));
}

function normalizeCommercialVisit(payload: unknown): CommercialVisit {
  const record = isRecord(payload) ? payload : {};

  return {
    id: toNumber(record.id),
    clientName: toStringValue(record.clientName ?? record.client_name),
    fantasyName: toStringValue(record.fantasyName ?? record.fantasy_name),
    cnpj: toNullableString(record.cnpj),
    email: toNullableString(record.email),
    phone: toStringValue(record.phone),
    address: toStringValue(record.address),
    totalValue: toNumber(record.totalValue ?? record.total_value ?? record.value),
    salesQuantity: toNumber(record.salesQuantity ?? record.sales_quantity),
    sold: Boolean(record.sold),
    visitDates: normalizeVisitDates(record.visitDates ?? record.visit_dates),
    submittedByEmail: toNullableString(record.submittedByEmail ?? record.submitted_by_email),
    createdAt: toNullableString(record.createdAt ?? record.created_at),
    updatedAt: toNullableString(record.updatedAt ?? record.updated_at),
  };
}

// Contrato documentado no README da fiu-fiu-api (seção "Visitas comerciais").
// Visitas comerciais usam SOMENTE /commercial-visits; nunca as rotas /promotor/visit*.

function readCommercialVisit(response: unknown) {
  const record = isRecord(response) && isRecord(response.commercialVisit)
    ? response.commercialVisit
    : response;

  return isRecord(record) ? normalizeCommercialVisit(record) : null;
}

export async function createCommercialVisit(token: string, payload: CommercialVisitPayload) {
  const response = await apiRequest('/commercial-visits', {
    method: 'POST',
    token,
    body: payload,
  });

  return readCommercialVisit(response);
}

export async function listAllCommercialVisits(token: string) {
  const response = await apiRequest('/commercial-visits', {
    token,
  });

  return readArrayPayload(response, ['commercialVisits', 'visits', 'data', 'items']).map(
    normalizeCommercialVisit
  );
}

export async function getCommercialVisitById(token: string, visitId: number) {
  try {
    const response = await apiRequest(`/commercial-visits/${visitId}`, {
      token,
    });

    return readCommercialVisit(response);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }

    throw error;
  }
}

export async function updateCommercialVisit(token: string, visitId: number, payload: CommercialVisitPayload) {
  const response = await apiRequest(`/commercial-visits/${visitId}`, {
    method: 'PUT',
    token,
    body: payload,
  });

  return readCommercialVisit(response);
}
