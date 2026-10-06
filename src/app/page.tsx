'use client';

import { TipoVeiculoBadge } from '@/components/ui/TipoVeiculoBadge';
import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { AppShell } from '@/components/layout/AppShell';
import { useApp } from '@/context/AppContext';
import { useDialog } from '@/components/ui/DialogProvider';
import { Badge } from '@/components/ui/Badge';
import { NOTICE_CATEGORY_LABELS } from '@/lib/labels';
import { isAdmin, isOperacao, isProvisorio, ocupaCargo } from '@/lib/roles';
import { PedidosAguardando } from '@/components/reservas/PedidosAguardando';
import { reservasFuturasDoEspaco, textoEmManutencao } from '@/lib/interdicao';
import { hojeBrasilia } from '@/lib/datasReservas';
import { PainelProvisorio } from '@/components/autocadastro/PainelProvisorio';
import { FaixaCargo } from '@/components/usuarios/FaixaCargo';
import {
  Users,
  Car,
  ShieldAlert,
  CalendarDays,
  Megaphone,
  ArrowRight,
  Clock,
  CheckCircle2,
  FileText,
  Search,
  Check,
  X,
  Phone,
} from 'lucide-react';
import { formatarData, formatarIntervalo, pluralizar } from '@/lib/formatadores';

export default function DashboardPage() {
  return (
    <AppShell>
      <DashboardContent />
    </AppShell>
  );
}

