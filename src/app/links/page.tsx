'use client';

import React from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { PrintReportHeader } from '@/components/reports/PrintReportHeader';
import { INITIAL_DOCS } from '@/lib/mockData';
import { 
  Link2, 
  FileText, 
  Download, 
  ExternalLink, 
  PhoneCall, 
  ShieldCheck, 
  Printer,
  Building,
  FileCheck2
} from 'lucide-react';

export default function LinksPage() {
  const documents = INITIAL_DOCS.filter((d) => d.categoria !== 'EMERGENCIA');
  const emergencyContacts = INITIAL_DOCS.filter((d) => d.categoria === 'EMERGENCIA');

  const handleSimulateDownload = (nome?: string) => {
    alert(`Iniciando download seguro do arquivo oficial: ${nome || 'documento.pdf'}`);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        
        {/* Cabeçalho impresso com o Logotipo Oficial */}
        <PrintReportHeader
          titulo="Guia Geral de Links Úteis, Telefones de Emergência e Documentos"
          subtitulo="Manual de convivência e canais oficiais do Condomínio Harmony Residence"
        />

        {/* Cabeçalho de Tela */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
          <div>
            <div className="flex items-center gap-2">
              <Link2 className="h-6 w-6 text-[#00A8E8]" />
              <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
                Links Importantes & Documentos Oficiais
              </h1>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Convenção, Regimento Interno, Atas de Assembleia e Telefones Úteis para a comunidade.
            </p>
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50"
          >
            <Printer className="h-4 w-4 text-slate-500" />
            <span>Imprimir Guia de Contatos</span>
          </button>
        </div>

        {/* Telefones de Emergência & Contatos Diretos */}
        <div className="space-y-3">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <PhoneCall className="h-4 w-4 text-red-600" />
            <span>Telefones de Emergência & Apoio Interno</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {emergencyContacts.map((c) => (
              <div
                key={c.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div className="rounded-xl bg-red-50 p-2.5 text-red-600">
                    <PhoneCall className="h-5 w-5" />
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                    Emergência
                  </span>
                </div>

                <h3 className="mt-3 text-sm font-bold text-slate-900">{c.titulo}</h3>
                <p className="mt-1 text-xs text-slate-500">{c.descricao}</p>

                <div className="mt-4 border-t border-slate-100 pt-3">
                  <span className="text-xs text-slate-400 block font-semibold">Contato:</span>
                  <a
                    href={`tel:${c.telefone?.replace(/[^0-9]/g, '')}`}
                    className="text-base font-bold text-[#0B2545] hover:text-[#00A8E8] transition"
                  >
                    {c.telefone}
                  </a>
                </div>
              </div>
            ))}

            {/* Administradora Predial Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:shadow-md">
              <div className="flex items-start justify-between">
                <div className="rounded-xl bg-blue-50 p-2.5 text-[#0B2545]">
                  <Building className="h-5 w-5" />
                </div>
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-[#0B2545]">
                  Financeiro
                </span>
              </div>

              <h3 className="mt-3 text-sm font-bold text-slate-900">Portal da Administradora</h3>
              <p className="mt-1 text-xs text-slate-500">
                Emissão de 2ª via de boletos de condomínio e demonstrativos de despesas.
              </p>

              <div className="mt-4 border-t border-slate-100 pt-3">
                <a
                  href="https://google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#00A8E8] hover:underline"
                >
                  <span>Acessar Portal do Condômino</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Documentos Oficiais em PDF */}
        <div className="space-y-3 pt-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <FileCheck2 className="h-4 w-4 text-[#00A8E8]" />
            <span>Documentos Regulatórios & Atas Oficiais</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between transition hover:shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded-md bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-[#0B2545]">
                      {doc.categoria}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Atualizado em {doc.dataAtualizacao}
                    </span>
                  </div>

                  <h3 className="mt-3 text-sm font-bold text-slate-900">{doc.titulo}</h3>
                  <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                    {doc.descricao}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                  <span className="text-slate-400 font-mono text-[11px]">
                    {doc.tamanhoArquivo || 'PDF'}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleSimulateDownload(doc.arquivoNome)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 font-bold text-[#0B2545] transition hover:bg-[#0B2545] hover:text-white no-print"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Baixar PDF</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </AppShell>
  );
}
