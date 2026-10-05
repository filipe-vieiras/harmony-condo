// Textos do valor de uso por faixa de pessoas (issue #81, fase 2). Só apresentação: quem calcula
// o valor de verdade é o banco (valor_reserva, migração 0039); aqui nada decide cobrança.
import type { CommonSpace } from '@/types';
import { formatarMoeda } from '@/lib/formatadores';

type Faixa = Pick<CommonSpace, 'faixaGratisAte' | 'faixaValor'>;

/** O espaço cobra por faixa (limite e valor preenchidos)? Sem faixa = grátis para qualquer número. */
export const temFaixa = (s: Faixa): s is { faixaGratisAte: number; faixaValor: number } =>
  s.faixaGratisAte != null && s.faixaValor != null;

/** "acima de 10 pessoas"; vazio quando o limite é 0 (cobra de todos, não há "acima de"). */
export function trechoAcimaDe(limite: number | null | undefined): string {
  return limite != null && limite > 0 ? `acima de ${limite} ${limite === 1 ? 'pessoa' : 'pessoas'}` : '';
}

/** Linha "Valor de uso:" da galeria: "Grátis", "R$ 150,00 acima de 10 pessoas" ou "R$ 90,00". */
export function valorUsoDoEspaco(s: Faixa): string {
  if (!temFaixa(s)) return 'Grátis';
  const acima = trechoAcimaDe(s.faixaGratisAte);
  return `${formatarMoeda(s.faixaValor)}${acima ? ` ${acima}` : ''}`;
}

/** Texto vivo do valor no modal da reserva, a partir do valor que o banco devolveu para N pessoas. */
export function textoValorModal(s: Faixa, valor: number): string {
  if (valor > 0) {
    const acima = trechoAcimaDe(s.faixaGratisAte);
    return `Valor de uso: ${formatarMoeda(valor)}${acima ? ` (${acima})` : ''}.`;
  }
  return temFaixa(s) && s.faixaGratisAte > 0
    ? `Valor de uso: grátis (até ${s.faixaGratisAte} ${s.faixaGratisAte === 1 ? 'pessoa' : 'pessoas'}).`
    : 'Valor de uso: grátis.';
}

/** Pré-visualização do cadastro do espaço, a partir do que a pessoa digitou. */
export function previaDaFaixa(modo: 'GRATIS' | 'FAIXA', limite: number | null, valor: number | null): string | null {
  if (modo === 'GRATIS') return 'Grátis para qualquer número de pessoas.';
  if (limite == null || valor == null || valor <= 0) return null;
  if (limite === 0) return `Todas as reservas: ${formatarMoeda(valor)}.`;
  return `Até ${limite} ${limite === 1 ? 'pessoa' : 'pessoas'}: grátis. Acima de ${limite}: ${formatarMoeda(valor)}.`;
}

/** Frase do aviso à equipe quando a reserva tem valor ("Valor de uso: R$ 150,00 (acima de 10 pessoas)."). */
export function fraseValorParaEquipe(s: Faixa | undefined, valor: number): string {
  const acima = trechoAcimaDe(s?.faixaGratisAte);
  return `Valor de uso: ${formatarMoeda(valor)}${acima ? ` (${acima})` : ''}.`;
}

/** Texto da coluna "Valor" da lista: "Grátis", "R$ 150,00" ou "—" (reserva anterior à regra). */
export function valorDaReserva(valor: number | undefined): string {
  if (valor === undefined) return '—';
  return valor > 0 ? formatarMoeda(valor) : 'Grátis';
}
