'use client';

import React, { useState } from 'react';
import { AppProvider } from '@/context/AppContext';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <AppProvider>
      <div className="flex min-h-screen flex-col bg-[#F4F7FB]">
        {/* Header no topo */}
        <Header 
          onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)} 
          mobileMenuOpen={mobileMenuOpen}
        />

        <div className="mx-auto flex w-full max-w-7xl flex-1 px-4 sm:px-6 lg:px-8">
          {/* Sidebar para desktop */}
          <div className="hidden w-64 shrink-0 py-6 lg:block">
            <div className="sticky top-22 h-[calc(100vh-6.5rem)] rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
              <Sidebar />
            </div>
          </div>

          {/* Drawer mobile */}
          {mobileMenuOpen && (
            <div className="fixed inset-0 z-50 flex lg:hidden no-print">
              <div
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
                onClick={() => setMobileMenuOpen(false)}
              />
              <div className="relative flex w-full max-w-xs flex-1 flex-col bg-white pt-5 pb-4 shadow-2xl">
                <Sidebar onCloseMobile={() => setMobileMenuOpen(false)} />
              </div>
            </div>
          )}

          {/* Área de Conteúdo Principal */}
          <main className="flex-1 py-6 lg:pl-6">
            {children}
          </main>
        </div>
      </div>
    </AppProvider>
  );
}
