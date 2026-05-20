export type CommercialVisit = {
  id: number;
  clientName: string;
  fantasyName: string;
  cnpj: string | null;
  email: string | null;
  phone: string;
  address: string;
  totalValue: number;
  salesQuantity: number;
  sold: boolean;
  visitDates: string[];
  submittedByEmail: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type CommercialVisitPayload = {
  clientName: string;
  fantasyName: string;
  cnpj?: string | null;
  email?: string | null;
  phone: string;
  address: string;
  value: number;
  salesQuantity: number;
  sold: boolean;
  visitDates: string[];
};
