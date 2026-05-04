import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { redirect } from 'next/navigation';

import { WeeklyVehicleCheckGate } from '@/components/home/weekly-vehicle-check-gate';
import { getHomePath, getSession } from '@/lib/auth';

export default async function WeeklyVehicleCheckTestPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <WeeklyVehicleCheckGate
      initialCompletedForToday={false}
      requirePhoto={false}
      allowSkip
    >
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(0,156,108,0.12),_transparent_32%),linear-gradient(180deg,_#0f2d3d_0%,_var(--background)_42%,_#091c27_100%)] px-4 py-10 pb-28 text-white">
        <section className="mx-auto w-full max-w-3xl rounded-[28px] border border-white/10 bg-white/[0.05] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.2)]">
          <Link
            href={getHomePath(session.user.role)}
            className="inline-flex items-center gap-2 text-sm font-medium text-white/70 transition hover:text-white"
          >
            <ArrowLeft size={18} />
            Voltar
          </Link>

          <div className="mt-6 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#8eb4c4]">
              Visao de teste
            </p>
            <h1 className="text-3xl font-bold tracking-tight">
              Check semanal com botao de pulo
            </h1>
            <p className="max-w-2xl text-sm text-white/75">
              Nesta rota local voce pode confirmar normalmente, seguir sem foto
              ou simplesmente pular a etapa de quilometragem.
            </p>
            <p className="text-sm text-[#bfead9]">
              Caminho: <span className="font-semibold">/testes/quilometragem-sem-foto</span>
            </p>
          </div>
        </section>
      </main>
    </WeeklyVehicleCheckGate>
  );
}
