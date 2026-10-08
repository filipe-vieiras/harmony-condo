'use client';

// Cartão de 3 linhas do celular: placa (chip azul-marinho com o ícone do tipo) e unidade; nome do responsável (truncado)
// e selo de visitante; modelo e cor. O cartão inteiro é um botão que abre a folha de detalhes.
import React from 'react';
import type { Vehicle } from '@/types';
import { tipoVeiculoDe } from '@/lib/tiposVeiculo';
import { rotuloUnidadeCurto } from '@/lib/veiculosLista';

interface Props {
  veiculo: Vehicle;
  /** Destaque quando é o único resultado da busca (não abre sozinho). */
  destaque?: boolean;
  onAbrir: (gatilho: HTMLButtonElement) => void;
}

export function CartaoVeiculo({ veiculo: v, destaque, onAbrir }: Props) {
  const Icone = tipoVeiculoDe(v.tipoVeiculo)?.icone;
  const detalhe = [`${v.marca} ${v.modelo}`.trim(), v.cor].filter(Boolean).join(' · ');
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-label={`Veículo ${v.placa}, unidade ${rotuloUnidadeCurto(v)}, ${v.proprietarioNome}${v.status === 'VISITANTE' ? ', visitante' : ''}. Abrir detalhes`}
      onClick={(e) => onAbrir(e.currentTarget)}
      className={`flex min-h-16 w-full flex-col gap-1.5 rounded-2xl border bg-white p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong ${
        destaque ? 'border-accent-strong ring-2 ring-accent-strong/30' : 'border-slate-200'
      }`}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1 font-mono text-base font-bold tracking-widest text-white">
          {Icone && <Icone className="h-4 w-4" aria-hidden="true" />}
          {v.placa}
        </span>
        <span className="whitespace-nowrap text-sm font-semibold text-primary">{rotuloUnidadeCurto(v)}</span>
      </span>
      <span className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 truncate text-sm font-semibold text-slate-900">{v.proprietarioNome}</span>
        {v.status === 'VISITANTE' && (
          <span className="shrink-0 rounded-full border border-pendente-200 bg-pendente-50 px-2 py-0.5 text-[12px] font-bold text-pendente-800">Visitante</span>
        )}
      </span>
      <span className="truncate text-sm text-slate-600">{detalhe || '—'}</span>
    </button>
  );
}
