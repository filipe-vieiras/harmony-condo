'use client';

import React, { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { PrintReportHeader } from '@/components/reports/PrintReportHeader';
import { useApp } from '@/context/AppContext';
import { Unit } from '@/types';
import { 
  Users, 
  Search, 
  Plus, 
  Phone, 
  Mail, 
  Car, 
  PawPrint, 
  ShieldCheck, 
  Building2,
  Printer,
  X
} from 'lucide-react';

export default function MoradoresPage() {
  return (
    <AppShell>
      <MoradoresContent />
    </AppShell>
  );
}

function MoradoresContent() {
  const { currentUser, units, addUnit } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBloco, setFilterBloco] = useState<string>('TODOS');
  const [showModal, setShowModal] = useState(false);

  // Form states para nova unidade
  const [novoNumero, setNovoNumero] = useState('');
  const [novoBloco, setNovoBloco] = useState('A');
  const [novoProprietario, setNovoProprietario] = useState('');
  const [novoTelefone, setNovoTelefone] = useState('');
  const [novoEmail, setNovoEmail] = useState('');
  const [novoTipo, setNovoTipo] = useState<'PROPRIETARIO' | 'INQUILINO'>('PROPRIETARIO');
  const [novasVagas, setNovasVagas] = useState('');
  const [novosAnimais, setNovosAnimais] = useState('');

  const filteredUnits = units.filter((u) => {
    const matchesSearch =
      u.numero.includes(searchTerm) ||
      u.proprietarioNome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.moradores.some((m) => m.nome.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesBloco = filterBloco === 'TODOS' || u.bloco === filterBloco;
    return matchesSearch && matchesBloco;
  });

  const handleCreateUnit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoNumero || !novoProprietario) return;

    addUnit({
      bloco: novoBloco,
      numero: novoNumero,
      proprietarioNome: novoProprietario,
      proprietarioTelefone: novoTelefone,
      proprietarioEmail: novoEmail,
      tipoOcupacao: novoTipo,
      moradores: [
        {
          nome: novoProprietario,
          tipo: novoTipo === 'PROPRIETARIO' ? 'TITULAR' : 'INQUILINO',
          telefone: novoTelefone,
        },
      ],
      vagasGaragem: novasVagas ? novasVagas.split(',').map((v) => v.trim()) : [],
      animais: novosAnimais || 'Nenhum',
    });

    setShowModal(false);
    // Limpar campos
    setNovoNumero('');
    setNovoProprietario('');
    setNovoTelefone('');
    setNovoEmail('');
    setNovasVagas('');
    setNovosAnimais('');
  };

  if (!currentUser) return false;

  return (
    <div className="space-y-6">
      
      {/* Cabeçalho impresso com o Logotipo Oficial */}
      <PrintReportHeader
        titulo="Relação Cadastral Geral de Moradores e Unidades"
        subtitulo="Listagem confidencial para fins administrativos e de segurança predial"
      />

      {/* Cabeçalho de Tela */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-6 w-6 text-[#00A8E8]" />
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
              Cadastro de Moradores & Unidades
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Gerenciamento de apartamentos, proprietários, dependentes e vagas de garagem.
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

          {currentUser.role === 'SINDICO' && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 rounded-xl bg-[#0B2545] px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-[#134074]"
            >
              <Plus className="h-4 w-4 text-[#00A8E8]" />
              <span>Nova Unidade</span>
            </button>
          )}
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row items-center gap-3 no-print">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por número do apartamento ou nome do morador..."
            className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-medium text-slate-600">Bloco:</span>
          <select
            value={filterBloco}
            onChange={(e) => setFilterBloco(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-[#00A8E8] focus:outline-none"
          >
            <option value="TODOS">Todos os Blocos</option>
            <option value="A">Bloco A</option>
            <option value="B">Bloco B</option>
          </select>
        </div>
      </div>

      {/* Lista / Grid de Unidades */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredUnits.map((u) => (
          <div
            key={u.id}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0B2545] font-bold text-sm text-white">
                  {u.numero}
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    Apartamento {u.numero}
                  </h3>
                  <span className="text-xs font-semibold text-[#00A8E8]">
                    Bloco {u.bloco}
                  </span>
                </div>
              </div>

              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                  u.tipoOcupacao === 'PROPRIETARIO'
                    ? 'bg-blue-50 text-[#0B2545]'
                    : 'bg-emerald-50 text-emerald-800'
                }`}
              >
                {u.tipoOcupacao === 'PROPRIETARIO' ? 'Proprietário' : 'Inquilino'}
              </span>
            </div>

            {/* Informações de Contato */}
            <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-xs">
              <div className="flex items-center gap-2 text-slate-700">
                <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span className="font-semibold text-slate-900">{u.proprietarioNome}</span>
              </div>
              
              <div className="flex items-center gap-2 text-slate-600">
                <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span>{u.proprietarioTelefone}</span>
              </div>

              <div className="flex items-center gap-2 text-slate-600">
                <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{u.proprietarioEmail}</span>
              </div>
            </div>

            {/* Vagas & Pets */}
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-[11px] text-slate-500">
              <div className="flex items-center gap-1.5">
                <Car className="h-3.5 w-3.5 text-slate-400" />
                <span>
                  Vagas: <strong>{u.vagasGaragem.join(', ') || 'N/D'}</strong>
                </span>
              </div>

              {u.animais && u.animais !== 'Nenhum' && (
                <div className="flex items-center gap-1 text-amber-700" title={u.animais}>
                  <PawPrint className="h-3.5 w-3.5" />
                  <span className="max-w-[110px] truncate">{u.animais}</span>
                </div>
              )}
            </div>

            {/* Moradores Residentes */}
            {u.moradores.length > 1 && (
              <div className="mt-2 rounded-lg bg-slate-50 p-2 text-[11px] text-slate-600">
                <span className="font-semibold text-slate-700">Outros Moradores: </span>
                {u.moradores.filter((m) => m.nome !== u.proprietarioNome).map((m) => m.nome).join(', ')}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modal para Nova Unidade (Síndico) */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
            onClick={() => setShowModal(false)}
          />
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Cadastrar Nova Unidade</h3>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUnit} className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Número do Apto</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 602"
                    value={novoNumero}
                    onChange={(e) => setNovoNumero(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#00A8E8] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Bloco</label>
                  <select
                    value={novoBloco}
                    onChange={(e) => setNovoBloco(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#00A8E8] focus:outline-none"
                  >
                    <option value="A">Bloco A</option>
                    <option value="B">Bloco B</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Nome do Morador / Titular</label>
                <input
                  type="text"
                  required
                  placeholder="Nome completo"
                  value={novoProprietario}
                  onChange={(e) => setNovoProprietario(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#00A8E8] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Telefone / WhatsApp</label>
                  <input
                    type="text"
                    placeholder="(11) 90000-0000"
                    value={novoTelefone}
                    onChange={(e) => setNovoTelefone(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#00A8E8] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">E-mail</label>
                  <input
                    type="email"
                    placeholder="email@exemplo.com"
                    value={novoEmail}
                    onChange={(e) => setNovoEmail(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#00A8E8] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Tipo de Ocupação</label>
                  <select
                    value={novoTipo}
                    onChange={(e) => setNovoTipo(e.target.value as any)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#00A8E8] focus:outline-none"
                  >
                    <option value="PROPRIETARIO">Proprietário</option>
                    <option value="INQUILINO">Inquilino</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Vagas (ex: G1-05, G1-06)</label>
                  <input
                    type="text"
                    placeholder="G1-15"
                    value={novasVagas}
                    onChange={(e) => setNovasVagas(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#00A8E8] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Animais de Estimação</label>
                <input
                  type="text"
                  placeholder="Ex: 1 cão pequeno porte (Poodle)"
                  value={novosAnimais}
                  onChange={(e) => setNovosAnimais(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#00A8E8] focus:outline-none"
                />
              </div>

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
                  Salvar Cadastro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
