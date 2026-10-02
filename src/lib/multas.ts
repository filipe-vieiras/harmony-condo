import type { FineNotice, FineStatus } from '@/types';

/** Chave do aviso "Multa apagada." que a tela de detalhe deixa para a lista (a multa deixou de existir). */
export const AVISO_MULTA_APAGADA = 'harmony:aviso-multa-apagada';

/**
 * Multa que não vale mais: anulada pela equipe (ANULADA) ou pela decisão do recurso
 * (RECURSO_DEFERIDO). As duas somem das contagens de pendência e do prazo.
 */
export function multaAnulada(status: FineStatus): boolean {
  return status === 'ANULADA' || status === 'RECURSO_DEFERIDO';
}

/** Papéis que anulam multa (e só o ADM apaga). A regra real é do banco; isto só decide o que mostrar. */
export function podeAnularMulta(role: string | undefined, fine: Pick<FineNotice, 'status'>): boolean {
  return (role === 'SINDICO' || role === 'SUBSINDICO' || role === 'ADM') && !multaAnulada(fine.status);
}

export function podeApagarMulta(role: string | undefined): boolean {
  return role === 'ADM';
}

/** Papel de quem anulou, para o morador ler: só o cargo, nunca o nome. */
export function cargoDeQuemAnulou(papel: string): string {
  if (papel === 'SINDICO') return 'pelo síndico';
  if (papel === 'SUBSINDICO') return 'pelo subsíndico';
  return 'pela administração';
}

/** Rótulo do cargo para a equipe: "Síndico", "Subsíndico", "ADM". */
export function rotuloCargoAnulacao(papel: string): string {
  if (papel === 'SINDICO') return 'Síndico';
  if (papel === 'SUBSINDICO') return 'Subsíndico';
  return 'ADM';
}

/** Limites do motivo da anulação (o banco confere os mesmos valores). */
export const MOTIVO_ANULACAO_MIN = 10;
export const MOTIVO_ANULACAO_MAX = 500;
