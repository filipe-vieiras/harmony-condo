// Interdição de espaço (PRD do Zelador, seções 4.1 e 4.2). Só funções puras.
//
// Interditar bloqueia SÓ novos pedidos (o banco recusa). Reservas futuras existentes continuam valendo e
// são canceladas à mão, uma a uma, por quem gere ou pelo Zelador. A contagem abaixo é só para a tela.
import type { CommonSpace, Reservation } from '@/types';

export const MOTIVO_INTERDICAO_MAX = 140;

/** Reservas que ainda vão acontecer (pendentes e aprovadas, de hoje em diante) no espaço, na ordem do calendário. */
export function reservasFuturasDoEspaco(reservations: Reservation[], espacoId: string, hoje: string): Reservation[] {
  return reservations
    .filter((r) => r.espacoId === espacoId && (r.status === 'PENDENTE' || r.status === 'APROVADA') && r.data >= hoje)
    .sort((a, b) => a.data.localeCompare(b.data) || a.horarioInicio.localeCompare(b.horarioInicio));
}

/** O que o morador lê: "Em manutenção" ou "Em manutenção: {motivo}". Sempre texto puro (a tela nunca usa HTML). */
export function textoEmManutencao(espaco: Pick<CommonSpace, 'motivoInterdicao'>): string {
  const motivo = espaco.motivoInterdicao?.trim();
  return motivo ? `Em manutenção: ${motivo}` : 'Em manutenção';
}

/** Uma linha só, como o banco grava: quebras e caracteres de controle viram espaço. Só para a prévia do contador. */
export function normalizarMotivo(texto: string): string {
  return texto.replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/ {2,}/g, ' ').trim();
}
