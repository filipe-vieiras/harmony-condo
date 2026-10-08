'use client';

// Editor do Livro (tópico novo ou resposta). O aviso de que o espaço é aberto fica sempre à vista. O texto digitado nunca
// se perde se o envio falhar. Citação só pelo botão "Citar" (lista estruturada): o "@" no texto não avisa ninguém.
import React, { useRef, useState, useSyncExternalStore } from 'react';
import { Loader2, Quote, Send, WifiOff, X } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { avisoDoEditor, LIMITES, tamanhoDoTexto, temDadoPessoal, type LivroCitavel, type LivroModo } from '@/lib/livro';
import { livroPublicar } from '@/lib/supabase/livro';
import { limparTextoLivre, textoVazio } from '@/lib/textoLivre';
import { FolhaCitar } from '@/components/livro/FolhaCitar';

const assinarConexao = (cb: () => void) => {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => { window.removeEventListener('online', cb); window.removeEventListener('offline', cb); };
};
const useOnline = () => useSyncExternalStore(assinarConexao, () => navigator.onLine, () => true);

interface Props {
  supabase: SupabaseClient;
  /** Id do tópico quando é resposta; nulo para tópico novo. */
  pai: string | null;
  /** Modo do livro: muda o aviso fixo (em EQUIPE é teste da gestão). */
  modo?: LivroModo;
  onPublicado: (topicoId: string) => void;
}

export function EditorLivro({ supabase, pai, modo, onPublicado }: Props) {
  const resposta = pai !== null;
  const min = resposta ? LIMITES.respostaMin : LIMITES.topicoMin;
  const max = resposta ? LIMITES.respostaMax : LIMITES.topicoMax;
  const [texto, setTexto] = useState('');
  const [citados, setCitados] = useState<LivroCitavel[]>([]);
  const [citarAberto, setCitarAberto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const online = useOnline();
  // Trava síncrona contra duplo toque (o estado só muda no próximo render).
  const enviandoRef = useRef(false);
  const campoRef = useRef<HTMLTextAreaElement>(null);
  // Botão que abriu a folha, guardado por referência: no Safari o toque não foca o botão, então o foco não voltaria a ele sozinho.
  const citarBtnRef = useRef<HTMLButtonElement>(null);
  const fecharCitar = () => {
    setCitarAberto(false);
    requestAnimationFrame(() => citarBtnRef.current?.focus());
  };

  // O banco limpa de novo (é quem vale); aqui o contador mostra o que vai ser gravado.
  const limpo = limparTextoLivre(texto).replace(/\r/g, '').replace(/\u0000/g, '').trim();
  const tam = tamanhoDoTexto(limpo);
  const dadoPessoal = temDadoPessoal(limpo);
  const valido = !textoVazio(limpo) && tam >= min && tam <= max && !dadoPessoal;
  const pertoDoLimite = tam > max * 0.9;

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (enviandoRef.current || !valido || !online) return;
    enviandoRef.current = true;
    setEnviando(true);
    setErro(null);
    const r = await livroPublicar(supabase, pai, limpo, citados.map((c) => c.ref));
    enviandoRef.current = false;
    setEnviando(false);
    if (!r.ok) { setErro(r.erro); return; }
    setTexto('');
    setCitados([]);
    onPublicado(r.dados.topicoId);
  };

  const idCampo = resposta ? 'livro-resposta' : 'livro-topico';

  return (
    <form onSubmit={enviar} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs" aria-label={resposta ? 'Escrever resposta' : 'Escrever tópico novo'}>
      <p className="rounded-xl border border-pendente-200 bg-pendente-50 p-3 text-sm text-pendente-900">{avisoDoEditor(modo)}</p>

      <div>
        <label htmlFor={idCampo} className="block text-sm font-semibold text-slate-800">
          {resposta ? 'Sua resposta' : 'O que você quer dizer?'}
        </label>
        <textarea
          id={idCampo}
          ref={campoRef}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={resposta ? 3 : 5}
          aria-describedby={`${idCampo}-ajuda`}
          className="mt-1 w-full resize-y rounded-xl border border-slate-200 px-3 py-2 text-base focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-strong/30"
        />
        <div id={`${idCampo}-ajuda`} className="mt-1 flex items-start justify-between gap-3 text-sm text-slate-600">
          <span className={dadoPessoal ? 'font-semibold text-red-700' : ''}>{dadoPessoal ? 'Retire dados pessoais (CPF, telefone, e-mail) antes de enviar.' : tam > 0 && tam < min ? `Escreva pelo menos ${min} caracteres.` : 'Texto simples, sem links nem formatação.'}</span>
          <span aria-live="polite" aria-atomic="true" className={`shrink-0 tabular-nums ${tam > max ? 'font-bold text-red-700' : pertoDoLimite ? 'font-semibold text-pendente-800' : ''}`}>
            {tam}/{max}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            ref={citarBtnRef}
            type="button"
            onClick={() => setCitarAberto(true)}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong"
          >
            <Quote className="h-4 w-4" aria-hidden="true" /> Citar{citados.length > 0 ? ` (${citados.length})` : ''}
          </button>
          {citados.map((c) => (
            <span key={c.ref} className="inline-flex min-h-11 items-center gap-1 rounded-full bg-accent-50 pl-3 pr-1 text-sm font-medium text-accent-900">
              <span className="break-words">{c.rotulo}</span>
              <button
                type="button"
                onClick={() => setCitados((l) => l.filter((x) => x.ref !== c.ref))}
                aria-label={`Tirar a citação de ${c.rotulo}`}
                className="flex size-9 items-center justify-center rounded-full hover:bg-accent-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
        <p className="text-sm text-slate-600">Escrever um nome no texto não avisa ninguém. Para avisar, use &quot;Citar&quot;.</p>
      </div>

      {!online && (
        <p role="status" className="flex items-center gap-2 rounded-xl bg-slate-100 p-3 text-sm text-slate-700">
          <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" /> Sem conexão. Seu texto está guardado aqui; envie quando voltar.
        </p>
      )}
      {erro && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{erro}</p>}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={!valido || enviando || !online}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white transition hover:bg-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {enviando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
          {enviando ? 'Enviando...' : resposta ? 'Responder' : 'Publicar'}
        </button>
      </div>

      {citarAberto && (
        <FolhaCitar
          supabase={supabase}
          escolhidos={citados}
          onConfirmar={(l) => { setCitados(l); fecharCitar(); }}
          onFechar={fecharCitar}
        />
      )}
    </form>
  );
}
