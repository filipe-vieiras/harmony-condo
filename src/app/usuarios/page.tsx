'use client';

import React, { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useApp } from '@/context/AppContext';
import { Role } from '@/types';
import { isAdmin, ROLE_LABELS, SINGLETON_ROLES } from '@/lib/roles';
import {
  UserCog,
  Plus,
  X,
  Send,
  Trash2,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from 'lucide-react';

export default function UsuariosPage() {
  return (
    <AppShell>
      <UsuariosContent />
    </AppShell>
  );
}

const STAFF_ROLES: Role[] = ['SINDICO', 'ADM', 'PORTARIA', 'CONSELHO'];

function UsuariosContent() {
  const {
    currentUser,
    systemUsers,
    pendingInvites,
    createStaffInvite,
    cancelPendingInvite,
    sendPendingInvites,
  } = useApp();

  const [showModal, setShowModal] = useState(false);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('PORTARIA');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [sending, setSending] = useState(false);

  if (!currentUser) return null;

  if (!isAdmin(currentUser.role)) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <Lock className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-base font-bold text-amber-900">Área Restrita</h2>
        <p className="mx-auto mt-2 max-w-md text-xs text-amber-700">
          A gestão de usuários e convites de acesso é reservada ao Síndico e à Administradora.
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

  const pendentes = pendingInvites.filter((i) => i.status === 'PENDENTE');

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

  const statusBadge: Record<string, { label: string; bg: string; text: string; icon: React.ReactNode }> = {
    PENDENTE: { label: 'Pendente de envio', bg: 'bg-amber-50', text: 'text-amber-800', icon: <Clock className="h-3 w-3" /> },
    ENVIADO: { label: 'Convite enviado', bg: 'bg-sky-50', text: 'text-sky-800', icon: <CheckCircle2 className="h-3 w-3" /> },
    ERRO: { label: 'Erro no envio', bg: 'bg-red-50', text: 'text-red-800', icon: <AlertTriangle className="h-3 w-3" /> },
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho de Tela */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <UserCog className="h-6 w-6 text-[#00A8E8]" />
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Usuários & Convites de Acesso</h1>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Cadastre a equipe (Síndico, Administradora, Portaria, Conselho) e controle o envio dos convites de acesso.
          </p>
        </div>

        <button
          onClick={handleOpenModal}
          className="flex items-center gap-2 rounded-xl bg-[#0B2545] px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-[#134074]"
        >
          <Plus className="h-4 w-4 text-[#00A8E8]" />
          <span>Novo Usuário da Equipe</span>
        </button>
      </div>

      {feedbackMsg && (
        <div
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
          <button onClick={() => setFeedbackMsg(null)} className="text-slate-400 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
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
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">E-mail</th>
                <th className="px-4 py-3">Perfil</th>
                <th className="px-4 py-3">Unidade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {systemUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400">Nenhum usuário carregado.</td>
                </tr>
              ) : (
                systemUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-semibold text-slate-900">{u.name}</td>
                    <td className="px-4 py-3 text-slate-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                        {ROLE_LABELS[u.role]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {u.unidade ? `Apto ${u.unidade}-${u.bloco}` : '—'}
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
              className="flex items-center gap-2 rounded-xl bg-[#0B2545] px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-[#134074] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send className="h-3.5 w-3.5 text-[#00A8E8]" />
              <span>{sending ? 'Enviando...' : `Enviar Convites Selecionados (${selectedIds.length})`}</span>
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3 w-8">
                  {pendentes.length > 0 && (
                    <input
                      type="checkbox"
                      checked={selectedIds.length === pendentes.length}
                      onChange={toggleSelectAll}
                      className="rounded border-slate-300 text-[#0B2545] focus:ring-[#00A8E8]"
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
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Nenhum convite na fila. Cadastre um morador ou um usuário da equipe para começar.
                  </td>
                </tr>
              ) : (
                pendingInvites.map((i) => {
                  const st = statusBadge[i.status];
                  return (
                    <tr key={i.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        {i.status === 'PENDENTE' && (
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(i.id)}
                            onChange={() => toggleSelected(i.id)}
                            className="rounded border-slate-300 text-[#0B2545] focus:ring-[#00A8E8]"
                          />
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {i.nome}
                        {i.unidade && <span className="ml-1.5 text-[11px] text-slate-400">Apto {i.unidade}-{i.bloco}</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{i.email}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                          {ROLE_LABELS[i.role]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${st.bg} ${st.text}`} title={i.erroMensagem}>
                          {st.icon}
                          <span>{st.label}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {i.status !== 'ENVIADO' && (
                          <button
                            onClick={() => cancelPendingInvite(i.id)}
                            title={i.status === 'ERRO' ? 'Remover da fila' : 'Cancelar convite'}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
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
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <UserCog className="h-5 w-5 text-[#00A8E8]" />
                <h3 className="text-base font-bold text-slate-900">Novo Usuário da Equipe</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateInvite} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#00A8E8] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">E-mail</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#00A8E8] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Perfil de Acesso</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 focus:border-[#00A8E8] focus:outline-none"
                >
                  {STAFF_ROLES.map((r) => (
                    <option key={r} value={r} disabled={isRoleTaken(r)}>
                      {ROLE_LABELS[r]} {isRoleTaken(r) ? '(já ocupado)' : ''}
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-slate-400">
                  Síndico e Administradora só podem ter um titular ativo por vez.
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
                  className="rounded-xl bg-[#0B2545] px-4 py-2 text-xs font-semibold text-white hover:bg-[#134074] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Adicionar à Fila de Convites
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
