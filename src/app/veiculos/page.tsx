'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { PrintReportHeader } from '@/components/reports/PrintReportHeader';
import { useDialog } from '@/components/ui/DialogProvider';
import { useApp, type ResultadoSalvarVeiculo } from '@/context/AppContext';
import { TipoVeiculo, Vehicle } from '@/types';
import { isAdmin, isProvisorio } from '@/lib/roles';
import { AguardandoValidacao } from '@/components/autocadastro/AguardandoValidacao';
import { useEscapeToClose } from '@/lib/useEscapeToClose';
import { useModalFocus } from '@/lib/useModalFocus';
import { TipoVeiculoSelector, idPrimeiroTipoVeiculo } from '@/components/ui/TipoVeiculoSelector';
import { TipoVeiculoBadge } from '@/components/ui/TipoVeiculoBadge';
import { CampoVeiculo, classeCampoVeiculo } from '@/components/ui/CampoVeiculo';
import { TIPOS_VEICULO } from '@/lib/tiposVeiculo';
import { filtrarVeiculos, formatarTelefone, hrefTelefone, ordenarVeiculos, textoContagem, type ColunaOrdem } from '@/lib/veiculosLista';
import { CartaoVeiculo } from '@/components/veiculos/CartaoVeiculo';
import { FolhaVeiculo } from '@/components/veiculos/FolhaVeiculo';
import { AJUDA_PLACA, MENSAGEM_PLACA_INVALIDA, normalizarPlacaDigitada, placaValida } from '@/lib/placa';
import {
  Car,
  Search,
  Plus,
  ShieldCheck,
  Phone,
  Trash2,
  Printer,
  X,
  CheckCircle2,
  AlertTriangle,
  Pencil,
  Info,
  ChevronUp,
  ChevronDown
} from 'lucide-react';

const CHAVE_FAIXA_OUTRO = 'harmony:faixa-tipo-outro-fechada';

type ErrosForm = { placa?: string; tipo?: string; marca?: string; modelo?: string; unidade?: string; proprietario?: string };
const MSG_PLACA_DUPLICADA = 'Esta placa já está cadastrada.';
const MSG_ERRO_SERVIDOR = 'Não foi possível salvar. Verifique a conexão e tente de novo.';
const MSG_ERRO_REMOVER = 'Não foi possível remover o veículo. Verifique a conexão e tente de novo.';
const rotuloUnidade = (v: { bloco: string; unidade: string }) => `${v.bloco}-${v.unidade}`;

export default function VeiculosPage() {
  return (
    <AppShell>
      <VeiculosContent />
    </AppShell>
  );
}

