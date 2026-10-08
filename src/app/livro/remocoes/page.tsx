'use client';

// Registro de remoções: o contrapeso ao poder de apagar. Só Síndico, Subsíndico, ADM e Conselho (o banco recusa os demais).
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, ChevronLeft } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useApp } from '@/context/AppContext';
import { useLivro } from '@/context/LivroContext';
import { createClient } from '@/lib/supabase/client';
import { PaginaNaoEncontrada } from '@/components/livro/PaginaNaoEncontrada';
import { livroRegistroRemocoes } from '@/lib/supabase/livro';
import { ROTULO_MOTIVO, type LivroRemocao } from '@/lib/livro';
import { ROLE_LABELS_CURTO } from '@/lib/roles';
import type { Role } from '@/types';

export default function RegistroPage() {
  return (
    <AppShell>
      <Registro />
    </AppShell>
  );
}

const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

function Registro() {
  const { currentUser } = useApp();
  const { acesso, carregando } = useLivro();
  const [supabase] = useState(() => createClient());
  const [itens, setItens] = useState<LivroRemocao[] | null>(null);
  const [resumo, setResumo] = useState<{ papel: string; total: number }[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [temMais, setTemMais] = useState(false);
  const permitido = !!acesso?.podeVerRegistro;

  useEffect(() => {
    if (!permitido) return;
    let cancelado = false;
    void (async () => {
      const r = await livroRegistroRemocoes(supabase);
      if (cancelado) return;
      if (!r.ok) { setErro(r.erro); return; }
      setErro(null);
      setItens(r.dados.itens);
      setResumo(r.dados.resumo);
      setTemMais(r.dados.itens.length >= 30);
    })();
    return () => { cancelado = true; };
  }, [permitido, supabase, tentativa]);

  const verMais = async () => {
    const ultimo = itens?.[itens.length - 1];
    if (!ultimo) return;
    const r = await livroRegistroRemocoes(supabase, ultimo.removidaEm);
    if (!r.ok) { setErro(r.erro); return; }
    setItens((atual) => [...(atual ?? []), ...r.dados.itens.filter((n) => !(atual ?? []).some((x) => x.id === n.id))]);
    setTemMais(r.dados.itens.length >= 30);
  };

  const voltar = (
    <Link href="/livro" className="inline-flex min-h-11 items-center gap-1 rounded-lg text-sm font-semibold text-accent-strong hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong">
      <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Voltar ao Livro
    </Link>
  );

  if (!currentUser || carregando || !acesso) return <div className="h-40 animate-pulse rounded-2xl bg-white motion-reduce:animate-none" role="status" aria-label="Carregando" />;
  if (acesso.modo === 'DESLIGADO' && !acesso.podeAlterarModo) return <PaginaNaoEncontrada />;
  if (!permitido && acesso.modo === 'DESLIGADO') {
    return (
      <div className="space-y-4">
        {voltar}
        <div role="status" className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
          <p className="text-base font-semibold text-slate-900">Livro desligado</p>
          <p className="mt-1 text-sm text-slate-600">Ligue o Livro na tela principal para ver o registro de remoções.</p>
        </div>
      </div>
    );
  }
  if (!permitido) {
    return (
      <div className="space-y-4">
        {voltar}
        <div role="status" className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
          <p className="text-base font-semibold text-slate-900">Sem acesso ao registro de remoções.</p>
          <p className="mt-1 text-sm text-slate-600">Ele é lido só pela gestão e pelo Conselho.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {voltar}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Registro de remoções</h1>
        <p className="mt-1 text-sm text-slate-600">
          Toda mensagem removida do Livro fica aqui, com quem removeu e por quê. O texto original aparece por 90 dias e depois é apagado. Este registro não pode ser editado.
        </p>
      </div>

      {resumo.length > 0 && (
        <section aria-label="Remoções nos últimos 30 dias" className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-bold text-slate-900">Últimos 30 dias</h2>
          <ul className="mt-2 flex flex-wrap gap-2 text-sm">
            {resumo.map((r) => (
              <li key={r.papel} className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                {r.papel === 'AUTOR' ? 'Pelo próprio autor' : ROLE_LABELS_CURTO[r.papel as Role] ?? r.papel}: {r.total}
              </li>
            ))}
          </ul>
        </section>
      )}

      {erro ? (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p>{erro}</p>
          <button type="button" onClick={() => { setErro(null); setItens(null); setTentativa((t) => t + 1); }} className="mt-2 min-h-11 rounded-lg border border-red-300 bg-white px-3 font-semibold">Tentar de novo</button>
        </div>
      ) : itens === null ? (
        <div className="space-y-3" role="status" aria-label="Carregando registro">
          {[0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white motion-reduce:animate-none" />)}
        </div>
      ) : itens.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-base font-semibold text-slate-900">Nenhuma mensagem foi removida.</div>
      ) : (
        <ul className="space-y-3">
          {itens.map((i) => (
            <li key={i.id} className={`rounded-2xl border bg-white p-4 shadow-xs ${i.citavaQuemRemoveu && i.motivo !== 'AUTOR' ? 'border-pendente-400' : 'border-slate-200'}`}>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-bold text-slate-900">{i.tipo === 'TOPICO' ? 'Tópico' : 'Resposta'} de {i.autorNome}{i.autorUnidade ? ` (${i.autorUnidade})` : ''}</span>
                <time dateTime={i.removidaEm} className="text-slate-600">{quando(i.removidaEm)}</time>
              </div>
              <p className="mt-1 text-sm text-slate-700">
                Removida por <strong>{i.removidoPorNome}</strong> ({ROLE_LABELS_CURTO[i.removidoPorPapel as Role] ?? i.removidoPorPapel}). Motivo: {ROTULO_MOTIVO[i.motivo] ?? i.motivo}.
              </p>
              {/* Contrapeso: quem apaga uma crítica feita a si mesmo precisa ser notado por quem não modera. */}
              {i.citavaQuemRemoveu && i.motivo !== 'AUTOR' && (
                <p className="mt-2 flex items-start gap-2 rounded-xl bg-pendente-50 p-3 text-sm font-semibold text-pendente-900">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  Esta mensagem citava quem a removeu.
                </p>
              )}
              {i.textoOriginal !== null ? (
                <details className="mt-2">
                  <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold text-accent-strong">Ver o texto removido</summary>
                  <p className="mt-1 whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 text-base text-slate-800">{i.textoOriginal}</p>
                  <p className="mt-1 text-sm text-slate-600">Visível até {new Date(i.textoExpiraEm).toLocaleDateString('pt-BR')}.</p>
                </details>
              ) : (
                <p className="mt-2 text-sm text-slate-600">O texto original já foi apagado (prazo de 90 dias).</p>
              )}
              <Link href={`/livro/${i.topicoId}`} className="mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-accent-strong hover:underline">Abrir a conversa</Link>
            </li>
          ))}
        </ul>
      )}
      {temMais && !erro && (
        <div className="flex justify-center">
          <button type="button" onClick={verMais} className="min-h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong">Ver mais</button>
        </div>
      )}
    </div>
  );
}
