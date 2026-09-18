'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  User,
  Role,
  Unit,
  Vehicle,
  Notice,
  FineNotice,
  CommonSpace,
  Reservation,
  InAppNotification,
  DocumentLink,
  AuditLog,
  PendingInvite,
  Zelador,
} from '@/types';
import { isAdmin } from '@/lib/roles';
import { INITIAL_SPACES, INITIAL_DOCS } from '@/lib/mockData';
import {
  fetchUnits, insertUnit, updateUnitDB, deleteUnitDB,
  fetchVehicles, insertVehicle, deleteVehicleDB,
  fetchNotices, insertNotice, deleteNoticeDB,
  fetchFines, insertFine, updateFineDB,
  fetchSpaces, insertSpace, updateSpaceDB, deleteSpaceDB,
  fetchReservations, insertReservation, updateReservationDB,
  fetchNotifications, insertNotification, markNotifReadDB, markAllNotifsReadDB,
  fetchDocuments, insertDocument, updateDocumentDB, deleteDocumentDB,
  fetchAuditLogs, insertAuditLog,
  fetchPendingInvites, insertPendingInvite, updatePendingInviteDB, deletePendingInviteDB,
  fetchZelador, updateZeladorDB,
  fetchProfiles,
} from '@/lib/supabase/db';

