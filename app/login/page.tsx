import { redirect } from 'next/navigation';

import { LoginForm } from '@/components/auth/login-form';
import { getAppEntryPath, getSession } from '@/lib/auth';

export default async function LoginPage() {
  const session = await getSession();

  if (session) {
    redirect(getAppEntryPath(session.user.role));
  }

  return (
    <main
      className="flex min-h-screen items-center justify-center bg-[var(--background)] p-4"
      style={{
        backgroundColor: '#0c2432',
        backgroundImage: "url('/Texture/Dots.svg')",
        backgroundSize: 'cover',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        backgroundBlendMode: 'multiply',
        WebkitBackgroundSize: 'cover',
      }}
    >
      <div className="w-full max-w-md space-y-8 rounded-lg border border-white/40 bg-white/20 p-8 shadow-xl backdrop-blur-sm">
        <div className="space-y-2 text-center text-white">
          <h1 className="text-3xl font-bold">Login</h1>
          <p className="text-sm text-white/85">Entre para acessar a home do sistema.</p>
        </div>

        <LoginForm />
      </div>
    </main>
  );
}
