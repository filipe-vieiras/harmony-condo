import type { Role, User } from '../types';

/** Morador que se cadastrou pelo link aberto e ainda não foi validado pelo síndico. */
export function isProvisorio(user?: User | null): boolean {
  return user?.role === 'MORADOR' && user.cadastroValidado === false;
}

/**
 * ADM e SUBSINDICO têm exatamente as mesmas permissões do SINDICO (decisão
 * de produto). Mantidos como valores de role distintos para preservar a
 * trilha de auditoria (saber se quem agiu foi o síndico eleito, o
 * subsíndico ou a administradora).
 *
 * Exceção decidida pelo dono (2026-10-02): só o ADM APAGA multa; os três anulam.
 * Ver src/lib/multas.ts e a migração 0029.
 */
export const ADMIN_ROLES: Role[] = ['SINDICO', 'SUBSINDICO', 'ADM'];

/**
 * Roles que só podem ter um titular ativo por vez no condomínio.
 * ADM ficou de fora de propósito: o condomínio pode ter mais de uma
 * administradora/funcionário com esse perfil cadastrado ao mesmo tempo.
 */
export const SINGLETON_ROLES: Role[] = ['SINDICO', 'SUBSINDICO', 'ZELADOR'];

/**
 * Perfil operacional (PRD do Zelador): a gestão MAIS o Zelador. Decide, cancela e registra reservas, interdita espaço.
 * NUNCA libera dado sensível (multa, documento, auditoria, usuários, convites): isso segue em `isAdmin`.
 * Espelha o banco (`tem_perfil_operacao()`), que é quem decide de verdade.
 */
export const OPERACAO_ROLES: Role[] = ['SINDICO', 'SUBSINDICO', 'ADM', 'ZELADOR'];

export function isOperacao(role?: Role | null): boolean {
  return !!role && OPERACAO_ROLES.includes(role);
}

/** Funcionário externo: não tem unidade, nunca é provisório e só enxerga o que a operação precisa. */
export function isZelador(role?: Role | null): boolean {
  return role === 'ZELADOR';
}

/** Telas que o Zelador abre. Qualquer outra rota o leva de volta ao Início, sem tela de erro. */
export const ROTAS_DO_ZELADOR = ['/', '/reservas', '/moradores', '/veiculos', '/mural', '/links'];

export function rotaPermitida(role: Role | undefined, pathname: string | null): boolean {
  if (role !== 'ZELADOR' || !pathname) return true;
  return ROTAS_DO_ZELADOR.some((r) => pathname === r || (r !== '/' && pathname.startsWith(`${r}/`)));
}

/** A conta ocupa o cargo: ativa, ou convite do Zelador enviado e ainda não aceito. */
export const ocupaCargo = (u: { desativadoEm?: string; aguardandoAceite?: boolean }) => !u.desativadoEm || !!u.aguardandoAceite;

export function isAdmin(role?: Role | null): boolean {
  return !!role && ADMIN_ROLES.includes(role);
}

export const ROLE_LABELS: Record<Role, string> = {
  SINDICO: 'Síndico Geral',
  SUBSINDICO: 'Subsíndico',
  ADM: 'Administradora',
  PORTARIA: 'Portaria & Acesso',
  CONSELHO: 'Conselho Fiscal',
  MORADOR: 'Morador',
  ZELADOR: 'Zelador',
};

/** Rótulos curtos para selos e frases ("Síndico Ana"). O mapa acima segue como está nas demais telas. */
export const ROLE_LABELS_CURTO: Record<Role, string> = {
  SINDICO: 'Síndico',
  SUBSINDICO: 'Subsíndico',
  CONSELHO: 'Conselho',
  PORTARIA: 'Portaria',
  ADM: 'Administradora',
  MORADOR: 'Morador',
  ZELADOR: 'Zelador',
};
