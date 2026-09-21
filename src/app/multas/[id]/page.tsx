'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { PrintReportHeader } from '@/components/reports/PrintReportHeader';
import { useApp } from '@/context/AppContext';
import { isAdmin } from '@/lib/roles';
import {
  ShieldAlert,
  ArrowLeft, 
  CheckCircle2, 
  Clock, 
  FileText, 
  Send, 
  Check, 
  X, 
  Printer,
  Calendar,
  AlertTriangle,
  Scale
} from 'lucide-react';

export default function MultaDetalhePage() {
  return (
    <AppShell>
      <MultaDetalheContent />
    </AppShell>
  );
}

function MultaDetalheContent() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const {
    currentUser,
    fines,
    units,
    confirmFineScience,
    submitFineAppeal,
    judgeFineAppeal
  } = useApp();

  const [textoRecurso, setTextoRecurso] = useState('');
  const [anexoNome, setAnexoNome] = useState('');
  const [respostaSindico, setRespostaSindico] = useState('');
  const [showRecursoForm, setShowRecursoForm] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fine = fines.find((f) => f.id === id);

  if (!fine) {
    if (!currentUser) return null;
    return (
      <div className="rounded-2xl bg-white p-12 text-center border border-slate-200">
        <h2 className="text-base font-bold text-slate-900">Notificação não encontrada</h2>
        <p className="mt-1 text-xs text-slate-500">O registro solicitado não existe ou foi removido.</p>
        <Link
          href="/multas"
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#0B2545] px-4 py-2 text-xs font-semibold text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Voltar para Notificações</span>
        </Link>
      </div>
    );
  }

  // Proteção: Morador só pode ver a sua própria multa!
  // Compara por unit_id (FK), não por texto — mesmo motivo da listagem em /multas.
    if (!currentUser) return null;
  const minhaUnidade = units.find((u) => u.usuarioId === currentUser.id);
  if (currentUser.role === 'MORADOR' && fine.unitId !== minhaUnidade?.id) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
        <h2 className="text-base font-bold text-red-900">Acesso Não Autorizado</h2>
        <p className="mt-1 text-xs text-red-700">
          Você não tem permissão para visualizar o prontuário disciplinar de outras unidades.
        </p>
        <Link
          href="/multas"
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#0B2545] px-4 py-2 text-xs font-semibold text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Voltar</span>
        </Link>
      </div>
    );
  }

  const handleConfirmScience = async () => {
    const res = await confirmFineScience(fine.id);
    setFeedbackMsg({ type: res.success ? 'success' : 'error', text: res.message });
  };

  const handleSendAppeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textoRecurso.trim()) return;
    const res = await submitFineAppeal(fine.id, textoRecurso, anexoNome || 'Comprovante_Anexo.pdf');
    setFeedbackMsg({ type: res.success ? 'success' : 'error', text: res.message });
    if (res.success) setShowRecursoForm(false);
  };

  const handleJudge = async (deferido: boolean) => {
    if (!respostaSindico.trim()) {
      setFeedbackMsg({ type: 'error', text: 'Por favor, informe a justificativa da decisão.' });
      return;
    }
    const res = await judgeFineAppeal(fine.id, deferido, respostaSindico);
    setFeedbackMsg({ type: res.success ? 'success' : 'error', text: res.message });
    if (res.success) setRespostaSindico('');
  };

  if (!currentUser) return null;

  return (
    <div className="space-y-6">
      
      {/* Cabeçalho impresso com o Logotipo Oficial */}
      <PrintReportHeader
        titulo={`Auto de Notificação e Infração Disciplinar • ${fine.numeroProtocolo}`}
        subtitulo={`Unidade Notificada: Apto ${fine.unidade} - Bloco ${fine.bloco} • Infrator: ${fine.moradorNome}`}
      />

      {/* Botão de Retorno e Ações */}
      <div className="flex items-center justify-between no-print">
        <Link
          href="/multas"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#0B2545]"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Voltar para Lista de Multas</span>
        </Link>

        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50"
        >
          <Printer className="h-4 w-4 text-slate-500" />
          <span>Imprimir Notificação Oficial</span>
        </button>
      </div>

      {/* Mensagem de Feedback */}
      {feedbackMsg && (
        <div
          className={`rounded-2xl p-4 text-xs font-semibold flex items-center justify-between no-print ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
              : 'bg-red-50 text-red-900 border border-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMsg.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-red-600" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)} aria-label="Fechar mensagem" className="text-slate-500 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Card Principal do Auto de Infração */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
        
        {/* Cabeçalho do Prontuário */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-xl bg-[#0B2545] px-3 py-1 font-mono text-sm font-bold text-white tracking-wider">
                {fine.numeroProtocolo}
              </span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  fine.tipo === 'MULTA' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                }`}
              >
                {fine.tipo === 'MULTA' ? `Multa: R$ ${fine.valor.toFixed(2)}` : 'Advertência Formal'}
              </span>
            </div>

            <h1 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">
              Auto de Constatação de Infração Condominial
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Data de Emissão: {fine.dataEmissao} • Prazo Limite para Defesa: <strong>{fine.prazoRecursoData}</strong>
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200/80 text-right sm:text-right">
            <span className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Unidade Notificada</span>
            <p className="text-lg font-bold text-[#0B2545]">
              Apartamento {fine.unidade} - Bloco {fine.bloco}
            </p>
            <p className="text-xs text-slate-600 font-medium">{fine.moradorNome}</p>
          </div>
        </div>

        {/* Artigo e Fato Gerador */}
        <div className="mt-6 space-y-4 text-xs sm:text-sm">
          <div className="rounded-2xl bg-slate-50/80 p-4 border border-slate-200">
            <span className="font-bold text-slate-900 block mb-1 text-xs uppercase tracking-wider text-[#0A6E9C]">
              Dispositivo Legal Infringido (Regimento Interno)
            </span>
            <p className="font-semibold text-slate-800">{fine.artigoRegimento}</p>
          </div>

          <div>
            <span className="font-bold text-slate-900 block mb-1.5 text-xs uppercase tracking-wider text-slate-500">
              Descrição Circunstanciada dos Fatos
            </span>
            <p className="text-slate-700 leading-relaxed bg-white rounded-xl border border-slate-100 p-4">
              {fine.descricaoInfracao}
            </p>
          </div>
        </div>

        {/* Galeria de Fotos e Evidências */}
        {fine.evidencias.length > 0 && (
          <div className="mt-6 border-t border-slate-100 pt-6">
            <span className="font-bold text-slate-900 block mb-3 text-xs uppercase tracking-wider text-slate-500">
              Evidências Probatórias Anexadas ({fine.evidencias.length})
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {fine.evidencias.map((ev) => (
                <div key={ev.id} className="rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden shadow-2xs">
                  <img
                    src={ev.url}
                    alt={ev.descricao}
                    className="h-48 w-full object-cover"
                  />
                  <div className="p-3 bg-white">
                    <p className="text-xs text-slate-600 font-medium">{ev.descricao}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STATUS DA CIÊNCIA FORMAL (REGISTRO JURÍDICO) */}
        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Ciência Formal do Morador:
                </span>
                {fine.ciencia ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Ciência Confirmada</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Aguardando Confirmação</span>
                  </span>
                )}
              </div>

              {fine.ciencia ? (
                <p className="mt-1 text-xs text-slate-600">
                  Registrada em <strong>{fine.ciencia.data}</strong> por <strong>{fine.ciencia.usuarioNome}</strong> ({fine.ciencia.ip})
                </p>
              ) : (
                <p className="mt-1 text-xs text-slate-500">
                  O morador deve confirmar ciência para fins de contagem do prazo recursal.
                </p>
              )}
            </div>

            {/* Ação do Morador: Dar Ciência */}
            {!fine.ciencia && currentUser.role === 'MORADOR' && (
              <button
                type="button"
                onClick={handleConfirmScience}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-700 no-print"
              >
                <Check className="h-4 w-4" />
                <span>Confirmar Ciência Formal</span>
              </button>
            )}
          </div>
        </div>

        {/* FLUXO DE RECURSO / DEFESA ADMINISTRATIVA */}
        <div className="mt-6 border-t border-slate-100 pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-[#00A8E8]" />
              <h3 className="text-base font-bold text-slate-900">
                Processo de Defesa & Recurso Administrativo
              </h3>
            </div>

            {fine.status === 'CIENCIA_REGISTRADA' && currentUser.role === 'MORADOR' && !showRecursoForm && (
              <button
                type="button"
                onClick={() => setShowRecursoForm(true)}
                className="rounded-xl bg-[#0B2545] px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-[#134074] no-print"
              >
                Interpor Recurso Online
              </button>
            )}
          </div>

          {/* Formulário de Recurso para o Morador */}
          {showRecursoForm && (
            <form onSubmit={handleSendAppeal} className="mt-4 rounded-2xl border border-sky-200 bg-sky-50/50 p-5 space-y-3 no-print">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">Redigir Justificativa / Defesa</span>
                <button
                  type="button"
                  onClick={() => setShowRecursoForm(false)}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  Cancelar
                </button>
              </div>

              <label htmlFor="recurso-texto" className="sr-only">Justificativa do recurso</label>
              <textarea
                id="recurso-texto"
                rows={4}
                required
                value={textoRecurso}
                onChange={(e) => setTextoRecurso(e.target.value)}
                placeholder="Apresente seus argumentos e motivos para o cancelamento ou relevação da sanção..."
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
              />

              <div>
                <label htmlFor="recurso-anexo" className="block text-xs font-semibold text-slate-700">Anexo Comprobatório (Opcional)</label>
                <input
                  id="recurso-anexo"
                  type="text"
                  placeholder="Ex: Comprovante_Prestador.pdf ou Foto_Local.jpg"
                  value={anexoNome}
                  onChange={(e) => setAnexoNome(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded-xl bg-[#0B2545] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#134074]"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Protocolar Recurso</span>
                </button>
              </div>
            </form>
          )}

          {/* Exibição do Recurso Protocolado */}
          {fine.recurso ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900">
                    Razões do Recurso do Morador ({fine.recurso.data})
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 font-bold ${
                      fine.recurso.status === 'DEFERIDO'
                        ? 'bg-emerald-100 text-emerald-800'
                        : fine.recurso.status === 'INDEFERIDO'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {fine.recurso.status === 'EM_ANALISE' ? 'Em Análise pelo Síndico' : fine.recurso.status}
                  </span>
                </div>

                <p className="mt-2 text-xs text-slate-700 leading-relaxed bg-white p-3 rounded-xl border border-slate-200">
                  {fine.recurso.texto}
                </p>

                {fine.recurso.anexoNome && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-[#0A6E9C] font-semibold">
                    <FileText className="h-3.5 w-3.5" />
                    <span>Anexo Protocolado: {fine.recurso.anexoNome}</span>
                  </div>
                )}
              </div>

              {/* Decisão do Síndico / Julgamento */}
              {fine.recurso.resposta ? (
                <div
                  className={`rounded-2xl p-5 border ${
                    fine.recurso.status === 'DEFERIDO'
                      ? 'bg-emerald-50 border-emerald-200'
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className={fine.recurso.status === 'DEFERIDO' ? 'text-emerald-900' : 'text-red-900'}>
                      Decisão Administrativa do Síndico ({fine.recurso.dataResposta})
                    </span>
                    <span className={fine.recurso.status === 'DEFERIDO' ? 'text-emerald-800' : 'text-red-800'}>
                      Julgado por: {fine.recurso.analisadoPor}
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-slate-700 leading-relaxed bg-white/90 p-3 rounded-xl border border-slate-200/60">
                    {fine.recurso.resposta}
                  </p>
                </div>
              ) : isAdmin(currentUser.role) ? (
                /* Painel de Julgamento para o Síndico */
                <div className="rounded-2xl border border-[#0B2545]/20 bg-[#0B2545]/5 p-5 space-y-3 no-print">
                  <h4 className="text-xs font-bold text-[#0B2545] uppercase tracking-wider">
                    Julgamento Administrativo (Área do Síndico)
                  </h4>
                  <p className="text-xs text-slate-600">
                    Analise os argumentos do condômino e profira o julgamento fundamentado:
                  </p>

                  <label htmlFor="julgamento-resposta" className="sr-only">Justificativa da decisão</label>
                  <textarea
                    id="julgamento-resposta"
                    rows={3}
                    placeholder="Justificativa da decisão..."
                    value={respostaSindico}
                    onChange={(e) => setRespostaSindico(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
                  />

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => handleJudge(false)}
                      className="flex items-center gap-1.5 rounded-xl border border-red-300 bg-white px-4 py-2 text-xs font-bold text-red-700 transition hover:bg-red-50"
                    >
                      <X className="h-4 w-4" />
                      <span>Indeferir (Manter Sanção)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleJudge(true)}
                      className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-700"
                    >
                      <Check className="h-4 w-4" />
                      <span>Deferir (Anular Multa)</span>
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate-500">
              Nenhum recurso interposto até o momento.
            </p>
          )}
        </div>

      </div>

    </div>
  );
}
