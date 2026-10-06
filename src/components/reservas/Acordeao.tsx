'use client';

import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

interface Props {
  /** Prefixo dos ids (cabeçalho e corpo) que ligam o botão ao conteúdo. */
  id: string;
  titulo: string;
  /** Linha de resumo sob o título: o que está configurado sem precisar abrir. */
  resumo?: string;
  aberto: boolean;
  onAlternar: () => void;
  /** Nível do título (o cabeçalho é um <h2>/<h3> com o botão dentro). */
  nivel?: 2 | 3;
  className?: string;
  children: ReactNode;
}

/**
 * Seção recolhível (padrão ARIA de acordeão): o cabeçalho inteiro, com 56px de altura, é o botão
 * (aria-expanded + aria-controls). O corpo continua montado e só fica `hidden` quando fechado, para
 * os campos manterem o valor digitado e a validação do formulário conseguir encontrá-los.
 */
export function Acordeao({ id, titulo, resumo, aberto, onAlternar, nivel = 3, className = '', children }: Props) {
  const Titulo = nivel === 2 ? 'h2' : 'h3';
  return (
    <div className={`overflow-hidden rounded-2xl border border-slate-200 bg-white ${className}`}>
      <Titulo className="text-base font-bold text-slate-900">
        <button
          type="button"
          id={`${id}-cab`}
          aria-expanded={aberto}
          aria-controls={`${id}-corpo`}
          onClick={onAlternar}
          className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-2 text-left transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-strong"
        >
          <span className="min-w-0">
            <span className="block font-display text-[15px] font-bold text-slate-900">{titulo}</span>
            {resumo && <span className="mt-0.5 block text-[12px] font-normal text-slate-600">{resumo}</span>}
          </span>
          <ChevronDown aria-hidden="true" className={`h-5 w-5 shrink-0 text-slate-600 transition-transform motion-reduce:transition-none ${aberto ? 'rotate-180' : ''}`} />
        </button>
      </Titulo>
      <div id={`${id}-corpo`} role="region" aria-labelledby={`${id}-cab`} hidden={!aberto} data-secao={id}>
        <div className="border-t border-slate-200 px-4 pb-4 pt-3">{children}</div>
      </div>
    </div>
  );
}
