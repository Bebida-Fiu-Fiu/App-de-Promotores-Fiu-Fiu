import { Header } from '@/components/home/header';
import { AppTabs } from '@/components/home/app-tabs';
import { VisitList } from '@/components/home/visitList';
import { type SessionUser } from '@/types/auth';
import { listPromotorVisitsByPromotorId } from '@/lib/api/promotor';
import { getPromotorIdFromSession } from '@/lib/auth';
import { getHeaderFullName } from '@/lib/header-user';

type VisitListItem = {
  id: number;
  establishment: string;
  visitDate: string;
  isDraft: boolean;
  canEdit: boolean;
};

type HomePageContentProps = {
  accessToken: string;
  user: SessionUser;
};

function formatDatabaseDateToDisplay(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

function getRoleLabel(role: SessionUser['role']) {
  return role === 'comercial' ? 'Comercial' : 'Promotor';
}

export async function HomePageContent({ accessToken, user }: HomePageContentProps) {
  let visits: VisitListItem[] = [];
  let fullName: string | null = user.fullName;

  try {
    fullName = await getHeaderFullName(accessToken, user.fullName);
    const promotorId = getPromotorIdFromSession({
      accessToken,
      user,
    });

    if (typeof promotorId === 'number') {
      const promotorVisits = await listPromotorVisitsByPromotorId(accessToken, promotorId);

      visits = promotorVisits.map((visit) => ({
        id: visit.id,
        establishment: visit.establishment || 'Rascunho sem estabelecimento',
        visitDate: visit.visitDate ? formatDatabaseDateToDisplay(visit.visitDate) : 'Data nao definida',
        isDraft: visit.isDraft,
        canEdit: visit.canEdit,
      }));
    }
  } catch (error) {
    console.error('Home API lookup error:', error);
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(0,156,108,0.12),_transparent_32%),linear-gradient(180deg,_#0f2d3d_0%,_var(--background)_42%,_#091c27_100%)] px-4 py-15">
      <Header fullName={fullName} />
      <AppTabs current="visitas" role={user.role} />
      <section className="mx-auto w-full max-w-4xl px-6 pt-6">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/60">
          Home {getRoleLabel(user.role)}
        </p>
      </section>
      <VisitList visits={visits} />
    </main>
  );
}
