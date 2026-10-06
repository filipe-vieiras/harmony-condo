'use client';

import { Check, Clock, X } from 'lucide-react';
import type { Reservation } from '@/types';
import { formatarData, pluralizar } from '@/lib/formatadores';
import { valorDaReserva } from '@/lib/valorEspaco';

interface Props {
  /** Reservas PENDENTE, já na ordem em que devem aparecer. */
  pedidos: Reservation[];
  onAprovar: (id: string) => void;
  onRecusar: (r: Reservation) => void;
}

/**
 * Cartão do topo da página para quem decide (Síndico, Subsíndico, ADM): o que está aguardando e
 * os dois botões. Some quando não há pedidos. Aprovar e recusar usam as mesmas funções da lista.
 */
export function PedidosAguardando({ pedidos, onAprovar, onRecusar }: Props) {
  if (pedidos.length === 0) return null;
  const n = pedidos.length;
  const titulo = `${n} ${n === 1 ? 'pedido aguardando' : 'pedidos aguardando'} sua decisão`;
  return (
    <section
      role="region"
      aria-labelledby="pedidos-aguardando-titulo"
      className="no-print rounded-2xl border border-pendente-200 bg-pendente-50 p-4"
    >
      <h2 id="pedidos-aguardando-titulo" className="flex items-center gap-2 font-display text-base font-bold text-pendente-800">
        <Clock aria-hidden="true" className="h-5 w-5 shrink-0" />
        <span>{titulo}</span>
      </h2>
      {/* Avisa o leitor de tela quando a contagem muda (um pedido foi decidido). */}
      <p role="status" className="sr-only">{pluralizar(n, 'pedido aguardando decisão', 'pedidos aguardando decisão')}</p>
      <ul className="mt-2">
        {pedidos.map((r) => (
          <li key={r.id} className="flex flex-col gap-2 border-t border-pendente-200 py-3 first:border-t-0 md:flex-row md:items-center md:justify-between md:gap-4">
            <p className="text-xs text-slate-900">
              <strong>Apto {r.unidade}</strong>
              <span className="text-slate-700"> (Bloco {r.bloco}) · {r.espacoNome} · {formatarData(r.data)} · {pluralizar(r.convidadosEstimados, 'pessoa', 'pessoas')} · {valorDaReserva(r.valorUso)}</span>
            </p>
            <div className="flex gap-2 md:shrink-0">
              <button
                type="button"
                onClick={() => onAprovar(r.id)}
                aria-label={`Aprovar pedido do apto ${r.unidade}, bloco ${r.bloco}, ${r.espacoNome}, ${formatarData(r.data)}`}
                className="flex min-h-11 flex-1 items-center justify-center gap-1 rounded-xl bg-emerald-700 px-4 text-xs font-bold text-white transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong md:flex-none"
              >
                <Check aria-hidden="true" className="h-4 w-4" />
                <span>Aprovar</span>
              </button>
              <button
                type="button"
                onClick={() => onRecusar(r)}
                aria-label={`Recusar pedido do apto ${r.unidade}, bloco ${r.bloco}, ${r.espacoNome}, ${formatarData(r.data)}`}
                className="flex min-h-11 flex-1 items-center justify-center gap-1 rounded-xl border border-red-300 bg-white px-4 text-xs font-bold text-red-700 transition hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong md:flex-none"
              >
                <X aria-hidden="true" className="h-4 w-4" />
                <span>Recusar</span>
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
