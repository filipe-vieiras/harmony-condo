import type { SupabaseClient } from '@supabase/supabase-js';
import type {
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
  User,
} from '@/types';

// ──────────────────────────────────────────────
// PROFILES (usuários do sistema)
// ──────────────────────────────────────────────

export async function fetchProfiles(supabase: SupabaseClient): Promise<User[]> {
  const { data, error } = await supabase.from('profiles').select('*').order('name', { ascending: true });
  if (error) { console.error('fetchProfiles:', error); return []; }
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    name: r.name as string,
    email: (r.email as string) ?? '',
    role: r.role as User['role'],
    cargo: (r.cargo as string) ?? undefined,
    bloco: (r.bloco as string) ?? undefined,
    unidade: (r.unidade as string) ?? undefined,
    telefone: (r.telefone as string) ?? undefined,
  }));
}

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
    moradores: (r.moradores as Unit['moradores']) ?? [],
    vagasGaragem: (r.vagas_garagem as string[]) ?? [],
    animais: (r.animais as string) ?? '',
    observacoes: (r.observacoes as string) ?? undefined,
    statusConvite: (r.status_convite as Unit['statusConvite']) ?? 'NAO_ENVIADO',
    usuarioId: (r.usuario_id as string) ?? undefined,
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

export async function insertUnit(
  supabase: SupabaseClient,
  unit: Omit<Unit, 'id'>
): Promise<{ unit: Unit | null; errorCode?: string; errorMessage?: string }> {
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
    moradores: unit.moradores ?? [],
  }).select().single();
  if (error) {
    console.error('insertUnit:', error);
    return { unit: null, errorCode: error.code, errorMessage: error.message };
  }
  return { unit: rowToUnit(data) };
}

export async function updateUnitDB(supabase: SupabaseClient, id: string, unit: Partial<Omit<Unit, 'id'>>): Promise<Unit | null> {
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
  if (unit.moradores !== undefined) payload.moradores = unit.moradores;
  if (unit.statusConvite !== undefined) payload.status_convite = unit.statusConvite;
  if (unit.usuarioId !== undefined) payload.usuario_id = unit.usuarioId;

  const { data, error } = await supabase.from('units').update(payload).eq('id', id).select().single();
  if (error) { console.error('updateUnitDB:', error); return null; }
  return rowToUnit(data);
}

export async function deleteUnitDB(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from('units').delete().eq('id', id);
  if (error) console.error('deleteUnitDB:', error);
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

export async function deleteVehicleDB(supabase: SupabaseClient, id: string): Promise<boolean> {
  // Um DELETE bloqueado por RLS não retorna erro — só afeta 0 linhas (a
  // policy de SELECT usada internamente já filtra a linha antes do delete).
  // Por isso é preciso checar quantas linhas voltaram, não só o campo error.
  const { data, error } = await supabase.from('vehicles').delete().eq('id', id).select();
  if (error) { console.error('deleteVehicleDB:', error); return false; }
  return (data?.length ?? 0) > 0;
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
    ativo: (r.ativo as boolean) ?? true,
  }));
}

export async function insertSpace(
  supabase: SupabaseClient,
  space: Omit<CommonSpace, 'id'>
): Promise<CommonSpace | null> {
  const { data, error } = await supabase.from('spaces').insert({
    nome: space.nome,
    descricao: space.descricao,
    capacidade_max: space.capacidadeMax,
    horario_funcionamento: space.horarioFuncionamento,
    taxa_limpeza: space.taxaLimpeza,
    regras: space.regras,
    imagem_url: space.imagemUrl,
    ativo: space.ativo ?? true,
  }).select().single();
  if (error) { console.error('insertSpace:', error); return null; }
  return {
    id: data.id,
    nome: data.nome,
    descricao: data.descricao,
    capacidadeMax: data.capacidade_max,
    horarioFuncionamento: data.horario_funcionamento,
    taxaLimpeza: Number(data.taxa_limpeza),
    regras: data.regras ?? [],
    imagemUrl: data.imagem_url ?? '',
    ativo: data.ativo ?? true,
  };
}

export async function updateSpaceDB(
  supabase: SupabaseClient,
  id: string,
  space: Partial<Omit<CommonSpace, 'id'>>
): Promise<CommonSpace | null> {
  const payload: Record<string, unknown> = {};
  if (space.nome !== undefined) payload.nome = space.nome;
  if (space.descricao !== undefined) payload.descricao = space.descricao;
  if (space.capacidadeMax !== undefined) payload.capacidade_max = space.capacidadeMax;
  if (space.horarioFuncionamento !== undefined) payload.horario_funcionamento = space.horarioFuncionamento;
  if (space.taxaLimpeza !== undefined) payload.taxa_limpeza = space.taxaLimpeza;
  if (space.regras !== undefined) payload.regras = space.regras;
  if (space.imagemUrl !== undefined) payload.imagem_url = space.imagemUrl;
  if (space.ativo !== undefined) payload.ativo = space.ativo;

  const { data, error } = await supabase.from('spaces').update(payload).eq('id', id).select().single();
  if (error) { console.error('updateSpaceDB:', error); return null; }
  return {
    id: data.id,
    nome: data.nome,
    descricao: data.descricao,
    capacidadeMax: data.capacidade_max,
    horarioFuncionamento: data.horario_funcionamento,
    taxaLimpeza: Number(data.taxa_limpeza),
    regras: data.regras ?? [],
    imagemUrl: data.imagem_url ?? '',
    ativo: data.ativo ?? true,
  };
}

