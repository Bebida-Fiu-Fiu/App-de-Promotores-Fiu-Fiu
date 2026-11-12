// Datas de visita comercial: a API grava AAAA-MM-DD; a tela usa dd/mm/aaaa.
// Valores em outro formato (registros antigos) passam inalterados.

export function toApiVisitDate(value: string) {
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : value.trim();
}

export function toDisplayVisitDate(value: string) {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value.trim();
}
