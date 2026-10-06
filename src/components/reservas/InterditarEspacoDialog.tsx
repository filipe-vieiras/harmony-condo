'use client';

import React, { useRef, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import type { CommonSpace } from '@/types';
import { pluralizar } from '@/lib/formatadores';
import { MOTIVO_INTERDICAO_MAX, normalizarMotivo } from '@/lib/interdicao';
import { useEscapeToClose } from '@/lib/useEscapeToClose';
import { useModalFocus } from '@/lib/useModalFocus';

export type ModoInterdicao = 'interditar' | 'reabrir' | 'motivo';

interface Props {
  espaco: CommonSpace;
  modo: ModoInterdicao;
  /** Reservas futuras (pendentes e aprovadas) do espaço: só para o texto, nada é cancelado aqui. */
  reservasFuturas: number;
  /** Das futuras, quantas aguardam aprovação e quantas já estão confirmadas (só para o texto). */
  futurasPendentes: number;
  futurasAprovadas: number;
  onVerReservasFuturas: () => void;
  onFechar: () => void;
  /** Devolve a mensagem de erro (o diálogo continua aberto) ou null se gravou. */
  onConfirmar: (motivo: string) => Promise<string | null>;
}

/**
 * Diálogo de "Interditar espaço" / "Reabrir espaço" (PRD do Zelador). Interditar bloqueia SÓ novos pedidos: as reservas
 * futuras continuam valendo e o texto diz isso com a contagem. O motivo é opcional, uma linha, até 140, e é público
 * (todo morador o lê), por isso o apoio pede "sem nomes de pessoas".
 */
export function InterditarEspacoDialog({ espaco, modo, reservasFuturas, futurasPendentes, futurasAprovadas, onVerReservasFuturas, onFechar, onConfirmar }: Props) {
  const [motivo, setMotivo] = useState(modo === 'motivo' ? espaco.motivoInterdicao ?? '' : '');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  // Trava síncrona contra duplo toque (o estado só muda no próximo render).
  const travaRef = useRef(false);

  const fechar = () => { if (!enviando) onFechar(); };
  useEscapeToClose(true, fechar);
  useModalFocus(true);

  const interditando = modo !== 'reabrir';
  // Sem artigo fixo ("o"/"a"): o nome do espaço não entra na frase.
  const titulo = modo === 'reabrir' ? 'Reabrir este espaço?' : modo === 'motivo' ? 'Motivo da interdição deste espaço' : 'Interditar este espaço?';
  const rotuloConfirmar = modo === 'reabrir' ? 'Reabrir espaço' : modo === 'motivo' ? 'Salvar motivo' : 'Interditar espaço';
  const normalizado = normalizarMotivo(motivo);
  const longo = normalizado.length > MOTIVO_INTERDICAO_MAX;

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (travaRef.current) return;
    if (interditando && longo) {
      setErro(`O motivo pode ter no máximo ${MOTIVO_INTERDICAO_MAX} caracteres.`);
      document.getElementById('interdicao-motivo')?.focus();
      return;
    }
    travaRef.current = true;
    setEnviando(true);
    setErro(null);
    const msg = await onConfirmar(interditando ? normalizado : '');
    setEnviando(false);
    travaRef.current = false;
    if (msg) setErro(msg);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={fechar} aria-hidden="true" />
      <div
        id="interdicao-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="interdicao-titulo"
        aria-busy={enviando}
        className="relative flex max-h-[92dvh] w-full max-w-md flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
      >
        <form onSubmit={enviar} className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-3 px-5 pb-2 pt-5 sm:px-6">
            <h3 id="interdicao-titulo" className="text-base font-bold text-slate-900">{titulo}</h3>
            <button
              type="button"
              onClick={fechar}
              disabled={enviando}
              aria-label="Fechar"
              className="-mr-2 -mt-1 flex size-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 pb-4 sm:px-6">
            {modo === 'reabrir' ? (
              <p className="text-sm text-slate-700">
                Novos pedidos de reserva voltam a ser aceitos. O motivo da interdição é apagado.
              </p>
            ) : (
              <>
                {modo === 'interditar' && (
                  reservasFuturas === 0 ? (
                    <p className="text-sm text-slate-700">
                      Novos pedidos de reserva ficam bloqueados até você reabrir o espaço. O morador verá “Em manutenção”.
                    </p>
                  ) : (
                    <div className="space-y-1.5 text-sm text-slate-700">
                      <p>
                        Novos pedidos ficam bloqueados. {reservasFuturas === 1
                          ? 'A 1 reserva futura continua valendo: cancele-a manualmente se precisar.'
                          : `As ${reservasFuturas} reservas futuras continuam valendo: cancele-as manualmente se precisar.`}
                      </p>
                      <p>
                        Nenhuma reserva foi cancelada. ({pluralizar(futurasPendentes, 'aguardando aprovação', 'aguardando aprovação')} e {pluralizar(futurasAprovadas, 'confirmada', 'confirmadas')}.)
                      </p>
                      <button
                        type="button"
                        onClick={onVerReservasFuturas}
                        className="inline-flex min-h-11 items-center text-xs font-semibold text-accent-strong underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
                      >
                        Ver reservas futuras deste espaço
                      </button>
                    </div>
                  )
                )}
                <div>
                  <label htmlFor="interdicao-motivo" className="block text-xs font-semibold text-slate-700">Motivo (o morador vê)</label>
                  <input
                    id="interdicao-motivo"
                    type="text"
                    value={motivo}
                    onChange={(e) => { setMotivo(e.target.value); setErro(null); }}
                    placeholder="Reforma da piscina até 20/10"
                    autoComplete="off"
                    disabled={enviando}
                    aria-describedby="interdicao-apoio interdicao-contador"
                    aria-invalid={longo ? 'true' : undefined}
                    className={`mt-1 w-full rounded-xl border px-3 py-2 text-base focus:outline-none focus:ring-2 sm:text-xs min-h-11 sm:min-h-0 ${
                      longo ? 'border-red-400 focus:border-red-600 focus:ring-red-500/30' : 'border-slate-200 focus:border-accent-strong focus:ring-accent-strong/30'
                    }`}
                  />
                  <div className="mt-1 flex items-start justify-between gap-3">
                    <p id="interdicao-apoio" className="text-[12px] text-slate-600">
                      Escreva só o que o morador precisa saber, sem nomes de pessoas. Este texto aparece para todos os moradores.
                    </p>
                    <p id="interdicao-contador" className={`shrink-0 text-[12px] ${longo ? 'font-bold text-red-700' : 'text-slate-600'}`}>
                      {normalizado.length}/{MOTIVO_INTERDICAO_MAX}
                    </p>
                  </div>
                </div>
              </>
            )}

            {erro && (
              <div role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
                <span>{erro}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:flex-row sm:justify-end sm:px-6">
            <button
              type="button"
              onClick={fechar}
              disabled={enviando}
              className="flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-40"
            >
              Voltar
            </button>
            <button
              type="submit"
              disabled={enviando}
              className="flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-xs font-semibold text-white hover:bg-primary-hover disabled:opacity-60"
            >
              {enviando ? 'Salvando…' : rotuloConfirmar}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
