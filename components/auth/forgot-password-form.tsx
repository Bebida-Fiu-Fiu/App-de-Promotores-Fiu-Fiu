'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff } from 'lucide-react';

import { requestPasswordRecovery, verifyRecoveryCode, resetPassword } from '@/lib/actions';

const emailSchema = z.object({
  email: z.string().email('Digite um email válido'),
});

const codeSchema = z.object({
  code: z.string().length(6, 'O código deve ter 6 dígitos'),
});

const resetSchema = z.object({
  password: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres'),
  confirmPassword: z.string().min(8, 'Confirme sua senha'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

type EmailFormData = z.infer<typeof emailSchema>;
type CodeFormData = z.infer<typeof codeSchema>;
type ResetFormData = z.infer<typeof resetSchema>;

type Step = 'email' | 'code' | 'reset' | 'success';

// Frontend rate limiter tracking (up to 3 attempts per minute per action)
const checkRateLimit = (action: 'request' | 'verify' | 'reset'): boolean => {
  if (typeof window === 'undefined') return true;
  const now = Date.now();
  const key = `rate_limit_promoter_${action}`;
  const attemptsRaw = sessionStorage.getItem(key);
  let attempts: number[] = attemptsRaw ? JSON.parse(attemptsRaw) : [];
  
  // Filter out attempts older than 60 seconds
  attempts = attempts.filter((timestamp) => now - timestamp < 60000);
  
  if (attempts.length >= 3) {
    return false;
  }
  
  attempts.push(now);
  sessionStorage.setItem(key, JSON.stringify(attempts));
  return true;
};

function PasswordStrength({ password }: { password: string }) {
  const getStrength = () => {
    if (!password) return { level: 0, text: '', color: 'bg-white/10' };
    if (password.length < 8) return { level: 1, text: 'Fraca (mínimo 8 caracteres)', color: 'bg-red-500' };
    
    // Check complexity
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasNonalphas = /\W/.test(password);
    const score = [hasUpperCase, hasLowerCase, hasNumbers, hasNonalphas].filter(Boolean).length;
    
    if (password.length >= 12 && score >= 3) {
      return { level: 3, text: 'Forte', color: 'bg-green-500' };
    }
    if (password.length >= 8 && score >= 2) {
      return { level: 2, text: 'Média', color: 'bg-yellow-500' };
    }
    return { level: 1, text: 'Fraca', color: 'bg-red-500' };
  };

  const strength = getStrength();

  if (strength.level === 0) return null;

  return (
    <div className="mt-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full ${strength.color} transition-all duration-300`}
            style={{ width: `${(strength.level / 3) * 100}%` }}
          />
        </div>
        <span className="text-xs font-medium text-white/70">{strength.text}</span>
      </div>
    </div>
  );
}

function DigitCodeInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // Initialize value array
  const codeArray = value.split('').concat(Array(6).fill('')).slice(0, 6);

  useEffect(() => {
    // Focus the first input on mount
    inputsRef.current[0]?.focus();
  }, []);

  useEffect(() => {
    // If code was cleared externally, focus the first input
    if (value === '') {
      inputsRef.current[0]?.focus();
    }
  }, [value]);

  const handleChange = (val: string, index: number) => {
    // Only allow numbers
    if (val && !/^\d$/.test(val)) return;

    const newCodeArray = [...codeArray];
    newCodeArray[index] = val.slice(-1); // only take last char if user typed multiple
    const newCode = newCodeArray.join('');
    onChange(newCode);

    // Auto-focus next input
    if (val && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace') {
      if (!codeArray[index] && index > 0) {
        // Focus previous input if current is empty and clear it
        const newCodeArray = [...codeArray];
        newCodeArray[index - 1] = '';
        const newCode = newCodeArray.join('');
        onChange(newCode);
        inputsRef.current[index - 1]?.focus();
      } else {
        // Clear current input
        const newCodeArray = [...codeArray];
        newCodeArray[index] = '';
        const newCode = newCodeArray.join('');
        onChange(newCode);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();
    if (/^\d{6}$/.test(pastedData)) {
      onChange(pastedData);
      inputsRef.current[5]?.focus();
    }
  };

  return (
    <div className="flex justify-between gap-2">
      {Array.from({ length: 6 }).map((_, index) => (
        <input
          key={index}
          ref={(el) => {
            inputsRef.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={codeArray[index]}
          onChange={(e) => handleChange(e.target.value, index)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          onPaste={handlePaste}
          className="w-11 h-11 sm:w-12 sm:h-12 text-center text-2xl font-bold text-gray-900 bg-white border border-black/50 rounded-md focus:border-[#009c6c] focus:outline-none focus:ring-2 focus:ring-[#009c6c]/30 transition-all duration-200"
        />
      ))}
    </div>
  );
}

export function ForgotPasswordForm({ onSuccess }: { onSuccess?: () => void }) {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState<string>('');
  const [code, setCode] = useState<string>('');
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15 * 60);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const emailForm = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
  });

  const codeForm = useForm<CodeFormData>({
    resolver: zodResolver(codeSchema),
  });

  const resetForm = useForm<ResetFormData>({
    resolver: zodResolver(resetSchema),
  });

  // Countdown timer for code expiration
  useEffect(() => {
    if (step !== 'code') return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [step]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;

    const interval = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Auto-focus next field watcher
  const codeValue = codeForm.watch('code') || '';

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEmailSubmit = async (data: EmailFormData) => {
    if (!checkRateLimit('request')) {
      setServerError('Muitas tentativas. Tente novamente mais tarde.');
      return;
    }

    setIsLoading(true);
    setServerError(null);

    const result = await requestPasswordRecovery(data.email);

    if (!result.success) {
      setServerError(result.error || 'Erro ao solicitar código');
      setIsLoading(false);
      return;
    }

    setEmail(data.email);
    setTimeLeft(15 * 60);
    setResendCooldown(30); // Disable resend for first 30 seconds
    setStep('code');
    setIsLoading(false);
  };

  const handleResendCode = useCallback(async () => {
    if (resendCooldown > 0 || !email) return;

    if (!checkRateLimit('request')) {
      setServerError('Muitas tentativas de reenvio de código. Tente novamente mais tarde.');
      return;
    }

    setIsLoading(true);
    setServerError(null);

    const result = await requestPasswordRecovery(email);

    if (!result.success) {
      setServerError(result.error || 'Erro ao reenviar código');
      setIsLoading(false);
      return;
    }

    setTimeLeft(15 * 60);
    setResendCooldown(30); // reset 30s cooldown
    codeForm.setValue('code', ''); // clear input
    setIsLoading(false);
  }, [email, resendCooldown, codeForm]);

  const handleCodeSubmit = async (data: CodeFormData) => {
    if (!checkRateLimit('verify')) {
      setServerError('Muitas tentativas de verificação. Tente novamente mais tarde.');
      return;
    }

    setIsLoading(true);
    setServerError(null);

    const result = await verifyRecoveryCode(email, data.code);

    if (!result.success) {
      setServerError(result.error || 'Código inválido ou expirado');
      setIsLoading(false);
      codeForm.setValue('code', ''); // clear code input on invalid/expired code
      return;
    }

    setCode(data.code);
    setStep('reset');
    setIsLoading(false);
  };

  const handleResetSubmit = async (data: ResetFormData) => {
    if (!checkRateLimit('reset')) {
      setServerError('Muitas tentativas de redefinição de senha. Tente novamente mais tarde.');
      return;
    }

    setIsLoading(true);
    setServerError(null);

    const result = await resetPassword({
      email,
      code,
      password: data.password,
      confirmPassword: data.confirmPassword,
    });

    if (!result.success) {
      setServerError(result.error || 'Erro ao redefinir senha');
      setIsLoading(false);
      return;
    }

    setIsLoading(false);
    if (onSuccess) {
      onSuccess();
    } else {
      setStep('success');
    }
  };

  if (step === 'success') {
    return (
      <div className="space-y-6">
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          Sua senha foi redefinida com sucesso! Agora você pode fazer login com a nova senha.
        </div>

        <Link href="/promotor/signin" className="block w-full">
          <button
            type="button"
            className="w-full rounded-md bg-[#009c6c] px-4 py-2 font-semibold text-white transition hover:bg-[#00805a]"
          >
            Voltar para Login
          </button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {serverError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {serverError}
        </div>
      )}

      {step === 'email' && (
        <form onSubmit={emailForm.handleSubmit(handleEmailSubmit)} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-white">
              Email do Promotor
            </label>
            <input
              id="email"
              type="email"
              autoComplete="off"
              placeholder="seu@email.com"
              className="mt-1 block w-full rounded-md border border-black/50 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-[#009c6c] focus:outline-none focus:ring-2 focus:ring-[#009c6c]/30"
              {...emailForm.register('email')}
            />
            {emailForm.formState.errors.email && (
              <p className="mt-1 text-sm text-red-200">{emailForm.formState.errors.email.message}</p>
            )}
          </div>

          <p className="text-xs text-white/70">
            Se o email estiver registrado, você receberá um código de recuperação.
          </p>

          <button
            type="submit"
            disabled={emailForm.formState.isSubmitting || isLoading}
            className="w-full rounded-md bg-[#009c6c] px-4 py-2 font-semibold text-white transition hover:bg-[#00805a] disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {emailForm.formState.isSubmitting || isLoading ? 'Enviando...' : 'Enviar Código'}
          </button>
        </form>
      )}

      {step === 'code' && (
        <form onSubmit={codeForm.handleSubmit(handleCodeSubmit)} className="space-y-4">
          <div className="rounded-md bg-blue-50/20 border border-blue-200/50 px-3 py-2 text-sm text-white/85">
            Enviamos um código de 6 dígitos para <strong>{email}</strong>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-white">
                Código de Recuperação
              </label>
              <span className={`text-xs font-semibold ${timeLeft <= 60 ? 'text-red-300' : 'text-white/70'}`}>
                Expira em {formatTime(timeLeft)}
              </span>
            </div>
            
            <input type="hidden" {...codeForm.register('code')} />
            
            <DigitCodeInput
              value={codeValue}
              onChange={(val) => codeForm.setValue('code', val, { shouldValidate: true })}
            />

            {codeForm.formState.errors.code && (
              <p className="mt-2 text-sm text-red-200">{codeForm.formState.errors.code.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={codeForm.formState.isSubmitting || isLoading || codeValue.length !== 6}
            className="w-full rounded-md bg-[#009c6c] px-4 py-2 font-semibold text-white transition hover:bg-[#00805a] disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {codeForm.formState.isSubmitting || isLoading ? 'Verificando...' : 'Verificar Código'}
          </button>

          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-white/20" />
            <span className="text-xs text-white/70">ou</span>
            <div className="flex-1 h-px bg-white/20" />
          </div>

          <button
            type="button"
            onClick={handleResendCode}
            disabled={resendCooldown > 0 || isLoading}
            className={`w-full py-2 text-sm font-semibold transition-colors duration-200 ${
              resendCooldown > 0
                ? 'text-white/40 cursor-not-allowed'
                : 'text-white/85 hover:text-white underline underline-offset-4 decoration-white/20 hover:decoration-white'
            }`}
          >
            {resendCooldown > 0 ? `Reenviar código em ${resendCooldown}s` : 'Reenviar Código'}
          </button>

          <button
            type="button"
            onClick={() => {
              setStep('email');
              setServerError(null);
              emailForm.reset();
              codeForm.reset();
            }}
            className="w-full text-sm text-white/85 hover:text-white transition-colors duration-200 text-center"
          >
            Usar outro email
          </button>
        </form>
      )}

      {step === 'reset' && (
        <form onSubmit={resetForm.handleSubmit(handleResetSubmit)} className="space-y-4">
          <p className="text-xs text-white/80 font-medium font-sans">
            Requisitos: Mínimo 8 caracteres
          </p>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-white">
              Nova Senha
            </label>
            <div className="relative mt-1">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="off"
                placeholder="••••••••"
                className="block w-full rounded-md border border-black/50 bg-white px-3 py-2 pr-10 text-gray-900 shadow-sm focus:border-[#009c6c] focus:outline-none focus:ring-2 focus:ring-[#009c6c]/30"
                {...resetForm.register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-800 transition-colors"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {resetForm.formState.errors.password && (
              <p className="mt-1 text-sm text-red-200">{resetForm.formState.errors.password.message}</p>
            )}
            <PasswordStrength password={resetForm.watch('password') || ''} />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-white">
              Confirmar Senha
            </label>
            <div className="relative mt-1">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="off"
                placeholder="••••••••"
                className="block w-full rounded-md border border-black/50 bg-white px-3 py-2 pr-10 text-gray-900 shadow-sm focus:border-[#009c6c] focus:outline-none focus:ring-2 focus:ring-[#009c6c]/30"
                {...resetForm.register('confirmPassword')}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-800 transition-colors"
              >
                {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {resetForm.formState.errors.confirmPassword && (
              <p className="mt-1 text-sm text-red-200">{resetForm.formState.errors.confirmPassword.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={resetForm.formState.isSubmitting || isLoading}
            className="w-full rounded-md bg-[#009c6c] px-4 py-2 font-semibold text-white transition hover:bg-[#00805a] disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {resetForm.formState.isSubmitting || isLoading ? 'Redefinindo...' : 'Atualizar Senha'}
          </button>
        </form>
      )}

      {(step === 'email' || step === 'code' || step === 'reset') && (
        <p className="text-center text-sm text-white/85">
          Lembrou sua senha?{' '}
          <Link href="/promotor/signin" className="font-semibold text-white underline underline-offset-4 hover:text-white transition-colors duration-200">
            Voltar para Login
          </Link>
        </p>
      )}
    </div>
  );
}
