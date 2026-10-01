import { useEffect } from 'react';

const FOCUSAVEIS =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** O modal do topo é o último `aria-modal` no DOM (diálogos de confirmação vêm depois das páginas). */
function modalDoTopo(): HTMLElement | null {
  // Só os visíveis: o menu lateral do celular também é `aria-modal` e fica no DOM, fechado e `inert`.
  const todos = Array.from(document.querySelectorAll<HTMLElement>('[aria-modal="true"]')).filter(
    (m) => m.getClientRects().length > 0 && !m.closest('[inert]')
  );
  return todos.length ? todos[todos.length - 1] : null;
}

function focaveisDe(modal: HTMLElement): HTMLElement[] {
  // Sem caixa de layout = escondido (display:none).
  return Array.from(modal.querySelectorAll<HTMLElement>(FOCUSAVEIS)).filter(
    (el) => el.getClientRects().length > 0
  );
}

/**
 * Acessibilidade de modal, em um lugar só: ao abrir, o foco vai para o título do
 * diálogo (via `aria-labelledby`, sem abrir o teclado do celular); Tab e Shift+Tab
 * ficam presos dentro dele; ao fechar, o foco volta ao botão que abriu.
 * O Esc continua com `useEscapeToClose`. Exige `role="dialog"` + `aria-modal="true"`.
 */
export function useModalFocus(isOpen: boolean) {
  useEffect(() => {
    if (!isOpen) return;
    const abriu = document.activeElement as HTMLElement | null;

    const modal = modalDoTopo();
    if (modal && !modal.contains(document.activeElement)) {
      const tituloId = modal.getAttribute('aria-labelledby');
      const titulo = tituloId ? document.getElementById(tituloId) : null;
      if (titulo && modal.contains(titulo)) {
        titulo.tabIndex = -1;
        titulo.style.outline = 'none';
        titulo.focus();
      } else {
        focaveisDe(modal)[0]?.focus();
      }
    }

    const prender = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || e.defaultPrevented) return;
      const topo = modalDoTopo();
      if (!topo) return;
      const itens = focaveisDe(topo);
      if (itens.length === 0) {
        e.preventDefault();
        return;
      }
      const primeiro = itens[0];
      const ultimo = itens[itens.length - 1];
      const atual = document.activeElement as HTMLElement | null;
      if (!atual || !topo.contains(atual) || atual === topo) {
        // Foco fora (ou no título): entra no modal pela ponta certa.
        if (!atual || !topo.contains(atual) || atual.tabIndex === -1) {
          e.preventDefault();
          (e.shiftKey ? ultimo : primeiro).focus();
        }
        return;
      }
      if (e.shiftKey && atual === primeiro) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && atual === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    };
    document.addEventListener('keydown', prender);

    return () => {
      document.removeEventListener('keydown', prender);
      // Devolve o foco a quem abriu, se ele ainda existe na tela.
      if (abriu && abriu !== document.body && document.contains(abriu)) abriu.focus();
    };
  }, [isOpen]);
}
