'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { PrintReportHeader } from '@/components/reports/PrintReportHeader';
import { useApp } from '@/context/AppContext';
import { FineStatus } from '@/types';
import { 
  ShieldAlert, 
  Search, 
  Plus, 
  Eye, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  DollarSign, 
  Lock,
  Printer,
  X
} from 'lucide-react';

export default function MultasPage() {
  return (
    <AppShell>
      <MultasContent />
    </AppShell>
  );
}

function MultasContent() {
  const { currentUser, fines, addFine } = useApp();

  if (!currentUser) return null;
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('TODOS');
  const [showModal, setShowModal] = useState(false);

  // Form states para nova infração (Síndico)
  const [bloco, setBloco] = useState('A');
  const [unidade, setUnidade] = useState('');
  const [moradorNome, setMoradorNome] = useState('');
  const [dataInfracao, setDataInfracao] = useState(new Date().toISOString().slice(0, 16));
  const [prazoRecursoData, setPrazoRecursoData] = useState('2026-09-30');
  const [artigoRegimento, setArtigoRegimento] = useState('Artigo 42 - Emissão de ruídos e som alto após às 22h');
  const [descricaoInfracao, setDescricaoInfracao] = useState('');
  const [valor, setValor] = useState('350.00');
  const [tipo, setTipo] = useState<'ADVERTENCIA' | 'MULTA'>('MULTA');
  const [fotoUrl, setFotoUrl] = useState('');
  const [fotoDescricao, setFotoDescricao] = useState('');

  // Restrição estrita de acesso: PORTARIA NÃO VÊ MULTAS
  if (currentUser.role === 'PORTARIA') {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <Lock className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-base font-bold text-amber-900">
          Acesso Restrito às Notificações e Multas
        </h2>
        <p className="mx-auto mt-2 max-w-md text-xs text-amber-700">
          Por diretrizes de sigilo, LGPD e preservação da convivência no condomínio, a equipe de portaria não tem acesso ao prontuário disciplinar e financeiro dos moradores.
        </p>
      </div>
    );
  }

  // Filtragem: Morador só vê as da sua própria unidade!
  const visibleFines = fines.filter((f) => {
    if (currentUser.role === 'MORADOR') {
      return f.unidade === currentUser.unidade;
    }
    return true;
  });

  const filteredFines = visibleFines.filter((f) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      f.numeroProtocolo.toLowerCase().includes(term) ||
      f.moradorNome.toLowerCase().includes(term) ||
      f.unidade.includes(term) ||
      f.descricaoInfracao.toLowerCase().includes(term);
    const matchesStatus = filterStatus === 'TODOS' || f.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const statusLabels: Record<FineStatus, { label: string; bg: string; text: string }> = {
    PENDENTE_CIENCIA: { label: 'Pendente de Ciência', bg: 'bg-amber-100', text: 'text-amber-800' },
    CIENCIA_REGISTRADA: { label: 'Ciência Registrada', bg: 'bg-blue-100', text: 'text-blue-800' },
    EM_RECURSO: { label: 'Em Recurso', bg: 'bg-purple-100 text-purple-900', text: 'text-purple-900' },
    RECURSO_DEFERIDO: { label: 'Recurso Deferido (Anulada)', bg: 'bg-emerald-100', text: 'text-emerald-800' },
    RECURSO_INDEFERIDO: { label: 'Recurso Indeferido (Mantida)', bg: 'bg-red-100', text: 'text-red-800' },
    CONCLUIDA: { label: 'Concluída / Paga', bg: 'bg-slate-100', text: 'text-slate-800' },
  };

  const handleCreateFine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!unidade || !moradorNome || !descricaoInfracao) return;

    addFine({
      bloco,
      unidade,
      moradorNome,
      dataInfracao,
      prazoRecursoData,
      artigoRegimento,
      descricaoInfracao,
      valor: tipo === 'ADVERTENCIA' ? 0 : parseFloat(valor) || 0,
      tipo,
      evidencias: fotoUrl
        ? [
            {
              id: `ev-${Date.now()}`,
              url: fotoUrl,
              descricao: fotoDescricao || 'Registro fotográfico anexado pela administração.',
            },
          ]
        : [
            {
              id: `ev-${Date.now()}`,
              url: 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?w=800&auto=format&fit=crop&q=60',
              descricao: 'Registro formalizado no livro da portaria e zeladoria.',
            },
          ],
    });

    setShowModal(false);
    setUnidade('');
    setMoradorNome('');
    setDescricaoInfracao('');
    setFotoUrl('');
    setFotoDescricao('');
  };

  return (
    <div className="space-y-6">
      
      {/* Cabeçalho impresso com o Logotipo Oficial */}
      <PrintReportHeader
        titulo="Livro e Relatório de Notificações e Advertências Disciplinares"
        subtitulo="Registro confidencial das infrações, ciências e recursos com valor jurídico"
      />

      {/* Cabeçalho de Tela */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-red-600" />
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
              {currentUser.role === 'MORADOR' ? 'Minhas Notificações & Multas' : 'Gestão de Notificações & Multas'}
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {currentUser.role === 'MORADOR'
              ? 'Visualize infrações atribuídas à sua unidade, confirme ciência formal ou interponha recurso online.'
              : 'Emissão de advertências, registro com fotos probatórias e julgamento de recursos administrativos.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50"
          >
            <Printer className="h-4 w-4 text-slate-500" />
            <span>Imprimir Livro de Multas</span>
          </button>

          {currentUser.role === 'SINDICO' && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-red-700"
            >
              <Plus className="h-4 w-4 text-white" />
              <span>Emitir Notificação / Multa</span>
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
            placeholder="Buscar por protocolo, artigo, morador ou apartamento..."
            className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-medium text-slate-600">Status:</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-red-500 focus:outline-none"
          >
            <option value="TODOS">Todos os Status</option>
            <option value="PENDENTE_CIENCIA">Pendente de Ciência</option>
            <option value="CIENCIA_REGISTRADA">Ciência Registrada</option>
            <option value="EM_RECURSO">Em Recurso</option>
            <option value="RECURSO_DEFERIDO">Recurso Deferido</option>
            <option value="RECURSO_INDEFERIDO">Recurso Indeferido</option>
          </select>
        </div>
      </div>

      {/* Lista de Multas */}
      <div className="space-y-4">
        {filteredFines.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
            <h3 className="mt-3 text-sm font-bold text-slate-900">
              Nenhuma notificação encontrada
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {currentUser.role === 'MORADOR'
                ? 'Sua unidade está em perfeita harmonia e sem qualquer advertência ou multa registrada!'
                : 'Não há registros disciplinares correspondentes ao filtro atual.'}
            </p>
          </div>
        ) : (
          filteredFines.map((fine) => {
            const st = statusLabels[fine.status] || { label: fine.status, bg: 'bg-slate-100', text: 'text-slate-800' };

            return (
              <div
                key={fine.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:shadow-md"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-mono font-bold text-white">
                      {fine.numeroProtocolo}
                    </span>
                    <div>
                      <span className="text-xs font-bold text-[#0B2545]">
                        Unidade {fine.unidade} - Bloco {fine.bloco}
                      </span>
                      <span className="text-xs text-slate-500 ml-2">({fine.moradorNome})</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${st.bg} ${st.text}`}>
                      {st.label}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        fine.tipo === 'MULTA' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {fine.tipo === 'MULTA' ? `Multa: R$ ${fine.valor.toFixed(2)}` : 'Advertência Formal'}
                    </span>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-xs font-semibold text-slate-900">
                    Artigo Infringido: <span className="font-normal text-slate-700">{fine.artigoRegimento}</span>
                  </p>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                    {fine.descricaoInfracao}
                  </p>
                </div>

                <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
                  <div className="flex items-center gap-4 flex-wrap">
                    <span>Data da Infração: <strong>{fine.dataInfracao}</strong></span>
                    <span>Prazo p/ Recurso: <strong className="text-red-700">{fine.prazoRecursoData}</strong></span>
                    {fine.evidencias.length > 0 && (
                      <span className="text-slate-600">
                        📷 {fine.evidencias.length} foto(s) de evidência
                      </span>
                    )}
                  </div>

                  <Link
                    href={`/multas/${fine.id}`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#0B2545] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#134074] no-print"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>Abrir Prontuário & Recurso →</span>
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal de Emissão de Multa (Síndico) */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
            onClick={() => setShowModal(false)}
          />
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-red-600">
                <ShieldAlert className="h-5 w-5" />
                <h3 className="text-base font-bold text-slate-900">Emitir Notificação / Multa</h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateFine} className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Tipo de Sanção</label>
                  <select
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value as any)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-red-500 focus:outline-none"
                  >
                    <option value="MULTA">Multa Financeira</option>
                    <option value="ADVERTENCIA">Advertência Escrita</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Valor (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    disabled={tipo === 'ADVERTENCIA'}
                    value={tipo === 'ADVERTENCIA' ? '0.00' : valor}
                    onChange={(e) => setValor(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-red-500 focus:outline-none disabled:bg-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Apto Infrator</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 304"
                    value={unidade}
                    onChange={(e) => setUnidade(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-red-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Bloco</label>
                  <select
                    value={bloco}
                    onChange={(e) => setBloco(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-red-500 focus:outline-none"
                  >
                    <option value="A">Bloco A</option>
                    <option value="B">Bloco B</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Prazo Recurso</label>
                  <input
                    type="date"
                    required
                    value={prazoRecursoData}
                    onChange={(e) => setPrazoRecursoData(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-red-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Nome do Morador Responsável</label>
                <input
                  type="text"
                  required
                  placeholder="Nome do condômino titular"
                  value={moradorNome}
                  onChange={(e) => setMoradorNome(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-red-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Artigo do Regimento / Convenção</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Artigo 42 - Barulho após horário de silêncio"
                  value={artigoRegimento}
                  onChange={(e) => setArtigoRegimento(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-red-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Data e Hora do Ocorrido</label>
                <input
                  type="datetime-local"
                  required
                  value={dataInfracao}
                  onChange={(e) => setDataInfracao(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-red-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Descrição Detalhada do Fato</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Descreva o ocorrido com clareza, mencionando relatos ou testemunhas..."
                  value={descricaoInfracao}
                  onChange={(e) => setDescricaoInfracao(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-red-500 focus:outline-none"
                />
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Evidência Fotográfica (URL de Imagem)
                </label>
                <input
                  type="url"
                  placeholder="https://exemplo.com/foto-evidencia.jpg"
                  value={fotoUrl}
                  onChange={(e) => setFotoUrl(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:border-red-500 focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="Legenda da foto (Ex: Foto da câmera da garagem G1 às 23h40)"
                  value={fotoDescricao}
                  onChange={(e) => setFotoDescricao(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:border-red-500 focus:outline-none"
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
                  className="rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700"
                >
                  Formalizar Notificação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
