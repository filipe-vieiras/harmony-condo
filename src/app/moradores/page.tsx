'use client';

import React, { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { PrintReportHeader } from '@/components/reports/PrintReportHeader';
import { useDialog } from '@/components/ui/DialogProvider';
import { Badge } from '@/components/ui/Badge';
import { useApp } from '@/context/AppContext';
import { Unit } from '@/types';
import { isAdmin } from '@/lib/roles';
import { useEscapeToClose } from '@/lib/useEscapeToClose';
import {
  Users,
  Search,
  Plus,
  Phone,
  Mail,
  Car,
  PawPrint,
  ShieldCheck,
  Building2,
  Printer,
  X,
  Crown,
  Trash2,
  UserPlus,
  Pencil,
  Link2,
  Copy,
  Check,
  CheckCircle2,
  AlertTriangle,
  Lock,
} from 'lucide-react';

export default function MoradoresPage() {
  return (
    <AppShell>
      <MoradoresContent />
    </AppShell>
  );
}

function MoradoresContent() {
  const { currentUser, units, pendingInvites, addUnit, updateUnit, deleteUnit, sendInviteForUnit } = useApp();
  const { confirm } = useDialog();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBloco, setFilterBloco] = useState<string>('TODOS');
  const [showModal, setShowModal] = useState(false);
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [sendingInviteId, setSendingInviteId] = useState<string | null>(null);
  const [copiedUnitId, setCopiedUnitId] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEscapeToClose(showModal, () => setShowModal(false));

  // Form states para nova unidade e moradores
  const [novoNumero, setNovoNumero] = useState('');
  const [novoBloco, setNovoBloco] = useState('A');
  const [novoTipo, setNovoTipo] = useState<'PROPRIETARIO' | 'INQUILINO'>('PROPRIETARIO');
  const [novasVagas, setNovasVagas] = useState('');
  const [novosAnimais, setNovosAnimais] = useState('');
  const [novasObservacoes, setNovasObservacoes] = useState('');

  // Morador Principal / Titular
  const [titularNome, setTitularNome] = useState('');
  const [titularTelefone, setTitularTelefone] = useState('');
  const [titularEmail, setTitularEmail] = useState('');
  const [titularRgCpf, setTitularRgCpf] = useState('');

  // Dados do Proprietário Legal (caso seja alugado)
  const [proprietarioNome, setProprietarioNome] = useState('');
  const [proprietarioTelefone, setProprietarioTelefone] = useState('');
  const [proprietarioEmail, setProprietarioEmail] = useState('');

  // Demais moradores vinculados
  const [demaisMoradores, setDemaisMoradores] = useState<
    Array<{ nome: string; tipo: 'DEPENDENTE' | 'INQUILINO'; telefone: string; rgCpf: string }>
  >([]);

  const handleAddMorador = () => {
    setDemaisMoradores((prev) => [
      ...prev,
      { nome: '', tipo: 'DEPENDENTE', telefone: '', rgCpf: '' },
    ]);
  };

  const handleRemoveMorador = (index: number) => {
    setDemaisMoradores((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateMorador = (index: number, field: string, value: string) => {
    setDemaisMoradores((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m))
    );
  };

  const filteredUnits = units.filter((u) => {
    const matchesSearch =
      u.numero.includes(searchTerm) ||
      u.proprietarioNome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.moradores && u.moradores.some((m) => m.nome.toLowerCase().includes(searchTerm.toLowerCase())));
    const matchesBloco = filterBloco === 'TODOS' || u.bloco === filterBloco;
    return matchesSearch && matchesBloco;
  });

  const resetForm = () => {
    setNovoNumero('');
    setNovoBloco('A');
    setNovoTipo('PROPRIETARIO');
    setTitularNome('');
    setTitularTelefone('');
    setTitularEmail('');
    setTitularRgCpf('');
    setProprietarioNome('');
    setProprietarioTelefone('');
    setProprietarioEmail('');
    setNovasVagas('');
    setNovosAnimais('');
    setNovasObservacoes('');
    setDemaisMoradores([]);
    setEditingUnitId(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setShowModal(true);
  };

  const handleOpenEdit = (u: Unit) => {
    const principal = u.moradores?.[0];
    setEditingUnitId(u.id);
    setNovoNumero(u.numero);
    setNovoBloco(u.bloco);
    setNovoTipo(u.tipoOcupacao === 'INQUILINO' ? 'INQUILINO' : 'PROPRIETARIO');
    setNovasVagas(u.vagasGaragem.join(', '));
    setNovosAnimais(u.animais === 'Nenhum' ? '' : u.animais);
    setNovasObservacoes(u.observacoes ?? '');
    setTitularNome(principal?.nome ?? u.proprietarioNome);
    setTitularTelefone(principal?.telefone ?? u.proprietarioTelefone);
    setTitularEmail(principal?.email ?? u.proprietarioEmail ?? '');
    setTitularRgCpf(principal?.rgCpf ?? '');
    setProprietarioNome(u.proprietarioNome);
    setProprietarioTelefone(u.proprietarioTelefone);
    setProprietarioEmail(u.proprietarioEmail);
    setDemaisMoradores(
      (u.moradores ?? []).slice(1).map((m) => ({
        nome: m.nome,
        tipo: m.tipo === 'INQUILINO' ? 'INQUILINO' : 'DEPENDENTE',
        telefone: m.telefone,
        rgCpf: m.rgCpf ?? '',
      }))
    );
    setShowModal(true);
  };

  const handleDeleteUnit = async (u: Unit) => {
    if (await confirm({ title: `Excluir a Unidade ${u.numero} (Bloco ${u.bloco})?`, message: 'Essa ação não pode ser desfeita.', confirmLabel: 'Excluir unidade', destructive: true })) {
      const res = await deleteUnit(u.id);
      setFeedbackMsg({ type: res.success ? 'success' : 'error', text: res.message });
    }
  };

  // Remove um morador adicional direto pelo card, sem precisar abrir o modal de edição.
  const handleRemoveResidentFromCard = async (u: Unit, moradorIndex: number) => {
    const morador = u.moradores[moradorIndex];
    if (!morador) return;
    if (!(await confirm({ title: `Remover ${morador.nome} da Unidade ${u.numero}?`, confirmLabel: 'Remover', destructive: true }))) return;

    const novosMoradores = u.moradores.filter((_, i) => i !== moradorIndex);
    const res = await updateUnit(u.id, { moradores: novosMoradores });
    setFeedbackMsg({
      type: res.success ? 'success' : 'error',
      text: res.success ? `${morador.nome} removido(a) da Unidade ${u.numero}.` : res.message,
    });
  };

  const handleSendInvite = async (u: Unit) => {
    setSendingInviteId(u.id);
    const res = await sendInviteForUnit(u.id);
    setSendingInviteId(null);
    setFeedbackMsg({ type: res.success ? 'success' : 'error', text: res.message });
  };

  const handleCopyLink = async (u: Unit) => {
    const invite = pendingInvites.find((i) => i.unitId === u.id && i.status === 'ENVIADO' && i.linkAcesso);
    if (!invite?.linkAcesso) {
      setFeedbackMsg({ type: 'error', text: 'Link de acesso não encontrado. Gere novamente.' });
      return;
    }
    try {
      await navigator.clipboard.writeText(invite.linkAcesso);
      setCopiedUnitId(u.id);
      setTimeout(() => setCopiedUnitId((current) => (current === u.id ? null : current)), 2000);
    } catch {
      setFeedbackMsg({ type: 'error', text: 'Não foi possível copiar o link automaticamente. Copie manualmente pela fila de convites em Usuários.' });
    }
  };

  const handleSaveUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoNumero || !titularNome || isSaving) return;
    setIsSaving(true);

    // Constrói lista completa de moradores
    const principalResident = {
      nome: titularNome,
      tipo: (novoTipo === 'PROPRIETARIO' ? 'TITULAR' : 'INQUILINO') as 'TITULAR' | 'INQUILINO',
      telefone: titularTelefone,
      rgCpf: titularRgCpf || undefined,
      // E-mail do morador prioritário — é para ele que vai o convite de acesso ao portal.
      email: titularEmail || undefined,
    };

    const validDemaisMoradores = demaisMoradores
      .filter((m) => m.nome.trim() !== '')
      .map((m) => ({
        nome: m.nome.trim(),
        tipo: m.tipo,
        telefone: m.telefone.trim(),
        rgCpf: m.rgCpf.trim() || undefined,
      }));

    const todosMoradores = [principalResident, ...validDemaisMoradores];

    // Se for Proprietário, dados do proprietário = titular
    const finalProprietarioNome = novoTipo === 'PROPRIETARIO' ? titularNome : (proprietarioNome || titularNome);
    const finalProprietarioTel = novoTipo === 'PROPRIETARIO' ? titularTelefone : (proprietarioTelefone || titularTelefone);
    const finalProprietarioEmail = novoTipo === 'PROPRIETARIO' ? titularEmail : (proprietarioEmail || titularEmail);

    const payload = {
      bloco: novoBloco,
      numero: novoNumero,
      proprietarioNome: finalProprietarioNome,
      proprietarioTelefone: finalProprietarioTel,
      proprietarioEmail: finalProprietarioEmail,
      tipoOcupacao: novoTipo,
      moradores: todosMoradores,
      vagasGaragem: novasVagas ? novasVagas.split(',').map((v) => v.trim()) : [],
      animais: novosAnimais || 'Nenhum',
      observacoes: novasObservacoes || undefined,
    };

    const res = editingUnitId
      ? await updateUnit(editingUnitId, payload)
      : await addUnit(payload);

    setFeedbackMsg({ type: res.success ? 'success' : 'error', text: res.message });
    setIsSaving(false);

    // Em caso de erro (ex: unidade duplicada), mantém o modal aberto com os dados
    // preenchidos para o síndico corrigir, em vez de descartar o que foi digitado.
    if (res.success) {
      setShowModal(false);
      resetForm();
    }
  };

  if (!currentUser) return false;

  // Restrição estrita de acesso: dados de outros moradores (telefone, e-mail,
  // RG/CPF) não podem ficar visíveis para um morador comum via URL direta.
  if (currentUser.role === 'MORADOR') {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <Lock className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-base font-bold text-amber-900">
          Acesso Restrito ao Cadastro de Moradores
        </h2>
        <p className="mx-auto mt-2 max-w-md text-xs text-amber-700">
          Por diretrizes de sigilo e LGPD, os dados cadastrais de outras unidades e moradores são reservados à administração do condomínio (Síndico, Administradora, Portaria e Conselho Fiscal).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Cabeçalho impresso com o Logotipo Oficial */}
      <PrintReportHeader
        titulo="Relação Cadastral Geral de Moradores e Unidades"
        subtitulo="Listagem confidencial para fins administrativos e de segurança predial"
      />

      {/* Cabeçalho de Tela */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-6 w-6 text-[#00A8E8]" />
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
              Cadastro de Moradores & Unidades
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Gerenciamento de apartamentos, proprietários, dependentes e vagas de garagem.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50"
          >
            <Printer className="h-4 w-4 text-slate-500" />
            <span>Imprimir Relação</span>
          </button>

          {isAdmin(currentUser.role) && (
            <button
              onClick={handleOpenCreate}
              className="flex items-center gap-2 rounded-xl bg-[#0B2545] px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-[#134074]"
            >
              <Plus className="h-4 w-4 text-[#00A8E8]" />
              <span>Nova Unidade</span>
            </button>
          )}
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

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row items-center gap-3 no-print">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por número do apartamento ou nome do morador..."
            className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2 text-xs text-slate-900 placeholder:text-slate-500 focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-medium text-slate-600">Bloco:</span>
          <select
            value={filterBloco}
            onChange={(e) => setFilterBloco(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-[#00A8E8] focus:outline-none"
          >
            <option value="TODOS">Todos os Blocos</option>
            <option value="A">Bloco A</option>
            <option value="B">Bloco B</option>
          </select>
        </div>
      </div>

      {/* Lista / Grid de Unidades */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredUnits.map((u) => (
          <div
            key={u.id}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:shadow-md"
          >
            <div className="flex flex-wrap items-start justify-between gap-y-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0B2545] font-bold text-sm text-white">
                  {u.numero}
                </div>
                <div className="whitespace-nowrap">
                  <h3 className="font-bold text-sm text-slate-900">
                    Apartamento {u.numero}
                  </h3>
                  <span className="text-xs font-semibold text-[#0A6E9C]">
                    Bloco {u.bloco}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <Badge
                  className={
                    u.tipoOcupacao === 'PROPRIETARIO'
                      ? 'bg-blue-50 text-[#0B2545]'
                      : 'bg-emerald-50 text-emerald-800'
                  }
                >
                  {u.tipoOcupacao === 'PROPRIETARIO' ? 'Proprietário' : 'Inquilino'}
                </Badge>

                {isAdmin(currentUser.role) && (
                  <div className="flex items-center gap-1 no-print">
                    <button
                      onClick={() => handleOpenEdit(u)}
                      title="Editar Unidade"
                      aria-label={`Editar Unidade ${u.numero}`}
                      className="rounded-lg p-1 text-slate-500 hover:bg-sky-50 hover:text-[#00A8E8] transition"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteUnit(u)}
                      title="Excluir Unidade"
                      aria-label={`Excluir Unidade ${u.numero}`}
                      className="rounded-lg p-1 text-slate-500 hover:bg-red-50 hover:text-red-600 transition"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Informações do Morador Principal / Titular */}
            <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-700">
                  <Crown className="h-4 w-4 text-amber-500 shrink-0" />
                  <div>
                    <span className="font-bold text-slate-900 block">
                      {u.moradores && u.moradores.length > 0 ? u.moradores[0].nome : u.proprietarioNome}
                    </span>
                    <span className="text-[12px] text-slate-500">
                      Morador Principal ({u.tipoOcupacao === 'PROPRIETARIO' ? 'Proprietário' : 'Inquilino'})
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 text-slate-600">
                <Phone className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                <span>
                  {u.moradores && u.moradores.length > 0 ? u.moradores[0].telefone : u.proprietarioTelefone}
                </span>
              </div>

              <div className="flex items-center gap-2 text-slate-600">
                <Mail className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                <span className="truncate">{u.proprietarioEmail}</span>
              </div>

              {(() => {
                const prioritario = u.moradores?.find(
                  (m) => (m.tipo === 'TITULAR' || m.tipo === 'INQUILINO') && m.email
                );
                const podeEnviar = isAdmin(currentUser.role) && prioritario?.email &&
                  u.statusConvite !== 'ENVIADO' && u.statusConvite !== 'ATIVO';

                if (!u.statusConvite || u.statusConvite === 'NAO_ENVIADO') {
                  return podeEnviar ? (
                    <button
                      onClick={() => handleSendInvite(u)}
                      disabled={sendingInviteId === u.id}
                      className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[#0B2545] px-2.5 py-1 text-[12px] font-bold text-white transition hover:bg-[#134074] disabled:opacity-50 no-print"
                    >
                      <Link2 className="h-3 w-3 text-[#00A8E8]" />
                      <span>{sendingInviteId === u.id ? 'Gerando...' : 'Gerar Link de Acesso'}</span>
                    </button>
                  ) : null;
                }

                return (
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      className={
                        u.statusConvite === 'ATIVO'
                          ? 'bg-emerald-50 text-emerald-800'
                          : u.statusConvite === 'ENVIADO'
                          ? 'bg-sky-50 text-sky-800'
                          : 'bg-amber-50 text-amber-800'
                      }
                    >
                      {u.statusConvite === 'ATIVO' ? 'Acesso ativo' : u.statusConvite === 'ENVIADO' ? 'Link de acesso gerado' : 'Link pendente de gerar'}
                    </Badge>
                    {u.statusConvite === 'ENVIADO' && isAdmin(currentUser.role) && (
                      <button
                        onClick={() => handleCopyLink(u)}
                        className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-[12px] font-bold text-slate-700 transition hover:bg-slate-200 no-print"
                      >
                        {copiedUnitId === u.id ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-600" />
                            <span>Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3 text-slate-500" />
                            <span>Copiar Link</span>
                          </>
                        )}
                      </button>
                    )}
                    {podeEnviar && (
                      <button
                        onClick={() => handleSendInvite(u)}
                        disabled={sendingInviteId === u.id}
                        className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[#0B2545] px-2.5 py-1 text-[12px] font-bold text-white transition hover:bg-[#134074] disabled:opacity-50 no-print"
                      >
                        <Link2 className="h-3 w-3 text-[#00A8E8]" />
                        <span>{sendingInviteId === u.id ? 'Gerando...' : 'Gerar Novo Link'}</span>
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Demais Moradores da Propriedade */}
            {u.moradores && u.moradores.length > 1 && (
              <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-2.5 text-xs text-slate-600 space-y-1.5">
                <span className="font-bold text-slate-700 block text-[12px]">
                  Demais Moradores ({u.moradores.length - 1}):
                </span>
                <div className="space-y-1">
                  {u.moradores.slice(1).map((m, idx) => (
                    <div key={idx} className="flex items-center justify-between text-[12px] bg-white px-2 py-1 rounded border border-slate-100">
                      <span className="text-slate-800 font-medium">• {m.nome}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 font-mono text-[12px]">{m.telefone || m.tipo}</span>
                        {isAdmin(currentUser.role) && (
                          <button
                            onClick={() => handleRemoveResidentFromCard(u, idx + 1)}
                            title={`Remover ${m.nome}`}
                            aria-label={`Remover ${m.nome}`}
                            className="text-slate-300 hover:text-red-600 transition no-print"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Vagas & Pets */}
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-[12px] text-slate-500">
              <div className="flex items-center gap-1.5">
                <Car className="h-3.5 w-3.5 text-slate-500" />
                <span>
                  Vagas: <strong>{u.vagasGaragem.join(', ') || 'N/D'}</strong>
                </span>
              </div>

              {u.animais && u.animais !== 'Nenhum' && (
                <div className="flex items-center gap-1 text-amber-700" title={u.animais}>
                  <PawPrint className="h-3.5 w-3.5" />
                  <span className="max-w-[110px] truncate">{u.animais}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal para Nova Unidade com Múltiplos Moradores (Síndico) */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xs bg-slate-900/40 no-print">
          <div
            className="fixed inset-0"
            onClick={() => setShowModal(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="unidade-modal-title"
            className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-[#00A8E8]" />
                <h3 id="unidade-modal-title" className="text-base font-bold text-slate-900">
                  {editingUnitId ? 'Editar Unidade & Moradores' : 'Cadastrar Unidade & Moradores'}
                </h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                aria-label="Fechar"
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUnit} className="mt-4 space-y-5">
              
              {/* Seção 1: Dados do Imóvel */}
              <div className="space-y-3 rounded-xl bg-slate-50/70 p-4 border border-slate-100">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-[#00A8E8]" />
                  <span>1. Dados da Unidade</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="unidade-numero" className="block text-xs font-semibold text-slate-700">Número do Apto</label>
                    <input
                      id="unidade-numero"
                      type="text"
                      required
                      placeholder="Ex: 602"
                      value={novoNumero}
                      onChange={(e) => setNovoNumero(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
                    />
                  </div>
                  <div>
                    <label htmlFor="unidade-bloco" className="block text-xs font-semibold text-slate-700">Bloco</label>
                    <select
                      id="unidade-bloco"
                      value={novoBloco}
                      onChange={(e) => setNovoBloco(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20 font-semibold text-slate-800"
                    >
                      <option value="A">Bloco A</option>
                      <option value="B">Bloco B</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="unidade-tipo-ocupacao" className="block text-xs font-semibold text-slate-700">Tipo de Ocupação</label>
                    <select
                      id="unidade-tipo-ocupacao"
                      value={novoTipo}
                      onChange={(e) => setNovoTipo(e.target.value as 'PROPRIETARIO' | 'INQUILINO')}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20 font-semibold text-slate-800"
                    >
                      <option value="PROPRIETARIO">Proprietário Residente</option>
                      <option value="INQUILINO">Locatário (Inquilino)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="unidade-vagas" className="block text-xs font-semibold text-slate-700">Vagas de Garagem</label>
                    <input
                      id="unidade-vagas"
                      type="text"
                      placeholder="Ex: G1-12, G1-14"
                      value={novasVagas}
                      onChange={(e) => setNovasVagas(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
                    />
                  </div>
                  <div>
                    <label htmlFor="unidade-animais" className="block text-xs font-semibold text-slate-700">Animais de Estimação</label>
                    <input
                      id="unidade-animais"
                      type="text"
                      placeholder="Ex: 1 cão (Shih-tzu)"
                      value={novosAnimais}
                      onChange={(e) => setNovosAnimais(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
                    />
                  </div>
                </div>
              </div>

              {/* Seção 2: Morador Principal */}
              <div className="space-y-3 rounded-xl bg-slate-50/70 p-4 border border-slate-100">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Crown className="h-3.5 w-3.5 text-amber-500" />
                    <span>2. Morador Principal (Titular / Responsável)</span>
                  </h4>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[12px] font-bold text-amber-800">
                    Acesso ao Portal
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="titular-nome" className="block text-xs font-semibold text-slate-700">Nome Completo</label>
                    <input
                      id="titular-nome"
                      type="text"
                      required
                      placeholder="Nome do responsável"
                      value={titularNome}
                      onChange={(e) => setTitularNome(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
                    />
                  </div>
                  <div>
                    <label htmlFor="titular-rgcpf" className="block text-xs font-semibold text-slate-700">CPF ou RG</label>
                    <input
                      id="titular-rgcpf"
                      type="text"
                      placeholder="000.000.000-00"
                      value={titularRgCpf}
                      onChange={(e) => setTitularRgCpf(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="titular-telefone" className="block text-xs font-semibold text-slate-700">Telefone / WhatsApp</label>
                    <input
                      id="titular-telefone"
                      type="text"
                      required
                      placeholder="(11) 90000-0000"
                      value={titularTelefone}
                      onChange={(e) => setTitularTelefone(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
                    />
                  </div>
                  <div>
                    <label htmlFor="titular-email" className="block text-xs font-semibold text-slate-700">E-mail Principal</label>
                    <input
                      id="titular-email"
                      type="email"
                      required
                      placeholder="morador@exemplo.com"
                      value={titularEmail}
                      onChange={(e) => setTitularEmail(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
                    />
                  </div>
                </div>

                {/* Se for inquilino, permite adicionar dados do proprietário/locador */}
                {novoTipo === 'INQUILINO' && (
                  <div className="mt-3 border-t border-slate-200/80 pt-3 space-y-2">
                    <span className="text-[12px] font-bold text-slate-600 block">
                      Dados do Proprietário Legal (Locador) - Opcional para cobranças/notificações
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label htmlFor="proprietario-nome" className="sr-only">Nome do Proprietário</label>
                        <input
                          id="proprietario-nome"
                          type="text"
                          placeholder="Nome do Proprietário"
                          value={proprietarioNome}
                          onChange={(e) => setProprietarioNome(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
                        />
                      </div>
                      <div>
                        <label htmlFor="proprietario-telefone" className="sr-only">Telefone do Proprietário</label>
                        <input
                          id="proprietario-telefone"
                          type="text"
                          placeholder="Telefone do Proprietário"
                          value={proprietarioTelefone}
                          onChange={(e) => setProprietarioTelefone(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
                        />
                      </div>
                      <div>
                        <label htmlFor="proprietario-email" className="sr-only">E-mail do Proprietário</label>
                        <input
                          id="proprietario-email"
                          type="email"
                          placeholder="E-mail do Proprietário"
                          value={proprietarioEmail}
                          onChange={(e) => setProprietarioEmail(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Seção 3: Demais Moradores da Propriedade */}
              <div className="space-y-3 rounded-xl bg-slate-50/70 p-4 border border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-[#0B2545]" />
                      <span>3. Demais Moradores da Propriedade</span>
                    </h4>
                    <p className="text-[12px] text-slate-500">
                      Dependentes, cônjuges, filhos ou outros residentes do imóvel (sem login obrigatório).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddMorador}
                    className="flex items-center gap-1.5 rounded-xl bg-white border border-slate-200 px-3 py-1.5 text-xs font-semibold text-[#0B2545] shadow-xs hover:bg-slate-100 transition"
                  >
                    <Plus className="h-3.5 w-3.5 text-[#00A8E8]" />
                    <span>Adicionar Morador</span>
                  </button>
                </div>

                {demaisMoradores.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-white/60 p-4 text-center text-xs text-slate-500">
                    Nenhum morador adicional incluído. Clique em "+ Adicionar Morador" caso residam outras pessoas na unidade.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {demaisMoradores.map((m, index) => (
                      <div
                        key={index}
                        className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-700">
                            Morador Adicional #{index + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveMorador(index)}
                            className="text-slate-500 hover:text-red-600 transition"
                            title="Remover"
                            aria-label={`Remover Morador Adicional #${index + 1}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                          <div className="sm:col-span-2">
                            <label htmlFor={`morador-nome-${index}`} className="sr-only">Nome completo do residente</label>
                            <input
                              id={`morador-nome-${index}`}
                              type="text"
                              required
                              placeholder="Nome completo do residente"
                              value={m.nome}
                              onChange={(e) => handleUpdateMorador(index, 'nome', e.target.value)}
                              className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
                            />
                          </div>
                          <div>
                            <label htmlFor={`morador-tipo-${index}`} className="sr-only">Tipo de residente</label>
                            <select
                              id={`morador-tipo-${index}`}
                              value={m.tipo}
                              onChange={(e) => handleUpdateMorador(index, 'tipo', e.target.value)}
                              className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20 font-semibold text-slate-700"
                            >
                              <option value="DEPENDENTE">Dependente / Família</option>
                              <option value="INQUILINO">Co-inquilino</option>
                            </select>
                          </div>
                          <div>
                            <label htmlFor={`morador-telefone-${index}`} className="sr-only">Telefone / Contato</label>
                            <input
                              id={`morador-telefone-${index}`}
                              type="text"
                              placeholder="Telefone / Contato"
                              value={m.telefone}
                              onChange={(e) => handleUpdateMorador(index, 'telefone', e.target.value)}
                              className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setShowModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-xl bg-[#0B2545] px-5 py-2 text-xs font-semibold text-white hover:bg-[#134074] shadow-xs disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSaving
                    ? 'Salvando...'
                    : editingUnitId ? 'Salvar Alterações' : 'Salvar Cadastro da Unidade'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

