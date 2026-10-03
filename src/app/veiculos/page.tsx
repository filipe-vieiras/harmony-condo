'use client';

import React, { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { PrintReportHeader } from '@/components/reports/PrintReportHeader';
import { useDialog } from '@/components/ui/DialogProvider';
import { useApp } from '@/context/AppContext';
import { TipoVeiculo, Vehicle } from '@/types';
import { isAdmin, isProvisorio } from '@/lib/roles';
import { AguardandoValidacao } from '@/components/autocadastro/AguardandoValidacao';
import { useEscapeToClose } from '@/lib/useEscapeToClose';
import { useModalFocus } from '@/lib/useModalFocus';
import { TipoVeiculoSelector, idPrimeiroTipoVeiculo } from '@/components/ui/TipoVeiculoSelector';
import { TipoVeiculoBadge } from '@/components/ui/TipoVeiculoBadge';
import { TIPOS_VEICULO } from '@/lib/tiposVeiculo';
import {
  Car,
  Search,
  Plus,
  ShieldCheck,
  Phone,
  Trash2,
  Printer,
  X,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Pencil,
  Info
} from 'lucide-react';

const CHAVE_FAIXA_OUTRO = 'harmony:faixa-tipo-outro-fechada';


export default function VeiculosPage() {
  return (
    <AppShell>
      <VeiculosContent />
    </AppShell>
  );
}

function VeiculosContent() {
  const { currentUser, vehicles, addVehicle, deleteVehicle, atualizarTipoVeiculo, units } = useApp();
  const { confirm } = useDialog();
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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
  const [erroTipo, setErroTipo] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'TODOS' | TipoVeiculo>('TODOS');
  // Edição do tipo de um veículo já cadastrado.
  const [editando, setEditando] = useState<Vehicle | null>(null);
  const [tipoEditado, setTipoEditado] = useState<TipoVeiculo | ''>('');
  const [erroEdicao, setErroEdicao] = useState('');
  const [salvandoTipo, setSalvandoTipo] = useState(false);
  // Fechar a faixa vale só neste navegador (sem estado "pendente" no banco).
  const [faixaFechada, setFaixaFechada] = useState(() => {
    try {
      return typeof window !== 'undefined' && window.localStorage.getItem(CHAVE_FAIXA_OUTRO) === '1';
    } catch {
      return false;
    }
  });

  useEscapeToClose(showModal, () => setShowModal(false));
  useModalFocus(showModal);
  useEscapeToClose(!!editando && !salvandoTipo, () => setEditando(null));
  useModalFocus(!!editando);

  // O perfil do usuário carrega de forma assíncrona — se o componente monta
  // antes disso, o useState inicial fica preso vazio/'A'. Sincroniza assim
  // que os dados reais do morador chegam.
  useEffect(() => {
    if (currentUser?.unidade) setUnidade(currentUser.unidade);
    if (currentUser?.bloco) setBloco(currentUser.bloco);
  }, [currentUser?.unidade, currentUser?.bloco]);

  // O perfil chega depois do primeiro render: o morador tem o nome e o telefone dele
  // preenchidos ao abrir o formulário (sem sobrescrever o que já digitou).
  const abrirModal = () => {
    if (currentUser?.role === 'MORADOR') {
      setProprietarioNome((atual) => atual || currentUser.name);
      setTelefoneContato((atual) => atual || currentUser.telefone || '');
    }
    setErroTipo('');
    setShowModal(true);
  };

  const fecharFaixa = () => {
    setFaixaFechada(true);
    try {
      window.localStorage.setItem(CHAVE_FAIXA_OUTRO, '1');
    } catch {
      // navegador sem armazenamento: a faixa só some até recarregar
    }
  };

  const abrirEdicao = (v: Vehicle) => {
    setEditando(v);
    setTipoEditado(v.tipoVeiculo);
    setErroEdicao('');
  };

  const salvarTipo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editando || salvandoTipo) return;
    if (!tipoEditado) {
      setErroEdicao('Escolha o tipo do veículo.');
      document.getElementById(idPrimeiroTipoVeiculo('veiculo-edit-tipo'))?.focus();
      return;
    }
    setSalvandoTipo(true);
    const res = await atualizarTipoVeiculo(editando.id, tipoEditado);
    setSalvandoTipo(false);
    if (!res.success) {
      setErroEdicao(res.message);
      return;
    }
    setEditando(null);
    setFeedbackMsg({ type: 'success', text: res.message });
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

  const handleCreateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!placa || !modelo || isSaving) return;
    if (!tipoVeiculo) {
      setErroTipo('Escolha o tipo do veículo.');
      document.getElementById(idPrimeiroTipoVeiculo('veiculo-tipo'))?.focus();
      return;
    }
    setIsSaving(true);

    const res = await addVehicle({
      placa: placa.toUpperCase().trim(),
      marca,
      modelo,
      cor,
      bloco,
      unidade,
      vaga: vaga || 'G1-Livre',
      proprietarioNome,
      telefoneContato,
      status,
      tipoVeiculo,
    });

    setIsSaving(false);
    setFeedbackMsg({ type: res.success ? 'success' : 'error', text: res.message });

    if (res.success) {
      setShowModal(false);
      setPlaca('');
      setMarca('');
      setModelo('');
      setCor('');
      setVaga('');
      setTipoVeiculo('');
      setErroTipo('');
    }
  };

  if (!currentUser) return null;
  if (isProvisorio(currentUser)) return <AguardandoValidacao recurso="Os veículos" />;

  const isMorador = currentUser.role === 'MORADOR';
  const minhaUnidade = units.find((u) => u.usuarioId === currentUser.id);
  // Sem ação para o perfil (ex.: Portaria): no celular a célula some, em vez de mostrar "AÇÕES" vazio.
  const podeRemover = (v: Vehicle) => isAdmin(currentUser.role) || (isMorador && v.unitId === minhaUnidade?.id);
  // Quem edita o tipo: equipe administrativa e o morador, só na própria unidade (o banco confere de novo).
  const podeEditarTipo = (v: Vehicle) => isAdmin(currentUser.role) || (isMorador && !!minhaUnidade && v.unitId === minhaUnidade.id);
  const totalOutro = vehicles.filter((v) => v.tipoVeiculo === 'OUTRO').length;
  const mostrarFaixa = isAdmin(currentUser.role) && totalOutro > 0 && !faixaFechada;

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

          <button
            onClick={abrirModal}
            className="order-1 flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-primary-hover sm:order-2 sm:min-h-0 sm:flex-none"
          >
            <Plus className="h-4 w-4 text-accent" />
            <span>Cadastrar Veículo</span>
          </button>
        </div>
      </div>

      {/* Mensagem de Feedback */}
      {feedbackMsg && (
        <div
          role={feedbackMsg.type === 'error' ? 'alert' : 'status'}
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
              {totalOutro} {totalOutro === 1 ? 'veículo está' : 'veículos estão'} como &quot;Outro&quot;. Se algum for carro ou moto, toque em &quot;Editar tipo&quot; para corrigir.
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
          <table className="stack-mobile w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/75 text-[12px] font-bold text-slate-600 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Placa</th>
                <th className="px-5 py-3.5">Tipo</th>
                <th className="px-5 py-3.5">Veículo / Modelo</th>
                <th className="px-5 py-3.5">Cor</th>
                <th className="px-5 py-3.5">Unidade</th>
                <th className="px-5 py-3.5">Vaga</th>
                <th className="px-5 py-3.5">Morador Responsável</th>
                <th className="px-5 py-3.5 text-right no-print">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredVehicles.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-slate-500">
                    {filtroTipo !== 'TODOS' ? 'Nenhum veículo deste tipo encontrado.' : 'Nenhum veículo encontrado correspondente à pesquisa.'}
                  </td>
                </tr>
              ) : (
                filteredVehicles.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/60 transition">
                    <td data-label="Placa" className="px-5 py-3.5 whitespace-nowrap">
                      <span className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-mono font-bold text-white border border-slate-700 tracking-wider">
                        {v.placa}
                      </span>
                    </td>
                    <td data-label="Tipo" className="px-5 py-3.5 whitespace-nowrap">
                      <TipoVeiculoBadge tipo={v.tipoVeiculo} />
                    </td>
                    <td data-label="Veículo / Modelo" className="px-5 py-3.5 font-bold text-slate-900">
                      {v.marca} {v.modelo}
                      {v.status === 'VISITANTE' && (
                        <span className="ml-2 rounded-md bg-pendente-100 px-1.5 py-0.5 text-[12px] text-pendente-800 font-bold">
                          Visitante
                        </span>
                      )}
                    </td>
                    <td data-label="Cor" className="px-5 py-3.5 text-slate-600">{v.cor}</td>
                    <td data-label="Unidade" className="px-5 py-3.5 font-semibold text-primary">
                      Apto {v.unidade} - Bloco {v.bloco}
                    </td>
                    <td data-label="Vaga" className="px-5 py-3.5 font-mono text-slate-700 font-bold">
                      {v.vaga}
                    </td>
                    <td data-label="Morador Responsável" className="empilhada px-5 py-3.5">
                      <div className="font-semibold text-slate-900">{v.proprietarioNome}</div>
                      <div className="text-[12px] text-slate-500 flex items-center gap-1">
                        <Phone className="h-3 w-3 shrink-0" />
                        <span className="whitespace-nowrap">{v.telefoneContato}</span>
                      </div>
                    </td>
                    <td data-label="Ações" className={`px-5 py-3.5 text-right no-print ${podeRemover(v) || podeEditarTipo(v) ? '' : 'oculta-mobile'}`}>
                      <div className="flex flex-wrap items-center justify-end gap-1">
                      {podeEditarTipo(v) && (
                        <button
                          type="button"
                          onClick={() => abrirEdicao(v)}
                          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-primary sm:min-h-0 sm:p-1.5"
                          title="Editar tipo do veículo"
                          aria-label={`Editar tipo do veículo ${v.placa}`}
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                          <span className="sm:sr-only">Editar tipo</span>
                        </button>
                      )}
                      {podeRemover(v) && (
                        <button
                          onClick={async () => {
                            if (!(await confirm({ title: `Remover o veículo ${v.placa}?`, message: 'O veículo deixa de aparecer na garagem e na busca da portaria.', confirmLabel: 'Remover', destructive: true }))) return;
                            const res = await deleteVehicle(v.id);
                            setFeedbackMsg({ type: res.success ? 'success' : 'error', text: res.message });
                          }}
                          className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 transition sm:size-auto sm:p-1.5"
                          title="Remover veículo"
                          aria-label={`Remover veículo ${v.placa}`}
                        >
                          <Trash2 className="h-4 w-4" />
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

      {/* Modal de Cadastro de Veículo */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
            onClick={() => setShowModal(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="veiculo-modal-title"
            className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 id="veiculo-modal-title" className="text-base font-bold text-slate-900">Cadastrar Novo Veículo</h3>
              <button
                onClick={() => setShowModal(false)}
                aria-label="Fechar"
                className="flex size-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 sm:size-auto sm:p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateVehicle} className="mt-4 space-y-3">
              <div>
                <label htmlFor="veiculo-placa" className="block text-xs font-semibold text-slate-700">Placa do Veículo</label>
                <input
                  id="veiculo-placa"
                  type="text"
                  required
                  placeholder="Ex: BRA2E19"
                  value={placa}
                  onChange={(e) => setPlaca(e.target.value.toUpperCase())}
                  className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 px-3 py-2 text-base sm:text-xs sm:min-h-0 font-mono uppercase font-bold focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-strong/30"
                />
              </div>

              <TipoVeiculoSelector
                name="veiculo-tipo"
                idBase="veiculo-tipo"
                value={tipoVeiculo}
                onChange={(t) => { setTipoVeiculo(t); setErroTipo(''); }}
                erro={erroTipo}
              />

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="veiculo-marca" className="block text-xs font-semibold text-slate-700">Marca</label>
                  <input
                    id="veiculo-marca"
                    type="text"
                    required
                    placeholder="Ex: Toyota"
                    value={marca}
                    onChange={(e) => setMarca(e.target.value)}
                    className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 px-3 py-2 text-base sm:text-xs sm:min-h-0 focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-strong/30"
                  />
                </div>
                <div>
                  <label htmlFor="veiculo-modelo" className="block text-xs font-semibold text-slate-700">Modelo</label>
                  <input
                    id="veiculo-modelo"
                    type="text"
                    required
                    placeholder="Ex: Corolla"
                    value={modelo}
                    onChange={(e) => setModelo(e.target.value)}
                    className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 px-3 py-2 text-base sm:text-xs sm:min-h-0 focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-strong/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="veiculo-cor" className="block text-xs font-semibold text-slate-700">Cor</label>
                  <input
                    id="veiculo-cor"
                    type="text"
                    placeholder="Ex: Preto"
                    value={cor}
                    onChange={(e) => setCor(e.target.value)}
                    className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 px-3 py-2 text-base sm:text-xs sm:min-h-0 focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-strong/30"
                  />
                </div>
                <div>
                  <label htmlFor="veiculo-vaga" className="block text-xs font-semibold text-slate-700">Vaga de Garagem</label>
                  <input
                    id="veiculo-vaga"
                    type="text"
                    placeholder="Ex: G2-45"
                    value={vaga}
                    onChange={(e) => setVaga(e.target.value)}
                    className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 px-3 py-2 text-base sm:text-xs sm:min-h-0 focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-strong/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="veiculo-apto" className="block text-xs font-semibold text-slate-700">Apartamento</label>
                  <input
                    id="veiculo-apto"
                    type="text"
                    required
                    disabled={isMorador}
                    placeholder="304"
                    value={unidade}
                    onChange={(e) => setUnidade(e.target.value)}
                    className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 px-3 py-2 text-base sm:text-xs sm:min-h-0 focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-strong/30 disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </div>
                <div>
                  <label htmlFor="veiculo-bloco" className="block text-xs font-semibold text-slate-700">Bloco</label>
                  <select
                    id="veiculo-bloco"
                    value={bloco}
                    disabled={isMorador}
                    onChange={(e) => setBloco(e.target.value)}
                    className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 px-3 py-2 text-base sm:text-xs sm:min-h-0 focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-strong/30 disabled:bg-slate-100 disabled:text-slate-500"
                  >
                    <option value="A">Bloco A</option>
                    <option value="B">Bloco B</option>
                  </select>
                </div>
              </div>
              {isMorador && (
                <p className="text-[12px] text-slate-500">
                  O veículo é sempre cadastrado na sua própria unidade.
                </p>
              )}

              <div>
                <label htmlFor="veiculo-proprietario" className="block text-xs font-semibold text-slate-700">Proprietário / Motorista</label>
                <input
                  id="veiculo-proprietario"
                  type="text"
                  required
                  value={proprietarioNome}
                  onChange={(e) => setProprietarioNome(e.target.value)}
                  className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 px-3 py-2 text-base sm:text-xs sm:min-h-0 focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-strong/30"
                />
              </div>

              <div>
                <label htmlFor="veiculo-telefone" className="block text-xs font-semibold text-slate-700">Telefone de Contato</label>
                <input
                  id="veiculo-telefone"
                  type="text"
                  value={telefoneContato}
                  onChange={(e) => setTelefoneContato(e.target.value)}
                  className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 px-3 py-2 text-base sm:text-xs sm:min-h-0 focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-strong/30"
                />
              </div>

              <div className="mt-5 flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setShowModal(false)}
                  className="min-h-11 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 sm:min-h-0 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="min-h-11 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-hover sm:min-h-0 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSaving ? 'Salvando...' : 'Salvar Veículo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* Modal de edição do tipo do veículo */}
      {editando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={() => !salvandoTipo && setEditando(null)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="veiculo-tipo-modal-title"
            className="relative max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 id="veiculo-tipo-modal-title" className="text-base font-bold text-slate-900">Tipo do veículo</h3>
                <p className="mt-0.5 text-xs text-slate-500">{editando.placa} · {editando.modelo}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditando(null)}
                aria-label="Fechar"
                className="flex size-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 sm:size-auto sm:p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={salvarTipo} className="mt-4 space-y-4">
              <TipoVeiculoSelector
                name="veiculo-edit-tipo"
                idBase="veiculo-edit-tipo"
                value={tipoEditado}
                onChange={(t) => { setTipoEditado(t); setErroEdicao(''); }}
                erro={erroEdicao}
              />
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  disabled={salvandoTipo}
                  onClick={() => setEditando(null)}
                  className="min-h-11 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 sm:min-h-0"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoTipo}
                  className="min-h-11 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-hover disabled:opacity-60 sm:min-h-0"
                >
                  {salvandoTipo ? 'Salvando...' : 'Salvar tipo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
