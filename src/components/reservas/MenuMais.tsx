'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

export interface ItemMenu {
  rotulo: string;
  icone?: ReactNode;
  onSelecionar: () => void;
}

/**
 * Menu "Mais ⌄" (padrão ARIA de menu de botão). Teclado: Enter, Espaço ou seta para baixo abrem e
 * focam o primeiro item; setas, Home e End percorrem; Esc fecha e devolve o foco ao botão; Tab fecha.
 * Itens de 44px. Clicar fora fecha.
 */
export function MenuMais({ itens }: { itens: ItemMenu[] }) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const idMenu = useId();

  const fechar = (devolverFoco: boolean) => {
    setAberto(false);
    if (devolverFoco) botao.current?.focus();
  };

  const focarItem = (i: number) => {
    const n = itens.length;
    refs.current[((i % n) + n) % n]?.focus();
  };

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener('pointerdown', fora);
    return () => document.removeEventListener('pointerdown', fora);
  }, [aberto]);

  const abrirComFoco = (ultimo = false) => {
    setAberto(true);
    // O menu só existe no DOM depois de aberto: foca no próximo quadro.
    requestAnimationFrame(() => focarItem(ultimo ? itens.length - 1 : 0));
  };

  const aoTeclarBotao = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); abrirComFoco(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); abrirComFoco(true); }
  };

  const aoTeclarMenu = (e: React.KeyboardEvent) => {
    const atual = refs.current.findIndex((el) => el === document.activeElement);
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); focarItem(atual + 1); break;
      case 'ArrowUp': e.preventDefault(); focarItem(atual - 1); break;
      case 'Home': e.preventDefault(); focarItem(0); break;
      case 'End': e.preventDefault(); focarItem(itens.length - 1); break;
      case 'Escape': e.preventDefault(); e.stopPropagation(); fechar(true); break;
      case 'Tab': setAberto(false); break;
      default: break;
    }
  };

  return (
    <div ref={raiz} className="relative">
      <button
        ref={botao}
        type="button"
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={aberto ? idMenu : undefined}
        onClick={() => (aberto ? fechar(false) : setAberto(true))}
        onKeyDown={aoTeclarBotao}
        className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-primary shadow-xs transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
      >
        <span>Mais</span>
        <ChevronDown aria-hidden="true" className={`h-4 w-4 transition-transform motion-reduce:transition-none ${aberto ? 'rotate-180' : ''}`} />
      </button>
      {aberto && (
        <div
          id={idMenu}
          role="menu"
          aria-label="Mais ações"
          onKeyDown={aoTeclarMenu}
          className="absolute right-0 top-full z-20 mt-1.5 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg"
        >
          {itens.map((item, i) => (
            <button
              key={item.rotulo}
              ref={(el) => { refs.current[i] = el; }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => { setAberto(false); item.onSelecionar(); }}
              className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-xs font-semibold text-primary transition hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-strong"
            >
              {item.icone}
              <span>{item.rotulo}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
