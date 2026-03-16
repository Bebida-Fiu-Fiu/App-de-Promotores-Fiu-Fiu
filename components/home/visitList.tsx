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

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {visits.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm opacity-80">
            Nenhuma visita cadastrada ainda.
          </div>
        ) : (
          visits.map((visit) => (
            <article
              key={visit.id}
              className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-[0_12px_30px_rgba(0,0,0,0.08)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-white">{visit.establishment}</h3>
                  <p className="mt-2 text-sm text-white/70">Data: {visit.visitDate}</p>
                </div>

                <Link
                  href={`/visitas/${visit.id}`}
                  className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-semibold transition hover:bg-white/10"
                >
                  Ver
                </Link>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
