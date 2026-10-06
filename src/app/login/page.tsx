'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Lock, Mail, ArrowRight, Loader2, AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';

function traduzirErroReset(message: string): string {
  if (message.toLowerCase().includes('rate limit')) {
    return 'Limite de envio de e-mails do Supabase atingido. Aguarde alguns minutos e tente novamente.';
  }
  return 'Não foi possível enviar o link de redefinição de senha. Tente novamente em instantes.';
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const [supabase] = useState(() => createClient());
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const senhaCriada = searchParams.get('senhaCriada') === '1';
  // Voltou para cá porque o acesso foi removido (ex.: saiu do cargo de Zelador) ou a conta não tem mais perfil.
  const acessoEncerrado = searchParams.get('encerrado') === '1';
  const MSG_ENCERRADO = 'Seu acesso a este condomínio foi encerrado. Fale com a administração.';
  const [cadastroAberto, setCadastroAberto] = useState(false);

  useEffect(() => {
    fetch('/api/autocadastro/publico')
      .then((r) => r.json())
      .then((body) => setCadastroAberto(!!body.aberto))
      .catch(() => {});
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setIsLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      // Conta com acesso removido (ban no Auth): só chega aqui quem acertou a senha, então a mensagem não revela nada a terceiros.
      const banida = authError.code === 'user_banned' || /banned/i.test(authError.message);
      setError(banida ? MSG_ENCERRADO : 'E-mail ou senha incorretos. Verifique suas credenciais.');
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
    setError(null);
    setSuccessMsg(null);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/api/auth/callback?next=/definir-senha`,
    });
    setIsLoading(false);

    if (resetError) {
      setError(traduzirErroReset(resetError.message));
      return;
    }

    setSuccessMsg(`Link de redefinição de senha enviado para ${email}.`);
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-gradient-to-br from-primary-deep via-primary to-primary-hover py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">

        {/* LOGO OFICIAL — Requisito: No login */}
        <div className="flex justify-center">
          <Image
            src="/images/logo.png"
            alt="Harmony Residence Logo"
            width={562}
            height={508}
            preload
            className="h-28 w-auto rounded-3xl object-contain shadow-2xl ring-1 ring-white/20"
          />
        </div>

        <h2 className="mt-6 text-center text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Portal Condominial
        </h2>
        <p className="mt-2 text-center text-xs text-cyan-200">
          Acesso seguro para Síndico, Portaria, Conselho e Moradores
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="rounded-3xl border border-white/10 bg-white p-8 shadow-2xl">

          <form className="space-y-4" onSubmit={handleLogin}>
            {acessoEncerrado && (
              <div role="alert" className="flex items-start gap-2 rounded-xl border border-pendente-200 bg-pendente-50 p-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-pendente-700" />
                <p className="text-xs text-pendente-900">{MSG_ENCERRADO}</p>
              </div>
            )}
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
                  <Mail className="h-4 w-4 text-slate-500" />
                </div>
                <input
                  type="email"
                  id="email"
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu.email@condominio.com"
                  required
                  className="block w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-xs text-slate-900 placeholder:text-slate-500 focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-strong/30"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-slate-700">
                Senha de Acesso
              </label>
              <div className="relative mt-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Lock className="h-4 w-4 text-slate-500" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="block w-full rounded-xl border border-slate-200 bg-white pl-9 pr-11 py-2.5 text-xs text-slate-900 placeholder:text-slate-500 focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-strong/30"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-slate-500 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                <p className="text-xs text-red-700">{error}</p>
              </div>
            )}

            {successMsg && (
              <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <p className="text-xs text-emerald-800">{successMsg}</p>
              </div>
            )}

            <div className="flex items-center justify-end text-xs">
              <button
                type="button"
                onClick={handleForgotPassword}
                className="inline-flex min-h-11 items-center font-medium text-accent-strong hover:underline sm:min-h-0"
              >
                Esqueceu a senha?
              </button>
            </div>

            <button
              type="submit"
              id="btn-login"
              disabled={isLoading}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 px-4 sm:min-h-0 text-xs font-semibold text-white shadow-md transition hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <span>Entrar</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-[12px] text-slate-500">
            {cadastroAberto ? (
              <>
                Primeiro acesso?{' '}
                <a href="/cadastro" className="inline-flex min-h-11 items-center font-semibold text-accent-strong hover:underline sm:min-h-0">Cadastre a sua unidade</a>
              </>
            ) : (
              'Não tem acesso? Entre em contato com o síndico do condomínio.'
            )}
          </p>
        </div>

        <p className="mt-4 text-center text-xs text-cyan-100/70">
          Harmony Residence • Sistema Operacional e Convivência Digital
        </p>
      </div>
    </div>
  );
}
