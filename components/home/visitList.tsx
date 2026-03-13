
import Link from 'next/link';

type VisitListProps = {
  visits: {
    id: number;
    establishment: string;
    visitDate: string;
  }[];
};

export function VisitList({ visits }: VisitListProps) {
  return (
    <section className="mx-auto w-full max-w-4xl px-6 pt-24">
      <div className="flex items-start justify-between">
        <h2 className="text-2xl font-bold">Visitas</h2>
        <Link
          href="/visitas/nova"
          className="rounded-md bg-[#009c6c] px-4 py-2 font-bold text-white transition hover:bg-[#007a55]"
        >
          Nova Visita
        </Link>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
        <div className="grid grid-cols-[1fr_140px_100px] border-b border-white/10 px-4 py-3 text-sm font-semibold">
          <span>Estabelecimento</span>
          <span>Data</span>
          <span>Acao</span>
        </div>

        {visits.length === 0 ? (
          <div className="px-4 py-6 text-sm opacity-80">Nenhuma visita cadastrada ainda.</div>
        ) : (
          visits.map((visit) => (
            <div
              key={visit.id}
              className="grid grid-cols-[1fr_140px_100px] items-center px-4 py-3 text-sm odd:bg-white/5"
            >
              <span>{visit.establishment}</span>
              <span>{visit.visitDate}</span>
              <Link
                href={`/visitas/${visit.id}`}
                className="w-fit rounded-md border border-white/20 px-3 py-1.5 text-xs font-semibold transition hover:bg-white/10"
              >
                Ver
              </Link>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
