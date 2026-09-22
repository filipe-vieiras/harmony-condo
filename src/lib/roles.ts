import { Role } from '@/types';

/**
 * ADM e SUBSINDICO têm exatamente as mesmas permissões do SINDICO (decisão
 * de produto). Mantidos como valores de role distintos para preservar a
 * trilha de auditoria (saber se quem agiu foi o síndico eleito, o
 * subsíndico ou a administradora).
 */
export const ADMIN_ROLES: Role[] = ['SINDICO', 'SUBSINDICO', 'ADM'];

/**
 * Roles que só podem ter um titular ativo por vez no condomínio.
 * ADM ficou de fora de propósito: o condomínio pode ter mais de uma
 * administradora/funcionário com esse perfil cadastrado ao mesmo tempo.
 */
export const SINGLETON_ROLES: Role[] = ['SINDICO', 'SUBSINDICO'];

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
};
