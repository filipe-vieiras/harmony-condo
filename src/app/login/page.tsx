'use client';

import React, { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Lock, Mail, ArrowRight, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const senhaCriada = searchParams.get('senhaCriada') === '1';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError('E-mail ou senha incorretos. Verifique suas credenciais.');
      setIsLoading(false);
      return;
    }

    // O middleware irá redirecionar automaticamente para / após o login
    window.location.href = '/';
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Digite seu e-mail acima para receber o link de redefinição de senha.');
      return;
    }
    setIsLoading(true);
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/api/auth/callback?next=/definir-senha`,
    });
    setIsLoading(false);
    setError(null);
    alert(`Link de redefinição de senha enviado para ${email}`);
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-gradient-to-br from-[#07162c] via-[#0B2545] to-[#134074] py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">

        {/* LOGO OFICIAL — Requisito: No login */}
        <div className="flex justify-center">
          <div className="rounded-3xl bg-white/10 p-4 shadow-2xl backdrop-blur-md ring-1 ring-white/20">
            <img
              src="/images/logo.png"
              alt="Harmony Residence Logo"
              className="h-28 w-auto object-contain drop-shadow-md"
            />
          </div>
        </div>

        <h2 className="mt-6 text-center text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Portal Condominial
        </h2>
        <p className="mt-2 text-center text-xs text-cyan-200">
          Acesso seguro para Síndico, Portaria, Conselho e Moradores
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="rounded-3xl border border-white/10 bg-white/95 p-8 shadow-2xl backdrop-blur-xl">

          <form className="space-y-4" onSubmit={handleLogin}>
            {senhaCriada && (
              <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <p className="text-xs text-emerald-800">Senha criada com sucesso! Faça login com sua nova senha.</p>
              </div>
            )}
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-slate-700">
                E-mail Cadastrado
              </label>
              <div className="relative mt-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Mail className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu.email@condominio.com"
                  required
                  className="block w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-slate-700">
                Senha de Acesso
              </label>
              <div className="relative mt-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="block w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                <p className="text-xs text-red-700">{error}</p>
              </div>
            )}

            <div className="flex items-center justify-end text-xs">
              <button
                type="button"
                onClick={handleForgotPassword}
                className="font-medium text-[#0A6E9C] hover:underline"
              >
                Esqueceu a senha?
              </button>
            </div>

            <button
              type="submit"
              id="btn-login"
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0B2545] py-2.5 px-4 text-xs font-semibold text-white shadow-md transition hover:bg-[#134074] focus:outline-none focus:ring-2 focus:ring-[#00A8E8] disabled:opacity-60"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <span>Entrar no Sistema</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-[11px] text-slate-500">
            Não tem acesso? Entre em contato com o síndico do condomínio.
          </p>
        </div>

        <p className="mt-4 text-center text-xs text-cyan-100/70">
          Harmony Residence • Sistema Operacional e Convivência Digital
        </p>
      </div>
    </div>
  );
}
