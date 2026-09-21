'use client';

import React, { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { PrintReportHeader } from '@/components/reports/PrintReportHeader';
import { useApp } from '@/context/AppContext';
import { NoticeCategory } from '@/types';
import { NOTICE_CATEGORY_LABELS } from '@/lib/labels';
import { isAdmin } from '@/lib/roles';
import { useEscapeToClose } from '@/lib/useEscapeToClose';
import {
  Megaphone, 
  Search, 
  Plus, 
  Pin, 
  FileText, 
  Calendar, 
  User, 
  Trash2, 
  Printer, 
  X,
  AlertCircle
} from 'lucide-react';

export default function MuralPage() {
  return (
    <AppShell>
      <MuralContent />
    </AppShell>
  );
}

function MuralContent() {
  const { currentUser, notices, addNotice, deleteNotice } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('TODAS');
  const [showModal, setShowModal] = useState(false);

  // Form states
  const [titulo, setTitulo] = useState('');
  const [conteudo, setConteudo] = useState('');
  const [categoria, setCategoria] = useState<NoticeCategory>('COMUNICADO');
  const [fixado, setFixado] = useState(false);
  const [anexoNome, setAnexoNome] = useState('');

  useEscapeToClose(showModal, () => setShowModal(false));

  const filteredNotices = notices.filter((n) => {
    const matchesSearch =
      n.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.conteudo.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = selectedCategory === 'TODAS' || n.categoria === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const handleCreateNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo || !conteudo) return;

    await addNotice({
      titulo,
      conteudo,
      categoria,
      autor: currentUser?.cargo || currentUser?.name || 'Sistema',
      fixado,
      anexoNome: anexoNome || undefined,
    });

    setShowModal(false);
    setTitulo('');
    setConteudo('');
    setAnexoNome('');
    setFixado(false);
  };

  if (!currentUser) return null;

  return (
    <div className="space-y-6">
      
      {/* Cabeçalho impresso com o Logotipo Oficial */}
      <PrintReportHeader
        titulo="Mural Oficial de Editais e Comunicados Internos"
        subtitulo="Boletim informativo do Condomínio Harmony Residence"
      />

      {/* Cabeçalho de Tela */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <div className="flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-[#00A8E8]" />
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
              Mural de Comunicação Interna
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Avisos oficiais, convocações de assembleias e manutenções programadas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50"
          >
            <Printer className="h-4 w-4 text-slate-500" />
            <span>Imprimir Mural</span>
          </button>

          {isAdmin(currentUser.role) && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 rounded-xl bg-[#0B2545] px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-[#134074]"
            >
              <Plus className="h-4 w-4 text-[#00A8E8]" />
              <span>Novo Comunicado</span>
            </button>
          )}
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row items-center gap-3 no-print">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Pesquisar comunicados por palavra-chave..."
            className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2 text-xs text-slate-900 placeholder:text-slate-500 focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {['TODAS', 'URGENTE', 'ASSEMBLEIA', 'MANUTENCAO', 'COMUNICADO'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition ${
                selectedCategory === cat
                  ? 'bg-[#0B2545] text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {cat === 'TODAS' ? 'Todos' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de Comunicados */}
      <div className="space-y-4">
        {filteredNotices.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
            Nenhum aviso encontrado para os critérios selecionados.
          </div>
        ) : (
          filteredNotices.map((n) => (
            <div
              key={n.id}
              className={`rounded-2xl border bg-white p-6 shadow-xs transition hover:shadow-md ${
                n.fixado ? 'border-sky-300 ring-1 ring-sky-100' : 'border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`rounded-md px-2.5 py-1 text-xs font-bold ${
                      n.categoria === 'URGENTE'
                        ? 'bg-red-100 text-red-800'
                        : n.categoria === 'ASSEMBLEIA'
                        ? 'bg-blue-100 text-[#0B2545]'
                        : n.categoria === 'MANUTENCAO'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-800'
                    }`}
                  >
                    {NOTICE_CATEGORY_LABELS[n.categoria]}
                  </span>

                  {n.fixado && (
                    <span className="flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 text-[12px] font-semibold text-[#0A6E9C]">
                      <Pin className="h-3 w-3" />
                      <span>Fixado</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{n.data}</span>
                  </span>

                  {isAdmin(currentUser.role) && (
                    <button
                      onClick={() => deleteNotice(n.id)}
                      className="rounded-lg p-1 text-slate-500 hover:bg-red-50 hover:text-red-600 transition no-print"
                      title="Excluir comunicado"
                      aria-label="Excluir comunicado"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <h2 className="mt-3 text-base font-bold text-slate-900 sm:text-lg">
                {n.titulo}
              </h2>

              <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                {n.conteudo}
              </p>

              <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
                <div className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-slate-500" />
                  <span>Publicado por: <strong className="text-slate-800">{n.autor}</strong></span>
                </div>

                {n.anexoNome && (
                  <div className="flex items-center gap-1.5 text-xs text-[#0A6E9C] font-semibold">
                    <FileText className="h-4 w-4" />
                    <span className="hover:underline cursor-pointer">
                      Documento: {n.anexoNome}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal de Publicação de Comunicado (Síndico) */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
            onClick={() => setShowModal(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="mural-modal-title"
            className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 id="mural-modal-title" className="text-base font-bold text-slate-900">Novo Comunicado no Mural</h3>
              <button
                onClick={() => setShowModal(false)}
                aria-label="Fechar"
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNotice} className="mt-4 space-y-3">
              <div>
                <label htmlFor="mural-titulo" className="block text-xs font-semibold text-slate-700">Título do Aviso</label>
                <input
                  id="mural-titulo"
                  type="text"
                  required
                  placeholder="Ex: Convocação de Reunião Extraordinária..."
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="mural-categoria" className="block text-xs font-semibold text-slate-700">Categoria</label>
                  <select
                    id="mural-categoria"
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value as NoticeCategory)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
                  >
                    <option value="COMUNICADO">Comunicado Geral</option>
                    <option value="URGENTE">Urgente</option>
                    <option value="ASSEMBLEIA">Assembleia</option>
                    <option value="MANUTENCAO">Manutenção</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Fixar no topo?</label>
                  <label className="mt-2.5 flex items-center text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={fixado}
                      onChange={(e) => setFixado(e.target.checked)}
                      className="rounded border-slate-300 text-[#0B2545] focus:ring-[#00A8E8]"
                    />
                    <span className="ml-2 font-medium">Fixar como destaque</span>
                  </label>
                </div>
              </div>

              <div>
                <label htmlFor="mural-conteudo" className="block text-xs font-semibold text-slate-700">Conteúdo Completo</label>
                <textarea
                  id="mural-conteudo"
                  rows={4}
                  required
                  placeholder="Escreva a mensagem clara para todos os moradores..."
                  value={conteudo}
                  onChange={(e) => setConteudo(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
                />
              </div>

              <div>
                <label htmlFor="mural-anexo" className="block text-xs font-semibold text-slate-700">Nome do Anexo PDF (Opcional)</label>
                <input
                  id="mural-anexo"
                  type="text"
                  placeholder="Ex: Ata_Assembleia.pdf ou Edital_Reforma.pdf"
                  value={anexoNome}
                  onChange={(e) => setAnexoNome(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
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
                  Publicar Comunicado
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
