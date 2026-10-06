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
  PortalAdministradora,
  User,
  Autocadastro,
  DiretorioUnidade,
} from '@/types';
import type { CargoTransferencia } from '@/lib/cargos';

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
    cadastroValidado: (r.cadastro_validado as boolean) ?? true,
    desativadoEm: (r.desativado_em as string) ?? undefined,
    aguardandoAceite: (r.aguardando_aceite as boolean) ?? false,
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

// O documento (RG/CPF) do morador não fica mais no JSON de units: mora em unit_documentos, que o banco só
// devolve à gestão e ao próprio morador (para Portaria e Conselho a consulta volta vazia). Aqui ele é
// religado ao morador pelo id, de modo que as telas continuam lendo `morador.rgCpf`.
async function comDocumentos(supabase: SupabaseClient, units: Unit[]): Promise<Unit[]> {
  if (units.length === 0) return units;
  const { data, error } = await supabase.from('unit_documentos').select('unit_id, morador_id, documento');
  if (error || !data?.length) return units;
  const porMorador = new Map(data.map((d) => [`${d.unit_id}:${d.morador_id}`, d.documento as string]));
  return units.map((u) => ({
    ...u,
    moradores: u.moradores.map((m) => {
      const documento = m.id ? porMorador.get(`${u.id}:${m.id}`) : undefined;
      return documento ? { ...m, rgCpf: documento } : m;
    }),
  }));
}

/** Tira o documento do JSON que vai para units (o banco também recusa guardá-lo ali). */
const semDocumento = (moradores: Unit['moradores']): Unit['moradores'] =>
  moradores.map((m) => {
    const resto = { ...m };
    delete resto.rgCpf;
    return resto;
  });

/**
 * Grava os documentos pela função da gestão. `gravados` são os moradores como o banco os guardou
 * (já com id); `enviados`, os da tela, na mesma ordem. Documento não informado (undefined) não muda;
 * texto vazio apaga. Quem saiu da unidade perde o documento.
 */
async function gravarDocumentos(
  supabase: SupabaseClient,
  unitId: string,
  gravados: Unit['moradores'],
  enviados: Unit['moradores']
): Promise<boolean> {
  const docs: Record<string, string> = {};
  gravados.forEach((m, i) => {
    const doc = enviados[i]?.rgCpf;
    if (m.id && doc !== undefined) docs[m.id] = doc;
  });
  const { error } = await supabase.rpc('salvar_documentos_unidade', {
    p_unit_id: unitId,
    p_docs: docs,
    p_manter: gravados.map((m) => m.id).filter((id): id is string => !!id),
  });
  if (error) console.error('gravarDocumentos:', error);
  return !error;
}

export async function fetchUnits(supabase: SupabaseClient): Promise<Unit[]> {
  const { data, error } = await supabase
    .from('units')
    .select('*')
    .order('bloco', { ascending: true })
    .order('numero', { ascending: true });
  if (error) { console.error('fetchUnits:', error); return []; }
  return comDocumentos(supabase, (data ?? []).map(rowToUnit));
}

/**
 * O Zelador não lê `units`: recebe só nome, telefone, e-mail e vínculo de quem mora, mais bloco e número (função do banco).
 * O resto do cadastro (proprietário que não mora, observações, animais, vagas, conta e convite) fica em branco.
 */
