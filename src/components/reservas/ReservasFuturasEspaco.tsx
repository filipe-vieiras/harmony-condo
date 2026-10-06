'use client';

import { X } from 'lucide-react';
import type { CommonSpace, Reservation } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { formatarData, formatarIntervalo, pluralizar } from '@/lib/formatadores';

interface Props {
  espaco: CommonSpace;
  /** Pendentes e aprovadas de hoje em diante, já na ordem do calendário. */
  reservas: Reservation[];
  onCancelar: (r: Reservation) => void;
  onFechar: () => void;
}

/**
 * "Reservas futuras do espaço": a lista de quem precisa cancelar à mão depois de uma interdição (interditar não cancela
 * nada). Gestão e Zelador cancelam daqui, com o motivo que o morador vai ler.
 */
export function ReservasFuturasEspaco({ espaco, reservas, onCancelar, onFechar }: Props) {
  return (
    <section
      id="reservas-futuras-espaco"
      tabIndex={-1}
      role="region"
      aria-labelledby="reservas-futuras-titulo"
      className="no-print scroll-mt-20 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs outline-none"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 id="reservas-futuras-titulo" className="font-display text-base font-bold text-slate-900">
            Reservas futuras do espaço
          </h2>
          <p className="text-xs text-slate-600">
            {espaco.nome} · {pluralizar(reservas.length, 'reserva', 'reservas')} de hoje em diante
          </p>
        </div>
        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar a lista de reservas futuras"
          className="-mr-2 -mt-1 flex size-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {reservas.length === 0 ? (
        <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-700">Este espaço não tem reservas futuras.</p>
      ) : (
        <ul className="mt-2">
          {reservas.map((r) => (
            <li key={r.id} className="flex flex-col gap-2 border-t border-slate-100 py-3 first:border-t-0 md:flex-row md:items-center md:justify-between md:gap-4">
              <div className="text-xs">
                <p className="font-bold text-slate-900">
                  {formatarData(r.data)} · {formatarIntervalo(r.horarioInicio, r.horarioFim)}
                </p>
                <p className="text-slate-700">Apto {r.unidade} (Bloco {r.bloco}) · {r.moradorNome}</p>
                <div className="mt-1">
                  {r.status === 'APROVADA'
                    ? <Badge className="bg-emerald-100 text-emerald-800">Confirmada</Badge>
                    : <Badge className="bg-pendente-100 text-pendente-800">Aguardando aprovação</Badge>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onCancelar(r)}
                aria-label={`Cancelar reserva do apto ${r.unidade}, bloco ${r.bloco}, ${espaco.nome}, ${formatarData(r.data)}`}
                className="flex min-h-11 items-center justify-center gap-1 rounded-xl border border-red-300 bg-white px-4 text-xs font-bold text-red-700 transition hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong md:shrink-0"
              >
                Cancelar reserva
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