function VeiculosContent() {
  const { currentUser, vehicles, addVehicle, deleteVehicle, atualizarVeiculo, units, isLoading, veiculosStatus, recarregarVeiculos, unidadesProntas } = useApp();
  const { confirm } = useDialog();
  const [searchTerm, setSearchTerm] = useState('');
  // Um só formulário para cadastrar e editar: null = fechado.
  const [formulario, setFormulario] = useState<{ modo: 'novo' } | { modo: 'editar'; veiculo: Vehicle } | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const focarFeedback = useRef(false);

  // Form states
  const [placa, setPlaca] = useState('');
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [cor, setCor] = useState('');
  const [bloco, setBloco] = useState(currentUser?.bloco || 'A');
  // Fica vazio (não um exemplo tipo '101') quando o usuário logado não tem
  // unidade própria (Síndico/ADM/Portaria/Conselho) — um valor de exemplo
  // pré-preenchido engana quem digita por cima sem apagar antes, concatenando
  // o texto digitado com o exemplo em vez de substituí-lo.
  const [unidade, setUnidade] = useState(currentUser?.unidade || '');
  const [vaga, setVaga] = useState('');
  // Só o morador cadastra o veículo dele mesmo (nome e telefone vêm do perfil). Quem é
  // da equipe (Portaria, Síndico...) cadastra o de outra pessoa: começa vazio, senão o
  // nome do porteiro seria salvo como dono do veículo por engano.
  const [proprietarioNome, setProprietarioNome] = useState(currentUser?.role === 'MORADOR' ? currentUser.name : '');
  const [telefoneContato, setTelefoneContato] = useState(currentUser?.role === 'MORADOR' ? currentUser.telefone || '' : '');
  const [status, setStatus] = useState<'ATIVO' | 'VISITANTE'>('ATIVO');
  // Sem pré-seleção: '' até a pessoa escolher.
  const [tipoVeiculo, setTipoVeiculo] = useState<TipoVeiculo | ''>('');
  const [erros, setErros] = useState<ErrosForm>({});
  const [erroServidor, setErroServidor] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'TODOS' | TipoVeiculo>('TODOS');
  // Ordem da tabela (desktop): coluna clicada; sem coluna = bloco, apartamento e placa.
  const [ordem, setOrdem] = useState<{ coluna: ColunaOrdem | null; desc: boolean }>({ coluna: null, desc: false });
  // Folha de detalhes (celular) e o botão que a abriu: o foco volta a ele ao fechar (no Safari o toque não foca o botão).
  const [aberto, setAberto] = useState<Vehicle | null>(null);
  const gatilhoRef = useRef<HTMLElement | null>(null);
  const buscaRef = useRef<HTMLInputElement>(null);
  // Fechar a faixa vale só neste navegador (sem estado "pendente" no banco).
  const [faixaFechada, setFaixaFechada] = useState(() => {
    try {
      return typeof window !== 'undefined' && window.localStorage.getItem(CHAVE_FAIXA_OUTRO) === '1';
    } catch {
      return false;
    }
  });

  // Durante o salvamento o formulário não fecha (nem por Esc, X, fundo ou Cancelar).
  const fecharFormulario = () => { if (!isSaving) setFormulario(null); };
  useEscapeToClose(formulario !== null && !isSaving, () => setFormulario(null));
  useModalFocus(formulario !== null);

  // O perfil do usuário carrega de forma assíncrona — se o componente monta
  // antes disso, o useState inicial fica preso vazio/'A'. Sincroniza assim
  // que os dados reais do morador chegam.
  useEffect(() => {
    if (currentUser?.unidade) setUnidade(currentUser.unidade);
    if (currentUser?.bloco) setBloco(currentUser.bloco);
  }, [currentUser?.unidade, currentUser?.bloco]);

  // Depois de salvar, o foco vai para o cartão de resultado: a linha editada pode sumir da
  // lista (filtro ativo) e o foco não pode ficar perdido. Roda depois de o modal devolver o foco.
  useEffect(() => {
    if (focarFeedback.current && feedbackMsg) {
      focarFeedback.current = false;
      feedbackRef.current?.focus();
    }
  }, [feedbackMsg]);

  // Atalho "/" foca a busca (desktop), como em outros sistemas; não age enquanto a pessoa digita em um campo.
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      const alvo = e.target as HTMLElement | null;
      if (alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.tagName === 'SELECT' || alvo.isContentEditable)) return;
      if (!buscaRef.current || buscaRef.current.getClientRects().length === 0) return;
      e.preventDefault();
      buscaRef.current.focus();
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, []);

  // Girar o aparelho para >= 1024px com a folha aberta: ela é só do celular/tablet, então fecha (e libera rolagem e foco).
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const aoMudar = (e: MediaQueryListEvent) => { if (e.matches) setAberto(null); };
    mq.addEventListener('change', aoMudar);
    return () => mq.removeEventListener('change', aoMudar);
  }, []);

  const fecharFolha = () => {
    setAberto(null);
    const g = gatilhoRef.current;
    if (g) requestAnimationFrame(() => { if (document.contains(g)) g.focus(); });
  };

  const limparFormulario = () => {
    setPlaca(''); setMarca(''); setModelo(''); setCor(''); setVaga(''); setTipoVeiculo('');
    setStatus('ATIVO'); setErros({}); setErroServidor('');
    // O perfil chega depois do primeiro render: o morador tem o nome e o telefone dele
    // preenchidos ao abrir o formulário.
    setProprietarioNome(currentUser?.role === 'MORADOR' ? currentUser.name : '');
    setTelefoneContato(currentUser?.role === 'MORADOR' ? currentUser.telefone || '' : '');
  };

  const abrirCadastro = () => {
    limparFormulario();
    setFormulario({ modo: 'novo' });
  };

  const abrirEdicao = (v: Vehicle) => {
    limparFormulario();
    setPlaca(v.placa);
    setMarca(v.marca);
    setModelo(v.modelo);
    setCor(v.cor);
    setTipoVeiculo(v.tipoVeiculo);
    setVaga(v.vaga);
    setStatus(v.status);
    setProprietarioNome(v.proprietarioNome);
    setTelefoneContato(v.telefoneContato);
    setFormulario({ modo: 'editar', veiculo: v });
  };

  const fecharFaixa = () => {
    setFaixaFechada(true);
    try {
      window.localStorage.setItem(CHAVE_FAIXA_OUTRO, '1');
    } catch {
      // navegador sem armazenamento: a faixa só some até recarregar
    }
  };

  const filteredVehicles = currentUser ? filtrarVeiculos(vehicles, searchTerm, filtroTipo) : [];

  // Placa de veículo antigo fora do padrão só é cobrada se a pessoa a alterou.
  const placaErro = (valor: string, original?: string): string => {
    if (original !== undefined && valor === original) return '';
    return placaValida(valor) ? '' : MENSAGEM_PLACA_INVALIDA;
  };

  const salvarVeiculo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formulario || !currentUser || isSaving) return;
    const editandoVeiculo = formulario.modo === 'editar' ? formulario.veiculo : null;
    const souEquipe = isAdmin(currentUser.role);
    const novoDaEquipe = !editandoVeiculo && currentUser.role !== 'MORADOR';

    const novos: ErrosForm = {};
    const eplaca = placaErro(placa, editandoVeiculo?.placa);
    if (eplaca) novos.placa = eplaca;
    if (!tipoVeiculo) novos.tipo = 'Escolha o tipo do veículo.';
    if (!marca.trim()) novos.marca = 'Informe a marca do veículo.';
    if (!modelo.trim()) novos.modelo = 'Informe o modelo do veículo.';
    if (novoDaEquipe && !unidade.trim()) novos.unidade = 'Informe o apartamento.';
    if (novoDaEquipe && !proprietarioNome.trim()) novos.proprietario = 'Informe o proprietário ou motorista.';
    setErros(novos);
    setErroServidor('');
    if (Object.keys(novos).length > 0) {
      // Foco no primeiro campo com erro, na ordem em que aparecem na tela.
      const ids: [keyof ErrosForm, string][] = [
        ['placa', 'veiculo-placa'],
        ['tipo', idPrimeiroTipoVeiculo('veiculo-tipo')],
        ['marca', 'veiculo-marca'],
        ['modelo', 'veiculo-modelo'],
        ['unidade', 'veiculo-apto'],
        ['proprietario', 'veiculo-proprietario'],
      ];
      const primeiro = ids.find(([campo]) => novos[campo]);
      if (primeiro) document.getElementById(primeiro[1])?.focus();
      return;
    }

    setIsSaving(true);
    let res: ResultadoSalvarVeiculo;
    if (editandoVeiculo) {
      // O morador envia só os cinco campos que pode mudar; a equipe envia também os dela.
      res = await atualizarVeiculo(editandoVeiculo.id, {
        placa, marca: marca.trim(), modelo: modelo.trim(), cor: cor.trim(), tipoVeiculo: tipoVeiculo as TipoVeiculo,
        ...(souEquipe ? { vaga: vaga.trim(), status, proprietarioNome: proprietarioNome.trim(), telefoneContato: telefoneContato.trim() } : {}),
      });
    } else {
      // Morador não manda vaga nem situação: o banco ignora e fixa ATIVO e vaga vazia.
      res = await addVehicle({
        placa,
        marca: marca.trim(),
        modelo: modelo.trim(),
        cor: cor.trim(),
        bloco,
        unidade: unidade.trim(),
        vaga: novoDaEquipe ? vaga.trim() || 'G1-Livre' : '',
        proprietarioNome: proprietarioNome.trim(),
        telefoneContato: telefoneContato.trim(),
        status: novoDaEquipe ? status : 'ATIVO',
        tipoVeiculo: tipoVeiculo as TipoVeiculo,
      });
    }
    setIsSaving(false);

    if (!res.success || !res.veiculo) {
      // Fica aberto e com os dados, para tentar de novo.
      if (res.placaDuplicada) {
        // Placa já cadastrada (única no condomínio): erro no campo Placa, com foco, e na faixa do modal.
        // Só no campo (e não também na faixa do formulário): a mensagem aparece uma vez.
        setErros((x) => ({ ...x, placa: MSG_PLACA_DUPLICADA }));
        document.getElementById('veiculo-placa')?.focus();
      } else {
        setErroServidor(res.semUnidade ? res.message : MSG_ERRO_SERVIDOR);
      }
      return;
    }

    focarFeedback.current = true;
    setFeedbackMsg({ type: 'success', text: editandoVeiculo ? 'Veículo atualizado.' : 'Veículo cadastrado.' });
    setFormulario(null);
  };

  // Remoção: o diálogo cuida da confirmação e do "Removendo…" (trava botões e Esc até a resposta,
  // o que também impede o duplo clique). O resultado sai do diálogo e vira cartão de feedback.
  const removerVeiculo = async (v: Vehicle): Promise<boolean> => {
    // Sem a placa no texto (dado pessoal na tela de confirmação): marca, modelo e unidade bastam.
    // Se a unidade tem outro veículo igual, a cor desempata.
    const igual = vehicles.some((o) => o.id !== v.id && o.unitId === v.unitId && o.marca === v.marca && o.modelo === v.modelo);
    const nome = `${v.marca} ${v.modelo}${igual && v.cor ? ` ${v.cor}` : ''}`;
    let sucesso = false;
    const confirmou = await confirm({
      title: 'Remover este veículo?',
      message: `${nome} da unidade ${rotuloUnidade(v)} deixa de aparecer na garagem e na busca da portaria. Você pode cadastrá-lo de novo depois.`,
      confirmLabel: 'Remover veículo',
      cancelLabel: 'Voltar',
      loadingLabel: 'Removendo…',
      destructive: true,
      onSubmit: async () => {
        const res = await deleteVehicle(v.id);
        sucesso = res.success;
        // Sempre fecha: o erro aparece no cartão da página, com a mensagem fixa.
        return { ok: true };
      },
    });
    if (!confirmou) return false;
    // Espera o diálogo devolver o foco (ao botão da linha, se ele ainda existir) antes de focar o cartão.
    await new Promise((r) => setTimeout(r, 0));
    focarFeedback.current = true;
    setFeedbackMsg(sucesso ? { type: 'success', text: 'Veículo removido.' } : { type: 'error', text: MSG_ERRO_REMOVER });
    return true;
  };

  if (!currentUser) return null;
  if (isProvisorio(currentUser)) return <AguardandoValidacao recurso="Os veículos" />;

  const isMorador = currentUser.role === 'MORADOR';
  const minhaUnidade = units.find((u) => u.usuarioId === currentUser.id);
  const ehEquipe = isAdmin(currentUser.role);
  // Quem edita: equipe administrativa e o morador, só na própria unidade e nunca veículo de
  // visitante (o status é da equipe). O banco confere de novo.
  const podeEditar = (v: Vehicle) =>
    ehEquipe || (isMorador && !!minhaUnidade && v.unitId === minhaUnidade.id && v.status !== 'VISITANTE');
  const totalOutro = vehicles.filter((v) => v.tipoVeiculo === 'OUTRO').length;
  const mostrarFaixa = ehEquipe && totalOutro > 0 && !faixaFechada;
  const editando = formulario?.modo === 'editar' ? formulario.veiculo : null;
  const ehNovoDaEquipe = formulario?.modo === 'novo' && !isMorador;
  // Uma só condição para mostrar E exigir os campos da equipe (vaga, status, dono, telefone; apto e bloco no
  // cadastro): quem cadastra sem ser morador (Síndico, Subsíndico, ADM e Portaria) ou a equipe administrativa editando.
  const camposDaEquipe = editando ? ehEquipe : !isMorador;
  // Quem o banco deixa inserir (policy vehicles_insert, 0028/0041): equipe administrativa, Portaria, Zelador e Morador. Conselho não.
  const podeCadastrar = ehEquipe || currentUser.role === 'PORTARIA' || currentUser.role === 'ZELADOR' || isMorador;
  const placaForaDoPadrao = !!editando && editando.placa === placa && !placaValida(editando.placa);
  const subtituloUnidade = editando ? rotuloUnidade(editando) : isMorador && currentUser.unidade ? `${currentUser.bloco ?? ''}-${currentUser.unidade}` : '';

  // Contagens dos filtros: sobre todos os veículos visíveis (não sobre a busca). "Outro" some quando é 0 e não está ativo.
  const totalPorTipo = (t: TipoVeiculo) => vehicles.filter((v) => v.tipoVeiculo === t).length;
  const chips = [
    { valor: 'TODOS' as const, rotulo: 'Todos', total: vehicles.length },
    ...TIPOS_VEICULO.map((t) => ({ valor: t.valor, rotulo: t.rotulo, total: totalPorTipo(t.valor) })),
  ].filter((c) => c.valor !== 'OUTRO' || c.total > 0 || filtroTipo === 'OUTRO');
  const carregando = isLoading || veiculosStatus === 'carregando';
  // Cadastrar exige veículos e unidades carregados: o envio precisa do unit_id da unidade.
  const dadosProntos = !carregando && unidadesProntas;
  const mostrarBusca = !(isMorador && vehicles.length <= 3) && !carregando && veiculosStatus !== 'erro';
  const listaCartoes = ordenarVeiculos(filteredVehicles, null, false);
  const listaTabela = ordenarVeiculos(filteredVehicles, ordem.coluna, ordem.desc);
  const ordenarPor = (c: ColunaOrdem) => setOrdem((o) => (o.coluna === c ? { coluna: c, desc: !o.desc } : { coluna: c, desc: false }));

  return (
    <div className="space-y-6">
      
      {/* Cabeçalho impresso com o Logotipo Oficial */}
      <PrintReportHeader
        titulo="Mapeamento e Registro Oficial de Veículos e Vagas de Garagem"
        subtitulo="Controle de acesso e monitoramento veicular interno"
      />

      {/* Cabeçalho de Tela */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 no-print">
        <div className="min-w-0 flex-1 basis-64">
          <div className="flex items-center gap-2">
            <Car className="h-6 w-6 text-accent" />
            <h1 className="min-w-0 text-xl font-bold text-slate-900 sm:text-2xl">
              Cadastro e Controle de Veículos
            </h1>
          </div>
          <p className="mt-1 hidden text-xs text-slate-600 sm:block">
            Mapeamento de placas autorizadas, vagas de garagem e identificação pela portaria.
          </p>
        </div>

        <div className="flex w-full items-center gap-2 sm:w-auto">
          {/* No celular "Imprimir" vira só o ícone (o rótulo fica para o leitor de tela) e a ação principal ocupa a linha. */}
          <button
            type="button"
            onClick={() => window.print()}
            title="Imprimir relação"
            className="order-2 flex size-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 sm:order-1 sm:size-auto sm:px-3.5 sm:py-2"
          >
            <Printer className="h-4 w-4 text-slate-500" />
            <span className="sr-only sm:not-sr-only">Imprimir Relação</span>
          </button>

          {podeCadastrar && (
            <button
              onClick={abrirCadastro}
              disabled={!dadosProntos}
              title={dadosProntos ? undefined : 'Carregando os dados da sua unidade…'}
              className="order-1 flex min-h-11 flex-1 disabled:cursor-not-allowed disabled:opacity-60 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-primary-hover sm:order-2 sm:min-h-0 sm:flex-none"
            >
              <Plus className="h-4 w-4 text-accent" />
              <span>Cadastrar Veículo</span>
            </button>
          )}
        </div>
      </div>

      {/* Mensagem de Feedback */}
      {feedbackMsg && (
        <div
          ref={feedbackRef}
          tabIndex={-1}
          role={feedbackMsg.type === 'error' ? 'alert' : 'status'}
          className={`rounded-2xl p-4 text-xs font-semibold flex items-center justify-between no-print focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong/30 ${
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

      {/* Destaque para a Portaria */}
      {currentUser.role === 'PORTARIA' && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-xs text-emerald-900 no-print flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-emerald-700 shrink-0" />
          <div>
            <strong>Modo Portaria Ativo:</strong> Digite a placa na busca abaixo para liberar o portão com segurança ou registrar um veículo temporário de visitante.
          </div>
        </div>
      )}

      {/* Faixa informativa: só a equipe administrativa, enquanto houver veículos "Outro". */}
      {mostrarFaixa && (
        <div className="flex items-start gap-3 rounded-2xl border border-accent-200 bg-accent-50 p-4 text-xs text-slate-800 no-print">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent-strong" aria-hidden="true" />
          <div className="flex-1">
            <p>
              {totalOutro === 1
                ? '1 veículo está como "Outro". Se for carro ou moto, toque em "Editar veículo" e corrija o tipo.'
                : `${totalOutro} veículos estão como "Outro". Se algum for carro ou moto, toque em "Editar veículo" e corrija o tipo.`}
            </p>
            <button
              type="button"
              onClick={() => setFiltroTipo('OUTRO')}
              className="mt-1 flex min-h-11 items-center font-semibold text-accent-strong underline sm:min-h-0"
            >
              Ver veículos &quot;Outro&quot;
            </button>
          </div>
          <button type="button" onClick={fecharFaixa} aria-label="Fechar aviso" className="-m-3 flex size-11 shrink-0 items-center justify-center text-slate-500 hover:text-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Busca e filtros: o Morador com até 3 veículos não precisa deles. */}
      {mostrarBusca && (
        <>
          <div className="relative w-full no-print">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <input
              ref={buscaRef}
              type="search"
              inputMode="search"
              autoComplete="off"
              aria-label="Buscar veículo por placa, apartamento, vaga ou nome"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar placa, apto, vaga ou nome"
              className="min-h-11 w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-base text-slate-900 shadow-2xs placeholder:text-slate-500 focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-strong/30 lg:pr-24 lg:text-sm"
            />
            <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[12px] font-semibold text-slate-600 lg:block" aria-hidden="true">atalho: /</kbd>
          </div>

          <div role="group" aria-label="Filtrar por tipo de veículo" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 no-print sm:mx-0 sm:px-0">
            {chips.map((c) => {
              const ativo = filtroTipo === c.valor;
              return (
                <button
                  key={c.valor}
                  type="button"
                  aria-pressed={ativo}
                  onClick={() => setFiltroTipo(c.valor)}
                  className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-4 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong ${
                    ativo ? 'border-primary bg-primary text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {c.rotulo} <span className={`font-medium ${ativo ? 'text-slate-200' : 'text-slate-600'}`}>{c.total}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Só afirma "N veículos" ou "sem veículos" depois que a carga dos veículos terminou (isLoading só cobre o perfil). */}
      <p aria-live="polite" className="text-sm text-slate-600 no-print">
        {carregando ? 'Carregando veículos…' : veiculosStatus === 'erro' ? '' : textoContagem(filteredVehicles.length, vehicles.length)}
      </p>

      {veiculosStatus === 'erro' && !carregando ? (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 no-print">
          <p className="font-semibold">Não foi possível carregar os veículos.</p>
          <p className="mt-1">Verifique a conexão e tente de novo.</p>
          <button
            type="button"
            onClick={() => void recarregarVeiculos()}
            className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-red-300 bg-white px-4 text-sm font-semibold text-red-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
          >
            Tentar de novo
          </button>
        </div>
      ) : carregando ? (
        <div className="space-y-2 no-print" role="status" aria-label="Carregando veículos">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-white motion-reduce:animate-none" />)}
        </div>
      ) : filteredVehicles.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-xs no-print">
          {vehicles.length === 0 ? (
            isMorador ? (
              <div className="flex flex-col items-center gap-3">
                <p className="text-sm text-slate-700">Sua unidade não tem veículos cadastrados.</p>
                <button
                  type="button"
                  onClick={abrirCadastro}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-xs transition hover:bg-primary-hover"
                >
                  <Plus className="h-4 w-4 text-accent" aria-hidden="true" />
                  Cadastrar veículo
                </button>
              </div>
            ) : (
              <p className="text-sm text-slate-700">Nenhum veículo cadastrado ainda.</p>
            )
          ) : (
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm text-slate-700">
                {searchTerm.trim() ? <>Nenhum veículo encontrado para &ldquo;{searchTerm.trim()}&rdquo;.</> : 'Nenhum veículo deste tipo encontrado.'}
              </p>
              <button
                type="button"
                onClick={() => { setSearchTerm(''); setFiltroTipo('TODOS'); buscaRef.current?.focus(); }}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-primary hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong"
              >
                Limpar busca
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Celular e tablet: cartões. Não saem na impressão (a impressão é sempre a tabela completa). */}
          <ul className="space-y-2 lg:hidden print:hidden">
            {listaCartoes.map((v) => (
              <li key={v.id}>
                <CartaoVeiculo
                  veiculo={v}
                  destaque={listaCartoes.length === 1 && !!searchTerm.trim()}
                  onAbrir={(gatilho) => { gatilhoRef.current = gatilho; setAberto(v); }}
                />
              </li>
            ))}
          </ul>

          {/* Desktop e impressão: tabela, com Placa, Unidade e Morador ordenáveis. */}
          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs lg:block print:block">
            <div className="overflow-x-auto">
              <table className="hidden w-full text-left text-xs lg:table print:table">
                <thead className="border-b border-slate-200 bg-slate-50/75 text-[12px] font-bold uppercase tracking-wider text-slate-600">
                  <tr>
                    <CabecalhoOrdenavel rotulo="Placa" coluna="PLACA" ordem={ordem} onOrdenar={ordenarPor} />
                    <th className="px-3 py-3.5">Tipo</th>
                    <th className="px-3 py-3.5">Veículo / Modelo</th>
                    <CabecalhoOrdenavel rotulo="Unidade" coluna="UNIDADE" ordem={ordem} onOrdenar={ordenarPor} />
                    <th className="px-3 py-3.5">Vaga</th>
                    <CabecalhoOrdenavel rotulo="Morador responsável" coluna="MORADOR" ordem={ordem} onOrdenar={ordenarPor} />
                    <th className="w-px whitespace-nowrap px-3 py-3.5 text-right no-print">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {listaTabela.map((v) => {
                    const tel = hrefTelefone(v.telefoneContato);
                    return (
                      <tr key={v.id} className="transition hover:bg-slate-50/60">
                        <td className="whitespace-nowrap px-3 py-3.5">
                          <span className="rounded-lg bg-primary px-2.5 py-1 font-mono text-xs font-bold tracking-wider text-white print:border print:border-slate-700 print:bg-white print:text-black">{v.placa}</span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3.5"><TipoVeiculoBadge tipo={v.tipoVeiculo} /></td>
                        <td className="px-3 py-3.5 font-bold text-slate-900">
                          {v.marca} {v.modelo}
                          {v.status === 'VISITANTE' && (
                            <span className="ml-2 rounded-md bg-pendente-100 px-1.5 py-0.5 text-[12px] font-bold text-pendente-800">Visitante</span>
                          )}
                          {v.cor && <div className="text-[12px] font-normal text-slate-600">{v.cor}</div>}
                        </td>
                        <td className="px-3 py-3.5 font-semibold text-primary">Apto {v.unidade} - Bloco {v.bloco}</td>
                        <td className="px-3 py-3.5 font-mono font-bold text-slate-700">{v.vaga || '—'}</td>
                        <td className="px-3 py-3.5">
                          <div className="font-semibold text-slate-900">{v.proprietarioNome}</div>
                          <div className="flex items-center gap-1 text-[12px] text-slate-600">
                            <Phone className="h-3 w-3 shrink-0" aria-hidden="true" />
                            {tel ? (
                              <a href={tel} className="whitespace-nowrap font-medium text-accent-strong underline print:text-black print:no-underline">{formatarTelefone(v.telefoneContato)}</a>
                            ) : (
                              <span>Sem telefone</span>
                            )}
                          </div>
                        </td>
                        <td className="w-px whitespace-nowrap px-3 py-3.5 text-right no-print">
                          {podeEditar(v) && (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => abrirEdicao(v)}
                                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong"
                                aria-label={`Editar veículo ${v.placa}`}
                              >
                                <Pencil className="size-4 shrink-0" aria-hidden="true" />
                                <span>Editar</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => void removerVeiculo(v)}
                                className="inline-flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2 text-xs font-semibold text-red-700 transition hover:bg-red-50 hover:text-red-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
                                aria-label={`Remover veículo ${v.marca} ${v.modelo}`}
                              >
                                <Trash2 className="size-4 shrink-0" aria-hidden="true" />
                                <span>Remover</span>
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="border-t border-slate-100 px-3 py-3 text-sm text-slate-600">Mostrando {filteredVehicles.length} de {vehicles.length} veículos</p>
          </div>
        </>
      )}

      {/* Folha de detalhes do veículo (celular) */}
      {aberto && (
        <FolhaVeiculo
          veiculo={aberto}
          podeAgir={podeEditar(aberto)}
          onFechar={fecharFolha}
          onEditar={() => { const v = aberto; setAberto(null); abrirEdicao(v); }}
          onRemover={async () => {
            const v = aberto;
            setAberto(null);
            const feito = await removerVeiculo(v);
            if (!feito) {
              const g = gatilhoRef.current;
              if (g && document.contains(g)) g.focus();
            }
          }}
        />
      )}

      {/* Formulário de veículo: o mesmo para cadastrar e editar */}
      {formulario && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={fecharFormulario} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="veiculo-modal-title"
            className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 id="veiculo-modal-title" className="text-base font-bold text-slate-900">
                  {editando ? 'Editar veículo' : 'Cadastrar veículo'}
                </h3>
                {subtituloUnidade && <p className="mt-0.5 text-xs text-slate-500">Unidade {subtituloUnidade}</p>}
              </div>
              <button
                type="button"
                onClick={fecharFormulario}
                disabled={isSaving}
                aria-label="Fechar"
                className="flex size-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={salvarVeiculo} noValidate className="mt-4 space-y-3">
              <CampoVeiculo
                id="veiculo-placa"
                label="Placa do veículo"
                type="text"
                placeholder="Ex: ABC1D23"
                value={placa}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                classeInput="font-mono font-bold"
                onChange={(e) => {
                  const nova = normalizarPlacaDigitada(e.target.value);
                  setPlaca(nova);
                  // Limpa o erro assim que a placa passa a valer; não acusa erro enquanto ainda digita.
                  if (erros.placa && !placaErro(nova, editando?.placa)) setErros((x) => ({ ...x, placa: undefined }));
                }}
                onBlur={() => {
                  if (placa.length === 0 || erros.placa === MSG_PLACA_DUPLICADA) return;
                  const e = placaErro(placa, editando?.placa);
                  setErros((x) => ({ ...x, placa: e || undefined }));
                }}
                erro={erros.placa}
                apoio={
                  <>
                    <span>{AJUDA_PLACA}</span>
                    {placaForaDoPadrao && (
                      <span className="mt-1 flex items-center gap-1.5 font-semibold text-pendente-800">
                        <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        Esta placa está fora do padrão. Corrija ou deixe como está.
                      </span>
                    )}
                  </>
                }
              />

              <TipoVeiculoSelector
                name="veiculo-tipo"
                idBase="veiculo-tipo"
                value={tipoVeiculo}
                onChange={(t) => { setTipoVeiculo(t); setErros((x) => ({ ...x, tipo: undefined })); }}
                erro={erros.tipo}
              />

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <CampoVeiculo
                  id="veiculo-marca"
                  label="Marca"
                  type="text"
                  placeholder="Ex: Toyota"
                  value={marca}
                  autoComplete="off"
                  onChange={(e) => { setMarca(e.target.value); setErros((x) => ({ ...x, marca: undefined })); }}
                  erro={erros.marca}
                />
                <CampoVeiculo
                  id="veiculo-modelo"
                  label="Modelo"
                  type="text"
                  placeholder="Ex: Corolla"
                  value={modelo}
                  autoComplete="off"
                  onChange={(e) => { setModelo(e.target.value); setErros((x) => ({ ...x, modelo: undefined })); }}
                  erro={erros.modelo}
                />
              </div>

              <CampoVeiculo
                id="veiculo-cor"
                label={<>Cor <span className="font-normal text-slate-500">(opcional)</span></>}
                type="text"
                placeholder="Ex: Preto"
                value={cor}
                autoComplete="off"
                onChange={(e) => setCor(e.target.value)}
              />

              {/* Campos da equipe: vaga, situação, dono e telefone. O morador não os vê. */}
              {camposDaEquipe && (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <CampoVeiculo
                      id="veiculo-vaga"
                      label="Vaga de garagem"
                      type="text"
                      placeholder="Ex: G2-45"
                      value={vaga}
                      onChange={(e) => setVaga(e.target.value)}
                    />
                    <div>
                      <label htmlFor="veiculo-status" className="block text-xs font-semibold text-slate-700">Status</label>
                      <select
                        id="veiculo-status"
                        value={status}
                        onChange={(e) => setStatus(e.target.value as 'ATIVO' | 'VISITANTE')}
                        className={classeCampoVeiculo()}
                      >
                        <option value="ATIVO">Ativo</option>
                        <option value="VISITANTE">Visitante</option>
                      </select>
                    </div>
                  </div>

                  {ehNovoDaEquipe && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <CampoVeiculo
                        id="veiculo-apto"
                        label="Apartamento"
                        type="text"
                        placeholder="304"
                        value={unidade}
                        onChange={(e) => { setUnidade(e.target.value); setErros((x) => ({ ...x, unidade: undefined })); }}
                        erro={erros.unidade}
                      />
                      <div>
                        <label htmlFor="veiculo-bloco" className="block text-xs font-semibold text-slate-700">Bloco</label>
                        <select
                          id="veiculo-bloco"
                          value={bloco}
                          onChange={(e) => setBloco(e.target.value)}
                          className={classeCampoVeiculo()}
                        >
                          <option value="A">Bloco A</option>
                          <option value="B">Bloco B</option>
                        </select>
                      </div>
                    </div>
                  )}

                  <CampoVeiculo
                    id="veiculo-proprietario"
                    label="Proprietário / Motorista"
                    type="text"
                    value={proprietarioNome}
                    onChange={(e) => { setProprietarioNome(e.target.value); setErros((x) => ({ ...x, proprietario: undefined })); }}
                    erro={erros.proprietario}
                  />
                  <CampoVeiculo
                    id="veiculo-telefone"
                    label="Telefone de contato"
                    type="text"
                    inputMode="tel"
                    value={telefoneContato}
                    onChange={(e) => setTelefoneContato(e.target.value)}
                  />
                </>
              )}

              {isMorador && (
                <p className="text-[12px] text-slate-500">
                  O veículo fica na sua unidade. Vaga e situação são definidas pelo síndico.
                </p>
              )}

              {erroServidor && (
                <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-900">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
                  <span>{erroServidor}</span>
                </div>
              )}

              {/* No celular os botões empilham com "Salvar" em cima (col-reverse); no computador ficam lado a lado. */}
              <div className="mt-5 flex flex-col-reverse gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={fecharFormulario}
                  className="min-h-11 w-full rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving || !dadosProntos}
                  aria-busy={isSaving}
                  className="min-h-11 w-full rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {isSaving ? 'Salvando...' : 'Salvar veículo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

function CabecalhoOrdenavel({ rotulo, coluna, ordem, onOrdenar }: {
  rotulo: string;
  coluna: ColunaOrdem;
  ordem: { coluna: ColunaOrdem | null; desc: boolean };
  onOrdenar: (c: ColunaOrdem) => void;
}) {
  const ativa = ordem.coluna === coluna;
  return (
    <th scope="col" className="px-3 py-3.5" aria-sort={ativa ? (ordem.desc ? 'descending' : 'ascending') : 'none'}>
      <button
        type="button"
        onClick={() => onOrdenar(coluna)}
        className="inline-flex min-h-11 items-center gap-1 rounded-md text-left font-bold uppercase tracking-wider hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong"
      >
        {rotulo}
        {ativa ? (ordem.desc ? <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" /> : <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />) : <span className="w-3.5" aria-hidden="true" />}
      </button>
    </th>
  );
}
