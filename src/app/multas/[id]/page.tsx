'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { PrintReportHeader } from '@/components/reports/PrintReportHeader';
import { useApp } from '@/context/AppContext';
import { useDialog } from '@/components/ui/DialogProvider';
import { isAdmin } from '@/lib/roles';
import {
  AVISO_MULTA_APAGADA,
  MOTIVO_ANULACAO_MAX,
  MOTIVO_ANULACAO_MIN,
  cargoDeQuemAnulou,
  podeAnularMulta,
  podeApagarMulta,
  rotuloCargoAnulacao,
} from '@/lib/multas';
import type { FineStatus } from '@/types';
import { formatarData, formatarMoeda, situacaoDoPrazo, textoDoPrazo } from '@/lib/formatadores';
import {
  ShieldAlert,
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle,
  Clock, 
  FileText, 
  Send, 
  Check, 
  X, 
  Printer,
  Calendar,
  AlertTriangle,
  Ban,
  Trash2,
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
    judgeFineAppeal,
    annulFine,
    deleteFine
  } = useApp();

  const [textoRecurso, setTextoRecurso] = useState('');
  const [respostaSindico, setRespostaSindico] = useState('');
  const [showRecursoForm, setShowRecursoForm] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [erroJustificativa, setErroJustificativa] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const { confirm, askReason } = useDialog();
  const feedbackRef = useRef<HTMLDivElement>(null);
  const justificativaRef = useRef<HTMLTextAreaElement>(null);
  const recursoTextoRef = useRef<HTMLTextAreaElement>(null);

  // A faixa fica no topo da página; no celular o morador/síndico está lá embaixo, na
  // ação. Traz a faixa para o meio da tela para o resultado não passar despercebido.
  useEffect(() => {
    if (feedbackMsg) feedbackRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [feedbackMsg]);

  // Ao abrir o formulário de recurso (inclusive pela barra fixa do celular), leva o
  // morador até o campo de texto.
  useEffect(() => {
    if (showRecursoForm) recursoTextoRef.current?.focus();
  }, [showRecursoForm]);

  const fine = fines.find((f) => f.id === id);

  if (!fine) {
    // Multa recém-apagada: a navegação para a lista já está em curso.
    if (!currentUser || saindo) return null;
    return (
      <div className="rounded-2xl bg-white p-12 text-center border border-slate-200">
        <h2 className="text-base font-bold text-slate-900">Notificação não encontrada</h2>
        <p className="mt-1 text-xs text-slate-500">O registro solicitado não existe ou foi removido.</p>
        <Link
          href="/multas"
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white"
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
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white"
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
    const res = await submitFineAppeal(fine.id, textoRecurso);
    setFeedbackMsg({ type: res.success ? 'success' : 'error', text: res.message });
    if (res.success) setShowRecursoForm(false);
  };

  const handleJudge = async (deferido: boolean) => {
    if (!respostaSindico.trim()) {
      // Erro ao lado do campo (não na faixa do topo, fora da tela) e foco nele.
      setErroJustificativa(true);
      justificativaRef.current?.focus();
      return;
    }
    // A decisão não tem como ser refeita pelo app: o painel de julgamento some depois
    // de gravada. Por isso a confirmação, com o efeito dito em fatos.
    const ok = await confirm(
      deferido
        ? {
            title: 'Aceitar o recurso e anular a multa?',
            message: 'A multa será anulada e a sua justificativa ficará registrada para o morador. Esta decisão não pode ser desfeita no aplicativo.',
            confirmLabel: 'Aceitar recurso',
          }
        : {
            title: 'Negar o recurso e manter a multa?',
            message: 'A multa continua valendo e a sua justificativa ficará registrada para o morador. Esta decisão não pode ser desfeita no aplicativo.',
            confirmLabel: 'Negar recurso',
          }
    );
    if (!ok) return;
    const res = await judgeFineAppeal(fine.id, deferido, respostaSindico);
    setFeedbackMsg({ type: res.success ? 'success' : 'error', text: res.message });
    if (res.success) setRespostaSindico('');
  };

  const handleAnular = async () => {
    const motivo = await askReason({
      title: 'Anular esta multa?',
      message: 'A multa continua visível para o morador, marcada como anulada, com o motivo que você escrever. A anulação fica registrada com seu nome e a data. Anular não cancela boleto já emitido: se a multa já foi enviada para cobrança, fale com a administradora.',
      label: 'Motivo da anulação',
      placeholder: 'Ex.: a infração não foi confirmada pela administração',
      helperText: `O morador vai ler este texto. Mínimo de ${MOTIVO_ANULACAO_MIN} caracteres.`,
      minLength: MOTIVO_ANULACAO_MIN,
      maxLength: MOTIVO_ANULACAO_MAX,
      requiredMessage: `Escreva pelo menos ${MOTIVO_ANULACAO_MIN} caracteres para explicar o motivo.`,
      confirmLabel: 'Anular multa',
      cancelLabel: 'Voltar',
      loadingLabel: 'Anulando…',
      // Ação com o diálogo aberto: se falhar, o texto digitado fica onde está.
      destructive: false,
      onSubmit: async (texto) => {
        const res = await annulFine(fine.id, texto);
        return res.success ? { ok: true } : { ok: false, message: res.message };
      },
    });
    if (motivo !== null) setFeedbackMsg({ type: 'success', text: 'Multa anulada. O motivo ficou registrado.' });
  };

  const handleApagar = async () => {
    await confirm({
      title: 'Apagar esta multa de vez?',
      message: `A multa ${fine.numeroProtocolo}, do apto ${fine.unidade}, bloco ${fine.bloco}, será apagada junto com recurso, evidências e ciência. O morador deixa de vê-la. Não há como desfazer. Se o objetivo é só cancelar a cobrança, volte e use Anular multa, que mantém o registro.`,
      confirmLabel: 'Apagar definitivamente',
      cancelLabel: 'Voltar',
      loadingLabel: 'Apagando…',
      destructive: true,
      onSubmit: async () => {
        const res = await deleteFine(fine.id);
        if (!res.success) return { ok: false, message: res.message };
        // A multa deixou de existir: o aviso viaja para a lista pela sessão do navegador.
        try { sessionStorage.setItem(AVISO_MULTA_APAGADA, 'Multa apagada.'); } catch { /* sem armazenamento: só não mostra o aviso */ }
        setSaindo(true);
        router.push('/multas');
        return { ok: true };
      },
    });
  };

  if (!currentUser) return null;

  // Texto provisório, a aprovar pelo dono do produto: o app só guarda a data
  // limite, e a regra de quando o prazo começa a contar é jurídica.
  const textoCiencia = `Ao confirmar, você declara que recebeu esta notificação. O prazo para recurso vai até ${formatarData(fine.prazoRecursoData)}.`;
  const anulada = fine.status === 'ANULADA';
  const anulacao = fine.anulacao;
  const precisaCiencia = !fine.ciencia && currentUser.role === 'MORADOR' && !anulada;
  const ehMorador = currentUser.role === 'MORADOR';
  // Mesma regra que já mostra o botão de recurso no corpo da página.
  const podeInterporRecurso = fine.status === 'CIENCIA_REGISTRADA' && ehMorador;
  const situacao = situacaoDaMulta(fine.status, ehMorador);
  // Só importa avisar que o prazo passou enquanto ainda não há recurso nem decisão.
  const prazoSemRecurso = fine.status === 'PENDENTE_CIENCIA' || fine.status === 'CIENCIA_REGISTRADA';
  const podeAnular = podeAnularMulta(currentUser.role, fine);
  const podeApagar = podeApagarMulta(currentUser.role);
  // Recurso que estava em análise quando a multa foi anulada: fica guardado, mas encerrado.
  const recursoEncerrado = anulada && fine.recurso?.status === 'EM_ANALISE';

  return (
    <div className="space-y-6">
      
      {/* Cabeçalho impresso com o Logotipo Oficial */}
      <PrintReportHeader
        titulo={`Auto de Notificação e Infração Disciplinar • ${fine.numeroProtocolo}`}
        subtitulo={`Unidade Notificada: Apto ${fine.unidade} - Bloco ${fine.bloco} • Infrator: ${fine.moradorNome}${anulacao ? ` • MULTA ANULADA em ${formatarData(anulacao.em)}` : ''}`}
      />

      {/* Botão de Retorno e Ações. Celular: "Anular multa" ganha linha própria, de largura total. */}
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <Link
          href="/multas"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Voltar para Lista de Multas</span>
        </Link>

        <div className="contents sm:flex sm:items-center sm:gap-2">
          {podeAnular && (
            <button
              type="button"
              onClick={handleAnular}
              className="order-last flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 sm:order-none sm:w-auto"
            >
              <Ban className="h-4 w-4 text-slate-500" />
              <span>Anular multa</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => window.print()}
            className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 sm:min-h-0"
          >
            <Printer className="h-4 w-4 text-slate-500" />
            <span>Imprimir Notificação Oficial</span>
          </button>
        </div>
      </div>

      {/* Mensagem de Feedback */}
      {feedbackMsg && (
        <div
          ref={feedbackRef}
          role={feedbackMsg.type === 'error' ? 'alert' : 'status'}
          className={`scroll-mt-20 rounded-2xl p-4 text-xs font-semibold flex items-center justify-between no-print ${
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

      {/* Card Principal do Auto de Infração */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
        
        {/* Cabeçalho do Prontuário */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-xl bg-primary px-3 py-1 font-mono text-sm font-bold text-white tracking-wider">
                {fine.numeroProtocolo}
              </span>
              <span
                className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${
                  anulada ? 'bg-slate-100 text-slate-600' : fine.tipo === 'MULTA' ? 'bg-red-100 text-red-800' : 'bg-pendente-100 text-pendente-800'
                }`}
              >
                {fine.tipo === 'MULTA' ? (
                  anulada ? (
                    <span className="line-through">
                      <span className="sr-only">valor anulado: </span>
                      Multa: {formatarMoeda(fine.valor)}
                    </span>
                  ) : `Multa: ${formatarMoeda(fine.valor)}`
                ) : 'Advertência Formal'}
              </span>
              <span className={`${anulada ? 'inline-flex items-center gap-1 ' : ''}whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${situacao.cor}`}>
                {anulada && <Ban className="h-3.5 w-3.5" aria-hidden="true" />}
                {situacao.formal ? (
                  <>
                    <span className="print:hidden">{situacao.texto}</span>
                    <span className="hidden print:inline">{situacao.formal}</span>
                  </>
                ) : (
                  situacao.texto
                )}
              </span>
            </div>

            <h1 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">
              Auto de Constatação de Infração Condominial
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Data de Emissão: {formatarData(fine.dataEmissao)}
              {!anulada && <> • Prazo Limite para Defesa: <strong>{formatarData(fine.prazoRecursoData)}</strong></>}
              {prazoSemRecurso && situacaoDoPrazo(fine.prazoRecursoData) === 'ENCERRADO' && (
                <> • <strong className="text-red-700">{textoDoPrazo(fine.prazoRecursoData)}</strong></>
              )}
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200/80 text-right sm:text-right">
            <span className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Unidade Notificada</span>
            <p className="text-lg font-bold text-primary">
              Apartamento {fine.unidade} - Bloco {fine.bloco}
            </p>
            <p className="text-xs text-slate-600 font-medium">{fine.moradorNome}</p>
          </div>
        </div>

        {/* Multa anulada: o motivo e o aviso da cobrança. Fica na impressão também. */}
        {anulada && anulacao && (
          <section aria-labelledby="multa-anulada-titulo" className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <h2 id="multa-anulada-titulo" className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Ban className="h-4 w-4 text-slate-500" aria-hidden="true" />
              <span>Multa anulada</span>
            </h2>
            {ehMorador ? (
              <p className="mt-2 text-sm leading-relaxed text-slate-700">
                Esta multa foi anulada {cargoDeQuemAnulou(anulacao.porPapel)} em {formatarData(anulacao.em)} e não precisa ser paga.
                {' '}Motivo informado: «{anulacao.motivo}».
              </p>
            ) : (
              <p className="mt-2 text-sm leading-relaxed text-slate-700">
                Anulada por {anulacao.porNome} ({rotuloCargoAnulacao(anulacao.porPapel)}) em {formatarData(anulacao.em)}, às{' '}
                {new Date(anulacao.em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.
                {' '}Motivo: «{anulacao.motivo}».
              </p>
            )}
            {recursoEncerrado && (
              <p className="mt-2 text-sm text-slate-700">
                {ehMorador
                  ? 'O recurso que você enviou foi encerrado porque a multa foi anulada.'
                  : 'Recurso encerrado: multa anulada.'}
              </p>
            )}
            {!ehMorador && (
              <p className="mt-2 text-xs text-slate-600 no-print">
                Anular não cancela boleto já emitido. Se esta multa já foi enviada para cobrança, avise a administradora.
              </p>
            )}
          </section>
        )}

        {/* Artigo e Fato Gerador */}
        <div className="mt-6 space-y-4 text-xs sm:text-sm">
          <div className="rounded-2xl bg-slate-50/80 p-4 border border-slate-200">
            <span className="font-bold text-slate-900 block mb-1 text-xs uppercase tracking-wider text-accent-strong">
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
        {!anulada && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Ciência Formal do Morador:
                </span>
                {fine.ciencia ? (
                  <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Ciência Confirmada</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-pendente-100 px-2.5 py-0.5 text-xs font-bold text-pendente-800">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Aguardando Confirmação</span>
                  </span>
                )}
              </div>

              {fine.ciencia ? (
                <p className="mt-1 text-xs text-slate-600">
                  Registrada em <strong>{formatarData(fine.ciencia.data)}</strong> por <strong>{fine.ciencia.usuarioNome}</strong> ({fine.ciencia.ip})
                </p>
              ) : (
                currentUser.role === 'MORADOR' ? (
                  <p className="mt-1 hidden text-xs text-slate-600 md:block">{textoCiencia}</p>
                ) : (
                  <p className="mt-1 text-xs text-slate-500">
                    O morador deve confirmar ciência para fins de contagem do prazo recursal.
                  </p>
                )
              )}
            </div>

            {/* Ação do Morador: Dar Ciência */}
            {/* No celular a ação fica na barra fixa do fim da página (abaixo). */}
            {!fine.ciencia && currentUser.role === 'MORADOR' && (
              <button
                type="button"
                onClick={handleConfirmScience}
                className="hidden items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold whitespace-nowrap shrink-0 text-white shadow-xs transition hover:bg-primary-hover no-print md:inline-flex"
              >
                <Check className="h-4 w-4" />
                <span>Registrar ciência</span>
              </button>
            )}
          </div>
        </div>
        )}

        {/* FLUXO DE RECURSO / DEFESA ADMINISTRATIVA (some numa multa anulada sem recurso) */}
        {(!anulada || fine.recurso) && (
        <div className="mt-6 border-t border-slate-100 pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Scale className="h-5 w-5 shrink-0 text-accent" />
              <h3 className="text-base font-bold text-slate-900">
                Processo de Defesa & Recurso Administrativo
              </h3>
            </div>

            {podeInterporRecurso && !showRecursoForm && (
              <button
                type="button"
                onClick={() => setShowRecursoForm(true)}
                className="min-h-11 w-full whitespace-nowrap rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-primary-hover no-print sm:w-auto"
              >
                Interpor Recurso Online
              </button>
            )}
          </div>

          {/* Formulário de Recurso para o Morador */}
          {showRecursoForm && (
            <form onSubmit={handleSendAppeal} className="mt-4 rounded-2xl border border-accent-200 bg-accent-50/50 p-5 space-y-3 no-print">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">Redigir Justificativa / Defesa</span>
              </div>

              <label htmlFor="recurso-texto" className="sr-only">Justificativa do recurso</label>
              <textarea
                id="recurso-texto"
                ref={recursoTextoRef}
                rows={4}
                required
                value={textoRecurso}
                onChange={(e) => setTextoRecurso(e.target.value)}
                placeholder="Apresente seus argumentos e motivos para o cancelamento ou relevação da sanção..."
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-strong/30"
              />

              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowRecursoForm(false)}
                  className="flex min-h-11 w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 sm:w-auto"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white transition hover:bg-primary-hover sm:w-auto"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Enviar recurso</span>
                </button>
              </div>
            </form>
          )}

          {/* Exibição do Recurso Protocolado */}
          {fine.recurso ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-bold text-slate-900">
                    Razões do Recurso do Morador ({formatarData(fine.recurso.data)})
                  </span>
                  <span
                    className={`self-start whitespace-nowrap rounded-full px-2.5 py-0.5 font-bold ${
                      fine.recurso.status === 'DEFERIDO'
                        ? 'bg-emerald-100 text-emerald-800'
                        : fine.recurso.status === 'INDEFERIDO'
                        ? 'bg-red-100 text-red-800'
                        : recursoEncerrado
                        ? 'bg-slate-100 text-slate-700'
                        : 'bg-pendente-100 text-pendente-800'
                    }`}
                  >
                    {recursoEncerrado ? 'Encerrado: multa anulada' : rotuloRecurso(fine.recurso.status, ehMorador)}
                  </span>
                </div>
                {ehMorador && fine.recurso.status === 'EM_ANALISE' && !anulada && (
                  <p className="mt-2 text-xs text-slate-600">O síndico vai responder pelo portal.</p>
                )}

                <p className="mt-2 text-xs text-slate-700 leading-relaxed bg-white p-3 rounded-xl border border-slate-200">
                  {fine.recurso.texto}
                </p>

                {fine.recurso.anexoNome && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-accent-strong font-semibold">
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
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs font-bold">
                    <span className={fine.recurso.status === 'DEFERIDO' ? 'text-emerald-900' : 'text-red-900'}>
                      Decisão Administrativa do Síndico ({formatarData(fine.recurso.dataResposta)})
                    </span>
                    <span className={fine.recurso.status === 'DEFERIDO' ? 'text-emerald-800' : 'text-red-800'}>
                      Julgado por: {fine.recurso.analisadoPor}
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-slate-700 leading-relaxed bg-white/90 p-3 rounded-xl border border-slate-200/60">
                    {fine.recurso.resposta}
                  </p>
                </div>
              ) : isAdmin(currentUser.role) && !anulada ? (
                /* Painel de Julgamento para o Síndico */
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 space-y-3 no-print">
                  <h4 className="text-xs font-bold text-primary uppercase tracking-wider">
                    Julgamento Administrativo (Área do Síndico)
                  </h4>
                  <p className="text-xs text-slate-600">
                    Analise os argumentos do condômino e profira o julgamento fundamentado:
                  </p>

                  <label htmlFor="julgamento-resposta" className="block text-xs font-semibold text-slate-700">
                    Justificativa da decisão <span className="text-red-700">(obrigatória)</span>
                  </label>
                  <textarea
                    id="julgamento-resposta"
                    ref={justificativaRef}
                    rows={3}
                    placeholder="Explique o motivo da decisão..."
                    value={respostaSindico}
                    aria-invalid={erroJustificativa}
                    aria-describedby={erroJustificativa ? 'julgamento-erro' : undefined}
                    onChange={(e) => {
                      setRespostaSindico(e.target.value);
                      if (erroJustificativa) setErroJustificativa(false);
                    }}
                    className={`w-full rounded-xl border bg-white p-3 text-xs text-slate-900 focus:outline-none focus:ring-2 ${
                      erroJustificativa
                        ? 'border-red-300 focus:border-red-400 focus:ring-red-300/40'
                        : 'border-slate-200 focus:border-accent-strong focus:ring-accent-strong/30'
                    }`}
                  />
                  {erroJustificativa && (
                    <p id="julgamento-erro" role="alert" className="flex items-center gap-1.5 text-xs font-semibold text-red-700">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>Informe a justificativa da decisão para continuar.</span>
                    </p>
                  )}

                  {/* Os dois botões têm o mesmo peso visual: a decisão não deve ser empurrada por cor. */}
                  <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={() => handleJudge(true)}
                      className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-800 transition hover:bg-slate-50 sm:w-auto"
                    >
                      <Check className="h-4 w-4 text-emerald-600" />
                      <span>Aceitar recurso (anular multa)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleJudge(false)}
                      className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-800 transition hover:bg-slate-50 sm:w-auto"
                    >
                      <X className="h-4 w-4 text-red-600" />
                      <span>Negar recurso (manter multa)</span>
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
        )}

      </div>

      {/* Só o ADM apaga. Separado do Anular, no fim da página, para não ser tocado por engano. */}
      {podeApagar && (
        <section aria-labelledby="apagar-multa-titulo" className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-4 no-print sm:mt-6">
          <h2 id="apagar-multa-titulo" className="text-sm font-bold text-red-900">Apagar multa</h2>
          <p className="mt-1 text-xs text-red-900/80">
            Remove a multa e todo o seu histórico, de forma definitiva. Para apenas cancelar a cobrança, use Anular multa.
          </p>
          <button
            type="button"
            onClick={handleApagar}
            className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-300 bg-white px-4 py-2 text-xs font-bold text-red-700 transition hover:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 sm:w-auto"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            <span>Apagar multa…</span>
          </button>
        </section>
      )}


      {/* Celular: a ação do morador fica sempre à vista, sem precisar rolar até o fim. */}
      {precisaCiencia && (
        <div className="sticky bottom-0 z-30 -mx-4 border-t border-border bg-surface px-4 py-3 shadow-md no-print md:hidden">
          <p className="mb-2 text-xs leading-snug text-slate-600">{textoCiencia}</p>
          <button
            type="button"
            onClick={handleConfirmScience}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white transition hover:bg-primary-hover"
          >
            <Check className="h-4 w-4" />
            <span>Registrar ciência</span>
          </button>
        </div>
      )}

      {/* Celular: enquanto o recurso é possível, o caminho fica sempre à vista. */}
      {podeInterporRecurso && !showRecursoForm && (
        <div className="sticky bottom-0 z-30 -mx-4 border-t border-border bg-surface px-4 py-3 shadow-md no-print md:hidden">
          <p className="mb-2 text-xs leading-snug text-slate-600">
            <strong>{textoDoPrazo(fine.prazoRecursoData)}</strong>
          </p>
          <button
            type="button"
            onClick={() => setShowRecursoForm(true)}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white transition hover:bg-primary-hover"
          >
            <Scale className="h-4 w-4" />
            <span>Contestar esta multa</span>
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Selo único de situação da multa, derivado do status que já existe. O morador lê
 * "aceito/negado"; síndico e conselho (e a impressão) mantêm o termo formal.
 */
function situacaoDaMulta(status: FineStatus, ehMorador: boolean): { texto: string; formal?: string; cor: string } {
  switch (status) {
    case 'PENDENTE_CIENCIA':
      return { texto: 'Aguardando ciência', cor: 'bg-pendente-100 text-pendente-800' };
    case 'CIENCIA_REGISTRADA':
      return { texto: 'Ciência registrada', cor: 'bg-emerald-100 text-emerald-800' };
    case 'EM_RECURSO':
      return { texto: 'Recurso em análise', cor: 'bg-pendente-100 text-pendente-800' };
    case 'RECURSO_DEFERIDO':
      return ehMorador
        ? { texto: 'Recurso aceito (multa anulada)', formal: 'Recurso deferido (multa anulada)', cor: 'bg-emerald-100 text-emerald-800' }
        : { texto: 'Recurso deferido (multa anulada)', cor: 'bg-emerald-100 text-emerald-800' };
    case 'RECURSO_INDEFERIDO':
      return ehMorador
        ? { texto: 'Recurso negado (multa mantida)', formal: 'Recurso indeferido (multa mantida)', cor: 'bg-red-100 text-red-800' }
        : { texto: 'Recurso indeferido (multa mantida)', cor: 'bg-red-100 text-red-800' };
    case 'ANULADA':
      return { texto: 'Multa anulada', cor: 'bg-slate-100 text-slate-700' };
    default:
      return { texto: 'Encerrada', cor: 'bg-slate-100 text-slate-700' };
  }
}

/** Resultado do recurso: o morador lê "aceito/negado"; a impressão e a equipe, o termo formal. */
function rotuloRecurso(status: 'EM_ANALISE' | 'DEFERIDO' | 'INDEFERIDO', ehMorador: boolean): React.ReactNode {
  if (status === 'EM_ANALISE') return 'Em análise pelo síndico';
  const formal = status === 'DEFERIDO' ? 'Deferido' : 'Indeferido';
  if (!ehMorador) return formal;
  return (
    <>
      <span className="print:hidden">{status === 'DEFERIDO' ? 'Recurso aceito' : 'Recurso negado'}</span>
      <span className="hidden print:inline">{formal}</span>
    </>
  );
}
