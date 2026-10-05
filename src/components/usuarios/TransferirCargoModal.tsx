'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Search, UserPlus, X } from 'lucide-react';
import { useApp, type ResultadoTransferirCargo } from '@/context/AppContext';
import { CampoVeiculo, classeCampoVeiculo } from '@/components/ui/CampoVeiculo';
import { ROLE_LABELS_CURTO } from '@/lib/roles';
import {
  CARGO_ROTULO,
  PERFIS_DESTINO,
  confirmacaoValida,
  ehEmailValido,
  exigeDigitarTransferir,
  podeTransferirCargo,
  type CargoTransferivel,
} from '@/lib/cargos';
import { useEscapeToClose } from '@/lib/useEscapeToClose';
import { useModalFocus } from '@/lib/useModalFocus';
import type { User } from '@/types';

type Sucesso = Extract<ResultadoTransferirCargo, { success: true }>;

interface Props {
  cargo: CargoTransferivel;
  /** Quando o assistente abre a partir do cartão do cargo único, a origem já é conhecida. */
  origemInicialId?: string;
  onClose: () => void;
  onConcluido: (resultado: Sucesso) => void;
  /** "Ver convite": fecha o assistente e leva ao cartão da pendência. */
  onVerConvite: () => void;
}

const sem = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const PODERES: Record<CargoTransferivel, string> = {
  SINDICO: 'O Síndico valida cadastros, emite multas e vê dados dos moradores.',
  SUBSINDICO: 'O Subsíndico tem os mesmos poderes do Síndico: valida cadastros, emite multas e vê dados dos moradores.',
  CONSELHO: 'O Conselho acompanha relatórios, multas e o histórico.',
  PORTARIA: 'A Portaria busca placas e registra pedidos de reserva.',
};

type ErroTopo = { texto: string; acao?: 'tentar' | 'recomecar' | 'ver' | 'fechar' };

/**
 * Assistente "Transferir cargo" (issue #53), três passos: quem assume, o que acontece com quem sai,
 * revisar e confirmar. Modal no computador; folha de baixo no celular. Toda a decisão de verdade
 * é do servidor e do banco: aqui só se evita o erro óbvio e se explica o resultado antes de confirmar.
 */
