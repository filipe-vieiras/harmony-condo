'use client';

// Remoção pela gestão (Síndico e ADM): motivo de lista fechada, sem texto livre. O banco recusa qualquer outro valor.
import React, { useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { MOTIVOS_REMOCAO, type MotivoRemocao } from '@/lib/livro';
import { useEscapeToClose } from '@/lib/useEscapeToClose';
import { useModalFocus } from '@/lib/useModalFocus';

interface Props {
  onConfirmar: (motivo: MotivoRemocao) => Promise<string | null>;
  onFechar: () => void;
}

export function RemoverDialog({ onConfirmar, onFechar }: Props) {
  const [motivo, setMotivo] = useState<MotivoRemocao | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Trava síncrona contra duplo toque (o estado só muda no próximo render); o banco também é idempotente.
  const enviandoRef = useRef(false);
  const fechar = () => { if (!enviando) onFechar(); };

  useEscapeToClose(true, fechar);
  useModalFocus(true);

  const confirmar = async () => {
    if (!motivo || enviando || enviandoRef.current) return;
    enviandoRef.current = true;
    setEnviando(true);
    setErro(null);
    const msg = await onConfirmar(motivo);
    enviandoRef.current = false;
    setEnviando(false);
    if (msg) setErro(msg);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={fechar} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-labelledby="remover-titulo" className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        <h2 id="remover-titulo" tabIndex={-1} className="text-base font-bold text-slate-900">Remover esta mensagem?</h2>
        <p className="mt-1 text-sm text-slate-600">
          Todos passam a ver &quot;Mensagem removida pela gestão&quot;. O texto fica guardado por 90 dias, só para o autor e para a gestão. Não dá para desfazer.
        </p>
        <fieldset className="mt-4 space-y-1.5">
          <legend className="text-sm font-semibold text-slate-800">Motivo</legend>
          {MOTIVOS_REMOCAO.map((m) => (
            <label key={m.codigo} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3.5 text-sm ${motivo === m.codigo ? 'border-accent-strong bg-accent-50 font-semibold text-accent-900' : 'border-slate-200 text-slate-800'}`}>
              <input type="radio" name="motivo-remocao" value={m.codigo} checked={motivo === m.codigo} onChange={() => setMotivo(m.codigo)} className="size-4 accent-primary" />
              {m.rotulo}
            </label>
          ))}
        </fieldset>
        {erro && <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{erro}</p>}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={fechar} disabled={enviando} className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong">Voltar</button>
          <button
            type="button"
            onClick={confirmar}
            disabled={!motivo || enviando}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {enviando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {enviando ? 'Removendo...' : 'Remover mensagem'}
          </button>
        </div>
      </div>
    </div>
  );
}
