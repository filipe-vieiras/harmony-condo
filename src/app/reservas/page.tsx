'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { PrintReportHeader } from '@/components/reports/PrintReportHeader';
import { useDialog } from '@/components/ui/DialogProvider';
import { Badge } from '@/components/ui/Badge';
import { useApp } from '@/context/AppContext';
import { ReservationStatus, CommonSpace } from '@/types';
import { isAdmin, isOperacao, isProvisorio } from '@/lib/roles';
import { AguardandoValidacao } from '@/components/autocadastro/AguardandoValidacao';
import { useEscapeToClose } from '@/lib/useEscapeToClose';
import { useModalFocus } from '@/lib/useModalFocus';
import { ReservasCalendario } from '@/components/reservas/ReservasCalendario';
import { CampoVeiculo } from '@/components/ui/CampoVeiculo';
import { Acordeao } from '@/components/reservas/Acordeao';
import { DetalhesEspaco } from '@/components/reservas/DetalhesEspaco';
import { EspacosCadastrados } from '@/components/reservas/EspacosCadastrados';
import { InterditarEspacoDialog, type ModoInterdicao } from '@/components/reservas/InterditarEspacoDialog';
import { ReservasFuturasEspaco } from '@/components/reservas/ReservasFuturasEspaco';
import { reservasFuturasDoEspaco, textoEmManutencao } from '@/lib/interdicao';
import { MenuMais } from '@/components/reservas/MenuMais';
import { PedidosAguardando } from '@/components/reservas/PedidosAguardando';
import { SeletorEspacos, type SeletorEspacosRef } from '@/components/reservas/SeletorEspacos';
import { calcularPercentual, ehPercentual, erroDoLimiteGratis, erroDoPercentual, lerPercentual, limparPercentualDigitado, previaDaFaixa, previaDoCalculo, regraDeValorMudou, regraDoEspaco, resumoCurtoDoValor, textoTotalPedido, textoValorPedido, valorDaReserva, valorInvalido, valorParaBanco, type RegraValor, type TipoValor } from '@/lib/valorEspaco';
import { dataLonga, hojeBrasilia, somarDias } from '@/lib/datasReservas';
import {
  CalendarDays,
  Plus,
  Check,
  X,
  Clock,
  AlertCircle,
  Printer,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Lock,
  Info,
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
    bloqueiosDoEspaco,
    reservations, 
    requestReservation, 
    buscarDisponibilidade,
    buscarValorReserva,
    buscarCotaMinima,
    judgeReservation,
    cancelReservation,
    interditarEspaco,
    interdicoes,
  } = useApp();
  const { confirm, askReason } = useDialog();
  const [reservaFormError, setReservaFormError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [selectedSpaceId, setSelectedSpaceId] = useState(spaces[0]?.id || '');
  const [dataReserva, setDataReserva] = useState('');
  const [horarioInicio, setHorarioInicio] = useState('12:00');
  const [horarioFim, setHorarioFim] = useState('18:00');
  // Texto do campo (não número): apagar para digitar outro valor não pode virar "0" no meio do caminho.
  const [convidados, setConvidados] = useState('15');
  const [tentouEnviar, setTentouEnviar] = useState(false);
  // Valor devolvido pelo banco para (espaço, pessoas); `chave` impede mostrar o valor de outra conta.
  const [previaValor, setPreviaValor] = useState<{ chave: string; valor: number | null | 'COTA_INDEFINIDA' } | null>(null);
  const buscarCotaRef = useRef(buscarCotaMinima);
  useEffect(() => { buscarCotaRef.current = buscarCotaMinima; });
  const buscarValorRef = useRef(buscarValorReserva);
  useEffect(() => { buscarValorRef.current = buscarValorReserva; });
  const [termoAceito, setTermoAceito] = useState(false);
  const [reservaMoradorNome, setReservaMoradorNome] = useState('');
  const [reservaBloco, setReservaBloco] = useState('A');
  const [reservaUnidade, setReservaUnidade] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  // Visão (Lista ou Calendário), dia aberto no modal e trava contra duplo clique no envio.
  const [visaoEscolhida, setVisaoEscolhida] = useState<Visao | null>(() => (typeof window === 'undefined' ? null : lerVisaoSalva()));
  const [dataFixa, setDataFixa] = useState(false);
  // Espaço do chip no momento em que o modal abriu pelo dia do calendário: o modal não pergunta o espaço.
  // null = modal sem espaço definido (equipe, por "Registrar reserva" ou com "Todos"): aparece o seletor.
  const [espacoFixoId, setEspacoFixoId] = useState<string | null>(null);
  const [regrasAbertas, setRegrasAbertas] = useState(false);
  // Chip escolhido (null = padrão: "Todos" para a equipe, o primeiro espaço ativo para o morador).
  const [chipId, setChipId] = useState<string | null>(null);
  const [detalhesAberto, setDetalhesAberto] = useState(false);
  const [espacosAberto, setEspacosAberto] = useState(false);
  const chipsRef = useRef<SeletorEspacosRef>(null);
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
  // Texto (não número): campo vazio = sem taxa, dito de forma explícita na tela.
  const [spaceTaxaLimpeza, setSpaceTaxaLimpeza] = useState('');
  const [spaceRegras, setSpaceRegras] = useState('');
  const [spaceImagemUrl, setSpaceImagemUrl] = useState('');
  const [spaceExigeAprovacao, setSpaceExigeAprovacao] = useState(true);
  // Valor de uso por faixa e bloqueios entre espaços (issue #81). Os valores digitados de cada opção
  // ficam guardados ao trocar de rádio, mas só os da opção marcada vão para o banco.
  const [spaceValorModo, setSpaceValorModo] = useState<RegraValor>('GRATIS');
  const [spaceFaixaAte, setSpaceFaixaAte] = useState('');
  const [spaceFaixaCentavos, setSpaceFaixaCentavos] = useState('');
  // Fase 2 (0048): valor fixo em R$ ou percentual da cota mínima do condomínio. Cada tipo guarda o que foi digitado.
  const [spaceValorTipo, setSpaceValorTipo] = useState<TipoValor>('FIXO');
  const [spacePercentual, setSpacePercentual] = useState('');
  // Cota mínima, lida só para a gestão e só com o formulário do espaço aberto (o morador nunca a recebe).
  const [cota, setCota] = useState<{ estado: 'carregando' | 'ok' | 'erro'; valor: number | null }>({ estado: 'carregando', valor: null });
  const [spaceBloqueios, setSpaceBloqueios] = useState<string[]>([]);
  // Regra de valor como estava salva (só na edição): serve para avisar que mudar vale só para novos pedidos.
  const [spaceFaixaSalva, setSpaceFaixaSalva] = useState<Pick<CommonSpace, 'faixaGratisAte' | 'faixaValor' | 'valorTipo' | 'faixaPercentual'> | null>(null);
  const [spaceBloqueiosOriginais, setSpaceBloqueiosOriginais] = useState<string[]>([]);
  const [tentouSalvarEspaco, setTentouSalvarEspaco] = useState(false);
  // Trava de duplo clique no salvar do espaço: o ref barra o 2º clique no mesmo tick (o state só vale no próximo render).
  const [salvandoEspaco, setSalvandoEspaco] = useState(false);
  const salvandoEspacoRef = useRef(false);
  // Seções do formulário do espaço: só "Dados do espaço" começa aberta.
  const [secoes, setSecoes] = useState({ dados: true, pedidos: false, bloqueios: false });
  const [espacoFormError, setEspacoFormError] = useState<string | null>(null);

  // Gestão (cadastra e edita espaço) x operação (gestão + Zelador: decide, cancela e interdita). O banco confere de novo.
  const isSindico = isAdmin(currentUser?.role);
  const podeDecidir = isOperacao(currentUser?.role);
  // Interdição aberta no diálogo e espaço em foco na lista "Reservas futuras do espaço" (vem também do link ?espaco=).
  const [interdicaoAlvo, setInterdicaoAlvo] = useState<{ espacoId: string; modo: ModoInterdicao } | null>(null);
  const [espacoFocoId, setEspacoFocoId] = useState<string | null>(() => (typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('espaco')));
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
  // Mesma regra do modal da reserva: o diálogo de confirmação por cima (ex.: excluir espaço) recebe o Esc primeiro.
  const fecharModalEspaco = () => {
    const abertos = Array.from(document.querySelectorAll<HTMLElement>('[aria-modal="true"]')).filter((m) => m.getClientRects().length > 0);
    const topo = abertos[abertos.length - 1];
    if (topo && topo.id !== 'espaco-modal') return;
    setShowSpaceModal(false);
  };
  useEscapeToClose(showSpaceModal, fecharModalEspaco);
  useModalFocus(showSpaceModal);

  // `spaces` carrega de forma assíncrona: o espaço do modal e o chip são sempre derivados da lista
  // atual (abaixo), então não existe estado "preso" em um id que ainda não chegou.
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

  // Cota para o formulário do espaço (só a gestão a lê; o banco nega aos demais). Relê ao voltar para a aba, porque a gestão
  // costuma cadastrar a cota em outra aba (Configurações) sem fechar o formulário.
  const carregarCota = useCallback(async () => {
    const r = await buscarCotaRef.current();
    setCota(r.ok ? { estado: 'ok', valor: r.cota.valor } : { estado: 'erro', valor: null });
  }, []);
  useEffect(() => {
    if (!showSpaceModal || !isSindico) return;
    void carregarCota();
    const aoVoltar = () => { if (document.visibilityState === 'visible') void carregarCota(); };
    document.addEventListener('visibilitychange', aoVoltar);
    window.addEventListener('focus', aoVoltar);
    return () => {
      document.removeEventListener('visibilitychange', aoVoltar);
      window.removeEventListener('focus', aoVoltar);
    };
  }, [showSpaceModal, isSindico, carregarCota]);

  const handleOpenNewSpace = () => {
    // Campos de texto começam vazios (o "Ex: ..." fica só no placeholder) —
    // um valor de exemplo como state inicial engana quem digita por cima sem
    // apagar antes, concatenando o texto digitado com o exemplo em vez de
    // substituí-lo. handleSaveSpace ainda cai num horário/imagem padrão se o
    // campo ficar mesmo vazio no envio.
    setEditingSpaceId(null);
    setCota({ estado: 'carregando', valor: null });
    setSpaceFaixaSalva(null);
    setSpaceNome('');
    setSpaceDescricao('');
    setSpaceCapacidadeMax(20);
    setSpaceHorario('');
    setSpaceTaxaLimpeza('');
    setSpaceRegras('');
    setSpaceImagemUrl('');
    setSpaceExigeAprovacao(true);
    setSpaceValorModo('GRATIS');
    setSpaceFaixaAte('');
    setSpaceFaixaCentavos('');
    setSpaceValorTipo('FIXO');
    setSpacePercentual('');
    setSpaceBloqueios([]);
    setSpaceBloqueiosOriginais([]);
    setTentouSalvarEspaco(false);
    setEspacoFormError(null);
    setSecoes({ dados: true, pedidos: false, bloqueios: false });
    setShowSpaceModal(true);
  };

  const handleOpenEditSpace = (s: CommonSpace) => {
    setEditingSpaceId(s.id);
    setCota({ estado: 'carregando', valor: null });
    setSpaceNome(s.nome);
    setSpaceDescricao(s.descricao);
    setSpaceCapacidadeMax(s.capacidadeMax);
    setSpaceHorario(s.horarioFuncionamento);
    setSpaceTaxaLimpeza(s.taxaLimpeza > 0 ? String(s.taxaLimpeza) : '');
    setSpaceRegras(s.regras.join('\n'));
    setSpaceImagemUrl(s.imagemUrl);
    setSpaceExigeAprovacao(s.exigeAprovacao !== false);
    // Limite 0 (o banco já cobra de todos) abre como "Paga em toda reserva"; o campo de limite fica vazio.
    const regra = regraDoEspaco(s);
    setSpaceValorModo(regra);
    setSpaceFaixaAte(regra === 'FAIXA' ? String(s.faixaGratisAte) : '');
    setSpaceFaixaCentavos(regra !== 'GRATIS' && !ehPercentual(s) ? String(Math.round((s.faixaValor ?? 0) * 100)) : '');
    setSpaceValorTipo(ehPercentual(s) ? 'PERCENTUAL' : 'FIXO');
    setSpacePercentual(ehPercentual(s) && s.faixaPercentual != null ? String(s.faixaPercentual).replace('.', ',') : '');
    setSpaceFaixaSalva({ faixaGratisAte: s.faixaGratisAte ?? null, faixaValor: s.faixaValor ?? null, valorTipo: s.valorTipo ?? 'FIXO', faixaPercentual: s.faixaPercentual ?? null });
    // O bloqueio vindo do outro lado aparece marcado do mesmo jeito: o par é um só.
    const atuais = bloqueiosDoEspaco(s.id);
    setSpaceBloqueios(atuais);
    setSpaceBloqueiosOriginais(atuais);
    setTentouSalvarEspaco(false);
    setEspacoFormError(null);
    setSecoes({ dados: true, pedidos: false, bloqueios: false });
    setShowSpaceModal(true);
  };

  // Validação da faixa (a regra de verdade é do banco: spaces_faixa_check, 0039).
  const capacidadeNum = Number(spaceCapacidadeMax);
  const faixaAteNum = spaceFaixaAte.trim() === '' ? null : Number(spaceFaixaAte);
  const faixaValorNum = Number(spaceFaixaCentavos || '0') / 100;
  const erroFaixaAte = erroDoLimiteGratis(spaceValorModo, faixaAteNum, capacidadeNum, tentouSalvarEspaco);
  const usaPercentual = spaceValorModo !== 'GRATIS' && spaceValorTipo === 'PERCENTUAL';
  const percentualNum = lerPercentual(spacePercentual);
  const cotaCadastrada = cota.estado === 'ok' && cota.valor !== null;
  const erroFaixaValor = spaceValorModo !== 'GRATIS' && !usaPercentual && tentouSalvarEspaco && !(faixaValorNum > 0) ? 'Informe o valor em reais, maior que zero.' : '';
  const erroPercentual = erroDoPercentual(spaceValorModo, spaceValorTipo, spacePercentual, tentouSalvarEspaco);
  // Percentual sem cota cadastrada (ou sem conseguir ler): não salva; o banco recusa do mesmo jeito (cota_nao_cadastrada).
  const faixaInvalida = valorInvalido(spaceValorModo, faixaAteNum, capacidadeNum, faixaValorNum, spaceValorTipo, percentualNum, cotaCadastrada);
  const valorBanco = valorParaBanco(spaceValorModo, spaceValorTipo, faixaAteNum, faixaValorNum, percentualNum);
  const regraMudou = !!editingSpaceId && !!spaceFaixaSalva && regraDeValorMudou(spaceFaixaSalva, valorBanco);
  const taxaNum = spaceTaxaLimpeza.trim() === '' ? 0 : Number(spaceTaxaLimpeza);
  const previaFaixa = previaDaFaixa(spaceValorModo, faixaAteNum, faixaValorNum > 0 ? faixaValorNum : null, spaceValorTipo, percentualNum);
  const previaCalculo = usaPercentual && cotaCadastrada ? previaDoCalculo(spaceValorModo, faixaAteNum, percentualNum, cota.valor) : '';

  const handleSaveSpace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!spaceNome || salvandoEspacoRef.current) return;
    setEspacoFormError(null);
    if (faixaInvalida) {
      setTentouSalvarEspaco(true);
      // O erro mora em "Pedidos e valor": se a seção está fechada, abre e leva o foco ao primeiro campo
      // com erro (leitor de tela e teclado).
      setSecoes((v) => ({ ...v, pedidos: true }));
      setTimeout(() => document.querySelector<HTMLElement>('#espaco-modal [aria-invalid="true"]')?.focus(), 0);
      return;
    }

    const regrasList = spaceRegras.split('\n').map((r) => r.trim()).filter(Boolean);
    const dados = {
      nome: spaceNome,
      descricao: spaceDescricao,
      capacidadeMax: Number(spaceCapacidadeMax),
      horarioFuncionamento: spaceHorario,
      taxaLimpeza: taxaNum,
      regras: regrasList,
      imagemUrl: spaceImagemUrl || 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=800&q=80',
      // Espaço novo nasce ativo; interditar e reabrir são pela função do banco (com motivo e auditoria), nunca por este formulário.
      ...(editingSpaceId ? {} : { ativo: true }),
      exigeAprovacao: spaceExigeAprovacao,
      // Só os valores da opção marcada vão para o banco (null = grátis; "Paga em toda reserva" = limite 0).
      ...valorBanco,
    };
    const bloqueiosMudaram = spaceBloqueios.length !== spaceBloqueiosOriginais.length
      || spaceBloqueios.some((id) => !spaceBloqueiosOriginais.includes(id));

    salvandoEspacoRef.current = true;
    setSalvandoEspaco(true);
    let res;
    try {
      res = editingSpaceId
        ? await updateSpace(editingSpaceId, dados, bloqueiosMudaram ? spaceBloqueios : undefined)
        : await addSpace(dados, spaceBloqueios);
    } catch {
      res = { success: false, bloqueiosFalharam: false };
    } finally {
      salvandoEspacoRef.current = false;
      setSalvandoEspaco(false);
    }
    if (!res.success) {
      setEspacoFormError('Não foi possível salvar o espaço agora. Seus dados continuam aqui, tente de novo.');
      return;
    }
    if (res.bloqueiosFalharam) {
      // O espaço já foi salvo; só o bloqueio ficou de fora. Nada fica "meio configurado".
      setFeedbackMsg({ type: 'error', text: `Espaço "${spaceNome}" salvo, mas não foi possível gravar os bloqueios. Abra o espaço de novo e salve para repetir.` });
    } else {
      setFeedbackMsg({ type: 'success', text: `Espaço "${spaceNome}" ${editingSpaceId ? 'atualizado' : 'cadastrado'} com sucesso!` });
    }
    setShowSpaceModal(false);
  };

  // "Excluir espaço" fica dentro do formulário de edição, no rodapé. "Voltar" recebe o foco inicial.
  const handleExcluirEspaco = async () => {
    if (!editingSpaceId) return;
    const nome = spaces.find((x) => x.id === editingSpaceId)?.nome ?? spaceNome;
    const confirmou = await confirm({
      title: `Excluir ${nome}?`,
      message: 'As reservas já feitas continuam no histórico.',
      confirmLabel: 'Excluir espaço',
      cancelLabel: 'Voltar',
      destructive: true,
    });
    if (!confirmou) return;
    const res = await deleteSpace(editingSpaceId);
    setFeedbackMsg({ type: res.success ? 'success' : 'error', text: res.message });
    if (res.success) setShowSpaceModal(false);
  };

  // Interditar bloqueia SÓ novos pedidos: reserva nenhuma é cancelada nem avisada. Quem precisa cancela uma a uma, pela lista abaixo.
  const hojeLista = hojeBrasilia();
  const futurasDo = (espacoId: string) => reservasFuturasDoEspaco(reservations, espacoId, hojeLista).length;
  const abrirInterdicao = (espaco: CommonSpace, modo: ModoInterdicao) => {
    setFeedbackMsg(null);
    setInterdicaoAlvo({ espacoId: espaco.id, modo });
  };
  const verReservasFuturas = (espaco: CommonSpace) => {
    setInterdicaoAlvo(null);
    setEspacoFocoId(espaco.id);
    setTimeout(() => { const el = document.getElementById('reservas-futuras-espaco'); el?.scrollIntoView({ block: 'start' }); el?.focus(); }, 150);
  };
  const confirmarInterdicao = async (motivo: string): Promise<string | null> => {
    if (!interdicaoAlvo) return null;
    const alvo = spaces.find((x) => x.id === interdicaoAlvo.espacoId);
    const res = await interditarEspaco(interdicaoAlvo.espacoId, interdicaoAlvo.modo === 'reabrir', motivo);
    if (!res.success) return res.message;
    setInterdicaoAlvo(null);
    setRecarregarKey((k) => k + 1);
    setFeedbackMsg({ type: 'success', text: res.message });
    // O espaço pode ter sumido da lista de escolha (interditado): o chip volta ao padrão.
    if (alvo && interdicaoAlvo.modo === 'interditar') setChipId((atual) => (atual === alvo.id ? null : atual));
    return null;
  };

  // Campo inválido dentro de uma seção fechada: o navegador não consegue focá-lo e o envio morreria
  // em silêncio. Abre a seção e leva o foco (e a mensagem) até o campo.
  const aoCampoInvalido = (e: React.FormEvent<HTMLFormElement>) => {
    const alvo = e.target as HTMLInputElement;
    const secao = alvo.closest<HTMLElement>('[data-secao]');
    if (!secao?.hidden) return;
    e.preventDefault();
    const chave = secao.dataset.secao === 'espaco-pedidos' ? 'pedidos' : secao.dataset.secao === 'espaco-bloqueios' ? 'bloqueios' : 'dados';
    setSecoes((v) => ({ ...v, [chave]: true }));
    setTimeout(() => { alvo.focus(); alvo.reportValidity?.(); }, 0);
  };

  const statusMap: Record<ReservationStatus, { label: string; bg: string; text: string }> = {
    PENDENTE: { label: 'Aguardando aprovação', bg: 'bg-pendente-100', text: 'text-pendente-800' },
    APROVADA: { label: 'Confirmada', bg: 'bg-emerald-100', text: 'text-emerald-800' },
    RECUSADA: { label: 'Recusada', bg: 'bg-red-100', text: 'text-red-800' },
    CANCELADA: { label: 'Cancelada', bg: 'bg-slate-100', text: 'text-slate-700' },
  };

  // ── Espaço do chip e visão ──
  const primeiroAtivo = spaces.find((s) => s.ativo !== false) ?? null;
  // Morador: o espaço do chip (o primeiro ativo por padrão, nunca "Todos"). Equipe: null = "Todos".
  const chipEspaco = (chipId ? spaces.find((s) => s.id === chipId && s.ativo !== false) : null) ?? (isStaff ? null : primeiroAtivo);
  const semEspacoAtivo = !isStaff && !primeiroAtivo;
  const nomesBloqueados = (id: string) => bloqueiosDoEspaco(id)
    .map((o) => spaces.find((x) => x.id === o)?.nome)
    .filter((n): n is string => !!n)
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));

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
  // Aberto pelo dia do calendário, o espaço é o do chip e NÃO é trocado por outro (o modal não tem seletor):
  // se estiver ocupado, o modal avisa e oferece "Trocar espaço". Só no seletor da equipe vale o primeiro livre
  // quando o marcado deixou de servir (ex.: alguém acabou de pegar o dia).
  const espacoFixo = espacoFixoId ? spaces.find((s) => s.id === espacoFixoId) ?? null : null;
  // Seletor da equipe: nada vem pré-marcado (só o espaço do chip, se houver); quem registra escolhe.
  const espacoDoSeletor = spaces.find((s) => s.id === selectedSpaceId && escolhivel(s)) ?? null;
  const espacoModal = espacoFixo ?? espacoDoSeletor;
  const espacoEscolhido = espacoModal && escolhivel(espacoModal) ? espacoModal : null;
  const bloqueadoNoDia = !!espacoFixo && !escolhivel(espacoFixo);
  const reservasDoDia = dataReserva
    ? reservations.filter((r) => r.data === dataReserva && (r.status === 'PENDENTE' || r.status === 'APROVADA'))
    : [];
  const temReservaNoEspaco = !!espacoFixo && reservasDoDia.some((r) => r.espacoId === espacoFixo.id);

  // ── Número de pessoas e valor de uso (prévia pela função do banco) ──
  const pessoasNum = Number(convidados);
  const pessoasVazio = convidados.trim() === '';
  const pessoasZero = !pessoasVazio && !(pessoasNum >= 1);
  const pessoasInformadas = !pessoasVazio && Number.isInteger(pessoasNum) && pessoasNum >= 1;
  const acimaDaCapacidade = !!espacoEscolhido && pessoasInformadas && pessoasNum > espacoEscolhido.capacidadeMax;
  const chavePrevia = espacoEscolhido && pessoasInformadas && !acimaDaCapacidade ? `${espacoEscolhido.id}|${pessoasNum}` : null;
  // Debounce de ~400 ms: o valor só é pedido ao banco quando a pessoa para de digitar.
  useEffect(() => {
    if (!showModal || !chavePrevia) return;
    const [espacoId, pessoas] = chavePrevia.split('|');
    let cancelado = false;
    const t = setTimeout(() => {
      buscarValorRef.current(espacoId, Number(pessoas)).then((valor) => {
        if (!cancelado) setPreviaValor({ chave: chavePrevia, valor });
      });
    }, 400);
    return () => { cancelado = true; clearTimeout(t); };
  }, [showModal, chavePrevia, recarregarKey]);
  const previaAtual = chavePrevia && previaValor?.chave === chavePrevia ? previaValor : null;
  // Espaço em percentual sem cota cadastrada: não há valor para pedir (o banco recusa; nunca grava 0 em silêncio).
  const semValorDefinido = previaAtual?.valor === 'COTA_INDEFINIDA';
  const totalPedido = espacoEscolhido && typeof previaAtual?.valor === 'number' ? textoTotalPedido(previaAtual.valor, espacoEscolhido.taxaLimpeza) : '';
  let textoValor = '';
  if (pessoasZero) textoValor = 'O número de pessoas precisa ser de pelo menos 1.';
  else if (!pessoasInformadas) textoValor = 'Informe o número de pessoas para ver o valor.';
  else if (chavePrevia) {
    if (!previaAtual) textoValor = 'Calculando o valor…';
    else if (previaAtual.valor === null) textoValor = 'Não foi possível mostrar o valor agora. Ele é calculado ao enviar.';
    else if (previaAtual.valor === 'COTA_INDEFINIDA') textoValor = 'O valor desta reserva ainda não foi definido. Fale com a administração.';
    else if (espacoEscolhido) textoValor = textoValorPedido(espacoEscolhido, previaAtual.valor, isStaff);
  }

  /** Abre o modal: pelo dia do calendário (espaço do chip, sem seletor) ou pelo botão da equipe (com seletor). */
  const abrirModalReserva = (opcoes: { dia?: string; espacoFixoId?: string | null; espacoSugeridoId?: string }) => {
    setFeedbackMsg(null);
    setReservaFormError(null);
    setTentouEnviar(false);
    setRegrasAbertas(false);
    setDataReserva(opcoes.dia ?? '');
    setDataFixa(!!opcoes.dia);
    setEspacoFixoId(opcoes.espacoFixoId ?? null);
    setSelectedSpaceId(opcoes.espacoSugeridoId ?? '');
    setShowModal(true);
  };

  const alternarVisao = (v: Visao) => {
    setVisaoEscolhida(v);
    try { window.localStorage.setItem(CHAVE_VISAO, v); } catch { /* sem armazenamento: só não lembra */ }
  };

  // "Trocar espaço" (modal com o espaço ocupado): fecha o modal e leva o foco de volta aos chips.
  const trocarEspaco = () => {
    setShowModal(false);
    setTimeout(() => chipsRef.current?.focarEscolhido(), 0);
  };

  // Decidir (aprovar/recusar) pode liberar o dia: o calendário consulta de novo.
  const decidir = async (id: string, aprovado: boolean, motivo?: string) => {
    const ok = await judgeReservation(id, aprovado, motivo);
    setRecarregarKey((k) => k + 1);
    setFeedbackMsg(ok
      ? { type: 'success', text: aprovado ? 'Pedido aprovado.' : 'Pedido recusado.' }
      : { type: 'error', text: `Não foi possível ${aprovado ? 'aprovar' : 'recusar'} o pedido agora. Tente de novo.` });
    // O pedido sai do cartão: o foco vai para o aviso (ponto previsível), a não ser que o modal esteja aberto.
    if (!showModal) setTimeout(() => { const el = document.getElementById('reservas-feedback'); el?.focus(); el?.scrollIntoView({ block: 'nearest' }); }, 150);
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

  // Cancelar (pendente ou já confirmada): motivo obrigatório, que o morador lê no aviso. Mesma auditoria e mesmo aviso da gestão.
  const cancelar = async (r: { id: string; espacoNome: string; data: string; unidade: string; bloco: string }) => {
    const motivo = await askReason({
      title: 'Cancelar reserva',
      message: `${r.espacoNome} em ${formatarData(r.data)}, Apto ${r.unidade}-${r.bloco}. O morador será avisado.`,
      label: 'Motivo do cancelamento (o morador vê)',
      confirmLabel: 'Cancelar reserva',
      cancelLabel: 'Voltar',
      minLength: 3,
      maxLength: 200,
      requiredMessage: 'Escreva o motivo do cancelamento.',
    });
    if (!motivo) return;
    const ok = await cancelReservation(r.id, motivo);
    setRecarregarKey((k) => k + 1);
    setFeedbackMsg(ok
      ? { type: 'success', text: 'Reserva cancelada. O morador foi avisado.' }
      : { type: 'error', text: 'Não foi possível cancelar a reserva agora. Tente de novo.' });
    if (!showModal) setTimeout(() => { const el = document.getElementById('reservas-feedback'); el?.focus(); el?.scrollIntoView({ block: 'nearest' }); }, 150);
  };

  // Leva o foco ao campo com problema (leitor de tela e teclado); o texto fica no alerta do modal.
  const focarCampo = (id: string) => setTimeout(() => document.getElementById(id)?.focus(), 0);

  const handleCreateReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (enviando) return; // trava contra duplo clique
    setReservaFormError(null);
    setTentouEnviar(true);
    if (!termoAceito) {
      setReservaFormError('É obrigatório aceitar o regulamento e normas de uso do espaço.');
      focarCampo('reserva-termo');
      return;
    }
    if (!dataReserva) {
      setReservaFormError('Escolha a data da reserva.');
      focarCampo('reserva-data');
      return;
    }
    if (dataReserva < hoje) {
      setReservaFormError('Esse dia já passou. Escolha uma data a partir de hoje.');
      focarCampo('reserva-data');
      return;
    }
    if (!espacoEscolhido) {
      setReservaFormError(espacoFixo
        ? 'Este espaço está ocupado neste dia. Use "Trocar espaço" ou escolha outro dia.'
        : spaces.some(escolhivel) ? 'Escolha o espaço.' : 'Nenhum espaço disponível neste dia. Escolha outro dia.');
      if (!espacoFixo) focarCampo('reserva-espaco-grupo');
      return;
    }
    if (horarioFim <= horarioInicio) {
      setReservaFormError('O horário de término precisa ser depois do início.');
      focarCampo('reserva-fim');
      return;
    }
    if (!pessoasInformadas) {
      setReservaFormError(pessoasZero ? 'O número de pessoas precisa ser de pelo menos 1.' : 'Informe o número de pessoas para ver o valor.');
      document.getElementById('reserva-convidados')?.focus();
      return;
    }
    if (acimaDaCapacidade) {
      // A mensagem completa já está visível junto do campo (com role="alert" a partir daqui).
      document.getElementById('reserva-convidados')?.focus();
      return;
    }
    if (isStaff && !reservaMoradorNome.trim()) {
      setReservaFormError('Informe o nome do morador para quem a reserva está sendo registrada.');
      focarCampo('reserva-morador-nome');
      return;
    }

    setEnviando(true);
    try {
      const res = await requestReservation({
        espacoId: espacoEscolhido.id,
        data: dataReserva,
        horarioInicio,
        horarioFim,
        convidadosEstimados: pessoasNum,
        ...(isStaff ? { moradorNome: reservaMoradorNome.trim(), bloco: reservaBloco, unidade: reservaUnidade.trim() } : {}),
      });
      // Qualquer resposta (sucesso ou conflito) muda a disponibilidade: o calendário consulta de novo.
      setRecarregarKey((k) => k + 1);

      if (res.success) {
        setFeedbackMsg({ type: 'success', text: res.message });
        // O foco volta ao dia do calendário, que fica longe do aviso no celular: traz o aviso para a tela.
        setTimeout(() => document.getElementById('reservas-feedback')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 150);
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

  // Padrão: Calendário para todos (a equipe decide pedidos no cartão do topo, não na lista).
  const visao: Visao = spaces.length === 0 ? 'lista' : (visaoEscolhida ?? 'calendario');

  if (isProvisorio(currentUser)) return <AguardandoValidacao recurso="As reservas" />;

  const pedidosAguardando = podeDecidir
    ? reservations.filter((r) => r.status === 'PENDENTE').sort((a, b) => a.data.localeCompare(b.data))
    : [];
  // Morador: as próximas reservas ativas (a lista completa fica em "Ver em lista").
  const proximasDoMorador = isStaff ? [] : reservations
    .filter((r) => (r.status === 'PENDENTE' || r.status === 'APROVADA') && r.data >= hoje)
    .sort((a, b) => a.data.localeCompare(b.data))
    .slice(0, 3);
  const dataBR = (iso: string) => formatarData(iso).slice(0, 5);

  const botaoImprimirTexto = (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-xs font-semibold text-accent-strong underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
    >
      <Printer className="h-4 w-4" aria-hidden="true" />
      <span>Imprimir agenda</span>
    </button>
  );

  const aoTeclarAbas = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const novo: Visao = e.key === 'ArrowLeft' || e.key === 'Home' ? 'calendario' : 'lista';
    alternarVisao(novo);
    document.getElementById(`aba-${novo}`)?.focus();
  };

  const nomeDoEspacoEmEdicao = spaces.find((x) => x.id === editingSpaceId)?.nome ?? spaceNome;
  const outrosEspacos = spaces.filter((o) => o.id !== editingSpaceId);
  const resumoPedidos = `${spaceExigeAprovacao ? 'Precisa de aprovação' : 'Confirma na hora'} · Higienização: ${taxaNum > 0 ? formatarMoeda(taxaNum) : 'isento'} · Valor: ${
    spaceValorModo === 'GRATIS' ? 'grátis'
      : faixaInvalida ? (usaPercentual ? (cotaCadastrada ? (spaceValorModo === 'PAGA' ? 'informe o percentual' : 'informe o limite e o percentual') : 'cadastre a cota') : spaceValorModo === 'PAGA' ? 'informe o valor' : 'informe o limite e o valor')
      : resumoCurtoDoValor({ ...valorBanco, valorCalculado: usaPercentual && percentualNum !== null && cotaCadastrada ? calcularPercentual(cota.valor as number, percentualNum) : null }, true)
  }`;
  const nomesMarcados = spaceBloqueios.map((id) => spaces.find((o) => o.id === id)?.nome).filter((n): n is string => !!n);
  const resumoBloqueios = nomesMarcados.length > 0 ? `Não reservável no mesmo dia que ${nomesMarcados.join(', ')}` : 'Nenhum';
  const alternarSecao = (k: 'dados' | 'pedidos' | 'bloqueios') => setSecoes((v) => ({ ...v, [k]: !v[k] }));

  return (
    <div className="space-y-5">

      {/* Cabeçalho impresso com o Logotipo Oficial */}
      <PrintReportHeader
        titulo="Agenda Oficial de Reservas das Áreas Comuns"
        subtitulo="Controle de acesso da Portaria e cronograma de higienização"
      />

      {/* Cabeçalho de Tela: o morador só escolhe; a equipe tem 1 botão principal e o menu "Mais" */}
      <div className="no-print flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-accent" aria-hidden="true" />
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
              {isStaff ? 'Reservas' : 'Reservar espaço'}
            </h1>
          </div>
          {!isStaff && <p className="mt-1 text-xs text-slate-600">Escolha o espaço e o dia.</p>}
        </div>

        {isStaff && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => abrirModalReserva({ espacoSugeridoId: chipEspaco?.id })}
              disabled={spaces.length === 0}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-semibold text-white shadow-xs transition hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none"
            >
              <Plus className="h-4 w-4 text-accent" aria-hidden="true" />
              <span>Registrar reserva</span>
            </button>
            <MenuMais
              itens={[
                ...(isSindico ? [{ rotulo: 'Cadastrar espaço', icone: <Building2 className="h-4 w-4 text-accent-strong" aria-hidden="true" />, onSelecionar: handleOpenNewSpace }] : []),
                { rotulo: 'Imprimir agenda', icone: <Printer className="h-4 w-4 text-slate-600" aria-hidden="true" />, onSelecionar: () => window.print() },
              ]}
            />
          </div>
        )}
      </div>

      {/* Mensagem de Feedback */}
      {feedbackMsg && (
        <div
          id="reservas-feedback"
          tabIndex={-1}
          role={feedbackMsg.type === 'success' ? 'status' : 'alert'}
          className={`scroll-mt-20 outline-none focus-visible:ring-2 focus-visible:ring-accent-strong rounded-2xl p-4 text-xs font-semibold flex items-center justify-between no-print ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
              : 'bg-red-50 text-red-900 border border-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMsg.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-red-600" aria-hidden="true" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)} aria-label="Fechar mensagem" className="-m-3.5 flex size-11 shrink-0 items-center justify-center text-slate-500 hover:text-slate-600">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Quem decide vê primeiro o que está aguardando */}
      {podeDecidir && (
        <PedidosAguardando pedidos={pedidosAguardando} onAprovar={(id) => decidir(id, true)} onRecusar={recusar} />
      )}

      {/* Depois de interditar: as reservas futuras continuam valendo e quem precisa as cancela uma a uma */}
      {podeDecidir && espacoFocoId && spaces.find((x) => x.id === espacoFocoId) && (
        <ReservasFuturasEspaco
          espaco={spaces.find((x) => x.id === espacoFocoId)!}
          reservas={reservasFuturasDoEspaco(reservations, espacoFocoId, hoje)}
          onCancelar={cancelar}
          onFechar={() => setEspacoFocoId(null)}
        />
      )}

      {spaces.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white/60 p-8 text-center text-xs text-slate-600 no-print">
          <p>Nenhum espaço comum cadastrado ainda.</p>
          {isSindico && (
            <button
              type="button"
              onClick={handleOpenNewSpace}
              className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-semibold text-white hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
            >
              <Plus className="h-4 w-4 text-accent" aria-hidden="true" />
              <span>Cadastrar espaço</span>
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Equipe: abas Calendário | Lista (sublinhado). Morador: sem abas, a lista é o link "Ver em lista". */}
          {isStaff && (
            <div role="tablist" aria-label="Visão das reservas" onKeyDown={aoTeclarAbas} className="no-print flex gap-6 border-b border-slate-200">
              {([['calendario', 'Calendário'], ['lista', 'Lista']] as const).map(([chave, rotulo]) => {
                const ativa = visao === chave;
                return (
                  <button
                    key={chave}
                    id={`aba-${chave}`}
                    type="button"
                    role="tab"
                    aria-selected={ativa}
                    aria-controls={`painel-${chave}`}
                    tabIndex={ativa ? 0 : -1}
                    onClick={() => alternarVisao(chave)}
                    className={`-mb-px min-h-11 border-b-[3px] px-1 text-xs font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong ${
                      ativa ? 'border-accent text-primary' : 'border-transparent text-slate-600 hover:text-primary'
                    }`}
                  >
                    {rotulo}
                  </button>
                );
              })}
            </div>
          )}

          {/* Chips: o calendário e o modal valem para o espaço escolhido (na Lista não filtram nada, então somem) */}
          {visao === 'calendario' && (
            <>
          <div className="no-print flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <SeletorEspacos ref={chipsRef} spaces={spaces} valor={chipEspaco?.id ?? null} comTodos={isStaff} onChange={setChipId} />
            </div>
            {isSindico && (
              <button
                type="button"
                onClick={handleOpenNewSpace}
                className="hidden min-h-11 shrink-0 items-center gap-1 text-xs font-semibold text-accent-strong underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong sm:inline-flex"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>Cadastrar espaço</span>
              </button>
            )}
          </div>

          {/* Espaço interditado: o morador lê "Em manutenção: {motivo}" (texto puro); a equipe vê também quem interditou e as reservas futuras */}
          {spaces.some((x) => x.ativo === false) && (
            <ul aria-label="Espaços em manutenção" className="no-print space-y-1.5">
              {spaces.filter((x) => x.ativo === false).map((x) => {
                const info = interdicoes[x.id];
                const futuras = podeDecidir ? futurasDo(x.id) : 0;
                return (
                  <li key={x.id} className="flex items-start gap-2 rounded-xl border border-pendente-200 bg-pendente-50 px-3 py-2 text-xs text-pendente-900">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-pendente-700" aria-hidden="true" />
                    <span className="min-w-0 break-words">
                      <strong>{x.nome}:</strong> {textoEmManutencao(x)}
                      {podeDecidir && info && <span className="block text-[12px] text-pendente-800">Interditado por {info.por} em {formatarData(info.em)}</span>}
                      {futuras > 0 && (
                        <button
                          type="button"
                          onClick={() => verReservasFuturas(x)}
                          className="block min-h-11 text-left text-[12px] font-semibold text-accent-strong underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
                        >
                          {pluralizar(futuras, 'reserva futura continua valendo', 'reservas futuras continuam valendo')}: ver reservas futuras deste espaço
                        </button>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {chipEspaco && (
            <DetalhesEspaco
              key={chipEspaco.id}
              espaco={chipEspaco}
              aberto={detalhesAberto}
              onAlternar={() => setDetalhesAberto((v) => !v)}
              bloqueiaNomes={isSindico ? nomesBloqueados(chipEspaco.id) : []}
            />
          )}
            </>
          )}
        </>
      )}

      {visao === 'calendario' && (
        <div id="painel-calendario" role={isStaff ? 'tabpanel' : undefined} aria-labelledby={isStaff ? 'aba-calendario' : undefined} className="space-y-5">
          {semEspacoAtivo ? (
            <div className="no-print rounded-2xl border border-dashed border-slate-200 bg-white/60 p-6 text-center text-xs text-slate-600">
              Nenhum espaço está disponível para reservas no momento.
            </div>
          ) : (
            <ReservasCalendario
              spaces={spaces}
              reservations={reservations}
              ehEquipe={isStaff}
              buscar={buscarDisponibilidade}
              recarregarKey={recarregarKey}
              diaSelecionado={showModal && dataFixa ? dataReserva : null}
              onSelecionarDia={(dia) => abrirModalReserva({ dia, espacoFixoId: chipEspaco?.id ?? null })}
              espacoId={chipEspaco?.id ?? null}
              bloqueiosDoEspaco={isSindico ? bloqueiosDoEspaco : undefined}
            />
          )}

          {/* Morador: próximas reservas em poucas linhas; o histórico completo é "Ver em lista" */}
          {!isStaff && (
            <section aria-labelledby="minhas-reservas-titulo" className="no-print space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h2 id="minhas-reservas-titulo" className="font-display text-lg font-bold text-slate-900">Minhas reservas</h2>
                {botaoImprimirTexto}
              </div>
              {proximasDoMorador.length === 0 ? (
                <p className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-600">
                  {reservations.length === 0 ? 'Você ainda não tem reservas. Escolha um espaço e um dia no calendário.' : 'Você não tem reservas futuras.'}
                </p>
              ) : (
                <ul className="space-y-2">
                  {proximasDoMorador.map((r) => {
                    const st = statusMap[r.status];
                    return (
                      <li key={r.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-bold text-slate-900">{r.espacoNome} · {dataBR(r.data)}</span>
                          <Badge className={`${st.bg} ${st.text}`}>{st.label}</Badge>
                        </div>
                        <div className="mt-0.5 text-[12px] text-slate-600">{formatarIntervalo(r.horarioInicio, r.horarioFim)}</div>
                      </li>
                    );
                  })}
                </ul>
              )}
              <button
                type="button"
                onClick={() => alternarVisao('lista')}
                className="inline-flex min-h-11 items-center text-xs font-semibold text-accent-strong underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
              >
                Ver em lista
              </button>
            </section>
          )}
        </div>
      )}

      {/* Histórico (equipe) ou Minhas reservas (morador). Com o calendário na tela ela continua no
          documento, escondida, para a "Imprimir agenda" sair sempre com a tabela. */}
      <div
        id="painel-lista"
        role={isStaff && visao === 'lista' ? 'tabpanel' : undefined}
        aria-labelledby={isStaff && visao === 'lista' ? 'aba-lista' : undefined}
        className={visao === 'lista' ? 'space-y-4' : 'hidden space-y-4 print:block'}
      >
        {!isStaff && visao === 'lista' && spaces.length > 0 && (
          <button
            type="button"
            onClick={() => alternarVisao('calendario')}
            className="no-print inline-flex min-h-11 items-center text-xs font-semibold text-accent-strong underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
          >
            Ver no calendário
          </button>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-slate-900">
            {isStaff ? 'Histórico de reservas' : 'Minhas reservas'}
          </h2>
          <span className="flex items-center gap-3 text-xs text-slate-600">
            Total: {pluralizar(reservations.length, 'reserva', 'reservas')}
            {!isStaff && botaoImprimirTexto}
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="stack-mobile tabela-agenda w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50/75 text-[12px] font-bold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3.5">Espaço</th>
                  <th className="px-4 py-3.5">Data e horário</th>
                  <th className="px-4 py-3.5">Unidade / Morador</th>
                  <th className="px-4 py-3.5">Valor</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Avaliação / Parecer</th>
                  {podeDecidir && <th className="px-4 py-3.5 no-print">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reservations.length === 0 ? (
                  <tr>
                    <td colSpan={podeDecidir ? 7 : 6} className="px-5 py-8 text-center text-slate-600">
                      {isStaff ? 'Nenhuma reserva registrada até o momento.' : 'Você ainda não tem reservas. Escolha um espaço e um dia no calendário.'}
                    </td>
                  </tr>
                ) : (
                  reservations.map((r) => {
                    const st = statusMap[r.status] || { label: r.status, bg: 'bg-slate-100', text: 'text-slate-700' };

                    return (
                      <tr key={r.id} className="hover:bg-slate-50/60 transition">
                        <td data-label="Espaço" className="px-4 py-3.5 font-bold text-slate-900">
                          {r.espacoNome}
                        </td>
                        <td data-label="Data e horário" className="px-4 py-3.5 md:whitespace-nowrap">
                          <div className="font-semibold text-slate-900">{formatarData(r.data)}</div>
                          <div className="text-[12px] text-slate-600">
                            {formatarIntervalo(r.horarioInicio, r.horarioFim)}
                          </div>
                        </td>
                        <td data-label="Unidade / Morador" className="px-4 py-3.5">
                          <div className="font-bold text-primary md:whitespace-nowrap">
                            Apto {r.unidade} - Bloco {r.bloco}
                          </div>
                          <div className="text-[12px] text-slate-600">{r.moradorNome}</div>
                        </td>
                        {/* "—" só para reserva anterior à regra (sem valor gravado); "Grátis" é decisão do espaço. */}
                        <td data-label="Valor" className="px-4 py-3.5 font-semibold text-slate-900 md:whitespace-nowrap">
                          {valorDaReserva(r.valorUso)}
                        </td>
                        <td data-label="Status" className="px-4 py-3.5 md:whitespace-nowrap">
                          <Badge className={`${st.bg} ${st.text}`}>{st.label}</Badge>
                        </td>
                        {/* Pendente ainda não tem parecer: a célula fica vazia (no celular some). A decisão é no cartão do topo. */}
                        <td data-label="Avaliação / Parecer" className={`px-4 py-3.5 text-[12px] text-slate-600 ${r.status === 'PENDENTE' ? 'oculta-mobile' : ''}`}>
                          {r.status === 'APROVADA' && r.avaliadoPor === APROVACAO_AUTOMATICA && (
                            <span className="text-emerald-700 font-semibold">
                              Confirmada automaticamente em {formatarData(r.dataAvaliacao || r.dataSolicitacao)}
                            </span>
                          )}
                          {r.status === 'APROVADA' && r.avaliadoPor !== APROVACAO_AUTOMATICA && (
                            <span className="text-emerald-700 font-semibold">
                              Confirmada por {(r.avaliadoPor || 'Administração').replace(/\s*\([A-Za-z]+\)$/, '')} em {formatarData(r.dataAvaliacao || r.dataSolicitacao)}
                            </span>
                          )}
                          {(r.status === 'RECUSADA' || r.status === 'CANCELADA') && r.motivoRecusa && (
                            <span className={`${r.status === 'RECUSADA' ? 'text-red-700' : 'text-slate-700'} font-medium`}>
                              Motivo: {r.motivoRecusa}
                            </span>
                          )}
                        </td>
                        {podeDecidir && (
                          <td data-label="Ações" className="px-4 py-3.5 no-print">
                            {(r.status === 'PENDENTE' || r.status === 'APROVADA') && r.data >= hoje && (
                              <button
                                type="button"
                                onClick={() => cancelar(r)}
                                aria-label={`Cancelar reserva do apto ${r.unidade}, bloco ${r.bloco}, ${r.espacoNome}, ${formatarData(r.data)}`}
                                className="flex min-h-11 items-center justify-center rounded-xl border border-red-300 bg-white px-3 text-xs font-bold text-red-700 transition hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
                              >
                                Cancelar reserva
                              </button>
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

      {/* Equipe que gere espaços: a lista recolhível substitui os 3 ícones sobre a foto */}
      {podeDecidir && spaces.length > 0 && (
        <EspacosCadastrados
          spaces={spaces}
          aberto={espacosAberto}
          onAlternar={() => setEspacosAberto((v) => !v)}
          onEditar={isSindico ? handleOpenEditSpace : undefined}
          onInterditar={abrirInterdicao}
          interdicoes={interdicoes}
          futurasDo={futurasDo}
          onVerFuturas={verReservasFuturas}
        />
      )}

      {interdicaoAlvo && spaces.find((x) => x.id === interdicaoAlvo.espacoId) && (
        <InterditarEspacoDialog
          key={`${interdicaoAlvo.espacoId}-${interdicaoAlvo.modo}`}
          espaco={spaces.find((x) => x.id === interdicaoAlvo.espacoId)!}
          modo={interdicaoAlvo.modo}
          reservasFuturas={futurasDo(interdicaoAlvo.espacoId)}
          futurasPendentes={reservasFuturasDoEspaco(reservations, interdicaoAlvo.espacoId, hojeLista).filter((r) => r.status === 'PENDENTE').length}
          futurasAprovadas={reservasFuturasDoEspaco(reservations, interdicaoAlvo.espacoId, hojeLista).filter((r) => r.status === 'APROVADA').length}
          onVerReservasFuturas={() => verReservasFuturas(spaces.find((x) => x.id === interdicaoAlvo.espacoId)!)}
          onFechar={() => setInterdicaoAlvo(null)}
          onConfirmar={confirmarInterdicao}
        />
      )}

      {/* Modal da reserva: abre pelo dia do calendário (espaço do chip, sem seletor) ou pelo botão da equipe (com seletor) */}
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
                {espacoFixo && dataReserva ? (
                  // "Salão de Festas · terça-feira, 20 de outubro": o espaço já vem do chip.
                  <h3 id="reserva-modal-title" className="text-base font-bold text-slate-900">
                    {espacoFixo.nome} · {dataLonga(dataReserva).replace(/^./, (c) => c.toLowerCase())}
                  </h3>
                ) : (
                  <>
                    <h3 id="reserva-modal-title" className="text-base font-bold text-slate-900">{isStaff ? 'Registrar reserva' : 'Reservar espaço'}</h3>
                    {dataFixa && dataReserva && (
                      <p className="mt-0.5 text-sm font-semibold text-primary">{dataLonga(dataReserva)}</p>
                    )}
                    <p className="mt-0.5 text-xs text-slate-600">Escolha o espaço e o horário.</p>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                aria-label="Fechar"
                className="-mr-2 -mt-1 flex size-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" aria-hidden="true" />
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
                            {podeDecidir && r.status === 'PENDENTE' && (
                              <div className="mt-2 flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => decidir(r.id, true)}
                                  className="flex min-h-11 flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-700 px-2.5 text-xs font-bold text-white transition hover:bg-emerald-800"
                                >
                                  <Check className="h-3 w-3" aria-hidden="true" />
                                  <span>Aprovar</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => recusar(r)}
                                  className="flex min-h-11 flex-1 items-center justify-center gap-1 rounded-lg border border-red-300 bg-white px-2.5 text-xs font-bold text-red-700 transition hover:bg-red-50"
                                >
                                  <X className="h-3 w-3" aria-hidden="true" />
                                  <span>Recusar</span>
                                </button>
                              </div>
                            )}
                            {podeDecidir && (r.status === 'PENDENTE' || r.status === 'APROVADA') && (
                              <button
                                type="button"
                                onClick={() => cancelar(r)}
                                className="mt-2 flex min-h-11 w-full items-center justify-center rounded-lg border border-red-300 bg-white px-2.5 text-xs font-bold text-red-700 transition hover:bg-red-50"
                              >
                                Cancelar reserva
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                )}

                {/* Espaço do chip ocupado neste dia: não troca por outro sozinho; oferece voltar aos chips */}
                {bloqueadoNoDia && espacoFixo && (
                  <div role="status" className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-700">
                    {!temReservaNoEspaco && (
                      <p className="flex items-center gap-2 font-semibold">
                        <Lock className="h-4 w-4 shrink-0 text-slate-600" aria-hidden="true" />
                        <span>{espacoFixo.ativo === false ? 'Este espaço está em manutenção.' : 'Este espaço está ocupado neste dia.'}</span>
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={trocarEspaco}
                      className="-mb-1 inline-flex min-h-11 items-center text-xs font-semibold text-accent-strong underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
                    >
                      Trocar espaço
                    </button>
                  </div>
                )}

                {!bloqueadoNoDia && (<>
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
                      className="mt-1 w-full min-w-0 rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-strong/30 min-h-11 sm:min-h-0"
                    />
                  </div>
                )}

                {/* Seletor completo: só quando não há espaço definido (equipe, por "Registrar reserva" ou com "Todos") */}
                {!espacoFixo && (
                  <div role="radiogroup" id="reserva-espaco-grupo" tabIndex={-1} aria-labelledby="reserva-espaco-rotulo" className="outline-none">
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
                              <Badge icon={<Lock className="h-3 w-3" aria-hidden="true" />} className="bg-slate-100 text-slate-700">Ocupado</Badge>
                            )}
                            {sit === 'MANUTENCAO' && (
                              <Badge icon={<AlertTriangle className="h-3 w-3" aria-hidden="true" />} className="bg-pendente-100 text-pendente-800">Em manutenção</Badge>
                            )}
                            {sit === 'VERIFICANDO' && <span className="text-[12px] text-slate-600">Verificando…</span>}
                          </label>
                        );
                      })}
                    </div>
                    {!espacoEscolhido && (!dataValida || !verificandoDia) && (
                      <p className="mt-2 text-xs font-semibold text-slate-700">{dataValida && !spaces.some(escolhivel) ? 'Nenhum espaço disponível neste dia. Escolha outro dia.' : 'Escolha o espaço.'}</p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
                  <div className="min-w-0">
                    <label htmlFor="reserva-inicio" className="block text-xs font-semibold text-slate-700">Início</label>
                    <input
                      id="reserva-inicio"
                      type="time"
                      required
                      value={horarioInicio}
                      onChange={(e) => setHorarioInicio(e.target.value)}
                      className="mt-1 w-full min-w-0 rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-strong/30 min-h-11 sm:min-h-0"
                    />
                  </div>
                  <div className="min-w-0">
                    <label htmlFor="reserva-fim" className="block text-xs font-semibold text-slate-700">Término</label>
                    <input
                      id="reserva-fim"
                      type="time"
                      required
                      value={horarioFim}
                      onChange={(e) => setHorarioFim(e.target.value)}
                      className="mt-1 w-full min-w-0 rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-strong/30 min-h-11 sm:min-h-0"
                    />
                  </div>
                  {espacoEscolhido && (
                    <p className="col-span-2 -mt-1 text-[12px] text-slate-600">Horário permitido do espaço: {espacoEscolhido.horarioFuncionamento}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="reserva-convidados" className="block text-xs font-semibold text-slate-700">
                    Número de pessoas{espacoEscolhido ? ` (máximo ${espacoEscolhido.capacidadeMax})` : ''}
                  </label>
                  <input
                    id="reserva-convidados"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    value={convidados}
                    onChange={(e) => setConvidados(e.target.value)}
                    aria-invalid={acimaDaCapacidade || pessoasZero ? 'true' : undefined}
                    aria-describedby="reserva-convidados-valor"
                    className={`mt-1 w-full rounded-xl border px-3 py-2 text-base focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-strong/30 min-h-11 sm:min-h-0 sm:text-xs ${acimaDaCapacidade || pessoasZero ? 'border-red-600' : 'border-slate-200'}`}
                  />
                  {/* Valor calculado pelo banco, atualizado enquanto a pessoa digita. Acima da capacidade
                      não mostra valor: só o aviso (com role="alert" depois da tentativa de enviar). */}
                  <div id="reserva-convidados-valor" aria-live="polite" aria-atomic="true" className="mt-1.5 text-xs font-semibold">
                    {acimaDaCapacidade && espacoEscolhido ? (
                      <p role={tentouEnviar ? 'alert' : undefined} className="flex items-start gap-1.5 text-red-700">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>Este espaço comporta até {espacoEscolhido.capacidadeMax} pessoas. Reduza o número para continuar.</span>
                      </p>
                    ) : espacoEscolhido && textoValor !== 'Calculando o valor…' ? (
                      <p className={semValorDefinido ? 'text-red-700' : pessoasInformadas && typeof previaAtual?.valor === 'number' ? 'text-slate-900' : pessoasZero ? 'text-red-700' : 'font-normal text-slate-600'}>{textoValor}</p>
                    ) : null}
                  </div>
                  {/* Só visual: "calculando" não é anunciado a cada pausa de digitação; o leitor de tela recebe só o resultado. */}
                  {!acimaDaCapacidade && espacoEscolhido && textoValor === 'Calculando o valor…' && (
                    <p aria-hidden="true" className="mt-1.5 text-xs font-normal text-slate-600">{textoValor}</p>
                  )}
                </div>

                {espacoEscolhido && (
                  <p className="text-xs text-slate-700">
                    Taxa de higienização: <strong className="text-primary">{espacoEscolhido.taxaLimpeza > 0 ? formatarMoeda(espacoEscolhido.taxaLimpeza) : 'Isento'}</strong>
                  </p>
                )}

                {/* TOTAL a pagar (valor de uso + higienização). Só o total final: a cota e o percentual nunca aparecem aqui. */}
                {totalPedido && (
                  <p aria-live="polite" className="font-display text-sm font-bold text-slate-900">{totalPedido}</p>
                )}

                {/* Um aviso só, em uma linha: muda com a regra do espaço escolhido (a regra de verdade é do banco) */}
                {espacoEscolhido && (
                  <div aria-live="polite">
                    <p className="flex items-center gap-2 rounded-xl bg-accent-50 px-3 py-2.5 text-xs font-semibold text-accent-strong">
                      {espacoEscolhido.exigeAprovacao !== false
                        ? <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
                        : <Info className="h-4 w-4 shrink-0" aria-hidden="true" />}
                      <span>
                        {espacoEscolhido.exigeAprovacao !== false
                          ? (isStaff ? 'O pedido fica aguardando a decisão da equipe.' : 'A equipe vai analisar seu pedido.')
                          : (isStaff ? 'A reserva fica confirmada na hora.' : 'Sua reserva fica confirmada na hora.')}
                      </span>
                    </p>
                  </div>
                )}

                {/* Termo de Responsabilidade */}
                <div>
                  <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 p-3 bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      id="reserva-termo"
                      checked={termoAceito}
                      onChange={(e) => setTermoAceito(e.target.checked)}
                      className="mt-0.5 size-5 shrink-0 rounded border-slate-300 text-primary focus:ring-accent-strong"
                    />
                    <span className="text-xs text-slate-700 leading-snug">
                      Li e aceito as regras de uso deste espaço.
                    </span>
                  </label>
                  {espacoEscolhido && (
                    <>
                      <button
                        type="button"
                        aria-expanded={regrasAbertas}
                        aria-controls="reserva-regras"
                        onClick={() => setRegrasAbertas((v) => !v)}
                        className="-mb-1 mt-1 inline-flex min-h-11 items-center text-xs font-semibold text-accent-strong underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
                      >
                        {regrasAbertas ? 'Ocultar regras' : 'Ver regras'}
                      </button>
                      <div id="reserva-regras" hidden={!regrasAbertas} className="mt-1 rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
                        {espacoEscolhido.regras.length > 0 ? (
                          <ul className="list-disc space-y-0.5 pl-5">
                            {espacoEscolhido.regras.map((r, i) => <li key={i}>{r}</li>)}
                          </ul>
                        ) : (
                          <p>Este espaço não tem regras cadastradas.</p>
                        )}
                      </div>
                    </>
                  )}
                </div>
                </>)}

                {reservaFormError && (
                  <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" aria-hidden="true" />
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
                  {bloqueadoNoDia ? 'Fechar' : 'Cancelar'}
                </button>
                {!bloqueadoNoDia && (
                  <button
                    type="submit"
                    disabled={enviando || semValorDefinido || (!espacoFixo && !espacoEscolhido)}
                    className="min-h-11 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {enviando ? 'Enviando…'
                      : isStaff ? 'Registrar reserva'
                      : espacoEscolhido && espacoEscolhido.exigeAprovacao === false ? 'Reservar agora' : 'Pedir reserva'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Gestão/Cadastro de Espaço (Síndico): 3 seções recolhíveis */}
      {showSpaceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs no-print">
          <div
            className="fixed inset-0"
            onClick={() => setShowSpaceModal(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            id="espaco-modal"
            aria-labelledby="espaco-modal-title"
            className="relative flex max-h-[92dvh] w-full max-w-xl flex-col rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-accent" aria-hidden="true" />
                <h3 id="espaco-modal-title" className="text-base font-bold text-slate-900">
                  {editingSpaceId ? `Editar ${nomeDoEspacoEmEdicao}` : 'Cadastrar espaço'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSpaceModal(false)}
                aria-label="Fechar"
                className="-mr-2 flex size-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSaveSpace} onInvalidCapture={aoCampoInvalido} className="flex min-h-0 flex-1 flex-col">
              {/* Durante o salvar, campos e botões ficam travados; "contents" mantém o layout e o texto continua legível. */}
              <fieldset disabled={salvandoEspaco} className="contents [&_input:disabled]:text-slate-900 [&_textarea:disabled]:text-slate-900">
              <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4 sm:px-6">
                <Acordeao id="espaco-dados" titulo="Dados do espaço" aberto={secoes.dados} onAlternar={() => alternarSecao('dados')}>
                  <div className="space-y-4">
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                      <span className="text-[12px] text-slate-600">
                        Insira o link direto de uma imagem hospedada externamente (Google Drive, Unsplash, etc.)
                      </span>
                    </div>
                  </div>
                </Acordeao>

                <Acordeao id="espaco-pedidos" titulo="Pedidos e valor" resumo={resumoPedidos} aberto={secoes.pedidos} onAlternar={() => alternarSecao('pedidos')}>
                  <div className="space-y-4">
                    {/* Regras de reserva: decide se o pedido nasce aguardando a equipe ou já confirmado (o banco aplica) */}
                    <div>
                      <h4 className="text-[12px] font-bold uppercase tracking-wider text-slate-600">Regras de reserva</h4>
                      <label className="mt-1 flex min-h-11 cursor-pointer items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={spaceExigeAprovacao}
                          onChange={(e) => setSpaceExigeAprovacao(e.target.checked)}
                          aria-describedby="espaco-aprovacao-ajuda"
                          className="size-5 shrink-0 rounded border-slate-300 text-primary focus:ring-accent-strong"
                        />
                        <span className="text-xs font-semibold text-slate-700">Precisa de aprovação da equipe</span>
                      </label>
                      <p id="espaco-aprovacao-ajuda" className="text-[12px] text-slate-600">
                        Marcado: o pedido fica &quot;Aguardando aprovação&quot; até o Síndico decidir. Desmarcado: a reserva já nasce confirmada.
                      </p>
                      {!spaceExigeAprovacao && (
                        <div className="mt-3 flex items-start gap-2 rounded-xl border border-pendente-200 bg-pendente-50 p-3 text-[12px] text-pendente-900">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-pendente-700" aria-hidden="true" />
                          <span>
                            Atenção: novos pedidos serão confirmados sem passar pela equipe. Reservas que já estão aguardando continuam aguardando.
                            {spaceValorModo !== 'GRATIS' && ' Reservas com valor serão confirmadas sem passar pela equipe, e o síndico combina a cobrança com o morador.'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Valor de uso: a Dona Wanda só calcula e mostra; a cobrança é do síndico, por fora (o banco calcula, 0039) */}
                    <div className="border-t border-slate-100 pt-3">
                      <h4 className="text-[12px] font-bold uppercase tracking-wider text-slate-600">Valor de uso</h4>
                      <p className="mt-1 text-[12px] text-slate-600">A Dona Wanda só calcula e mostra o valor ao morador. A cobrança é feita pelo síndico, por fora.</p>
                      <fieldset className="mt-2">
                        <legend className="text-xs font-semibold text-slate-700">Quando este espaço é pago?</legend>
                        {([
                          ['GRATIS', 'Grátis', 'Qualquer número de pessoas pode usar sem pagar.'],
                          ['FAIXA', 'Grátis até certo número de pessoas', 'Acima desse número, o morador paga.'],
                          ['PAGA', 'Paga em toda reserva', 'O valor vale desde a primeira pessoa, qualquer que seja o número de pessoas.'],
                        ] as const).map(([modo, rotulo, apoio]) => (
                          <label key={modo} className="flex min-h-11 cursor-pointer items-start gap-2.5 py-2">
                            <input
                              type="radio"
                              name="espaco-valor-modo"
                              checked={spaceValorModo === modo}
                              onChange={() => {
                                // Um "0" vindo da regra paga não deve reaparecer como erro no campo de limite.
                                if (modo === 'FAIXA' && spaceFaixaAte === '0') setSpaceFaixaAte('');
                                setSpaceValorModo(modo);
                              }}
                              aria-describedby={`espaco-valor-${modo}-apoio`}
                              className="mt-0.5 size-5 shrink-0 border-slate-300 text-primary focus:ring-accent-strong"
                            />
                            <span>
                              <span className="block text-xs font-semibold text-slate-700">{rotulo}</span>
                              <span id={`espaco-valor-${modo}-apoio`} className="block text-[12px] text-slate-600">{apoio}</span>
                            </span>
                          </label>
                        ))}
                      </fieldset>
                      {spaceValorModo !== 'GRATIS' && (
                        <fieldset className="mt-3">
                          <legend className="text-xs font-semibold text-slate-700">Como o valor é definido?</legend>
                          {([
                            ['FIXO', 'Valor fixo', 'Um valor em reais, igual em todas as reservas.'],
                            ['PERCENTUAL', 'Percentual da cota do condomínio', 'Um percentual da cota mínima. Se a cota mudar, o valor muda nos novos pedidos.'],
                          ] as const).map(([tipo, rotulo, apoio]) => {
                            // Percentual precisa da cota cadastrada. Se o espaço já era percentual e a cota sumiu, o aviso aparece e não deixa salvar.
                            const bloqueado = tipo === 'PERCENTUAL' && !cotaCadastrada;
                            return (
                              <label key={tipo} className={`flex min-h-11 items-start gap-2.5 py-2 ${bloqueado ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                                <input
                                  type="radio"
                                  name="espaco-valor-tipo"
                                  checked={spaceValorTipo === tipo}
                                  disabled={bloqueado && spaceValorTipo !== tipo}
                                  aria-disabled={bloqueado ? 'true' : undefined}
                                  onChange={() => setSpaceValorTipo(tipo)}
                                  aria-describedby={`espaco-valor-${tipo}-apoio${bloqueado ? ' espaco-cota-aviso' : ''}`}
                                  className="mt-0.5 size-5 shrink-0 border-slate-300 text-primary focus:ring-accent-strong"
                                />
                                <span>
                                  <span className="block text-xs font-semibold text-slate-700">{rotulo}</span>
                                  <span id={`espaco-valor-${tipo}-apoio`} className="block text-[12px] text-slate-600">{apoio}</span>
                                </span>
                              </label>
                            );
                          })}
                          {cota.estado === 'carregando' && (
                            <p id="espaco-cota-aviso" aria-live="polite" className="text-[12px] text-slate-600">Verificando a cota do condomínio…</p>
                          )}
                          {cota.estado === 'erro' && (
                            <div id="espaco-cota-aviso" className="flex flex-wrap items-center gap-x-3 text-[12px] text-red-700">
                              <span role="alert">Não foi possível ler a cota agora. Tente de novo. Se preferir, use valor fixo.</span>
                              <button type="button" onClick={() => { setCota({ estado: 'carregando', valor: null }); void carregarCota(); }} className="inline-flex min-h-11 items-center font-semibold text-accent-strong underline underline-offset-2">
                                Tentar de novo
                              </button>
                            </div>
                          )}
                          {cota.estado === 'ok' && cota.valor === null && (
                            <div id="espaco-cota-aviso" className="flex items-start gap-2 rounded-xl border border-pendente-200 bg-pendente-50 p-3 text-[12px] text-pendente-900">
                              <Info className="mt-0.5 h-4 w-4 shrink-0 text-pendente-700" aria-hidden="true" />
                              <span>
                                Para usar percentual, cadastre antes a cota do condomínio.{' '}
                                <Link href="/configuracoes#reservas" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center font-semibold text-accent-strong underline underline-offset-2 sm:min-h-0">
                                  Cadastrar a cota<span className="sr-only"> (abre em outra aba)</span>
                                </Link>
                              </span>
                            </div>
                          )}
                        </fieldset>
                      )}
                      {spaceValorModo !== 'GRATIS' && (
                        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                          {spaceValorModo === 'FAIXA' && (
                            <CampoVeiculo
                              id="espaco-faixa-ate"
                              label="Grátis até (pessoas)"
                              type="text"
                              inputMode="numeric"
                              autoComplete="off"
                              value={spaceFaixaAte}
                              onChange={(e) => setSpaceFaixaAte(e.target.value.replace(/\D/g, '').slice(0, 4))}
                              erro={erroFaixaAte}
                            />
                          )}
                          {usaPercentual ? (
                            <CampoVeiculo
                              id="espaco-faixa-percentual"
                              label={spaceValorModo === 'PAGA' ? 'Percentual da cota (%)' : 'Percentual acima disso (%)'}
                              type="text"
                              inputMode="decimal"
                              autoComplete="off"
                              placeholder="5"
                              maxLength={6}
                              value={spacePercentual}
                              // Só dígitos e um separador decimal (ponto ou vírgula): "7,5" e "7.5" valem; o banco confere de novo (0,01 a 100).
                              onChange={(e) => setSpacePercentual(limparPercentualDigitado(e.target.value))}
                              apoio="Digite 5 para 5% da cota. Pode usar vírgula: 7,5."
                              erro={erroPercentual}
                            />
                          ) : (
                            <CampoVeiculo
                              id="espaco-faixa-valor"
                              label={spaceValorModo === 'PAGA' ? 'Valor (R$)' : 'Valor acima disso (R$)'}
                              type="text"
                              inputMode="decimal"
                              autoComplete="off"
                              prefixo="R$"
                              placeholder="0,00"
                              value={spaceFaixaCentavos ? (Number(spaceFaixaCentavos) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}
                              // Máscara de moeda: só dígitos, lidos como centavos (150,00 = "15000").
                              onChange={(e) => setSpaceFaixaCentavos(e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 9))}
                              apoio="Digite só os números: 15000 = R$ 150,00."
                              erro={erroFaixaValor}
                            />
                          )}
                        </div>
                      )}
                      <p aria-live="polite" className="mt-2 text-xs font-semibold text-slate-900">{previaFaixa}</p>
                      {previaCalculo && (
                        <p aria-live="polite" className="mt-1 text-xs text-slate-700">
                          {previaCalculo}{' '}
                          <Link href="/configuracoes#reservas" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center font-semibold text-accent-strong underline underline-offset-2 sm:min-h-0">
                            Alterar a cota<span className="sr-only"> do condomínio (abre em outra aba)</span>
                          </Link>
                        </p>
                      )}
                      {regraMudou && (
                        <p role="note" className="mt-2 rounded-xl bg-accent-50 px-3 py-2.5 text-[12px] font-semibold text-accent-strong">
                          Mudar a regra vale só para novos pedidos. Reservas já feitas mantêm o valor de quando foram pedidas.
                        </p>
                      )}
                      <p className="mt-1 text-[12px] text-slate-600">A taxa de higienização não entra neste valor.</p>
                    </div>

                    <div className="border-t border-slate-100 pt-3">
                      <label htmlFor="espaco-taxa" className="block text-xs font-semibold text-slate-700">Taxa de Higienização (R$)</label>
                      <input
                        id="espaco-taxa"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0,00"
                        value={spaceTaxaLimpeza}
                        onChange={(e) => setSpaceTaxaLimpeza(e.target.value)}
                        aria-describedby="espaco-taxa-ajuda"
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-strong/30 min-h-11 sm:min-h-0 sm:max-w-48"
                      />
                      <p id="espaco-taxa-ajuda" className="mt-1 text-[12px] text-slate-600">Cobrada à parte, sempre que o espaço é reservado. Deixe em branco ou 0 se não há taxa.</p>
                      {taxaNum === 0 && (
                        <p role="status" className="mt-1 text-[12px] font-semibold text-slate-700">Sem taxa: este espaço será salvo como &quot;Isento&quot;.</p>
                      )}
                    </div>
                  </div>
                </Acordeao>

                {/* Bloqueios: simétricos (marcar de um lado vale para os dois), no mesmo dia, sem cadeia */}
                <Acordeao id="espaco-bloqueios" titulo="Bloqueios entre espaços" resumo={resumoBloqueios} aberto={secoes.bloqueios} onAlternar={() => alternarSecao('bloqueios')}>
                  <p id="espaco-bloqueios-ajuda" className="text-[12px] text-slate-600">
                    Marque os espaços que não podem ser reservados no mesmo dia que este. Vale nos dois sentidos e também para reservas aguardando aprovação.
                  </p>
                  {(() => {
                    if (outrosEspacos.length === 0) {
                      return <p className="mt-2 text-[12px] text-slate-600">Não há outros espaços cadastrados. Quando houver, você poderá marcar aqui os que não podem ser usados no mesmo dia.</p>;
                    }
                    // Aviso para o que acabou de ser marcado e já tem reservas futuras: elas continuam valendo.
                    const avisos = spaceBloqueios
                      .filter((id) => !spaceBloqueiosOriginais.includes(id))
                      .map((id) => ({
                        nome: spaces.find((o) => o.id === id)?.nome ?? '',
                        qtd: reservations.filter((r) => r.espacoId === id && r.data >= hoje && (r.status === 'PENDENTE' || r.status === 'APROVADA')).length,
                      }))
                      .filter((a) => a.nome && a.qtd > 0);
                    return (
                      <>
                        <fieldset aria-describedby="espaco-bloqueios-ajuda" className="mt-1">
                          <legend className="text-xs font-semibold text-slate-700">Espaços que este espaço bloqueia</legend>
                          {outrosEspacos.map((o) => (
                            <label key={o.id} className="flex min-h-11 cursor-pointer items-center gap-2.5">
                              <input
                                type="checkbox"
                                checked={spaceBloqueios.includes(o.id)}
                                onChange={(e) => setSpaceBloqueios((prev) => (e.target.checked ? [...prev, o.id] : prev.filter((id) => id !== o.id)))}
                                className="size-5 shrink-0 rounded border-slate-300 text-primary focus:ring-accent-strong"
                              />
                              <span className="text-xs font-semibold text-slate-700">{o.nome}{o.ativo === false ? ' (em manutenção)' : ''}</span>
                            </label>
                          ))}
                        </fieldset>
                        <div className="space-y-2">
                          {avisos.map((a) => (
                            <div key={a.nome} role="status" className="mt-2 flex items-start gap-2 rounded-xl border border-pendente-200 bg-pendente-50 p-3 text-[12px] text-pendente-900">
                              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-pendente-700" aria-hidden="true" />
                              <span>Atenção: o {a.nome} já tem reservas futuras ({a.qtd}). Elas continuam valendo; o bloqueio só impede novos pedidos nos dias em que já houver reserva em um dos dois espaços.</span>
                            </div>
                          ))}
                        </div>
                      </>
                    );
                  })()}
                </Acordeao>

                {espacoFormError && (
                  <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" aria-hidden="true" />
                    <span>{espacoFormError}</span>
                  </div>
                )}
              </div>

              <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 py-3 sm:px-6">
                {editingSpaceId ? (
                  <button
                    type="button"
                    onClick={handleExcluirEspaco}
                    className="min-h-11 rounded-xl px-3 text-xs font-semibold text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
                  >
                    Excluir espaço
                  </button>
                ) : <span />}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSpaceModal(false)}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 min-h-11 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-hover min-h-11 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {salvandoEspaco ? 'Salvando…' : editingSpaceId ? 'Salvar espaço' : 'Cadastrar espaço'}
                  </button>
                </div>
              </div>
              </fieldset>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
