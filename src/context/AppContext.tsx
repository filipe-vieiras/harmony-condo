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
} from '@/types';
import { INITIAL_SPACES, INITIAL_DOCS } from '@/lib/mockData';
import {
  fetchUnits, insertUnit, updateUnitDB,
  fetchVehicles, insertVehicle, deleteVehicleDB,
  fetchNotices, insertNotice, deleteNoticeDB,
  fetchFines, insertFine, updateFineDB,
  fetchSpaces, insertSpace, updateSpaceDB, deleteSpaceDB,
  fetchReservations, insertReservation, updateReservationDB,
  fetchNotifications, insertNotification, markNotifReadDB, markAllNotifsReadDB,
  fetchDocuments, insertDocument, deleteDocumentDB,
  fetchAuditLogs, insertAuditLog,
} from '@/lib/supabase/db';

interface AppContextType {
  currentUser: User | null;
  isLoading: boolean;
  units: Unit[];
  addUnit: (unit: Omit<Unit, 'id'>) => Promise<void>;
  updateUnit: (id: string, unit: Partial<Unit>) => Promise<void>;
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
  deleteDocument: (id: string) => Promise<void>;
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
    const [u, v, n, f, s, r, notifs, docs, logs] = await Promise.all([
      fetchUnits(supabase),
      fetchVehicles(supabase),
      fetchNotices(supabase),
      fetchFines(supabase),
      fetchSpaces(supabase),
      fetchReservations(supabase),
      fetchNotifications(supabase),
      fetchDocuments(supabase),
      fetchAuditLogs(supabase),
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

  const addUnit = async (unitData: Omit<Unit, 'id'>) => {
    const created = await insertUnit(supabase, unitData);
    if (created) {
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
    }
  };

  const updateUnit = async (id: string, unitData: Partial<Unit>) => {
    const updated = await updateUnitDB(supabase, id, unitData);
    if (updated) {
      setUnits((prev) => prev.map((u) => (u.id === id ? updated : u)));
      await recordAudit(`Atualizou cadastro da Unidade ${updated.numero} (Bloco ${updated.bloco})`, 'UNIDADES', {
        id,
      });
    }
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

  const deleteDocument = async (id: string) => {
    const target = documents.find((d) => d.id === id);
    await deleteDocumentDB(supabase, id);
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    await recordAudit(`Excluiu documento: ${target?.titulo ?? id}`, 'DOCUMENTOS', { id });
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
    if (currentUser?.role === 'SINDICO') return true;
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
        deleteDocument,
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
