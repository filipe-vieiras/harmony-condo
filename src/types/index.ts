export type Role = 'SINDICO' | 'SUBSINDICO' | 'ADM' | 'PORTARIA' | 'CONSELHO' | 'MORADOR';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  bloco?: string;
  unidade?: string;
  telefone?: string;
  cargo?: string;
  /** false = morador que se cadastrou pelo link aberto e ainda aguarda validação do síndico (acesso provisório). */
  cadastroValidado?: boolean;
}

export type AutocadastroStatus = 'AGUARDANDO' | 'VALIDADO' | 'RECUSADO';

/** Tipo do veículo (issue #43). Sem texto livre: "Outro" cobre tudo que não é carro nem moto. */
export type TipoVeiculo = 'CARRO' | 'MOTO' | 'OUTRO';

export interface AutocadastroVeiculo {
  placa: string;
  marca: string;
  modelo: string;
  cor: string;
  /** Ausente nos envios feitos antes da #43 (o servidor trata como OUTRO ao validar). */
  tipoVeiculo?: TipoVeiculo;
}

export interface AutocadastroDependente {
  nome: string;
  telefone: string;
}

/** Envio do formulário público /cadastro, aguardando (ou já com) decisão do síndico. */
export interface Autocadastro {
  id: string;
  unitId: string;
  userId?: string;
  nome: string;
  email: string;
  telefone: string;
  rgCpf?: string;
  tipo: 'PROPRIETARIO' | 'INQUILINO';
  dependentes: AutocadastroDependente[];
  veiculos: AutocadastroVeiculo[];
  status: AutocadastroStatus;
  motivoRecusa?: string;
  criadoEm: string;
  validadoEm?: string;
  validadoPor?: string;
}

export interface DiretorioUnidade {
  bloco: string;
  numero: string;
  responsavel?: string;
  situacao: 'VALIDADO' | 'AGUARDANDO_VALIDACAO' | 'SEM_CADASTRO';
}

export interface UnitResident {
  nome: string;
  tipo: 'TITULAR' | 'DEPENDENTE' | 'INQUILINO';
  telefone: string;
  /** Chave estável do morador (o banco dá um id a todos). Liga o morador ao documento em unit_documentos. */
  id?: string;
  /** Documento: não vem de units. Preenchido só para quem o banco deixa ler (gestão e o próprio morador). */
  rgCpf?: string;
  /** E-mail do morador. Só faz sentido para o morador prioritário (TITULAR ou INQUILINO) — é ele quem recebe o convite de acesso. */
  email?: string;
}

export type ConviteStatus = 'NAO_ENVIADO' | 'PENDENTE' | 'ENVIADO' | 'ATIVO';

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
  /** Status do convite de acesso ao portal para o morador prioritário desta unidade. */
  statusConvite?: ConviteStatus;
  /** id do usuário (auth/profile) vinculado, quando o convite já foi aceito. */
  usuarioId?: string;
}

export interface Vehicle {
  id: string;
  placa: string;
  marca: string;
  modelo: string;
  cor: string;
  unitId?: string;
  bloco: string;
  unidade: string;
  vaga: string;
  proprietarioNome: string;
  telefoneContato: string;
  status: 'ATIVO' | 'VISITANTE';
  tipoVeiculo: TipoVeiculo;
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
  | 'CONCLUIDA'
  | 'ANULADA';

export interface FineEvidence {
  id: string;
  url: string;
  descricao: string;
}

export interface FineNotice {
  id: string;
  numeroProtocolo: string;
  unitId?: string;
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
  /** Preenchido só quando status é ANULADA. Quem anulou e quando são gravados pelo banco. */
  anulacao?: {
    motivo: string;
    porNome: string;
    porPapel: string;
    em: string;
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
  /** Se true, o pedido nasce PENDENTE e a equipe decide; se false, o banco já grava APROVADA (0034). */
  exigeAprovacao: boolean;
  /**
   * Cobrança por faixa (0039). Os dois nulos = grátis para qualquer número de pessoas.
   * Preenchidos: grátis até `faixaGratisAte` pessoas (inclusive) e, acima disso, `faixaValor` fixo.
   * `faixaGratisAte` 0 = cobra de todos. O cálculo de verdade é do banco (valor_reserva).
   */
  faixaGratisAte?: number | null;
  faixaValor?: number | null;
}

export type ReservationStatus = 'PENDENTE' | 'APROVADA' | 'RECUSADA' | 'CANCELADA';

export interface Reservation {
  id: string;
  /** Fica undefined se o espaço original foi excluído depois — espacoNome preserva o histórico. */
  espacoId?: string;
  espacoNome: string;
  bloco: string;
  unidade: string;
  moradorNome: string;
  data: string; // YYYY-MM-DD
  horarioInicio: string;
  horarioFim: string;
  /** Número de pessoas declarado (a coluna se chama convidados_estimados). */
  convidadosEstimados: number;
  /** Valor de uso gravado pelo banco na criação (0039). Undefined = reserva anterior à regra. */
  valorUso?: number;
  /** Taxa de higienização do momento do pedido (0039). Undefined = reserva anterior à regra. */
  taxaHigienizacao?: number;
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
  unidadeIdAlvo?: string; // mesma finalidade, mas por FK — usar quando disponível (evita divergência de texto)
  perfilAlvo?: Role;    // se especificado, apenas o perfil vê
  usuarioIdAlvo?: string; // se especificado, só essa pessoa vê (aviso de troca de cargo)
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

export type PendingInviteStatus = 'PENDENTE' | 'ENVIADO' | 'ERRO';

export interface PendingInvite {
  id: string;
  nome: string;
  email: string;
  role: Role;
  bloco?: string;
  unidade?: string;
  unitId?: string;
  status: PendingInviteStatus;
  erroMensagem?: string;
  criadoPor?: string;
  criadoEm: string;
  enviadoEm?: string;
  /** Link de definição de senha gerado para o Síndico copiar e enviar manualmente. */
  linkAcesso?: string;
  /** Convite de transferência de cargo: o cargo (`role`) só vale quando a pessoa aceitar. */
  transferenciaId?: string;
}

/** Dados de contato do zelador atual — cadastro estruturado, sem login no sistema. */
export interface Zelador {
  nome: string;
  telefone: string;
  horarioAtendimento: string;
  observacoes?: string;
  atualizadoEm?: string;
}

/** Item fixo editável (singleton) — não pode ser excluído, só editado. */
export interface PortalAdministradora {
  descricao: string;
  linkExterno: string;
  atualizadoEm?: string;
}
