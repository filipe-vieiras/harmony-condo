'use client';

import React, { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { PrintReportHeader } from '@/components/reports/PrintReportHeader';
import { useApp } from '@/context/AppContext';
import { Vehicle } from '@/types';
import { isAdmin } from '@/lib/roles';
import { useEscapeToClose } from '@/lib/useEscapeToClose';
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
  AlertTriangle
} from 'lucide-react';

export default function VeiculosPage() {
  return (
    <AppShell>
      <VeiculosContent />
    </AppShell>
  );
}

function VeiculosContent() {
  const { currentUser, vehicles, addVehicle, deleteVehicle, units } = useApp();
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
  const [unidade, setUnidade] = useState(currentUser?.unidade || '101');
  const [vaga, setVaga] = useState('');
  const [proprietarioNome, setProprietarioNome] = useState(currentUser?.name || '');
  const [telefoneContato, setTelefoneContato] = useState(currentUser?.telefone || '');
  const [status, setStatus] = useState<'ATIVO' | 'VISITANTE'>('ATIVO');

  useEscapeToClose(showModal, () => setShowModal(false));

  // O perfil do usuário carrega de forma assíncrona — se o componente monta
  // antes disso, o useState inicial fica preso no valor padrão ('101'/'A').
  // Sincroniza assim que os dados reais do morador chegam.
  useEffect(() => {
    if (currentUser?.unidade) setUnidade(currentUser.unidade);
    if (currentUser?.bloco) setBloco(currentUser.bloco);
  }, [currentUser?.unidade, currentUser?.bloco]);

  const filteredVehicles = vehicles.filter((v) => {
    const term = searchTerm.toLowerCase();
    if (!currentUser) return null;
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
    }
  };

  if (!currentUser) return null;

  const isMorador = currentUser.role === 'MORADOR';
  const minhaUnidade = units.find((u) => u.usuarioId === currentUser.id);

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
            <Car className="h-6 w-6 text-[#00A8E8]" />
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
              Cadastro e Controle de Veículos
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Mapeamento de placas autorizadas, vagas de garagem e identificação pela portaria.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50"
          >
            <Printer className="h-4 w-4 text-slate-500" />
            <span>Imprimir Relação</span>
          </button>

          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-xl bg-[#0B2545] px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-[#134074]"
          >
            <Plus className="h-4 w-4 text-[#00A8E8]" />
            <span>Cadastrar Veículo</span>
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
          <button onClick={() => setFeedbackMsg(null)} aria-label="Fechar mensagem" className="text-slate-400 hover:text-slate-600">
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

      {/* Barra de Busca Instantânea de Placa */}
      <div className="relative w-full no-print">
        <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Digite a placa (ex: BRA2E19), apartamento, vaga ou nome do morador..."
          className="w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20 font-medium shadow-2xs uppercase"
        />
      </div>

      {/* Tabela de Veículos */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Placa</th>
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
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-500">
                    Nenhum veículo encontrado correspondente à pesquisa.
                  </td>
                </tr>
              ) : (
                filteredVehicles.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-mono font-bold text-white border border-slate-700 tracking-wider">
                        {v.placa}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-bold text-slate-900">
                      {v.marca} {v.modelo}
                      {v.status === 'VISITANTE' && (
                        <span className="ml-2 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800 font-bold">
                          Visitante
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">{v.cor}</td>
                    <td className="px-5 py-3.5 font-semibold text-[#0B2545]">
                      Apto {v.unidade} - Bloco {v.bloco}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-slate-700 font-bold">
                      {v.vaga}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-slate-900">{v.proprietarioNome}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        <span>{v.telefoneContato}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right no-print">
                      {(isAdmin(currentUser.role) || (isMorador && v.unitId === minhaUnidade?.id)) && (
                        <button
                          onClick={async () => {
                            if (!confirm(`Remover o veículo ${v.placa}?`)) return;
                            const res = await deleteVehicle(v.id);
                            setFeedbackMsg({ type: res.success ? 'success' : 'error', text: res.message });
                          }}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                          title="Remover veículo"
                          aria-label={`Remover veículo ${v.placa}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
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
            className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 id="veiculo-modal-title" className="text-base font-bold text-slate-900">Cadastrar Novo Veículo</h3>
              <button
                onClick={() => setShowModal(false)}
                aria-label="Fechar"
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
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
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono uppercase font-bold focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="veiculo-marca" className="block text-xs font-semibold text-slate-700">Marca</label>
                  <input
                    id="veiculo-marca"
                    type="text"
                    required
                    placeholder="Ex: Toyota"
                    value={marca}
                    onChange={(e) => setMarca(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
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
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="veiculo-cor" className="block text-xs font-semibold text-slate-700">Cor</label>
                  <input
                    id="veiculo-cor"
                    type="text"
                    placeholder="Ex: Preto"
                    value={cor}
                    onChange={(e) => setCor(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
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
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
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
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20 disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </div>
                <div>
                  <label htmlFor="veiculo-bloco" className="block text-xs font-semibold text-slate-700">Bloco</label>
                  <select
                    id="veiculo-bloco"
                    value={bloco}
                    disabled={isMorador}
                    onChange={(e) => setBloco(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20 disabled:bg-slate-100 disabled:text-slate-500"
                  >
                    <option value="A">Bloco A</option>
                    <option value="B">Bloco B</option>
                  </select>
                </div>
              </div>
              {isMorador && (
                <p className="text-[11px] text-slate-400">
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
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
                />
              </div>

              <div>
                <label htmlFor="veiculo-telefone" className="block text-xs font-semibold text-slate-700">Telefone de Contato</label>
                <input
                  id="veiculo-telefone"
                  type="text"
                  value={telefoneContato}
                  onChange={(e) => setTelefoneContato(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
                />
              </div>

              <div className="mt-5 flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setShowModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-xl bg-[#0B2545] px-4 py-2 text-xs font-semibold text-white hover:bg-[#134074] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSaving ? 'Salvando...' : 'Salvar Veículo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
