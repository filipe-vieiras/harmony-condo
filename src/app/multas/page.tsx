'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { PrintReportHeader } from '@/components/reports/PrintReportHeader';
import { Badge } from '@/components/ui/Badge';
import { useApp } from '@/context/AppContext';
import { FineNotice, FineStatus, Unit } from '@/types';
import { isAdmin, isProvisorio } from '@/lib/roles';
import { AguardandoValidacao } from '@/components/autocadastro/AguardandoValidacao';
import { useEscapeToClose } from '@/lib/useEscapeToClose';
import { useModalFocus } from '@/lib/useModalFocus';
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
import { formatarData, formatarMoeda, pluralizar, situacaoDoPrazo, textoDoPrazo } from '@/lib/formatadores';

function moradorResponsavel(unit: Unit): string {
  const residente = unit.moradores.find((m) => m.tipo === 'TITULAR' || m.tipo === 'INQUILINO');
  return residente?.nome || unit.proprietarioNome;
}

export default function MultasPage() {
  return (
    <AppShell>
      <MultasContent />
    </AppShell>
  );
}

// Prazo de recurso já passou e ninguém recorreu nem houve decisão (só consulta, não muda dados).
function prazoEncerradoSemRecurso(f: FineNotice): boolean {
  return (f.status === 'PENDENTE_CIENCIA' || f.status === 'CIENCIA_REGISTRADA') && situacaoDoPrazo(f.prazoRecursoData) === 'ENCERRADO';
}

