// Textos do valor de uso por faixa de pessoas (issue #81, fase 2). Só apresentação: quem calcula
// o valor de verdade é o banco (valor_reserva, migração 0039); aqui nada decide cobrança.
import type { CommonSpace } from '@/types';
import { formatarMoeda } from '@/lib/formatadores';

type Faixa = Pick<CommonSpace, 'faixaGratisAte' | 'faixaValor'>;

/** O espaço cobra por faixa (limite e valor preenchidos)? Sem faixa = grátis para qualquer número. */
export const temFaixa = (s: Faixa): s is { faixaGratisAte: number; faixaValor: number } =>
  s.faixaGratisAte != null && s.faixaValor != null;

/** Regra de valor como a tela de configuração mostra. O banco só tem dois campos (faixa_gratis_ate e faixa_valor). */
export type RegraValor = 'GRATIS' | 'FAIXA' | 'PAGA';

/**
 * Regra que a tela mostra para um espaço salvo. Limite 0 já cobra de todos no banco (0039), então
 * vira "Paga em toda reserva"; assim a regra nova não precisa de coluna nem migração.
 */
export function regraDoEspaco(s: Faixa): RegraValor {
  if (!temFaixa(s)) return 'GRATIS';
  return s.faixaGratisAte === 0 ? 'PAGA' : 'FAIXA';
}

/** O que gravar no banco para a regra escolhida: "Paga em toda reserva" é limite 0; grátis é nulo nos dois. */
export function faixaParaBanco(regra: RegraValor, limite: number | null, valor: number): { faixaGratisAte: number | null; faixaValor: number | null } {
  if (regra === 'PAGA') return { faixaGratisAte: 0, faixaValor: valor };
  if (regra === 'FAIXA') return { faixaGratisAte: limite, faixaValor: valor };
  return { faixaGratisAte: null, faixaValor: null };
}

/**
 * A regra de valor mudou em relação à salva? Compara no formato do banco (centavos, grátis = nulos),
 * então trocar de opção e voltar, ou limite/valor que sobram de outra opção, não contam como mudança.
 */
export function regraDeValorMudou(salva: Faixa, atual: Faixa): boolean {
  const norm = (f: Faixa) => temFaixa(f) ? `${f.faixaGratisAte}|${Math.round(f.faixaValor * 100)}` : 'GRATIS';
  return norm(salva) !== norm(atual);
}

/** Erro do limite "Grátis até (pessoas)"; vazio = sem erro. `tentou` evita gritar antes de a pessoa tentar salvar. */
export function erroDoLimiteGratis(regra: RegraValor, limite: number | null, capacidade: number, tentou: boolean): string {
  if (regra !== 'FAIXA') return '';
  if (limite === null) return tentou ? 'Informe quantas pessoas podem usar sem pagar. Mínimo 1.' : '';
  if (limite === 0) return "Com 0 pessoas grátis, todos pagam. Escolha 'Paga em toda reserva'.";
  if (limite >= capacidade) return `O limite grátis precisa ser menor que a capacidade do espaço (${capacidade} pessoas). Se ninguém deve pagar, escolha 'Grátis'.`;
  return '';
}

/** A configuração está incompleta ou incoerente (impede salvar)? */
export function valorInvalido(regra: RegraValor, limite: number | null, capacidade: number, valor: number): boolean {
  if (regra === 'GRATIS') return false;
  if (!(valor > 0)) return true;
  return regra === 'FAIXA' && (limite === null || limite < 1 || limite >= capacidade);
}

/** "acima de 10 pessoas"; vazio quando o limite é 0 (cobra de todos, não há "acima de"). */
export function trechoAcimaDe(limite: number | null | undefined): string {
  return limite != null && limite > 0 ? `acima de ${limite} ${limite === 1 ? 'pessoa' : 'pessoas'}` : '';
}

/** Linha "Valor de uso:" da galeria: "Grátis", "R$ 150,00 acima de 10 pessoas" ou "R$ 90,00 por reserva". */
export function valorUsoDoEspaco(s: Faixa): string {
  if (!temFaixa(s)) return 'Grátis';
  const acima = trechoAcimaDe(s.faixaGratisAte);
  return `${formatarMoeda(s.faixaValor)} ${acima || 'por reserva'}`;
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
export function previaDaFaixa(modo: RegraValor, limite: number | null, valor: number | null): string | null {
  if (modo === 'GRATIS') return 'Grátis para qualquer número de pessoas.';
  if (valor == null || valor <= 0) return 'Preencha o valor para ver o resumo.';
  if (modo === 'PAGA') return `Todas as reservas: ${formatarMoeda(valor)}.`;
  if (limite == null || limite < 1) return 'Preencha o valor para ver o resumo.';
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

/** Trecho curto do valor para o resumo do espaço: "grátis", "grátis até 10 pessoas, depois R$ 350,00" ou "R$ 90,00 por reserva". */
export function resumoCurtoDoValor(s: Faixa): string {
  if (!temFaixa(s)) return 'grátis';
  if (s.faixaGratisAte > 0) return `grátis até ${s.faixaGratisAte} ${s.faixaGratisAte === 1 ? 'pessoa' : 'pessoas'}, depois ${formatarMoeda(s.faixaValor)}`;
  return `${formatarMoeda(s.faixaValor)} por reserva`;
}

/** Valor de uso por extenso para o bloco de detalhes: "Grátis até 10 pessoas · R$ 150,00 acima". */
export function valorUsoPorExtenso(s: Faixa): string {
  if (!temFaixa(s)) return 'Grátis';
  if (s.faixaGratisAte > 0) return `Grátis até ${s.faixaGratisAte} ${s.faixaGratisAte === 1 ? 'pessoa' : 'pessoas'} · ${formatarMoeda(s.faixaValor)} acima`;
  return `${formatarMoeda(s.faixaValor)} por reserva`;
}

/** Linha do valor no modal, a partir do que o banco devolveu: com valor, diz onde será cobrado. */
export function textoValorPedido(s: Faixa, valor: number, ehEquipe: boolean): string {
  if (valor > 0) return `Valor de uso: ${formatarMoeda(valor)}. ${ehEquipe ? 'O síndico combina a cobrança com o morador.' : 'O síndico combina a cobrança com você.'}`;
  return textoValorModal(s, valor);
}
