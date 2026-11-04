import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { redirect } from 'next/navigation';

import { AddAgendaClientForm } from '@/components/agenda/add-agenda-client-form';
import { listAllPromotorAgendas } from '@/lib/api/promotor';
import { getSession } from '@/lib/auth';
import type { OpaqueId } from '@/types/promotor';

type PromotorOption = {
  id: OpaqueId;
  name: string;
};

export default async function NewAgendaClientPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  let promotors: PromotorOption[] = [];
  let promoterListMessage: string | null = null;
  try {
    const agendas = await listAllPromotorAgendas(session.accessToken);
    const availablePromotors = new Map<string, PromotorOption>();
    for (const agenda of agendas) {
      if (agenda.promotorId === null) {
        continue;
      }

      const optionKey = `${typeof agenda.promotorId}:${String(agenda.promotorId)}`;
      if (!availablePromotors.has(optionKey)) {
        availablePromotors.set(optionKey, {
          id: agenda.promotorId,
          name: agenda.promotorName || `Promotor ${String(agenda.promotorId)}`,
        });
      }
    }

    promotors = Array.from(availablePromotors.values()).sort((left, right) =>
      left.name.localeCompare(right.name, 'pt-BR')
    );

    if (promotors.length === 0) {
      promoterListMessage =
        'Nao ha promotores nas agendas retornadas pela API. Ela ainda nao oferece um endpoint de listagem de promotores; para atribuir novas lojas sem agendas existentes, e necessario disponibilizar essa fonte.';
    }
  } catch (error) {
    promoterListMessage =
      'Nao foi possivel carregar os promotores das agendas existentes. Tente novamente mais tarde.';
    console.error('Agenda promoter options lookup error:', error);
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
          <h1 className="text-2xl font-bold text-white">Cadastrar loja atendida</h1>
          <p className="mt-2 text-sm text-white/70">
            Informe o apelido da loja. Cliente e promotor sao vinculos opcionais.
          </p>
        </div>

        <AddAgendaClientForm promotors={promotors} promoterListMessage={promoterListMessage} />
      </section>
    </main>
  );
}
