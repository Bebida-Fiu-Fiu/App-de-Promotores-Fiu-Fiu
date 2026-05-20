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

export type PromotorVisit = {
  id: number;
  promotorId: number | null;
  establishmentId: number | null;
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
  establishment?: number | null;
  visitDate?: string | null;
  products: PromotorVisitProduct[];
  beforeImages?: PromotorVisitImageArrayInput;
  afterImages?: PromotorVisitImageArrayInput;
  observation?: string | null;
  isDraft?: boolean;
};