export function TransferirCargoModal({ cargo, origemInicialId, onClose, onConcluido, onVerConvite }: Props) {
  const { currentUser, systemUsers, pendingInvites, units, transferenciasCargo, transferirCargo, recarregarDados } = useApp();

  const [passo, setPasso] = useState<1 | 2 | 3>(1);
  const titulares = systemUsers.filter((u) => u.role === cargo);
  const pendentesDoCargo = transferenciasCargo.filter((t) => t.status === 'PENDENTE' && t.cargo === cargo);
  const origensPossiveis = titulares.filter(
    (u) => !pendentesDoCargo.some((t) => t.origemId === u.id) && !!currentUser && podeTransferirCargo(currentUser.role, cargo, u.id, currentUser.id),
  );
  const [origemId, setOrigemId] = useState(origemInicialId ?? (origensPossiveis.length === 1 ? origensPossiveis[0].id : ''));
  const [modo, setModo] = useState<'EXISTENTE' | 'NOVO'>('EXISTENTE');
  const [busca, setBusca] = useState('');
  const [destinoId, setDestinoId] = useState('');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [erros, setErros] = useState<{ origem?: string; destino?: string; nome?: string; email?: string }>({});
  const [contaDoEmail, setContaDoEmail] = useState<User | null>(null);
  const [confirmacao, setConfirmacao] = useState('');
  const [erroConfirmacao, setErroConfirmacao] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erroTopo, setErroTopo] = useState<ErroTopo | null>(null);

  const tituloRef = useRef<HTMLHeadingElement>(null);
  const erroRef = useRef<HTMLDivElement>(null);
  const voltarRef = useRef<HTMLButtonElement>(null);
  const confirmacaoRef = useRef<HTMLInputElement>(null);

  const fechar = () => { if (!enviando) onClose(); };
  useEscapeToClose(true, fechar);
  useModalFocus(true);

  // A cada passo o foco vai para o título (o leitor de tela anuncia o passo); no resumo de Conselho/Portaria,
  // que não pede a palavra, o foco inicial é em "Voltar" para o Enter não confirmar sem querer.
  useEffect(() => {
    if (passo === 3 && !exigeDigitarTransferir(cargo)) {
      voltarRef.current?.focus();
      return;
    }
    const t = tituloRef.current;
    if (t) { t.tabIndex = -1; t.focus(); }
  }, [passo, cargo]);

  // Depois de um erro do servidor o botão que tinha o foco sai do ar (desabilitado ou trocado): leva o foco ao aviso.
  useEffect(() => {
    if (erroTopo) erroRef.current?.focus();
  }, [erroTopo]);

  if (!currentUser) return null;

  const rotulo = CARGO_ROTULO[cargo];
  const origem = systemUsers.find((u) => u.id === origemId);
  const origemTemUnidade = !!origem && units.some((u) => u.usuarioId === origem.id);

  const destinosPendentes = new Set(transferenciasCargo.filter((t) => t.status === 'PENDENTE').map((t) => t.destinoId));
  const candidatos = systemUsers
    .filter(
      (u) =>
        PERFIS_DESTINO.includes(u.role) &&
        u.cadastroValidado !== false &&
        u.id !== origemId &&
        u.id !== currentUser.id &&
        !destinosPendentes.has(u.id),
    )
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  const termo = sem(busca.trim());
  const resultados = termo ? candidatos.filter((u) => sem(`${u.name} ${u.email}`).includes(termo)) : candidatos;
  const destinoSel = modo === 'EXISTENTE' ? candidatos.find((u) => u.id === destinoId) : undefined;
  const destinoNomeFinal = modo === 'EXISTENTE' ? destinoSel?.name ?? '' : nome.trim();

  const focarId = (id: string) => requestAnimationFrame(() => document.getElementById(id)?.focus());

  // ── Passo 1 ──
  const validarPasso1 = (): boolean => {
    const novos: typeof erros = {};
    let primeiro = '';
    if (!origem) {
      novos.origem = 'Escolha de quem é o cargo.';
      primeiro ||= 'transferir-origem';
    }
    if (modo === 'EXISTENTE') {
      if (!destinoSel) {
        novos.destino = 'Escolha quem vai assumir o cargo.';
        primeiro ||= 'transferir-busca';
      }
    } else {
      if (nome.trim().length < 3) {
        novos.nome = 'Escreva o nome completo.';
        primeiro ||= 'transferir-nome';
      }
      const em = email.trim().toLowerCase();
      if (!ehEmailValido(em)) {
        novos.email = 'Esse e-mail parece incompleto. Exemplo: nome@dominio.com.';
        setContaDoEmail(null);
        primeiro ||= 'transferir-email';
      } else {
        const conta = systemUsers.find((u) => u.email.toLowerCase() === em);
        if (conta) {
          novos.email = `Esse e-mail já tem conta. Use “Usuário já cadastrado” e escolha ${conta.name}.`;
          setContaDoEmail(conta);
          primeiro ||= 'transferir-email';
        } else if (pendingInvites.some((i) => i.email.toLowerCase() === em)) {
          novos.email = 'Já existe um convite para este e-mail. Cancele-o na fila ou escolha outro e-mail.';
          setContaDoEmail(null);
          primeiro ||= 'transferir-email';
        } else {
          setContaDoEmail(null);
        }
      }
    }
    setErros(novos);
    if (primeiro) focarId(primeiro);
    return !primeiro;
  };

  const continuar = () => {
    setErroTopo(null);
    if (passo === 1) {
      if (validarPasso1()) setPasso(2);
    } else if (passo === 2) {
      setPasso(3);
    }
  };

  const voltar = () => {
    setErroTopo(null);
    if (passo === 1) return fechar();
    setPasso(passo === 3 ? 2 : 1);
  };

  const usarConta = (conta: User) => {
    setModo('EXISTENTE');
    setBusca('');
    setErros({});
    if (candidatos.some((c) => c.id === conta.id)) {
      setDestinoId(conta.id);
      focarId(`transferir-destino-${conta.id}`);
    } else {
      setDestinoId('');
      setErros({ destino: `${conta.name} não pode receber esse cargo agora. Escolha outra pessoa.` });
    }
  };

  // ── Passo 3 ──
  const confirmar = async () => {
    if (enviando || !origem) return;
    if (exigeDigitarTransferir(cargo) && !confirmacaoValida(confirmacao)) {
      setErroConfirmacao('Digite TRANSFERIR para confirmar.');
      confirmacaoRef.current?.focus();
      return;
    }
    setErroConfirmacao('');
    setErroTopo(null);
    setEnviando(true);
    const r = await transferirCargo({
      cargo,
      origemId: origem.id,
      destino: modo === 'EXISTENTE'
        ? { tipo: 'EXISTENTE', id: destinoId }
        : { tipo: 'NOVO', nome: nome.trim(), email: email.trim(), telefone: telefone.trim() || undefined },
    });
    setEnviando(false);
    if (r.success) {
      onConcluido(r);
      return;
    }
    switch (r.codigo) {
      case 'origem_desatualizada':
        setErroTopo({ texto: r.message, acao: 'recomecar' });
        break;
      case 'destino_invalido':
        setErroTopo({ texto: r.message });
        setDestinoId('');
        setPasso(1);
        break;
      case 'pendencia_existente':
        setErroTopo({ texto: r.message, acao: 'ver' });
        break;
      case 'email_com_conta':
      case 'convite_existente': {
        const conta = r.contaId ? systemUsers.find((u) => u.id === r.contaId) ?? null : null;
        setContaDoEmail(r.codigo === 'email_com_conta' ? conta : null);
        setErros({ email: r.message });
        setPasso(1);
        focarId('transferir-email');
        break;
      }
      case 'sem_permissao':
        setErroTopo({ texto: r.message, acao: 'fechar' });
        break;
      default:
        setErroTopo({ texto: r.message, acao: 'tentar' });
    }
  };

  const recomecar = async () => {
    await recarregarDados();
    onClose();
  };

  // ── Textos ──
  const origem1 = origem ? origem.name : '';
  const destino1 = destinoNomeFinal;
  const troca = modo === 'EXISTENTE' && cargo === 'SINDICO' && destinoSel?.role === 'SUBSINDICO';

  const textoOrigem = !origem
    ? ''
    : troca
      ? `${origem.name} passa a ser Subsíndico. Perde o poder de Síndico e fica com os de Subsíndico.`
      : `${modo === 'NOVO' ? `Quando ${destino1} aceitar o convite: ` : ''}${cargo === 'CONSELHO' || cargo === 'PORTARIA' ? `${origem.name} deixa de ser ${rotulo}. ` : ''}${origem.name} passa a ser Morador. Perde só o poder do cargo.${
          origemTemUnidade ? '' : ` ${origem1} ficará só com o acesso básico até alguém ligar uma unidade.`
        }`;

  let avisoDestino = '';
  if (modo === 'EXISTENTE' && destinoSel && destinoSel.role !== 'MORADOR') {
    const atual = ROLE_LABELS_CURTO[destinoSel.role];
    if (troca) {
      avisoDestino = `${destino1} hoje é Subsíndico. Os dois trocam de lugar: ${destino1} vira Síndico e ${origem1} vira Subsíndico.`;
    } else if (destinoSel.role === 'SUBSINDICO') {
      avisoDestino = `${destino1} hoje é Subsíndico. Ao assumir como ${rotulo}, deixa de ser Subsíndico e o cargo de Subsíndico fica vago.`;
    } else {
      avisoDestino = `${destino1} hoje é ${atual}. Ao assumir como ${rotulo}, deixa de ser ${atual}.`;
    }
  }

  const executorEhOrigem = currentUser.id === origemId;
  const linhaExecutor = executorEhOrigem && modo === 'EXISTENTE'
    ? troca
      ? 'Você passa a ser Subsíndico.'
      : `Você perde os poderes de ${rotulo} ao confirmar.`
    : currentUser.role === 'ADM'
      ? 'Você continua como Administradora.'
      : `Você continua como ${ROLE_LABELS_CURTO[currentUser.role]}${executorEhOrigem ? ' até o convite ser aceito' : ''}.`;

  const titulos: Record<1 | 2 | 3, string> = {
    1: 'Quem vai assumir o cargo?',
    2: origem ? `O que acontece com ${origem1}?` : 'O que acontece com quem sai?',
    3: 'Revise e confirme',
  };
  const perigoso = exigeDigitarTransferir(cargo);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-xs sm:items-center sm:p-4">
      <div className="fixed inset-0" onClick={fechar} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="transferir-cargo-titulo"
        aria-busy={enviando}
        className="relative flex max-h-[90dvh] w-full flex-col rounded-t-2xl bg-white shadow-2xl sm:max-w-lg sm:rounded-2xl"
      >
        {/* Cabeçalho: passo, barra fina e fechar */}
        <div className="px-5 pb-3 pt-4 sm:px-6">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-slate-500">
                Transferir cargo de {rotulo} · Passo {passo} de 3
              </p>
              <h2 id="transferir-cargo-titulo" ref={tituloRef} className="mt-1 text-lg font-bold text-slate-900 outline-none">
                {titulos[passo]}
              </h2>
            </div>
            <button
              type="button"
              onClick={fechar}
              disabled={enviando}
              aria-label="Fechar"
              className="-mr-2 -mt-1 flex size-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
            <div className="h-full rounded-full bg-accent-strong transition-all motion-reduce:transition-none" style={{ width: `${(passo / 3) * 100}%` }} />
          </div>
        </div>

        {/* Corpo */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-4 sm:px-6" aria-live="polite">
          {erroTopo && (
            <div role="alert" ref={erroRef} tabIndex={-1} className="rounded-xl bg-red-50 outline-none p-3 text-xs font-semibold text-red-900">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
                <span>{erroTopo.texto}</span>
              </div>
              {erroTopo.acao && erroTopo.acao !== 'fechar' && (
                <button
                  type="button"
                  onClick={erroTopo.acao === 'tentar' ? confirmar : erroTopo.acao === 'ver' ? onVerConvite : recomecar}
                  className="mt-2 flex min-h-11 items-center rounded-lg border border-red-300 bg-white px-3 text-xs font-semibold text-red-900 hover:bg-red-100"
                >
                  {erroTopo.acao === 'tentar' ? 'Tentar de novo' : erroTopo.acao === 'ver' ? 'Ver convite' : 'Recomeçar'}
                </button>
              )}
            </div>
          )}

          {enviando && (
            <p role="status" className="text-xs font-semibold text-slate-700">Transferindo o cargo, aguarde</p>
          )}

          {passo === 1 && (
            <div className="space-y-4">
              {!origemInicialId && origensPossiveis.length !== 1 && (
                <div>
                  <label htmlFor="transferir-origem" className="block text-xs font-semibold text-slate-700">De quem?</label>
                  <select
                    id="transferir-origem"
                    value={origemId}
                    onChange={(e) => { setOrigemId(e.target.value); setDestinoId(''); setErros({}); }}
                    aria-invalid={erros.origem ? 'true' : undefined}
                    aria-describedby={erros.origem ? 'transferir-origem-erro' : undefined}
                    className={classeCampoVeiculo(erros.origem)}
                  >
                    <option value="">Escolha quem tem o cargo de {rotulo}</option>
                    {origensPossiveis.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                  {erros.origem && (
                    <p id="transferir-origem-erro" role="alert" className="mt-1 text-xs font-semibold text-red-700">{erros.origem}</p>
                  )}
                </div>
              )}
              {origem && (
                <p className="text-xs text-slate-600">
                  Hoje o {rotulo} é <strong className="text-slate-900">{origem.name}</strong>.
                </p>
              )}

              <fieldset>
                <legend className="text-xs font-semibold text-slate-700">Quem recebe o cargo</legend>
                <div role="radiogroup" aria-label="Quem recebe o cargo" className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {([
                    ['EXISTENTE', 'Usuário já cadastrado'],
                    ['NOVO', 'Convidar nova pessoa'],
                  ] as const).map(([valor, texto]) => (
                    <label
                      key={valor}
                      className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-xs font-semibold ${
                        modo === valor ? 'border-accent-strong bg-accent-50 text-slate-900' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="transferir-modo"
                        checked={modo === valor}
                        disabled={enviando}
                        onChange={() => { setModo(valor); setErros({}); }}
                        className="size-4 accent-accent-strong"
                      />
                      {texto}
                    </label>
                  ))}
                </div>
              </fieldset>

              {modo === 'EXISTENTE' ? (
                <div className="space-y-3">
                  <div>
                    <label htmlFor="transferir-busca" className="block text-xs font-semibold text-slate-700">Buscar por nome ou e-mail</label>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 mt-0.5 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                      <input
                        id="transferir-busca"
                        type="search"
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                        autoComplete="off"
                        aria-invalid={erros.destino ? 'true' : undefined}
                        aria-describedby={erros.destino ? 'transferir-destino-erro' : undefined}
                        className={`${classeCampoVeiculo(erros.destino)} pl-9`}
                      />
                    </div>
                    {erros.destino && (
                      <p id="transferir-destino-erro" role="alert" className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-red-700">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        {erros.destino}
                      </p>
                    )}
                  </div>

                  {resultados.length === 0 ? (
                    <div role="status" className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                      <p>
                        {termo
                          ? <>Nenhum resultado para “{busca.trim()}”. Confira o nome ou e-mail, ou convide uma nova pessoa.</>
                          : 'Ninguém disponível. Convide uma nova pessoa.'}
                      </p>
                      <button
                        type="button"
                        onClick={() => { setModo('NOVO'); setErros({}); focarId('transferir-nome'); }}
                        className="mt-2 flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                      >
                        <UserPlus className="h-4 w-4" aria-hidden="true" />
                        Convidar nova pessoa
                      </button>
                    </div>
                  ) : (
                    <fieldset>
                      <legend className="text-xs font-semibold text-slate-700">Quem vai assumir</legend>
                      <div className="mt-2 max-h-64 space-y-2 overflow-y-auto pr-0.5">
                        {resultados.map((u) => (
                          <label
                            key={u.id}
                            htmlFor={`transferir-destino-${u.id}`}
                            className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 ${
                              destinoId === u.id ? 'border-accent-strong bg-accent-50' : 'border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <input
                              id={`transferir-destino-${u.id}`}
                              type="radio"
                              name="transferir-destino"
                              checked={destinoId === u.id}
                              disabled={enviando}
                              onChange={() => { setDestinoId(u.id); setErros({}); }}
                              className="size-4 shrink-0 accent-accent-strong"
                            />
                            <span className="min-w-0">
                              <span className="block truncate text-xs font-bold text-slate-900">{u.name}</span>
                              <span className="block truncate text-[12px] text-slate-600">
                                {ROLE_LABELS_CURTO[u.role]}
                                {u.unidade ? ` · Apto ${u.unidade}-${u.bloco}` : ''}
                              </span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <CampoVeiculo
                    id="transferir-nome"
                    label="Nome completo"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    autoComplete="off"
                    erro={erros.nome}
                    disabled={enviando}
                  />
                  <div>
                    <CampoVeiculo
                      id="transferir-email"
                      label="E-mail"
                      type="email"
                      inputMode="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="off"
                      erro={erros.email}
                      disabled={enviando}
                    />
                    {contaDoEmail && (
                      <button
                        type="button"
                        onClick={() => usarConta(contaDoEmail)}
                        className="mt-1 flex min-h-11 items-center text-xs font-semibold text-accent-strong underline underline-offset-2"
                      >
                        Escolher {contaDoEmail.name}
                      </button>
                    )}
                  </div>
                  <CampoVeiculo
                    id="transferir-telefone"
                    label="Telefone (opcional)"
                    type="tel"
                    inputMode="tel"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    autoComplete="off"
                    disabled={enviando}
                    apoio={`A pessoa recebe um link de acesso e já entra com o cargo de ${rotulo}.`}
                  />
                </div>
              )}
            </div>
          )}

          {passo === 2 && origem && (
            <div className="space-y-3">
              <p className="text-sm text-slate-800">{textoOrigem}</p>
              {avisoDestino && (
                <div role="note" className="flex items-start gap-2 rounded-xl border border-pendente-200 bg-pendente-50 p-3 text-xs font-semibold text-pendente-900">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-pendente-700" aria-hidden="true" />
                  <span>{avisoDestino}</span>
                </div>
              )}
              {modo === 'NOVO' && (
                <p className="text-xs text-slate-600">
                  {origem1} continua no cargo de {rotulo} até {destino1} aceitar o convite. Só então a troca acontece.
                </p>
              )}
            </div>
          )}

          {passo === 3 && origem && (
            <div className="space-y-4">
              <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
                <p className="font-semibold text-slate-900">
                  Você vai transferir o cargo de {rotulo} de {origem.name} para {destinoNomeFinal}.
                </p>
                {modo === 'EXISTENTE' ? (
                  <>
                    <p>{textoOrigem}</p>
                    {avisoDestino && <p>{avisoDestino}</p>}
                  </>
                ) : (
                  <p>
                    {destino1} ainda não tem conta. Enviaremos o convite com o cargo de {rotulo}. Até aceitar, {origem1} continua no cargo de {rotulo}.
                  </p>
                )}
                <p>{linhaExecutor}</p>
                <p className="text-xs text-slate-600">{PODERES[cargo]}</p>
              </div>

              {perigoso && (
                <div>
                  <label htmlFor="transferir-confirmacao" className="block text-xs font-semibold text-slate-700">Digite TRANSFERIR para confirmar</label>
                  <input
                    id="transferir-confirmacao"
                    ref={confirmacaoRef}
                    type="text"
                    value={confirmacao}
                    onChange={(e) => { setConfirmacao(e.target.value); setErroConfirmacao(''); }}
                    autoComplete="off"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    disabled={enviando}
                    aria-invalid={erroConfirmacao ? 'true' : undefined}
                    aria-describedby={erroConfirmacao ? 'transferir-confirmacao-erro' : undefined}
                    className={classeCampoVeiculo(erroConfirmacao)}
                  />
                  {erroConfirmacao && (
                    <p id="transferir-confirmacao-erro" role="alert" className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-red-700">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      {erroConfirmacao}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rodapé fixo: no celular, o botão principal fica em cima */}
        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:flex-row sm:justify-end sm:px-6">
          <button
            type="button"
            ref={voltarRef}
            onClick={voltar}
            disabled={enviando}
            className="flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-40"
          >
            {passo === 1 ? 'Cancelar' : 'Voltar'}
          </button>
          {passo < 3 ? (
            <button
              type="button"
              onClick={continuar}
              disabled={enviando}
              className="flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-xs font-semibold text-white hover:bg-primary-hover disabled:opacity-40"
            >
              Continuar
            </button>
          ) : (
            <button
              type="button"
              onClick={confirmar}
              aria-disabled={enviando || (perigoso && !confirmacaoValida(confirmacao))}
              className={`flex min-h-11 items-center justify-center rounded-xl px-4 text-xs font-semibold text-white aria-disabled:opacity-60 ${
                perigoso ? 'bg-red-700 hover:bg-red-800' : 'bg-primary hover:bg-primary-hover'
              }`}
            >
              {enviando ? 'Transferindo…' : 'Transferir cargo'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
