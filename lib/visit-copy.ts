import type { PromotorVisitProduct } from '@/types/promotor';

type VisitCopyDetails = {
  visitDate: string;
  userFullName: string | null;
  establishment: string;
  establishmentId: number | null;
  products: PromotorVisitProduct[];
};

function formatExpirationDate(value: string) {
  const isoDateMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);

  if (isoDateMatch) {
    return `${isoDateMatch[3]}/${isoDateMatch[2]}/${isoDateMatch[1]}`;
  }

  return value;
}

export function formatVisitCopyText({
  visitDate,
  userFullName,
  establishment,
  establishmentId,
  products,
}: VisitCopyDetails) {
  const productLines = products.map((product) => {
    const unitLabel = {
      unidade: product.quantity === 1 ? 'unidade' : 'unidades',
      pack: product.quantity === 1 ? 'pack' : 'packs',
      caixa: product.quantity === 1 ? 'caixa' : 'caixas',
    }[product.unit];

    return `${product.name} - ${product.quantity} ${unitLabel} - ${formatExpirationDate(product.expirationDate)}`;
  });

  return [
    visitDate,
    userFullName ?? '',
    `${establishment} - ID: ${establishmentId ?? '-'}`,
    '',
    'Produtos:',
    '',
    ...productLines,
  ].join('\n');
}
