'use client';

import React, { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { PrintReportHeader } from '@/components/reports/PrintReportHeader';
import { useApp } from '@/context/AppContext';
import { useDialog } from '@/components/ui/DialogProvider';
import { NoticeCategory } from '@/types';
import { NOTICE_CATEGORY_LABELS } from '@/lib/labels';
import { isAdmin, isOperacao } from '@/lib/roles';
import { useEscapeToClose } from '@/lib/useEscapeToClose';
import { useModalFocus } from '@/lib/useModalFocus';
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
import { formatarData } from '@/lib/formatadores';

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
  const { confirm } = useDialog();
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);
  // Trava contra duplo toque: enquanto um aviso está sendo excluído, não abre outra exclusão dele.
  const [excluindoId, setExcluindoId] = useState<string | null>(null);

  const handleDeleteNotice = async (id: string, titulo: string) => {
    if (excluindoId) return;
    setErroExclusao(null);
    const curto = titulo.length > 60 ? `${titulo.slice(0, 57).trimEnd()}…` : titulo;
    const confirmou = await confirm({
      title: `Excluir o aviso "${curto}"?`,
      message: 'Ele deixa de aparecer para todos os moradores e não dá para recuperar.',
      confirmLabel: 'Excluir aviso',
      destructive: true,
    });
    if (!confirmou) return;
    setExcluindoId(id);
    const res = await deleteNotice(id);
    setExcluindoId(null);
    if (!res.success) setErroExclusao(res.message);
  };

  // Form states
  const [titulo, setTitulo] = useState('');
  const [conteudo, setConteudo] = useState('');
  const [categoria, setCategoria] = useState<NoticeCategory>('COMUNICADO');
  const [fixado, setFixado] = useState(false);
  const [anexoNome, setAnexoNome] = useState('');

  useEscapeToClose(showModal, () => setShowModal(false));
  useModalFocus(showModal);

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
      // Fixar no topo é da gestão: o Zelador publica sem fixar (o banco também recusa).
      fixado: fixado && isAdmin(currentUser?.role),
      anexoNome: isAdmin(currentUser?.role) ? anexoNome || undefined : undefined,
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
            <Megaphone className="h-6 w-6 text-accent" />
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
              Mural de Comunicação Interna
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-600">
            Avisos oficiais, convocações de assembleias e manutenções programadas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 sm:min-h-0"
          >
            <Printer className="h-4 w-4 text-slate-500" />
            <span>Imprimir Mural</span>
          </button>

          {isOperacao(currentUser.role) && (
            <button
              onClick={() => setShowModal(true)}
              className="flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-primary-hover sm:min-h-0"
            >
              <Plus className="h-4 w-4 text-accent" />
              <span>Novo Comunicado</span>
            </button>
          )}
        </div>
      </div>

      {erroExclusao && (
        <div role="alert" className="flex items-center justify-between rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-900 no-print">
          <span>{erroExclusao}</span>
          <button onClick={() => setErroExclusao(null)} aria-label="Fechar mensagem" className="-m-3.5 flex size-11 shrink-0 items-center justify-center text-slate-500 hover:text-slate-600">
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
            placeholder="Buscar avisos"
            className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2 min-h-11 sm:min-h-0 text-xs text-slate-900 placeholder:text-slate-500 focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-strong/30"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {['TODAS', 'URGENTE', 'ASSEMBLEIA', 'MANUTENCAO', 'COMUNICADO'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`min-h-11 rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition sm:min-h-0 ${
                selectedCategory === cat
                  ? 'bg-primary text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {cat === 'TODAS' ? 'Todos' : NOTICE_CATEGORY_LABELS[cat as NoticeCategory]}
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
              className={`rounded-2xl border ${n.categoria === 'URGENTE' ? '' : 'bg-white'} p-6 shadow-xs transition hover:shadow-md ${
                n.categoria === 'URGENTE'
                  ? 'border-red-200 bg-red-50'
                  : n.fixado
                  ? 'border-accent-300 ring-1 ring-accent-100'
                  : 'border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`rounded-md px-2.5 py-1 text-xs font-bold ${
                      n.categoria === 'URGENTE'
                        ? 'bg-red-100 text-red-800'
                        : n.categoria === 'ASSEMBLEIA'
                        ? 'bg-blue-100 text-primary'
                        : n.categoria === 'MANUTENCAO'
                        ? 'bg-pendente-100 text-pendente-800'
                        : 'bg-slate-100 text-slate-800'
                    }`}
                  >
                    {NOTICE_CATEGORY_LABELS[n.categoria]}
                  </span>

                  {n.fixado && (
                    <span className="flex items-center gap-1 rounded-md bg-accent-50 px-2 py-0.5 text-[12px] font-semibold text-accent-strong">
                      <Pin className="h-3 w-3" />
                      <span>Fixado</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    <span className="whitespace-nowrap">{formatarData(n.data)}</span>
                  </span>

                  {/* Gestão apaga qualquer aviso; o Zelador, só os que ele mesmo publicou (o banco confere pelo autor). */}
                  {(isAdmin(currentUser.role) || (currentUser.role === 'ZELADOR' && n.autorId === currentUser.id)) && (
                    <button
                      onClick={() => handleDeleteNotice(n.id, n.titulo)}
                      disabled={excluindoId === n.id}
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

                {/* Só vira link quando há endereço http(s) do arquivo; sem ele é texto simples. */}
                {n.anexoNome && (
                  n.anexoUrl && /^https?:\/\//i.test(n.anexoUrl) ? (
                    <a
                      href={n.anexoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-11 items-center gap-1.5 text-xs font-semibold text-accent-strong hover:underline sm:min-h-0"
                    >
                      <FileText className="h-4 w-4" />
                      <span>Documento: {n.anexoNome}</span>
                    </a>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-slate-600">
                      <span>Documento anexo: {n.anexoNome}</span>
                    </div>
                  )
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
                className="flex size-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 sm:size-auto sm:p-1"
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
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-strong/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="mural-categoria" className="block text-xs font-semibold text-slate-700">Categoria</label>
                  <select
                    id="mural-categoria"
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value as NoticeCategory)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-strong/30"
                  >
                    <option value="COMUNICADO">Comunicado Geral</option>
                    {/* O Zelador publica só Comunicado e Manutenção (o banco também recusa as outras). */}
                    {isAdmin(currentUser.role) && <option value="URGENTE">Urgente</option>}
                    {isAdmin(currentUser.role) && <option value="ASSEMBLEIA">Assembleia</option>}
                    <option value="MANUTENCAO">Manutenção</option>
                  </select>
                </div>

                {isAdmin(currentUser.role) && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Fixar no topo?</label>
                  <label className="mt-2.5 flex items-center text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={fixado}
                      onChange={(e) => setFixado(e.target.checked)}
                      className="rounded border-slate-300 text-primary focus:ring-accent-strong"
                    />
                    <span className="ml-2 font-medium">Fixar como destaque</span>
                  </label>
                </div>
                )}
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
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-strong/30"
                />
              </div>

 {isAdmin(currentUser.role) && (
              <div>
                <label htmlFor="mural-anexo" className="block text-xs font-semibold text-slate-700">Nome do Anexo PDF (Opcional)</label>
                <input
                  id="mural-anexo"
                  type="text"
                  placeholder="Ex: Ata_Assembleia.pdf ou Edital_Reforma.pdf"
                  value={anexoNome}
                  onChange={(e) => setAnexoNome(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-strong/30"
                />
              </div>
              )}

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
                  className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-hover"
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
