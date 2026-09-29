'use client';

import React from 'react';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { NOTICE_CATEGORY_LABELS } from '@/lib/labels';
import type { FineNotice, Reservation } from '@/types';
import {
  ArrowRight,
  CalendarDays,
  Car,
  FileText,
  Megaphone,
  Phone,
  Users,
} from 'lucide-react';

// Datas do banco chegam como AAAA-MM-DD; horários como HH:MM:SS.
function paraData(iso: string): Date {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d);
}

function diaCurto(iso: string): string {
  const texto = paraData(iso).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
  return texto.charAt(0).toUpperCase() + texto.slice(1).replace('.,', ',');
}

function dataBr(iso: string): string {
  return paraData(iso).toLocaleDateString('pt-BR');
}

const hora = (h: string) => h.slice(0, 5).replace(':00', 'h').replace(':', 'h');

function hojeIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type ProximaAcao = {
  etiqueta: string;
  titulo: string;
  detalhe: string;
  cta: string;
  href: string;
};

/**
 * Qual é a coisa mais importante para o morador agora. Uma só, em ordem de
 * prioridade: multa esperando ciência > reserva esperando o síndico >
 * notificações não lidas > nada pendente (convite para reservar).
 */
function decidirProximaAcao(
  multaPendente: FineNotice | undefined,
  reservaPendente: Reservation | undefined,
  naoLidas: number,
): ProximaAcao {
  if (multaPendente) {
    return {
      etiqueta: 'Precisa de você',
      titulo: `${multaPendente.tipo === 'MULTA' ? 'Multa' : 'Advertência'} aguardando sua ciência`,
      detalhe: `${multaPendente.numeroProtocolo} · recurso até ${dataBr(multaPendente.prazoRecursoData)}`,
      cta: 'Ver e dar ciência',
      href: `/multas/${multaPendente.id}`,
    };
  }
  if (reservaPendente) {
    return {
      etiqueta: 'Em andamento',
      titulo: `Sua reserva do ${reservaPendente.espacoNome} aguarda aprovação`,
      detalhe: `${diaCurto(reservaPendente.data)} · ${hora(reservaPendente.horarioInicio)}–${hora(reservaPendente.horarioFim)}`,
      cta: 'Ver minhas reservas',
      href: '/reservas',
    };
  }
  if (naoLidas > 0) {
    return {
      etiqueta: 'Novidades',
      titulo: naoLidas === 1 ? 'Você tem 1 notificação nova' : `Você tem ${naoLidas} notificações novas`,
      detalhe: 'Toque no sino, no topo da tela, para ver.',
      cta: 'Ver o mural',
      href: '/mural',
    };
  }
  return {
    etiqueta: 'Tudo em dia',
    titulo: 'Nada pendente para a sua unidade',
    detalhe: 'Quer usar o salão ou a churrasqueira? Faça sua reserva pelo portal.',
    cta: 'Reservar um espaço',
    href: '/reservas',
  };
}

