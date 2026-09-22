'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { isAdmin, ADMIN_ROLES } from '@/lib/roles';
import {
  LayoutDashboard,
  Megaphone,
  Users,
  Car,
  ShieldAlert,
  CalendarDays,
  FileSpreadsheet,
  Link2,
  Printer,
  Sparkles,
  UserCog,
} from 'lucide-react';

interface SidebarProps {
  onCloseMobile?: () => void;
}

export function Sidebar({ onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const { currentUser, isLoading, fines, reservations, pendingInvites } = useApp();

  // Calcular alertas pendentes para badges na navegação
  const pendingFinesCount = fines.filter((f) => {
    if (isAdmin(currentUser?.role)) return f.status === 'EM_RECURSO';
    if (currentUser?.role === 'MORADOR') return f.unidade === currentUser.unidade && f.status === 'PENDENTE_CIENCIA';
    return false;
  }).length;

  const pendingReservationsCount = reservations.filter((r) => {
    if (isAdmin(currentUser?.role)) return r.status === 'PENDENTE';
    return false;
  }).length;

  const pendingInvitesCount = isAdmin(currentUser?.role)
    ? pendingInvites.filter((i) => i.status === 'PENDENTE').length
    : 0;

  const navItems = [
    {
      label: 'Visão Geral',
      href: '/',
      icon: LayoutDashboard,
      roles: [...ADMIN_ROLES, 'PORTARIA', 'CONSELHO', 'MORADOR'],
    },
    {
      label: 'Mural de Avisos',
      href: '/mural',
      icon: Megaphone,
      roles: [...ADMIN_ROLES, 'PORTARIA', 'CONSELHO', 'MORADOR'],
    },
    {
      label: 'Moradores & Unidades',
      href: '/moradores',
      icon: Users,
      roles: [...ADMIN_ROLES, 'PORTARIA', 'CONSELHO'],
    },
    {
      label: 'Veículos & Garagem',
      href: '/veiculos',
      icon: Car,
      roles: [...ADMIN_ROLES, 'PORTARIA', 'CONSELHO', 'MORADOR'],
      badge: currentUser?.role === 'PORTARIA' ? 'Portaria' : undefined,
    },
    {
      label: 'Notificações & Multas',
      href: '/multas',
      icon: ShieldAlert,
      // Restrito: PORTARIA NÃO VÊ MULTAS (LGPD & Convivência)
      roles: [...ADMIN_ROLES, 'MORADOR', 'CONSELHO'],
      badgeCount: pendingFinesCount,
    },
    {
      label: 'Reserva de Espaços',
      href: '/reservas',
      icon: CalendarDays,
      roles: [...ADMIN_ROLES, 'PORTARIA', 'CONSELHO', 'MORADOR'],
      badgeCount: pendingReservationsCount,
    },
    {
      label: 'Links & Documentos',
      href: '/links',
      icon: Link2,
      roles: [...ADMIN_ROLES, 'PORTARIA', 'CONSELHO', 'MORADOR'],
    },
    {
      label: 'Relatórios & Auditoria',
      href: '/relatorios',
      icon: FileSpreadsheet,
      roles: [...ADMIN_ROLES, 'CONSELHO'],
    },
    {
      label: 'Usuários & Convites',
      href: '/usuarios',
      icon: UserCog,
      roles: [...ADMIN_ROLES],
      badgeCount: pendingInvitesCount,
    },
  ];

  // Enquanto o perfil ainda não carregou, currentUser é null — cair num
  // fallback tipo 'MORADOR' aqui mostrava por um instante o menu reduzido
  // de morador pra QUALQUER perfil logo após o login (síndico via só 5 dos
  // 9 itens até o profile chegar), o que confunde sobre o que a conta pode
  // acessar. Sem currentUser ainda, não há itens visíveis — o skeleton
  // abaixo cobre esse instante em vez de um menu com permissões erradas.
  const visibleItems = currentUser
    ? navItems.filter((item) => item.roles.includes(currentUser.role))
    : [];

  return (
    <aside className="flex h-full flex-col justify-between border-r border-slate-200 bg-white p-4 no-print">
      <div className="space-y-6">
        
        {/* Identificação de Perfil Ativo */}
        <div className="rounded-xl bg-[#0B2545]/5 p-3 border border-[#0B2545]/10">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#0B2545]">
            <Sparkles className="h-4 w-4 text-[#00A8E8]" />
            <span>Perfil Ativo:</span>
          </div>
          <p className="mt-1 text-xs font-bold text-slate-900">
            {currentUser?.name ?? 'Carregando...'}
          </p>
          <p className="text-[12px] text-slate-600">
            {currentUser?.cargo || (currentUser?.unidade ? `Unidade ${currentUser.unidade}-${currentUser.bloco}` : '')}
          </p>
        </div>

        {/* Links de Navegação */}
        <nav className="space-y-1">
          {isLoading && !currentUser ? (
            <div className="space-y-1.5" aria-hidden="true">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-9 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : null}
          {visibleItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onCloseMobile}
                className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-medium transition ${
                  isActive
                    ? 'bg-[#0B2545] text-white shadow-xs font-semibold'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`h-4 w-4 ${isActive ? 'text-[#00A8E8]' : 'text-slate-500'}`} />
                  <span>{item.label}</span>
                </div>

                {item.badgeCount && item.badgeCount > 0 ? (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[12px] font-bold text-white">
                    {item.badgeCount}
                  </span>
                ) : item.badge ? (
                  <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[12px] font-bold text-emerald-800">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Ações Rápidas no Rodapé da Barra Lateral */}
      <div className="border-t border-slate-100 pt-4 space-y-2">
        <button
          type="button"
          onClick={() => window.print()}
          className="flex w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
        >
          <Printer className="h-4 w-4 text-slate-500" />
          <span>Imprimir / Gerar PDF</span>
        </button>

        <div className="px-2 text-[12px] text-slate-500 text-center">
          Harmony Residence • Versão 1.0
        </div>
      </div>
    </aside>
  );
}
