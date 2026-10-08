'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useApp } from '@/context/AppContext';
import { useLivro } from '@/context/LivroContext';
import { createClient } from '@/lib/supabase/client';
import { livroListarRespostas, livroObterTopico } from '@/lib/supabase/livro';
import { ehUuid, LIMITES, marcarRemovida, type LivroMensagem } from '@/lib/livro';
import { CartaoMensagem } from '@/components/livro/CartaoMensagem';
import { EditorLivro } from '@/components/livro/EditorLivro';
import { CienciaDasRegras } from '@/components/livro/RegrasCiencia';
import { PaginaNaoEncontrada } from '@/components/livro/PaginaNaoEncontrada';

export default function ConversaPage() {
  return (
    <AppShell>
      <Conversa />
    </AppShell>
  );
}

function Conversa() {
  const { id } = useParams<{ id: string }>();
  const { currentUser } = useApp();
  const { acesso, carregando, recarregar } = useLivro();
  const [supabase] = useState(() => createClient());
  const [topico, setTopico] = useState<LivroMensagem | null | undefined>(undefined);
  const [respostas, setRespostas] = useState<LivroMensagem[]>([]);
  const [temMais, setTemMais] = useState(false);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const podeLer = !!acesso?.podeLer;
  // URL com texto que não é UUID: o tópico simplesmente não existe (sem ir ao banco).
  const idValido = ehUuid(id ?? '');

  useEffect(() => {
    if (!podeLer || !id || !idValido) return;
    let cancelado = false;
    void (async () => {
      const [t, r] = await Promise.all([livroObterTopico(supabase, id), livroListarRespostas(supabase, id)]);
      if (cancelado) return;
      if (!t.ok) { setErro(t.erro); return; }
      if (!r.ok) { setErro(r.erro); return; }
      setErro(null);
      setTopico(t.dados);
      setRespostas(r.dados);
      setTemMais(r.dados.length >= LIMITES.respostasPorVez);
    })();
    return () => { cancelado = true; };
  }, [podeLer, id, idValido, supabase, tentativa]);

  const recarregarTudo = useCallback(() => { setTopico(undefined); setErro(null); setTentativa((t) => t + 1); }, []);

  const verMais = async () => {
    const ultima = respostas[respostas.length - 1];
    if (!ultima || carregandoMais) return;
    setCarregandoMais(true);
    const r = await livroListarRespostas(supabase, id, { em: ultima.criadaEm, id: ultima.id });
    setCarregandoMais(false);
    if (!r.ok) { setErro(r.erro); return; }
    setRespostas((atual) => [...atual, ...r.dados.filter((n) => !atual.some((x) => x.id === n.id))]);
    setTemMais(r.dados.length >= LIMITES.respostasPorVez);
  };

  // Depois de responder, carrega do ponto onde parou até a resposta nova aparecer (a ordem é do mais antigo ao mais novo).
  const aposResponder = async () => {
    let atuais = respostas;
    for (let i = 0; i < 10; i++) {
      const ultima = atuais[atuais.length - 1];
      const r = await livroListarRespostas(supabase, id, ultima ? { em: ultima.criadaEm, id: ultima.id } : undefined);
      if (!r.ok) { setErro(r.erro); return; }
      atuais = [...atuais, ...r.dados.filter((n) => !atuais.some((x) => x.id === n.id))];
      setRespostas(atuais);
      if (r.dados.length < LIMITES.respostasPorVez) { setTemMais(false); break; }
    }
    const t = await livroObterTopico(supabase, id);
    if (t.ok) setTopico(t.dados);
  };

  const voltar = (
    <Link href="/livro" className="inline-flex min-h-11 items-center gap-1 rounded-lg text-sm font-semibold text-accent-strong hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong">
      <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Voltar ao Livro
    </Link>
  );

  if (!currentUser || carregando || !acesso) return <div className="h-40 animate-pulse rounded-2xl bg-white motion-reduce:animate-none" role="status" aria-label="Carregando" />;
  if (acesso.modo === 'DESLIGADO' && !podeLer && !acesso.podeAlterarModo) return <PaginaNaoEncontrada />;
  if (!podeLer) {
    return (
      <div className="space-y-4">
        {voltar}
        <div role="status" className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
          <p className="text-base font-semibold text-slate-900">O Livro de reclamações não está disponível agora.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {voltar}
      {!idValido ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
          <p className="text-base font-semibold text-slate-900">Este tópico não existe mais.</p>
        </div>
      ) : erro ? (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p>{erro}</p>
          <button type="button" onClick={recarregarTudo} className="mt-2 min-h-11 rounded-lg border border-red-300 bg-white px-3 font-semibold">Tentar de novo</button>
        </div>
      ) : topico === undefined ? (
        <div className="space-y-3" role="status" aria-label="Carregando conversa">
          {[0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white motion-reduce:animate-none" />)}
        </div>
      ) : topico === null ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
          <p className="text-base font-semibold text-slate-900">Este tópico não existe mais.</p>
        </div>
      ) : (
        <>
          <CartaoMensagem msg={topico} acesso={acesso} supabase={supabase} onRemovida={() => setTopico((t) => (t ? marcarRemovida(t) : t))} />

          <h2 className="text-base font-bold text-slate-900">
            {topico.nRespostas === 0 ? 'Nenhuma resposta ainda' : topico.nRespostas === 1 ? '1 resposta' : `${topico.nRespostas} respostas`}
          </h2>
          {respostas.length > 0 && (
            <ul className="space-y-3">
              {respostas.map((r) => <li key={r.id}><CartaoMensagem msg={r} acesso={acesso} supabase={supabase} onRemovida={(rid) => setRespostas((l) => l.map((x) => (x.id === rid ? marcarRemovida(x) : x)))} /></li>)}
            </ul>
          )}
          {temMais && (
            <div className="flex justify-center">
              <button type="button" onClick={verMais} disabled={carregandoMais} className="min-h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong disabled:opacity-60">
                {carregandoMais ? 'Carregando...' : 'Ver mais respostas'}
              </button>
            </div>
          )}

          {acesso.podeEscrever && !topico.removida && (
            topico.nRespostas >= LIMITES.respostasPorTopico
              ? <p role="status" className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">Este tópico chegou ao limite. Abra um novo.</p>
              : acesso.cienciaOk
              ? <EditorLivro supabase={supabase} pai={topico.id} modo={acesso.modo} onPublicado={() => void aposResponder()} />
              : <CienciaDasRegras supabase={supabase} onAceito={recarregar} />
          )}
        </>
      )}
    </div>
  );
}
