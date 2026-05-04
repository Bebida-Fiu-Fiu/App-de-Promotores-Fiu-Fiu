import { redirect } from 'next/navigation';

import { WeeklyVehicleCheckGate } from '@/components/home/weekly-vehicle-check-gate';
import { getSession } from '@/lib/auth';
import { hasWeeklyVehicleCheckFromApi } from '@/lib/weekly-vehicle-check-api';

export default async function CheckinPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  if (session.user.role !== 'promotor') {
    redirect('/comercial');
  }

  const hasCompletedWeeklyVehicleCheck = await hasWeeklyVehicleCheckFromApi(
    session.accessToken
  ).catch(() => false);

  if (hasCompletedWeeklyVehicleCheck) {
    redirect('/promotor');
  }

  return (
    <WeeklyVehicleCheckGate
      initialCompletedForToday={false}
      allowSkip
      redirectTo="/promotor"
    >
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(0,156,108,0.12),_transparent_32%),linear-gradient(180deg,_#0f2d3d_0%,_var(--background)_42%,_#091c27_100%)] px-4 py-10 pb-28 text-white">
        <section className="mx-auto w-full max-w-3xl rounded-[28px] border border-white/10 bg-white/[0.05] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.2)]">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#8eb4c4]">
            Check-in do app
          </p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight">
            Confirme a quilometragem semanal
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-white/75">
            Antes de entrar no app, registre a quilometragem do veiculo. Se ja houver registro nesta semana,
            esta etapa sera pulada automaticamente.
          </p>
        </section>
      </main>
    </WeeklyVehicleCheckGate>
  );
}
