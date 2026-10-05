'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { PrintReportHeader } from '@/components/reports/PrintReportHeader';
import { useDialog } from '@/components/ui/DialogProvider';
import { Badge } from '@/components/ui/Badge';
import { useApp } from '@/context/AppContext';
import { ReservationStatus, CommonSpace } from '@/types';
import { isAdmin, isProvisorio } from '@/lib/roles';
import { AguardandoValidacao } from '@/components/autocadastro/AguardandoValidacao';
import { useEscapeToClose } from '@/lib/useEscapeToClose';
import { useModalFocus } from '@/lib/useModalFocus';
import { ReservasCalendario } from '@/components/reservas/ReservasCalendario';
import { dataLonga, hojeBrasilia, somarDias } from '@/lib/datasReservas';
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
  Eye,
  List,
  Lock
} from 'lucide-react';
import { formatarData, formatarIntervalo, formatarMoeda, pluralizar } from '@/lib/formatadores';

export default function ReservasPage() {
  return (
    <AppShell>
      <ReservasContent />
    </AppShell>
  );
}

type Visao = 'lista' | 'calendario';
const CHAVE_VISAO = 'reservas-visao';
/** Marcador gravado pelo banco (0034) quando o espaço não exige aprovação. */
const APROVACAO_AUTOMATICA = 'Aprovação automática';

