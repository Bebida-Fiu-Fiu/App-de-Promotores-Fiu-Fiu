import { redirect } from 'next/navigation';

import { HomePageContent } from '@/components/home/home-page-content';
import { getSession } from '@/lib/auth';

export default async function PromotorHomePage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  return <HomePageContent accessToken={session.accessToken} user={session.user} />;
}
