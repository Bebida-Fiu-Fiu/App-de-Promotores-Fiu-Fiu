import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { CommercialSubmissionForm } from '@/components/commercial/commercial-submission-form';
import { getSession } from '@/lib/auth';

export default async function NewCommercialSubmissionPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(0,156,108,0.12),_transparent_28%),linear-gradient(180deg,_#0f2d3d_0%,_var(--background)_46%,_#091c27_100%)] pb-12">
      <div className="mx-auto w-full max-w-4xl px-4 pt-10">
        <Link
          href="/comercial"
          className="flex w-fit items-center gap-2 text-sm font-medium text-white/70 transition hover:text-white"
        >
          <ArrowLeft size={18} />
          Voltar para clientes
        </Link>
      </div>

      <CommercialSubmissionForm mode="create" />
    </main>
  );
}
