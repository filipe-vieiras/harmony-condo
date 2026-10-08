'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Lock, ScrollText } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useApp } from '@/context/AppContext';
import { useLivro } from '@/context/LivroContext';
import { createClient } from '@/lib/supabase/client';
import { livroListarTopicos } from '@/lib/supabase/livro';
import { LIMITES, marcarRemovida, type LivroMensagem } from '@/lib/livro';
import { CartaoMensagem } from '@/components/livro/CartaoMensagem';
import { EditorLivro } from '@/components/livro/EditorLivro';
import { CienciaDasRegras, ListaDeRegras } from '@/components/livro/RegrasCiencia';
import { PainelModo } from '@/components/livro/PainelModo';
import { PaginaNaoEncontrada } from '@/components/livro/PaginaNaoEncontrada';

export default function LivroPage() {
  return (
    <AppShell>
      <LivroConteudo />
    </AppShell>
  );
}

function Esqueleto() {
  return (
    <div className="space-y-3" role="status" aria-label="Carregando mensagens">
      {[0, 1, 2].map((i) => <div key={i} className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white motion-reduce:animate-none" />)}
    </div>
  );
}

function LivroConteudo() {
  const { currentUser } = useApp();
  const { acesso, carregando, recarregar } = useLivro();
  const [supabase] = useState(() => createClient());
  const [topicos, setTopicos] = useState<LivroMensagem[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [temMais, setTemMais] = useState(false);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [mostrarRegras, setMostrarRegras] = useState(false);
  const podeLer = !!acesso?.podeLer;

  useEffect(() => {
    if (!podeLer) return;
    let cancelado = false;
    void (async () => {
      const r = await livroListarTopicos(supabase);
      if (cancelado) return;
      if (r.ok) { setTopicos(r.dados); setTemMais(r.dados.length >= LIMITES.topicosPorPagina); setErro(null); }
      else setErro(r.erro);
    })();
    return () => { cancelado = true; };
  }, [podeLer, supabase, tentativa]);

  const recarregarLista = useCallback(() => { setTopicos(null); setErro(null); setTentativa((t) => t + 1); }, []);

  const verMais = async () => {
    if (!topicos?.length || carregandoMais) return;
    const ultimo = topicos[topicos.length - 1];
    setCarregandoMais(true);
    const r = await livroListarTopicos(supabase, { em: ultimo.ultimaAtividadeEm, id: ultimo.id });
    setCarregandoMais(false);
    if (!r.ok) { setErro(r.erro); return; }
    setTopicos((atual) => [...(atual ?? []), ...r.dados.filter((n) => !(atual ?? []).some((x) => x.id === n.id))]);
    setTemMais(r.dados.length >= LIMITES.topicosPorPagina);
  };

  if (!currentUser || carregando || !acesso) return <Esqueleto />;
  // Desligado e quem não administra o interruptor: nada do livro aparece (nem título nem frase).
  if (acesso.modo === 'DESLIGADO' && !acesso.podeLer && !acesso.podeAlterarModo) return <PaginaNaoEncontrada />;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <BookOpen className="h-6 w-6 text-accent-strong" aria-hidden="true" /> Livro de reclamações
          </h1>
          <p className="mt-1 text-sm text-slate-600">Os moradores e a gestão podem responder aqui. Tudo o que é escrito fica visível, com nome e unidade.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setMostrarRegras((v) => !v)} aria-expanded={mostrarRegras} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong">
            <ScrollText className="h-4 w-4" aria-hidden="true" /> Regras de uso
          </button>
          {acesso.podeVerRegistro && podeLer && (
            <Link href="/livro/remocoes" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong">
              <Lock className="h-4 w-4" aria-hidden="true" /> Registro de remoções
            </Link>
          )}
        </div>
      </div>

      {mostrarRegras && (
        <section aria-label="Regras de uso do Livro" className="rounded-2xl border border-slate-200 bg-white p-4"><ListaDeRegras /></section>
      )}

      {acesso.podeAlterarModo && <PainelModo supabase={supabase} modo={acesso.modo} onMudou={recarregar} />}

      {!podeLer ? (
        <div role="status" className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
          <p className="text-base font-semibold text-slate-900">O Livro de reclamações não está disponível agora.</p>
          <p className="mt-1 text-sm text-slate-600">
            {acesso.podeAlterarModo ? 'Use o quadro acima para liberar o acesso.' : 'Assim que for liberado, ele aparece aqui.'}
          </p>
        </div>
      ) : (
        <>
          {acesso.podeEscrever && (acesso.cienciaOk
            ? <EditorLivro supabase={supabase} pai={null} modo={acesso.modo} onPublicado={recarregarLista} />
            : <CienciaDasRegras supabase={supabase} onAceito={recarregar} />)}

          {erro ? (
            <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <p>{erro}</p>
              <button type="button" onClick={recarregarLista} className="mt-2 min-h-11 rounded-lg border border-red-300 bg-white px-3 font-semibold">Tentar de novo</button>
            </div>
          ) : topicos === null ? (
            <Esqueleto />
          ) : topicos.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
              <p className="text-base font-semibold text-slate-900">Ainda não há mensagens.</p>
              {acesso.podeEscrever && <p className="mt-1 text-sm text-slate-600">Escreva a primeira.</p>}
            </div>
          ) : (
            <ul className="space-y-3">
              {topicos.map((t) => (
                <li key={t.id}><CartaoMensagem msg={t} acesso={acesso} supabase={supabase} resumido onRemovida={(id) => setTopicos((l) => (l ?? []).map((x) => (x.id === id ? marcarRemovida(x) : x)))} /></li>
              ))}
            </ul>
          )}

          {temMais && topicos && !erro && (
            <div className="flex justify-center">
              <button type="button" onClick={verMais} disabled={carregandoMais} className="min-h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong disabled:opacity-60">
                {carregandoMais ? 'Carregando...' : 'Ver mais tópicos'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