export async function deleteSpaceDB(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from('spaces').delete().eq('id', id);
  if (error) console.error('deleteSpaceDB:', error);
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

// ──────────────────────────────────────────────
// DOCUMENTS & LINKS
// ──────────────────────────────────────────────

function rowToDocument(r: Record<string, unknown>): DocumentLink {
  return {
    id: r.id as string,
    titulo: r.titulo as string,
    descricao: (r.descricao as string) ?? '',
    categoria: r.categoria as DocumentLink['categoria'],
    arquivoNome: (r.arquivo_nome as string) ?? undefined,
    tamanhoArquivo: (r.tamanho_arquivo as string) ?? undefined,
    linkExterno: (r.link_externo as string) ?? '',
    telefone: (r.telefone as string) ?? undefined,
    dataAtualizacao: r.data_atualizacao
      ? new Date(r.data_atualizacao as string).toLocaleDateString('pt-BR')
      : new Date().toLocaleDateString('pt-BR'),
  };
}

export async function fetchDocuments(supabase: SupabaseClient): Promise<DocumentLink[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error('fetchDocuments:', error); return []; }
  return (data ?? []).map(rowToDocument);
}

export async function insertDocument(
  supabase: SupabaseClient,
  doc: Omit<DocumentLink, 'id' | 'dataAtualizacao'>
): Promise<DocumentLink | null> {
  const { data, error } = await supabase.from('documents').insert({
    titulo: doc.titulo,
    descricao: doc.descricao,
    categoria: doc.categoria,
    arquivo_nome: doc.arquivoNome,
    tamanho_arquivo: doc.tamanhoArquivo,
    link_externo: doc.linkExterno,
    telefone: doc.telefone,
  }).select().single();
  if (error) { console.error('insertDocument:', error); return null; }
  return rowToDocument(data);
}

export async function updateDocumentDB(
  supabase: SupabaseClient,
  id: string,
  doc: Partial<Omit<DocumentLink, 'id' | 'dataAtualizacao'>>
): Promise<DocumentLink | null> {
  const payload: Record<string, unknown> = { data_atualizacao: new Date().toISOString() };
  if (doc.titulo !== undefined) payload.titulo = doc.titulo;
  if (doc.descricao !== undefined) payload.descricao = doc.descricao;
  if (doc.categoria !== undefined) payload.categoria = doc.categoria;
  if (doc.arquivoNome !== undefined) payload.arquivo_nome = doc.arquivoNome;
  if (doc.tamanhoArquivo !== undefined) payload.tamanho_arquivo = doc.tamanhoArquivo;
  if (doc.linkExterno !== undefined) payload.link_externo = doc.linkExterno;
  if (doc.telefone !== undefined) payload.telefone = doc.telefone;

  const { data, error } = await supabase.from('documents').update(payload).eq('id', id).select().single();
  if (error) { console.error('updateDocumentDB:', error); return null; }
  return rowToDocument(data);
}

export async function deleteDocumentDB(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from('documents').delete().eq('id', id);
  if (error) console.error('deleteDocumentDB:', error);
}

// ──────────────────────────────────────────────
// AUDIT LOGS
// ──────────────────────────────────────────────

function rowToAuditLog(r: Record<string, unknown>): AuditLog {
  return {
    id: r.id as string,
    usuarioId: (r.usuario_id as string) ?? undefined,
    usuarioNome: r.usuario_nome as string,
    usuarioRole: r.usuario_role as AuditLog['usuarioRole'],
    acao: r.acao as string,
    modulo: r.modulo as AuditLog['modulo'],
    detalhes: (r.detalhes as Record<string, unknown>) ?? undefined,
    createdAt: (r.created_at as string) ?? new Date().toISOString(),
  };
}

export async function fetchAuditLogs(supabase: SupabaseClient, modulo?: string): Promise<AuditLog[]> {
  let query = supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100);
  if (modulo && modulo !== 'TODOS') {
    query = query.eq('modulo', modulo);
  }
  const { data, error } = await query;
  if (error) { console.error('fetchAuditLogs:', error); return []; }
  return (data ?? []).map(rowToAuditLog);
}

