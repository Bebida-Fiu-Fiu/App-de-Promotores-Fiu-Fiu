'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { login } from '@/lib/actions';

const loginSchema = z.object({
  email: z.string().email('Digite um email valido'),
  password: z.string().min(6, 'A senha precisa ter pelo menos 6 caracteres'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setServerError(null);

    const result = await login(data);

    if (!result.success) {
      setServerError(result.error ?? 'Nao foi possivel entrar.');
      return;
    }

    router.push(result.homePath ?? '/promotor');
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {serverError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {serverError}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-white">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className="mt-1 block w-full rounded-md border border-black/50 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-[#009c6c] focus:outline-none focus:ring-2 focus:ring-[#009c6c]/30"
            {...register('email')}
          />
          {errors.email && <p className="mt-1 text-sm text-red-200">{errors.email.message}</p>}
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-white">
            Senha
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            className="mt-1 block w-full rounded-md border border-black/50 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-[#009c6c] focus:outline-none focus:ring-2 focus:ring-[#009c6c]/30"
            {...register('password')}
          />
          {errors.password && (
            <p className="mt-1 text-sm text-red-200">{errors.password.message}</p>
          )}
        </div>

      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-md bg-[#009c6c] px-4 py-2 font-semibold text-white transition hover:bg-[#00805a] disabled:cursor-not-allowed disabled:bg-gray-400"
      >
        {isSubmitting ? 'Entrando...' : 'Entrar'}
      </button>

      <p className="text-center text-sm text-white/85">
        Ainda nao tem conta?{' '}
        <Link href="/signup" className="font-semibold text-white underline underline-offset-4">
          Criar conta
        </Link>
      </p>
    </form>
  );
}
