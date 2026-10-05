'use client';

import type { InputHTMLAttributes, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

/** Classes do campo (input ou select) do formulário de veículo; borda vermelha quando há erro. */
export const classeCampoVeiculo = (erro?: string) =>
  `mt-1 min-h-11 w-full rounded-xl border px-3 py-2 text-base sm:text-xs focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-strong/30 disabled:bg-slate-100 disabled:text-slate-500 ${
    erro ? 'border-red-600' : 'border-slate-200'
  }`;

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'className'> {
  id: string;
  label: ReactNode;
  /** Mensagem de erro; vazio = sem erro. Vai em `role="alert"` e liga ao campo por aria-describedby. */
  erro?: string;
  /** Ajuda fixa abaixo do campo (text-slate-500). */
  apoio?: ReactNode;
  /** Classes extras do input (ex.: fonte mono da placa). */
  classeInput?: string;
  /** Texto fixo à esquerda dentro do campo (ex.: "R$"); o campo ganha folga para ele. */
  prefixo?: string;
}

/** Rótulo + campo + ajuda + erro do formulário de veículo, para não repetir classes e ARIA. */
export function CampoVeiculo({ id, label, erro, apoio, classeInput = '', prefixo, ...input }: Props) {
  const apoioId = `${id}-apoio`;
  const erroId = `${id}-erro`;
  const descritoPor = [apoio ? apoioId : '', erro ? erroId : ''].filter(Boolean).join(' ') || undefined;
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-slate-700">{label}</label>
      <div className="relative">
        {prefixo && (
          <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1 flex min-h-11 items-center text-base font-semibold text-slate-600 sm:text-xs">{prefixo}</span>
        )}
        <input
          {...input}
          id={id}
          aria-invalid={erro ? 'true' : undefined}
          aria-describedby={descritoPor}
          className={`${classeCampoVeiculo(erro)} ${prefixo ? 'pl-10' : ''} ${classeInput}`}
        />
      </div>
      {apoio && <div id={apoioId} className="mt-1 text-[12px] text-slate-500">{apoio}</div>}
      {erro && (
        <p id={erroId} role="alert" className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-red-700">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {erro}
        </p>
      )}
    </div>
  );
}
