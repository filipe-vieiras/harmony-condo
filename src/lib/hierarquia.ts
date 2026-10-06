// Hierarquia entre perfis (issue #68). UM lugar só: as rotas do servidor e a tela leem daqui; o banco tem o espelho
// (nivel_cargo / pode_agir_sobre / pode_convidar_cargo, migração 0042) e a bateria confere que os dois dão a mesma resposta.
// Sem dependências de runtime (só `import type`) para a bateria poder importar este arquivo.
import type { Role } from '../types';

/** ADM e Síndico no topo; ninguém age sobre nível igual ou superior ao seu. */
export const NIVEL: Record<Role, number> = {
  ADM: 4,
  SINDICO: 4,
  SUBSINDICO: 3,
  ZELADOR: 2,
  CONSELHO: 1,
  PORTARIA: 1,
  MORADOR: 0,
};

export type AcaoSobreConta = 'RESETAR_SENHA' | 'EXCLUIR';

export const nivelDe = (role?: string | null): number => (role && role in NIVEL ? NIVEL[role as Role] : -1);

/**
 * Quem pode agir sobre a conta de outra pessoa.
 * - Só sobre nível ESTRITAMENTE menor que o do executor;
 * - única exceção: o ADM redefine a senha do Síndico (recuperar o acesso do cargo), sempre auditado;
 * - nenhuma rota exclui ADM nem Síndico (o Síndico sai por transferência de cargo; o ADM é administrado fora do app);
 * - ninguém age sobre a própria conta aqui (`mesmaConta`).
 */
export function podeAgirSobre(executor: string | undefined | null, alvo: string | undefined | null, acao: AcaoSobreConta, mesmaConta = false): boolean {
  if (mesmaConta || !executor || !alvo) return false;
  const ne = nivelDe(executor);
  const na = nivelDe(alvo);
  if (ne < 0 || na < 0) return false;
  if (acao === 'EXCLUIR' && (alvo === 'ADM' || alvo === 'SINDICO')) return false;
  if (acao === 'RESETAR_SENHA' && executor === 'ADM' && alvo === 'SINDICO') return true;
  // O Zelador é designado e administrado só por Síndico e ADM (o Subsíndico não age sobre ele).
  if (alvo === 'ZELADOR' && executor !== 'SINDICO' && executor !== 'ADM') return false;
  return ne > na && ne >= NIVEL.SUBSINDICO;
}

/**
 * Para quais cargos o executor convida: só cargo de nível menor que o dele. O Zelador (funcionário externo) só entra por
 * Síndico e ADM; o Subsíndico convida só Morador, Portaria e Conselho. Exceção: o ADM convida o Síndico (cargo vago; o índice único recusa o segundo). Ninguém convida ADM.
 */
export function podeConvidarPara(executor: string | undefined | null, cargo: string | undefined | null): boolean {
  if (!executor || !cargo) return false;
  const ne = nivelDe(executor);
  const nc = nivelDe(cargo);
  if (ne < NIVEL.SUBSINDICO || nc < 0 || cargo === 'ADM') return false;
  if (cargo === 'ZELADOR') return executor === 'SINDICO' || executor === 'ADM';
  // O Subsíndico convida só Morador (vincular à unidade), Portaria e Conselho: nunca Zelador, Subsíndico, Síndico nem ADM.
  if (executor === 'SUBSINDICO') return cargo === 'MORADOR' || cargo === 'PORTARIA' || cargo === 'CONSELHO';
  if (executor === 'ADM' && cargo === 'SINDICO') return true;
  return nc < ne;
}

export const CARGOS_CONVIDAVEIS: Role[] = ['SINDICO', 'SUBSINDICO', 'PORTARIA', 'CONSELHO', 'ZELADOR', 'MORADOR'];

/** Aviso ao titular quando o link de redefinição é gerado em nome dele (contas de nível alto e o Zelador). */
export const avisaTitularNaRedefinicao = (alvo: string | undefined | null) => alvo === 'SINDICO' || alvo === 'ADM' || alvo === 'ZELADOR';

export const MSG_SEM_NIVEL = {
  RESETAR_SENHA: 'Você não pode redefinir a senha de uma conta de nível igual ou superior ao seu.',
  EXCLUIR: 'Você não pode excluir uma conta de nível igual ou superior ao seu.',
  CONVITE: 'Você não pode convidar para um cargo igual ou acima do seu.',
  ZELADOR: 'Só o Síndico e a Administradora podem designar o Zelador.',
  ZELADOR_CONTA: 'Só o Síndico e a Administradora administram a conta do Zelador.',
  SINDICO_NAO_EXCLUI: 'O Síndico não pode ser excluído por aqui. Para sair do cargo, transfira-o.',
  ADM_NAO_EXCLUI: 'A conta da Administradora é gerida fora do aplicativo e não pode ser excluída por aqui.',
  PROPRIA_CONTA: 'Você não pode excluir a própria conta enquanto está logado.',
} as const;

/**
 * Conta com cargo PENDENTE de aceite (convidada numa transferência de cargo, ou convite ainda aberto) vale pelo nível do
 * cargo de destino: do contrário ela existe como Morador (nível 0) e um perfil de nível menor a sequestraria (redefinir a
 * senha e aceitar o cargo). Devolve o cargo de maior nível entre o perfil e os cargos pendentes.
 */
export function cargoEfetivo(perfil: string | null | undefined, pendentes: (string | null | undefined)[]): string | undefined {
  let melhor = perfil ?? undefined;
  for (const c of pendentes) if (c && nivelDe(c) > nivelDe(melhor)) melhor = c;
  return melhor;
}

/** Conta com cargo pendente de aceite só é administrada por Síndico e ADM (decisão deles, não do Subsíndico). */
export const podeAdministrarContaPendente = (executor: string | null | undefined) => executor === 'SINDICO' || executor === 'ADM';

export const MSG_CONTA_PENDENTE = 'Esta conta tem um cargo aguardando aceite. Só o Síndico e a Administradora administram essa conta.';
