'use client';

import { forwardRef, useImperativeHandle, useRef } from 'react';
import type { CommonSpace } from '@/types';

interface Props {
  spaces: CommonSpace[];
  /** Id do espaço escolhido; null = "Todos" (só a equipe tem essa opção). */
  valor: string | null;
  onChange: (id: string | null) => void;
  comTodos: boolean;
}

export interface SeletorEspacosRef {
  /** Foca e rola até o chip escolhido (usado por "Trocar espaço" do modal). */
  focarEscolhido: () => void;
}

/**
 * Chips de espaço (escolha única, ARIA radiogroup com foco "roving"): Tab entra no grupo, setas,
 * Home e End mudam a escolha. Espaço inativo aparece esmaecido com "Em manutenção", sem seleção.
 * A faixa rola na horizontal dentro dela mesma; a página não.
 */
export const SeletorEspacos = forwardRef<SeletorEspacosRef, Props>(function SeletorEspacos({ spaces, valor, onChange, comTodos }, ref) {
  const botoes = useRef<Record<string, HTMLButtonElement | null>>({});
  const chave = valor ?? 'TODOS';

  useImperativeHandle(ref, () => ({
    focarEscolhido: () => {
      const el = botoes.current[chave];
      el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      el?.focus();
    },
  }));

  const opcoes: { chave: string; id: string | null; nome: string; ativo: boolean }[] = [
    ...(comTodos ? [{ chave: 'TODOS', id: null, nome: 'Todos', ativo: true }] : []),
    // Os espaços em manutenção vão para o fim (o sort é estável: a ordem original se mantém dentro de cada grupo).
    ...spaces.map((s) => ({ chave: s.id, id: s.id, nome: s.nome, ativo: s.ativo !== false })).sort((a, b) => Number(b.ativo) - Number(a.ativo)),
  ];
  const selecionaveis = opcoes.filter((o) => o.ativo);

  const aoTeclar = (e: React.KeyboardEvent) => {
    const i = selecionaveis.findIndex((o) => o.chave === chave);
    let alvo: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') alvo = (i + 1) % selecionaveis.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') alvo = (i - 1 + selecionaveis.length) % selecionaveis.length;
    else if (e.key === 'Home') alvo = 0;
    else if (e.key === 'End') alvo = selecionaveis.length - 1;
    if (alvo === null) return;
    e.preventDefault();
    const o = selecionaveis[alvo];
    onChange(o.id);
    botoes.current[o.chave]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label="Espaço"
      onKeyDown={aoTeclar}
      className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {opcoes.map((o) => {
        const marcado = o.chave === chave;
        // Sem nenhum chip na ordem de Tab (ex.: escolha inválida), o primeiro selecionável recebe o foco.
        const naOrdemDeTab = marcado || (!selecionaveis.some((s) => s.chave === chave) && o.chave === selecionaveis[0]?.chave);
        return (
          <button
            key={o.chave}
            ref={(el) => { botoes.current[o.chave] = el; }}
            type="button"
            role="radio"
            aria-checked={marcado}
            aria-disabled={!o.ativo || undefined}
            tabIndex={o.ativo && naOrdemDeTab ? 0 : -1}
            onClick={() => { if (o.ativo) onChange(o.id); }}
            className={`flex min-h-11 shrink-0 snap-start items-center gap-1.5 whitespace-nowrap rounded-full border px-4 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong ${
              !o.ativo ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-600 opacity-70'
                : marcado ? 'border-primary bg-primary text-white shadow-xs'
                : 'border-slate-200 bg-white text-primary hover:bg-slate-50'
            }`}
          >
            <span>{o.nome}</span>
            {!o.ativo && <span className="text-[12px] font-medium">Em manutenção</span>}
          </button>
        );
      })}
    </div>
  );
});
