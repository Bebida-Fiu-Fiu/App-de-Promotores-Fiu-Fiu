import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { CommercialSubmissionForm } from '@/components/commercial/commercial-submission-form';
import { getSession } from '@/lib/auth';
import { getCommercialSubmissionById } from '@/lib/commercial';

export default async function EditCommercialSubmissionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  const resolvedParams = await params;
  const submissionId = Number(resolvedParams.id);

  if (!Number.isInteger(submissionId) || submissionId <= 0) {
    notFound();
  }

  const submission = await getCommercialSubmissionById(submissionId);

  if (!submission) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(0,156,108,0.12),_transparent_28%),linear-gradient(180deg,_#0f2d3d_0%,_var(--background)_46%,_#091c27_100%)] pb-12">
      <div className="mx-auto w-full max-w-4xl px-4 pt-10">
        <Link
          href={`/comercial/${submissionId}`}
          className="flex w-fit items-center gap-2 text-sm font-medium text-white/70 transition hover:text-white"
        >
          <ArrowLeft size={18} />
          Voltar para o relatorio
        </Link>
      </div>

      <CommercialSubmissionForm
        mode="edit"
        submissionId={submission.id}
        initialValues={{
          clientName: submission.clientName,
          fantasyName: submission.fantasyName,
          cnpj: submission.cnpj ?? '',
          email: submission.email ?? '',
          phone: submission.phone,
          address: submission.address,
          value: new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
          }).format(submission.totalValue),
          salesQuantity: submission.salesQuantity,
          sold: submission.sold,
          visitDates: submission.visitDates.map((visitDate) => ({ value: visitDate })),
        }}
      />
    </main>
  );
}