export async function fetchUnidadesDoZelador(supabase: SupabaseClient): Promise<Unit[]> {
  const { data, error } = await supabase.rpc('unidades_para_zelador');
  if (error) { console.error('fetchUnidadesDoZelador:', error); return []; }
  return (data ?? []).map((r: { id: string; bloco: string; numero: string; moradores: Unit['moradores'] }): Unit => ({
    id: r.id,
    bloco: r.bloco,
    numero: r.numero,
    proprietarioNome: '',
    proprietarioTelefone: '',
    proprietarioEmail: '',
    // Só para a tela rotular o morador principal: deduzido de quem mora (o cadastro de ocupação não vai ao Zelador).
    tipoOcupacao: (r.moradores ?? []).some((m) => m.tipo === 'INQUILINO') ? 'INQUILINO' : (r.moradores ?? []).some((m) => m.tipo === 'TITULAR') ? 'PROPRIETARIO' : 'DESOCUPADO',
    moradores: r.moradores ?? [],
    vagasGaragem: [],
    animais: '',
    statusConvite: 'NAO_ENVIADO',
  }));
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
    moradores: semDocumento(unit.moradores ?? []),
  }).select().single();
  if (error) {
    console.error('insertUnit:', error);
    return { unit: null, errorCode: error.code, errorMessage: error.message };
  }
  const criada = rowToUnit(data);
  if (unit.moradores?.some((m) => m.rgCpf)) await gravarDocumentos(supabase, criada.id, criada.moradores, unit.moradores);
  return { unit: (await comDocumentos(supabase, [criada]))[0] };
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
  if (unit.moradores !== undefined) payload.moradores = semDocumento(unit.moradores);
  if (unit.statusConvite !== undefined) payload.status_convite = unit.statusConvite;
  if (unit.usuarioId !== undefined) payload.usuario_id = unit.usuarioId;

  const { data, error } = await supabase.from('units').update(payload).eq('id', id).select().single();
  if (error) { console.error('updateUnitDB:', error); return null; }
  const atualizada = rowToUnit(data);
  if (unit.moradores !== undefined && !(await gravarDocumentos(supabase, id, atualizada.moradores, unit.moradores))) return null;
  return (await comDocumentos(supabase, [atualizada]))[0];
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
    unitId: (r.unit_id as string) ?? undefined,
    bloco: r.bloco as string,
    unidade: r.unidade as string,
    vaga: r.vaga as string,
    proprietarioNome: r.proprietario_nome as string,
    telefoneContato: r.telefone_contato as string,
    status: r.status as Vehicle['status'],
    tipoVeiculo: (r.tipo_veiculo as Vehicle['tipoVeiculo']) ?? 'OUTRO',
  };
}

export async function fetchVehicles(supabase: SupabaseClient): Promise<Vehicle[]> {
  const { data, error } = await supabase.from('vehicles').select('*').order('created_at', { ascending: false });
  if (error) { console.error('fetchVehicles:', error); return []; }
  return (data ?? []).map(rowToVehicle);
}

/** Resultado de gravar um veículo: o veículo salvo, ou o motivo da falha (placa já cadastrada = 23505). */
export type ResultadoVeiculo = { veiculo: Vehicle } | { veiculo: null; placaDuplicada: boolean };

export async function insertVehicle(supabase: SupabaseClient, v: Omit<Vehicle, 'id'>): Promise<ResultadoVeiculo> {
  const { data, error } = await supabase.from('vehicles').insert({
    placa: v.placa,
    marca: v.marca,
    modelo: v.modelo,
    cor: v.cor,
    unit_id: v.unitId ?? null,
    bloco: v.bloco,
    unidade: v.unidade,
    vaga: v.vaga,
    proprietario_nome: v.proprietarioNome,
    telefone_contato: v.telefoneContato,
    status: v.status,
    tipo_veiculo: v.tipoVeiculo,
  }).select().single();
  if (error) { console.error('insertVehicle:', error); return { veiculo: null, placaDuplicada: error.code === '23505' }; }
  return { veiculo: rowToVehicle(data) };
}

/** Campos que um veículo já cadastrado pode ter alterados (o morador só envia os cinco primeiros). */
export type AlteracaoVeiculo = Partial<Pick<Vehicle, 'placa' | 'marca' | 'modelo' | 'cor' | 'tipoVeiculo' | 'vaga' | 'status' | 'proprietarioNome' | 'telefoneContato'>>;

/**
 * Atualiza um veículo. Quem pode e quais colunas (equipe: tudo; morador: placa, marca, modelo,
 * cor e tipo da própria unidade) é decidido pelo banco; um UPDATE bloqueado por RLS não dá erro,
 * só 0 linhas, então confere quantas voltaram. A placa volta normalizada pelo gatilho.
 */
