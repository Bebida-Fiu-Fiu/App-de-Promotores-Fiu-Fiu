import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { NewVisitForm } from '@/components/visits/new-visit-form';
import { getHomePath, getSession } from '@/lib/auth';

export default async function NewVisitPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <main className="min-h-screen bg-[var(--background)] pb-28">
      <div className="mx-auto w-full max-w-xs px-4 pt-10">
        <Link
          href={getHomePath(session.role)}
          className="flex w-fit items-center gap-2 text-sm font-medium text-white/70 transition hover:text-white"
        >
          <ArrowLeft size={18} />
          Voltar para o início
        </Link>
      </div>
      <NewVisitForm />
    </main>
  );
}
