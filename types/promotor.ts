export type PromotorVisitProduct = {
  name: string;
  quantity: number;
  unit: string;
  expirationDate: string;
};

export type PromotorVisit = {
  id: number;
  promotorId: number | null;
  establishment: string;
  visitDate: string | null;
  products: PromotorVisitProduct[];
  beforeImage: string;
  afterImage: string;
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

export type PromotorAgendaEntry = {
  id: number;
  promotorId: number | null;
  promotorName: string | null;
  promotorEmail: string | null;
  clientId: number;
  clientName: string;
  fantasyName: string;
  city: string;
  state: string;
  nickname: string | null;
  notes: string | null;
  document: string;
  address: string;
  addressNumber: string | null;
  neighborhood: string;
  lastVisitDate: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type PromotorProfile = {
  id: number | null;
  email: string;
  fullName: string | null;
  role: 'promotor' | 'comercial';
};

export type PromotorVisitPayload = {
  establishment: number;
  establishmentName?: string;
  date: string;
  products: PromotorVisitProduct[];
  beforeImage?: string;
  afterImage?: string;
  isDraft?: boolean;
};