export async function updateVehicleDB(supabase: SupabaseClient, id: string, v: AlteracaoVeiculo): Promise<ResultadoVeiculo> {
  const campos: Record<string, unknown> = {};
  if (v.placa !== undefined) campos.placa = v.placa;
  if (v.marca !== undefined) campos.marca = v.marca;
  if (v.modelo !== undefined) campos.modelo = v.modelo;
  if (v.cor !== undefined) campos.cor = v.cor;
  if (v.tipoVeiculo !== undefined) campos.tipo_veiculo = v.tipoVeiculo;
  if (v.vaga !== undefined) campos.vaga = v.vaga;
  if (v.status !== undefined) campos.status = v.status;
  if (v.proprietarioNome !== undefined) campos.proprietario_nome = v.proprietarioNome;
  if (v.telefoneContato !== undefined) campos.telefone_contato = v.telefoneContato;
  const { data, error } = await supabase.from('vehicles').update(campos).eq('id', id).select();
  if (error) { console.error('updateVehicleDB:', error); return { veiculo: null, placaDuplicada: error.code === '23505' }; }
  return data?.[0] ? { veiculo: rowToVehicle(data[0]) } : { veiculo: null, placaDuplicada: false };
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
    autorId: (r.autor_id as string) ?? undefined,
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

// Devolve `true` só se uma linha foi mesmo apagada: a regra de acesso (RLS) recusa em silêncio,
// sem erro, então conferir só `error` deixaria passar uma exclusão que o banco não fez.
export async function deleteNoticeDB(supabase: SupabaseClient, id: string): Promise<boolean> {
  const { data, error } = await supabase.from('notices').delete().eq('id', id).select('id');
  if (error) console.error('deleteNoticeDB:', error);
  return !error && (data?.length ?? 0) > 0;
}

// ──────────────────────────────────────────────
// FINES
// ──────────────────────────────────────────────

function rowToFine(r: Record<string, unknown>): FineNotice {
  return {
    id: r.id as string,
    numeroProtocolo: r.numero_protocolo as string,
    unitId: (r.unit_id as string) ?? undefined,
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
    anulacao: r.status === 'ANULADA'
      ? {
          motivo: (r.anulada_motivo as string) ?? '',
          porNome: (r.anulada_por_nome as string) ?? '',
          porPapel: (r.anulada_por_papel as string) ?? '',
          em: (r.anulada_em as string) ?? '',
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
    unit_id: fine.unitId ?? null,
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

/**
 * Anula a multa como o próprio usuário logado (nunca com a chave de serviço): quem
 * garante papel, motivo mínimo e carimbo de quem/quando é o gatilho do banco (0029).
 * Devolve a mensagem do banco quando ele recusa, para a tela mostrar em português.
 */
export async function anularFineDB(
  supabase: SupabaseClient, id: string, motivo: string,
): Promise<{ fine: FineNotice | null; erro?: string; recusada?: boolean }> {
  const { data, error } = await supabase
    .from('fines')
    .update({ status: 'ANULADA', anulada_motivo: motivo })
    .eq('id', id)
    .select()
    .maybeSingle();
  if (error) {
    console.error('anularFineDB:', error);
    // 42501/23514 = o banco recusou a regra; qualquer outro código é falha de rede/servidor.
    const recusada = error.code === '42501' || error.code === '23514';
    return { fine: null, erro: recusada ? error.message : undefined, recusada };
  }
  // A RLS recusa em silêncio (0 linhas) quando o perfil não pode alterar a multa.
  if (!data) return { fine: null, erro: 'Você não tem permissão para anular esta multa.', recusada: true };
  return { fine: rowToFine(data) };
}

/** Apaga a multa (só o ADM, pela policy). Confere se o banco apagou de fato: a RLS recusa com 0 linhas. */
export async function deleteFineDB(supabase: SupabaseClient, id: string): Promise<{ ok: boolean; erro?: string }> {
  const { data, error } = await supabase.from('fines').delete().eq('id', id).select('id');
  if (error) { console.error('deleteFineDB:', error); return { ok: false }; }
  if (!data || data.length === 0) return { ok: false, erro: 'Só a administradora pode apagar uma multa.' };
  return { ok: true };
}

// ──────────────────────────────────────────────
// SPACES
// ──────────────────────────────────────────────

function rowToSpace(r: Record<string, unknown>): CommonSpace {
  return {
    id: r.id as string,
    nome: r.nome as string,
    descricao: r.descricao as string,
    capacidadeMax: r.capacidade_max as number,
    horarioFuncionamento: r.horario_funcionamento as string,
    taxaLimpeza: Number(r.taxa_limpeza),
    regras: (r.regras as string[]) ?? [],
    imagemUrl: (r.imagem_url as string) ?? '',
    ativo: (r.ativo as boolean) ?? true,
    exigeAprovacao: (r.exige_aprovacao as boolean) ?? true,
    faixaGratisAte: r.faixa_gratis_ate == null ? null : Number(r.faixa_gratis_ate),
    faixaValor: r.faixa_valor == null ? null : Number(r.faixa_valor),
    motivoInterdicao: (r.motivo_interdicao as string | null) ?? null,
  };
}

export async function fetchSpaces(supabase: SupabaseClient): Promise<CommonSpace[]> {
  const { data, error } = await supabase
    .from('spaces')
    .select('*')
    .order('nome', { ascending: true });
  if (error) { console.error('fetchSpaces:', error); return []; }
  return (data ?? []).map(rowToSpace);
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
    exige_aprovacao: space.exigeAprovacao,
    faixa_gratis_ate: space.faixaGratisAte ?? null,
    faixa_valor: space.faixaValor ?? null,
  }).select().single();
  if (error) { console.error('insertSpace:', error); return null; }
  return rowToSpace(data);
}

export interface InterdicaoInfo { por: string; em: string }

/** Quem interditou cada espaço e quando (só a equipe operacional recebe; para os demais volta vazio). */
export async function fetchInterdicoes(supabase: SupabaseClient): Promise<Record<string, InterdicaoInfo>> {
  const { data, error } = await supabase.rpc('interdicoes_atuais');
  if (error) { console.error('fetchInterdicoes:', error); return {}; }
  const mapa: Record<string, InterdicaoInfo> = {};
  for (const r of (data ?? []) as { espaco_id: string; por_nome: string; em: string }[]) mapa[r.espaco_id] = { por: r.por_nome, em: r.em };
  return mapa;
}

export type ResultadoInterdicao =
  | { ok: true; alterado: boolean; ativo: boolean; motivo: string | null }
  | { ok: false; erro: 'SEM_PERMISSAO' | 'MOTIVO_LONGO' | 'NAO_ENCONTRADO' | 'ERRO' };

/** Interdita (ativo = false) ou reabre o espaço, pela função do banco. Não mexe em reserva nenhuma. */
export async function interditarEspacoDB(
  supabase: SupabaseClient,
  espacoId: string,
  ativo: boolean,
  motivo?: string
): Promise<ResultadoInterdicao> {
  const { data, error } = await supabase.rpc('interditar_espaco', {
    p_espaco_id: espacoId,
    p_ativo: ativo,
    p_motivo: ativo ? null : (motivo ?? null),
  });
  if (error) {
    console.error('interditarEspacoDB:', error);
    if (error.code === '42501') return { ok: false, erro: 'SEM_PERMISSAO' };
    if (error.message?.includes('motivo_muito_longo')) return { ok: false, erro: 'MOTIVO_LONGO' };
    if (error.code === 'P0002' || error.code === '22023' || /espaco_nao_encontrado/.test(error.message ?? '')) return { ok: false, erro: 'NAO_ENCONTRADO' };
    return { ok: false, erro: 'ERRO' };
  }
  return { ok: true, alterado: !!data?.alterado, ativo: !!data?.ativo, motivo: (data?.motivo as string | null) ?? null };
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
  // `ativo` e o motivo da interdição NÃO vão por aqui: o banco recusa e só interditar_espaco() grava (e audita).
  if (space.exigeAprovacao !== undefined) payload.exige_aprovacao = space.exigeAprovacao;
  // null é um valor de verdade aqui (volta a "grátis"); undefined = não mexe.
  if (space.faixaGratisAte !== undefined) payload.faixa_gratis_ate = space.faixaGratisAte;
  if (space.faixaValor !== undefined) payload.faixa_valor = space.faixaValor;

  const { data, error } = await supabase.from('spaces').update(payload).eq('id', id).select().single();
  if (error) { console.error('updateSpaceDB:', error); return null; }
  return rowToSpace(data);
}

/** Pares de bloqueio entre espaços (0038). Só a gestão lê: para os demais perfis volta vazio. */
export async function fetchSpaceBlocks(supabase: SupabaseClient): Promise<{ a: string; b: string }[]> {
  const { data, error } = await supabase.from('space_blocks').select('espaco_a, espaco_b');
  if (error) { console.error('fetchSpaceBlocks:', error); return []; }
  return (data ?? []).map((r: { espaco_a: string; espaco_b: string }) => ({ a: r.espaco_a, b: r.espaco_b }));
}

/**
 * Grava, numa transação do banco, a lista COMPLETA de espaços que `espacoId` bloqueia. O par é
 * simétrico e ordenado pelo banco: marcar ou desmarcar aqui vale também para o outro lado.
 */
export async function definirBloqueiosEspacoDB(supabase: SupabaseClient, espacoId: string, outrosIds: string[]): Promise<boolean> {
  const { error } = await supabase.rpc('definir_bloqueios_espaco', { p_espaco_id: espacoId, p_outros: outrosIds });
  if (error) { console.error('definirBloqueiosEspacoDB:', error); return false; }
  return true;
}

export async function deleteSpaceDB(
  supabase: SupabaseClient,
  id: string
): Promise<{ success: boolean; errorCode?: string }> {
  // Um DELETE bloqueado por RLS não retorna erro — só afeta 0 linhas (a
  // policy de SELECT usada internamente já filtra a linha antes do delete).
  const { data, error } = await supabase.from('spaces').delete().eq('id', id).select();
  if (error) { console.error('deleteSpaceDB:', error); return { success: false, errorCode: error.code }; }
  return { success: (data?.length ?? 0) > 0 };
}

// ──────────────────────────────────────────────
// RESERVATIONS
// ──────────────────────────────────────────────

function rowToReservation(r: Record<string, unknown>): Reservation {
  return {
    id: r.id as string,
    espacoId: (r.espaco_id as string) ?? undefined,
    espacoNome: r.espaco_nome as string,
    bloco: r.bloco as string,
    unidade: r.unidade as string,
    moradorNome: r.morador_nome as string,
    data: r.data as string,
    horarioInicio: r.horario_inicio as string,
    horarioFim: r.horario_fim as string,
    convidadosEstimados: r.convidados_estimados as number,
    valorUso: r.valor_uso == null ? undefined : Number(r.valor_uso),
    taxaHigienizacao: r.taxa_higienizacao == null ? undefined : Number(r.taxa_higienizacao),
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

/** Por que o banco recusou a reserva (mensagens curtas das migrações 0032, 0034, 0038 e 0039). */
export type ErroReserva = 'CONFLITO' | 'DIA_PASSADO' | 'INDISPONIVEL' | 'BLOQUEADO' | 'PESSOAS_INVALIDAS' | 'ERRO';

export async function insertReservation(
  supabase: SupabaseClient,
  res: Omit<Reservation, 'id' | 'dataSolicitacao' | 'dataAvaliacao' | 'avaliadoPor' | 'motivoRecusa'>,
): Promise<{ reserva: Reservation | null; erro?: ErroReserva }> {
  // O status enviado é só um pedido: quem decide PENDENTE ou APROVADA é o gatilho do banco (0034),
  // pela configuração do espaço. A reserva devolvida aqui já traz o status real.
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
  if (error) {
    console.error('insertReservation:', error);
    // 23505 = índice único (espaço + dia já ocupado por PENDENTE/APROVADA).
    if (error.code === '23505') return { reserva: null, erro: 'CONFLITO' };
    if (error.message === 'reserva_dia_passado') return { reserva: null, erro: 'DIA_PASSADO' };
    if (error.message === 'reserva_espaco_indisponivel') return { reserva: null, erro: 'INDISPONIVEL' };
    // Espaço que bloqueia (ou é bloqueado por) outro que já tem pedido no dia (0038).
    if (error.message === 'reserva_dia_indisponivel') return { reserva: null, erro: 'BLOQUEADO' };
    if (error.message === 'reserva_pessoas_invalidas') return { reserva: null, erro: 'PESSOAS_INVALIDAS' };
    return { reserva: null, erro: 'ERRO' };
  }
  return { reserva: rowToReservation(data) };
}

/**
 * Dias ocupados (PENDENTE ou APROVADA) por espaço, de `inicio` a `fim` (YYYY-MM-DD).
 * Função do banco (0033): devolve só espaço + data, sem nome, unidade ou status de ninguém.
 * Devolve null quando a consulta falha, para a tela mostrar erro em vez de "tudo livre".
 */
export async function fetchDisponibilidade(
  supabase: SupabaseClient,
  inicio: string,
  fim: string,
): Promise<{ espacoId: string; data: string }[] | null> {
  const { data, error } = await supabase.rpc('disponibilidade_reservas', { inicio, fim });
  if (error) { console.error('fetchDisponibilidade:', error); return null; }
  return ((data ?? []) as { espaco_id: string; data: string }[]).map((l) => ({ espacoId: l.espaco_id, data: l.data }));
}

/**
 * Valor de uso de uma reserva com `pessoas` pessoas no espaço, pela MESMA função que o gatilho de
 * criação usa (0039): a prévia da tela nunca calcula sozinha. Nulo quando a consulta falha.
 */
export async function fetchValorReserva(supabase: SupabaseClient, espacoId: string, pessoas: number): Promise<number | null> {
  const { data, error } = await supabase.rpc('valor_reserva', { p_espaco_id: espacoId, p_pessoas: pessoas });
  if (error || data === null || data === undefined) {
    if (error) console.error('fetchValorReserva:', error);
    return null;
  }
  return Number(data);
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
    // "Lida" é por usuário (0028): a RLS de notification_reads só devolve as
    // linhas do próprio usuário, então basta existir uma.
    lida: Array.isArray(r.notification_reads) && r.notification_reads.length > 0,
    unidadeAlvo: (r.unidade_alvo as string) ?? undefined,
    unidadeIdAlvo: (r.unidade_id_alvo as string) ?? undefined,
    perfilAlvo: (r.perfil_alvo as InAppNotification['perfilAlvo']) ?? undefined,
    linkDestino: (r.link_destino as string) ?? undefined,
    usuarioIdAlvo: (r.usuario_id_alvo as string) ?? undefined,
  };
}

export async function fetchNotifications(supabase: SupabaseClient): Promise<InAppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*, notification_reads(user_id)')
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
    unidade_id_alvo: n.unidadeIdAlvo,
    perfil_alvo: n.perfilAlvo,
    link_destino: n.linkDestino,
  });
  if (error) console.error('insertNotification:', error);
}

