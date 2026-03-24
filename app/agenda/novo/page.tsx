import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { redirect } from 'next/navigation';

import { AddAgendaClientForm } from '@/components/agenda/add-agenda-client-form';
import { getSession } from '@/lib/auth';

function getDefaultWeekday() {
  const formattedWeekday = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date());

  return formattedWeekday
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace('-feira', '');
}

export default async function NewAgendaClientPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-10">
      <section className="mx-auto w-full max-w-4xl px-6 pt-6">
        <Link
          href="/agenda"
          className="flex w-fit items-center gap-2 text-sm font-medium text-white/70 transition hover:text-white"
        >
          <ArrowLeft size={18} />
          Voltar para a agenda
        </Link>

        <div className="mt-6">
          <h1 className="text-2xl font-bold text-white">Adicionar cliente na agenda</h1>
          <p className="mt-2 text-sm text-white/70">
            Selecione o cliente na base de dados e escolha o dia em que ele deve aparecer.
          </p>
        </div>

        <AddAgendaClientForm defaultWeekday={getDefaultWeekday()} />
      </section>
    </main>
  );
}
