import { AppTabs } from '@/components/home/app-tabs';
import { Header } from '@/components/home/header';
import { VisitList } from '@/components/home/visitList';
import { loadHomeVisitsPage, VISITS_PAGE_SIZE } from '@/lib/home-visits';
import type { SessionData } from '@/types/auth';

type HomePageContentProps = {
  session: SessionData;
  page: number;
};

export async function HomePageContent({ session, page }: HomePageContentProps) {
  const { visits, hasNextPage, totalVisits, loadError } = await loadHomeVisitsPage(session, page);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(0,156,108,0.12),_transparent_32%),linear-gradient(180deg,_#0f2d3d_0%,_var(--background)_42%,_#091c27_100%)] px-4 pt-16">
      <Header />
      <AppTabs current="visitas" role={session.user.role} />
      <VisitList
        visits={visits}
        page={page}
        hasNextPage={hasNextPage}
        totalVisits={totalVisits}
        pageSize={VISITS_PAGE_SIZE}
        loadError={loadError}
      />
    </main>
  );
}
