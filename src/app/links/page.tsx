'use client';

import React, { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { PrintReportHeader } from '@/components/reports/PrintReportHeader';
import { useDialog } from '@/components/ui/DialogProvider';
import { Badge } from '@/components/ui/Badge';
import { useApp } from '@/context/AppContext';
import { DocumentLink } from '@/types';
import { isAdmin } from '@/lib/roles';
import { useEscapeToClose } from '@/lib/useEscapeToClose';
import {
  Link2,
  FileText,
  ExternalLink,
  PhoneCall,
  Printer,
  Building,
  FileCheck2,
  Plus,
  Trash2,
  Pencil,
  Wrench,
  X,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

export default function LinksPage() {
  return (
    <AppShell>
      <LinksContent />
    </AppShell>
  );
}

function LinksContent() {
  const { currentUser, documents, addDocument, deleteDocument, zelador, updateZelador, portalAdministradora, updatePortalAdministradora } = useApp();
  const { confirm } = useDialog();

  const [showModal, setShowModal] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState<DocumentLink['categoria']>('ATA');
  const [linkExterno, setLinkExterno] = useState('');
  const [telefone, setTelefone] = useState('');
  const [tamanhoArquivo, setTamanhoArquivo] = useState('PDF');
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [showZeladorModal, setShowZeladorModal] = useState(false);
  const [zNome, setZNome] = useState('');
  const [zTelefone, setZTelefone] = useState('');
  const [zHorario, setZHorario] = useState('');
  const [zObs, setZObs] = useState('');

  const [showPortalModal, setShowPortalModal] = useState(false);
  const [pDescricao, setPDescricao] = useState('');
  const [pLink, setPLink] = useState('');

  const isSindico = isAdmin(currentUser?.role);

  useEscapeToClose(showModal, () => setShowModal(false));
  useEscapeToClose(showZeladorModal, () => setShowZeladorModal(false));
  useEscapeToClose(showPortalModal, () => setShowPortalModal(false));

  const handleOpenZeladorModal = () => {
    setZNome(zelador?.nome ?? '');
    setZTelefone(zelador?.telefone ?? '');
    setZHorario(zelador?.horarioAtendimento ?? '');
    setZObs(zelador?.observacoes ?? '');
    setShowZeladorModal(true);
  };

  const handleSaveZelador = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateZelador({ nome: zNome, telefone: zTelefone, horarioAtendimento: zHorario, observacoes: zObs || undefined });
    setShowZeladorModal(false);
    setFeedbackMsg({ type: 'success', text: 'Dados do zelador atualizados com sucesso!' });
  };

  const handleOpenPortalModal = () => {
    setPDescricao(portalAdministradora?.descricao ?? '');
    setPLink(portalAdministradora?.linkExterno ?? '');
    setShowPortalModal(true);
  };

  const handleSavePortal = async (e: React.FormEvent) => {
    e.preventDefault();
    await updatePortalAdministradora({ descricao: pDescricao, linkExterno: pLink });
    setShowPortalModal(false);
    setFeedbackMsg({ type: 'success', text: 'Portal da Administradora atualizado com sucesso!' });
  };

  const emergencyContacts = documents.filter((d) => d.categoria === 'EMERGENCIA');
  const officialDocuments = documents.filter((d) => d.categoria !== 'EMERGENCIA');

  const handleOpenNewDoc = () => {
    setTitulo('');
    setDescricao('');
    setCategoria('ATA');
    setLinkExterno('');
    setTelefone('');
    setTamanhoArquivo('PDF');
    setShowModal(true);
  };

  const handleSaveDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo || !linkExterno) return;

    const res = await addDocument({
      titulo,
      descricao,
      categoria,
      linkExterno,
      telefone: categoria === 'EMERGENCIA' ? telefone : undefined,
      tamanhoArquivo: categoria !== 'EMERGENCIA' ? tamanhoArquivo : undefined,
      arquivoNome: `${titulo.toLowerCase().replace(/\s+/g, '_')}.pdf`,
    });

    setFeedbackMsg({ type: res.success ? 'success' : 'error', text: res.message });
    if (res.success) setShowModal(false);
  };

  const handleDelete = async (id: string, itemTitulo: string) => {
    if (await confirm({ title: `Remover "${itemTitulo}"?`, message: 'O item deixa de aparecer para todos os moradores.', confirmLabel: 'Remover', destructive: true })) {
      const res = await deleteDocument(id);
      setFeedbackMsg({ type: res.success ? 'success' : 'error', text: res.message });
    }
  };

  return (
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

          <div className="flex items-center gap-2">
            {isSindico && (
              <button
                type="button"
                onClick={handleOpenNewDoc}
                className="flex items-center gap-2 rounded-xl bg-[#0B2545] px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-[#134074]"
              >
                <Plus className="h-4 w-4 text-[#00A8E8]" />
                <span>Cadastrar Link / Documento</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50"
            >
              <Printer className="h-4 w-4 text-slate-500" />
              <span>Imprimir Guia</span>
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
            <button onClick={() => setFeedbackMsg(null)} aria-label="Fechar mensagem" className="text-slate-500 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

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
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:shadow-md relative group"
              >
                <div className="flex items-start justify-between">
                  <div className="rounded-xl bg-red-50 p-2.5 text-red-600">
                    <PhoneCall className="h-5 w-5" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge className="bg-slate-100 text-slate-600">Emergência</Badge>
                    {isSindico && (
                      <button
                        onClick={() => handleDelete(c.id, c.titulo)}
                        title="Excluir Contato"
                        aria-label={`Excluir contato ${c.titulo}`}
                        className="opacity-60 hover:opacity-100 transition rounded-lg p-1 text-slate-500 hover:bg-red-50 hover:text-red-600 no-print"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <h3 className="mt-3 text-sm font-bold text-slate-900">{c.titulo}</h3>
                <p className="mt-1 text-xs text-slate-500">{c.descricao}</p>

                <div className="mt-4 border-t border-slate-100 pt-3 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-500 block font-semibold">Contato:</span>
                    <a
                      href={`tel:${c.telefone?.replace(/[^0-9]/g, '')}`}
                      className="text-base font-bold text-[#0B2545] hover:text-[#0A6E9C] transition"
                    >
                      {c.telefone || 'Consulte a portaria'}
                    </a>
                  </div>
                  {c.linkExterno && c.linkExterno !== '#' && (
                    <a
                      href={c.linkExterno}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#0A6E9C] hover:underline flex items-center gap-1"
                    >
                      <span>Mais info</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}

            {/* Zelador Atual */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:shadow-md relative group">
              <div className="flex items-start justify-between">
                <div className="rounded-xl bg-amber-50 p-2.5 text-amber-700">
                  <Wrench className="h-5 w-5" />
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge className="bg-slate-100 text-slate-600">Zeladoria</Badge>
                  {isSindico && (
                    <button
                      onClick={handleOpenZeladorModal}
                      title="Editar Dados do Zelador"
                      aria-label="Editar dados do zelador"
                      className="opacity-60 hover:opacity-100 transition rounded-lg p-1 text-slate-500 hover:bg-sky-50 hover:text-[#0A6E9C] no-print"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <h3 className="mt-3 text-sm font-bold text-slate-900">
                {zelador?.nome || 'Zelador ainda não cadastrado'}
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                {zelador?.horarioAtendimento || 'Cadastre o horário de atendimento.'}
              </p>

              <div className="mt-4 border-t border-slate-100 pt-3">
                <span className="text-xs text-slate-500 block font-semibold">Contato:</span>
                {zelador?.telefone ? (
                  <a
                    href={`tel:${zelador.telefone.replace(/[^0-9]/g, '')}`}
                    className="text-base font-bold text-[#0B2545] hover:text-[#0A6E9C] transition"
                  >
                    {zelador.telefone}
                  </a>
                ) : (
                  <span className="text-xs text-slate-500">Sem telefone cadastrado</span>
                )}
              </div>
            </div>

            {/* Administradora Predial Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:shadow-md relative group">
              <div className="flex items-start justify-between">
                <div className="rounded-xl bg-blue-50 p-2.5 text-[#0B2545]">
                  <Building className="h-5 w-5" />
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge className="bg-blue-100 text-[#0B2545]">Financeiro</Badge>
                  {isSindico && (
                    <button
                      onClick={handleOpenPortalModal}
                      title="Editar Portal da Administradora"
                      aria-label="Editar Portal da Administradora"
                      className="opacity-60 hover:opacity-100 transition rounded-lg p-1 text-slate-500 hover:bg-sky-50 hover:text-[#0A6E9C] no-print"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <h3 className="mt-3 text-sm font-bold text-slate-900">Portal da Administradora</h3>
              <p className="mt-1 text-xs text-slate-500">
                {portalAdministradora?.descricao || 'Cadastre a descrição do portal.'}
              </p>

              <div className="mt-4 border-t border-slate-100 pt-3">
                {portalAdministradora?.linkExterno ? (
                  <a
                    href={portalAdministradora.linkExterno}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0A6E9C] hover:underline"
                  >
                    <span>Acessar Portal do Condômino</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : (
                  <span className="text-xs text-slate-500">Link ainda não cadastrado.</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Documentos Oficiais em PDF / Nuvem */}
        <div className="space-y-3 pt-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <FileCheck2 className="h-4 w-4 text-[#00A8E8]" />
            <span>Documentos Regulatórios & Atas Oficiais</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {officialDocuments.length === 0 ? (
              <div className="col-span-2 rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
                Nenhum documento regulatório cadastrado.
              </div>
            ) : (
              officialDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between transition hover:shadow-md relative group"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="rounded-md bg-sky-50 px-2 py-0.5 text-[12px] font-bold text-[#0B2545]">
                        {doc.categoria}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] text-slate-500">
                          Atualizado em {doc.dataAtualizacao}
                        </span>
                        {isSindico && (
                          <button
                            onClick={() => handleDelete(doc.id, doc.titulo)}
                            title="Excluir Documento"
                            aria-label={`Excluir documento ${doc.titulo}`}
                            className="opacity-60 hover:opacity-100 transition rounded-lg p-1 text-slate-500 hover:bg-red-50 hover:text-red-600 no-print"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <h3 className="mt-3 text-sm font-bold text-slate-900">{doc.titulo}</h3>
                    <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                      {doc.descricao}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                    <span className="text-slate-500 font-mono text-[12px]">
                      {doc.tamanhoArquivo || 'Link Externo'}
                    </span>

                    <a
                      href={doc.linkExterno}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3.5 py-1.5 font-bold text-[#0B2545] transition hover:bg-[#0B2545] hover:text-white no-print"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>Abrir Documento</span>
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      {/* Modal de Cadastro de Link / Documento (Síndico) */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs no-print">
          <div className="fixed inset-0" onClick={() => setShowModal(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="doc-modal-title"
            className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-[#00A8E8]" />
                <h3 id="doc-modal-title" className="text-base font-bold text-slate-900">Cadastrar Novo Documento / Link</h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                aria-label="Fechar"
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDocument} className="mt-4 space-y-4">
              <div>
                <label htmlFor="doc-titulo" className="block text-xs font-semibold text-slate-700">Título do Documento / Canal</label>
                <input
                  id="doc-titulo"
                  type="text"
                  required
                  placeholder="Ex: Ata da Assembleia Geral Ordinária 2026, Polícia Militar"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="doc-categoria" className="block text-xs font-semibold text-slate-700">Categoria</label>
                  <select
                    id="doc-categoria"
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value as DocumentLink['categoria'])}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20 font-semibold text-slate-800"
                  >
                    <option value="ATA">Ata de Assembleia</option>
                    <option value="REGIMENTO">Regimento Interno</option>
                    <option value="CONVENCAO">Convenção Condominial</option>
                    <option value="FINANCEIRO">Financeiro / Balancete</option>
                    <option value="EMERGENCIA">Telefone de Emergência</option>
                  </select>
                </div>

                {categoria === 'EMERGENCIA' ? (
                  <div>
                    <label htmlFor="doc-telefone" className="block text-xs font-semibold text-slate-700">Telefone / Ramal</label>
                    <input
                      id="doc-telefone"
                      type="text"
                      placeholder="Ex: 190 ou (11) 99999-9999"
                      value={telefone}
                      onChange={(e) => setTelefone(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
                    />
                  </div>
                ) : (
                  <div>
                    <label htmlFor="doc-tamanho" className="block text-xs font-semibold text-slate-700">Formato / Tamanho (opcional)</label>
                    <input
                      id="doc-tamanho"
                      type="text"
                      placeholder="Ex: PDF (1.5 MB)"
                      value={tamanhoArquivo}
                      onChange={(e) => setTamanhoArquivo(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
                    />
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="doc-descricao" className="block text-xs font-semibold text-slate-700">Descrição / Instruções</label>
                <textarea
                  id="doc-descricao"
                  rows={2}
                  required
                  placeholder="Ex: Decisões aprovadas na assembleia de eleição do síndico e previsão orçamentária."
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
                />
              </div>

              <div>
                <label htmlFor="doc-link" className="block text-xs font-semibold text-slate-700">
                  Link Externo do Documento (Google Drive, OneDrive, etc.)
                </label>
                <input
                  id="doc-link"
                  type="url"
                  required
                  placeholder="https://drive.google.com/file/d/... ou https://..."
                  value={linkExterno}
                  onChange={(e) => setLinkExterno(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
                />
                <span className="text-[12px] text-slate-500">
                  Insira a URL pública ou compartilhada do arquivo para os moradores acessarem.
                </span>
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
                  Salvar Documento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Edição dos Dados do Zelador (Síndico/ADM) */}
      {showZeladorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs no-print">
          <div className="fixed inset-0" onClick={() => setShowZeladorModal(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="zelador-modal-title"
            className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Wrench className="h-5 w-5 text-amber-600" />
                <h3 id="zelador-modal-title" className="text-base font-bold text-slate-900">Dados do Zelador Atual</h3>
              </div>
              <button
                onClick={() => setShowZeladorModal(false)}
                aria-label="Fechar"
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveZelador} className="mt-4 space-y-4">
              <div>
                <label htmlFor="zelador-nome" className="block text-xs font-semibold text-slate-700">Nome</label>
                <input
                  id="zelador-nome"
                  type="text"
                  required
                  placeholder="Ex: Sr. Antonio"
                  value={zNome}
                  onChange={(e) => setZNome(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
                />
              </div>
              <div>
                <label htmlFor="zelador-telefone" className="block text-xs font-semibold text-slate-700">Telefone / Ramal</label>
                <input
                  id="zelador-telefone"
                  type="text"
                  required
                  placeholder="Ex: (11) 98777-6655 / Ramal 91"
                  value={zTelefone}
                  onChange={(e) => setZTelefone(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
                />
              </div>
              <div>
                <label htmlFor="zelador-horario" className="block text-xs font-semibold text-slate-700">Horário de Atendimento</label>
                <input
                  id="zelador-horario"
                  type="text"
                  required
                  placeholder="Ex: Das 08h às 17h, de segunda a sábado"
                  value={zHorario}
                  onChange={(e) => setZHorario(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
                />
              </div>
              <div>
                <label htmlFor="zelador-obs" className="block text-xs font-semibold text-slate-700">Observações (opcional)</label>
                <textarea
                  id="zelador-obs"
                  rows={2}
                  placeholder="Ex: Ausente aos domingos e feriados."
                  value={zObs}
                  onChange={(e) => setZObs(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
                />
              </div>

              <div className="mt-5 flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowZeladorModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#0B2545] px-4 py-2 text-xs font-semibold text-white hover:bg-[#134074]"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Edição do Portal da Administradora (Síndico/ADM) */}
      {showPortalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs no-print">
          <div className="fixed inset-0" onClick={() => setShowPortalModal(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="portal-modal-title"
            className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Building className="h-5 w-5 text-[#0B2545]" />
                <h3 id="portal-modal-title" className="text-base font-bold text-slate-900">Portal da Administradora</h3>
              </div>
              <button
                onClick={() => setShowPortalModal(false)}
                aria-label="Fechar"
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSavePortal} className="mt-4 space-y-4">
              <div>
                <label htmlFor="portal-descricao" className="block text-xs font-semibold text-slate-700">Descrição</label>
                <textarea
                  id="portal-descricao"
                  rows={2}
                  required
                  placeholder="Ex: Emissão de 2ª via de boletos e demonstrativos de despesas."
                  value={pDescricao}
                  onChange={(e) => setPDescricao(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
                />
              </div>
              <div>
                <label htmlFor="portal-link" className="block text-xs font-semibold text-slate-700">Link do Portal do Condômino</label>
                <input
                  id="portal-link"
                  type="url"
                  required
                  placeholder="https://portal.suaadministradora.com.br"
                  value={pLink}
                  onChange={(e) => setPLink(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
                />
              </div>

              <div className="mt-5 flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPortalModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#0B2545] px-4 py-2 text-xs font-semibold text-white hover:bg-[#134074]"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
