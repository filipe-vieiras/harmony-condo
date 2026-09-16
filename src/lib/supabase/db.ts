import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Unit,
  Vehicle,
  Notice,
  FineNotice,
  CommonSpace,
  Reservation,
  InAppNotification,
} from '@/types';

// ──────────────────────────────────────────────
// UNITS
// ──────────────────────────────────────────────

function rowToUnit(r: Record<string, unknown>): Unit {
  return {
    id: r.id as string,
    bloco: r.bloco as string,
    numero: r.numero as string,
    proprietarioNome: r.proprietario_nome as string,
    proprietarioTelefone: r.proprietario_telefone as string,
    proprietarioEmail: r.proprietario_email as string,
    tipoOcupacao: r.tipo_ocupacao as Unit['tipoOcupacao'],
    moradores: [],
    vagasGaragem: (r.vagas_garagem as string[]) ?? [],
    animais: (r.animais as string) ?? '',
    observacoes: (r.observacoes as string) ?? undefined,
  };
}

export async function fetchUnits(supabase: SupabaseClient): Promise<Unit[]> {
  const { data, error } = await supabase
    .from('units')
    .select('*')
    .order('bloco', { ascending: true })
    .order('numero', { ascending: true });
  if (error) { console.error('fetchUnits:', error); return []; }
  return (data ?? []).map(rowToUnit);
}

export async function insertUnit(supabase: SupabaseClient, unit: Omit<Unit, 'id' | 'moradores'>): Promise<Unit | null> {
  const { data, error } = await supabase.from('units').insert({
    bloco: unit.bloco,
    numero: unit.numero,
    proprietario_nome: unit.proprietarioNome,
    proprietario_telefone: unit.proprietarioTelefone,
    proprietario_email: unit.proprietarioEmail,
    tipo_ocupacao: unit.tipoOcupacao,
    vagas_garagem: unit.vagasGaragem,
    animais: unit.animais,
    observacoes: unit.observacoes,
  }).select().single();
  if (error) { console.error('insertUnit:', error); return null; }
  return rowToUnit(data);
}

export async function updateUnitDB(supabase: SupabaseClient, id: string, unit: Partial<Omit<Unit, 'id' | 'moradores'>>): Promise<Unit | null> {
  const payload: Record<string, unknown> = {};
  if (unit.bloco !== undefined) payload.bloco = unit.bloco;
  if (unit.numero !== undefined) payload.numero = unit.numero;
  if (unit.proprietarioNome !== undefined) payload.proprietario_nome = unit.proprietarioNome;
  if (unit.proprietarioTelefone !== undefined) payload.proprietario_telefone = unit.proprietarioTelefone;
  if (unit.proprietarioEmail !== undefined) payload.proprietario_email = unit.proprietarioEmail;
  if (unit.tipoOcupacao !== undefined) payload.tipo_ocupacao = unit.tipoOcupacao;
  if (unit.vagasGaragem !== undefined) payload.vagas_garagem = unit.vagasGaragem;
  if (unit.animais !== undefined) payload.animais = unit.animais;
  if (unit.observacoes !== undefined) payload.observacoes = unit.observacoes;

  const { data, error } = await supabase.from('units').update(payload).eq('id', id).select().single();
  if (error) { console.error('updateUnitDB:', error); return null; }
  return rowToUnit(data);
}

// ──────────────────────────────────────────────
// VEHICLES
// ──────────────────────────────────────────────

function rowToVehicle(r: Record<string, unknown>): Vehicle {
  return {
    id: r.id as string,
    placa: r.placa as string,
    marca: r.marca as string,
    modelo: r.modelo as string,
    cor: r.cor as string,
    bloco: r.bloco as string,
    unidade: r.unidade as string,
    vaga: r.vaga as string,
    proprietarioNome: r.proprietario_nome as string,
    telefoneContato: r.telefone_contato as string,
    status: r.status as Vehicle['status'],
  };
}

export async function fetchVehicles(supabase: SupabaseClient): Promise<Vehicle[]> {
  const { data, error } = await supabase.from('vehicles').select('*').order('created_at', { ascending: false });
  if (error) { console.error('fetchVehicles:', error); return []; }
  return (data ?? []).map(rowToVehicle);
}

export async function insertVehicle(supabase: SupabaseClient, v: Omit<Vehicle, 'id'>): Promise<Vehicle | null> {
  const { data, error } = await supabase.from('vehicles').insert({
    placa: v.placa,
    marca: v.marca,
    modelo: v.modelo,
    cor: v.cor,
    bloco: v.bloco,
    unidade: v.unidade,
    vaga: v.vaga,
    proprietario_nome: v.proprietarioNome,
    telefone_contato: v.telefoneContato,
    status: v.status,
  }).select().single();
  if (error) { console.error('insertVehicle:', error); return null; }
  return rowToVehicle(data);
}

