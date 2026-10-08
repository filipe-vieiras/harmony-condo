// Livro de reclamações (fórum aberto do condomínio): tipos, limites, textos e regras puras.
// Espelha o banco (migração 0043), que é quem decide de verdade; a tela só obedece o que `livro_acesso()` devolve.
// Sem dependências de runtime para a bateria de QA poder importar.

export type LivroModo = 'DESLIGADO' | 'EQUIPE' | 'ABERTO';

/** Perfis que escrevem: Zelador, Portaria e ADM só leem. Lista explícita (nunca isOperacao/isAdmin: incluem outros perfis). */
export const PERFIS_QUE_ESCREVEM = ['SINDICO', 'SUBSINDICO', 'CONSELHO', 'MORADOR'] as const;
/** Quem apaga a mensagem de outra pessoa: só Síndico e ADM (o Subsíndico não). */
export const PERFIS_QUE_APAGAM = ['SINDICO', 'ADM'] as const;
/** Quem lê o registro de remoções (e o texto removido por 90 dias): o contrapeso ao poder de apagar. */
export const PERFIS_DO_REGISTRO = ['SINDICO', 'SUBSINDICO', 'ADM', 'CONSELHO'] as const;
/** Quem muda o interruptor do livro. */
export const PERFIS_DO_INTERRUPTOR = ['SINDICO', 'ADM'] as const;
/** Quem entra no modo EQUIPE. */
export const PERFIS_DA_EQUIPE = ['SINDICO', 'SUBSINDICO', 'ADM', 'CONSELHO'] as const;
const TODOS_QUE_LEEM = ['SINDICO', 'SUBSINDICO', 'ADM', 'CONSELHO', 'MORADOR', 'ZELADOR', 'PORTARIA'] as const;

export const LIMITES = {
  topicoMin: 10,
  topicoMax: 1000,
  respostaMin: 1,
  respostaMax: 500,
  citadosMax: 5,
  respostasPorTopico: 200,
  respostasPorAutorNoTopico: 20,
  topicosPorPagina: 20,
  respostasPorVez: 30,
  retencaoTextoRemovidoDias: 90,
} as const;

export const MOTIVOS_REMOCAO = [
  { codigo: 'OFENSA', rotulo: 'Ofensa ou ataque pessoal' },
  { codigo: 'DADO_PESSOAL', rotulo: 'Dado pessoal de alguém' },
  { codigo: 'FORA_DO_ASSUNTO', rotulo: 'Fora do assunto' },
  { codigo: 'REPETIDA', rotulo: 'Mensagem repetida' },
  { codigo: 'OUTRO', rotulo: 'Outro motivo' },
] as const;
export type MotivoRemocao = (typeof MOTIVOS_REMOCAO)[number]['codigo'];

export const ROTULO_MOTIVO: Record<string, string> = {
  ...Object.fromEntries(MOTIVOS_REMOCAO.map((m) => [m.codigo, m.rotulo])),
  AUTOR: 'Removida pelo próprio autor',
};

export const MODOS: { valor: LivroModo; titulo: string; descricao: string }[] = [
  { valor: 'DESLIGADO', titulo: 'Desligado', descricao: 'Ninguém acessa o Livro. Nada é apagado.' },
  { valor: 'EQUIPE', titulo: 'Só a equipe', descricao: 'Síndico, Subsíndico, Administradora e Conselho leem e testam. Moradores ainda não entram.' },
  { valor: 'ABERTO', titulo: 'Aberto', descricao: 'Moradores validados, Zelador e Portaria passam a ler. Síndico, Subsíndico, Conselho e Morador escrevem.' },
];

/** Espelho de livro_papel(): o perfil pode ler neste modo? (conta ativa e validada é checada no banco). */
export function modoAdmiteLeitura(modo: LivroModo | null | undefined, role: string | null | undefined): boolean {
  if (!modo || !role) return false;
  if (modo === 'ABERTO') return (TODOS_QUE_LEEM as readonly string[]).includes(role);
  if (modo === 'EQUIPE') return (PERFIS_DA_EQUIPE as readonly string[]).includes(role);
  return false;
}

export function modoAdmiteEscrita(modo: LivroModo | null | undefined, role: string | null | undefined): boolean {
  return modoAdmiteLeitura(modo, role) && (PERFIS_QUE_ESCREVEM as readonly string[]).includes(role ?? '');
}

export interface LivroAcesso {
  modo: LivroModo;
  papel: string | null;
  podeLer: boolean;
  podeEscrever: boolean;
  podeSinalizar: boolean;
  podeRemoverQualquer: boolean;
  podeVerRegistro: boolean;
  podeAlterarModo: boolean;
  regrasVersao: number;
  cienciaOk: boolean;
}