export async function markNotifReadDB(supabase: SupabaseClient, id: string): Promise<void> {
  await markAllNotifsReadDB(supabase, [id]);
}

export async function markAllNotifsReadDB(supabase: SupabaseClient, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  // user_id vem do default auth.uid(); ignoreDuplicates = já lida não é erro.
  const { error } = await supabase
    .from('notification_reads')
    .upsert(ids.map((notification_id) => ({ notification_id })), { onConflict: 'notification_id,user_id', ignoreDuplicates: true });
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

export async function deleteDocumentDB(supabase: SupabaseClient, id: string): Promise<boolean> {
  // Um DELETE bloqueado por RLS não retorna erro — só afeta 0 linhas.
  const { data, error } = await supabase.from('documents').delete().eq('id', id).select();
  if (error) { console.error('deleteDocumentDB:', error); return false; }
  return (data?.length ?? 0) > 0;
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

function rowToPendingInvite(r: Record<string, unknown>, links?: Map<string, string>): PendingInvite {
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
    // O link mora em convite_links, que só Síndico e ADM leem (para os demais fica vazio).
    linkAcesso: links?.get(r.id as string),
    transferenciaId: (r.transferencia_id as string) ?? undefined,
  };
}

export async function fetchPendingInvites(supabase: SupabaseClient): Promise<PendingInvite[]> {
  const { data, error } = await supabase
    .from('pending_invites')
    .select('*')
    .order('criado_em', { ascending: false });
  if (error) { console.error('fetchPendingInvites:', error); return []; }
  const { data: links } = await supabase.from('convite_links').select('invite_id, link_acesso');
  const porConvite = new Map((links ?? []).map((l: { invite_id: string; link_acesso: string }) => [l.invite_id, l.link_acesso]));
  return (data ?? []).map((r) => rowToPendingInvite(r, porConvite));
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

// Mesmo cuidado de deleteNoticeDB: `true` só se o banco apagou de fato.
export async function deletePendingInviteDB(supabase: SupabaseClient, id: string): Promise<boolean> {
  const { data, error } = await supabase.from('pending_invites').delete().eq('id', id).select('id');
  if (error) console.error('deletePendingInviteDB:', error);
  return !error && (data?.length ?? 0) > 0;
}

// ──────────────────────────────────────────────
// TRANSFERÊNCIAS DE CARGO (só leitura: quem grava são as funções do banco)
// ──────────────────────────────────────────────

/** Pendentes e concluídas nos últimos 30 dias que a RLS deixa este usuário ver (equipe: todas; os demais: as próprias). */
export async function fetchCargoTransferencias(supabase: SupabaseClient): Promise<CargoTransferencia[]> {
  const desde = new Date(Date.now() - 30 * 864e5).toISOString();
  const { data, error } = await supabase
    .from('cargo_transferencias')
    .select('*')
    .or(`status.eq.PENDENTE,and(status.eq.CONCLUIDA,criado_em.gte.${desde})`)
    .order('criado_em', { ascending: false })
    .limit(30);
  if (error) { console.error('fetchCargoTransferencias:', error); return []; }
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    cargo: r.cargo as CargoTransferencia['cargo'],
    origemId: (r.origem_id as string) ?? undefined,
    origemNome: r.origem_nome as string,
    destinoId: (r.destino_id as string) ?? undefined,
    destinoNome: r.destino_nome as string,
    destinoTipo: r.destino_tipo as CargoTransferencia['destinoTipo'],
    status: r.status as CargoTransferencia['status'],
    criadoEm: r.criado_em as string,
    concluidoEm: (r.concluido_em as string) ?? undefined,
  }));
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

