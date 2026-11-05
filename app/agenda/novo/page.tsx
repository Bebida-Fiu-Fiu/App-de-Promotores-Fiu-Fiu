import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { redirect } from 'next/navigation';

import { AddAgendaClientForm } from '@/components/agenda/add-agenda-client-form';
import { getPromotorOpaqueIdFromSession, getSession } from '@/lib/auth';
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

  const promotorId = getPromotorOpaqueIdFromSession(session);
  const currentPromotor: PromotorOption | null =
    promotorId === null
      ? null
      : {
          id: promotorId,
          name: session.user.fullName || session.user.email || `Promotor ${String(promotorId)}`,
        };

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

        <AddAgendaClientForm currentPromotor={currentPromotor} />
      </section>
    </main>
  );
}
