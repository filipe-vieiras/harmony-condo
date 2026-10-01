'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useDialog } from '@/components/ui/DialogProvider';
import { Badge } from '@/components/ui/Badge';
import { useApp } from '@/context/AppContext';
import { Role } from '@/types';
import { isAdmin, ROLE_LABELS, SINGLETON_ROLES } from '@/lib/roles';
import { useEscapeToClose } from '@/lib/useEscapeToClose';
import { useModalFocus } from '@/lib/useModalFocus';
import {
  UserCog,
  Plus,
  X,
  Link2,
  Copy,
  Check,
  Trash2,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Clock,
  KeyRound,
  MessageCircle,
} from 'lucide-react';

export default function UsuariosPage() {
  return (
    <AppShell>
      <UsuariosContent />
    </AppShell>
  );
}

const STAFF_ROLES: Role[] = ['SINDICO', 'SUBSINDICO', 'ADM', 'PORTARIA', 'CONSELHO'];

function UsuariosContent() {
  const {
    currentUser,
    systemUsers,
    pendingInvites,
    createStaffInvite,
    cancelPendingInvite,
    sendPendingInvites,
    deleteSystemUser,
    generatePasswordResetLink,
  } = useApp();
  const { confirm } = useDialog();

  const [showModal, setShowModal] = useState(false);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('PORTARIA');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  // Link recém-gerado (redefinição ou convite): fica na tela até a pessoa fechar. Só
  // copiar para a área de transferência não basta, porque no iOS a cópia costuma
  // falhar depois de uma chamada assíncrona e o link anterior já foi cancelado.
  const [linkPanel, setLinkPanel] = useState<{ nome: string; link: string } | null>(null);
  const [copiaFalhou, setCopiaFalhou] = useState(false);
  const [copiouPainel, setCopiouPainel] = useState(false);
  const linkPanelRef = useRef<HTMLDivElement>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (linkPanel) linkPanelRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [linkPanel]);

  useEscapeToClose(showModal, () => setShowModal(false));
  useModalFocus(showModal);

  if (!currentUser) return null;

  if (!isAdmin(currentUser.role)) {
    return (
      <div className="rounded-2xl border border-pendente-200 bg-pendente-50 p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-pendente-100 text-pendente-700">
          <Lock className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-base font-bold text-pendente-900">Área Restrita</h2>
        <p className="mx-auto mt-2 max-w-md text-xs text-pendente-700">
          A gestão de usuários e convites de acesso é reservada ao Síndico, ao Subsíndico e à Administradora.
        </p>
      </div>
    );
  }

  const isRoleTaken = (r: Role) =>
    SINGLETON_ROLES.includes(r) &&
    (systemUsers.some((u) => u.role === r) || pendingInvites.some((i) => i.role === r && i.status === 'PENDENTE'));

  const handleOpenModal = () => {
    setNome('');
    setEmail('');
    setRole('PORTARIA');
    setFeedbackMsg(null);
    setShowModal(true);
  };

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await createStaffInvite({ nome, email, role });
    if (res.success) {
      setShowModal(false);
      setFeedbackMsg({ type: 'success', text: res.message });
    } else {
      setFeedbackMsg({ type: 'error', text: res.message });
    }
  };

  // Inclui ERRO junto com PENDENTE: reenviar um convite que falhou (ex: limite de
  // e-mail do Supabase) reaproveita o mesmo registro em vez de duplicar.
  const pendentes = pendingInvites.filter((i) => i.status === 'PENDENTE' || i.status === 'ERRO');

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) => (prev.length === pendentes.length ? [] : pendentes.map((i) => i.id)));
  };

  const handleSendSelected = async () => {
    setSending(true);
    const res = await sendPendingInvites(selectedIds);
    setSending(false);
    setSelectedIds([]);
    setFeedbackMsg({ type: res.success ? 'success' : 'error', text: res.message });
  };

  const mostrarLink = (nome: string, link: string) => {
    setCopiaFalhou(false);
    setCopiouPainel(false);
    setLinkPanel({ nome, link });
  };

  const copiarDoPainel = async () => {
    if (!linkPanel) return;
    try {
      await navigator.clipboard.writeText(linkPanel.link);
      setCopiaFalhou(false);
      setCopiouPainel(true);
      setTimeout(() => setCopiouPainel(false), 2000);
    } catch {
      // Sem susto: o link continua no campo, é só selecionar e copiar.
      setCopiouPainel(false);
      setCopiaFalhou(true);
      linkInputRef.current?.focus();
      linkInputRef.current?.select();
    }
  };

  const handleCopyLink = async (id: string, link?: string, nome?: string) => {
    if (!link) {
      setFeedbackMsg({ type: 'error', text: 'Link de acesso não encontrado. Gere novamente.' });
      return;
    }
    mostrarLink(nome ?? 'o convite', link);
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(id);
      setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 2000);
    } catch {
      setCopiaFalhou(true); // o painel mostra o link e pede para selecionar e copiar
    }
  };

  const handleDeleteUser = async (userId: string, nome: string) => {
    if (!(await confirm({ title: `Excluir o acesso de ${nome}?`, message: 'Essa ação não pode ser desfeita.', confirmLabel: 'Excluir acesso', destructive: true }))) return;
    const res = await deleteSystemUser(userId);
    setFeedbackMsg({ type: res.success ? 'success' : 'error', text: res.message });
  };

  const handleResetPassword = async (userId: string, nome: string) => {
    const res = await generatePasswordResetLink(userId);
    if (!res.success || !res.link) {
      setFeedbackMsg({ type: 'error', text: res.message });
      return;
    }
    mostrarLink(nome, res.link);
    try {
      await navigator.clipboard.writeText(res.link);
      setCopiedId(`reset-${userId}`);
      setTimeout(() => setCopiedId((current) => (current === `reset-${userId}` ? null : current)), 2000);
      setFeedbackMsg({ type: 'success', text: `${res.message} Link copiado — cole e envie pro usuário. Atenção: gerar um novo link cancela o anterior, vale só o último.` });
    } catch {
      setFeedbackMsg({ type: 'success', text: res.message });
    }
  };

  const statusBadge: Record<string, { label: string; bg: string; text: string; icon: React.ReactNode }> = {
    PENDENTE: { label: 'Link pendente de gerar', bg: 'bg-pendente-50', text: 'text-pendente-800', icon: <Clock className="h-3 w-3" /> },
    ENVIADO: { label: 'Link gerado', bg: 'bg-accent-50', text: 'text-accent-800', icon: <CheckCircle2 className="h-3 w-3" /> },
    ERRO: { label: 'Erro ao gerar', bg: 'bg-red-50', text: 'text-red-800', icon: <AlertTriangle className="h-3 w-3" /> },
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho de Tela */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <UserCog className="h-6 w-6 text-accent" />
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Usuários & Convites de Acesso</h1>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Cadastre a equipe (Síndico, Subsíndico, Administradora, Portaria, Conselho) e controle o envio dos convites de acesso.
          </p>
        </div>

        <button
          onClick={handleOpenModal}
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-primary-hover sm:min-h-0"
        >
          <Plus className="h-4 w-4 text-accent" />
          <span>Novo Usuário da Equipe</span>
        </button>
      </div>

      {feedbackMsg && (
        <div
          role={feedbackMsg.type === 'error' ? 'alert' : 'status'}
          className={`rounded-2xl p-4 text-xs font-semibold flex items-center justify-between ${
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

      {linkPanel && (
        <div
          ref={linkPanelRef}
          role="region"
          aria-label={`Link de acesso para ${linkPanel.nome}`}
          className="scroll-mt-20 rounded-2xl border border-accent-200 bg-accent-50/60 p-4 sm:p-5"
        >
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-900">Link de acesso para {linkPanel.nome}</h2>
            <button
              type="button"
              onClick={() => setLinkPanel(null)}
              aria-label="Fechar o link de acesso"
              className="-mr-2 -mt-2 flex size-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-white/70 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <label htmlFor="link-acesso-campo" className="sr-only">Link de acesso</label>
          <input
            id="link-acesso-campo"
            ref={linkInputRef}
            readOnly
            value={linkPanel.link}
            onFocus={(e) => e.currentTarget.select()}
            className="mt-2 block min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 select-all focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-strong/30 sm:text-xs"
          />
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={copiarDoPainel}
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-primary-hover"
            >
              {copiouPainel ? <Check className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4 text-accent" />}
              <span>{copiouPainel ? 'Copiado!' : 'Copiar'}</span>
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Olá! Este é o seu link de acesso ao portal do condomínio: ${linkPanel.link}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 transition hover:bg-slate-50"
            >
              <MessageCircle className="h-4 w-4 text-emerald-600" />
              <span>Enviar por WhatsApp</span>
            </a>
          </div>
          {copiaFalhou && (
            <p role="status" className="mt-2 text-xs font-semibold text-slate-700">
              Selecione o link e copie.
            </p>
          )}
          <p className="mt-2 text-xs text-slate-600">Cada link vale uma vez só; gerar outro cancela este.</p>
        </div>
      )}

      {/* Equipe Atual */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50/75 p-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            Equipe com Acesso Ativo ({systemUsers.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="stack-mobile w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[12px] font-bold text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">E-mail</th>
                <th className="px-4 py-3">Perfil</th>
                <th className="px-4 py-3">Unidade</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {systemUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">Nenhum usuário carregado.</td>
                </tr>
              ) : (
                systemUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/50">
                    <td data-label="Nome" className="px-4 py-3 font-semibold text-slate-900">{u.name}</td>
                    <td data-label="E-mail" className="px-4 py-3 text-slate-600">{u.email}</td>
                    <td data-label="Perfil" className="px-4 py-3">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[12px] font-bold text-slate-700">
                        {ROLE_LABELS[u.role]}
                      </span>
                    </td>
                    <td data-label="Unidade" className="px-4 py-3 text-slate-500">
                      {u.unidade ? `Apto ${u.unidade}-${u.bloco}` : '—'}
                    </td>
                    <td data-label="Ações" className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2 sm:gap-1">
                        <button
                          onClick={() => handleResetPassword(u.id, u.name)}
                          title="Gerar link de redefinição de senha"
                          aria-label={`Gerar link de redefinição de senha de ${u.name}`}
                          className="flex min-h-11 items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition sm:min-h-0"
                        >
                          {copiedId === `reset-${u.id}` ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                              <span>Copiado!</span>
                            </>
                          ) : (
                            <>
                              <KeyRound className="h-3.5 w-3.5" />
                              <span>Redefinir Senha</span>
                            </>
                          )}
                        </button>
                        {u.id !== currentUser.id && (
                          <button
                            onClick={() => handleDeleteUser(u.id, u.name)}
                            title="Excluir acesso"
                            aria-label={`Excluir acesso de ${u.name}`}
                            className="flex size-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 transition sm:size-auto sm:p-1.5"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fila de Convites */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50/75 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            Fila de Convites ({pendingInvites.length})
          </h2>
          {pendentes.length > 0 && (
            <button
              onClick={handleSendSelected}
              disabled={selectedIds.length === 0 || sending}
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed sm:min-h-0"
            >
              <Link2 className="h-3.5 w-3.5 text-accent" />
              <span>{sending ? 'Gerando...' : `Gerar Links Selecionados (${selectedIds.length})`}</span>
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="stack-mobile w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[12px] font-bold text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3 w-8">
                  {pendentes.length > 0 && (
                    <input
                      type="checkbox"
                      aria-label="Selecionar todos os convites"
                      checked={selectedIds.length === pendentes.length}
                      onChange={toggleSelectAll}
                      className="size-5 rounded border-slate-300 text-primary focus:ring-accent-strong"
                    />
                  )}
                </th>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">E-mail</th>
                <th className="px-4 py-3">Perfil</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pendingInvites.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    Nenhum convite na fila. Cadastre um morador ou um usuário da equipe para começar.
                  </td>
                </tr>
              ) : (
                pendingInvites.map((i) => {
                  const st = statusBadge[i.status];
                  return (
                    <tr key={i.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        {(i.status === 'PENDENTE' || i.status === 'ERRO') && (
                          <label className="flex size-11 cursor-pointer items-center justify-center sm:size-auto">
                            <input
                              type="checkbox"
                              aria-label={`Selecionar convite de ${i.nome}`}
                              checked={selectedIds.includes(i.id)}
                              onChange={() => toggleSelected(i.id)}
                              className="size-5 rounded border-slate-300 text-primary focus:ring-accent-strong"
                            />
                          </label>
                        )}
                      </td>
                      <td data-label="Nome" className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">
                        {i.nome}
                        {i.unidade && <span className="ml-1.5 text-[12px] text-slate-500">Apto {i.unidade}-{i.bloco}</span>}
                      </td>
                      <td data-label="E-mail" className="px-4 py-3 text-slate-600">{i.email}</td>
                      <td data-label="Perfil" className="px-4 py-3 whitespace-nowrap">
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[12px] font-bold text-slate-700 whitespace-nowrap">
                          {ROLE_LABELS[i.role]}
                        </span>
                      </td>
                      <td data-label="Status" className="px-4 py-3 whitespace-nowrap">
                        <Badge className={`${st.bg} ${st.text}`} icon={st.icon} title={i.erroMensagem}>
                          {st.label}
                        </Badge>
                      </td>
                      <td data-label="Ações" className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {i.status === 'ENVIADO' && (
                            <button
                              onClick={() => handleCopyLink(i.id, i.linkAcesso, i.nome)}
                              title="Copiar link de acesso"
                              aria-label={`Copiar link de acesso de ${i.nome}`}
                              className="flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1.5 text-[12px] font-bold text-slate-600 hover:bg-slate-100 transition sm:min-h-0"
                            >
                              {copiedId === i.id ? (
                                <>
                                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                                  <span>Copiado!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3.5 w-3.5" />
                                  <span>Copiar Link</span>
                                </>
                              )}
                            </button>
                          )}
                          {i.status !== 'ENVIADO' && (
                            <button
                              onClick={() => cancelPendingInvite(i.id)}
                              title={i.status === 'ERRO' ? 'Remover da fila' : 'Cancelar convite'}
                              aria-label={`${i.status === 'ERRO' ? 'Remover da fila' : 'Cancelar convite de'} ${i.nome}`}
                              className="flex size-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 transition sm:size-auto sm:p-1.5"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Novo Usuário da Equipe */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="fixed inset-0" onClick={() => setShowModal(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="usuario-modal-title"
            className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <UserCog className="h-5 w-5 text-accent" />
                <h3 id="usuario-modal-title" className="text-base font-bold text-slate-900">Novo Usuário da Equipe</h3>
              </div>
              <button onClick={() => setShowModal(false)} aria-label="Fechar" className="flex size-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 sm:size-auto sm:p-1">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateInvite} className="mt-4 space-y-4">
              <div>
                <label htmlFor="usuario-nome" className="block text-xs font-semibold text-slate-700">Nome Completo</label>
                <input
                  id="usuario-nome"
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-strong/30"
                />
              </div>
              <div>
                <label htmlFor="usuario-email" className="block text-xs font-semibold text-slate-700">E-mail</label>
                <input
                  id="usuario-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-strong/30"
                />
              </div>
              <div>
                <label htmlFor="usuario-perfil" className="block text-xs font-semibold text-slate-700">Perfil de Acesso</label>
                <select
                  id="usuario-perfil"
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-strong/30"
                >
                  {STAFF_ROLES.map((r) => (
                    <option key={r} value={r} disabled={isRoleTaken(r)}>
                      {ROLE_LABELS[r]} {isRoleTaken(r) ? '(já ocupado)' : ''}
                    </option>
                  ))}
                </select>
                <span className="text-[12px] text-slate-500">
                  Síndico e Subsíndico têm um único titular por vez. A Administradora pode ter várias contas.
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
                  disabled={isRoleTaken(role)}
                  className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Criar convite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
