'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Lock, ArrowRight, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function DefinirSenhaPage() {
  const supabase = createClient();
  const router = useRouter();

  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionValida, setSessionValida] = useState(false);
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSessionValida(!!session);
      setCheckingSession(false);
    });
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (senha.length < 6) {
      setError('A senha precisa ter no mínimo 6 caracteres.');
      return;
    }
    if (senha !== confirmarSenha) {
      setError('As senhas não coincidem.');
      return;
    }

    setIsLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password: senha });
    setIsLoading(false);

    if (updateError) {
      setError('Não foi possível salvar a senha. O link pode ter expirado — solicite um novo convite ou uma nova redefinição de senha.');
      return;
    }

    setSucesso(true);
    await supabase.auth.signOut();
    setTimeout(() => {
      router.push('/login?senhaCriada=1');
    }, 2000);
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-gradient-to-br from-[#07162c] via-[#0B2545] to-[#134074] py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
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
          Criar Senha de Acesso
        </h2>
        <p className="mt-2 text-center text-xs text-cyan-200">
          Defina a senha que você vai usar para entrar no Portal Condominial
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="rounded-3xl border border-white/10 bg-white/95 p-8 shadow-2xl backdrop-blur-xl">
          {checkingSession ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-[#0B2545]" />
            </div>
          ) : sucesso ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-slate-900">Senha criada com sucesso!</p>
              <p className="text-xs text-slate-500">Redirecionando para a tela de login...</p>
            </div>
          ) : !sessionValida ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-700">
                <AlertCircle className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-slate-900">Link inválido ou expirado</p>
              <p className="text-xs text-slate-500">
                Peça ao síndico para reenviar o convite, ou solicite uma nova redefinição de senha na tela de login.
              </p>
              <a href="/login" className="mt-2 text-xs font-medium text-[#0A6E9C] hover:underline">
                Voltar para o login
              </a>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="nova-senha" className="block text-xs font-semibold text-slate-700">Nova Senha</label>
                <div className="relative mt-1">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Lock className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    id="nova-senha"
                    type="password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="block w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="confirmar-senha" className="block text-xs font-semibold text-slate-700">Confirmar Senha</label>
                <div className="relative mt-1">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Lock className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    id="confirmar-senha"
                    type="password"
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
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

              <button
                type="submit"
                disabled={isLoading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0B2545] py-2.5 px-4 text-xs font-semibold text-white shadow-md transition hover:bg-[#134074] focus:outline-none focus:ring-2 focus:ring-[#00A8E8] disabled:opacity-60"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <span>Criar Senha e Continuar</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-cyan-100/70">
          Harmony Residence • Sistema Operacional e Convivência Digital
        </p>
      </div>
    </div>
  );
}
