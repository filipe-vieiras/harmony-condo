'use client';

// Folha "Citar": escolhe unidades e cargos para avisar. No celular ocupa a tela toda. A lista vem do banco
// (livro_citaveis) só com código opaco, tipo e rótulo: não mostra o nome de quem mora na unidade.
import React, { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Search, X } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { LIMITES, type LivroCitavel } from '@/lib/livro';
import { livroCitaveis } from '@/lib/supabase/livro';
import { useEscapeToClose } from '@/lib/useEscapeToClose';
import { useModalFocus } from '@/lib/useModalFocus';

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

interface Props {
  supabase: SupabaseClient;
  escolhidos: LivroCitavel[];
  onConfirmar: (lista: LivroCitavel[]) => void;
  onFechar: () => void;
}

export function FolhaCitar({ supabase, escolhidos, onConfirmar, onFechar }: Props) {
  const [lista, setLista] = useState<LivroCitavel[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [marcados, setMarcados] = useState<LivroCitavel[]>(escolhidos);
  const [tentativa, setTentativa] = useState(0);

  useEscapeToClose(true, onFechar);
  useModalFocus(true);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      const r = await livroCitaveis(supabase);
      if (cancelado) return;
      if (r.ok) { setLista(r.dados); setErro(null); } else setErro(r.erro);
    })();
    return () => { cancelado = true; };
  }, [supabase, tentativa]);

  const filtrada = useMemo(() => {
    const q = semAcento(busca.trim());
    return (lista ?? []).filter((c) => !q || semAcento(c.rotulo).includes(q));
  }, [lista, busca]);
  const unidades = filtrada.filter((c) => c.tipo === 'UNIDADE');
  const cargos = filtrada.filter((c) => c.tipo === 'PESSOA');
  const cheio = marcados.length >= LIMITES.citadosMax;

  const alternar = (c: LivroCitavel) => {
    setMarcados((atual) => {
      if (atual.some((x) => x.ref === c.ref)) return atual.filter((x) => x.ref !== c.ref);
      return atual.length >= LIMITES.citadosMax ? atual : [...atual, c];
    });
  };

  const linha = (c: LivroCitavel) => {
    const on = marcados.some((x) => x.ref === c.ref);
    const bloqueado = !on && cheio;
    return (
      <li key={c.ref}>
        <button
          type="button"
          onClick={() => alternar(c)}
          disabled={bloqueado}
          aria-pressed={on}
          className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-2 text-left text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong disabled:opacity-50 ${
            on ? 'border-accent-strong bg-accent-50 font-semibold text-accent-900' : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
          }`}
        >
          <span className="break-words">{c.rotulo}</span>
          {on && <Check className="h-4 w-4 shrink-0 text-accent-strong" aria-hidden="true" />}
        </button>
      </li>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={onFechar} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="folha-citar-titulo"
        className="relative flex h-dvh w-full flex-col bg-white shadow-2xl sm:h-auto sm:max-h-[85vh] sm:max-w-lg sm:rounded-2xl"
      >
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <h2 id="folha-citar-titulo" tabIndex={-1} className="text-base font-bold text-slate-900">Citar unidade ou cargo</h2>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="flex size-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 border-b border-slate-100 px-4 py-3">
          <p className="text-sm text-slate-600">
            Quem você citar recebe um aviso no sino. Até {LIMITES.citadosMax} por mensagem. Digitar um nome no texto não avisa ninguém.
          </p>
          <div className="relative">
            <label htmlFor="citar-busca" className="sr-only">Buscar unidade ou cargo</label>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              id="citar-busca"
              type="search"
              inputMode="search"
              autoComplete="off"
              placeholder="Buscar: A-101, Síndico..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-base focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-strong/30"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {erro ? (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <p>{erro}</p>
              <button type="button" onClick={() => { setErro(null); setTentativa((t) => t + 1); }} className="mt-2 min-h-11 rounded-lg border border-red-300 bg-white px-3 font-semibold">Tentar de novo</button>
            </div>
          ) : lista === null ? (
            <div role="status" className="flex items-center gap-2 py-6 text-sm text-slate-600"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Carregando...</div>
          ) : filtrada.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-600">Nenhuma unidade ou cargo encontrado.</p>
          ) : (
            <div className="space-y-4">
              {cargos.length > 0 && (
                <section aria-labelledby="citar-cargos">
                  <h3 id="citar-cargos" className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Cargos</h3>
                  <ul className="space-y-1.5">{cargos.map(linha)}</ul>
                </section>
              )}
              {unidades.length > 0 && (
                <section aria-labelledby="citar-unidades">
                  <h3 id="citar-unidades" className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Unidades</h3>
                  <ul className="space-y-1.5">{unidades.map(linha)}</ul>
                </section>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <span className="text-sm text-slate-600" aria-live="polite">{marcados.length} de {LIMITES.citadosMax}</span>
          <button
            type="button"
            onClick={() => onConfirmar(marcados)}
            className="min-h-11 rounded-xl bg-primary px-5 text-sm font-semibold text-white transition hover:bg-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong focus-visible:ring-offset-2"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
}
