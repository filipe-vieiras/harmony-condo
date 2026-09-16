'use client';

import React, { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { PrintReportHeader } from '@/components/reports/PrintReportHeader';
import { useApp } from '@/context/AppContext';
import { ReservationStatus } from '@/types';
import { 
  CalendarDays, 
  Plus, 
  Check, 
  X, 
  Clock, 
  Users, 
  Calendar, 
  AlertCircle, 
  DollarSign, 
  Printer, 
  Sparkles,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

export default function ReservasPage() {
  return (
    <AppShell>
      <ReservasContent />
    </AppShell>
  );
}

function ReservasContent() {
  const { 
    currentUser, 
    spaces, 
    reservations, 
    requestReservation, 
    judgeReservation 
  } = useApp();

  const [showModal, setShowModal] = useState(false);
  const [selectedSpaceId, setSelectedSpaceId] = useState(spaces[0]?.id || '');
  const [dataReserva, setDataReserva] = useState('2026-09-28');
  const [horarioInicio, setHorarioInicio] = useState('12:00');
  const [horarioFim, setHorarioFim] = useState('18:00');
  const [convidados, setConvidados] = useState(15);
  const [termoAceito, setTermoAceito] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const statusMap: Record<ReservationStatus, { label: string; bg: string; text: string }> = {
    PENDENTE: { label: 'Aguardando Aprovação do Síndico', bg: 'bg-amber-100', text: 'text-amber-800' },
    APROVADA: { label: 'Confirmada & Aprovada', bg: 'bg-emerald-100', text: 'text-emerald-800' },
    RECUSADA: { label: 'Recusada pela Administração', bg: 'bg-red-100', text: 'text-red-800' },
    CANCELADA: { label: 'Cancelada', bg: 'bg-slate-100', text: 'text-slate-700' },
  };

  const handleCreateReservation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!termoAceito) {
      alert('É obrigatório aceitar o regulamento e normas de uso do espaço.');
      return;
    }

    const res = requestReservation({
      espacoId: selectedSpaceId,
      data: dataReserva,
      horarioInicio,
      horarioFim,
      convidadosEstimados: Number(convidados),
    });

    if (res.success) {
      setFeedbackMsg({ type: 'success', text: res.message });
      setShowModal(false);
      setTermoAceito(false);
    } else {
      setFeedbackMsg({ type: 'error', text: res.message });
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Cabeçalho impresso com o Logotipo Oficial */}
      <PrintReportHeader
        titulo="Agenda Oficial de Reservas das Áreas Comuns"
        subtitulo="Controle de acesso da Portaria e cronograma de higienização"
      />

      {/* Cabeçalho de Tela */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-[#00A8E8]" />
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
              Reserva de Espaços Comuns
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Salão de festas, churrasqueira e quadra poliesportiva com validação e aprovação do Síndico.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50"
          >
            <Printer className="h-4 w-4 text-slate-500" />
            <span>Imprimir Agenda</span>
          </button>

          <button
            onClick={() => {
              setFeedbackMsg(null);
              setShowModal(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-[#0B2545] px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-[#134074]"
          >
            <Plus className="h-4 w-4 text-[#00A8E8]" />
            <span>Solicitar Reserva</span>
          </button>
        </div>
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
          <button onClick={() => setFeedbackMsg(null)} className="text-slate-400 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Galeria de Espaços Disponíveis */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {spaces.map((spc) => (
          <div
            key={spc.id}
            className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-xs flex flex-col justify-between"
          >
            <div>
              <div className="relative h-44 w-full">
                <img
                  src={spc.imagemUrl}
                  alt={spc.nome}
                  className="h-full w-full object-cover"
                />
                <div className="absolute bottom-2 left-2 rounded-lg bg-black/60 px-2 py-1 text-[11px] font-bold text-white backdrop-blur-md">
                  Capacidade: até {spc.capacidadeMax} pessoas
                </div>
              </div>

              <div className="p-5">
                <h3 className="text-base font-bold text-slate-900">{spc.nome}</h3>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">{spc.descricao}</p>

                <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-3 text-xs text-slate-600">
                  <div className="flex items-center justify-between">
                    <span>Horário permitido:</span>
                    <strong className="text-slate-900">{spc.horarioFuncionamento}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Taxa de higienização:</span>
                    <strong className="text-[#0B2545]">
                      {spc.taxaLimpeza > 0 ? `R$ ${spc.taxaLimpeza.toFixed(2)}` : 'Isento'}
                    </strong>
                  </div>
                </div>

                <div className="mt-3 rounded-xl bg-slate-50 p-2.5 text-[11px] text-slate-600 space-y-1">
                  <p className="font-bold text-slate-700">Regras Principais:</p>
                  {spc.regras.slice(0, 2).map((r, i) => (
                    <p key={i}>• {r}</p>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-5 pt-0 no-print">
              <button
                type="button"
                onClick={() => {
                  setSelectedSpaceId(spc.id);
                  setShowModal(true);
                }}
                className="w-full rounded-xl bg-slate-100 py-2.5 text-xs font-bold text-[#0B2545] transition hover:bg-[#0B2545] hover:text-white"
              >
                Agendar Este Espaço
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Tabela de Solicitações e Agenda de Reservas */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">
            Cronograma e Histórico de Solicitações
          </h2>
          <span className="text-xs text-slate-500">
            Total de {reservations.length} solicitação(ões)
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Espaço Comum</th>
                  <th className="px-5 py-3.5">Data & Turno</th>
                  <th className="px-5 py-3.5">Unidade / Morador</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Avaliação / Parecer</th>
                  {currentUser?.role === 'SINDICO' && (
                    <th className="px-5 py-3.5 text-right no-print">Aprovação do Síndico</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reservations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                      Nenhuma reserva registrada até o momento.
                    </td>
                  </tr>
                ) : (
                  reservations.map((r) => {
                    const st = statusMap[r.status] || { label: r.status, bg: 'bg-slate-100', text: 'text-slate-700' };

                    return (
                      <tr key={r.id} className="hover:bg-slate-50/60 transition">
                        <td className="px-5 py-3.5 font-bold text-slate-900">
                          {r.espacoNome}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="font-semibold text-slate-900">{r.data}</div>
                          <div className="text-[11px] text-slate-500">
                            {r.horarioInicio} às {r.horarioFim}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="font-bold text-[#0B2545]">
                            Apto {r.unidade} - Bloco {r.bloco}
                          </div>
                          <div className="text-[11px] text-slate-500">{r.moradorNome}</div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${st.bg} ${st.text}`}>
                            {st.label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-[11px] text-slate-600">
                          {r.status === 'APROVADA' && (
                            <span className="text-emerald-700 font-semibold">
                              Aprovado por {r.avaliadoPor || 'Administração'} em {r.dataAvaliacao || r.dataSolicitacao}
                            </span>
                          )}
                          {r.status === 'RECUSADA' && (
                            <span className="text-red-700 font-medium">
                              Motivo: {r.motivoRecusa}
                            </span>
                          )}
                          {r.status === 'PENDENTE' && (
                            <span className="text-amber-700 font-medium">
                              Solicitado em {r.dataSolicitacao}
                            </span>
                          )}
                        </td>
                        {currentUser?.role === 'SINDICO' && (
                          <td className="px-5 py-3.5 text-right no-print">
                            {r.status === 'PENDENTE' ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => judgeReservation(r.id, true)}
                                  className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white transition hover:bg-emerald-700"
                                  title="Aprovar reserva"
                                >
                                  <Check className="h-3 w-3" />
                                  <span>Aprovar</span>
                                </button>
                                <button
                                  onClick={() => {
                                    const motivo = prompt('Informe a justificativa da recusa:') || 'Data com manutenção programada.';
                                    judgeReservation(r.id, false, motivo);
                                  }}
                                  className="flex items-center gap-1 rounded-lg border border-red-300 bg-white px-2.5 py-1 text-xs font-bold text-red-700 transition hover:bg-red-50"
                                  title="Recusar reserva"
                                >
                                  <X className="h-3 w-3" />
                                  <span>Recusar</span>
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400">Processado</span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal de Solicitação de Reserva */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
            onClick={() => setShowModal(false)}
          />
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Solicitar Reserva de Espaço</h3>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateReservation} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Espaço Comum</label>
                <select
                  value={selectedSpaceId}
                  onChange={(e) => setSelectedSpaceId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-[#00A8E8] focus:outline-none"
                >
                  {spaces.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome} (Até {s.capacidadeMax} pessoas)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Data Desejada</label>
                  <input
                    type="date"
                    required
                    value={dataReserva}
                    onChange={(e) => setDataReserva(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#00A8E8] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Início</label>
                  <input
                    type="time"
                    required
                    value={horarioInicio}
                    onChange={(e) => setHorarioInicio(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#00A8E8] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Término</label>
                  <input
                    type="time"
                    required
                    value={horarioFim}
                    onChange={(e) => setHorarioFim(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#00A8E8] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Estimativa de Convidados</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  required
                  value={convidados}
                  onChange={(e) => setConvidados(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#00A8E8] focus:outline-none"
                />
              </div>

              {/* Informação sobre Aprovação Obrigatória do Síndico */}
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900">
                <div className="flex items-center gap-1.5 font-bold">
                  <Clock className="h-4 w-4 text-amber-700" />
                  <span>Aprovação Obrigatória:</span>
                </div>
                <p className="mt-1 text-[11px] text-amber-800">
                  Conforme determinado pela convenção, a sua solicitação será enviada ao Síndico com status <strong>PENDENTE</strong>. A reserva só estará confirmada após o deferimento pelo gestor.
                </p>
              </div>

              {/* Termo de Responsabilidade */}
              <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 p-3 bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={termoAceito}
                  onChange={(e) => setTermoAceito(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-[#0B2545] focus:ring-[#00A8E8]"
                />
                <span className="text-[11px] text-slate-600 leading-tight">
                  Declaro ter lido as regras de uso do espaço, responsabilizando-me pela integridade do mobiliário, higienização e respeito à lei do silêncio às 22h00.
                </span>
              </label>

              <div className="mt-5 flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#0B2545] px-4 py-2 text-xs font-semibold text-white hover:bg-[#134074]"
                >
                  Enviar para Aprovação do Síndico
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