export async function deleteVehicleDB(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from('vehicles').delete().eq('id', id);
  if (error) console.error('deleteVehicleDB:', error);
}

// ──────────────────────────────────────────────
// NOTICES
// ──────────────────────────────────────────────

function rowToNotice(r: Record<string, unknown>): Notice {
  return {
    id: r.id as string,
    titulo: r.titulo as string,
    conteudo: r.conteudo as string,
    categoria: r.categoria as Notice['categoria'],
    data: (r.created_at as string).split('T')[0],
    autor: r.autor as string,
    fixado: (r.fixado as boolean) ?? false,
    anexoNome: (r.anexo_nome as string) ?? undefined,
    anexoUrl: (r.anexo_url as string) ?? undefined,
  };
}

export async function fetchNotices(supabase: SupabaseClient): Promise<Notice[]> {
  const { data, error } = await supabase
    .from('notices')
    .select('*')
    .order('fixado', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) { console.error('fetchNotices:', error); return []; }
  return (data ?? []).map(rowToNotice);
}

export async function insertNotice(supabase: SupabaseClient, n: Omit<Notice, 'id' | 'data'>, autorNome: string): Promise<Notice | null> {
  const { data, error } = await supabase.from('notices').insert({
    titulo: n.titulo,
    conteudo: n.conteudo,
    categoria: n.categoria,
    autor: autorNome,
    fixado: n.fixado,
    anexo_nome: n.anexoNome,
    anexo_url: n.anexoUrl,
  }).select().single();
  if (error) { console.error('insertNotice:', error); return null; }
  return rowToNotice(data);
}

export async function deleteNoticeDB(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from('notices').delete().eq('id', id);
  if (error) console.error('deleteNoticeDB:', error);
}

// ──────────────────────────────────────────────
// FINES
// ──────────────────────────────────────────────

function rowToFine(r: Record<string, unknown>): FineNotice {
  return {
    id: r.id as string,
    numeroProtocolo: r.numero_protocolo as string,
    bloco: r.bloco as string,
    unidade: r.unidade as string,
    moradorNome: r.morador_nome as string,
    dataInfracao: r.data_infracao as string,
    dataEmissao: (r.created_at as string).split('T')[0],
    prazoRecursoData: r.prazo_recurso_data as string,
    artigoRegimento: r.artigo_regimento as string,
    descricaoInfracao: r.descricao_infracao as string,
    valor: Number(r.valor),
    tipo: r.tipo as FineNotice['tipo'],
    status: r.status as FineNotice['status'],
    evidencias: [],
    ciencia: r.ciencia_data
      ? { data: r.ciencia_data as string, ip: 'Portal Web', usuarioNome: r.ciencia_usuario_nome as string }
      : undefined,
    recurso: r.recurso_data
      ? {
          data: r.recurso_data as string,
          texto: r.recurso_texto as string,
          anexoNome: (r.recurso_anexo_nome as string) ?? undefined,
          resposta: (r.recurso_resposta as string) ?? undefined,
          dataResposta: (r.recurso_data_resposta as string) ?? undefined,
          status: (r.recurso_status as 'EM_ANALISE' | 'DEFERIDO' | 'INDEFERIDO') ?? 'EM_ANALISE',
          analisadoPor: (r.recurso_analisado_por as string) ?? undefined,
        }
      : undefined,
  };
}

export async function fetchFines(supabase: SupabaseClient): Promise<FineNotice[]> {
  const { data, error } = await supabase
    .from('fines')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error('fetchFines:', error); return []; }
  return (data ?? []).map(rowToFine);
}

export async function insertFine(
  supabase: SupabaseClient,
  fine: Omit<FineNotice, 'id' | 'numeroProtocolo' | 'dataEmissao' | 'status' | 'evidencias' | 'ciencia' | 'recurso'>,
  protocolNumber: string,
): Promise<FineNotice | null> {
  const { data, error } = await supabase.from('fines').insert({
    numero_protocolo: protocolNumber,
    bloco: fine.bloco,
    unidade: fine.unidade,
    morador_nome: fine.moradorNome,
    data_infracao: fine.dataInfracao,
    prazo_recurso_data: fine.prazoRecursoData,
    artigo_regimento: fine.artigoRegimento,
    descricao_infracao: fine.descricaoInfracao,
    valor: fine.valor,
    tipo: fine.tipo,
    status: 'PENDENTE_CIENCIA',
  }).select().single();
  if (error) { console.error('insertFine:', error); return null; }
  return rowToFine(data);
}

export async function updateFineDB(supabase: SupabaseClient, id: string, payload: Record<string, unknown>): Promise<FineNotice | null> {
  const { data, error } = await supabase.from('fines').update(payload).eq('id', id).select().single();
  if (error) { console.error('updateFineDB:', error); return null; }
  return rowToFine(data);
}

