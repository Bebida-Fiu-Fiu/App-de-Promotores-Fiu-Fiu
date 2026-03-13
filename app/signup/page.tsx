import { redirect } from 'next/navigation';

import { SignupForm } from '@/components/auth/signup-form';
import { getSession } from '@/lib/auth';

export default async function SignupPage() {
  const session = await getSession();

  if (session) {
    redirect('/');
  }

  return (
    <main
      className="flex min-h-screen items-center justify-center bg-[var(--background)] p-4"
      style={{
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
          <h1 className="text-3xl font-bold">Criar conta</h1>
          <p className="text-sm text-white/85">Cadastre-se para acessar a home do sistema.</p>
        </div>

        <SignupForm />
      </div>
    </main>
  );
}
