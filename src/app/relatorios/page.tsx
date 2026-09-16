'use client';

import React, { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { PrintReportHeader } from '@/components/reports/PrintReportHeader';
import { useApp } from '@/context/AppContext';
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

export default function RelatoriosPage() {
  return (
    <AppShell>
      <RelatoriosContent />
    </AppShell>
  );
}

function RelatoriosContent() {
  const { currentUser, units, vehicles, fines, reservations } = useApp();

  // Acesso restrito a Síndico e Conselho Fiscal
    if (!currentUser) return null;
  if (currentUser.role !== 'SINDICO' && currentUser.role !== 'CONSELHO') {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <Lock className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-base font-bold text-amber-900">
          Área Restrita à Auditoria e Gestão
        </h2>
        <p className="mx-auto mt-2 max-w-md text-xs text-amber-700">
          O módulo de relatórios consolidados e prestação de contas é reservado exclusivamente para o Síndico Geral e os membros do Conselho Fiscal.
        </p>
      </div>
    );
  }

  // Cálculos consolidados
  const totalMultasValor = fines.reduce((acc, f) => acc + f.valor, 0);
  const totalMultasComCiencia = fines.filter((f) => f.ciencia).length;
  const totalRecursos = fines.filter((f) => f.recurso).length;
  const totalRecursosDeferidos = fines.filter((f) => f.status === 'RECURSO_DEFERIDO').length;

  const totalReservasAprovadas = reservations.filter((r) => r.status === 'APROVADA').length;
  const totalProprietarios = units.filter((u) => u.tipoOcupacao === 'PROPRIETARIO').length;
  const totalInquilinos = units.filter((u) => u.tipoOcupacao === 'INQUILINO').length;

  if (!currentUser) return null;

  return (
    <div className="space-y-6">
      
      {/* Cabeçalho Oficial Impresso com o Logotipo (Item 3 do Requisito) */}
      <PrintReportHeader
        titulo="Relatório Executivo de Auditoria Condominial & Ocorrências"
        subtitulo="Documento analítico para apreciação do Conselho Fiscal e Prestação de Contas"
      />

      {/* Cabeçalho de Tela */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-[#00A8E8]" />
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
              Relatórios Executivos & Auditoria Fiscal
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Métricas de conformidade disciplinar, ocupação predial e arrecadação de reservas.
          </p>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-xl bg-[#0B2545] px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-[#134074]"
        >
          <Printer className="h-4 w-4 text-[#00A8E8]" />
          <span>Imprimir Relatório Oficial (PDF)</span>
        </button>
      </div>

      {/* Cards de Métricas Principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Multas Emitidas</span>
          <p className="mt-2 text-2xl font-bold text-red-600">R$ {totalMultasValor.toFixed(2)}</p>
          <p className="mt-0.5 text-xs text-slate-400">{fines.length} ocorrência(s) formalizada(s)</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ciência Digital</span>
          <p className="mt-2 text-2xl font-bold text-[#0B2545]">
            {fines.length > 0 ? `${Math.round((totalMultasComCiencia / fines.length) * 100)}%` : '100%'}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">{totalMultasComCiencia} de {fines.length} com confirmação</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Recursos Julgados</span>
          <p className="mt-2 text-2xl font-bold text-emerald-600">
            {totalRecursosDeferidos} / {totalRecursos}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">Recursos acolhidos pelo Síndico</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Reservas Aprovadas</span>
          <p className="mt-2 text-2xl font-bold text-[#00A8E8]">{totalReservasAprovadas}</p>
          <p className="mt-0.5 text-xs text-slate-400">Eventos sociais realizados</p>
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
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase">
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
                  <td className="px-4 py-3 font-mono font-bold text-slate-900">{f.numeroProtocolo}</td>
                  <td className="px-4 py-3 font-semibold text-[#0B2545]">Apto {f.unidade}-{f.bloco}</td>
                  <td className="px-4 py-3 max-w-xs truncate text-slate-600" title={f.artigoRegimento}>
                    {f.artigoRegimento}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{f.dataEmissao}</td>
                  <td className="px-4 py-3 font-bold text-slate-900">
                    {f.valor > 0 ? `R$ ${f.valor.toFixed(2)}` : 'Advertência'}
                  </td>
                  <td className="px-4 py-3">
                    {f.ciencia ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Confirmada</span>
                      </span>
                    ) : (
                      <span className="text-amber-700 font-medium">Pendente</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {f.recurso ? (
                      <span className="font-semibold text-slate-800">
                        {f.recurso.status === 'DEFERIDO' ? 'Deferido' : f.recurso.status === 'INDEFERIDO' ? 'Indeferido' : 'Em Análise'}
                      </span>
                    ) : (
                      <span className="text-slate-400">Não apresentado</span>
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
            <Users className="h-4 w-4 text-[#0B2545]" />
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
              <strong className="text-[#0B2545]">{totalProprietarios} ({Math.round((totalProprietarios / (units.length || 1)) * 100)}%)</strong>
            </div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-600">Ocupados por Inquilinos:</span>
              <strong className="text-emerald-700">{totalInquilinos} ({Math.round((totalInquilinos / (units.length || 1)) * 100)}%)</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Veículos Registrados no Pátio:</span>
              <strong className="text-slate-900">{vehicles.length} veículos ativos</strong>
            </div>
          </div>
        </div>

        {/* Parecer do Conselho Fiscal */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#0B2545] block mb-2">
              Parecer Conclusivo do Conselho Fiscal
            </span>
            <p className="text-xs text-slate-600 leading-relaxed">
              Os registros disciplinares e cronogramas de reservas do Condomínio Harmony Residence encontram-se devidamente documentados e em estrita consonância com a Lei nº 4.591/64, o Código Civil e a Convenção Condominial.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <div>
              <p className="font-bold text-slate-800">Dra. Renata Lima</p>
              <p className="text-[11px]">Presidente do Conselho Fiscal</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-[10px] text-slate-400">CRC/SP 198.441</p>
              <p className="text-[11px] text-emerald-700 font-semibold">✓ Regular</p>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
