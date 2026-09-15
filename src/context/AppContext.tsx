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
} from '@/types';
import {
  INITIAL_UNITS,
  INITIAL_VEHICLES,
  INITIAL_NOTICES,
  INITIAL_FINES,
  INITIAL_SPACES,
  INITIAL_RESERVATIONS,
  INITIAL_NOTIFICATIONS,
} from '@/lib/mockData';

interface AppContextType {
  currentUser: User | null;
  isLoading: boolean;
  units: Unit[];
  addUnit: (unit: Omit<Unit, 'id'>) => void;
  updateUnit: (id: string, unit: Partial<Unit>) => void;
  vehicles: Vehicle[];
  addVehicle: (vehicle: Omit<Vehicle, 'id'>) => void;
  deleteVehicle: (id: string) => void;
  notices: Notice[];
  addNotice: (notice: Omit<Notice, 'id' | 'data'>) => void;
  deleteNotice: (id: string) => void;
  fines: FineNotice[];
  addFine: (fine: Omit<FineNotice, 'id' | 'numeroProtocolo' | 'dataEmissao' | 'status'>) => void;
  confirmFineScience: (fineId: string) => void;
  submitFineAppeal: (fineId: string, texto: string, anexoNome?: string) => void;
  judgeFineAppeal: (fineId: string, deferido: boolean, resposta: string) => void;
  spaces: CommonSpace[];
  reservations: Reservation[];
  requestReservation: (data: {
    espacoId: string;
    data: string;
    horarioInicio: string;
    horarioFim: string;
    convidadosEstimados: number;
  }) => { success: boolean; message: string };
  judgeReservation: (reservationId: string, aprovado: boolean, motivoRecusa?: string) => void;
  notifications: InAppNotification[];
  unreadNotificationCount: number;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  signOut: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [units, setUnits] = useState<Unit[]>(INITIAL_UNITS);
  const [vehicles, setVehicles] = useState<Vehicle[]>(INITIAL_VEHICLES);
  const [notices, setNotices] = useState<Notice[]>(INITIAL_NOTICES);
  const [fines, setFines] = useState<FineNotice[]>(INITIAL_FINES);
  const [spaces] = useState<CommonSpace[]>(INITIAL_SPACES);
  const [reservations, setReservations] = useState<Reservation[]>(INITIAL_RESERVATIONS);
  const [notifications, setNotifications] = useState<InAppNotification[]>(INITIAL_NOTIFICATIONS);

