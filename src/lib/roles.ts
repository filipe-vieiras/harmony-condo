import { Role, User } from '@/types';

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

/** Rótulos curtos para selos e frases ("Síndico Ana"). O mapa acima segue como está nas demais telas. */
export const ROLE_LABELS_CURTO: Record<Role, string> = {
  SINDICO: 'Síndico',
  SUBSINDICO: 'Subsíndico',
  CONSELHO: 'Conselho',
  PORTARIA: 'Portaria',
  ADM: 'Administradora',
  MORADOR: 'Morador',
};
