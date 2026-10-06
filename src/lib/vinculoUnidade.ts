// Decide o que fazer quando o e-mail do morador principal de uma unidade já tem
// conta no sistema. Um e-mail é uma conta: em vez de tentar criar um usuário (o
// Supabase recusa e sobra um convite com "Erro ao gerar"), a unidade é ligada à
// conta existente, depois de o síndico confirmar.
//
// Arquivo sem dependências de runtime (só `import type`) de propósito: a bateria
// de QA (scripts/qa/bateria.mjs) o importa direto, para testar a regra real.
import type { Unit, User } from '../types';

export type AvaliacaoVinculo =
  /** E-mail em branco ou sem conta: segue o fluxo normal de convite. */
  | { tipo: 'SEM_CONTA' }
  /** A unidade já está ligada a esta mesma conta: nada a fazer. */
  | { tipo: 'JA_VINCULADA'; conta: User }
  /** Pode vincular, depois de confirmação mostrando nome e perfil. */
  | { tipo: 'VINCULAR'; conta: User }
  /** Não vincula nem cria nada; `mensagem` explica o motivo. */
  | { tipo: 'BLOQUEADO'; mensagem: string };

export function normalizarEmail(email?: string | null): string {
  return (email ?? '').trim().toLowerCase();
}

export function rotuloUnidade(u: Pick<Unit, 'bloco' | 'numero'>): string {
  return `${u.bloco}-${u.numero}`;
}

/**
 * @param email   e-mail do morador principal (titular ou inquilino)
 * @param unidade a unidade que receberia o vínculo; `id` ausente = unidade nova
 * @param contas  perfis do sistema (o admin enxerga todos)
 * @param unidades todas as unidades, para saber se a conta já tem uma
 */
export function avaliarVinculo(
  email: string | undefined | null,
  unidade: { id?: string; usuarioId?: string },
  contas: User[],
  unidades: Unit[]
): AvaliacaoVinculo {
  const alvo = normalizarEmail(email);
  if (!alvo) return { tipo: 'SEM_CONTA' };
  const conta = contas.find((c) => normalizarEmail(c.email) === alvo);
  if (!conta) return { tipo: 'SEM_CONTA' };

  if (unidade.usuarioId) {
    if (unidade.usuarioId === conta.id) return { tipo: 'JA_VINCULADA', conta };
    const outra = contas.find((c) => c.id === unidade.usuarioId);
    return { tipo: 'BLOQUEADO', mensagem: `Esta unidade já está vinculada a ${outra?.name ?? 'outra conta'}.` };
  }

  // O Zelador é funcionário externo: nunca é ligado a unidade (o banco também recusa, no gatilho de units).
  if (conta.role === 'ZELADOR') {
    return { tipo: 'BLOQUEADO', mensagem: 'Esta conta é do Zelador, que é funcionário externo e não pode ser ligado a uma unidade. Use outro e-mail ou deixe o e-mail em branco.' };
  }

  if (conta.role === 'MORADOR') {
    if (conta.cadastroValidado === false) {
      return { tipo: 'BLOQUEADO', mensagem: 'Esta conta ainda aguarda validação em Autocadastro. Valide ou recuse lá primeiro.' };
    }
    const dela = unidades.find((u) => u.usuarioId === conta.id && u.id !== unidade.id);
    const rotulo = dela
      ? rotuloUnidade(dela)
      : conta.bloco && conta.unidade ? `${conta.bloco}-${conta.unidade}` : null;
    if (rotulo) {
      return {
        tipo: 'BLOQUEADO',
        mensagem: `Esta conta já está ligada à unidade ${rotulo}. Moradores com mais de uma unidade ainda não são suportados. Use outro e-mail ou deixe o e-mail em branco.`,
      };
    }
  }

  return { tipo: 'VINCULAR', conta };
}
