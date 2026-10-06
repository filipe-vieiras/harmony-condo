'use client';

import { TIPOS_VEICULO } from '@/lib/tiposVeiculo';
import React, { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { PrintReportHeader } from '@/components/reports/PrintReportHeader';
import { Badge } from '@/components/ui/Badge';
import { descreverAuditoria, ROTULOS_MODULO } from '@/lib/auditoria';
import { useApp } from '@/context/AppContext';
import { isAdmin, ROLE_LABELS } from '@/lib/roles';
import { linhaCsv } from '@/lib/csv';
import {
  FileSpreadsheet,
  Printer, 
  Lock, 
  TrendingUp, 
  ShieldAlert, 
  CalendarCheck, 
  Users, 
  Car,
  CheckCircle2
} from 'lucide-react';
import { formatarData, formatarMoeda, pluralizar } from '@/lib/formatadores';

export default function RelatoriosPage() {
  return (
    <AppShell>
      <RelatoriosContent />
    </AppShell>
  );
}

function RelatoriosContent() {
  const { currentUser, units, vehicles, fines, reservations, auditLogs } = useApp();
  const [activeTab, setActiveTab] = useState<'INDICADORES' | 'AUDITORIA'>('INDICADORES');
  const [filtroModulo, setFiltroModulo] = useState<string>('TODOS');
  const [buscaAuditoria, setBuscaAuditoria] = useState<string>('');

  // Acesso restrito a Síndico e Conselho Fiscal
  if (!currentUser) return null;
  if (!isAdmin(currentUser.role) && currentUser.role !== 'CONSELHO') {
    return (
      <div className="rounded-2xl border border-pendente-200 bg-pendente-50 p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-pendente-100 text-pendente-700">
          <Lock className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-base font-bold text-pendente-900">
          Área Restrita à Auditoria e Gestão
        </h2>
        <p className="mx-auto mt-2 max-w-md text-xs text-pendente-700">
          O módulo de relatórios consolidados e prestação de contas é reservado à administração do condomínio (Síndico, Subsíndico e Administradora) e aos membros do Conselho Fiscal.
        </p>
      </div>
    );
  }

  // Cálculos consolidados
  // Multa anulada não conta como valor emitido (continua na lista, marcada como anulada).
  const totalMultasValor = fines.reduce((acc, f) => acc + (f.status === 'ANULADA' ? 0 : f.valor), 0);
  const totalMultasComCiencia = fines.filter((f) => f.ciencia).length;
  const totalRecursos = fines.filter((f) => f.recurso).length;
  const totalRecursosDeferidos = fines.filter((f) => f.status === 'RECURSO_DEFERIDO').length;

  const totalReservasAprovadas = reservations.filter((r) => r.status === 'APROVADA').length;
  const totalProprietarios = units.filter((u) => u.tipoOcupacao === 'PROPRIETARIO').length;
  const totalInquilinos = units.filter((u) => u.tipoOcupacao === 'INQUILINO').length;

  // Filtragem dos logs de auditoria
  const registrosAuditoria = auditLogs.map((log) => ({ log, texto: descreverAuditoria(log.acao, log.detalhes) }));
  const logsFiltrados = registrosAuditoria.filter(({ log, texto }) => {
    const matchModulo = filtroModulo === 'TODOS' || log.modulo === filtroModulo;
    const termo = buscaAuditoria.toLowerCase();
    const matchBusca = !termo || 
      log.acao.toLowerCase().includes(termo) || 
      texto.frase.toLowerCase().includes(termo) ||
      log.usuarioNome.toLowerCase().includes(termo) ||
      (log.detalhes && JSON.stringify(log.detalhes).toLowerCase().includes(termo));
    return matchModulo && matchBusca;
  });

  // Exportar auditoria para CSV
  const exportarAuditoriaCSV = () => {
    if (auditLogs.length === 0) return;
    const cabecalho = linhaCsv(['Data/Hora', 'Usuário', 'Perfil', 'Módulo', 'Ação', 'Detalhes']);
    const linhas = logsFiltrados.map(({ log }) => {
      const dataStr = new Date(log.createdAt).toLocaleString('pt-BR');
      const detalhesStr = log.detalhes ? JSON.stringify(log.detalhes).replace(/;/g, ',') : '';
      // Texto livre de quem gravou o registro pode começar com "=": celulaCsv neutraliza a fórmula.
      return linhaCsv([dataStr, log.usuarioNome, log.usuarioRole, log.modulo, log.acao, detalhesStr]);
    });

    const csvContent = '\uFEFF' + [cabecalho, ...linhas].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `auditoria_harmony_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const modulosDisponiveis = [
    { id: 'TODOS', label: 'Todos os Módulos' },
    { id: 'UNIDADES', label: 'Unidades & Moradores' },
    { id: 'RESERVAS', label: 'Reservas' },
    { id: 'MULTAS', label: 'Multas & Recursos' },
    { id: 'ESPACOS', label: 'Espaços Comuns' },
    { id: 'DOCUMENTOS', label: 'Links & Documentos' },
  ];

  return (
    <div className="space-y-6">
      
      {/* Cabeçalho Oficial Impresso com o Logotipo */}
      <PrintReportHeader
        titulo={activeTab === 'INDICADORES' ? 'Relatório Executivo de Auditoria Condominial & Ocorrências' : 'Trilha Oficial de Auditoria & Registro de Ações'}
        subtitulo="Documento analítico para apreciação do Conselho Fiscal e Prestação de Contas"
      />

      {/* Cabeçalho de Tela */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-accent" />
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
              Relatórios Executivos & Auditoria Fiscal
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-600">
            Métricas consolidadas, conformidade disciplinar e registro imutável de atividades operacionais.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'AUDITORIA' && (
            <button
              type="button"
              onClick={exportarAuditoriaCSV}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 hover:border-slate-300"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <span>Exportar CSV</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-primary-hover"
          >
            <Printer className="h-4 w-4 text-accent" />
            <span>Imprimir Relatório Oficial (PDF)</span>
          </button>
        </div>
      </div>

      {/* Tabs de Navegação */}
      <div className="flex border-b border-slate-200 no-print gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('INDICADORES')}
          className={`pb-3 px-4 text-xs font-semibold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'INDICADORES'
              ? 'border-accent text-primary'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <TrendingUp className="h-4 w-4" />
          <span>Indicadores & Conformidade</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('AUDITORIA')}
          className={`pb-3 px-4 text-xs font-semibold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'AUDITORIA'
              ? 'border-accent text-primary'
              : 'border-transparent text-slate-600 hover:text-slate-800'
          }`}
        >
          <ShieldAlert className="h-4 w-4" />
          <span>Trilha de Auditoria & Atividades ({auditLogs.length})</span>
        </button>
      </div>

      {activeTab === 'INDICADORES' ? (
        <>
          {/* Cards de Métricas Principais */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Multas Emitidas</span>
              <p className="mt-2 text-2xl font-bold text-red-600">{formatarMoeda(totalMultasValor)}</p>
              <p className="mt-0.5 text-xs text-slate-500">{pluralizar(fines.length, 'ocorrência formalizada', 'ocorrências formalizadas')}</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ciência Digital</span>
              <p className="mt-2 text-2xl font-bold text-primary">
                {fines.length > 0 ? `${Math.round((totalMultasComCiencia / fines.length) * 100)}%` : '—'}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {fines.length > 0 ? `${totalMultasComCiencia} de ${fines.length} com confirmação` : 'Nenhuma multa emitida'}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Recursos Julgados</span>
              <p className="mt-2 text-2xl font-bold text-emerald-700">
                {totalRecursosDeferidos} / {totalRecursos}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">Recursos acolhidos pelo Síndico</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Reservas Aprovadas</span>
              <p className="mt-2 text-2xl font-bold text-accent-strong">{totalReservasAprovadas}</p>
              <p className="mt-0.5 text-xs text-slate-500">Aprovadas pela administração</p>
            </div>
          </div>

          {/* Relatório 1: Quadro Disciplinar & Multas Detalhado */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            <div className="border-b border-slate-200 bg-slate-50/75 p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-red-600" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Quadro Geral de Infrações & Cumprimento Recursal
                </h2>
              </div>
              <span className="text-xs text-slate-500">Período: Exercício 2026</span>
            </div>

            <div className="overflow-x-auto">
              <table className="stack-ate-lg w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-[12px] font-bold text-slate-500 uppercase">
                  <tr>
                    <th className="px-4 py-3">Protocolo</th>
                    <th className="px-4 py-3">Unidade</th>
                    <th className="px-4 py-3">Infração / Artigo</th>
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Valor</th>
                    <th className="px-4 py-3">Ciência</th>
                    <th className="px-4 py-3">Recurso</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {fines.map((f) => (
                    <tr key={f.id} className="hover:bg-slate-50/50">
                      <td data-label="Protocolo" className="whitespace-nowrap px-4 py-3 font-mono font-bold text-slate-900">{f.numeroProtocolo}</td>
                      <td data-label="Unidade" className="px-4 py-3 font-semibold text-primary">Apto {f.unidade}-{f.bloco}</td>
                      <td data-label="Infração / Artigo" className="px-4 py-3 max-w-xs truncate text-slate-600" title={f.artigoRegimento}>
                        {f.artigoRegimento}
                      </td>
                      <td data-label="Data" className="px-4 py-3 text-slate-500">{formatarData(f.dataEmissao)}</td>
                      <td data-label="Valor" className="px-4 py-3 font-bold text-slate-900">
                        {f.status === 'ANULADA' ? (
                          <>
                            <span className="line-through"><span className="sr-only">valor anulado: </span>{f.valor > 0 ? formatarMoeda(f.valor) : 'Advertência'}</span>
                            <span className="ml-1.5 text-[12px] font-semibold text-slate-600">Anulada</span>
                          </>
                        ) : f.valor > 0 ? formatarMoeda(f.valor) : 'Advertência'}
                      </td>
                      <td data-label="Ciência" className="px-4 py-3">
                        {f.ciencia ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Confirmada</span>
                          </span>
                        ) : (
                          <span className="text-pendente-700 font-medium">Pendente</span>
                        )}
                      </td>
                      <td data-label="Recurso" className="px-4 py-3">
                        {f.recurso ? (
                          <span className="font-semibold text-slate-800">
                            {f.recurso.status === 'DEFERIDO' ? 'Deferido' : f.recurso.status === 'INDEFERIDO' ? 'Indeferido' : 'Em Análise'}
                          </span>
                        ) : (
                          <span className="whitespace-nowrap text-slate-500">Não apresentado</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Relatório 2: Censo Predial e Cadastro de Unidades */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            
            {/* Distribuição de Ocupação */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center gap-2 mb-4">
                <Users className="h-4 w-4 text-primary" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Distribuição de Ocupação das Unidades
                </h2>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-600">Total de Apartamentos Cadastrados:</span>
                  <strong className="text-slate-900">{units.length} unidades</strong>
                </div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-600">Ocupados por Proprietários:</span>
                  <strong className="text-primary">{totalProprietarios} ({Math.round((totalProprietarios / (units.length || 1)) * 100)}%)</strong>
                </div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-600">Ocupados por Inquilinos:</span>
                  <strong className="text-emerald-700">{totalInquilinos} ({Math.round((totalInquilinos / (units.length || 1)) * 100)}%)</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Veículos Registrados no Pátio:</span>
                  <strong className="text-slate-900">{vehicles.length} veículos ativos</strong>
                </div>
                {/* A soma das três linhas é sempre o total acima (todo veículo tem um tipo). */}
                {TIPOS_VEICULO.map((t) => {
                  const Icone = t.icone;
                  return (
                    <div key={t.valor} className="flex items-center justify-between pl-3 text-slate-600">
                      <span className="flex items-center gap-1.5"><Icone className="h-3.5 w-3.5" aria-hidden="true" /> {t.plural}:</span>
                      <strong className="text-slate-900">{vehicles.filter((v) => v.tipoVeiculo === t.valor).length}</strong>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Parecer do Conselho Fiscal */}
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-5 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">
                  Parecer Conclusivo do Conselho Fiscal
                </span>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Ainda não há parecer registrado para o período. O Conselho Fiscal deve emitir e assinar o parecer conclusivo com base nos registros disciplinares e financeiros acima.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-200 text-[12px] text-slate-500">
                Aguardando assinatura do Conselho Fiscal.
              </div>
            </div>

          </div>
        </>
      ) : (
        /* Trilha de Auditoria & Atividades */
        <div className="space-y-4">
          
          {/* Controles de Filtro e Busca */}
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between no-print">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              {modulosDisponiveis.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setFiltroModulo(m.id)}
                  className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition ${
                    filtroModulo === m.id
                      ? 'bg-primary text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <div className="w-full md:w-64">
              <input
                type="text"
                placeholder="Filtrar por ação ou autor..."
                value={buscaAuditoria}
                onChange={(e) => setBuscaAuditoria(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-500 focus:border-accent-strong focus:outline-hidden focus:ring-2 focus:ring-accent-strong/30"
              />
            </div>
          </div>

          {/* Tabela de Trilha de Auditoria */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            <div className="border-b border-slate-200 bg-slate-50/75 p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-accent" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Trilha de Auditoria do Sistema ({pluralizar(logsFiltrados.length, 'evento', 'eventos')})
                </h2>
              </div>
              <span className="text-[12px] text-slate-500">Ordenado por data decrescente</span>
            </div>

            <div className="overflow-x-auto">
              <table className="stack-ate-lg w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-[12px] font-bold text-slate-500 uppercase">
                  <tr>
                    <th className="px-4 py-3">Data / Hora</th>
                    <th className="px-4 py-3">Responsável</th>
                    <th className="px-4 py-3">Módulo</th>
                    <th className="px-4 py-3">O que aconteceu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logsFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-500 text-xs">
                        Nenhum registro de auditoria encontrado para o filtro selecionado.
                      </td>
                    </tr>
                  ) : (
                    logsFiltrados.map(({ log, texto }) => (
                      <tr key={log.id} className="hover:bg-slate-50/50">
                        <td data-label="Data / Hora" className="px-4 py-3 whitespace-nowrap text-[12px] text-slate-500">
                          {new Date(log.createdAt).toLocaleString('pt-BR')}
                        </td>
                        <td data-label="Responsável" className="px-4 py-3">
                          <div>
                            <div className="font-semibold text-slate-800">{log.usuarioNome}</div>
                            <div className="text-[12px] text-slate-500">{ROLE_LABELS[log.usuarioRole] ?? log.usuarioRole}</div>
                          </div>
                        </td>
                        <td data-label="Módulo" className="px-4 py-3 whitespace-nowrap">
                          <Badge className={
                            log.modulo === 'MULTAS'
                              ? 'bg-red-50 text-red-700 border border-red-100'
                              : log.modulo === 'RESERVAS'
                              ? 'bg-accent-50 text-accent-700 border border-accent-100'
                              : log.modulo === 'UNIDADES'
                              ? 'bg-blue-50 text-blue-700 border border-blue-100'
                              : log.modulo === 'ESPACOS'
                              ? 'bg-pendente-50 text-pendente-700 border border-pendente-100'
                              : log.modulo === 'DOCUMENTOS'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                              : 'bg-slate-100 text-slate-700'
                          }>
                            {ROTULOS_MODULO[log.modulo] ?? log.modulo}
                          </Badge>
                        </td>
                        <td data-label="O que aconteceu" className="empilhada px-4 py-3 text-slate-700">
                          <p className="font-medium break-words">{texto.frase}</p>
                          {texto.detalhes.length > 0 && (
                            <p className="mt-0.5 text-[12px] text-slate-500 break-words">{texto.detalhes.join(' · ')}</p>
                          )}
                          {texto.tecnicos.length > 0 && (
                            <details className="mt-1 text-[12px] text-slate-500 no-print">
                              <summary className="inline-flex min-h-11 cursor-pointer items-center lg:min-h-0">Detalhes técnicos</summary>
                              <ul className="mt-1 space-y-0.5 font-mono break-all">
                                {texto.tecnicos.map((t) => (
                                  <li key={t.chave}>{t.chave}: {t.valor}</li>
                                ))}
                              </ul>
                            </details>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
