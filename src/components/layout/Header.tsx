'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { Role } from '@/types';
import { 
  Bell, 
  Menu, 
  X, 
  ShieldAlert, 
  FileText, 
  CalendarCheck,
  LogOut,
  ChevronDown
} from 'lucide-react';

interface HeaderProps {
  onToggleMobileMenu?: () => void;
  mobileMenuOpen?: boolean;
}

export function Header({ onToggleMobileMenu, mobileMenuOpen }: HeaderProps) {
  const { 
    currentUser, 
    notifications, 
    unreadNotificationCount, 
    markNotificationAsRead,
    markAllNotificationsAsRead,
    signOut,
  } = useApp();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const roleLabels: Record<Role, { label: string; badgeColor: string }> = {
    SINDICO: { label: 'Síndico Geral', badgeColor: 'bg-blue-100 text-blue-900 border-blue-200' },
    ADM: { label: 'Administradora', badgeColor: 'bg-indigo-100 text-indigo-900 border-indigo-200' },
    PORTARIA: { label: 'Portaria & Acesso', badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-200' },
    CONSELHO: { label: 'Conselho Fiscal', badgeColor: 'bg-amber-100 text-amber-900 border-amber-200' },
    MORADOR: { label: 'Morador', badgeColor: 'bg-sky-100 text-sky-900 border-sky-200' },
  };

  const userRole = currentUser?.role ?? 'MORADOR';
  const userInitials = (currentUser?.name ?? 'U').slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white shadow-xs no-print">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        
        {/* Logo & Marca (Obrigatório no Header — item 2) */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            aria-label="Abrir menu de navegação"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>

          <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-95">
            <img
              src="/images/logo.png"
              alt="Harmony Residence"
              className="h-10 w-auto object-contain"
            />
            <div className="hidden sm:block">
              <span className="text-xs font-semibold uppercase tracking-widest text-[#00A8E8]">
                Portal Condominial
              </span>
            </div>
          </Link>
        </div>

        {/* Controles de Notificações & Perfil */}
        <div className="flex items-center gap-3">

          {/* Central de Notificações */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative rounded-full p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
              aria-label="Abrir notificações"
            >
              <Bell className="h-5 w-5" />
              {unreadNotificationCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white shadow-xs">
                  {unreadNotificationCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div 
                className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-slate-200 bg-white shadow-2xl ring-1 ring-black/5"
                onMouseLeave={() => setShowNotifications(false)}
              >
                <div className="flex items-center justify-between border-b border-slate-100 p-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">Notificações Internas</h3>
                    {unreadNotificationCount > 0 && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                        {unreadNotificationCount} nova(s)
                      </span>
                    )}
                  </div>
                  {unreadNotificationCount > 0 && (
                    <button
                      onClick={markAllNotificationsAsRead}
                      className="text-xs text-[#00A8E8] hover:underline font-medium"
                    >
                      Marcar lidas
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {notifications.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-500">
                      Nenhuma notificação no momento.
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => markNotificationAsRead(n.id)}
                        className={`p-3.5 transition hover:bg-slate-50 cursor-pointer ${!n.lida ? 'bg-sky-50/50' : ''}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 shrink-0">
                            {n.tipo === 'MULTA' ? (
                              <div className="rounded-full bg-red-100 p-1.5 text-red-600">
                                <ShieldAlert className="h-4 w-4" />
                              </div>
                            ) : n.tipo === 'RESERVA' ? (
                              <div className="rounded-full bg-blue-100 p-1.5 text-blue-600">
                                <CalendarCheck className="h-4 w-4" />
                              </div>
                            ) : (
                              <div className="rounded-full bg-slate-100 p-1.5 text-slate-600">
                                <FileText className="h-4 w-4" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-semibold text-slate-800">{n.titulo}</p>
                            <p className="mt-0.5 text-xs text-slate-600">{n.mensagem}</p>
                            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                              <span>{n.data}</span>
                              {n.linkDestino && (
                                <Link
                                  href={n.linkDestino}
                                  className="font-medium text-[#00A8E8] hover:underline"
                                  onClick={() => setShowNotifications(false)}
                                >
                                  Ver detalhes →
                                </Link>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Perfil do Usuário + Menu de Saída */}
          <div className="relative">
            <button
              id="btn-profile-menu"
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 transition hover:bg-slate-100"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0B2545] font-semibold text-xs text-white">
                {userInitials}
              </div>
              <div className="hidden text-left sm:block">
                <p className="text-xs font-semibold text-slate-900 leading-tight">
                  {currentUser?.name ?? 'Carregando...'}
                </p>
                <p className="text-[11px] text-slate-500">
                  {roleLabels[userRole]?.label}
                </p>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>

            {showProfileMenu && (
              <div
                className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl ring-1 ring-black/5"
                onMouseLeave={() => setShowProfileMenu(false)}
              >
                <div className="px-3 py-2 border-b border-slate-100 mb-1">
                  <p className="text-xs font-semibold text-slate-900">{currentUser?.name}</p>
                  <p className="text-[11px] text-slate-500">{currentUser?.email}</p>
                  {currentUser?.unidade && (
                    <span className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold ${roleLabels[userRole].badgeColor}`}>
                      Apto {currentUser.unidade}-{currentUser.bloco}
                    </span>
                  )}
                </div>
                <button
                  id="btn-signout"
                  onClick={signOut}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-red-600 transition hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sair do Sistema</span>
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </header>
  );
}
