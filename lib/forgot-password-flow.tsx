'use client';

import { useState } from 'react';
import { requestPasswordRecovery, verifyRecoveryCode, resetPassword } from '@/lib/actions';

type Step = 'email' | 'code' | 'reset' | 'success';

export function ForgotPasswordFlow({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<Step>('email');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    const res = await requestPasswordRecovery(email);
    setIsLoading(false);
    if (res.success) {
      setStep('code');
    } else {
      setError(res.error || 'Nao foi possivel enviar o codigo. Tente novamente mais tarde.');
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    const res = await verifyRecoveryCode(email, code);
    setIsLoading(false);
    if (res.success) {
      setStep('reset');
    } else {
      setError(res.error || 'Código inválido.');
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('As senhas nao coincidem.');
      return;
    }
    setIsLoading(true);
    setError(null);
    const res = await resetPassword({ email, code, password: newPassword, confirmPassword });
    setIsLoading(false);
    if (res.success) {
      setStep('success');
    } else {
      setError(res.error || 'Erro ao redefinir a senha.');
    }
  }

  if (step === 'success') {
    return (
      <div className="space-y-4 text-center p-4">
        <p className="text-green-600 font-medium">Senha redefinida com sucesso!</p>
        <button onClick={onBack} className="w-full bg-[#E30613] text-white p-2 rounded hover:bg-red-700 transition-colors">
          Voltar para o Login
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700 font-medium flex items-center">
          ← Voltar
        </button>
        <h2 className="text-xl font-bold">
          {step === 'email' && 'Recuperar Senha'}
          {step === 'code' && 'Verificar Código'}
          {step === 'reset' && 'Nova Senha'}
        </h2>
      </div>

      {error && (
        <div className="p-3 bg-red-100 text-red-700 text-sm rounded border border-red-200">
          {error}
        </div>
      )}

      {step === 'email' && (
        <form onSubmit={handleRequestCode} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">E-mail cadastrado</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border rounded p-2 focus:ring-2 focus:ring-red-500 outline-none"
              placeholder="seu@email.com"
              required
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#E30613] text-white p-2 rounded disabled:opacity-50 hover:bg-red-700 transition-colors"
          >
            {isLoading ? 'Enviando...' : 'Enviar Código'}
          </button>
        </form>
      )}

      {step === 'code' && (
        <form onSubmit={handleVerifyCode} className="space-y-4">
          <p className="text-sm text-gray-600">Enviamos um código de 6 dígitos para {email}.</p>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">Código</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full border rounded p-2 text-center tracking-[0.5em] text-2xl font-mono focus:ring-2 focus:ring-red-500 outline-none"
              placeholder="000000"
              required
            />
          </div>
          <button type="submit" disabled={isLoading} className="w-full bg-[#E30613] text-white p-2 rounded disabled:opacity-50 hover:bg-red-700">
            {isLoading ? 'Verificando...' : 'Verificar Código'}
          </button>
        </form>
      )}

      {step === 'reset' && (
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">Nova Senha</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full border rounded p-2 focus:ring-2 focus:ring-red-500 outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">Confirmar Nova Senha</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border rounded p-2 focus:ring-2 focus:ring-red-500 outline-none"
              required
            />
          </div>
          <button type="submit" disabled={isLoading} className="w-full bg-[#E30613] text-white p-2 rounded disabled:opacity-50 hover:bg-red-700">
            {isLoading ? 'Salvando...' : 'Redefinir Senha'}
          </button>
        </form>
      )}
    </div>
  );
}