  // Carrega o perfil do usuário autenticado no Supabase
  const loadUserProfile = useCallback(async (authUserId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUserId)
      .single();

    if (error || !data) {
      // Usuário autenticado mas sem perfil (não deveria acontecer em produção)
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

  const signOut = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
  };

  // ── CRUD local (mantido para funcionamento sem configuração completa do DB) ──

  const addUnit = (unitData: Omit<Unit, 'id'>) => {
    const newUnit: Unit = {
      ...unitData,
      id: `unit-${unitData.numero.toLowerCase()}-${unitData.bloco.toLowerCase()}`,
    };
    setUnits((prev) => [newUnit, ...prev]);
  };

  const updateUnit = (id: string, unitData: Partial<Unit>) => {
    setUnits((prev) => prev.map((u) => (u.id === id ? { ...u, ...unitData } : u)));
  };

  const addVehicle = (vehicleData: Omit<Vehicle, 'id'>) => {
    const newVeh: Vehicle = { ...vehicleData, id: `veh-${Date.now()}` };
    setVehicles((prev) => [newVeh, ...prev]);
  };

  const deleteVehicle = (id: string) => {
    setVehicles((prev) => prev.filter((v) => v.id !== id));
  };

  const addNotice = (noticeData: Omit<Notice, 'id' | 'data'>) => {
    const newNotice: Notice = {
      ...noticeData,
      id: `not-${Date.now()}`,
      data: new Date().toISOString().split('T')[0],
    };
    setNotices((prev) => [newNotice, ...prev]);

    const newNotif: InAppNotification = {
      id: `notif-${Date.now()}`,
      titulo: 'Novo Comunicado no Mural',
      mensagem: `${noticeData.titulo} (${noticeData.categoria})`,
      tipo: 'AVISO',
      data: 'Agora mesmo',
      lida: false,
      linkDestino: '/mural',
    };
    setNotifications((prev) => [newNotif, ...prev]);
  };

  const deleteNotice = (id: string) => {
    setNotices((prev) => prev.filter((n) => n.id !== id));
  };

  const addFine = (fineData: Omit<FineNotice, 'id' | 'numeroProtocolo' | 'dataEmissao' | 'status'>) => {
    const count = fines.length + 1;
    const protocolNumber = `NOT-2026/${String(count).padStart(3, '0')}`;
    const newFine: FineNotice = {
      ...fineData,
      id: `fine-${Date.now()}`,
      numeroProtocolo: protocolNumber,
      dataEmissao: new Date().toISOString().split('T')[0],
      status: 'PENDENTE_CIENCIA',
    };
    setFines((prev) => [newFine, ...prev]);

    const notifMorador: InAppNotification = {
      id: `notif-${Date.now()}`,
      titulo: `Notificação Disciplinar ${protocolNumber}`,
      mensagem: `Registrada notificação para a Unidade ${newFine.unidade} Bloco ${newFine.bloco}. É obrigatório confirmar ciência.`,
      tipo: 'MULTA',
      data: 'Hoje',
      lida: false,
      unidadeAlvo: newFine.unidade,
      linkDestino: `/multas/${newFine.id}`,
    };
    setNotifications((prev) => [notifMorador, ...prev]);
  };

  const confirmFineScience = (fineId: string) => {
    const timestamp = new Date().toLocaleString('pt-BR');
    setFines((prev) =>
      prev.map((f) =>
        f.id === fineId
          ? {
              ...f,
              status: 'CIENCIA_REGISTRADA' as const,
              ciencia: {
                data: timestamp,
                ip: '189.120.45.10 (Registrado via Portal)',
                usuarioNome: currentUser?.name ?? 'Usuário',
              },
            }
          : f
      )
    );
  };

  const submitFineAppeal = (fineId: string, texto: string, anexoNome?: string) => {
    const timestamp = new Date().toLocaleString('pt-BR');
    setFines((prev) =>
      prev.map((f) =>
        f.id === fineId
          ? {
              ...f,
              status: 'EM_RECURSO' as const,
              recurso: { data: timestamp, texto, anexoNome, status: 'EM_ANALISE' as const },
            }
          : f
      )
    );

    const notifSindico: InAppNotification = {
      id: `notif-appeal-${Date.now()}`,
      titulo: 'Novo Recurso de Multa Protocolado',
      mensagem: `Morador da Unidade ${currentUser?.unidade || '304'} interpôs recurso.`,
      tipo: 'MULTA',
      data: 'Hoje',
      lida: false,
      perfilAlvo: 'SINDICO',
      linkDestino: `/multas/${fineId}`,
    };
    setNotifications((prev) => [notifSindico, ...prev]);
  };

  const judgeFineAppeal = (fineId: string, deferido: boolean, resposta: string) => {
    const timestamp = new Date().toLocaleString('pt-BR');
    setFines((prev) =>
      prev.map((f) =>
        f.id === fineId && f.recurso
          ? {
              ...f,
              status: deferido ? ('RECURSO_DEFERIDO' as const) : ('RECURSO_INDEFERIDO' as const),
              recurso: {
                ...f.recurso,
                resposta,
                dataResposta: timestamp,
                status: deferido ? ('DEFERIDO' as const) : ('INDEFERIDO' as const),
                analisadoPor: currentUser?.name ?? 'Síndico',
              },
            }
          : f
      )
    );
  };

  const requestReservation = ({
    espacoId, data, horarioInicio, horarioFim, convidadosEstimados,
  }: {
    espacoId: string; data: string; horarioInicio: string;
    horarioFim: string; convidadosEstimados: number;
  }) => {
    const targetSpace = spaces.find((s) => s.id === espacoId);
    if (!targetSpace) return { success: false, message: 'Espaço comum não encontrado.' };

    const hasConflict = reservations.some(
      (r) => r.espacoId === espacoId && r.data === data &&
        (r.status === 'APROVADA' || r.status === 'PENDENTE')
    );
    if (hasConflict) {
      return { success: false, message: 'Este espaço já possui uma reserva confirmada ou pendente para esta data.' };
    }

    const newReservation: Reservation = {
      id: `res-${Date.now()}`,
      espacoId,
      espacoNome: targetSpace.nome,
      bloco: currentUser?.bloco || 'A',
      unidade: currentUser?.unidade || '304',
      moradorNome: currentUser?.name ?? 'Morador',
      data, horarioInicio, horarioFim, convidadosEstimados,
      status: 'PENDENTE',
      dataSolicitacao: new Date().toLocaleString('pt-BR'),
    };
    setReservations((prev) => [newReservation, ...prev]);

    const notifSindico: InAppNotification = {
      id: `notif-res-${Date.now()}`,
      titulo: 'Nova Solicitação de Reserva',
      mensagem: `${currentUser?.name} (Unidade ${currentUser?.unidade}) solicitou o ${targetSpace.nome} para ${data}. Requer aprovação.`,
      tipo: 'RESERVA', data: 'Hoje', lida: false,
      perfilAlvo: 'SINDICO', linkDestino: '/reservas',
    };
    setNotifications((prev) => [notifSindico, ...prev]);

    return { success: true, message: 'Sua solicitação foi enviada com sucesso e aguarda validação e aprovação do Síndico!' };
  };

  const judgeReservation = (reservationId: string, aprovado: boolean, motivoRecusa?: string) => {
    const timestamp = new Date().toLocaleString('pt-BR');
    let targetRes: Reservation | undefined;

    setReservations((prev) => {
      const updated = prev.map((r) => {
        if (r.id === reservationId) {
          targetRes = r;
          return {
            ...r,
            status: aprovado ? ('APROVADA' as const) : ('RECUSADA' as const),
            motivoRecusa: aprovado ? undefined : motivoRecusa,
            dataAvaliacao: timestamp,
            avaliadoPor: `${currentUser?.name ?? 'Síndico'} (${currentUser?.role ?? 'SINDICO'})`,
          };
        }
        return r;
      });
      return updated;
    });

    if (targetRes) {
      const notifMorador: InAppNotification = {
        id: `notif-eval-${Date.now()}`,
        titulo: aprovado ? 'Reserva Aprovada pelo Síndico!' : 'Reserva Não Aprovada',
        mensagem: aprovado
          ? `Sua reserva do ${targetRes.espacoNome} para ${targetRes.data} foi confirmada com sucesso!`
          : `Sua solicitação de reserva para ${targetRes.data} foi recusada: ${motivoRecusa || 'Incompatibilidade com o regimento.'}`,
        tipo: 'RESERVA', data: 'Hoje', lida: false,
        unidadeAlvo: targetRes.unidade, linkDestino: '/reservas',
      };
      setNotifications((prev) => [notifMorador, ...prev]);
    }
  };

  const markNotificationAsRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, lida: true } : n)));
  };

  const markAllNotificationsAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, lida: true })));
  };

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
