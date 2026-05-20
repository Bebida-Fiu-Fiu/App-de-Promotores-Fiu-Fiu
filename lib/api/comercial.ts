import 'server-only';

import type { CommercialVisit, CommercialVisitPayload } from '@/types/comercial';
import { apiRequest, isRecord, readArrayPayload } from '@/lib/api/client';

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

export async function createCommercialVisit(token: string, payload: CommercialVisitPayload) {
  const response = await apiRequest('/comercial/visit', {
    method: 'POST',
    token,
    body: payload,
  });

  return isRecord(response) ? normalizeCommercialVisit(response) : null;
}

export async function listCommercialVisitsByComercialId(token: string, comercialId: number) {
  const response = await apiRequest(`/comercial/visit/${comercialId}`, {
    token,
  });

  return readArrayPayload(response, ['visits', 'data', 'items']).map(normalizeCommercialVisit);
}

export async function listAllCommercialVisits(token: string) {
  const response = await apiRequest('/comercial/visits', {
    token,
  });

  return readArrayPayload(response, ['visits', 'data', 'items']).map(normalizeCommercialVisit);
}

export async function updateCommercialVisit(token: string, visitId: number, payload: CommercialVisitPayload) {
  const response = await apiRequest(`/promotor/visit/${visitId}`, {
    method: 'PUT',
    token,
    body: payload,
  });

  return isRecord(response) ? normalizeCommercialVisit(response) : null;
}