export async function insertAuditLog(
  supabase: SupabaseClient,
  log: Omit<AuditLog, 'id' | 'createdAt'>
): Promise<void> {
  const { error } = await supabase.from('audit_logs').insert({
    usuario_id: log.usuarioId,
    usuario_nome: log.usuarioNome,
    usuario_role: log.usuarioRole,
    acao: log.acao,
    modulo: log.modulo,
    detalhes: log.detalhes ?? {},
  });
  if (error) console.error('insertAuditLog:', error);
}

// ──────────────────────────────────────────────
// PENDING INVITES (fila de convites em lote)
// ──────────────────────────────────────────────

function rowToPendingInvite(r: Record<string, unknown>): PendingInvite {
  return {
    id: r.id as string,
    nome: r.nome as string,
    email: r.email as string,
    role: r.role as PendingInvite['role'],
    bloco: (r.bloco as string) ?? undefined,
    unidade: (r.unidade as string) ?? undefined,
    unitId: (r.unit_id as string) ?? undefined,
    status: r.status as PendingInvite['status'],
    erroMensagem: (r.erro_mensagem as string) ?? undefined,
    criadoPor: (r.criado_por as string) ?? undefined,
    criadoEm: r.criado_em as string,
    enviadoEm: (r.enviado_em as string) ?? undefined,
    linkAcesso: (r.link_acesso as string) ?? undefined,
  };
}

export async function fetchPendingInvites(supabase: SupabaseClient): Promise<PendingInvite[]> {
  const { data, error } = await supabase
    .from('pending_invites')
    .select('*')
    .order('criado_em', { ascending: false });
  if (error) { console.error('fetchPendingInvites:', error); return []; }
  return (data ?? []).map(rowToPendingInvite);
}

export async function insertPendingInvite(
  supabase: SupabaseClient,
  invite: Omit<PendingInvite, 'id' | 'status' | 'criadoEm' | 'enviadoEm' | 'erroMensagem'>
): Promise<PendingInvite | null> {
  const { data, error } = await supabase.from('pending_invites').insert({
    nome: invite.nome,
    email: invite.email,
    role: invite.role,
    bloco: invite.bloco,
    unidade: invite.unidade,
    unit_id: invite.unitId,
    criado_por: invite.criadoPor,
    status: 'PENDENTE',
  }).select().single();
  if (error) { console.error('insertPendingInvite:', error); return null; }
  return rowToPendingInvite(data);
}

export async function updatePendingInviteDB(
  supabase: SupabaseClient,
  id: string,
  patch: Partial<Pick<PendingInvite, 'nome' | 'email' | 'bloco' | 'unidade'>>
): Promise<PendingInvite | null> {
  const payload: Record<string, unknown> = {};
  if (patch.nome !== undefined) payload.nome = patch.nome;
  if (patch.email !== undefined) payload.email = patch.email;
  if (patch.bloco !== undefined) payload.bloco = patch.bloco;
  if (patch.unidade !== undefined) payload.unidade = patch.unidade;

  const { data, error } = await supabase.from('pending_invites').update(payload).eq('id', id).select().single();
  if (error) { console.error('updatePendingInviteDB:', error); return null; }
  return rowToPendingInvite(data);
}

export async function deletePendingInviteDB(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from('pending_invites').delete().eq('id', id);
  if (error) console.error('deletePendingInviteDB:', error);
}

// ──────────────────────────────────────────────
// ZELADOR (cadastro estruturado, sem login)
// ──────────────────────────────────────────────

export async function fetchZelador(supabase: SupabaseClient): Promise<Zelador | null> {
  const { data, error } = await supabase.from('zelador').select('*').eq('id', 1).single();
  if (error) { console.error('fetchZelador:', error); return null; }
  return {
    nome: data.nome ?? '',
    telefone: data.telefone ?? '',
    horarioAtendimento: data.horario_atendimento ?? '',
    observacoes: data.observacoes ?? undefined,
    atualizadoEm: data.atualizado_em ?? undefined,
  };
}

export async function updateZeladorDB(supabase: SupabaseClient, zelador: Zelador): Promise<Zelador | null> {
  const { data, error } = await supabase.from('zelador').update({
    nome: zelador.nome,
    telefone: zelador.telefone,
    horario_atendimento: zelador.horarioAtendimento,
    observacoes: zelador.observacoes,
    atualizado_em: new Date().toISOString(),
  }).eq('id', 1).select().single();
  if (error) { console.error('updateZeladorDB:', error); return null; }
  return {
    nome: data.nome ?? '',
    telefone: data.telefone ?? '',
    horarioAtendimento: data.horario_atendimento ?? '',
    observacoes: data.observacoes ?? undefined,
    atualizadoEm: data.atualizado_em ?? undefined,
  };
}

