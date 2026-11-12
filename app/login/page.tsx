import { redirect } from 'next/navigation';

import { LoginForm } from '@/components/auth/login-form';
import { getAppEntryPath, getSession } from '@/lib/auth';

type LoginPageProps = {
  searchParams?: Promise<{ sessao?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await getSession();
  const sessionExpired = (await searchParams)?.sessao === 'expirada';

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

        {sessionExpired ? (
          <p
            role="status"
            className="rounded-lg border border-[#ffe39d]/30 bg-[#ffe39d]/10 px-4 py-3 text-center text-sm text-[#fff3cf]"
          >
            Sua sessão expirou. Entre novamente para continuar.
          </p>
        ) : null}

        <LoginForm />
      </div>
    </main>
  );
}