/** Cartão de número: vira link (com área de toque e foco) quando recebe href. */
function CartaoKpi({ href, destaque = false, children }: { href?: string; destaque?: boolean; children: React.ReactNode }) {
  const visual = `rounded-2xl border p-5 shadow-xs ${destaque ? 'border-pendente-300 bg-pendente-50' : 'border-slate-200 bg-white'}`;
  if (!href) return <div className={visual}>{children}</div>;
  return (
    <Link
      href={href}
      className={`${visual} block min-h-11 transition hover:border-accent-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent`}
    >
      {children}
    </Link>
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
    judgeReservation,
    zelador,
    systemUsers,
    pendingInvites,
  } = useApp();
  const { askReason } = useDialog();

  const [searchPlate, setSearchPlate] = useState('');

  if (!currentUser) return <DashboardSkeleton />;
  if (isProvisorio(currentUser)) return <div className="flex flex-col gap-6"><FaixaCargo /><PainelProvisorio /></div>;
  // Zelador (funcionário externo, sem unidade): Início operacional próprio, sem cartão de unidade, multa nem documento.
  if (currentUser.role === 'ZELADOR') return <InicioZelador />;

  // Filtros de acordo com o papel ativo
  const pendingReservations = reservations.filter((r) => r.status === 'PENDENTE');
  const myReservations = reservations.filter((r) => r.unidade === currentUser.unidade);
  const myFines = fines.filter((f) => f.unidade === currentUser.unidade);
  const pendingScienceFines = myFines.filter((f) => f.status === 'PENDENTE_CIENCIA');
  const activeAppeals = fines.filter((f) => f.status === 'EM_RECURSO');
  const ehMorador = currentUser.role === 'MORADOR';

  // Busca rápida de veículo (otimizada para Portaria)
  const filteredVehicles = searchPlate.trim()
    ? vehicles.filter((v) => 
        v.placa.toLowerCase().includes(searchPlate.toLowerCase()) ||
        v.modelo.toLowerCase().includes(searchPlate.toLowerCase()) ||
        v.unidade.includes(searchPlate)
      )
    : [];

  // Mesmo bloco em dois lugares: morador no celular o vê logo após o banner;
  // no computador (e para os demais perfis) fica na coluna da direita.
  const acessosRapidos = (
    <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Acessos Rápidos</h2>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
            <Link
              href="/reservas"
              className="flex items-center justify-between rounded-xl p-3 border border-slate-100 transition hover:border-accent hover:bg-accent-50/40"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
                  <CalendarDays className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">Reservar Espaço</p>
                  <p className="text-[12px] text-slate-500">Salão nobre ou churrasqueira</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-500" />
            </Link>

            <Link
              href="/links"
              className="flex items-center justify-between rounded-xl p-3 border border-slate-100 transition hover:border-accent hover:bg-accent-50/40"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-50 p-2 text-primary">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">Regimento Interno</p>
                  <p className="text-[12px] text-slate-500">Normas e convenção em PDF</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-500" />
            </Link>

            <Link
              href="/veiculos"
              className="flex items-center justify-between rounded-xl p-3 border border-slate-100 transition hover:border-accent hover:bg-accent-50/40"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-cyan-50 p-2 text-accent">
                  <Car className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">Consultar Garagem</p>
                  <p className="text-[12px] text-slate-500">Mapeamento de vagas e placas</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-500" />
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
                    <p className="text-xs font-bold text-slate-900">{ehMorador ? 'Minhas multas' : 'Painel de Infrações'}</p>
                    <p className="text-[12px] text-slate-500">{ehMorador ? 'Ciência e recurso online' : 'Controle formal de ciência'}</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-500" />
              </Link>
            )}
          </div>
    </div>
  );

  return (
    // flex-col em vez de space-y para a Portaria poder subir a busca (order) no celular.
    <div className="flex flex-col gap-6">
      <FaixaCargo />

      {/* Banner de Boas-Vindas */}
      <div className="rounded-3xl bg-gradient-to-r from-primary via-primary-hover to-secondary p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 h-full w-1/3 opacity-10 pointer-events-none flex items-center justify-end pr-6">
          <Image src="/images/logo.png" alt="" width={562} height={508} aria-hidden="true" className="h-48 w-auto object-contain" />
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
            {currentUser.role === 'MORADOR' && (currentUser.unidade
              ? `Gestão da Unidade ${currentUser.unidade} Bloco ${currentUser.bloco}: seus comunicados, multas e reservas.`
              : 'Seus comunicados, multas e reservas.')}
          </p>
        </div>
      </div>

      {/* Faixa fina (não um cartão): avisa da multa que aguarda ciência. Com uma só, leva
          direto a ela; com várias, à lista. */}
      {ehMorador && pendingScienceFines.length > 0 && (
        <Link
          href={pendingScienceFines.length === 1 ? `/multas/${pendingScienceFines[0].id}` : '/multas'}
          className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-pendente-200 bg-pendente-50 px-4 py-2 text-xs font-semibold text-pendente-900 transition hover:bg-pendente-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong sm:text-sm"
        >
          <span>
            Você tem {pluralizar(pendingScienceFines.length, 'multa aguardando', 'multas aguardando')} ciência
          </span>
          <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
        </Link>
      )}

      {ehMorador && <div className="lg:hidden">{acessosRapidos}</div>}

      {/* PAINEL ESPECIAL DA PORTARIA: Busca Rápida de Placa */}
      {currentUser.role === 'PORTARIA' && (
        // No celular a busca vem antes do banner: é a tela de balcão, de uma mão só.
        <div className="-order-1 rounded-2xl border-2 border-emerald-500/30 bg-emerald-50/50 p-4 shadow-xs sm:p-6 md:order-none">
          <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
            <Car className="h-5 w-5 text-emerald-700" />
            <span>Módulo de Entrada e Identificação Rápida de Veículos</span>
          </div>
          <p className="text-xs text-emerald-700 mt-1">
            Digite a placa ou o modelo para identificar imediatamente a unidade e o morador.
          </p>

          <div className="mt-3 relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-600" />
            <input
              type="text"
              value={searchPlate}
              onChange={(e) => setSearchPlate(e.target.value)}
              placeholder="Placa ou apartamento"
              aria-label="Buscar veículo pela placa, modelo ou número do apartamento"
              autoCapitalize="characters"
              autoComplete="off"
              className="min-h-11 w-full rounded-xl border border-emerald-200 bg-white pl-10 pr-4 py-2.5 text-base sm:min-h-0 sm:text-xs text-slate-900 placeholder:text-slate-500 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 font-semibold not-placeholder-shown:font-mono not-placeholder-shown:uppercase"
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
                  <div key={v.id} className="hover:bg-slate-50">
                    {/* Celular: coluna, com a unidade em destaque primeiro (o porteiro quer saber para onde ligar). */}
                    <div className="space-y-1 p-4 sm:hidden">
                      <p className="font-display text-xl font-bold text-slate-900">
                        Apto {v.unidade} – Bloco {v.bloco}
                      </p>
                      <p className="text-sm text-slate-700">
                        Morador: <strong className="text-slate-900">{v.proprietarioNome}</strong>
                      </p>
                      {v.telefoneContato && (
                        <a
                          href={`tel:${v.telefoneContato.replace(/[^0-9+]/g, '')}`}
                          className="flex min-h-11 w-fit items-center gap-2 text-sm font-semibold text-accent-strong underline"
                        >
                          <Phone className="h-4 w-4" />
                          <span>{v.telefoneContato}</span>
                        </a>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 font-mono text-sm font-bold tracking-wider text-white">
                          {v.placa}
                        </span>
                        <TipoVeiculoBadge tipo={v.tipoVeiculo} />
                        <span className="text-sm text-slate-700">{v.marca} {v.modelo} ({v.cor})</span>
                      </div>
                      <p className="text-sm text-slate-600">Vaga: {v.vaga}</p>
                    </div>

                    {/* Computador: a linha de sempre. */}
                    <div className="hidden items-center justify-between p-3.5 sm:flex">
                      <div className="flex items-center gap-3">
                        <span className="rounded-lg bg-slate-900 text-white font-mono font-bold text-xs px-2.5 py-1 tracking-wider border border-slate-700">
                          {v.placa}
                        </span>
                        <TipoVeiculoBadge tipo={v.tipoVeiculo} />
                        <div>
                          <p className="text-xs font-bold text-slate-900">{v.marca} {v.modelo} ({v.cor})</p>
                          <p className="text-[12px] text-slate-500">
                            Morador: <strong className="text-slate-800">{v.proprietarioNome}</strong> • Contato: {v.telefoneContato}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge className="bg-emerald-100 text-emerald-800">
                          Apto {v.unidade} - Bloco {v.bloco}
                        </Badge>
                        <p className="text-[12px] text-slate-500 mt-0.5">Vaga: {v.vaga}</p>
                      </div>
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
        <CartaoKpi href={ehMorador ? '/moradores' : undefined}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {currentUser.role === 'MORADOR' ? 'Minha Unidade' : 'Unidades'}
            </span>
            <div className="rounded-xl bg-blue-50 p-2 text-primary">
              <Users className="h-5 w-5" />
            </div>
          </div>
          {/* Morador só recebe a própria unidade do banco (RLS), então a contagem geral não faria sentido pra ele. */}
          <p className="mt-3 text-2xl font-bold text-slate-900">
            {currentUser.role === 'MORADOR'
              ? (currentUser.unidade ? `${currentUser.unidade}-${currentUser.bloco}` : '—')
              : units.length}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {currentUser.role === 'MORADOR' ? 'Apartamento vinculado ao seu acesso' : 'Apartamentos cadastrados'}
          </p>
        </CartaoKpi>

        {/* Card 2 */}
        <CartaoKpi href={ehMorador ? '/veiculos' : undefined}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Veículos</span>
            <div className="rounded-xl bg-cyan-50 p-2 text-accent">
              <Car className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-900">{vehicles.length}</p>
          <p className="mt-0.5 text-xs text-slate-500">Veículos ativos no pátio</p>
        </CartaoKpi>

        {/* Card 3 (Multas & Ocorrências - Não exibido para portaria) */}
        {currentUser.role !== 'PORTARIA' ? (
          <CartaoKpi
            href={ehMorador ? '/multas' : undefined}
            destaque={ehMorador && pendingScienceFines.length > 0}
          >
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
            <p className={`mt-0.5 text-xs ${ehMorador && pendingScienceFines.length > 0 ? 'font-semibold text-pendente-800' : 'text-slate-500'}`}>
              {currentUser.role === 'MORADOR' 
                ? (pendingScienceFines.length > 0 ? `${pendingScienceFines.length} aguardando sua ciência` : 'Nenhuma pendente')
                : `${pluralizar(activeAppeals.length, 'recurso', 'recursos')} em análise`}
            </p>
          </CartaoKpi>
        ) : (
          <CartaoKpi>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Avisos do Mural</span>
              <div className="rounded-xl bg-pendente-50 p-2 text-pendente-600">
                <Megaphone className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-900">{notices.length}</p>
            <p className="mt-0.5 text-xs text-slate-500">Comunicados ativos</p>
          </CartaoKpi>
        )}

        {/* Card 4 (Reservas de Áreas Comuns) */}
        <CartaoKpi href={ehMorador ? '/reservas' : undefined}>
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
        </CartaoKpi>

      </div>

      {/* ÁREA DE AÇÃO RÁPIDA: Solicitações de Reserva Pendentes para o Síndico */}
      {isAdmin(currentUser.role) && pendingReservations.length > 0 && (
        <div className="rounded-2xl border border-pendente-200 bg-pendente-50/70 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-pendente-900 font-bold text-sm">
              <Clock className="h-4 w-4 text-pendente-600" />
              <span>Solicitações de Reserva Aguardando Sua Aprovação ({pendingReservations.length})</span>
            </div>
            <Link href="/reservas" className="text-xs font-semibold text-primary hover:underline">
              Ver todas na agenda →
            </Link>
          </div>

          <div className="mt-3 space-y-2">
            {pendingReservations.map((r) => (
              <div key={r.id} className="flex flex-col sm:flex-row sm:items-center justify-between rounded-xl bg-white p-3.5 border border-pendente-200/80 shadow-2xs gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-900">{r.espacoNome}</span>
                    <span className="rounded-md bg-pendente-100 px-2 py-0.5 text-[12px] font-bold text-pendente-800">
                      Pendente
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Data: <strong>{formatarData(r.data)}</strong> ({formatarIntervalo(r.horarioInicio, r.horarioFim)}) • Apto <strong>{r.unidade}-{r.bloco}</strong> ({r.moradorNome})
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => judgeReservation(r.id, true)}
                    className="flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-800"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>Aprovar</span>
                  </button>
                  <button
                    onClick={async () => {
                      const motivo = await askReason({
                        title: 'Recusar reserva',
                        message: `${r.espacoNome} em ${formatarData(r.data)}, Apto ${r.unidade}-${r.bloco}.`,
                        label: 'Justificativa da recusa',
                        confirmLabel: 'Recusar reserva',
                      });
                      if (motivo) judgeReservation(r.id, false, motivo);
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

      {/* Operação: espaços interditados (as reservas futuras continuam valendo) e, para quem designa, o cargo de Zelador vago */}
      {isOperacao(currentUser.role) && <EspacosInterditados />}
      {(currentUser.role === 'SINDICO' || currentUser.role === 'ADM') &&
        !systemUsers.some((u) => u.role === 'ZELADOR' && ocupaCargo(u)) &&
        !pendingInvites.some((i) => i.role === 'ZELADOR' && (i.status === 'PENDENTE' || !!i.transferenciaId)) && (
          <Link
            href="/usuarios"
            className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-800 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
          >
            <span>O cargo de Zelador está vago. Convide uma pessoa.</span>
            <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
          </Link>
        )}

      {/* Seção Principal de Conteúdo em Duas Colunas */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        
        {/* Coluna 1 e 2: Comunicados Recentes do Mural */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-accent" />
              <h2 className="text-base font-bold text-slate-900">Mural de Avisos & Comunicados</h2>
            </div>
            <Link href="/mural" className="inline-flex min-h-11 shrink-0 items-center whitespace-nowrap text-xs font-semibold text-primary hover:underline sm:min-h-0">
              Ver mural completo →
            </Link>
          </div>

          <div className="space-y-3">
            {notices.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-8 text-center">
                <Megaphone className="mx-auto h-6 w-6 text-slate-300" />
                <p className="mt-2 text-xs text-slate-500">Nenhum aviso publicado ainda.</p>
              </div>
            ) : (
            notices.slice(0, 3).map((notice) => (
              <div
                key={notice.id}
                className={`rounded-2xl border bg-white p-5 shadow-xs transition hover:shadow-md ${
                  notice.fixado ? 'border-accent-300 ring-1 ring-accent-100' : 'border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span
                    className={`rounded-md px-2 py-0.5 font-bold ${
                      notice.categoria === 'URGENTE'
                        ? 'bg-red-100 text-red-800'
                        : notice.categoria === 'ASSEMBLEIA'
                        ? 'bg-blue-100 text-primary'
                        : notice.categoria === 'MANUTENCAO'
                        ? 'bg-pendente-100 text-pendente-800'
                        : 'bg-slate-100 text-slate-800'
                    }`}
                  >
                    {NOTICE_CATEGORY_LABELS[notice.categoria]}
                  </span>
                  <span className="text-slate-500">{formatarData(notice.data)}</span>
                </div>

                <h3 className="mt-2 text-sm font-bold text-slate-900">{notice.titulo}</h3>
                <p className="mt-1 text-xs text-slate-600 line-clamp-2">{notice.conteudo}</p>

                {notice.anexoNome && (
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-accent-strong font-medium">
                    <FileText className="h-3.5 w-3.5" />
                    <span>Anexo: {notice.anexoNome}</span>
                  </div>
                )}
              </div>
            ))
            )}
          </div>
        </div>

        {/* Coluna 3: Acesso Rápido a Links e Agenda */}
        <div className="space-y-4">
          {/* Morador no celular já viu os acessos logo após o banner */}
          {ehMorador ? <div className="hidden lg:block">{acessosRapidos}</div> : acessosRapidos}

          {/* Zeladoria — dados vêm do cadastro em Links & Documentos */}
          {zelador?.nome && (
            <div className="rounded-2xl border border-slate-200 bg-primary p-5 text-white shadow-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-200">
                Zeladoria
              </h3>
              <p className="mt-2 text-base font-bold text-white">{zelador.nome}</p>
              {zelador.horarioAtendimento && (
                <p className="text-xs text-slate-300">{zelador.horarioAtendimento}</p>
              )}
              {zelador.telefone && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  <a
                    href={`tel:${zelador.telefone.replace(/[^0-9]/g, '')}`}
                    className="text-sm font-semibold text-cyan-100 hover:underline"
                  >
                    {zelador.telefone}
                  </a>
                </div>
              )}
            </div>
          )}

        </div>

      </div>

    </div>
  );
}

/** Espaços interditados com a contagem de reservas futuras: nada é cancelado ao interditar. */
function EspacosInterditados() {
  const { spaces, reservations, interdicoes } = useApp();
  const hoje = hojeBrasilia();
  const interditados = spaces.filter((s) => s.ativo === false);
  if (interditados.length === 0) return null;
  return (
    <section aria-labelledby="interditados-titulo" className="rounded-2xl border border-pendente-200 bg-pendente-50/70 p-5 shadow-xs">
      <h2 id="interditados-titulo" className="text-sm font-bold text-pendente-900">
        {pluralizar(interditados.length, 'espaço interditado', 'espaços interditados')}
      </h2>
      <ul className="mt-2 space-y-2">
        {interditados.map((s) => {
          const futuras = reservasFuturasDoEspaco(reservations, s.id, hoje).length;
          const info = interdicoes[s.id];
          return (
            <li key={s.id} className="rounded-xl bg-white p-3 text-xs text-slate-800">
              <p className="font-bold text-slate-900">{s.nome}</p>
              <p>{textoEmManutencao(s)}</p>
              {info && <p className="text-[12px] text-slate-600">Interditado por {info.por} em {formatarData(info.em)}</p>}
              <p className="text-[12px] text-slate-600">
                {futuras === 0 ? 'Sem reservas futuras.' : `${pluralizar(futuras, 'reserva futura continua valendo', 'reservas futuras continuam valendo')}.`}
              </p>
              {futuras > 0 && (
                <Link
                  href={`/reservas?espaco=${encodeURIComponent(s.id)}`}
                  className="inline-flex min-h-11 items-center text-xs font-semibold text-accent-strong underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
                >
                  Ver reservas futuras deste espaço
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Início do Zelador: o que precisa de decisão e o que está interditado, sem dado sensível. */
function InicioZelador() {
  const { currentUser, reservations, spaces, notices, judgeReservation } = useApp();
  const { askReason } = useDialog();
  if (!currentUser) return null;
  const pendentes = reservations.filter((r) => r.status === 'PENDENTE').sort((a, b) => a.data.localeCompare(b.data));
  const interditados = spaces.filter((s) => s.ativo === false);

  const recusar = async (r: { id: string; espacoNome: string; data: string; unidade: string; bloco: string }) => {
    const motivo = await askReason({
      title: 'Recusar reserva',
      message: `${r.espacoNome} em ${formatarData(r.data)}, Apto ${r.unidade}-${r.bloco}.`,
      label: 'Justificativa da recusa',
      confirmLabel: 'Recusar reserva',
    });
    if (motivo) await judgeReservation(r.id, false, motivo);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-3xl bg-gradient-to-r from-primary via-primary-hover to-secondary p-6 sm:p-8 text-white shadow-lg">
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Olá, {currentUser.name}</h1>
        <p className="mt-1 text-xs text-cyan-100 sm:text-sm">Operação do condomínio: reservas, espaços, moradores e veículos.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <CartaoKpi href="/reservas" destaque={pendentes.length > 0}>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Reservas aguardando</span>
          <p className="mt-3 text-2xl font-bold text-slate-900">{pendentes.length}</p>
          <p className="mt-0.5 text-xs text-slate-500">{pendentes.length === 0 ? 'Nenhum pedido aguardando decisão' : 'Aguardando a sua decisão'}</p>
        </CartaoKpi>
        <CartaoKpi href="/reservas">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Espaços interditados</span>
          <p className="mt-3 text-2xl font-bold text-slate-900">{interditados.length}</p>
          <p className="mt-0.5 text-xs text-slate-500">{interditados.length === 0 ? 'Todos os espaços abertos' : 'Novos pedidos bloqueados'}</p>
        </CartaoKpi>
        <CartaoKpi href="/mural">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Avisos no mural</span>
          <p className="mt-3 text-2xl font-bold text-slate-900">{notices.length}</p>
          <p className="mt-0.5 text-xs text-slate-500">Comunicados publicados</p>
        </CartaoKpi>
      </div>

      <PedidosAguardando pedidos={pendentes} onAprovar={(id) => judgeReservation(id, true)} onRecusar={recusar} />

      <EspacosInterditados />

      <section aria-labelledby="avisos-zelador-titulo" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="avisos-zelador-titulo" className="text-base font-bold text-slate-900">Avisos recentes</h2>
          <Link href="/mural" className="inline-flex min-h-11 items-center text-xs font-semibold text-primary hover:underline">Ver mural completo →</Link>
        </div>
        {notices.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-6 text-center text-xs text-slate-500">Nenhum aviso publicado ainda.</p>
        ) : (
          notices.slice(0, 3).map((n) => (
            <div key={n.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between text-xs">
                <Badge className="bg-slate-100 text-slate-800">{NOTICE_CATEGORY_LABELS[n.categoria]}</Badge>
                <span className="text-slate-500">{formatarData(n.data)}</span>
              </div>
              <h3 className="mt-2 text-sm font-bold text-slate-900">{n.titulo}</h3>
              <p className="mt-1 line-clamp-2 text-xs text-slate-600">{n.conteudo}</p>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

/** Esqueleto exibido enquanto o perfil do usuário ainda está carregando. */
function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" role="status" aria-label="Carregando painel">
      <div className="h-40 rounded-3xl bg-slate-200" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-32 rounded-2xl border border-slate-200 bg-white" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <div className="h-28 rounded-2xl border border-slate-200 bg-white" />
          <div className="h-28 rounded-2xl border border-slate-200 bg-white" />
        </div>
        <div className="h-64 rounded-2xl border border-slate-200 bg-white" />
      </div>
    </div>
  );
}
