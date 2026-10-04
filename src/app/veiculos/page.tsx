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
  Info
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
  const { currentUser, vehicles, addVehicle, deleteVehicle, atualizarVeiculo, units } = useApp();
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

  const filteredVehicles = vehicles.filter((v) => {
    const term = searchTerm.toLowerCase();
    if (!currentUser) return null;
    if (filtroTipo !== 'TODOS' && v.tipoVeiculo !== filtroTipo) return false;
    return (
      v.placa.toLowerCase().includes(term) ||
      v.modelo.toLowerCase().includes(term) ||
      v.marca.toLowerCase().includes(term) ||
      v.unidade.includes(term) ||
      v.proprietarioNome.toLowerCase().includes(term) ||
      v.vaga.toLowerCase().includes(term)
    );
  });

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
        setErros((x) => ({ ...x, placa: MSG_PLACA_DUPLICADA }));
        setErroServidor(MSG_PLACA_DUPLICADA);
        document.getElementById('veiculo-placa')?.focus();
      } else {
        setErroServidor(MSG_ERRO_SERVIDOR);
      }
      return;
    }

    focarFeedback.current = true;
    setFeedbackMsg({ type: 'success', text: editandoVeiculo ? 'Veículo atualizado.' : 'Veículo cadastrado.' });
    setFormulario(null);
  };

  // Remoção: o diálogo cuida da confirmação e do "Removendo…" (trava botões e Esc até a resposta,
  // o que também impede o duplo clique). O resultado sai do diálogo e vira cartão de feedback.
  const removerVeiculo = async (v: Vehicle) => {
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
    if (!confirmou) return;
    // Espera o diálogo devolver o foco (ao botão da linha, se ele ainda existir) antes de focar o cartão.
    await new Promise((r) => setTimeout(r, 0));
    focarFeedback.current = true;
    setFeedbackMsg(sucesso ? { type: 'success', text: 'Veículo removido.' } : { type: 'error', text: MSG_ERRO_REMOVER });
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
  // Mesma regra do editar: veículo de visitante é da equipe. Sem ação para o perfil (ex.: Portaria):
  // no celular a célula some, em vez de mostrar "AÇÕES" vazio. O banco confere de novo.
  const podeRemover = podeEditar;
  const totalOutro = vehicles.filter((v) => v.tipoVeiculo === 'OUTRO').length;
  const mostrarFaixa = ehEquipe && totalOutro > 0 && !faixaFechada;
  const editando = formulario?.modo === 'editar' ? formulario.veiculo : null;
  const ehNovoDaEquipe = formulario?.modo === 'novo' && !isMorador;
  // Uma só condição para mostrar E exigir os campos da equipe (vaga, status, dono, telefone; apto e bloco no
  // cadastro): quem cadastra sem ser morador (Síndico, Subsíndico, ADM e Portaria) ou a equipe administrativa editando.
  const camposDaEquipe = editando ? ehEquipe : !isMorador;
  // Quem o banco deixa inserir (policy vehicles_insert, 0028): equipe administrativa, Portaria e Morador. Conselho não.
  const podeCadastrar = ehEquipe || currentUser.role === 'PORTARIA' || isMorador;
  const placaForaDoPadrao = !!editando && editando.placa === placa && !placaValida(editando.placa);
  const subtituloUnidade = editando ? rotuloUnidade(editando) : isMorador && currentUser.unidade ? `${currentUser.bloco ?? ''}-${currentUser.unidade}` : '';

  return (
    <div className="space-y-6">
      
      {/* Cabeçalho impresso com o Logotipo Oficial */}
      <PrintReportHeader
        titulo="Mapeamento e Registro Oficial de Veículos e Vagas de Garagem"
        subtitulo="Controle de acesso e monitoramento veicular interno"
      />

      {/* Cabeçalho de Tela */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <div className="flex items-center gap-2">
            <Car className="h-6 w-6 text-accent" />
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
              Cadastro e Controle de Veículos
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Mapeamento de placas autorizadas, vagas de garagem e identificação pela portaria.
          </p>
        </div>

        <div className="flex items-center gap-2">
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
              className="order-1 flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-primary-hover sm:order-2 sm:min-h-0 sm:flex-none"
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

      {/* Barra de Busca Instantânea de Placa */}
      <div className="relative w-full no-print">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar placa, apto, vaga ou nome"
          className="min-h-11 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder:text-slate-500 focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-strong/30 font-medium shadow-2xs uppercase placeholder:normal-case"
        />
      </div>

      {/* Filtro por tipo */}
      <div role="group" aria-label="Filtrar por tipo de veículo" className="flex flex-wrap gap-2 no-print">
        {([{ valor: 'TODOS' as const, rotulo: 'Todos' }, ...TIPOS_VEICULO.map((t) => ({ valor: t.valor, rotulo: t.valor === 'OUTRO' ? `Outro (${totalOutro})` : t.rotulo }))]).map((c) => {
          const ativo = filtroTipo === c.valor;
          return (
            <button
              key={c.valor}
              type="button"
              aria-pressed={ativo}
              onClick={() => setFiltroTipo(c.valor)}
              className={`min-h-11 rounded-xl border px-4 py-2 text-xs font-semibold transition ${
                ativo ? 'border-primary bg-primary text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {c.rotulo}
            </button>
          );
        })}
      </div>

      {/* Tabela de Veículos */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="stack-ate-lg w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/75 text-[12px] font-bold text-slate-600 uppercase tracking-wider">
              <tr>
                <th className="px-3 py-3.5">Placa</th>
                <th className="px-3 py-3.5">Tipo</th>
                <th className="px-3 py-3.5">Veículo / Modelo</th>
                <th className="px-3 py-3.5">Unidade</th>
                <th className="px-3 py-3.5">Vaga</th>
                <th className="px-3 py-3.5">Morador Responsável</th>
                <th className="w-px whitespace-nowrap px-3 py-3.5 text-right no-print">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredVehicles.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                    {isMorador && !searchTerm.trim() && filtroTipo === 'TODOS' ? (
                      <div className="flex flex-col items-center gap-3">
                        <p>Sua unidade não tem veículos cadastrados.</p>
                        <button
                          type="button"
                          onClick={abrirCadastro}
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-primary-hover"
                        >
                          <Plus className="h-4 w-4 text-accent" aria-hidden="true" />
                          Cadastrar veículo
                        </button>
                      </div>
                    ) : filtroTipo !== 'TODOS' ? 'Nenhum veículo deste tipo encontrado.' : 'Nenhum veículo encontrado correspondente à pesquisa.'}
                  </td>
                </tr>
              ) : (
                filteredVehicles.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/60 transition">
                    <td data-label="Placa" className="px-3 py-3.5 whitespace-nowrap">
                      <span className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-mono font-bold text-white border border-slate-700 tracking-wider">
                        {v.placa}
                      </span>
                    </td>
                    <td data-label="Tipo" className="px-3 py-3.5 whitespace-nowrap">
                      <TipoVeiculoBadge tipo={v.tipoVeiculo} />
                    </td>
                    <td data-label="Veículo / Modelo" className="px-3 py-3.5 font-bold text-slate-900">
                      {v.marca} {v.modelo}
                      {v.status === 'VISITANTE' && (
                        <span className="ml-2 rounded-md bg-pendente-100 px-1.5 py-0.5 text-[12px] text-pendente-800 font-bold">
                          Visitante
                        </span>
                      )}
                      {/* A cor vira segunda linha: tirar a coluna Cor deixa a tabela caber ao lado do menu. */}
                      {v.cor && <div className="text-[12px] font-normal text-slate-500">{v.cor}</div>}
                    </td>
                    <td data-label="Unidade" className="px-3 py-3.5 font-semibold text-primary">
                      Apto {v.unidade} - Bloco {v.bloco}
                    </td>
                    <td data-label="Vaga" className="px-3 py-3.5 font-mono text-slate-700 font-bold">
                      {v.vaga || '—'}
                    </td>
                    <td data-label="Morador Responsável" className="empilhada px-3 py-3.5">
                      <div className="font-semibold text-slate-900">{v.proprietarioNome}</div>
                      <div className="text-[12px] text-slate-500 flex items-center gap-1">
                        <Phone className="h-3 w-3 shrink-0" />
                        <span className="whitespace-nowrap">{v.telefoneContato}</span>
                      </div>
                    </td>
                    <td data-label="Ações" className={`empilhada w-px whitespace-nowrap px-3 py-3.5 text-right no-print ${podeRemover(v) || podeEditar(v) ? '' : 'oculta-mobile'}`}>
                      <div className="flex flex-wrap items-center justify-start gap-1 sm:flex-nowrap sm:justify-end">
                      {podeEditar(v) && (
                        <button
                          type="button"
                          onClick={() => abrirEdicao(v)}
                          className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-primary"
                          aria-label={`Editar veículo ${v.placa}`}
                        >
                          <Pencil className="size-4 shrink-0" aria-hidden="true" />
                          <span>Editar veículo</span>
                        </button>
                      )}
                      {podeRemover(v) && (
                        <button
                          type="button"
                          onClick={() => removerVeiculo(v)}
                          className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold whitespace-nowrap text-red-700 transition hover:bg-red-50 hover:text-red-800 focus-visible:ring-2 focus-visible:ring-red-500/40"
                          aria-label={`Remover veículo ${v.marca} ${v.modelo}`}
                        >
                          <Trash2 className="size-4 shrink-0" aria-hidden="true" />
                          <span>Remover</span>
                        </button>
                      )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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
                  disabled={isSaving}
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
