import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { NewVisitForm } from '@/components/visits/new-visit-form';
import { getHomePath, getSession } from '@/lib/auth';

type NewVisitPageProps = {
  searchParams?: Promise<{
    clientId?: string;
    nickname?: string;
    clientName?: string;
    fantasyName?: string;
    document?: string;
    city?: string;
    address?: string;
    addressNumber?: string;
    neighborhood?: string;
    state?: string;
  }>;
};

export default async function NewVisitPage({ searchParams }: NewVisitPageProps) {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const initialClient =
    resolvedSearchParams.clientId && resolvedSearchParams.clientName
      ? {
          id: Number(resolvedSearchParams.clientId),
          nickname: resolvedSearchParams.nickname ?? '',
          client_name: resolvedSearchParams.clientName,
          fantasy_name: resolvedSearchParams.fantasyName ?? '',
          document: resolvedSearchParams.document ?? '',
          city: resolvedSearchParams.city ?? '',
          address: resolvedSearchParams.address ?? '',
          address_number: resolvedSearchParams.addressNumber ?? null,
          neighborhood: resolvedSearchParams.neighborhood ?? '',
          state: resolvedSearchParams.state ?? '',
        }
      : null;

  return (
    <main className="min-h-screen bg-[var(--background)] pb-28">
      <div className="mx-auto w-full max-w-xs px-4 pt-10">
        <Link
          href={getHomePath(session.user.role)}
          className="flex w-fit items-center gap-2 text-sm font-medium text-white/70 transition hover:text-white"
        >
          <ArrowLeft size={18} />
          Voltar para o início
        </Link>
      </div>
      <NewVisitForm
        initialClient={initialClient}
        initialData={{
          establishment:
            initialClient?.nickname || initialClient?.fantasy_name || initialClient?.client_name || '',
        }}
      />
    </main>
  );
}