// ──────────────────────────────────────────────
// PORTAL DA ADMINISTRADORA (item fixo, singleton, editável)
// ──────────────────────────────────────────────

export async function fetchPortalAdministradora(supabase: SupabaseClient): Promise<PortalAdministradora | null> {
  const { data, error } = await supabase.from('portal_administradora').select('*').eq('id', 1).single();
  if (error) { console.error('fetchPortalAdministradora:', error); return null; }
  return {
    descricao: data.descricao ?? '',
    linkExterno: data.link_externo ?? '',
    atualizadoEm: data.atualizado_em ?? undefined,
  };
}

export async function updatePortalAdministradoraDB(
  supabase: SupabaseClient,
  portal: PortalAdministradora
): Promise<PortalAdministradora | null> {
  const { data, error } = await supabase.from('portal_administradora').update({
    descricao: portal.descricao,
    link_externo: portal.linkExterno,
    atualizado_em: new Date().toISOString(),
  }).eq('id', 1).select().single();
  if (error) { console.error('updatePortalAdministradoraDB:', error); return null; }
  return {
    descricao: data.descricao ?? '',
    linkExterno: data.link_externo ?? '',
    atualizadoEm: data.atualizado_em ?? undefined,
  };
}


// ──────────────────────────────────────────────
// AUTOCADASTRO DE MORADORES
// ──────────────────────────────────────────────