export interface LivroCitado { tipo: 'UNIDADE' | 'PESSOA'; rotulo: string }

export interface LivroMensagem {
  id: string;
  paiId: string | null;
  texto: string;
  autorNome: string;
  autorUnidade: string | null;
  autorPapel: 'SINDICO' | 'SUBSINDICO' | 'CONSELHO' | 'MORADOR' | 'EX_MORADOR';
  /** Strings ISO do servidor, com microssegundos: usadas como estão no cursor da página seguinte (nunca passe por Date). */
  criadaEm: string;
  ultimaAtividadeEm: string;
  nRespostas: number;
  removida: boolean;
  removidaPor: 'GESTAO' | 'AUTOR' | null;
  minha: boolean;
  citados: LivroCitado[];
  textoOriginal: string | null;
  jaSinalizei: boolean;
}

export interface LivroCitavel { ref: string; tipo: 'UNIDADE' | 'PESSOA'; rotulo: string }

export interface LivroRemocao {
  id: string;
  mensagemId: string;
  topicoId: string;
  removidaEm: string;
  removidoPorNome: string;
  removidoPorPapel: string;
  motivo: string;
  tipo: 'TOPICO' | 'RESPOSTA';
  autorNome: string;
  autorUnidade: string | null;
  autorEraQuemRemoveu: boolean;
  citavaQuemRemoveu: boolean;
  textoOriginal: string | null;
  textoExpiraEm: string;
}

/** Rótulo do selo de cargo ao lado do nome ("voz oficial"). Morador não tem selo (mostra a unidade). */
export const SELO_DO_CARGO: Record<string, string> = {
  SINDICO: 'Síndico',
  SUBSINDICO: 'Subsíndico',
  CONSELHO: 'Conselho',
};

/** Erros do banco (código no `message`) em português claro para a tela. */
export const MENSAGENS_DE_ERRO: Record<string, string> = {
  sem_permissao: 'Você não tem permissão para fazer isso no Livro.',
  sem_ciencia: 'Leia e aceite as regras do Livro antes de escrever.',
  texto_vazio: 'Escreva alguma coisa antes de enviar.',
  texto_curto: 'O texto está curto demais. Um tópico precisa de pelo menos 10 caracteres.',
  texto_longo: 'O texto passou do limite de caracteres.',
  dado_pessoal: 'Retire dados pessoais (CPF, CNPJ ou e-mail) do texto e tente de novo.',
  limite_hora: 'Você já enviou 10 mensagens nesta hora. Tente de novo mais tarde.',
  limite_dia: 'Você chegou ao limite de 40 mensagens por dia. Tente amanhã.',
  texto_repetido: 'Esta mensagem é igual à que você acabou de enviar.',
  muitos_citados: 'Você pode citar no máximo 5 pessoas ou unidades por mensagem.',
  alvo_invalido: 'Uma das pessoas ou unidades citadas não pode ser citada. Revise e tente de novo.',
  limite_citacoes: 'Você chegou ao limite de citações de hoje. Tente amanhã.',
  topico_cheio: 'Este tópico chegou ao limite. Abra um novo.',
  limite_respostas_autor: 'Você já respondeu 20 vezes neste tópico. Para falar de outro assunto, abra um novo tópico.',
  topico_removido: 'Este tópico foi removido e não aceita respostas.',
  topico_inexistente: 'Este tópico não existe mais.',
  resposta_a_resposta: 'Só é possível responder ao tópico. Para falar com alguém, use "Citar".',
  sem_unidade: 'Sua conta não está ligada a uma unidade. Fale com o síndico.',
  motivo_invalido: 'Escolha um dos motivos da lista.',
  mensagem_inexistente: 'Esta mensagem não existe mais.',
  mensagem_removida: 'Esta mensagem já foi removida.',
  mensagem_propria: 'Você não pode avisar a gestão sobre a sua própria mensagem.',
  modo_invalido: 'Modo inválido.',
  limite_sinalizacao: 'Você já avisou a gestão várias vezes. Tente de novo mais tarde.',
  texto_invalido: 'O texto tem um caractere que não pode ser enviado. Apague e escreva de novo.',
};

/** Pega o código do erro do Postgres/PostgREST (a mensagem é o código, ex.: "texto_curto") e devolve texto em português. */
export function erroDoLivro(err: { message?: string; code?: string } | null | undefined): string {
  const msg = err?.message ?? '';
  // NUL (U+0000) no texto: o Postgres recusa antes da função (mensagem técnica de "Unicode escape").
  if (/unicode escape|\\u0000/i.test(msg)) return MENSAGENS_DE_ERRO.texto_invalido;
  const achado = Object.keys(MENSAGENS_DE_ERRO).find((c) => msg.includes(c));
  if (achado) return MENSAGENS_DE_ERRO[achado];
  if (err?.code === '42501') return MENSAGENS_DE_ERRO.sem_permissao;
  return 'Não foi possível concluir agora. Tente de novo em instantes.';
}

