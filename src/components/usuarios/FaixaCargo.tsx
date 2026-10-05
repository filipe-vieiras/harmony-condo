'use client';

import { Info, X } from 'lucide-react';
import { useApp } from '@/context/AppContext';

/**
 * Faixa fina no Início sobre cargo (issue #53):
 *  - "perdeu": quem acabou de passar o cargo cai aqui como Morador e entende por quê (sem logout forçado);
 *  - "pendente": o titular atual lembra que há convite de transferência aguardando aceite.
 */
export function FaixaCargo() {
  const { avisoCargo, dispensarAvisoCargo } = useApp();
  if (!avisoCargo) return null;
  return (
    <div
      role="status"
      className="flex items-center justify-between gap-3 rounded-xl border border-accent-200 bg-accent-50 px-4 py-2 text-xs font-semibold text-accent-900 sm:text-sm"
    >
      <span className="flex items-center gap-2">
        <Info className="h-4 w-4 shrink-0 text-accent-700" aria-hidden="true" />
        <span>{avisoCargo.texto}</span>
      </span>
      {avisoCargo.tipo === 'perdeu' && (
        <button
          type="button"
          onClick={dispensarAvisoCargo}
          aria-label="Fechar aviso"
          className="-my-2 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-lg text-accent-800 hover:bg-accent-100"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