// ──────────────────────────────────────────────
// SPACES
// ──────────────────────────────────────────────

export async function fetchSpaces(supabase: SupabaseClient): Promise<CommonSpace[]> {
  const { data, error } = await supabase
    .from('spaces')
    .select('*')
    .order('nome', { ascending: true });
  if (error) { console.error('fetchSpaces:', error); return []; }
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    nome: r.nome as string,
    descricao: r.descricao as string,
    capacidadeMax: r.capacidade_max as number,
    horarioFuncionamento: r.horario_funcionamento as string,
    taxaLimpeza: Number(r.taxa_limpeza),
    regras: (r.regras as string[]) ?? [],
    imagemUrl: (r.imagem_url as string) ?? '',
  }));
}

// ──────────────────────────────────────────────
// RESERVATIONS
// ──────────────────────────────────────────────

function rowToReservation(r: Record<string, unknown>): Reservation {
  return {
    id: r.id as string,
    espacoId: r.espaco_id as string,
    espacoNome: r.espaco_nome as string,
    bloco: r.bloco as string,
    unidade: r.unidade as string,
    moradorNome: r.morador_nome as string,
    data: r.data as string,
    horarioInicio: r.horario_inicio as string,
    horarioFim: r.horario_fim as string,
    convidadosEstimados: r.convidados_estimados as number,
    status: r.status as Reservation['status'],
    motivoRecusa: (r.motivo_recusa as string) ?? undefined,
    dataSolicitacao: (r.created_at as string).split('T')[0],
    dataAvaliacao: (r.data_avaliacao as string) ?? undefined,
    avaliadoPor: (r.avaliado_por as string) ?? undefined,
  };
}

export async function fetchReservations(supabase: SupabaseClient): Promise<Reservation[]> {
  const { data, error } = await supabase
    .from('reservations')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error('fetchReservations:', error); return []; }
  return (data ?? []).map(rowToReservation);
}

export async function insertReservation(
  supabase: SupabaseClient,
  res: Omit<Reservation, 'id' | 'dataSolicitacao' | 'dataAvaliacao' | 'avaliadoPor' | 'motivoRecusa'>,
): Promise<Reservation | null> {
  const { data, error } = await supabase.from('reservations').insert({
    espaco_id: res.espacoId,
    espaco_nome: res.espacoNome,
    bloco: res.bloco,
    unidade: res.unidade,
    morador_nome: res.moradorNome,
    data: res.data,
    horario_inicio: res.horarioInicio,
    horario_fim: res.horarioFim,
    convidados_estimados: res.convidadosEstimados,
    status: 'PENDENTE',
  }).select().single();
  if (error) { console.error('insertReservation:', error); return null; }
  return rowToReservation(data);
}

export async function updateReservationDB(supabase: SupabaseClient, id: string, payload: Record<string, unknown>): Promise<Reservation | null> {
  const { data, error } = await supabase.from('reservations').update(payload).eq('id', id).select().single();
  if (error) { console.error('updateReservationDB:', error); return null; }
  return rowToReservation(data);
}

// ──────────────────────────────────────────────
// NOTIFICATIONS
// ──────────────────────────────────────────────

function rowToNotification(r: Record<string, unknown>): InAppNotification {
  return {
    id: r.id as string,
    titulo: r.titulo as string,
    mensagem: r.mensagem as string,
    tipo: r.tipo as InAppNotification['tipo'],
    data: new Date(r.created_at as string).toLocaleDateString('pt-BR'),
    lida: r.lida as boolean,
    unidadeAlvo: (r.unidade_alvo as string) ?? undefined,
    perfilAlvo: (r.perfil_alvo as InAppNotification['perfilAlvo']) ?? undefined,
    linkDestino: (r.link_destino as string) ?? undefined,
  };
}

export async function fetchNotifications(supabase: SupabaseClient): Promise<InAppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) { console.error('fetchNotifications:', error); return []; }
  return (data ?? []).map(rowToNotification);
}

export async function insertNotification(
  supabase: SupabaseClient,
  n: Omit<InAppNotification, 'id' | 'data' | 'lida'>,
): Promise<void> {
  const { error } = await supabase.from('notifications').insert({
    titulo: n.titulo,
    mensagem: n.mensagem,
    tipo: n.tipo,
    unidade_alvo: n.unidadeAlvo,
    perfil_alvo: n.perfilAlvo,
    link_destino: n.linkDestino,
  });
  if (error) console.error('insertNotification:', error);
}

export async function markNotifReadDB(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from('notifications').update({ lida: true }).eq('id', id);
  if (error) console.error('markNotifReadDB:', error);
}

export async function markAllNotifsReadDB(supabase: SupabaseClient, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase.from('notifications').update({ lida: true }).in('id', ids);
  if (error) console.error('markAllNotifsReadDB:', error);
}
