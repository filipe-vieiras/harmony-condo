export type Role = 'SINDICO' | 'PORTARIA' | 'CONSELHO' | 'MORADOR';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  bloco?: string;
  unidade?: string;
  telefone?: string;
  cargo?: string;
}

export interface UnitResident {
  nome: string;
  tipo: 'TITULAR' | 'DEPENDENTE' | 'INQUILINO';
  telefone: string;
  rgCpf?: string;
}

export interface Unit {
  id: string;
  bloco: string;
  numero: string;
  proprietarioNome: string;
  proprietarioTelefone: string;
  proprietarioEmail: string;
  tipoOcupacao: 'PROPRIETARIO' | 'INQUILINO' | 'DESOCUPADO';
  moradores: UnitResident[];
  vagasGaragem: string[];
  animais: string;
  observacoes?: string;
}

export interface Vehicle {
  id: string;
  placa: string;
  marca: string;
  modelo: string;
  cor: string;
  bloco: string;
  unidade: string;
  vaga: string;
  proprietarioNome: string;
  telefoneContato: string;
  status: 'ATIVO' | 'VISITANTE';
}

export type NoticeCategory = 'URGENTE' | 'MANUTENCAO' | 'ASSEMBLEIA' | 'COMUNICADO';

export interface Notice {
  id: string;
  titulo: string;
  conteudo: string;
  categoria: NoticeCategory;
  data: string;
  autor: string;
  fixado: boolean;
  anexoNome?: string;
  anexoUrl?: string;
}

export type FineStatus = 
  | 'PENDENTE_CIENCIA' 
  | 'CIENCIA_REGISTRADA' 
  | 'EM_RECURSO' 
  | 'RECURSO_DEFERIDO' 
  | 'RECURSO_INDEFERIDO' 
  | 'CONCLUIDA';

export interface FineEvidence {
  id: string;
  url: string;
  descricao: string;
}

export interface FineNotice {
  id: string;
  numeroProtocolo: string;
  bloco: string;
  unidade: string;
  moradorNome: string;
  dataInfracao: string;
  dataEmissao: string;
  prazoRecursoData: string;
  artigoRegimento: string;
  descricaoInfracao: string;
  valor: number;
  tipo: 'ADVERTENCIA' | 'MULTA';
  status: FineStatus;
  evidencias: FineEvidence[];
  ciencia?: {
    data: string;
    ip: string;
    usuarioNome: string;
  };
  recurso?: {
    data: string;
    texto: string;
    anexoNome?: string;
    resposta?: string;
    dataResposta?: string;
    status: 'EM_ANALISE' | 'DEFERIDO' | 'INDEFERIDO';
    analisadoPor?: string;
  };
}

export interface CommonSpace {
  id: string;
  nome: string;
  descricao: string;
  capacidadeMax: number;
  horarioFuncionamento: string;
  taxaLimpeza: number;
  regras: string[];
  imagemUrl: string;
  ativo?: boolean;
}

export type ReservationStatus = 'PENDENTE' | 'APROVADA' | 'RECUSADA' | 'CANCELADA';

export interface Reservation {
  id: string;
  espacoId: string;
  espacoNome: string;
  bloco: string;
  unidade: string;
  moradorNome: string;
  data: string; // YYYY-MM-DD
  horarioInicio: string;
  horarioFim: string;
  convidadosEstimados: number;
  status: ReservationStatus;
  motivoRecusa?: string;
  dataSolicitacao: string;
  dataAvaliacao?: string;
  avaliadoPor?: string;
}

export interface DocumentLink {
  id: string;
  titulo: string;
  descricao: string;
  categoria: 'REGIMENTO' | 'CONVENCAO' | 'ATA' | 'FINANCEIRO' | 'EMERGENCIA';
  arquivoNome?: string;
  tamanhoArquivo?: string;
  linkExterno?: string;
  telefone?: string;
  dataAtualizacao: string;
}

export interface InAppNotification {
  id: string;
  titulo: string;
  mensagem: string;
  tipo: 'AVISO' | 'MULTA' | 'RESERVA' | 'GERAL';
  data: string;
  lida: boolean;
  unidadeAlvo?: string; // se especificado, apenas a unidade vê
  perfilAlvo?: Role;    // se especificado, apenas o perfil vê
  linkDestino?: string;
}

export interface AuditLog {
  id: string;
  usuarioId?: string;
  usuarioNome: string;
  usuarioRole: Role;
  acao: string;
  modulo: 'UNIDADES' | 'RESERVAS' | 'MULTAS' | 'ESPACOS' | 'DOCUMENTOS' | 'SISTEMA';
  detalhes?: Record<string, unknown>;
  createdAt: string;
}
