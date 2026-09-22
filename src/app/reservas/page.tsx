'use client';

import React, { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { PrintReportHeader } from '@/components/reports/PrintReportHeader';
import { useDialog } from '@/components/ui/DialogProvider';
import { Badge } from '@/components/ui/Badge';
import { useApp } from '@/context/AppContext';
import { ReservationStatus, CommonSpace } from '@/types';
import { isAdmin } from '@/lib/roles';
import { useEscapeToClose } from '@/lib/useEscapeToClose';
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
  AlertTriangle,
  Pencil,
  Trash2,
  Settings,
  Building2,
  EyeOff,
  Eye
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
    addSpace,
    updateSpace,
    deleteSpace,
    reservations, 
    requestReservation, 
    judgeReservation 
  } = useApp();
  const { confirm, askReason } = useDialog();
  const [reservaFormError, setReservaFormError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [selectedSpaceId, setSelectedSpaceId] = useState(spaces[0]?.id || '');
  const [dataReserva, setDataReserva] = useState('2026-09-28');
  const [horarioInicio, setHorarioInicio] = useState('12:00');
  const [horarioFim, setHorarioFim] = useState('18:00');
  const [convidados, setConvidados] = useState(15);
  const [termoAceito, setTermoAceito] = useState(false);
  const [reservaMoradorNome, setReservaMoradorNome] = useState('');
  const [reservaBloco, setReservaBloco] = useState('A');
  const [reservaUnidade, setReservaUnidade] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Estados para Gestão de Espaços (Síndico)
  const [showSpaceModal, setShowSpaceModal] = useState(false);
  const [editingSpaceId, setEditingSpaceId] = useState<string | null>(null);
  const [spaceNome, setSpaceNome] = useState('');
  const [spaceDescricao, setSpaceDescricao] = useState('');
  const [spaceCapacidadeMax, setSpaceCapacidadeMax] = useState(20);
  const [spaceHorario, setSpaceHorario] = useState('08:00 às 22:00');
  const [spaceTaxaLimpeza, setSpaceTaxaLimpeza] = useState(0);
  const [spaceRegras, setSpaceRegras] = useState('');
  const [spaceImagemUrl, setSpaceImagemUrl] = useState('');
  const [spaceAtivo, setSpaceAtivo] = useState(true);

  const isSindico = isAdmin(currentUser?.role);
  // Equipe sem unidade própria (Síndico/ADM/Portaria) precisa informar de qual
  // morador é a reserva ao registrar em nome de alguém (ex: pedido por telefone).
  const isStaff = currentUser?.role !== 'MORADOR';

  useEscapeToClose(showModal, () => setShowModal(false));
  useEscapeToClose(showSpaceModal, () => setShowSpaceModal(false));

  const handleOpenNewSpace = () => {
    setEditingSpaceId(null);
    setSpaceNome('');
    setSpaceDescricao('');
    setSpaceCapacidadeMax(20);
    setSpaceHorario('08:00 às 22:00');
    setSpaceTaxaLimpeza(0);
    setSpaceRegras('Somente som ambiente até às 22h00\nLimpeza e devolução das chaves no dia seguinte');
    setSpaceImagemUrl('https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=800&q=80');
    setSpaceAtivo(true);
    setShowSpaceModal(true);
  };

  const handleOpenEditSpace = (s: CommonSpace) => {
    setEditingSpaceId(s.id);
    setSpaceNome(s.nome);
    setSpaceDescricao(s.descricao);
    setSpaceCapacidadeMax(s.capacidadeMax);
    setSpaceHorario(s.horarioFuncionamento);
    setSpaceTaxaLimpeza(s.taxaLimpeza);
    setSpaceRegras(s.regras.join('\n'));
    setSpaceImagemUrl(s.imagemUrl);
    setSpaceAtivo(s.ativo !== false);
    setShowSpaceModal(true);
  };

  const handleSaveSpace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!spaceNome) return;

    const regrasList = spaceRegras.split('\n').map((r) => r.trim()).filter(Boolean);

    if (editingSpaceId) {
      await updateSpace(editingSpaceId, {
        nome: spaceNome,
        descricao: spaceDescricao,
        capacidadeMax: Number(spaceCapacidadeMax),
        horarioFuncionamento: spaceHorario,
        taxaLimpeza: Number(spaceTaxaLimpeza),
        regras: regrasList,
        imagemUrl: spaceImagemUrl || 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=800&q=80',
        ativo: spaceAtivo,
      });
      setFeedbackMsg({ type: 'success', text: `Espaço "${spaceNome}" atualizado com sucesso!` });
    } else {
      await addSpace({
        nome: spaceNome,
        descricao: spaceDescricao,
        capacidadeMax: Number(spaceCapacidadeMax),
        horarioFuncionamento: spaceHorario,
        taxaLimpeza: Number(spaceTaxaLimpeza),
        regras: regrasList,
        imagemUrl: spaceImagemUrl || 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=800&q=80',
        ativo: spaceAtivo,
      });
      setFeedbackMsg({ type: 'success', text: `Espaço "${spaceNome}" cadastrado com sucesso!` });
    }
    setShowSpaceModal(false);
  };

  const handleDeleteSpace = async (id: string, nome: string) => {
    if (await confirm({ title: `Remover o espaço "${nome}"?`, message: 'Reservas futuras desse espaço deixam de fazer sentido. Prefira desativar se for temporário.', confirmLabel: 'Remover espaço', destructive: true })) {
      const res = await deleteSpace(id);
      setFeedbackMsg({ type: res.success ? 'success' : 'error', text: res.message });
    }
  };

  const handleToggleSpaceAtivo = async (s: CommonSpace) => {
    const novoStatus = !(s.ativo !== false);
    await updateSpace(s.id, { ativo: novoStatus });
    setFeedbackMsg({
      type: 'success',
      text: `Espaço "${s.nome}" agora está ${novoStatus ? 'ATIVO para reservas' : 'DESATIVADO/EM MANUTENÇÃO'}.`,
    });
  };

  const statusMap: Record<ReservationStatus, { label: string; bg: string; text: string }> = {
    PENDENTE: { label: 'Aguardando Aprovação do Síndico', bg: 'bg-amber-100', text: 'text-amber-800' },
    APROVADA: { label: 'Confirmada & Aprovada', bg: 'bg-emerald-100', text: 'text-emerald-800' },
    RECUSADA: { label: 'Recusada pela Administração', bg: 'bg-red-100', text: 'text-red-800' },
    CANCELADA: { label: 'Cancelada', bg: 'bg-slate-100', text: 'text-slate-700' },
  };

  const handleCreateReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    setReservaFormError(null);
    if (!termoAceito) {
      setReservaFormError('É obrigatório aceitar o regulamento e normas de uso do espaço.');
      return;
    }
    if (isStaff && !reservaMoradorNome.trim()) {
      setReservaFormError('Informe o nome do morador para quem a reserva está sendo registrada.');
      return;
    }

    const res = await requestReservation({
      espacoId: selectedSpaceId,
      data: dataReserva,
      horarioInicio,
      horarioFim,
      convidadosEstimados: Number(convidados),
      ...(isStaff ? { moradorNome: reservaMoradorNome.trim(), bloco: reservaBloco, unidade: reservaUnidade.trim() } : {}),
    });

    if (res.success) {
      setFeedbackMsg({ type: 'success', text: res.message });
      setShowModal(false);
      setTermoAceito(false);
      setReservaMoradorNome('');
      setReservaUnidade('');
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

        <div className="flex flex-wrap items-center gap-2">
          {isSindico && (
            <button
              onClick={handleOpenNewSpace}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-[#0B2545] shadow-xs transition hover:bg-slate-50"
            >
              <Plus className="h-4 w-4 text-[#00A8E8]" />
              <span>Cadastrar Espaço</span>
            </button>
          )}

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
              setReservaFormError(null);
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
          <button onClick={() => setFeedbackMsg(null)} aria-label="Fechar mensagem" className="text-slate-500 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Galeria de Espaços Disponíveis */}
      {spaces.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white/60 p-8 text-center text-xs text-slate-500 no-print">
          Nenhum espaço comum cadastrado ainda.
          {isSindico && ' Clique em "Cadastrar Espaço" para adicionar o primeiro.'}
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {spaces.map((spc) => {
          const isAtivo = spc.ativo !== false;
          return (
            <div
              key={spc.id}
              className={`rounded-3xl border bg-white overflow-hidden shadow-xs flex flex-col justify-between transition ${
                isAtivo ? 'border-slate-200' : 'border-amber-200 bg-amber-50/20'
              }`}
            >
              <div>
                <div className="relative h-44 w-full">
                  <img
                    src={spc.imagemUrl || 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=800&q=80'}
                    alt={spc.nome}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute bottom-2 left-2 rounded-lg bg-black/60 px-2 py-1 text-[12px] font-bold text-white backdrop-blur-md">
                    Capacidade: até {spc.capacidadeMax} pessoas
                  </div>
                  {!isAtivo && (
                    <div className="absolute top-2 left-2 rounded-lg bg-amber-600 px-2.5 py-1 text-[12px] font-bold text-white shadow-md">
                      Em Manutenção / Inativo
                    </div>
                  )}
                  {isSindico && (
                    <div className="absolute top-2 right-2 flex items-center gap-1.5 no-print">
                      <button
                        onClick={() => handleOpenEditSpace(spc)}
                        title="Editar Espaço"
                        aria-label={`Editar espaço ${spc.nome}`}
                        className="rounded-lg bg-white/90 p-1.5 text-slate-700 shadow-md backdrop-blur-md hover:bg-white hover:text-[#0B2545]"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleToggleSpaceAtivo(spc)}
                        title={isAtivo ? 'Desativar Espaço' : 'Ativar Espaço'}
                        aria-label={`${isAtivo ? 'Desativar' : 'Ativar'} espaço ${spc.nome}`}
                        className="rounded-lg bg-white/90 p-1.5 text-slate-700 shadow-md backdrop-blur-md hover:bg-white hover:text-amber-600"
                      >
                        {isAtivo ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5 text-emerald-600" />}
                      </button>
                      <button
                        onClick={() => handleDeleteSpace(spc.id, spc.nome)}
                        title="Excluir Espaço"
                        aria-label={`Excluir espaço ${spc.nome}`}
                        className="rounded-lg bg-white/90 p-1.5 text-slate-700 shadow-md backdrop-blur-md hover:bg-white hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-bold text-slate-900">{spc.nome}</h3>
                  </div>
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

                  <div className="mt-3 rounded-xl bg-slate-50 p-2.5 text-[12px] text-slate-600 space-y-1">
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
                  disabled={!isAtivo}
                  onClick={() => {
                    setSelectedSpaceId(spc.id);
                    setReservaFormError(null);
                    setShowModal(true);
                  }}
                  className={`w-full rounded-xl py-2.5 text-xs font-bold transition ${
                    isAtivo
                      ? 'bg-slate-100 text-[#0B2545] hover:bg-[#0B2545] hover:text-white'
                      : 'bg-slate-100 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {isAtivo ? 'Agendar Este Espaço' : 'Indisponível no Momento'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      )}

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
            <table className="stack-mobile w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50/75 text-[12px] font-bold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Espaço Comum</th>
                  <th className="px-5 py-3.5">Data & Turno</th>
                  <th className="px-5 py-3.5">Unidade / Morador</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Avaliação / Parecer</th>
                  {isAdmin(currentUser?.role) && (
                    <th className="px-5 py-3.5 text-right no-print">Aprovação do Síndico</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reservations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-slate-500">
                      Nenhuma reserva registrada até o momento.
                    </td>
                  </tr>
                ) : (
                  reservations.map((r) => {
                    const st = statusMap[r.status] || { label: r.status, bg: 'bg-slate-100', text: 'text-slate-700' };

                    return (
                      <tr key={r.id} className="hover:bg-slate-50/60 transition">
                        <td data-label="Espaço Comum" className="px-5 py-3.5 font-bold text-slate-900 whitespace-nowrap">
                          {r.espacoNome}
                        </td>
                        <td data-label="Data & Turno" className="px-5 py-3.5 whitespace-nowrap">
                          <div className="font-semibold text-slate-900">{r.data}</div>
                          <div className="text-[12px] text-slate-500">
                            {r.horarioInicio} às {r.horarioFim}
                          </div>
                        </td>
                        <td data-label="Unidade / Morador" className="px-5 py-3.5 whitespace-nowrap">
                          <div className="font-bold text-[#0B2545]">
                            Apto {r.unidade} - Bloco {r.bloco}
                          </div>
                          <div className="text-[12px] text-slate-500">{r.moradorNome}</div>
                        </td>
                        <td data-label="Status" className="px-5 py-3.5 whitespace-nowrap">
                          <Badge className={`${st.bg} ${st.text}`}>{st.label}</Badge>
                        </td>
                        <td data-label="Avaliação / Parecer" className="px-5 py-3.5 text-[12px] text-slate-600">
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
                        {isAdmin(currentUser?.role) && (
                          <td data-label="Aprovação do Síndico" className="px-5 py-3.5 text-right no-print whitespace-nowrap">
                            {r.status === 'PENDENTE' ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => judgeReservation(r.id, true)}
                                  className="flex items-center gap-1 whitespace-nowrap rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white transition hover:bg-emerald-700"
                                  title="Aprovar reserva"
                                >
                                  <Check className="h-3 w-3" />
                                  <span>Aprovar</span>
                                </button>
                                <button
                                  onClick={async () => {
                                    const motivo = await askReason({
                                      title: 'Recusar reserva',
                                      message: `${r.espacoNome} em ${r.data}, Apto ${r.unidade}-${r.bloco}.`,
                                      label: 'Justificativa da recusa',
                                      confirmLabel: 'Recusar reserva',
                                    });
                                    if (motivo) judgeReservation(r.id, false, motivo);
                                  }}
                                  className="flex items-center gap-1 whitespace-nowrap rounded-lg border border-red-300 bg-white px-2.5 py-1 text-xs font-bold text-red-700 transition hover:bg-red-50"
                                  title="Recusar reserva"
                                >
                                  <X className="h-3 w-3" />
                                  <span>Recusar</span>
                                </button>
                              </div>
                            ) : (
                              <span className="text-[12px] text-slate-500">Processado</span>
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
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reserva-modal-title"
            className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 id="reserva-modal-title" className="text-base font-bold text-slate-900">Solicitar Reserva de Espaço</h3>
              <button
                onClick={() => setShowModal(false)}
                aria-label="Fechar"
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateReservation} className="mt-4 space-y-4">
              <div>
                <label htmlFor="reserva-espaco" className="block text-xs font-semibold text-slate-700">Espaço Comum</label>
                <select
                  id="reserva-espaco"
                  value={selectedSpaceId}
                  onChange={(e) => setSelectedSpaceId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
                >
                  {spaces.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome} (Até {s.capacidadeMax} pessoas)
                    </option>
                  ))}
                </select>
              </div>

              {isStaff && (
                <div className="rounded-xl border border-sky-200 bg-sky-50 p-3.5 space-y-3">
                  <p className="text-[12px] font-bold text-sky-900">
                    Registrando em nome de um morador (ex: pedido recebido por telefone)
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-1">
                      <label htmlFor="reserva-morador-nome" className="block text-xs font-semibold text-slate-700">Nome do Morador</label>
                      <input
                        id="reserva-morador-nome"
                        type="text"
                        required
                        placeholder="Nome completo"
                        value={reservaMoradorNome}
                        onChange={(e) => setReservaMoradorNome(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
                      />
                    </div>
                    <div>
                      <label htmlFor="reserva-bloco" className="block text-xs font-semibold text-slate-700">Bloco</label>
                      <select
                        id="reserva-bloco"
                        value={reservaBloco}
                        onChange={(e) => setReservaBloco(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
                      >
                        <option value="A">Bloco A</option>
                        <option value="B">Bloco B</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="reserva-unidade" className="block text-xs font-semibold text-slate-700">Apto</label>
                      <input
                        id="reserva-unidade"
                        type="text"
                        required
                        placeholder="Ex: 602"
                        value={reservaUnidade}
                        onChange={(e) => setReservaUnidade(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label htmlFor="reserva-data" className="block text-xs font-semibold text-slate-700">Data Desejada</label>
                  <input
                    id="reserva-data"
                    type="date"
                    required
                    value={dataReserva}
                    onChange={(e) => setDataReserva(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
                  />
                </div>
                <div>
                  <label htmlFor="reserva-inicio" className="block text-xs font-semibold text-slate-700">Início</label>
                  <input
                    id="reserva-inicio"
                    type="time"
                    required
                    value={horarioInicio}
                    onChange={(e) => setHorarioInicio(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
                  />
                </div>
                <div>
                  <label htmlFor="reserva-fim" className="block text-xs font-semibold text-slate-700">Término</label>
                  <input
                    id="reserva-fim"
                    type="time"
                    required
                    value={horarioFim}
                    onChange={(e) => setHorarioFim(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="reserva-convidados" className="block text-xs font-semibold text-slate-700">Estimativa de Convidados</label>
                <input
                  id="reserva-convidados"
                  type="number"
                  min="1"
                  max="100"
                  required
                  value={convidados}
                  onChange={(e) => setConvidados(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
                />
              </div>

              {/* Informação sobre Aprovação Obrigatória do Síndico */}
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900">
                <div className="flex items-center gap-1.5 font-bold">
                  <Clock className="h-4 w-4 text-amber-700" />
                  <span>Aprovação Obrigatória:</span>
                </div>
                <p className="mt-1 text-[12px] text-amber-800">
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
                <span className="text-[12px] text-slate-600 leading-tight">
                  Declaro ter lido as regras de uso do espaço, responsabilizando-me pela integridade do mobiliário, higienização e respeito à lei do silêncio às 22h00.
                </span>
              </label>

              {reservaFormError && (
                <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                  <span>{reservaFormError}</span>
                </div>
              )}

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

      {/* Modal de Gestão/Cadastro de Espaço (Síndico) */}
      {showSpaceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs no-print">
          <div
            className="fixed inset-0"
            onClick={() => setShowSpaceModal(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="espaco-modal-title"
            className="relative w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-[#00A8E8]" />
                <h3 id="espaco-modal-title" className="text-base font-bold text-slate-900">
                  {editingSpaceId ? 'Editar Espaço Comum' : 'Cadastrar Novo Espaço Comum'}
                </h3>
              </div>
              <button
                onClick={() => setShowSpaceModal(false)}
                aria-label="Fechar"
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSpace} className="mt-4 space-y-4">
              <div>
                <label htmlFor="espaco-nome" className="block text-xs font-semibold text-slate-700">Nome do Espaço</label>
                <input
                  id="espaco-nome"
                  type="text"
                  required
                  placeholder="Ex: Espaço Gourmet & Lounge, Churrasqueira B"
                  value={spaceNome}
                  onChange={(e) => setSpaceNome(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
                />
              </div>

              <div>
                <label htmlFor="espaco-descricao" className="block text-xs font-semibold text-slate-700">Descrição</label>
                <textarea
                  id="espaco-descricao"
                  rows={2}
                  required
                  placeholder="Ex: Ambiente climatizado com churrasqueira a carvão, mesas de apoio, freezer e chopeira."
                  value={spaceDescricao}
                  onChange={(e) => setSpaceDescricao(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="espaco-capacidade" className="block text-xs font-semibold text-slate-700">Capacidade Máx.</label>
                  <input
                    id="espaco-capacidade"
                    type="number"
                    min="1"
                    required
                    value={spaceCapacidadeMax}
                    onChange={(e) => setSpaceCapacidadeMax(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
                  />
                </div>
                <div>
                  <label htmlFor="espaco-horario" className="block text-xs font-semibold text-slate-700">Horário Permitido</label>
                  <input
                    id="espaco-horario"
                    type="text"
                    required
                    placeholder="09:00 às 22:00"
                    value={spaceHorario}
                    onChange={(e) => setSpaceHorario(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
                  />
                </div>
                <div>
                  <label htmlFor="espaco-taxa" className="block text-xs font-semibold text-slate-700">Taxa de Limpeza (R$)</label>
                  <input
                    id="espaco-taxa"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={spaceTaxaLimpeza}
                    onChange={(e) => setSpaceTaxaLimpeza(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="espaco-imagem" className="block text-xs font-semibold text-slate-700">Link Externo da Imagem / Foto</label>
                <input
                  id="espaco-imagem"
                  type="url"
                  placeholder="https://exemplo.com/foto-do-espaco.jpg"
                  value={spaceImagemUrl}
                  onChange={(e) => setSpaceImagemUrl(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
                />
                <span className="text-[12px] text-slate-500">
                  Insira o link direto de uma imagem hospedada externamente (Google Drive, Unsplash, etc.)
                </span>
              </div>

              <div>
                <label htmlFor="espaco-regras" className="block text-xs font-semibold text-slate-700">Regras de Utilização (uma por linha)</label>
                <textarea
                  id="espaco-regras"
                  rows={3}
                  placeholder="Ex: Proibido som alto após as 22h00&#10;Entregar as chaves limpas no dia seguinte"
                  value={spaceRegras}
                  onChange={(e) => setSpaceRegras(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20 font-mono"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={spaceAtivo}
                  onChange={(e) => setSpaceAtivo(e.target.checked)}
                  className="rounded border-slate-300 text-[#0B2545] focus:ring-[#00A8E8]"
                />
                <span className="text-xs font-semibold text-slate-700">
                  Espaço disponível para reservas (desmarque se estiver em manutenção)
                </span>
              </label>

              <div className="mt-5 flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowSpaceModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#0B2545] px-4 py-2 text-xs font-semibold text-white hover:bg-[#134074]"
                >
                  {editingSpaceId ? 'Salvar Alterações' : 'Cadastrar Espaço'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

