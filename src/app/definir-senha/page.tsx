'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Lock, ArrowRight, Loader2, AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { ehTipoLinkAcesso, type TipoLinkAcesso } from '@/lib/linkAcesso';

export default function DefinirSenhaPage() {
  // Criado uma única vez por montagem (não a cada render): essa página
  // processa o token efêmero do fragmento da URL (#access_token=...) e um
  // segundo client recriado no meio do processo pode "roubar" essa leitura
  // única, fazendo o primeiro perder a sessão.
  const [supabase] = useState(() => createClient());
  const router = useRouter();

  const [checkingSession, setCheckingSession] = useState(true);
  // Link novo (?token_hash=…&type=…): o token só é gasto quando a pessoa toca em
  // "Continuar". Robôs de pré-visualização (WhatsApp, e-mail) apenas leem esta
  // página — se gastássemos ao abrir, o morador encontraria o link já usado.
  const [tokenPendente, setTokenPendente] = useState<{ tokenHash: string; tipo: TipoLinkAcesso } | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [sessionValida, setSessionValida] = useState(false);
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  useEffect(() => {
    // O link de convite/redefinição chega com o token no fragmento da URL
    // (#access_token=...&refresh_token=...). A detecção automática do client
    // do Supabase (detectSessionInUrl) se mostrou não-confiável aqui — então
    // processamos o fragmento manualmente e chamamos setSession() direto,
    // que é a API pública documentada pra estabelecer uma sessão a partir de
    // tokens já em mãos.
    const consulta = new URLSearchParams(window.location.search);
    const tokenHash = consulta.get('token_hash');
    const tipo = consulta.get('type');
    if (tokenHash && ehTipoLinkAcesso(tipo)) {
      setTokenPendente({ tokenHash, tipo });
      setCheckingSession(false);
      return;
    }

    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');
    const hashError = hashParams.get('error_description');

    if (accessToken && refreshToken) {
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(({ data, error }) => {
        setSessionValida(!!data.session && !error);
        setCheckingSession(false);
        // Limpa o token da barra de endereço — já foi consumido, não precisa
        // continuar exposto (e reaparecer no histórico do navegador).
        window.history.replaceState(null, '', window.location.pathname);
      });
      return;
    }

    if (hashError) {
      setSessionValida(false);
      setCheckingSession(false);
      return;
    }

    // Sem token no fragmento: verifica se já existe uma sessão válida (ex:
    // usuário recarregou a página depois de já ter processado o link).
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSessionValida(!!session);
      setCheckingSession(false);
    });
  }, [supabase]);

  const confirmarLink = async () => {
    if (!tokenPendente) return;
    setVerificando(true);
    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: tokenPendente.tokenHash,
      type: tokenPendente.tipo,
    });
    setVerificando(false);
    // Tira o token do endereço: já foi consumido (ou rejeitado).
    window.history.replaceState(null, '', window.location.pathname);
    setTokenPendente(null);
    if (verifyError || !data.session) {
      setSessionValida(false);
      return;
    }
    setSessionValida(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (senha.length < 8) {
      setError('A senha precisa ter no mínimo 8 caracteres.');
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
    <div className="flex min-h-screen flex-col justify-center bg-gradient-to-br from-primary-deep via-primary to-primary-hover py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
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
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : sucesso ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-slate-900">Senha criada com sucesso!</p>
              <p className="text-xs text-slate-500">Redirecionando para a tela de login...</p>
            </div>
          ) : tokenPendente ? (
            <div className="flex flex-col items-center gap-3 py-2 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-100 text-accent-strong">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-slate-900">
                {tokenPendente.tipo === 'invite' ? 'Seu acesso está pronto' : 'Redefinir sua senha'}
              </p>
              <p className="text-xs text-slate-500">
                Toque no botão abaixo para validar o link e criar sua senha.
              </p>
              <button
                type="button"
                onClick={confirmarLink}
                disabled={verificando}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 px-4 text-xs font-semibold text-white shadow-md transition hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
              >
                {verificando ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <span>Continuar</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          ) : !sessionValida ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-700">
                <AlertCircle className="h-6 w-6" />
              </div>
              {/* O Supabase usa o mesmo erro (otp_expired) para link já usado e vencido. */}
              <p className="text-sm font-semibold text-slate-900">Este link já foi usado ou venceu</p>
              <p className="text-xs text-slate-500">
                Cada link vale uma vez só, e gerar um link novo cancela o anterior. Peça ao síndico para gerar um novo (Usuários &amp; Convites → Redefinir Senha), ou use &quot;Esqueceu a senha?&quot; na tela de login.
              </p>
              <a href="/login" className="mt-2 text-xs font-medium text-accent-strong hover:underline">
                Voltar para o login
              </a>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="nova-senha" className="block text-xs font-semibold text-slate-700">Nova Senha</label>
                <div className="relative mt-1">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Lock className="h-4 w-4 text-slate-500" />
                  </div>
                  <input
                    id="nova-senha"
                    type="password"
                    autoComplete="new-password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={8}
                    className="block w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-xs text-slate-900 placeholder:text-slate-500 focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-strong/30"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="confirmar-senha" className="block text-xs font-semibold text-slate-700">Confirmar Senha</label>
                <div className="relative mt-1">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Lock className="h-4 w-4 text-slate-500" />
                  </div>
                  <input
                    id="confirmar-senha"
                    type="password"
                    autoComplete="new-password"
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={8}
                    className="block w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-xs text-slate-900 placeholder:text-slate-500 focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-strong/30"
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
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 px-4 text-xs font-semibold text-white shadow-md transition hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
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
