'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { useApp } from '@/context/AppContext';
import { isAdmin } from '@/lib/roles';
import {
  Users,
  Car,
  ShieldAlert,
  CalendarDays,
  Megaphone,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Search,
  Check,
  X,
} from 'lucide-react';

export default function DashboardPage() {
  return (
    <AppShell>
      <DashboardContent />
    </AppShell>
  );
}

function DashboardContent() {
  const { 
    currentUser, 
    units, 
    vehicles, 
    fines, 
    notices, 
    reservations, 
    judgeReservation 
  } = useApp();

  const [searchPlate, setSearchPlate] = useState('');

  // Filtros de acordo com o papel ativo
  const pendingReservations = reservations.filter((r) => r.status === 'PENDENTE');
  if (!currentUser) return null;
  const myReservations = reservations.filter((r) => r.unidade === currentUser.unidade);
  const myFines = fines.filter((f) => f.unidade === currentUser.unidade);
  const pendingScienceFines = myFines.filter((f) => f.status === 'PENDENTE_CIENCIA');
  const activeAppeals = fines.filter((f) => f.status === 'EM_RECURSO');

  // Busca rápida de veículo (otimizada para Portaria)
  const filteredVehicles = searchPlate.trim()
    ? vehicles.filter((v) => 
        v.placa.toLowerCase().includes(searchPlate.toLowerCase()) ||
        v.modelo.toLowerCase().includes(searchPlate.toLowerCase()) ||
        v.unidade.includes(searchPlate)
      )
    : [];

  if (!currentUser) return false;

  return (
    <div className="space-y-6">
      
      {/* Banner de Boas-Vindas */}
      <div className="rounded-3xl bg-gradient-to-r from-[#0B2545] via-[#134074] to-[#1D4E89] p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 h-full w-1/3 opacity-10 pointer-events-none flex items-center justify-end pr-6">
          <img src="/images/logo.png" alt="Harmony" className="h-48 w-auto object-contain" />
        </div>

        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-cyan-200 backdrop-blur-md">
            <span>Portal Condominial Harmony Residence</span>
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl text-white">
            Olá, {currentUser.name}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-cyan-100">
            {isAdmin(currentUser.role) && 'Painel de controle geral: gestão administrativa, ocorrências disciplinares e validação de reservas.'}
            {currentUser.role === 'PORTARIA' && 'Guarita de controle: identificação instantânea de veículos, consulta de moradores e agenda das áreas comuns.'}
            {currentUser.role === 'CONSELHO' && 'Auditoria e acompanhamento fiscal: fiscalização de multas, reservas e transparência condominial.'}
            {currentUser.role === 'MORADOR' && `Gestão da Unidade ${currentUser.unidade || '304'} Bloco ${currentUser.bloco || 'A'}: seus comunicados, multas e reservas.`}
          </p>
        </div>
      </div>

      {/* PAINEL ESPECIAL DA PORTARIA: Busca Rápida de Placa */}
      {currentUser.role === 'PORTARIA' && (
        <div className="rounded-2xl border-2 border-emerald-500/30 bg-emerald-50/50 p-6 shadow-xs">
          <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
            <Car className="h-5 w-5 text-emerald-700" />
            <span>Módulo de Entrada e Identificação Rápida de Veículos</span>
          </div>
          <p className="text-xs text-emerald-700 mt-1">
            Digite a placa ou o modelo para identificar imediatamente a unidade e o morador.
          </p>

          <div className="mt-3 relative">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-emerald-600" />
            <input
              type="text"
              value={searchPlate}
              onChange={(e) => setSearchPlate(e.target.value)}
              placeholder="Digite a placa (ex: BRA2E19) ou número do apartamento..."
              className="w-full rounded-xl border border-emerald-200 bg-white pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 uppercase font-mono font-semibold"
            />
          </div>

          {searchPlate.trim() && (
            <div className="mt-3 divide-y divide-emerald-100 rounded-xl bg-white border border-emerald-200 shadow-sm overflow-hidden">
              {filteredVehicles.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500">
                  Nenhum veículo encontrado com essa placa ou morador. Pode se tratar de visitante ou prestador de serviço.
                </div>
              ) : (
                filteredVehicles.map((v) => (
                  <div key={v.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                      <span className="rounded-lg bg-slate-900 text-white font-mono font-bold text-xs px-2.5 py-1 tracking-wider border border-slate-700">
                        {v.placa}
                      </span>
                      <div>
                        <p className="text-xs font-bold text-slate-900">{v.marca} {v.modelo} ({v.cor})</p>
                        <p className="text-[11px] text-slate-500">
                          Morador: <strong className="text-slate-800">{v.proprietarioNome}</strong> • Contato: {v.telefoneContato}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                        Apto {v.unidade} - Bloco {v.bloco}
                      </span>
                      <p className="text-[10px] text-slate-400 mt-0.5">Vaga: {v.vaga}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Cartões KPI Adaptativos por Papel */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        
        {/* Card 1 */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Unidades</span>
            <div className="rounded-xl bg-blue-50 p-2 text-[#0B2545]">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-900">{units.length}</p>
          <p className="mt-0.5 text-xs text-slate-500">Apartamentos cadastrados</p>
        </div>

        {/* Card 2 */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Veículos</span>
            <div className="rounded-xl bg-cyan-50 p-2 text-[#00A8E8]">
              <Car className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-900">{vehicles.length}</p>
          <p className="mt-0.5 text-xs text-slate-500">Veículos ativos no pátio</p>
        </div>

        {/* Card 3 (Multas & Ocorrências - Não exibido para portaria) */}
        {currentUser.role !== 'PORTARIA' ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {currentUser.role === 'MORADOR' ? 'Minhas Multas' : 'Notificações'}
              </span>
              <div className="rounded-xl bg-red-50 p-2 text-red-600">
                <ShieldAlert className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-900">
              {currentUser.role === 'MORADOR' ? myFines.length : fines.length}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {currentUser.role === 'MORADOR' 
                ? (pendingScienceFines.length > 0 ? `${pendingScienceFines.length} pendente(s) de ciência` : 'Nenhuma pendente')
                : `${activeAppeals.length} recurso(s) em análise`}
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Avisos do Mural</span>
              <div className="rounded-xl bg-amber-50 p-2 text-amber-600">
                <Megaphone className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-900">{notices.length}</p>
            <p className="mt-0.5 text-xs text-slate-500">Comunicados ativos</p>
          </div>
        )}

        {/* Card 4 (Reservas de Áreas Comuns) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Reservas</span>
            <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600">
              <CalendarDays className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-900">
            {currentUser.role === 'MORADOR' ? myReservations.length : reservations.length}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {isAdmin(currentUser.role) 
              ? `${pendingReservations.length} aguardando aprovação`
              : 'Espaços solicitados'}
          </p>
        </div>

      </div>

      {/* ÁREA DE AÇÃO RÁPIDA: Solicitações de Reserva Pendentes para o Síndico */}
      {isAdmin(currentUser.role) && pendingReservations.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
              <Clock className="h-4 w-4 text-amber-600" />
              <span>Solicitações de Reserva Aguardando Sua Aprovação ({pendingReservations.length})</span>
            </div>
            <Link href="/reservas" className="text-xs font-semibold text-[#0B2545] hover:underline">
              Ver todas na agenda →
            </Link>
          </div>

          <div className="mt-3 space-y-2">
            {pendingReservations.map((r) => (
              <div key={r.id} className="flex flex-col sm:flex-row sm:items-center justify-between rounded-xl bg-white p-3.5 border border-amber-200/80 shadow-2xs gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-900">{r.espacoNome}</span>
                    <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                      Pendente
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Data: <strong>{r.data}</strong> ({r.horarioInicio} às {r.horarioFim}) • Apto <strong>{r.unidade}-{r.bloco}</strong> ({r.moradorNome})
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => judgeReservation(r.id, true)}
                    className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>Aprovar</span>
                  </button>
                  <button
                    onClick={() => {
                      const motivo = prompt('Motivo da recusa da reserva:') || 'Data incompatível com manutenção.';
                      judgeReservation(r.id, false, motivo);
                    }}
                    className="flex items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50"
                  >
                    <X className="h-3.5 w-3.5" />
                    <span>Recusar</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ÁREA DE AÇÃO RÁPIDA: Alerta de Multa Pendente de Ciência para o Morador */}
      {currentUser.role === 'MORADOR' && pendingScienceFines.length > 0 && (
        <div className="rounded-2xl border border-red-200 bg-red-50/80 p-5 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-red-100 p-2 text-red-600 mt-0.5">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-red-900">
                Atenção: Notificação Disciplinar Pendente de Ciência Formal
              </h3>
              <p className="text-xs text-red-700 mt-1">
                Foi registrada uma notificação para a sua unidade com prazo legal para confirmação de leitura ou interposição de defesa/recurso online.
              </p>
              <div className="mt-3">
                <Link
                  href={`/multas/${pendingScienceFines[0].id}`}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-red-700"
                >
                  <span>Abrir Notificação {pendingScienceFines[0].numeroProtocolo}</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Seção Principal de Conteúdo em Duas Colunas */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        
        {/* Coluna 1 e 2: Comunicados Recentes do Mural */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-[#00A8E8]" />
              <h2 className="text-base font-bold text-slate-900">Mural de Avisos & Comunicados</h2>
            </div>
            <Link href="/mural" className="text-xs font-semibold text-[#0B2545] hover:underline">
              Ver mural completo →
            </Link>
          </div>

          <div className="space-y-3">
            {notices.slice(0, 3).map((notice) => (
              <div
                key={notice.id}
                className={`rounded-2xl border bg-white p-5 shadow-xs transition hover:shadow-md ${
                  notice.fixado ? 'border-sky-300 ring-1 ring-sky-100' : 'border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span
                    className={`rounded-md px-2 py-0.5 font-bold ${
                      notice.categoria === 'URGENTE'
                        ? 'bg-red-100 text-red-800'
                        : notice.categoria === 'ASSEMBLEIA'
                        ? 'bg-blue-100 text-[#0B2545]'
                        : notice.categoria === 'MANUTENCAO'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-800'
                    }`}
                  >
                    {notice.categoria}
                  </span>
                  <span className="text-slate-400">{notice.data}</span>
                </div>

                <h3 className="mt-2 text-sm font-bold text-slate-900">{notice.titulo}</h3>
                <p className="mt-1 text-xs text-slate-600 line-clamp-2">{notice.conteudo}</p>

                {notice.anexoNome && (
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-[#00A8E8] font-medium">
                    <FileText className="h-3.5 w-3.5" />
                    <span>Anexo: {notice.anexoNome}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Coluna 3: Acesso Rápido a Links e Agenda */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Acessos Rápidos</h2>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
            <Link
              href="/reservas"
              className="flex items-center justify-between rounded-xl p-3 border border-slate-100 transition hover:border-[#00A8E8] hover:bg-sky-50/40"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
                  <CalendarDays className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">Reservar Espaço</p>
                  <p className="text-[11px] text-slate-500">Salão nobre ou churrasqueira</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400" />
            </Link>

            <Link
              href="/links"
              className="flex items-center justify-between rounded-xl p-3 border border-slate-100 transition hover:border-[#00A8E8] hover:bg-sky-50/40"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-50 p-2 text-[#0B2545]">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">Regimento Interno</p>
                  <p className="text-[11px] text-slate-500">Normas e convenção em PDF</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400" />
            </Link>

            <Link
              href="/veiculos"
              className="flex items-center justify-between rounded-xl p-3 border border-slate-100 transition hover:border-[#00A8E8] hover:bg-sky-50/40"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-cyan-50 p-2 text-[#00A8E8]">
                  <Car className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">Consultar Garagem</p>
                  <p className="text-[11px] text-slate-500">Mapeamento de vagas e placas</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400" />
            </Link>

            {currentUser.role !== 'PORTARIA' && (
              <Link
                href="/multas"
                className="flex items-center justify-between rounded-xl p-3 border border-slate-100 transition hover:border-red-400 hover:bg-red-50/40"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-red-50 p-2 text-red-600">
                    <ShieldAlert className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">Painel de Infrações</p>
                    <p className="text-[11px] text-slate-500">Controle formal de ciência</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </Link>
            )}
          </div>

          {/* Card de Contatos de Emergência */}
          <div className="rounded-2xl border border-slate-200 bg-[#0B2545] p-5 text-white shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-200">
              Plantão & Portaria
            </h3>
            <p className="mt-2 text-base font-bold text-white">(11) 3210-0001</p>
            <p className="text-xs text-slate-300">Ramal da Guarita: 94 • 24 Horas</p>
            <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-300">
              <span>Zelador Sr. Antonio</span>
              <span>Ramal 91</span>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