/** Erro que o banco devolve de propósito (regra de negócio): não é falha do app e não vai para o console. */
export const erroEsperado = (err: { message?: string; code?: string } | null | undefined): boolean =>
  !!err && (err.code === '42501' || Object.keys(MENSAGENS_DE_ERRO).some((c) => (err.message ?? '').includes(c)) || /unicode escape/i.test(err.message ?? ''));

/**
 * Espelho do filtro de dado pessoal do banco (livro_publicar): o banco é quem vale; a tela só avisa antes de enviar.
 * Normaliza (largura total, "[at]", espaços em volta de "@" e "." com domínio conhecido) e recusa CPF, CNPJ, RG, telefone
 * (8 ou mais dígitos seguidos, ignorando espaço, ponto, hífen e parênteses) e e-mail. Hora, data com barra e valores passam.
 * Sem lookbehind de propósito: Safari antigo derruba o pacote inteiro com ele.
 */
export function temDadoPessoal(texto: string): boolean {
  let n = texto.normalize('NFKC').toLowerCase();
  n = n.replace(/\s*[[({]\s*(at|arroba)\s*[\])}]\s*/g, '@').replace(/\s*[[({]\s*(dot|ponto)\s*[\])}]\s*/g, '.').replace(/\s+arroba\s+/g, '@');
  n = n.replace(/([a-z0-9._%+-])\s*@\s*([a-z0-9-]+)\s*\.\s*(com|net|org|br|gov|edu|io|me|info|biz|co|app|dev)\b/g, '$1@$2.$3');
  const dig = n.replace(/([0-9])[\s.\-()]+(?=[0-9])/g, '$1');
  return /[0-9]{8,}/.test(dig)
    || /(^|[^0-9])[0-9]{2}\.?[0-9]{3}\.?[0-9]{3}\/?[0-9]{4}-?[0-9]{2}([^0-9]|$)/.test(n)
    || /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/.test(n);
}

/** Tamanho em pontos de código, como o char_length do banco (um emoji conta 1, não 2). */
export const tamanhoDoTexto = (t: string): number => Array.from(t).length;

export const ehUuid = (t: string): boolean => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t);

/** Marca a mensagem como removida na própria lista (o mesmo que o banco passa a devolver), sem nova consulta. */
export const marcarRemovida = (m: LivroMensagem): LivroMensagem => ({
  ...m,
  removida: true,
  removidaPor: m.minha ? 'AUTOR' : 'GESTAO',
  // Quem remove vê o texto retido: o autor, ou Síndico e ADM (que leem o registro).
  textoOriginal: m.texto,
  texto: '',
  citados: [],
});

/** Tempo relativo curto em português ("há 5 min", "há 2 h", "há 3 dias"); depois de 30 dias, a data. */
export function tempoRelativo(iso: string, agora: number = Date.now()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const s = Math.max(0, Math.round((agora - t) / 1000));
  if (s < 60) return 'agora há pouco';
  const min = Math.round(s / 60);
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  if (d < 30) return d === 1 ? 'há 1 dia' : `há ${d} dias`;
  return `em ${new Date(t).toLocaleDateString('pt-BR')}`;
}

/** Texto do aviso fixo mostrado acima do editor (nunca escondido). */
export const AVISO_DO_EDITOR =
  'Este espaço é aberto. Todos os moradores veem o que você escreve, com seu nome e unidade. Fale de fatos. Não publique dados de pessoas (telefone, CPF, saúde, dívidas).';

/** O aviso muda com o modo: em EQUIPE só a gestão e o Conselho veem (modo de teste). */
export const avisoDoEditor = (modo: LivroModo | null | undefined): string =>
  modo === 'EQUIPE'
    ? 'Modo de teste da equipe: só a gestão e o Conselho veem este livro, com seu nome. Fale de fatos. Não publique dados de pessoas (telefone, CPF, saúde, dívidas).'
    : AVISO_DO_EDITOR;

export const REGRAS_DE_USO = [
  'Fale de fatos e de situações, não de pessoas. Respeite todos os moradores e funcionários.',
  'Não publique dados pessoais de ninguém: telefone, CPF, e-mail, saúde, dívidas ou fotos.',
  'Não há prazo para resposta. Os moradores e a gestão podem responder aqui.',
  'A gestão pode remover mensagens com ofensa, dado pessoal ou fora do assunto. Crítica à gestão, por si só, não é motivo.',
  'Você pode apagar a sua própria mensagem. Não é possível editar: apague e escreva de novo.',
  'Digitar um nome no texto não avisa ninguém. Para avisar uma pessoa ou unidade, use o botão "Citar".',
];
