import { redirect } from 'next/navigation';
import { getAppEntryPath, getSession } from '@/lib/auth';

export default async function HomePage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  redirect(getAppEntryPath(session.user.role));
}