function rowToAutocadastro(r: Record<string, unknown>): Autocadastro {
  return {
    id: r.id as string,
    unitId: r.unit_id as string,
    userId: (r.user_id as string) ?? undefined,
    nome: r.nome as string,
    email: r.email as string,
    telefone: r.telefone as string,
    rgCpf: (r.rg_cpf as string) ?? undefined,
    tipo: r.tipo as Autocadastro['tipo'],
    dependentes: (r.dependentes as Autocadastro['dependentes']) ?? [],
    veiculos: (r.veiculos as Autocadastro['veiculos']) ?? [],
    status: r.status as Autocadastro['status'],
    motivoRecusa: (r.motivo_recusa as string) ?? undefined,
    criadoEm: r.criado_em as string,
    validadoEm: (r.validado_em as string) ?? undefined,
    validadoPor: (r.validado_por as string) ?? undefined,
  };
}

/** RLS devolve todos os envios para a administração e só o próprio para o morador. */
export async function fetchAutocadastros(supabase: SupabaseClient): Promise<Autocadastro[]> {
  const { data, error } = await supabase.from('autocadastros').select('*').order('criado_em', { ascending: false });
  if (error) { console.error('fetchAutocadastros:', error); return []; }
  return (data ?? []).map(rowToAutocadastro);
}

