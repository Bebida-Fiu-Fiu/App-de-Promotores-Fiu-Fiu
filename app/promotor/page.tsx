import { redirect } from 'next/navigation';

import { HomePageContent } from '@/components/home/home-page-content';
import { getSession } from '@/lib/auth';

type PromotorHomePageProps = {
  searchParams?: Promise<{
    page?: string;
  }>;
};

export default async function PromotorHomePage({ searchParams }: PromotorHomePageProps) {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  const resolvedSearchParams = await searchParams;
  const pageValue = Number(resolvedSearchParams?.page);
  const page = Number.isFinite(pageValue) && pageValue > 0 ? Math.floor(pageValue) : 1;

  return <HomePageContent session={session} page={page} />;
}
