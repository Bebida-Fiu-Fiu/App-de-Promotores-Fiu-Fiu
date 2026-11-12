'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { signUp } from '@/lib/actions';

const signupSchema = z
  .object({
    fullName: z.string().min(3, 'Digite o nome completo'),
    email: z.string().email('Digite um email valido'),
    password: z.string().min(6, 'A senha precisa ter pelo menos 6 caracteres'),
    confirmPassword: z.string().min(6, 'Confirme a senha'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas precisam ser iguais',
    path: ['confirmPassword'],
  });

type SignupFormData = z.infer<typeof signupSchema>;

export function SignupForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  });

  const onSubmit = async (data: SignupFormData) => {
    setServerError(null);

    const result = await signUp(data);

    if (!result.success) {
      setServerError(result.error ?? 'Nao foi possivel criar a conta.');
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
          <label htmlFor="fullName" className="block text-sm font-medium text-white">
            Nome completo
          </label>
          <input
            id="fullName"
            type="text"
            autoComplete="name"
            className="mt-1 block w-full rounded-md border border-black/50 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-[#009c6c] focus:outline-none focus:ring-2 focus:ring-[#009c6c]/30"
            {...register('fullName')}
          />
          {errors.fullName && (
            <p className="mt-1 text-sm text-red-200">{errors.fullName.message}</p>
          )}
        </div>

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
            autoComplete="new-password"
            className="mt-1 block w-full rounded-md border border-black/50 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-[#009c6c] focus:outline-none focus:ring-2 focus:ring-[#009c6c]/30"
            {...register('password')}
          />
          {errors.password && (
            <p className="mt-1 text-sm text-red-200">{errors.password.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-white">
            Confirmar senha
          </label>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            className="mt-1 block w-full rounded-md border border-black/50 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-[#009c6c] focus:outline-none focus:ring-2 focus:ring-[#009c6c]/30"
            {...register('confirmPassword')}
          />
          {errors.confirmPassword && (
            <p className="mt-1 text-sm text-red-200">{errors.confirmPassword.message}</p>
          )}
        </div>

      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-md bg-[#009c6c] px-4 py-2 font-semibold text-white transition hover:bg-[#00805a] disabled:cursor-not-allowed disabled:bg-gray-400"
      >
        {isSubmitting ? 'Criando conta...' : 'Criar conta'}
      </button>

      <p className="text-center text-sm text-white/85">
        Ja tem conta?{' '}
        <Link href="/login" className="font-semibold text-white underline underline-offset-4">
          Entrar
        </Link>
      </p>
    </form>
  );
}