export async function fetchAutocadastroAberto(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase.from('autocadastro_config').select('aberto').eq('id', 1).single();
  if (error) { console.error('fetchAutocadastroAberto:', error); return false; }
  return !!data?.aberto;
}

export async function updateAutocadastroAbertoDB(supabase: SupabaseClient, aberto: boolean): Promise<boolean> {
  const { data, error } = await supabase
    .from('autocadastro_config')
    .update({ aberto, atualizado_em: new Date().toISOString() })
    .eq('id', 1)
    .select();
  if (error) { console.error('updateAutocadastroAbertoDB:', error); return false; }
  return (data?.length ?? 0) > 0;
}

export async function fetchDiretorioUnidades(supabase: SupabaseClient): Promise<DiretorioUnidade[]> {
  const { data, error } = await supabase.rpc('diretorio_unidades');
  if (error) { console.error('fetchDiretorioUnidades:', error); return []; }
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    bloco: r.bloco as string,
    numero: r.numero as string,
    responsavel: (r.responsavel as string) ?? undefined,
    situacao: r.situacao as DiretorioUnidade['situacao'],
  }));
}

/**
 * Cria só o "esqueleto" das unidades (bloco + número) a partir da planilha.
 * Quem chama já deve ter removido as unidades existentes: não dá pra contar
 * com ON CONFLICT porque o índice único de 0005 pode não estar no banco.
 */
export async function importUnitsDB(
  supabase: SupabaseClient,
  linhas: Array<{ bloco: string; numero: string }>
): Promise<{ criadas: number; erro?: string }> {
  if (linhas.length === 0) return { criadas: 0 };
  const { data, error } = await supabase
    .from('units')
    .insert(
      linhas.map((l) => ({
        bloco: l.bloco,
        numero: l.numero,
        proprietario_nome: '',
        proprietario_telefone: '',
        proprietario_email: '',
        tipo_ocupacao: 'DESOCUPADO',
        moradores: [],
        vagas_garagem: [],
        animais: '',
      }))
    )
    .select('id');
  if (error) { console.error('importUnitsDB:', error); return { criadas: 0, erro: error.message }; }
  return { criadas: data?.length ?? 0 };
}
