'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { isProvisorio } from '@/lib/roles';
import { CalendarDays, FileText, Home, Megaphone, Menu, ShieldAlert, Users, type LucideIcon } from 'lucide-react';

type Aba = { href: string; rotulo: string; icone: LucideIcon; alerta?: boolean };

/**
 * Navegação do morador no celular: abas fixas embaixo, no lugar do menu
 * hambúrguer. "Menu" abre a gaveta lateral com o resto (veículos, lista de
 * unidades, documentos, sair). Some no desktop, onde fica o menu lateral.
 */
export function AbasMorador({ onAbrirMenu }: { onAbrirMenu: () => void }) {
  const { currentUser, fines } = useApp();
  const pathname = usePathname();
  if (!currentUser || currentUser.role !== 'MORADOR') return null;

  // Provisório só acessa o que não depende da unidade validada (mesma regra do Sidebar).
  const abas: Aba[] = isProvisorio(currentUser)
    ? [
        { href: '/', rotulo: 'Início', icone: Home },
        { href: '/mural', rotulo: 'Mural', icone: Megaphone },
        { href: '/moradores', rotulo: 'Unidades', icone: Users },
        { href: '/links', rotulo: 'Links', icone: FileText },
      ]
    : [
        { href: '/', rotulo: 'Início', icone: Home },
        { href: '/mural', rotulo: 'Mural', icone: Megaphone },
        { href: '/reservas', rotulo: 'Reservas', icone: CalendarDays },
        { href: '/multas', rotulo: 'Multas', icone: ShieldAlert, alerta: fines.some((f) => f.status === 'PENDENTE_CIENCIA') },
      ];

  const ativa = (href: string) => (href === '/' ? pathname === '/' : pathname?.startsWith(href));

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-3 bottom-3 z-40 flex items-center justify-around rounded-full bg-primary px-2 py-2 shadow-lg lg:hidden no-print"
      style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
    >
      {abas.map(({ href, rotulo, icone: Icone, alerta }) => {
        const ehAtiva = ativa(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={ehAtiva ? 'page' : undefined}
            className={`relative flex min-w-14 flex-col items-center gap-0.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${
              ehAtiva ? 'bg-accent text-primary' : 'text-white/80 hover:text-white'
            }`}
          >
            <Icone className="h-5 w-5" aria-hidden="true" />
            {rotulo}
            {alerta && (
              <>
                <span className="absolute right-2.5 top-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-primary" aria-hidden="true" />
                <span className="sr-only">(pendência)</span>
              </>
            )}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={onAbrirMenu}
        className="flex min-w-14 flex-col items-center gap-0.5 rounded-full px-3 py-1.5 text-[11px] font-semibold text-white/80 transition hover:text-white"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
        Menu
      </button>
    </nav>
  );
}
