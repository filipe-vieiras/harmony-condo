'use client';

import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { rotaPermitida } from '@/lib/roles';
import { AppProvider, useApp } from '@/context/AppContext';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { DialogProvider } from '@/components/ui/DialogProvider';
import { LivroProvider } from '@/context/LivroContext';

/**
 * Enquanto o perfil carrega, as telas internas renderizam null (ficava tudo em
 * branco por 1 a 3s). Aqui o shell mostra blocos cinza no lugar. O Início tem o
 * esqueleto dele (DashboardSkeleton), então não entra aqui. Sem usuário e sem
 * carregamento, o filho segue como antes.
 */
function ConteudoPrincipal({ children }: { children: React.ReactNode }) {
  const { currentUser, isLoading } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  // Zelador (funcionário externo): rota fora da lista dele leva ao Início, sem tela de erro. O banco e a API já negam o dado de qualquer jeito.
  const proibida = !!currentUser && !rotaPermitida(currentUser.role, pathname);
  useEffect(() => {
    if (proibida) router.replace('/');
  }, [proibida, router]);
  if (proibida) {
    return <div className="space-y-6 animate-pulse" role="status" aria-label="Carregando"><div className="h-24 rounded-3xl bg-slate-200" /></div>;
  }
  if (!currentUser && isLoading && pathname !== '/') {
    return (
      <div className="space-y-6 animate-pulse" role="status" aria-label="Carregando">
        <div className="h-24 rounded-3xl bg-slate-200" />
        <div className="h-28 rounded-2xl border border-slate-200 bg-white" />
        <div className="h-28 rounded-2xl border border-slate-200 bg-white" />
        <div className="h-28 rounded-2xl border border-slate-200 bg-white" />
      </div>
    );
  }
  return <>{children}</>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Menu aberto: Esc fecha e a página de trás não rola.
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = overflowAnterior;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileMenuOpen]);

  return (
    <AppProvider>
      <DialogProvider>
      <LivroProvider>
      <div className="flex min-h-dvh flex-col bg-neutral-bg">
        {/* Header no topo */}
        <Header 
          onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)} 
          mobileMenuOpen={mobileMenuOpen}
        />

        <div className="mx-auto flex w-full max-w-7xl flex-1 px-4 sm:px-6 lg:px-8">
          {/* Sidebar para desktop */}
          <div className="hidden w-64 shrink-0 py-6 lg:block">
            <div className="sticky top-22 h-[calc(100dvh-6.5rem)] rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
              <Sidebar />
            </div>
          </div>

          {/* Drawer mobile: fica sempre montado e só desliza, para animar
              também o fechamento. Fechado, é inert (Tab e leitor de tela
              ignoram) e não recebe toques. */}
          <div
            className={`fixed inset-0 z-50 flex lg:hidden no-print ${mobileMenuOpen ? '' : 'pointer-events-none'}`}
            inert={!mobileMenuOpen}
          >
            <div
              className={`fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300 ease-out motion-reduce:transition-none ${
                mobileMenuOpen ? 'opacity-100' : 'opacity-0'
              }`}
              onClick={() => setMobileMenuOpen(false)}
              aria-hidden="true"
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Menu de navegação"
              className={`relative flex w-full max-w-xs flex-1 flex-col bg-white pb-4 shadow-2xl transition-transform duration-300 ease-out motion-reduce:transition-none ${
                mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
              }`}
            >
              <div className="flex items-center justify-between px-4 pt-3">
                <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Menu</span>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Fechar menu"
                  className="flex h-11 w-11 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <Sidebar onCloseMobile={() => setMobileMenuOpen(false)} />
              </div>
            </div>
          </div>

          {/* Área de Conteúdo Principal */}
          {/* min-w-0 é essencial aqui: sem isso, um item flex nunca encolhe
              abaixo da largura do seu conteúdo mais largo (ex: uma tabela),
              mesmo esse conteúdo tendo overflow-x-auto próprio — o resultado
              é a página inteira forçando scroll horizontal no celular. */}
          <main className="min-w-0 flex-1 py-6 lg:pl-6">
            <ConteudoPrincipal>{children}</ConteudoPrincipal>
          </main>
        </div>
      </div>
      </LivroProvider>
      </DialogProvider>
    </AppProvider>
  );
}
