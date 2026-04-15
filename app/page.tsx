import { redirect } from 'next/navigation';
import { getHomePath, getSession } from '@/lib/auth';

export default async function HomePage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  redirect(getHomePath(session.role));
}
