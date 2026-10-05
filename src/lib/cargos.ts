// Regras de "Transferir cargo" (issue #53) que o navegador e as rotas de servidor compartilham.
// Só funções puras e sem alias de importação, para a bateria de QA poder importar este arquivo.
// A autoridade é sempre o banco (função transferir_cargo): nada daqui libera nada sozinho.

export type CargoTransferivel = 'SINDICO' | 'SUBSINDICO' | 'CONSELHO' | 'PORTARIA';

export const CARGOS_TRANSFERIVEIS: CargoTransferivel[] = ['SINDICO', 'SUBSINDICO', 'CONSELHO', 'PORTARIA'];

export const CARGO_ROTULO: Record<CargoTransferivel, string> = {
  SINDICO: 'Síndico',
  SUBSINDICO: 'Subsíndico',
  CONSELHO: 'Conselho',
  PORTARIA: 'Portaria',
};

/** Perfis que podem receber um cargo (conta já cadastrada). Nunca ADM, nunca provisório. */
export const PERFIS_DESTINO: string[] = ['MORADOR', 'SUBSINDICO', 'CONSELHO', 'PORTARIA'];

export const ehCargoTransferivel = (v: unknown): v is CargoTransferivel =>
  typeof v === 'string' && (CARGOS_TRANSFERIVEIS as string[]).includes(v);

/** Síndico e Subsíndico são únicos: a confirmação forte (digitar TRANSFERIR) vale só para eles. */
export const exigeDigitarTransferir = (cargo: CargoTransferivel) => cargo === 'SINDICO' || cargo === 'SUBSINDICO';

/** "transferir", "Transferir", " TRANSFERIR " e "transferír" valem; qualquer outra coisa não. */
export function confirmacaoValida(texto: string): boolean {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase() === 'transferir';
}

export function ehEmailValido(email: string): boolean {
  const e = email.trim();
  return e.length <= 200 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
}

/**
 * Quem pode transferir o quê (espelha a função do banco, que decide de verdade):
 * ADM transfere os quatro cargos; Síndico, os três e o PRÓPRIO; ninguém mais.
 */
export function podeTransferirCargo(
  perfilExecutor: string | undefined,
  cargo: CargoTransferivel,
  origemId: string,
  executorId: string,
): boolean {
  if (perfilExecutor === 'ADM') return true;
  if (perfilExecutor === 'SINDICO') return cargo !== 'SINDICO' || origemId === executorId;
  return false;
}

export interface CargoTransferencia {
  id: string;
  cargo: CargoTransferivel;
  origemId?: string;
  origemNome: string;
  destinoId?: string;
  destinoNome: string;
  destinoTipo: 'EXISTENTE' | 'NOVO';
  status: 'PENDENTE' | 'CONCLUIDA' | 'CANCELADA' | 'FALHOU';
  criadoEm: string;
  concluidoEm?: string;
}

/** Mensagens em português para cada código que a função do banco devolve. */
export function mensagemDoCodigo(
  codigo: string,
  extras: { titularAtual?: string; destinoNome?: string; contaNome?: string } = {},
  cargo?: CargoTransferivel,
): string {
  const rotulo = cargo ? CARGO_ROTULO[cargo] : 'cargo';
  switch (codigo) {
    case 'sem_permissao':
      return 'Você não tem mais permissão para transferir cargos.';
    case 'cargo_invalido':
      return 'Esse cargo não pode ser transferido por aqui.';
    case 'dados_invalidos':
      return 'Confira os dados da transferência e tente de novo.';
    case 'origem_desatualizada':
      // Cargo único (Síndico, Subsíndico) tem um titular só; Conselho e Portaria têm vários, então não citamos ninguém.
      return extras.titularAtual && (cargo === 'SINDICO' || cargo === 'SUBSINDICO')
        ? `O cargo de ${rotulo} mudou enquanto você preenchia: agora o titular é ${extras.titularAtual}. Nada foi alterado. Comece de novo.`
        : `O cargo de ${rotulo} mudou enquanto você preenchia. Nada foi alterado. Comece de novo.`;
    case 'destino_invalido':
      return `${extras.destinoNome ?? 'Essa pessoa'} não pode mais receber o cargo. Escolha outra pessoa.`;
    case 'pendencia_existente':
      return `Já há uma transferência de ${rotulo} aguardando ${extras.destinoNome ?? 'a pessoa'} aceitar. Cancele-a antes de iniciar outra.`;
    case 'email_com_conta':
      return extras.contaNome
        ? `Esse e-mail já tem conta. Use “Usuário já cadastrado” e escolha ${extras.contaNome}.`
        : 'Esse e-mail já tem conta. Use “Usuário já cadastrado” para escolher a pessoa.';
    case 'convite_existente':
      return 'Já existe um convite para este e-mail. Cancele-o na fila ou escolha outro e-mail.';
    case 'conflito':
      return 'Outra mudança de cargo aconteceu ao mesmo tempo. Nada foi alterado. Comece de novo.';
    default:
      return 'Não deu para concluir. Nada foi alterado. Tente de novo.';
  }
}