function MultasContent() {
  const { currentUser, fines, addFine, units } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('TODOS');
  const [showModal, setShowModal] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form states para nova infração (Síndico)
  // Campos de texto/número começam vazios (não com um exemplo pré-preenchido):
  // um valor de exemplo como state inicial engana o usuário, que digita por
  // cima sem perceber que o cursor cai no meio do texto já existente,
  // concatenando o que ele digitou com o exemplo em vez de substituí-lo.
  const [unitId, setUnitId] = useState('');
  const [dataInfracao, setDataInfracao] = useState(new Date().toISOString().slice(0, 16));
  const [prazoRecursoData, setPrazoRecursoData] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 9);
    return d.toISOString().slice(0, 10);
  });
  const [artigoRegimento, setArtigoRegimento] = useState('');
  const [descricaoInfracao, setDescricaoInfracao] = useState('');
  const [valor, setValor] = useState('');
  const [tipo, setTipo] = useState<'ADVERTENCIA' | 'MULTA'>('MULTA');
  const [fotoUrl, setFotoUrl] = useState('');
  const [fotoDescricao, setFotoDescricao] = useState('');

  useEscapeToClose(showModal, () => setShowModal(false));
  useModalFocus(showModal);

  // Restrição estrita de acesso: PORTARIA NÃO VÊ MULTAS
  if (!currentUser) return null;
  if (isProvisorio(currentUser)) return <AguardandoValidacao recurso="As notificações e multas" />;
  if (currentUser.role === 'PORTARIA') {
    return (
      <div className="rounded-2xl border border-pendente-200 bg-pendente-50 p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-pendente-100 text-pendente-700">
          <Lock className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-base font-bold text-pendente-900">
          Acesso Restrito às Notificações e Multas
        </h2>
        <p className="mx-auto mt-2 max-w-md text-xs text-pendente-700">
          Por diretrizes de sigilo, LGPD e preservação da convivência no condomínio, a equipe de portaria não tem acesso ao prontuário disciplinar e financeiro dos moradores.
        </p>
      </div>
    );
  }

  // Filtragem: Morador só vê as da sua própria unidade!
  // Compara por unit_id (FK), não por texto — evita a multa "sumir" por
  // divergência entre o texto salvo na multa e o cadastro do morador.
  const minhaUnidade = units.find((u) => u.usuarioId === currentUser?.id);
  const visibleFines = fines.filter((f) => {
    if (!currentUser) return null;
    if (currentUser.role === 'MORADOR') {
      return f.unitId === minhaUnidade?.id;
    }
    return true;
  });

  const semCiencia = visibleFines.filter((f) => f.status === 'PENDENTE_CIENCIA').length;
  const comPrazoEncerrado = visibleFines.filter(prazoEncerradoSemRecurso).length;

  const filteredFines = visibleFines.filter((f) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      f.numeroProtocolo.toLowerCase().includes(term) ||
      f.moradorNome.toLowerCase().includes(term) ||
      f.unidade.includes(term) ||
      f.descricaoInfracao.toLowerCase().includes(term);
    const matchesStatus =
      filterStatus === 'TODOS' ||
      (filterStatus === 'PRAZO_ENCERRADO' ? prazoEncerradoSemRecurso(f) : f.status === filterStatus);
    return matchesSearch && matchesStatus;
  });

  const statusLabels: Record<FineStatus, { label: string; bg: string; text: string }> = {
    PENDENTE_CIENCIA: { label: 'Pendente de Ciência', bg: 'bg-pendente-100', text: 'text-pendente-800' },
    CIENCIA_REGISTRADA: { label: 'Ciência Registrada', bg: 'bg-blue-100', text: 'text-blue-800' },
    EM_RECURSO: { label: 'Em Recurso', bg: 'bg-purple-100 text-purple-900', text: 'text-purple-900' },
    RECURSO_DEFERIDO: { label: 'Recurso Deferido (Anulada)', bg: 'bg-emerald-100', text: 'text-emerald-800' },
    RECURSO_INDEFERIDO: { label: 'Recurso Indeferido (Mantida)', bg: 'bg-red-100', text: 'text-red-800' },
    CONCLUIDA: { label: 'Encerrada', bg: 'bg-slate-100', text: 'text-slate-800' },
  };

  const selectedUnit = units.find((u) => u.id === unitId);

  const handleCreateFine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnit || !descricaoInfracao) return;

    const res = await addFine({
      unitId: selectedUnit.id,
      bloco: selectedUnit.bloco,
      unidade: selectedUnit.numero,
      moradorNome: moradorResponsavel(selectedUnit),
      dataInfracao,
      prazoRecursoData,
      artigoRegimento,
      descricaoInfracao,
      valor: tipo === 'ADVERTENCIA' ? 0 : parseFloat(valor) || 0,
      tipo,
    });
    setFeedbackMsg({ type: res.success ? 'success' : 'error', text: res.message });

    if (res.success) {
      setShowModal(false);
      setUnitId('');
      setDescricaoInfracao('');
      setFotoUrl('');
      setFotoDescricao('');
      setArtigoRegimento('');
      setValor('');
    }
  };

  if (!currentUser) return null;

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

        <div className="flex flex-wrap items-center gap-3 sm:gap-2">
          {isAdmin(currentUser.role) && (
            <button
              onClick={() => setShowModal(true)}
              className="order-first flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-red-700 sm:order-last sm:min-h-0 sm:w-auto"
            >
              <Plus className="h-4 w-4 text-white" />
              <span>Emitir Notificação / Multa</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => window.print()}
            className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 sm:min-h-0"
          >
            <Printer className="h-4 w-4 text-slate-500" />
            <span>Imprimir Livro de Multas</span>
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
          <button onClick={() => setFeedbackMsg(null)} aria-label="Fechar mensagem" className="-m-3.5 flex size-11 shrink-0 items-center justify-center text-slate-500 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row items-center gap-3 no-print">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Protocolo, artigo, morador ou apto"
            className="min-h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2 text-xs text-slate-900 placeholder:text-slate-500 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-medium text-slate-600">Status:</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="min-h-11 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-red-500 focus:outline-none sm:min-h-0 sm:flex-none"
          >
            <option value="TODOS">Todos os Status</option>
            <option value="PENDENTE_CIENCIA">Pendente de Ciência</option>
            <option value="CIENCIA_REGISTRADA">Ciência Registrada</option>
            <option value="EM_RECURSO">Em Recurso</option>
            <option value="RECURSO_DEFERIDO">Recurso Deferido</option>
            <option value="RECURSO_INDEFERIDO">Recurso Indeferido</option>
            {isAdmin(currentUser.role) && <option value="PRAZO_ENCERRADO">Prazo encerrado (sem recurso)</option>}
          </select>
        </div>
      </div>

      {/* Indicadores para a equipe: multas que pedem atenção. Tocar aplica o filtro. */}
      {isAdmin(currentUser.role) && (semCiencia > 0 || comPrazoEncerrado > 0) && (
        <div className="flex flex-wrap gap-2 no-print">
          {semCiencia > 0 && (
            <button
              type="button"
              onClick={() => setFilterStatus('PENDENTE_CIENCIA')}
              className="min-h-11 rounded-xl border border-pendente-200 bg-pendente-50 px-3 py-1.5 text-xs font-semibold text-pendente-800 transition hover:bg-pendente-100 sm:min-h-0"
            >
              Sem ciência: {semCiencia}
            </button>
          )}
          {comPrazoEncerrado > 0 && (
            <button
              type="button"
              onClick={() => setFilterStatus('PRAZO_ENCERRADO')}
              className="min-h-11 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-800 transition hover:bg-red-100 sm:min-h-0"
            >
              Prazo encerrado: {comPrazoEncerrado}
            </button>
          )}
        </div>
      )}

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

            if (!currentUser) return null;

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
                      <span className="text-xs font-bold text-primary">
                        Unidade {fine.unidade} - Bloco {fine.bloco}
                      </span>
                      <span className="text-xs text-slate-500 ml-2">({fine.moradorNome})</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={`${st.bg} ${st.text}`}>{st.label}</Badge>
                    <Badge className={fine.tipo === 'MULTA' ? 'bg-red-100 text-red-800' : 'bg-pendente-100 text-pendente-800'}>
                      {fine.tipo === 'MULTA' ? `Multa: ${formatarMoeda(fine.valor)}` : 'Advertência Formal'}
                    </Badge>
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
                    <span>Data da Infração: <strong>{formatarData(fine.dataInfracao)}</strong></span>
                    {prazoEncerradoSemRecurso(fine) ? (
                      <span><strong className="text-red-700">{textoDoPrazo(fine.prazoRecursoData)}</strong>{fine.status === 'PENDENTE_CIENCIA' && isAdmin(currentUser.role) && ' sem ciência'}</span>
                    ) : (
                      <span>
                        Prazo p/ Recurso: <strong className="text-red-700">{formatarData(fine.prazoRecursoData)}</strong>
                        {situacaoDoPrazo(fine.prazoRecursoData) === 'HOJE' && (fine.status === 'PENDENTE_CIENCIA' || fine.status === 'CIENCIA_REGISTRADA') && <> ({textoDoPrazo(fine.prazoRecursoData).toLowerCase()})</>}
                      </span>
                    )}
                    {fine.evidencias.length > 0 && (
                      <span className="text-slate-600">
                        📷 {pluralizar(fine.evidencias.length, 'foto de evidência', 'fotos de evidência')}
                      </span>
                    )}
                  </div>

                  <Link
                    href={`/multas/${fine.id}`}
                    className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-hover no-print sm:min-h-0"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>{fine.status === 'PENDENTE_CIENCIA' ? 'Ver multa e dar ciência' : 'Ver multa'} →</span>
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
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="multa-modal-title"
            className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-red-600">
                <ShieldAlert className="h-5 w-5" />
                <h3 id="multa-modal-title" className="text-base font-bold text-slate-900">Emitir Notificação / Multa</h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                aria-label="Fechar"
                className="flex size-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 sm:size-auto sm:p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateFine} className="mt-4 space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="multa-tipo" className="block text-xs font-semibold text-slate-700">Tipo de Sanção</label>
                  <select
                    id="multa-tipo"
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value as 'ADVERTENCIA' | 'MULTA')}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 min-h-11 sm:min-h-0"
                  >
                    <option value="MULTA">Multa Financeira</option>
                    <option value="ADVERTENCIA">Advertência Escrita</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="multa-valor" className="block text-xs font-semibold text-slate-700">Valor (R$)</label>
                  <input
                    id="multa-valor"
                    type="number"
                    step="0.01"
                    required={tipo !== 'ADVERTENCIA'}
                    disabled={tipo === 'ADVERTENCIA'}
                    placeholder="Ex: 350.00"
                    value={tipo === 'ADVERTENCIA' ? '0.00' : valor}
                    onChange={(e) => setValor(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 disabled:bg-slate-100 min-h-11 sm:min-h-0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="multa-unidade" className="block text-xs font-semibold text-slate-700">Unidade Infratora</label>
                  {units.length === 0 ? (
                    <p className="mt-1 rounded-xl border border-pendente-200 bg-pendente-50 px-3 py-2 text-[12px] text-pendente-700">
                      Nenhuma unidade cadastrada. Cadastre a unidade em Moradores antes de emitir uma notificação.
                    </p>
                  ) : (
                    <select
                      id="multa-unidade"
                      required
                      value={unitId}
                      onChange={(e) => setUnitId(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 min-h-11 sm:min-h-0"
                    >
                      <option value="" disabled>Selecione a unidade</option>
                      {[...units]
                        .sort((a, b) => a.bloco.localeCompare(b.bloco) || a.numero.localeCompare(b.numero, undefined, { numeric: true }))
                        .map((u) => (
                          <option key={u.id} value={u.id}>Bloco {u.bloco} - {u.numero}</option>
                        ))}
                    </select>
                  )}
                </div>
                <div>
                  <label htmlFor="multa-prazo" className="block text-xs font-semibold text-slate-700">Prazo Recurso</label>
                  <input
                    id="multa-prazo"
                    type="date"
                    required
                    value={prazoRecursoData}
                    onChange={(e) => setPrazoRecursoData(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 min-h-11 sm:min-h-0"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="multa-morador" className="block text-xs font-semibold text-slate-700">Morador Responsável</label>
                <input
                  id="multa-morador"
                  type="text"
                  readOnly
                  disabled
                  placeholder="Selecione a unidade acima"
                  value={selectedUnit ? moradorResponsavel(selectedUnit) : ''}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-xs text-slate-600 min-h-11 sm:min-h-0"
                />
                <p className="mt-1 text-[12px] text-slate-500">
                  Preenchido automaticamente com o morador principal da unidade — a notificação é sempre atribuída a ele, mesmo quando a infração foi de um visitante.
                </p>
              </div>

              <div>
                <label htmlFor="multa-artigo" className="block text-xs font-semibold text-slate-700">Artigo do Regimento / Convenção</label>
                <input
                  id="multa-artigo"
                  type="text"
                  required
                  placeholder="Ex: Artigo 42 - Barulho após horário de silêncio"
                  value={artigoRegimento}
                  onChange={(e) => setArtigoRegimento(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 min-h-11 sm:min-h-0"
                />
              </div>

              <div>
                <label htmlFor="multa-data" className="block text-xs font-semibold text-slate-700">Data e Hora do Ocorrido</label>
                <input
                  id="multa-data"
                  type="datetime-local"
                  required
                  value={dataInfracao}
                  onChange={(e) => setDataInfracao(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 min-h-11 sm:min-h-0"
                />
              </div>

              <div>
                <label htmlFor="multa-descricao" className="block text-xs font-semibold text-slate-700">Descrição Detalhada do Fato</label>
                <textarea
                  id="multa-descricao"
                  rows={3}
                  required
                  placeholder="Descreva o ocorrido com clareza, mencionando relatos ou testemunhas..."
                  value={descricaoInfracao}
                  onChange={(e) => setDescricaoInfracao(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 min-h-11 sm:min-h-0"
                />
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                <label htmlFor="multa-foto-url" className="block text-xs font-semibold text-slate-700">
                  Evidência Fotográfica (URL de Imagem)
                </label>
                <input
                  id="multa-foto-url"
                  type="url"
                  placeholder="https://exemplo.com/foto-evidencia.jpg"
                  value={fotoUrl}
                  onChange={(e) => setFotoUrl(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 min-h-11 sm:min-h-0"
                />
                <label htmlFor="multa-foto-legenda" className="sr-only">Legenda da foto</label>
                <input
                  id="multa-foto-legenda"
                  type="text"
                  placeholder="Legenda da foto (Ex: Foto da câmera da garagem G1 às 23h40)"
                  value={fotoDescricao}
                  onChange={(e) => setFotoDescricao(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 min-h-11 sm:min-h-0"
                />
              </div>

              <div className="mt-5 flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 min-h-11 sm:min-h-0"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 min-h-11 sm:min-h-0"
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
