export type PromotorVisitProduct = {
  name: string;
  quantity: number;
  unit: 'unidade' | 'pack' | 'caixa';
  expirationDate: string;
};

export type PromotorVisitImageUpload = {
  filename: string;
  contentType: string;
  base64: string;
};

export type PromotorVisitImageArrayInput = Array<string | PromotorVisitImageUpload>;

import type { OpaqueId } from '@/types/auth';

export type { OpaqueId } from '@/types/auth';

export type PromotorVisit = {
  id: number;
  promotorId: OpaqueId | null;
  establishmentId: OpaqueId | null;
  establishment: string;
  visitDate: string | null;
  products: PromotorVisitProduct[];
  beforeImages: string[];
  afterImages: string[];
  observation: string | null;
  isDraft: boolean;
  canEdit: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export type PromotorVisitListPage = {
  items: PromotorVisit[];
  page: number;
  pageSize: number;
  total: number | null;
  hasNextPage: boolean;
};

export type PromotorMileageRecord = {
  id: number;
  promotorId: number | null;
  mileage: number;
  checkDate: string | null;
  imageUrl: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type AttendedStore = {
  id: OpaqueId | null;
  promotorId: OpaqueId | null;
  promotorName: string | null;
  promotorEmail: string | null;
  clientId: OpaqueId | null;
  clientName: string;
  fantasyName: string;
  city: string;
  state: string;
  nickname: string;
  notes: string | null;
  document: string;
  address: string;
  addressNumber: string | null;
  neighborhood: string;
  daysBetweenVisits: number;
  lastVisitDate: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type PromotorAgendaEntry = AttendedStore;

export type PromotorProfile = {
  id: OpaqueId | null;
  email: string;
  fullName: string | null;
  role: 'promotor' | 'comercial';
};

export type PromotorVisitPayload = {
  establishment?: OpaqueId | null;
  visitDate?: string | null;
  products: PromotorVisitProduct[];
  beforeImages?: PromotorVisitImageArrayInput;
  afterImages?: PromotorVisitImageArrayInput;
  observation?: string | null;
  isDraft?: boolean;
};