// Lembra a visão escolhida neste aparelho. localStorage pode faltar (janela anônima, dados
// bloqueados): sem ele a tela só volta ao padrão do perfil.
function lerVisaoSalva(): Visao | null {
  try {
    const v = window.localStorage.getItem(CHAVE_VISAO);
    return v === 'lista' || v === 'calendario' ? v : null;
  } catch {
    return null;
  }
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
    buscarDisponibilidade,
    judgeReservation 
  } = useApp();
  const { confirm, askReason } = useDialog();
  const [reservaFormError, setReservaFormError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [selectedSpaceId, setSelectedSpaceId] = useState(spaces[0]?.id || '');
  const [dataReserva, setDataReserva] = useState('');
  const [horarioInicio, setHorarioInicio] = useState('12:00');
  const [horarioFim, setHorarioFim] = useState('18:00');
  const [convidados, setConvidados] = useState(15);
  const [termoAceito, setTermoAceito] = useState(false);
  const [reservaMoradorNome, setReservaMoradorNome] = useState('');
  const [reservaBloco, setReservaBloco] = useState('A');
  const [reservaUnidade, setReservaUnidade] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  // Visão (Lista ou Calendário), dia aberto no modal e trava contra duplo clique no envio.
  const [visaoEscolhida, setVisaoEscolhida] = useState<Visao | null>(() => (typeof window === 'undefined' ? null : lerVisaoSalva()));
  const [dataFixa, setDataFixa] = useState(false);
  const [enviando, setEnviando] = useState(false);
  // Muda quando algo foi criado ou decidido: calendário e modal consultam a disponibilidade de novo.
  const [recarregarKey, setRecarregarKey] = useState(0);
  const [disp, setDisp] = useState<{ dia: string; ocupados: Set<string> | null } | null>(null);
  const buscarRef = useRef(buscarDisponibilidade);
  useEffect(() => { buscarRef.current = buscarDisponibilidade; });

  // Estados para Gestão de Espaços (Síndico)
  const [showSpaceModal, setShowSpaceModal] = useState(false);
  const [editingSpaceId, setEditingSpaceId] = useState<string | null>(null);
  const [spaceNome, setSpaceNome] = useState('');
  const [spaceDescricao, setSpaceDescricao] = useState('');
  const [spaceCapacidadeMax, setSpaceCapacidadeMax] = useState(20);
  const [spaceHorario, setSpaceHorario] = useState('');
  const [spaceTaxaLimpeza, setSpaceTaxaLimpeza] = useState(0);
  const [spaceRegras, setSpaceRegras] = useState('');
  const [spaceImagemUrl, setSpaceImagemUrl] = useState('');
  const [spaceAtivo, setSpaceAtivo] = useState(true);
  const [spaceExigeAprovacao, setSpaceExigeAprovacao] = useState(true);

  const isSindico = isAdmin(currentUser?.role);
  // Equipe sem unidade própria (Síndico/ADM/Portaria) precisa informar de qual
  // morador é a reserva ao registrar em nome de alguém (ex: pedido por telefone).
  const isStaff = currentUser?.role !== 'MORADOR';

  // Esc fecha o modal da reserva, a não ser que um diálogo por cima dele (ex.: justificativa da recusa) esteja aberto.
  const fecharModalReserva = () => {
    const abertos = Array.from(document.querySelectorAll<HTMLElement>('[aria-modal="true"]')).filter((m) => m.getClientRects().length > 0);
    const topo = abertos[abertos.length - 1];
    if (topo && topo.id !== 'reserva-dialog') return;
    setShowModal(false);
  };
  useEscapeToClose(showModal, fecharModalReserva);
  useModalFocus(showModal);
  useEscapeToClose(showSpaceModal, () => setShowSpaceModal(false));
  useModalFocus(showSpaceModal);

  // `spaces` carrega de forma assíncrona do Supabase — se o componente monta
  // antes disso, selectedSpaceId fica preso em '' (useState inicial rodou
  // com spaces=[]). O <select> ainda mostra a primeira opção como marcada
  // (comportamento padrão do navegador quando o value não bate com nenhuma
  // option), então a tela parece ter um espaço selecionado, mas o estado
  // real fica vazio até o usuário trocar manualmente a seleção — e o envio
  // falha com "Espaço comum não encontrado". Resincroniza sempre que spaces
  // mudar e o id atual não existir mais na lista.
  useEffect(() => {
    if (spaces.length > 0 && !spaces.some((s) => s.id === selectedSpaceId)) {
      setSelectedSpaceId(spaces[0].id);
    }
  }, [spaces, selectedSpaceId]);

  const hoje = hojeBrasilia();
  const dataValida = !!dataReserva && dataReserva >= hoje && dataReserva <= somarDias(hoje, 365);
  useEffect(() => {
    if (!showModal || !dataValida) return;
    let cancelado = false;
    buscarRef.current(dataReserva, dataReserva).then((linhas) => {
      if (!cancelado) setDisp({ dia: dataReserva, ocupados: linhas ? new Set(linhas.map((l) => l.espacoId)) : null });
    });
    return () => { cancelado = true; };
  }, [showModal, dataValida, dataReserva, recarregarKey]);

  const handleOpenNewSpace = () => {
    // Campos de texto começam vazios (o "Ex: ..." fica só no placeholder) —
    // um valor de exemplo como state inicial engana quem digita por cima sem
    // apagar antes, concatenando o texto digitado com o exemplo em vez de
    // substituí-lo. handleSaveSpace ainda cai num horário/imagem padrão se o
    // campo ficar mesmo vazio no envio.
    setEditingSpaceId(null);
    setSpaceNome('');
    setSpaceDescricao('');
    setSpaceCapacidadeMax(20);
    setSpaceHorario('');
    setSpaceTaxaLimpeza(0);
    setSpaceRegras('');
    setSpaceImagemUrl('');
    setSpaceAtivo(true);
    setSpaceExigeAprovacao(true);
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
    setSpaceExigeAprovacao(s.exigeAprovacao !== false);
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
        exigeAprovacao: spaceExigeAprovacao,
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
        exigeAprovacao: spaceExigeAprovacao,
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
    PENDENTE: { label: 'Aguardando aprovação', bg: 'bg-pendente-100', text: 'text-pendente-800' },
    APROVADA: { label: 'Aprovada', bg: 'bg-emerald-100', text: 'text-emerald-800' },
    RECUSADA: { label: 'Recusada', bg: 'bg-red-100', text: 'text-red-800' },
    CANCELADA: { label: 'Cancelada', bg: 'bg-slate-100', text: 'text-slate-700' },
  };

  // ── Modal da reserva: situação de cada espaço no dia escolhido ──
  const ocupadosDia = disp?.dia === dataReserva ? disp.ocupados : null;
  const verificandoDia = dataValida && disp?.dia !== dataReserva;
  type Situacao = 'LIVRE' | 'OCUPADO' | 'MANUTENCAO' | 'VERIFICANDO' | 'SEM_INFORMACAO';
  const situacaoDe = (s: CommonSpace): Situacao => {
    if (s.ativo === false) return 'MANUTENCAO';
    const ocupadoLocal = !!dataReserva && reservations.some(
      (r) => r.espacoId === s.id && r.data === dataReserva && (r.status === 'PENDENTE' || r.status === 'APROVADA')
    );
    if (ocupadoLocal || ocupadosDia?.has(s.id)) return 'OCUPADO';
    if (verificandoDia) return 'VERIFICANDO';
    return ocupadosDia ? 'LIVRE' : 'SEM_INFORMACAO';
  };
  const escolhivel = (s: CommonSpace) => {
    const sit = situacaoDe(s);
    return sit !== 'OCUPADO' && sit !== 'MANUTENCAO';
  };
  // O espaço marcado nunca é um que está ocupado ou em manutenção: se o escolhido deixou de
  // servir (ex.: alguém acabou de pegar o dia), vale o primeiro livre.
  const espacoEscolhido = spaces.find((s) => s.id === selectedSpaceId && escolhivel(s)) ?? spaces.find(escolhivel) ?? null;
  const reservasDoDia = dataReserva
    ? reservations.filter((r) => r.data === dataReserva && (r.status === 'PENDENTE' || r.status === 'APROVADA'))
    : [];

  const abrirModalReserva = (opcoes: { dia?: string; espacoId?: string }) => {
    setFeedbackMsg(null);
    setReservaFormError(null);
    setDataReserva(opcoes.dia ?? '');
    setDataFixa(!!opcoes.dia);
    if (opcoes.espacoId) setSelectedSpaceId(opcoes.espacoId);
    setShowModal(true);
  };

  const alternarVisao = (v: Visao) => {
    setVisaoEscolhida(v);
    try { window.localStorage.setItem(CHAVE_VISAO, v); } catch { /* sem armazenamento: só não lembra */ }
  };

  // Decidir (aprovar/recusar) pode liberar o dia: o calendário consulta de novo.
  const decidir = async (id: string, aprovado: boolean, motivo?: string) => {
    await judgeReservation(id, aprovado, motivo);
    setRecarregarKey((k) => k + 1);
  };
  const recusar = async (r: { id: string; espacoNome: string; data: string; unidade: string; bloco: string }) => {
    const motivo = await askReason({
      title: 'Recusar reserva',
      message: `${r.espacoNome} em ${formatarData(r.data)}, Apto ${r.unidade}-${r.bloco}.`,
      label: 'Justificativa da recusa',
      confirmLabel: 'Recusar reserva',
    });
    if (motivo) await decidir(r.id, false, motivo);
  };

  const handleCreateReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (enviando) return; // trava contra duplo clique
    setReservaFormError(null);
    if (!termoAceito) {
      setReservaFormError('É obrigatório aceitar o regulamento e normas de uso do espaço.');
      return;
    }
    if (!dataReserva) {
      setReservaFormError('Escolha a data da reserva.');
      return;
    }
    if (dataReserva < hoje) {
      setReservaFormError('Esse dia já passou. Escolha uma data a partir de hoje.');
      return;
    }
    if (!espacoEscolhido) {
      setReservaFormError('Não há espaço livre neste dia. Escolha outro dia.');
      return;
    }
    if (horarioFim <= horarioInicio) {
      setReservaFormError('O horário de término precisa ser depois do início.');
      return;
    }
    if (Number(convidados) > espacoEscolhido.capacidadeMax) {
      setReservaFormError(`Este espaço comporta até ${espacoEscolhido.capacidadeMax} convidados.`);
      return;
    }
    if (isStaff && !reservaMoradorNome.trim()) {
      setReservaFormError('Informe o nome do morador para quem a reserva está sendo registrada.');
      return;
    }

    setEnviando(true);
    try {
      const res = await requestReservation({
        espacoId: espacoEscolhido.id,
        data: dataReserva,
        horarioInicio,
        horarioFim,
        convidadosEstimados: Number(convidados),
        ...(isStaff ? { moradorNome: reservaMoradorNome.trim(), bloco: reservaBloco, unidade: reservaUnidade.trim() } : {}),
      });
      // Qualquer resposta (sucesso ou conflito) muda a disponibilidade: o calendário consulta de novo.
      setRecarregarKey((k) => k + 1);

      if (res.success) {
        setFeedbackMsg({ type: 'success', text: res.message });
        setShowModal(false);
        setTermoAceito(false);
        setReservaMoradorNome('');
        setReservaUnidade('');
      } else {
        // Erro fica dentro do modal, com os dados do formulário preservados.
        setReservaFormError(res.message);
      }
    } finally {
      setEnviando(false);
    }
  };

  // Padrão: Calendário para o morador (quer ver dia livre), Lista para a equipe (quer decidir pedidos).
  const visao: Visao = spaces.length === 0 ? 'lista' : (visaoEscolhida ?? (isStaff ? 'lista' : 'calendario'));

  if (isProvisorio(currentUser)) return <AguardandoValidacao recurso="As reservas" />;

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
            <CalendarDays className="h-6 w-6 text-accent" />
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
              Reserva de Espaços Comuns
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-600">
            Veja os dias livres e reserve. Cada espaço informa se o pedido precisa da aprovação da equipe.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:gap-2">
          {isSindico && (
            <button
              onClick={handleOpenNewSpace}
              className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-primary shadow-xs transition hover:bg-slate-50 sm:min-h-0"
            >
              <Plus className="h-4 w-4 text-accent" />
              <span>Cadastrar Espaço</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => window.print()}
            className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 sm:min-h-0"
          >
            <Printer className="h-4 w-4 text-slate-500" />
            <span>Imprimir Agenda</span>
          </button>

          {/* O morador pede a reserva pelo botão do cartão de cada espaço ("Agendar Este Espaço"),
              que abre o mesmo formulário já com o espaço escolhido; repetir a chamada aqui só
              confundia. A equipe mantém este botão, que abre o formulário para registrar em nome de um morador. */}
          {isStaff && (
            <button
              onClick={() => abrirModalReserva({})}
              className="order-first flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-primary-hover sm:order-last sm:min-h-0 sm:w-auto"
            >
              <Plus className="h-4 w-4 text-accent" />
              <span>Solicitar Reserva</span>
            </button>
          )}
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
          <button onClick={() => setFeedbackMsg(null)} aria-label="Fechar mensagem" className="-m-3.5 flex size-11 shrink-0 items-center justify-center text-slate-500 hover:text-slate-600">
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
                isAtivo ? 'border-slate-200' : 'border-pendente-200 bg-pendente-50/20'
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
                    <div className="absolute top-2 left-2 rounded-lg bg-pendente-700 px-2.5 py-1 text-[12px] font-bold text-white shadow-md">
                      Em Manutenção / Inativo
                    </div>
                  )}
                  {isSindico && (
                    <div className="absolute top-2 right-2 flex items-center gap-2 no-print sm:gap-1.5">
                      <button
                        onClick={() => handleOpenEditSpace(spc)}
                        title="Editar Espaço"
                        aria-label={`Editar espaço ${spc.nome}`}
                        className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-white/90 text-slate-700 shadow-md backdrop-blur-md hover:bg-white hover:text-primary sm:size-auto sm:p-1.5"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleToggleSpaceAtivo(spc)}
                        title={isAtivo ? 'Desativar Espaço' : 'Ativar Espaço'}
                        aria-label={`${isAtivo ? 'Desativar' : 'Ativar'} espaço ${spc.nome}`}
                        className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-white/90 text-slate-700 shadow-md backdrop-blur-md hover:bg-white hover:text-pendente-600 sm:size-auto sm:p-1.5"
                      >
                        {isAtivo ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5 text-emerald-600" />}
                      </button>
                      <button
                        onClick={() => handleDeleteSpace(spc.id, spc.nome)}
                        title="Excluir Espaço"
                        aria-label={`Excluir espaço ${spc.nome}`}
                        className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-white/90 text-slate-700 shadow-md backdrop-blur-md hover:bg-white hover:text-red-600 sm:size-auto sm:p-1.5"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="text-base font-bold text-slate-900">{spc.nome}</h3>
                    {/* Visível a todos: o morador precisa saber se o pedido depende da equipe. */}
                    {spc.exigeAprovacao !== false ? (
                      <Badge icon={<Clock className="h-3 w-3" aria-hidden="true" />} className="bg-pendente-100 text-pendente-800">Exige aprovação</Badge>
                    ) : (
                      <Badge icon={<CheckCircle2 className="h-3 w-3" aria-hidden="true" />} className="bg-emerald-100 text-emerald-800">Confirmação automática</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed">{spc.descricao}</p>

                  <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-3 text-xs text-slate-600">
                    <div className="flex items-center justify-between">
                      <span>Horário permitido:</span>
                      <strong className="text-slate-900">{spc.horarioFuncionamento}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Taxa de higienização:</span>
                      <strong className="text-primary">
                        {spc.taxaLimpeza > 0 ? formatarMoeda(spc.taxaLimpeza) : 'Isento'}
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
                  onClick={() => abrirModalReserva({ espacoId: spc.id })}
                  className={`min-h-11 w-full rounded-xl py-2.5 text-xs font-semibold transition sm:min-h-0 ${
                    isAtivo
                      ? 'bg-primary text-white shadow-xs hover:bg-primary-hover'
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

      {/* Barra de visão: Lista ou Calendário (só a Lista vai para a impressão) */}
      {spaces.length > 0 && (
        <div role="group" aria-label="Visão das reservas" className="no-print flex gap-2">
          {([['lista', 'Lista', List], ['calendario', 'Calendário', CalendarDays]] as const).map(([chave, rotulo, Icone]) => {
            const ativo = visao === chave;
            return (
              <button
                key={chave}
                type="button"
                aria-pressed={ativo}
                onClick={() => alternarVisao(chave)}
                className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border px-4 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong sm:flex-none ${
                  ativo ? 'border-primary bg-primary text-white shadow-xs' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Icone className="h-4 w-4" aria-hidden="true" />
                <span>{rotulo}</span>
              </button>
            );
          })}
        </div>
      )}

      {visao === 'calendario' && (
        <ReservasCalendario
          spaces={spaces}
          reservations={reservations}
          ehEquipe={isStaff}
          buscar={buscarDisponibilidade}
          recarregarKey={recarregarKey}
          diaSelecionado={showModal && dataFixa ? dataReserva : null}
          onSelecionarDia={(dia) => abrirModalReserva({ dia })}
        />
      )}

      {/* Tabela de Solicitações e Agenda de Reservas. Com o calendário na tela ela continua no
          documento, escondida, para a "Imprimir Agenda" sair sempre com a tabela. */}
      <div className={visao === 'lista' ? 'space-y-4' : 'hidden space-y-4 print:block'}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">
            {isStaff ? 'Cronograma e Histórico de Solicitações' : 'Minhas solicitações'}
          </h2>
          <span className="text-xs text-slate-600">
            Total: {pluralizar(reservations.length, 'solicitação', 'solicitações')}
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="stack-mobile w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50/75 text-[12px] font-bold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3.5">Espaço Comum</th>
                  <th className="px-4 py-3.5">Data & Turno</th>
                  <th className="px-4 py-3.5">Unidade / Morador</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Avaliação / Parecer</th>
                  {isAdmin(currentUser?.role) && (
                    <th className="px-4 py-3.5 text-right no-print">Decisão</th>
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
                        <td data-label="Espaço Comum" className="px-4 py-3.5 font-bold text-slate-900">
                          {r.espacoNome}
                        </td>
                        <td data-label="Data & Turno" className="px-4 py-3.5 md:whitespace-nowrap">
                          <div className="font-semibold text-slate-900">{formatarData(r.data)}</div>
                          <div className="text-[12px] text-slate-500">
                            {formatarIntervalo(r.horarioInicio, r.horarioFim)}
                          </div>
                        </td>
                        <td data-label="Unidade / Morador" className="px-4 py-3.5">
                          <div className="font-bold text-primary md:whitespace-nowrap">
                            Apto {r.unidade} - Bloco {r.bloco}
                          </div>
                          <div className="text-[12px] text-slate-500">{r.moradorNome}</div>
                        </td>
                        <td data-label="Status" className="px-4 py-3.5 md:whitespace-nowrap">
                          <Badge className={`${st.bg} ${st.text}`}>{st.label}</Badge>
                        </td>
                        <td data-label="Avaliação / Parecer" className={`px-4 py-3.5 text-[12px] text-slate-600 ${r.status === 'PENDENTE' ? 'oculta-mobile' : ''}`}>
                          {r.status === 'APROVADA' && r.avaliadoPor === APROVACAO_AUTOMATICA && (
                            <span className="text-emerald-700 font-semibold">
                              Confirmada automaticamente em {formatarData(r.dataAvaliacao || r.dataSolicitacao)}
                            </span>
                          )}
                          {r.status === 'APROVADA' && r.avaliadoPor !== APROVACAO_AUTOMATICA && (
                            <span className="text-emerald-700 font-semibold">
                              Aprovado por {(r.avaliadoPor || 'Administração').replace(/\s*\([A-Z]+\)$/, '')} em {formatarData(r.dataAvaliacao || r.dataSolicitacao)}
                            </span>
                          )}
                          {r.status === 'RECUSADA' && (
                            <span className="text-red-700 font-medium">
                              Motivo: {r.motivoRecusa}
                            </span>
                          )}
                          {/* Pendente ainda não tem parecer; "Solicitado em" não é parecer. */}
                          {r.status === 'PENDENTE' && <span className="text-slate-500">—</span>}
                        </td>
                        {isAdmin(currentUser?.role) && (
                          <td data-label="Aprovação do Síndico" className={`px-4 py-3.5 text-right no-print md:whitespace-nowrap ${r.status === 'PENDENTE' ? 'max-md:flex-col' : 'oculta-mobile'}`}>
                            {r.status === 'PENDENTE' ? (
                              <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center md:justify-end md:gap-1.5">
                                <button
                                  onClick={() => decidir(r.id, true)}
                                  className="flex min-h-11 w-full items-center justify-center gap-1 whitespace-nowrap rounded-lg bg-emerald-700 px-2.5 py-1 text-xs font-bold md:min-h-0 md:w-auto text-white transition hover:bg-emerald-800"
                                  title="Aprovar reserva"
                                >
                                  <Check className="h-3 w-3" />
                                  <span>Aprovar</span>
                                </button>
                                <button
                                  onClick={() => recusar(r)}
                                  className="flex min-h-11 w-full items-center justify-center gap-1 whitespace-nowrap rounded-lg border border-red-300 bg-white px-2.5 py-1 text-xs font-bold md:min-h-0 md:w-auto text-red-700 transition hover:bg-red-50"
                                  title="Recusar reserva"
                                >
                                  <X className="h-3 w-3" />
                                  <span>Recusar</span>
                                </button>
                              </div>
                            ) : null}
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

      {/* Modal da reserva: abre pelo dia do calendário (data fixa) ou pelos botões (data escolhida no formulário) */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
            onClick={() => setShowModal(false)}
          />
          <div
            id="reserva-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reserva-modal-title"
            className="relative flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 pb-3 pt-5 sm:px-6 sm:pt-6">
              <div>
                <h3 id="reserva-modal-title" className="text-base font-bold text-slate-900">Reservar espaço</h3>
                {dataFixa && dataReserva && (
                  <p className="mt-0.5 text-sm font-semibold text-primary">{dataLonga(dataReserva)}</p>
                )}
                <p className="mt-0.5 text-xs text-slate-600">Escolha o espaço e o horário.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                aria-label="Fechar"
                className="-mr-2 -mt-1 flex size-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateReservation} className="flex min-h-0 flex-1 flex-col">
              <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 sm:px-6">
                {/* Reservas do dia: a equipe vê todas; o morador, só a da própria unidade */}
                {reservasDoDia.length > 0 && (
                  <section aria-label={isStaff ? 'Neste dia' : 'Sua reserva neste dia'} className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                    <h4 className="text-[12px] font-bold uppercase tracking-wider text-slate-600">{isStaff ? 'Neste dia' : 'Sua reserva'}</h4>
                    <ul className="mt-2 space-y-2">
                      {reservasDoDia.map((r) => {
                        const st = statusMap[r.status];
                        return (
                          <li key={r.id} className="rounded-lg border border-slate-200 bg-white p-2.5 text-xs">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-bold text-slate-900">{r.espacoNome}</span>
                              <Badge className={`${st.bg} ${st.text}`}>{st.label}</Badge>
                            </div>
                            <div className="mt-0.5 text-[12px] text-slate-600">{formatarIntervalo(r.horarioInicio, r.horarioFim)}</div>
                            {isStaff && (
                              <div className="mt-0.5 text-[12px] text-slate-600">Apto {r.unidade} – Bloco {r.bloco} · {r.moradorNome}</div>
                            )}
                            {isSindico && r.status === 'PENDENTE' && (
                              <div className="mt-2 flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => decidir(r.id, true)}
                                  className="flex min-h-11 flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-700 px-2.5 text-xs font-bold text-white transition hover:bg-emerald-800"
                                >
                                  <Check className="h-3 w-3" />
                                  <span>Aprovar</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => recusar(r)}
                                  className="flex min-h-11 flex-1 items-center justify-center gap-1 rounded-lg border border-red-300 bg-white px-2.5 text-xs font-bold text-red-700 transition hover:bg-red-50"
                                >
                                  <X className="h-3 w-3" />
                                  <span>Recusar</span>
                                </button>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                )}

                {isStaff && (
                  <div className="rounded-xl border border-accent-200 bg-accent-50 p-3.5 space-y-3">
                    <p className="text-[12px] font-bold text-accent-900">
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
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-strong/30 min-h-11 sm:min-h-0"
                        />
                      </div>
                      <div>
                        <label htmlFor="reserva-bloco" className="block text-xs font-semibold text-slate-700">Bloco</label>
                        <select
                          id="reserva-bloco"
                          value={reservaBloco}
                          onChange={(e) => setReservaBloco(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-strong/30 min-h-11 sm:min-h-0"
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
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-strong/30 min-h-11 sm:min-h-0"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Aberto pelos botões (sem dia escolhido no calendário): a data é um campo */}
                {!dataFixa && (
                  <div>
                    <label htmlFor="reserva-data" className="block text-xs font-semibold text-slate-700">Data desejada</label>
                    <input
                      id="reserva-data"
                      type="date"
                      required
                      min={hoje}
                      value={dataReserva}
                      onChange={(e) => setDataReserva(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-strong/30 min-h-11 sm:min-h-0"
                    />
                  </div>
                )}

                {/* Espaço: cartões de escolha única (rádio), com a situação no dia */}
                <div role="radiogroup" aria-labelledby="reserva-espaco-rotulo">
                  <p id="reserva-espaco-rotulo" className="block text-xs font-semibold text-slate-700">Espaço</p>
                  <div className="mt-1.5 space-y-2">
                    {spaces.map((s) => {
                      const sit = situacaoDe(s);
                      const livre = sit !== 'OCUPADO' && sit !== 'MANUTENCAO';
                      const marcado = espacoEscolhido?.id === s.id;
                      return (
                        <label
                          key={s.id}
                          className={`relative flex min-h-11 items-center justify-between gap-3 rounded-xl border p-3 text-xs transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-strong ${
                            !livre ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-500'
                              : marcado ? 'cursor-pointer border-primary bg-accent-50 ring-1 ring-primary'
                              : 'cursor-pointer border-slate-200 bg-white hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="reserva-espaco"
                            className="sr-only"
                            value={s.id}
                            disabled={!livre}
                            checked={marcado}
                            onChange={() => setSelectedSpaceId(s.id)}
                          />
                          <span>
                            <span className={`block font-bold ${livre ? 'text-slate-900' : 'text-slate-600'}`}>{s.nome}</span>
                            <span className="block text-[12px] text-slate-600">Até {s.capacidadeMax} pessoas</span>
                          </span>
                          {sit === 'LIVRE' && (
                            <Badge icon={<Check className="h-3 w-3" aria-hidden="true" />} className="bg-emerald-100 text-emerald-800">Livre</Badge>
                          )}
                          {sit === 'OCUPADO' && (
                            <Badge icon={<Lock className="h-3 w-3" aria-hidden="true" />} className="bg-slate-100 text-slate-700">Ocupado neste dia</Badge>
                          )}
                          {sit === 'MANUTENCAO' && (
                            <Badge icon={<AlertTriangle className="h-3 w-3" aria-hidden="true" />} className="bg-pendente-100 text-pendente-800">Em manutenção</Badge>
                          )}
                          {sit === 'VERIFICANDO' && <span className="text-[12px] text-slate-500">Verificando…</span>}
                        </label>
                      );
                    })}
                  </div>
                  {dataValida && !verificandoDia && !espacoEscolhido && (
                    <p className="mt-2 text-xs font-semibold text-slate-700">Nenhum espaço livre neste dia. Escolha outro dia.</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="reserva-inicio" className="block text-xs font-semibold text-slate-700">Início</label>
                    <input
                      id="reserva-inicio"
                      type="time"
                      required
                      value={horarioInicio}
                      onChange={(e) => setHorarioInicio(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-strong/30 min-h-11 sm:min-h-0"
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
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-strong/30 min-h-11 sm:min-h-0"
                    />
                  </div>
                  {espacoEscolhido && (
                    <p className="col-span-2 -mt-1 text-[12px] text-slate-600">Horário permitido do espaço: {espacoEscolhido.horarioFuncionamento}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="reserva-convidados" className="block text-xs font-semibold text-slate-700">
                    Estimativa de convidados{espacoEscolhido ? ` (máximo ${espacoEscolhido.capacidadeMax})` : ''}
                  </label>
                  <input
                    id="reserva-convidados"
                    type="number"
                    min="1"
                    max={espacoEscolhido?.capacidadeMax}
                    required
                    value={convidados}
                    onChange={(e) => setConvidados(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-strong/30 min-h-11 sm:min-h-0"
                  />
                </div>

                {espacoEscolhido && (
                  <p className="text-xs text-slate-700">
                    Taxa de limpeza: <strong className="text-primary">{espacoEscolhido.taxaLimpeza > 0 ? formatarMoeda(espacoEscolhido.taxaLimpeza) : 'Isento'}</strong>
                  </p>
                )}

                {/* O aviso muda com a regra do espaço escolhido (a regra de verdade é do banco) */}
                {espacoEscolhido && (
                  <div aria-live="polite">
                    {espacoEscolhido.exigeAprovacao !== false ? (
                      <div className="rounded-xl border border-pendente-200 bg-pendente-50 p-3.5 text-xs text-pendente-900">
                        <div className="flex items-center gap-1.5 font-bold">
                          <Clock className="h-4 w-4 text-pendente-700" aria-hidden="true" />
                          <span>Precisa de aprovação</span>
                        </div>
                        <p className="mt-1 text-[12px] text-pendente-800">Seu pedido vai para a equipe e só vale depois da aprovação.</p>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-900">
                        <div className="flex items-center gap-1.5 font-bold">
                          <CheckCircle2 className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                          <span>Confirmação imediata</span>
                        </div>
                        <p className="mt-1 text-[12px] text-emerald-800">Este espaço confirma na hora: sua reserva fica confirmada ao enviar.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Termo de Responsabilidade */}
                <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 p-3 bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={termoAceito}
                    onChange={(e) => setTermoAceito(e.target.checked)}
                    className="mt-0.5 size-5 shrink-0 rounded border-slate-300 text-primary focus:ring-accent-strong"
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
              </div>

              {/* Botões fixos no rodapé: no celular o formulário rola, os botões não */}
              <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 px-5 py-3 sm:px-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 min-h-11"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={enviando}
                  className="min-h-11 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {enviando ? 'Enviando…' : espacoEscolhido && espacoEscolhido.exigeAprovacao === false ? 'Reservar agora' : 'Solicitar reserva'}
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
                <Building2 className="h-5 w-5 text-accent" />
                <h3 id="espaco-modal-title" className="text-base font-bold text-slate-900">
                  {editingSpaceId ? 'Editar Espaço Comum' : 'Cadastrar Novo Espaço Comum'}
                </h3>
              </div>
              <button
                onClick={() => setShowSpaceModal(false)}
                aria-label="Fechar"
                className="flex size-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 sm:size-auto sm:p-1"
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
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-strong/30 min-h-11 sm:min-h-0"
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
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-strong/30 min-h-11 sm:min-h-0"
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
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-strong/30 min-h-11 sm:min-h-0"
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
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-strong/30 min-h-11 sm:min-h-0"
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
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-strong/30 min-h-11 sm:min-h-0"
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
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-strong/30 min-h-11 sm:min-h-0"
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
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-strong/30 font-mono min-h-11 sm:min-h-0"
                />
              </div>

              {/* Regras de reserva: decide se o pedido nasce aguardando a equipe ou já confirmado (o banco aplica) */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                <h4 className="text-[12px] font-bold uppercase tracking-wider text-slate-600">Regras de reserva</h4>
                <label className="mt-1 flex min-h-11 cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={spaceExigeAprovacao}
                    onChange={(e) => setSpaceExigeAprovacao(e.target.checked)}
                    aria-describedby="espaco-aprovacao-ajuda"
                    className="size-5 shrink-0 rounded border-slate-300 text-primary focus:ring-accent-strong"
                  />
                  <span className="text-xs font-semibold text-slate-700">Exige aprovação da equipe</span>
                </label>
                <p id="espaco-aprovacao-ajuda" className="text-[12px] text-slate-600">
                  Marcado: o pedido fica &quot;Aguardando aprovação&quot; até o Síndico decidir. Desmarcado: a reserva já nasce confirmada.
                </p>
                {!spaceExigeAprovacao && (
                  <div className="mt-3 flex items-start gap-2 rounded-xl border border-pendente-200 bg-pendente-50 p-3 text-[12px] text-pendente-900">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-pendente-700" aria-hidden="true" />
                    <span>Atenção: novos pedidos serão confirmados sem passar pela equipe. Reservas que já estão aguardando continuam aguardando.</span>
                  </div>
                )}
              </div>

              <label className="flex min-h-11 items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={spaceAtivo}
                  onChange={(e) => setSpaceAtivo(e.target.checked)}
                  className="size-5 shrink-0 rounded border-slate-300 text-primary focus:ring-accent-strong"
                />
                <span className="text-xs font-semibold text-slate-700">
                  Espaço disponível para reservas (desmarque se estiver em manutenção)
                </span>
              </label>

              <div className="mt-5 flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowSpaceModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 min-h-11 sm:min-h-0"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-hover min-h-11 sm:min-h-0"
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

