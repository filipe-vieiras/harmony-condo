'use client';

import React from 'react';

interface PrintReportHeaderProps {
  titulo: string;
  subtitulo?: string;
}

export function PrintReportHeader({ titulo, subtitulo }: PrintReportHeaderProps) {
  const dataHoje = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="print-only mb-8 border-b-2 border-slate-800 pb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Logo oficial para documentos impressos */}
          <img
            src="/images/logo.png"
            alt="Harmony Residence"
            className="h-16 w-auto object-contain"
          />
          <div>
            <h1 className="text-xl font-bold uppercase tracking-wider text-slate-900">
              Condomínio Harmony Residence
            </h1>
            <p className="text-xs text-slate-600">
              CNPJ: 14.882.901/0001-44 • Al. dos Flamingos, 500 - São Paulo/SP
            </p>
            <p className="text-xs text-slate-500">
              Administração e Gestão Predial Digital
            </p>
          </div>
        </div>
        <div className="text-right text-xs text-slate-500">
          <p className="font-semibold text-slate-800">DOCUMENTO OFICIAL</p>
          <p>Emitido em: {dataHoje}</p>
          <p>Autenticação Digital Interna</p>
        </div>
      </div>

      <div className="mt-4 pt-2">
        <h2 className="text-lg font-bold uppercase text-slate-900">{titulo}</h2>
        {subtitulo && <p className="text-sm text-slate-600">{subtitulo}</p>}
      </div>
    </div>
  );
}
