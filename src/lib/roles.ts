import { Role } from '@/types';

/**
 * ADM tem exatamente as mesmas permissões do SINDICO (decisão de produto).
 * Mantidos como valores de role distintos para preservar a trilha de
 * auditoria (saber se quem agiu foi o síndico eleito ou a administradora).
 */
export const ADMIN_ROLES: Role[] = ['SINDICO', 'ADM'];

/** Roles que só podem ter um titular ativo por vez no condomínio. */
export const SINGLETON_ROLES: Role[] = ['SINDICO', 'ADM'];

export function isAdmin(role?: Role | null): boolean {
  return !!role && ADMIN_ROLES.includes(role);
}

export const ROLE_LABELS: Record<Role, string> = {
  SINDICO: 'Síndico Geral',
  ADM: 'Administradora',
  PORTARIA: 'Portaria & Acesso',
  CONSELHO: 'Conselho Fiscal',
  MORADOR: 'Morador',
};
