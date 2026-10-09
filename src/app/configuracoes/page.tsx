'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, Lock, Settings, X } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { CampoVeiculo } from '@/components/ui/CampoVeiculo';
import { useDialog } from '@/components/ui/DialogProvider';
import { useApp } from '@/context/AppContext';
import { isAdmin } from '@/lib/roles';
import { formatarData, formatarMoeda } from '@/lib/formatadores';
import { centavosParaReais, cotaEmCentavos, erroDaCota, mascaraCentavos } from '@/lib/cotaMinima';
import type { CotaMinima } from '@/types';

export default function ConfiguracoesPage() {
  return (
    <AppShell>
      <ConfiguracoesContent />
    </AppShell>
  );
}

type Carga = 'carregando' | 'ok' | 'erro';

function ConfiguracoesContent() {
  const { currentUser, buscarCotaMinima, salvarCotaMinima } = useApp();
  const { confirm } = useDialog();
  const admin = isAdmin(currentUser?.role);

  const [carga, setCarga] = useState<Carga>('carregando');
  const [cota, setCota] = useState<CotaMinima | null>(null);
  const [editando, setEditando] = useState(false);
  const [centavos, setCentavos] = useState('');
  const [tentou, setTentou] = useState(false);
  const [erroSalvar, setErroSalvar] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  // Trava de duplo clique: o ref barra o 2º clique no mesmo tick (o state só vale no próximo render).
  const [salvando, setSalvando] = useState(false);
  const salvandoRef = useRef(false);
  const campoRef = useRef<HTMLDivElement>(null);
  const alterarRef = useRef<HTMLButtonElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);

  // O estado inicial já é "carregando"; "Tentar de novo" o repõe e muda `tentativa` para pedir de novo.
  const [tentativa, setTentativa] = useState(0);
  // A função do contexto muda a cada render do provedor: guardada em ref para o efeito não repetir a consulta à toa.
  const buscarRef = useRef(buscarCotaMinima);
  useEffect(() => { buscarRef.current = buscarCotaMinima; });
  useEffect(() => {
    // Só a gestão chega a pedir a cota (o banco nega aos demais de qualquer forma).
    if (!admin) return;
    let cancelado = false;
    buscarRef.current().then((r) => {
      if (cancelado) return;
      if (r.ok) {
        setCota(r.cota);
        setCarga('ok');
      } else {
        setCarga('erro');
      }
    });
    return () => { cancelado = true; };
  }, [admin, tentativa]);

  if (!currentUser) return null;

  if (!admin) {
    return (
      <div className="rounded-2xl border border-pendente-200 bg-pendente-50 p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-pendente-100 text-pendente-700">
          <Lock className="h-6 w-6" aria-hidden="true" />
        </div>
        <h2 className="mt-4 text-base font-bold text-pendente-900">Área restrita</h2>
        <p className="mx-auto mt-2 max-w-md text-xs text-pendente-700">
          As configurações do condomínio são reservadas ao Síndico, ao Subsíndico e à Administradora.
        </p>
      </div>
    );
  }

  const cadastrada = cota?.valor != null;
  const atualCentavos = cadastrada ? Math.round((cota?.valor ?? 0) * 100) : null;
  const novo = cotaEmCentavos(centavos);
  const mesmoValor = editando && cadastrada && novo === atualCentavos;
  const erroCampo = tentou ? erroDaCota(centavos) : '';
  // Primeiro cadastro: o campo já vem aberto. Depois: modo leitura, com "Alterar cota".
  const campoAberto = carga === 'ok' && (!cadastrada || editando);

  const abrirEdicao = () => {
    setCentavos(atualCentavos !== null ? String(atualCentavos) : '');
    setTentou(false);
    setErroSalvar('');
    setEditando(true);
    setTimeout(() => campoRef.current?.querySelector('input')?.focus(), 0);
  };

  const cancelar = () => {
    setEditando(false);
    setTentou(false);
    setErroSalvar('');
    setCentavos('');
    setTimeout(() => alterarRef.current?.focus(), 0);
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (salvandoRef.current) return;
    setErroSalvar('');
    setTentou(true);
    if (erroDaCota(centavos) || novo === null) {
      setTimeout(() => campoRef.current?.querySelector('input')?.focus(), 0);
      return;
    }
    if (mesmoValor) return;

    // Primeiro cadastro salva direto; alterar pede confirmação que explica o efeito (vale só para novos pedidos).
    if (cadastrada && atualCentavos !== null) {
      const ok = await confirm({
        title: `Alterar a cota para ${formatarMoeda(novo / 100)}?`,
        message: `A cota passa de ${formatarMoeda(atualCentavos / 100)} para ${formatarMoeda(novo / 100)}. Vale para os novos pedidos de reserva em espaços com valor em percentual. As reservas já feitas mantêm o valor de quando foram pedidas.`,
        confirmLabel: 'Alterar cota',
        cancelLabel: 'Voltar',
      });
      if (!ok) return;
    }

    if (salvandoRef.current) return;
    salvandoRef.current = true;
    setSalvando(true);
    try {
      const r = await salvarCotaMinima(novo / 100);
      if (!r.ok) {
        setErroSalvar(
          r.erro === 'SEM_PERMISSAO' ? 'Você não tem mais permissão para alterar a cota. Fale com o Síndico.'
          : r.erro === 'INVALIDA' ? 'Esse valor não foi aceito. Use um valor maior que zero, de até R$ 100.000,00.'
          : 'Não foi possível salvar a cota. Nada foi alterado. Tente de novo; se continuar, avise o suporte.',
        );
        return;
      }
      const primeira = !cadastrada;
      setCota(r.cota);
      setEditando(false);
      setTentou(false);
      setCentavos('');
      setFeedbackMsg({
        type: 'success',
        text: primeira
          ? `Cota cadastrada: ${formatarMoeda(novo / 100)}. Já dá para usar percentual nos espaços.`
          : `Cota alterada para ${formatarMoeda(novo / 100)}. Vale para os novos pedidos; as reservas já feitas não mudam.`,
      });
      setTimeout(() => {
        feedbackRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        alterarRef.current?.focus();
      }, 100);
    } finally {
      salvandoRef.current = false;
      setSalvando(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5 lg:mx-0">
      <div>
        <h1 className="flex items-center gap-2 font-display text-xl font-bold text-slate-900">
          <Settings className="h-5 w-5 text-accent" aria-hidden="true" />
          Configurações
        </h1>
        <p className="mt-1 text-xs text-slate-500">Ajustes do condomínio que valem para todo o portal.</p>
      </div>

      {feedbackMsg && (
        <div
          ref={feedbackRef}
          role={feedbackMsg.type === 'error' ? 'alert' : 'status'}
          className={`flex items-center justify-between rounded-2xl p-4 text-xs font-semibold ${
            feedbackMsg.type === 'success'
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border border-red-200 bg-red-50 text-red-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMsg.type === 'success'
              ? <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              : <AlertTriangle className="h-4 w-4 text-red-600" aria-hidden="true" />}
            <span>{feedbackMsg.text}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)} aria-label="Fechar mensagem" className="-m-3.5 flex size-11 shrink-0 items-center justify-center text-slate-500 hover:text-slate-600">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      <section id="reservas" aria-labelledby="config-reservas-titulo" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="border-b border-slate-200 bg-slate-50/75 p-4">
          <h2 id="config-reservas-titulo" className="text-xs font-bold uppercase tracking-wider text-slate-800">Reservas de espaços</h2>
        </div>

        <div className="space-y-3 p-4" aria-busy={carga === 'carregando'}>
          <h3 className="text-sm font-bold text-slate-900">Cota mínima do condomínio</h3>
          <p className="text-xs text-slate-600">
            Valor de referência usado para calcular os espaços cobrados em percentual. Exemplo: com cota de R$ 1.225,00, um espaço de 5% custa R$ 61,25.
            Vale só para novas reservas; as reservas já feitas não mudam.
          </p>

          {carga === 'carregando' && (
            <div role="status" className="space-y-2">
              <span className="sr-only">Carregando configurações</span>
              <div className="h-5 w-40 animate-pulse rounded-xl bg-slate-100" />
              <div className="h-8 w-56 animate-pulse rounded-xl bg-slate-100" />
              <div className="h-4 w-48 animate-pulse rounded-xl bg-slate-100" />
            </div>
          )}

          {carga === 'erro' && (
            <div className="flex flex-col items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              <p role="alert" className="flex items-start gap-2 font-semibold">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                Não foi possível carregar a cota agora. Nada foi alterado. Tente de novo.
              </p>
              <button type="button" onClick={() => { setCarga('carregando'); setTentativa((n) => n + 1); }} className="min-h-11 rounded-xl border border-red-300 bg-white px-4 text-xs font-semibold text-red-800 hover:bg-red-50">
                Tentar de novo
              </button>
            </div>
          )}

          {carga === 'ok' && !campoAberto && cota?.valor != null && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-display text-2xl font-semibold text-slate-900">{formatarMoeda(cota.valor)}</p>
                {cota.atualizadoEm && (
                  <p className="text-[12px] text-slate-600">
                    Atualizada em {formatarData(cota.atualizadoEm)}{cota.atualizadoPorNome ? ` por ${cota.atualizadoPorNome}` : ''}.
                  </p>
                )}
              </div>
              <button
                ref={alterarRef}
                type="button"
                onClick={abrirEdicao}
                className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-800 hover:bg-slate-50 sm:w-auto"
              >
                Alterar cota
              </button>
            </div>
          )}

          {campoAberto && (
            <form onSubmit={salvar} noValidate className="space-y-3">
              {!cadastrada && (
                <p className="flex items-start gap-2 rounded-xl border border-pendente-200 bg-pendente-50 p-3 text-[12px] text-pendente-900">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-pendente-700" aria-hidden="true" />
                  <span>A cota ainda não foi cadastrada. Sem ela, nenhum espaço pode ter valor em percentual.</span>
                </p>
              )}
              <fieldset disabled={salvando} className="contents [&_input:disabled]:text-slate-900">
                <div ref={campoRef}>
                  <CampoVeiculo
                    id="config-cota"
                    label="Valor da cota (R$)"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    prefixo="R$"
                    placeholder="0,00"
                    value={centavos ? centavosParaReais(centavos) : ''}
                    // Máscara de centavos, como no valor de uso do espaço: só dígitos (122500 = R$ 1.225,00).
                    onChange={(e) => setCentavos(mascaraCentavos(e.target.value))}
                    apoio="Digite só os números: 122500 = R$ 1.225,00. O máximo é R$ 100.000,00."
                    erro={erroCampo}
                  />
                </div>
              </fieldset>

              {erroSalvar && (
                <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  {erroSalvar}
                </p>
              )}
              {mesmoValor && <p className="text-[12px] text-slate-600">Digite um valor diferente do atual para salvar.</p>}

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="submit"
                  disabled={salvando || mesmoValor}
                  aria-busy={salvando}
                  className="min-h-11 rounded-xl bg-primary px-4 text-xs font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {salvando ? 'Salvando…' : cadastrada ? 'Salvar nova cota' : 'Salvar cota'}
                </button>
                {cadastrada && (
                  <button
                    type="button"
                    onClick={cancelar}
                    disabled={salvando}
                    className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          )}

          <p className="flex items-start gap-2 rounded-xl bg-accent-50 px-3 py-2.5 text-[12px] font-semibold text-accent-strong">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>A mesma cota vale para todas as unidades. A Dona Wanda só calcula e mostra o valor; a cobrança é feita pelo síndico, por fora.</span>
          </p>
        </div>
      </section>
    </div>
  );
}