interface AppContextType {
  currentUser: User | null;
  isLoading: boolean;
  units: Unit[];
  addUnit: (unit: Omit<Unit, 'id'>) => Promise<{ success: boolean; message: string }>;
  updateUnit: (id: string, unit: Partial<Unit>) => Promise<{ success: boolean; message: string }>;
  deleteUnit: (id: string) => Promise<{ success: boolean; message: string }>;
  sendInviteForUnit: (unitId: string) => Promise<{ success: boolean; message: string }>;
  vehicles: Vehicle[];
  addVehicle: (vehicle: Omit<Vehicle, 'id'>) => Promise<void>;
  deleteVehicle: (id: string) => Promise<void>;
  notices: Notice[];
  addNotice: (notice: Omit<Notice, 'id' | 'data'>) => Promise<void>;
  deleteNotice: (id: string) => Promise<void>;
  fines: FineNotice[];
  addFine: (fine: Omit<FineNotice, 'id' | 'numeroProtocolo' | 'dataEmissao' | 'status' | 'evidencias' | 'ciencia' | 'recurso'>) => Promise<void>;
  confirmFineScience: (fineId: string) => Promise<void>;
  submitFineAppeal: (fineId: string, texto: string, anexoNome?: string) => Promise<void>;
  judgeFineAppeal: (fineId: string, deferido: boolean, resposta: string) => Promise<void>;
  spaces: CommonSpace[];
  addSpace: (space: Omit<CommonSpace, 'id'>) => Promise<void>;
  updateSpace: (id: string, space: Partial<Omit<CommonSpace, 'id'>>) => Promise<void>;
  deleteSpace: (id: string) => Promise<void>;
  documents: DocumentLink[];
  addDocument: (doc: Omit<DocumentLink, 'id' | 'dataAtualizacao'>) => Promise<void>;
  updateDocument: (id: string, doc: Partial<Omit<DocumentLink, 'id' | 'dataAtualizacao'>>) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
  zelador: Zelador | null;
  updateZelador: (data: Zelador) => Promise<void>;
  systemUsers: User[];
  pendingInvites: PendingInvite[];
  createStaffInvite: (data: { nome: string; email: string; role: Role }) => Promise<{ success: boolean; message: string }>;
  cancelPendingInvite: (id: string) => Promise<void>;
  sendPendingInvites: (ids: string[]) => Promise<{ success: boolean; message: string }>;
  deleteSystemUser: (userId: string) => Promise<{ success: boolean; message: string }>;
  generatePasswordResetLink: (userId: string) => Promise<{ success: boolean; message: string; link?: string }>;
  auditLogs: AuditLog[];
  fetchAuditLogsData: (modulo?: string) => Promise<void>;
  reservations: Reservation[];
  requestReservation: (data: {
    espacoId: string;
    data: string;
    horarioInicio: string;
    horarioFim: string;
    convidadosEstimados: number;
  }) => Promise<{ success: boolean; message: string }>;
  judgeReservation: (reservationId: string, aprovado: boolean, motivoRecusa?: string) => Promise<void>;
  notifications: InAppNotification[];
  unreadNotificationCount: number;
  markNotificationAsRead: (id: string) => Promise<void>;
  markAllNotificationsAsRead: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Traduz erros técnicos comuns do Supabase para uma mensagem que faz sentido pro síndico.
function traduzirErroEnvio(message: string): string {
  if (message.toLowerCase().includes('rate limit')) {
    return 'Limite de geração de links do Supabase atingido. Aguarde alguns minutos e tente novamente.';
  }
  if (message.toLowerCase().includes('already registered')) {
    return 'Já existe uma conta cadastrada com esse e-mail.';
  }
  return message;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [units, setUnits] = useState<Unit[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [fines, setFines] = useState<FineNotice[]>([]);
  const [spaces, setSpaces] = useState<CommonSpace[]>(INITIAL_SPACES);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [documents, setDocuments] = useState<DocumentLink[]>(INITIAL_DOCS);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [zelador, setZelador] = useState<Zelador | null>(null);
  const [systemUsers, setSystemUsers] = useState<User[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);

  // Carrega o perfil do usuário autenticado
  const loadUserProfile = useCallback(async (authUserId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUserId)
      .single();

    if (error || !data) {
      console.error('Perfil não encontrado:', error);
      setCurrentUser(null);
      return;
    }

    setCurrentUser({
      id: data.id,
      name: data.name,
      email: data.email ?? '',
      role: data.role as Role,
      cargo: data.cargo ?? undefined,
      bloco: data.bloco ?? undefined,
      unidade: data.unidade ?? undefined,
      telefone: data.telefone ?? undefined,
    });
  }, [supabase]);

  // Carrega todos os dados do banco quando o usuário está logado
  const loadAllData = useCallback(async () => {
    const [u, v, n, f, s, r, notifs, docs, logs, zel, invites, users] = await Promise.all([
      fetchUnits(supabase),
      fetchVehicles(supabase),
      fetchNotices(supabase),
      fetchFines(supabase),
      fetchSpaces(supabase),
      fetchReservations(supabase),
      fetchNotifications(supabase),
      fetchDocuments(supabase),
      fetchAuditLogs(supabase),
      fetchZelador(supabase),
      fetchPendingInvites(supabase),
      fetchProfiles(supabase),
    ]);
    setUnits(u);
    setVehicles(v);
    setNotices(n);
    setFines(f);
    if (s.length > 0) setSpaces(s);
    setReservations(r);
    setNotifications(notifs);
    if (docs.length > 0) setDocuments(docs);
    setAuditLogs(logs);
    setZelador(zel);
    setPendingInvites(invites);
    setSystemUsers(users);
  }, [supabase]);

  // Escuta mudanças de sessão (login/logout)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          await loadUserProfile(session.user.id);
        } else {
          setCurrentUser(null);
        }
        setIsLoading(false);
      }
    );
    return () => subscription.unsubscribe();
  }, [supabase, loadUserProfile]);

  // Carrega dados do banco assim que o usuário estiver disponível
  useEffect(() => {
    if (currentUser) {
      loadAllData();
    }
  }, [currentUser, loadAllData]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setUnits([]); setVehicles([]); setNotices([]);
    setFines([]); setReservations([]); setNotifications([]);
    setDocuments(INITIAL_DOCS); setAuditLogs([]);
    setZelador(null); setSystemUsers([]); setPendingInvites([]);
  };

  // ── AUDIT HELPER ──

  const recordAudit = async (acao: string, modulo: AuditLog['modulo'], detalhes?: Record<string, unknown>) => {
    if (!currentUser) return;
    await insertAuditLog(supabase, {
      usuarioId: currentUser.id,
      usuarioNome: currentUser.name,
      usuarioRole: currentUser.role,
      acao,
      modulo,
      detalhes,
    });
    const updated = await fetchAuditLogs(supabase);
    setAuditLogs(updated);
  };

  const fetchAuditLogsData = async (modulo?: string) => {
    const logs = await fetchAuditLogs(supabase, modulo);
    setAuditLogs(logs);
  };

  // ── UNITS ──

  const addUnit = async (unitData: Omit<Unit, 'id'>): Promise<{ success: boolean; message: string }> => {
    const blocoNumeroDuplicado = units.some(
      (u) => u.bloco === unitData.bloco && u.numero.trim().toLowerCase() === unitData.numero.trim().toLowerCase()
    );
    if (blocoNumeroDuplicado) {
      return { success: false, message: `Já existe uma unidade cadastrada com o número ${unitData.numero} no Bloco ${unitData.bloco}.` };
    }

    const prioritarioNovo = unitData.moradores.find(
      (m) => (m.tipo === 'TITULAR' || m.tipo === 'INQUILINO') && m.email
    );
    if (prioritarioNovo?.email) {
      const emailJaVinculado = units.some((u) =>
        u.moradores.some((m) => m.email && m.email.toLowerCase() === prioritarioNovo.email!.toLowerCase())
      );
      if (emailJaVinculado) {
        return { success: false, message: `O e-mail ${prioritarioNovo.email} já está vinculado a outra unidade.` };
      }
    }

    const { unit: created, errorCode } = await insertUnit(supabase, unitData);
    if (!created) {
      if (errorCode === '23505') {
        return { success: false, message: `Já existe uma unidade cadastrada com o número ${unitData.numero} no Bloco ${unitData.bloco}.` };
      }
      return { success: false, message: 'Erro ao cadastrar a unidade. Tente novamente.' };
    }

    setUnits((prev) => [created, ...prev]);
    await recordAudit(
      `Cadastrou Unidade ${created.numero} (Bloco ${created.bloco})`,
      'UNIDADES',
      {
        unidade: created.numero,
        bloco: created.bloco,
        proprietario: created.proprietarioNome,
        moradoresCount: created.moradores.length,
      }
    );

    // Morador prioritário (TITULAR ou INQUILINO) com e-mail: cadastro já dispara
    // o convite de acesso na hora, sem precisar de um passo manual depois.
    const prioritario = created.moradores.find(
      (m) => (m.tipo === 'TITULAR' || m.tipo === 'INQUILINO') && m.email
    );
    if (!prioritario?.email) {
      return { success: true, message: `Unidade ${created.numero} cadastrada com sucesso.` };
    }

    const invite = await insertPendingInvite(supabase, {
      nome: prioritario.nome,
      email: prioritario.email,
      role: 'MORADOR',
      bloco: created.bloco,
      unidade: created.numero,
      unitId: created.id,
      criadoPor: currentUser?.name,
    });
    if (!invite) {
      return { success: true, message: `Unidade ${created.numero} cadastrada, mas houve erro ao registrar o convite. Envie manualmente pelo card.` };
    }

    setPendingInvites((prev) => [invite, ...prev]);
    await updateUnitDB(supabase, created.id, { statusConvite: 'PENDENTE' });
    setUnits((prev) => prev.map((u) => (u.id === created.id ? { ...u, statusConvite: 'PENDENTE' } : u)));

    const sendResult = await sendPendingInvites([invite.id]);
    return {
      success: true,
      message: sendResult.success
        ? `Unidade ${created.numero} cadastrada. Link de acesso gerado para ${prioritario.email} — copie e envie para o morador.`
        : `Unidade ${created.numero} cadastrada, mas o link de acesso não pôde ser gerado: ${traduzirErroEnvio(sendResult.message)}`,
    };
  };

  const updateUnit = async (id: string, unitData: Partial<Unit>): Promise<{ success: boolean; message: string }> => {
    if (unitData.bloco !== undefined || unitData.numero !== undefined) {
      const atual = units.find((u) => u.id === id);
      const novoBloco = unitData.bloco ?? atual?.bloco ?? '';
      const novoNumero = (unitData.numero ?? atual?.numero ?? '').trim().toLowerCase();
      const blocoNumeroDuplicado = units.some(
        (u) => u.id !== id && u.bloco === novoBloco && u.numero.trim().toLowerCase() === novoNumero
      );
      if (blocoNumeroDuplicado) {
        return { success: false, message: `Já existe uma unidade cadastrada com o número ${unitData.numero ?? atual?.numero} no Bloco ${novoBloco}.` };
      }
    }

    if (unitData.moradores) {
      const prioritarioNovo = unitData.moradores.find(
        (m) => (m.tipo === 'TITULAR' || m.tipo === 'INQUILINO') && m.email
      );
      if (prioritarioNovo?.email) {
        const emailJaVinculado = units.some(
          (u) => u.id !== id && u.moradores.some((m) => m.email && m.email.toLowerCase() === prioritarioNovo.email!.toLowerCase())
        );
        if (emailJaVinculado) {
          return { success: false, message: `O e-mail ${prioritarioNovo.email} já está vinculado a outra unidade.` };
        }
      }
    }

    const updated = await updateUnitDB(supabase, id, unitData);
    if (!updated) return { success: false, message: 'Erro ao atualizar a unidade. Tente novamente.' };

    setUnits((prev) => prev.map((u) => (u.id === id ? updated : u)));
    await recordAudit(`Atualizou cadastro da Unidade ${updated.numero} (Bloco ${updated.bloco})`, 'UNIDADES', {
      id,
    });

    // Mantém a fila de convites sincronizada com a edição: corrige um convite já
    // enfileirado se o morador prioritário mudou, ou dispara um novo convite na
    // hora se agora passou a ter e-mail e ainda não havia convite algum.
    const prioritario = updated.moradores.find(
      (m) => (m.tipo === 'TITULAR' || m.tipo === 'INQUILINO') && m.email
    );
    if (!prioritario?.email) {
      return { success: true, message: `Unidade ${updated.numero} atualizada com sucesso.` };
    }

    const existingInvite = pendingInvites.find((i) => i.unitId === id && i.status === 'PENDENTE');
    if (existingInvite) {
      if (
        existingInvite.nome !== prioritario.nome ||
        existingInvite.email !== prioritario.email ||
        existingInvite.bloco !== updated.bloco ||
        existingInvite.unidade !== updated.numero
      ) {
        const patched = await updatePendingInviteDB(supabase, existingInvite.id, {
          nome: prioritario.nome,
          email: prioritario.email,
          bloco: updated.bloco,
          unidade: updated.numero,
        });
        if (patched) setPendingInvites((prev) => prev.map((i) => (i.id === existingInvite.id ? patched : i)));
      }
      return { success: true, message: `Unidade ${updated.numero} atualizada com sucesso.` };
    }

    if (!updated.statusConvite || updated.statusConvite === 'NAO_ENVIADO') {
      const invite = await insertPendingInvite(supabase, {
        nome: prioritario.nome,
        email: prioritario.email,
        role: 'MORADOR',
        bloco: updated.bloco,
        unidade: updated.numero,
        unitId: updated.id,
        criadoPor: currentUser?.name,
      });
      if (invite) {
        setPendingInvites((prev) => [invite, ...prev]);
        const withStatus = await updateUnitDB(supabase, id, { statusConvite: 'PENDENTE' });
        if (withStatus) setUnits((prev) => prev.map((u) => (u.id === id ? withStatus : u)));
        const sendResult = await sendPendingInvites([invite.id]);
        return {
          success: true,
          message: sendResult.success
            ? `Unidade ${updated.numero} atualizada. Link de acesso gerado para ${prioritario.email} — copie e envie para o morador.`
            : `Unidade ${updated.numero} atualizada, mas o link de acesso não pôde ser gerado: ${traduzirErroEnvio(sendResult.message)}`,
        };
      }
    }

    return { success: true, message: `Unidade ${updated.numero} atualizada com sucesso.` };
  };

  const deleteUnit = async (id: string): Promise<{ success: boolean; message: string }> => {
    const target = units.find((u) => u.id === id);

    let response: Response;
    try {
      response = await fetch('/api/unidades/excluir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unitId: id }),
      });
    } catch (err) {
      console.error('deleteUnit (network):', err);
      return { success: false, message: 'Erro de conexão ao excluir a unidade. Verifique sua internet e tente novamente.' };
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      console.error('deleteUnit:', response.status, body.error);
      return { success: false, message: body.error ?? `Erro ao excluir a unidade (código ${response.status}).` };
    }

    const { usuarioRemovido } = await response.json() as { usuarioRemovido: boolean };

    setUnits((prev) => prev.filter((u) => u.id !== id));
    // pending_invites.unit_id tem ON DELETE CASCADE no banco; só precisa refletir no estado local.
    setPendingInvites((prev) => prev.filter((i) => i.unitId !== id));
    if (target?.usuarioId) {
      setSystemUsers((prev) => prev.filter((u) => u.id !== target.usuarioId));
    }

    await recordAudit(
      `Excluiu Unidade ${target?.numero ?? id} (Bloco ${target?.bloco ?? '?'})${usuarioRemovido ? ' e revogou o acesso do morador ao portal' : ''}`,
      'UNIDADES',
      { id, usuarioRemovido }
    );

    return { success: true, message: `Unidade ${target?.numero ?? ''} excluída com sucesso.` };
  };

  const sendInviteForUnit = async (unitId: string): Promise<{ success: boolean; message: string }> => {
    // Reaproveita um convite já enfileirado (mesmo que tenha ficado com erro antes,
    // ex: limite de e-mail do Supabase) em vez de duplicar um novo registro na fila.
    let invite = pendingInvites.find(
      (i) => i.unitId === unitId && (i.status === 'PENDENTE' || i.status === 'ERRO')
    );

    if (!invite) {
      const unit = units.find((u) => u.id === unitId);
      const prioritario = unit?.moradores.find(
        (m) => (m.tipo === 'TITULAR' || m.tipo === 'INQUILINO') && m.email
      );
      if (!unit || !prioritario?.email) {
        return { success: false, message: 'Cadastre um e-mail para o morador principal antes de enviar o convite.' };
      }

      const created = await insertPendingInvite(supabase, {
        nome: prioritario.nome,
        email: prioritario.email,
        role: 'MORADOR',
        bloco: unit.bloco,
        unidade: unit.numero,
        unitId: unit.id,
        criadoPor: currentUser?.name,
      });
      if (!created) return { success: false, message: 'Erro ao registrar o convite. Tente novamente.' };

      invite = created;
      setPendingInvites((prev) => [created, ...prev]);
      const withStatus = await updateUnitDB(supabase, unit.id, { statusConvite: 'PENDENTE' });
      if (withStatus) setUnits((prev) => prev.map((u) => (u.id === unit.id ? withStatus : u)));
    }

    return sendPendingInvites([invite.id]);
  };

  // ── VEHICLES ──

  const addVehicle = async (vehicleData: Omit<Vehicle, 'id'>) => {
    const created = await insertVehicle(supabase, vehicleData);
    if (created) setVehicles((prev) => [created, ...prev]);
  };

  const deleteVehicle = async (id: string) => {
    await deleteVehicleDB(supabase, id);
    setVehicles((prev) => prev.filter((v) => v.id !== id));
  };

  // ── NOTICES ──

  const addNotice = async (noticeData: Omit<Notice, 'id' | 'data'>) => {
    const created = await insertNotice(supabase, noticeData, currentUser?.name ?? 'Sistema');
    if (!created) return;
    setNotices((prev) => [created, ...prev]);
    await insertNotification(supabase, {
      titulo: 'Novo Comunicado no Mural',
      mensagem: `${noticeData.titulo} (${noticeData.categoria})`,
      tipo: 'AVISO',
      linkDestino: '/mural',
    });
  };

  const deleteNotice = async (id: string) => {
    await deleteNoticeDB(supabase, id);
    setNotices((prev) => prev.filter((n) => n.id !== id));
  };

  // ── FINES ──

  const addFine = async (
    fineData: Omit<FineNotice, 'id' | 'numeroProtocolo' | 'dataEmissao' | 'status' | 'evidencias' | 'ciencia' | 'recurso'>
  ) => {
    const count = fines.length + 1;
    const protocolNumber = `NOT-2026/${String(count).padStart(3, '0')}`;
    const created = await insertFine(supabase, fineData, protocolNumber);
    if (!created) return;
    setFines((prev) => [created, ...prev]);
    await recordAudit(`Emitiu notificação/multa ${protocolNumber}`, 'MULTAS', {
      protocolo: protocolNumber,
      unidade: fineData.unidade,
      bloco: fineData.bloco,
      valor: fineData.valor,
    });
    await insertNotification(supabase, {
      titulo: `Notificação Disciplinar ${protocolNumber}`,
      mensagem: `Registrada notificação para a Unidade ${fineData.unidade} Bloco ${fineData.bloco}. Confirme ciência no portal.`,
      tipo: 'MULTA',
      unidadeAlvo: fineData.unidade,
      linkDestino: `/multas/${created.id}`,
    });
  };

  const confirmFineScience = async (fineId: string) => {
    const timestamp = new Date().toISOString();
    const updated = await updateFineDB(supabase, fineId, {
      status: 'CIENCIA_REGISTRADA',
      ciencia_data: timestamp,
      ciencia_usuario_nome: currentUser?.name ?? 'Usuário',
    });
    if (updated) setFines((prev) => prev.map((f) => (f.id === fineId ? updated : f)));
  };

  const submitFineAppeal = async (fineId: string, texto: string, anexoNome?: string) => {
    const timestamp = new Date().toISOString();
    const updated = await updateFineDB(supabase, fineId, {
      status: 'EM_RECURSO',
      recurso_data: timestamp,
      recurso_texto: texto,
      recurso_status: 'EM_ANALISE',
      recurso_anexo_nome: anexoNome ?? null,
    });
    if (!updated) return;
    setFines((prev) => prev.map((f) => (f.id === fineId ? updated : f)));
    await insertNotification(supabase, {
      titulo: 'Novo Recurso de Multa Protocolado',
      mensagem: `Morador da Unidade ${currentUser?.unidade || '?'} interpôs recurso.`,
      tipo: 'MULTA',
      perfilAlvo: 'SINDICO',
      linkDestino: `/multas/${fineId}`,
    });
  };

  const judgeFineAppeal = async (fineId: string, deferido: boolean, resposta: string) => {
    const timestamp = new Date().toISOString();
    const updated = await updateFineDB(supabase, fineId, {
      status: deferido ? 'RECURSO_DEFERIDO' : 'RECURSO_INDEFERIDO',
      recurso_resposta: resposta,
      recurso_data_resposta: timestamp,
      recurso_status: deferido ? 'DEFERIDO' : 'INDEFERIDO',
      recurso_analisado_por: currentUser?.name ?? 'Síndico',
    });
    if (updated) {
      setFines((prev) => prev.map((f) => (f.id === fineId ? updated : f)));
      await recordAudit(
        deferido ? `Deferiu recurso da notificação` : `Indeferiu recurso da notificação`,
        'MULTAS',
        { fineId, deferido, resposta }
      );
    }
  };

  // ── SPACES ──

  const addSpace = async (spaceData: Omit<CommonSpace, 'id'>) => {
    const created = await insertSpace(supabase, spaceData);
    if (created) {
      setSpaces((prev) => [...prev, created]);
      await recordAudit(`Cadastrou novo espaço comum: ${created.nome}`, 'ESPACOS', {
        id: created.id,
        nome: created.nome,
        taxaLimpeza: created.taxaLimpeza,
      });
    }
  };

  const updateSpace = async (id: string, spaceData: Partial<Omit<CommonSpace, 'id'>>) => {
    const updated = await updateSpaceDB(supabase, id, spaceData);
    if (updated) {
      setSpaces((prev) => prev.map((s) => (s.id === id ? updated : s)));
      await recordAudit(`Atualizou espaço comum: ${updated.nome}`, 'ESPACOS', { id });
    }
  };

  const deleteSpace = async (id: string) => {
    const target = spaces.find((s) => s.id === id);
    await deleteSpaceDB(supabase, id);
    setSpaces((prev) => prev.filter((s) => s.id !== id));
    await recordAudit(`Removeu espaço comum: ${target?.nome ?? id}`, 'ESPACOS', { id });
  };

  // ── DOCUMENTS ──

  const addDocument = async (docData: Omit<DocumentLink, 'id' | 'dataAtualizacao'>) => {
    const created = await insertDocument(supabase, docData);
    if (created) {
      setDocuments((prev) => [created, ...prev]);
      await recordAudit(`Publicou documento: ${created.titulo}`, 'DOCUMENTOS', {
        titulo: created.titulo,
        categoria: created.categoria,
      });
    }
  };

  const updateDocument = async (id: string, docData: Partial<Omit<DocumentLink, 'id' | 'dataAtualizacao'>>) => {
    const updated = await updateDocumentDB(supabase, id, docData);
    if (updated) {
      setDocuments((prev) => prev.map((d) => (d.id === id ? updated : d)));
      await recordAudit(`Atualizou documento: ${updated.titulo}`, 'DOCUMENTOS', { id });
    }
  };

  const deleteDocument = async (id: string) => {
    const target = documents.find((d) => d.id === id);
    await deleteDocumentDB(supabase, id);
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    await recordAudit(`Excluiu documento: ${target?.titulo ?? id}`, 'DOCUMENTOS', { id });
  };

  // ── ZELADOR ──

  const updateZelador = async (data: Zelador) => {
    const updated = await updateZeladorDB(supabase, data);
    if (updated) {
      setZelador(updated);
      await recordAudit(`Atualizou dados do zelador: ${updated.nome}`, 'SISTEMA', { nome: updated.nome });
    }
  };

  // ── USUÁRIOS & CONVITES ──

  const createStaffInvite = async (data: { nome: string; email: string; role: Role }): Promise<{ success: boolean; message: string }> => {
    if (data.role === 'SINDICO' || data.role === 'ADM') {
      const jaExisteAtivo = systemUsers.some((u) => u.role === data.role);
      const jaExistePendente = pendingInvites.some((i) => i.role === data.role && i.status === 'PENDENTE');
      if (jaExisteAtivo || jaExistePendente) {
        return { success: false, message: `Já existe um usuário ${jaExistePendente ? 'com convite pendente' : 'ativo'} com o perfil ${data.role}.` };
      }
    }

    const invite = await insertPendingInvite(supabase, {
      nome: data.nome,
      email: data.email,
      role: data.role,
      criadoPor: currentUser?.name,
    });
    if (!invite) return { success: false, message: 'Erro ao registrar o convite. Tente novamente.' };

    setPendingInvites((prev) => [invite, ...prev]);
    await recordAudit(`Cadastrou convite de acesso para ${data.nome} (${data.role})`, 'SISTEMA', { email: data.email, role: data.role });
    return { success: true, message: 'Convite adicionado à fila. Envie quando estiver pronto.' };
  };

  const cancelPendingInvite = async (id: string) => {
    await deletePendingInviteDB(supabase, id);
    setPendingInvites((prev) => prev.filter((i) => i.id !== id));
  };

  const sendPendingInvites = async (ids: string[]): Promise<{ success: boolean; message: string }> => {
    if (ids.length === 0) return { success: false, message: 'Selecione ao menos um convite.' };

    const response = await fetch('/api/convites/enviar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      return { success: false, message: body.error ?? 'Erro ao enviar convites.' };
    }

    const { results } = await response.json() as { results: { id: string; ok: boolean; mensagem?: string }[] };
    const enviados = results.filter((r) => r.ok).length;
    const comErro = results.filter((r) => !r.ok).length;

    await recordAudit(`Enviou lote de convites de acesso (${enviados} enviado(s), ${comErro} com erro)`, 'SISTEMA', { ids });

    const [invites, users, unitsAtualizadas] = await Promise.all([
      fetchPendingInvites(supabase),
      fetchProfiles(supabase),
      fetchUnits(supabase),
    ]);
    setPendingInvites(invites);
    setSystemUsers(users);
    setUnits(unitsAtualizadas);

    if (comErro === 0) {
      return { success: true, message: `${enviados} link(s) de acesso gerado(s) com sucesso.` };
    }
    return { success: enviados > 0, message: `${enviados} gerado(s), ${comErro} com erro (veja a fila para detalhes).` };
  };

  const deleteSystemUser = async (userId: string): Promise<{ success: boolean; message: string }> => {
    const target = systemUsers.find((u) => u.id === userId);

    let response: Response;
    try {
      response = await fetch('/api/usuarios/excluir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
    } catch (err) {
      console.error('deleteSystemUser (network):', err);
      return { success: false, message: 'Erro de conexão ao excluir o usuário. Tente novamente.' };
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      console.error('deleteSystemUser:', response.status, body.error);
      return { success: false, message: body.error ?? `Erro ao excluir o usuário (código ${response.status}).` };
    }

    setSystemUsers((prev) => prev.filter((u) => u.id !== userId));
    setUnits((prev) => prev.map((u) => (u.usuarioId === userId ? { ...u, usuarioId: undefined, statusConvite: 'NAO_ENVIADO' } : u)));

    await recordAudit(`Excluiu o acesso de ${target?.name ?? userId} (${target?.role ?? '?'})`, 'SISTEMA', { userId });

    return { success: true, message: `Acesso de ${target?.name ?? 'usuário'} excluído com sucesso.` };
  };

  const generatePasswordResetLink = async (userId: string): Promise<{ success: boolean; message: string; link?: string }> => {
    const target = systemUsers.find((u) => u.id === userId);

    let response: Response;
    try {
      response = await fetch('/api/usuarios/resetar-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
    } catch (err) {
      console.error('generatePasswordResetLink (network):', err);
      return { success: false, message: 'Erro de conexão ao gerar o link. Tente novamente.' };
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      console.error('generatePasswordResetLink:', response.status, body.error);
      return { success: false, message: body.error ?? `Erro ao gerar o link (código ${response.status}).` };
    }

    const { link } = await response.json() as { link: string };
    await recordAudit(`Gerou link de redefinição de senha para ${target?.name ?? userId}`, 'SISTEMA', { userId });

    return { success: true, message: `Link de redefinição gerado para ${target?.name ?? 'o usuário'} — copie e envie manualmente.`, link };
  };

  // ── RESERVATIONS ──

  const requestReservation = async ({
    espacoId, data, horarioInicio, horarioFim, convidadosEstimados,
  }: {
    espacoId: string; data: string; horarioInicio: string;
    horarioFim: string; convidadosEstimados: number;
  }): Promise<{ success: boolean; message: string }> => {
    const targetSpace = spaces.find((s) => s.id === espacoId);
    if (!targetSpace) return { success: false, message: 'Espaço comum não encontrado.' };

    const hasConflict = reservations.some(
      (r) => r.espacoId === espacoId && r.data === data &&
        (r.status === 'APROVADA' || r.status === 'PENDENTE')
    );
    if (hasConflict) {
      return { success: false, message: 'Este espaço já possui uma reserva confirmada ou pendente para esta data.' };
    }

    const created = await insertReservation(supabase, {
      espacoId,
      espacoNome: targetSpace.nome,
      bloco: currentUser?.bloco ?? 'A',
      unidade: currentUser?.unidade ?? '?',
      moradorNome: currentUser?.name ?? 'Morador',
      data, horarioInicio, horarioFim, convidadosEstimados,
      status: 'PENDENTE',
    });
    if (!created) return { success: false, message: 'Erro ao salvar reserva. Tente novamente.' };

    setReservations((prev) => [created, ...prev]);
    await insertNotification(supabase, {
      titulo: 'Nova Solicitação de Reserva',
      mensagem: `${currentUser?.name} (Unidade ${currentUser?.unidade}) solicitou ${targetSpace.nome} para ${data}. Requer aprovação.`,
      tipo: 'RESERVA',
      perfilAlvo: 'SINDICO',
      linkDestino: '/reservas',
    });

    return { success: true, message: 'Sua solicitação foi enviada e aguarda aprovação do Síndico!' };
  };

  const judgeReservation = async (reservationId: string, aprovado: boolean, motivoRecusa?: string) => {
    const timestamp = new Date().toISOString();
    const targetRes = reservations.find((r) => r.id === reservationId);
    const updated = await updateReservationDB(supabase, reservationId, {
      status: aprovado ? 'APROVADA' : 'RECUSADA',
      motivo_recusa: aprovado ? null : (motivoRecusa ?? null),
      data_avaliacao: timestamp,
      avaliado_por: `${currentUser?.name ?? 'Síndico'} (${currentUser?.role ?? 'SINDICO'})`,
    });
    if (!updated) return;
    setReservations((prev) => prev.map((r) => (r.id === reservationId ? updated : r)));

    await recordAudit(
      aprovado ? `Aprovou reserva de ${targetRes?.espacoNome ?? 'espaço'}` : `Recusou reserva de ${targetRes?.espacoNome ?? 'espaço'}`,
      'RESERVAS',
      {
        reservationId,
        espaco: targetRes?.espacoNome,
        unidade: targetRes?.unidade,
        aprovado,
        motivoRecusa,
      }
    );

    if (targetRes) {
      await insertNotification(supabase, {
        titulo: aprovado ? 'Reserva Aprovada!' : 'Reserva Não Aprovada',
        mensagem: aprovado
          ? `Sua reserva do ${targetRes.espacoNome} para ${targetRes.data} foi confirmada!`
          : `Sua solicitação para ${targetRes.data} foi recusada: ${motivoRecusa ?? 'Incompatibilidade com o regimento.'}`,
        tipo: 'RESERVA',
        unidadeAlvo: targetRes.unidade,
        linkDestino: '/reservas',
      });
    }
  };

  // ── NOTIFICATIONS ──

  const markNotificationAsRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, lida: true } : n)));
    await markNotifReadDB(supabase, id);
  };

  const markAllNotificationsAsRead = async () => {
    const unreadIds = notifications.filter((n) => !n.lida).map((n) => n.id);
    setNotifications((prev) => prev.map((n) => ({ ...n, lida: true })));
    await markAllNotifsReadDB(supabase, unreadIds);
  };

  // Filtra notificações visíveis pelo perfil do usuário
  const visibleNotifications = notifications.filter((n) => {
    if (isAdmin(currentUser?.role)) return true;
    if (n.perfilAlvo && n.perfilAlvo !== currentUser?.role) return false;
    if (n.unidadeAlvo && n.unidadeAlvo !== currentUser?.unidade) return false;
    return true;
  });

  const unreadNotificationCount = visibleNotifications.filter((n) => !n.lida).length;

  return (
    <AppContext.Provider
      value={{
        currentUser,
        isLoading,
        units,
        addUnit,
        updateUnit,
        deleteUnit,
        sendInviteForUnit,
        vehicles,
        addVehicle,
        deleteVehicle,
        notices,
        addNotice,
        deleteNotice,
        fines,
        addFine,
        confirmFineScience,
        submitFineAppeal,
        judgeFineAppeal,
        spaces,
        addSpace,
        updateSpace,
        deleteSpace,
        documents,
        addDocument,
        updateDocument,
        deleteDocument,
        zelador,
        updateZelador,
        systemUsers,
        pendingInvites,
        createStaffInvite,
        cancelPendingInvite,
        sendPendingInvites,
        deleteSystemUser,
        generatePasswordResetLink,
        auditLogs,
        fetchAuditLogsData,
        reservations,
        requestReservation,
        judgeReservation,
        notifications: visibleNotifications,
        unreadNotificationCount,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        signOut,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
}