export function InicioMorador() {
  const { currentUser, fines, reservations, notices, unreadNotificationCount, zelador } = useApp();
  if (!currentUser) return null;

  const hoje = hojeIso();
  const multaPendente = fines.find((f) => f.status === 'PENDENTE_CIENCIA');
  const futuras = reservations
    .filter((r) => r.data >= hoje && (r.status === 'APROVADA' || r.status === 'PENDENTE'))
    .sort((a, b) => a.data.localeCompare(b.data) || a.horarioInicio.localeCompare(b.horarioInicio));
  const proximaReserva = futuras[0];
  const reservaPendente = futuras.find((r) => r.status === 'PENDENTE');
  const acao = decidirProximaAcao(multaPendente, reservaPendente, unreadNotificationCount);

  const seteDiasAtras = new Date();
  seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
  const avisosDaSemana = notices.filter((n) => paraData(n.data) >= seteDiasAtras).length;

  const primeiroNome = currentUser.name.split(' ')[0];

  return (
    <div className="space-y-5">
      {/* Saudação */}
      <div>
        <h1 className="text-4xl font-extrabold leading-none tracking-tight text-slate-900">Olá, {primeiroNome}</h1>
        {currentUser.unidade && (
          <p className="mt-2 text-sm text-slate-500">
            Apto {currentUser.unidade} · Bloco {currentUser.bloco}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* Próxima ação: a única coisa em destaque na tela */}
          <section aria-label="Próxima ação" className="rounded-3xl bg-accent p-6 text-primary shadow-sm">
            <span className="inline-block rounded-full bg-primary px-3 py-1 text-xs font-bold text-white">{acao.etiqueta}</span>
            <h2 className="mt-3 text-2xl font-extrabold leading-tight sm:text-3xl">{acao.titulo}</h2>
            <p className="mt-2 text-sm font-medium">{acao.detalhe}</p>
            <Link
              href={acao.href}
              className="mt-5 flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-white shadow-xs transition hover:bg-primary-hover sm:inline-flex"
            >
              {acao.cta}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </section>

          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {/* Próxima reserva */}
            <Link
              href="/reservas"
              className="flex flex-col gap-2 rounded-3xl bg-white p-5 shadow-xs ring-1 ring-slate-200/70 transition hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <CalendarDays className="h-5 w-5 text-primary" aria-hidden="true" />
                {proximaReserva && (
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[12px] font-bold ${
                      proximaReserva.status === 'APROVADA' ? 'bg-emerald-100 text-emerald-800' : 'bg-pendente-100 text-pendente-800'
                    }`}
                  >
                    {proximaReserva.status === 'APROVADA' ? 'Aprovada' : 'Pendente'}
                  </span>
                )}
              </div>
              {proximaReserva ? (
                <>
                  <p className="text-sm font-bold leading-tight text-slate-900">{proximaReserva.espacoNome}</p>
                  <p className="text-xs text-slate-500">
                    {diaCurto(proximaReserva.data)} · {hora(proximaReserva.horarioInicio)}–{hora(proximaReserva.horarioFim)}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-bold leading-tight text-slate-900">Nenhuma reserva</p>
                  <p className="text-xs text-accent-strong font-semibold">Reservar um espaço</p>
                </>
              )}
            </Link>

            {/* Avisos da semana */}
            <Link
              href="/mural"
              className="flex flex-col gap-1 rounded-3xl bg-primary p-5 text-white shadow-xs transition hover:bg-primary-hover"
            >
              <span className="font-display text-4xl font-extrabold leading-none text-accent">{avisosDaSemana}</span>
              <span className="text-sm font-semibold leading-snug">
                {avisosDaSemana === 1 ? 'aviso no mural esta semana' : 'avisos no mural esta semana'}
              </span>
            </Link>
          </div>
        </div>

        {/* Mural recente */}
        <section aria-labelledby="titulo-mural" className="rounded-3xl bg-white p-5 shadow-xs ring-1 ring-slate-200/70 lg:row-span-2">
          <div className="flex items-center justify-between">
            <h2 id="titulo-mural" className="text-lg font-bold text-slate-900">Mural</h2>
            <Link href="/mural" className="text-xs font-semibold text-accent-strong hover:underline">
              Ver tudo
            </Link>
          </div>
          {notices.length === 0 ? (
            <div className="mt-4 flex flex-col items-center gap-2 py-6 text-center">
              <Megaphone className="h-6 w-6 text-slate-300" aria-hidden="true" />
              <p className="text-xs text-slate-500">Nenhum aviso publicado ainda.</p>
            </div>
          ) : (
            <ul className="mt-4 space-y-4">
              {notices.slice(0, 4).map((n) => (
                <li key={n.id}>
                  <Link href="/mural" className="flex items-start gap-3 rounded-2xl transition hover:opacity-80">
                    <span
                      className={`mt-0.5 shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-bold ${
                        n.categoria === 'URGENTE'
                          ? 'bg-red-100 text-red-800'
                          : n.categoria === 'ASSEMBLEIA'
                          ? 'bg-primary text-white'
                          : n.categoria === 'MANUTENCAO'
                          ? 'bg-pendente-100 text-pendente-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {NOTICE_CATEGORY_LABELS[n.categoria]}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold leading-snug text-slate-900">{n.titulo}</span>
                      <span className="block text-xs text-slate-500">{dataBr(n.data)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Atalhos */}
        <div className="space-y-3 lg:col-span-2">
          <div className="flex flex-wrap gap-2">
            <Link href="/veiculos" className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-slate-800 shadow-xs ring-1 ring-slate-200/70 transition hover:bg-slate-50">
              <Car className="h-4 w-4 text-accent-strong" aria-hidden="true" /> Meus veículos
            </Link>
            <Link href="/links" className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-slate-800 shadow-xs ring-1 ring-slate-200/70 transition hover:bg-slate-50">
              <FileText className="h-4 w-4 text-accent-strong" aria-hidden="true" /> Regimento e documentos
            </Link>
            <Link href="/moradores" className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-slate-800 shadow-xs ring-1 ring-slate-200/70 transition hover:bg-slate-50">
              <Users className="h-4 w-4 text-accent-strong" aria-hidden="true" /> Lista de unidades
            </Link>
          </div>

          {zelador?.nome && (
            <div className="flex items-center justify-between gap-3 rounded-3xl bg-white p-5 shadow-xs ring-1 ring-slate-200/70">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Zeladoria</p>
                <p className="mt-1 text-sm font-bold text-slate-900">{zelador.nome}</p>
                {zelador.horarioAtendimento && <p className="text-xs text-slate-500">{zelador.horarioAtendimento}</p>}
              </div>
              {zelador.telefone && (
                <a
                  href={`tel:${zelador.telefone.replace(/[^0-9]/g, '')}`}
                  aria-label={`Ligar para a zeladoria: ${zelador.telefone}`}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-white transition hover:bg-primary-hover"
                >
                  <Phone className="h-5 w-5" aria-hidden="true" />
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
