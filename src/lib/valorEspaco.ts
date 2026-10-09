// Textos do valor de uso por faixa de pessoas (issue #81) e do valor em percentual da cota (fase 2, migração 0048).
// Só apresentação: quem calcula o valor de verdade é o banco (valor_reserva); aqui nada decide cobrança. As únicas contas
// daqui são a prévia do formulário do espaço (gestão), que mostra o que o banco vai gravar.
import type { CommonSpace } from '@/types';
import { formatarMoeda } from '@/lib/formatadores';

type Faixa = Pick<CommonSpace, 'faixaGratisAte' | 'faixaValor'> & Partial<Pick<CommonSpace, 'valorTipo' | 'faixaPercentual' | 'valorCalculado'>>;

/** Como o valor é definido no espaço: R$ fixo ou percentual da cota mínima do condomínio. */
export type TipoValor = 'FIXO' | 'PERCENTUAL';

export const ehPercentual = (s: Faixa): boolean => s.valorTipo === 'PERCENTUAL';

/** O espaço cobra por faixa (limite e valor ou percentual preenchidos)? Sem faixa = grátis para qualquer número. */
export const temFaixa = (s: Faixa): s is Faixa & { faixaGratisAte: number } =>
  s.faixaGratisAte != null && (ehPercentual(s) ? s.faixaPercentual != null : s.faixaValor != null);

/** R$ cheio da cobrança do espaço: o fixo, ou (percentual) o que o banco calculou hoje. Nulo = percentual sem cota cadastrada. */
export const valorCheio = (s: Faixa): number | null => (ehPercentual(s) ? s.valorCalculado ?? null : s.faixaValor ?? null);

/** "5%" ou "7,5%" (vírgula, como o brasileiro lê). */
export const percentualTexto = (p: number): string => `${String(p).replace('.', ',')}%`;

/**
 * R$ de um percentual da cota, como o banco calcula (valor_percentual, 0048): centavo mais próximo, meio para cima,
 * nunca menos de R$ 0,01. Em centavos inteiros para não depender de ponto flutuante.
 */
export function calcularPercentual(cota: number, percentual: number): number {
  const centavosCota = Math.round(cota * 100);
  const centesimosPct = Math.round(percentual * 100);
  return Math.max(Math.floor((centavosCota * centesimosPct + 5000) / 10000), 1) / 100;
}

/** O que fica no campo enquanto se digita o percentual: só dígitos e o primeiro separador decimal (ponto ou vírgula). */
export function limparPercentualDigitado(texto: string): string {
  let viuSeparador = false;
  return texto.replace(/[^\d.,]/g, '').replace(/[.,]/g, (m) => (viuSeparador ? '' : ((viuSeparador = true), m))).slice(0, 6);
}

/** Percentual digitado ("5", "7,5", "7.50") para número; nulo se vazio, fora de 0,01 a 100 ou com mais de 2 casas. */
export function lerPercentual(texto: string): number | null {
  const t = texto.trim();
  if (!/^\d{1,3}([.,]\d{1,2})?$/.test(t)) return null;
  const n = Number(t.replace(',', '.'));
  return n > 0 && n <= 100 ? n : null;
}

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
 * O que gravar no banco para a regra e o tipo escolhidos: os quatro campos de valor sempre vão juntos, para que trocar de
 * percentual para fixo (ou o contrário) limpe o outro. Grátis = tudo nulo e FIXO.
 */
export function valorParaBanco(
  regra: RegraValor,
  tipo: TipoValor,
  limite: number | null,
  valor: number,
  percentual: number | null,
): { faixaGratisAte: number | null; faixaValor: number | null; valorTipo: TipoValor; faixaPercentual: number | null } {
  if (regra === 'GRATIS') return { faixaGratisAte: null, faixaValor: null, valorTipo: 'FIXO', faixaPercentual: null };
  const ate = regra === 'PAGA' ? 0 : limite;
  if (tipo === 'PERCENTUAL') return { faixaGratisAte: ate, faixaValor: null, valorTipo: 'PERCENTUAL', faixaPercentual: percentual };
  return { faixaGratisAte: ate, faixaValor: valor, valorTipo: 'FIXO', faixaPercentual: null };
}

/**
 * A regra de valor mudou em relação à salva? Compara no formato do banco (centavos, grátis = nulos),
 * então trocar de opção e voltar, ou limite/valor que sobram de outra opção, não contam como mudança.
 */
export function regraDeValorMudou(salva: Faixa, atual: Faixa): boolean {
  const norm = (f: Faixa) => !temFaixa(f) ? 'GRATIS'
    : ehPercentual(f) ? `${f.faixaGratisAte}|P${Math.round((f.faixaPercentual ?? 0) * 100)}`
    : `${f.faixaGratisAte}|${Math.round((f.faixaValor ?? 0) * 100)}`;
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

/** Erro do campo "Percentual da cota (%)"; vazio = sem erro. Só aparece depois da tentativa de salvar. */
export function erroDoPercentual(regra: RegraValor, tipo: TipoValor, texto: string, tentou: boolean): string {
  if (regra === 'GRATIS' || tipo !== 'PERCENTUAL' || !tentou) return '';
  if (texto.trim() === '') return 'Informe o percentual da cota, maior que 0 e até 100.';
  return lerPercentual(texto) === null ? 'Use um percentual maior que 0 e até 100, com até 2 casas (ex.: 5 ou 7,5).' : '';
}

/**
 * A configuração está incompleta ou incoerente (impede salvar)? Em percentual, também sem cota cadastrada
 * (`cotaCadastrada`; o banco recusa do mesmo jeito).
 */
export function valorInvalido(
  regra: RegraValor,
  limite: number | null,
  capacidade: number,
  valor: number,
  tipo: TipoValor = 'FIXO',
  percentual: number | null = null,
  cotaCadastrada = true,
): boolean {
  if (regra === 'GRATIS') return false;
  if (tipo === 'PERCENTUAL') {
    if (percentual === null || !cotaCadastrada) return true;
  } else if (!(valor > 0)) return true;
  return regra === 'FAIXA' && (limite === null || limite < 1 || limite >= capacidade);
}

/** "acima de 10 pessoas"; vazio quando o limite é 0 (cobra de todos, não há "acima de"). */
export function trechoAcimaDe(limite: number | null | undefined): string {
  return limite != null && limite > 0 ? `acima de ${limite} ${limite === 1 ? 'pessoa' : 'pessoas'}` : '';
}

/** Espaço em percentual sem cota cadastrada (não deve ocorrer em uso normal): o morador não vê número nenhum. */
const A_COMBINAR = 'Valor a combinar com o síndico';

/** Linha "Valor de uso:" da galeria: "Grátis", "R$ 150,00 acima de 10 pessoas" ou "R$ 90,00 por reserva". */
export function valorUsoDoEspaco(s: Faixa): string {
  if (!temFaixa(s)) return 'Grátis';
  const v = valorCheio(s);
  if (v === null) return A_COMBINAR;
  const acima = trechoAcimaDe(s.faixaGratisAte);
  return `${formatarMoeda(v)} ${acima || 'por reserva'}`;
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
export function previaDaFaixa(modo: RegraValor, limite: number | null, valor: number | null, tipo: TipoValor = 'FIXO', percentual: number | null = null): string | null {
  if (modo === 'GRATIS') return 'Grátis para qualquer número de pessoas.';
  if (tipo === 'PERCENTUAL') {
    if (percentual === null) return 'Preencha o percentual para ver o resumo.';
    const alvo = `${percentualTexto(percentual)} da cota do condomínio`;
    if (modo === 'PAGA') return `Todas as reservas: ${alvo}.`;
    if (limite == null || limite < 1) return 'Preencha o percentual para ver o resumo.';
    return `Até ${limite} ${limite === 1 ? 'pessoa' : 'pessoas'}: grátis. Acima de ${limite}: ${alvo}.`;
  }
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

/**
 * Trecho curto do valor para o resumo do espaço: "grátis", "grátis até 10 pessoas, depois R$ 350,00" ou "R$ 90,00 por reserva".
 * `gestao` mostra também o percentual ("5% da cota (R$ 61,25)"); o morador nunca vê percentual nem cota, só o R$.
 */
export function resumoCurtoDoValor(s: Faixa, gestao = false): string {
  if (!temFaixa(s)) return 'grátis';
  const v = valorCheio(s);
  const pessoas = s.faixaGratisAte > 0 ? `grátis até ${s.faixaGratisAte} ${s.faixaGratisAte === 1 ? 'pessoa' : 'pessoas'}, depois ` : '';
  if (ehPercentual(s) && gestao) {
    const base = `${percentualTexto(s.faixaPercentual ?? 0)} da cota`;
    const conta = v === null ? ' (cota não cadastrada)' : ` (${formatarMoeda(v)})`;
    return `${pessoas}${base}${s.faixaGratisAte > 0 ? '' : ' por reserva'}${conta}`;
  }
  if (v === null) return `${pessoas}${A_COMBINAR.toLowerCase()}`;
  return `${pessoas}${formatarMoeda(v)}${s.faixaGratisAte > 0 ? '' : ' por reserva'}`;
}

/** Valor de uso por extenso para o bloco de detalhes: "Grátis até 10 pessoas · R$ 150,00 acima". Só R$ (morador não vê percentual). */
export function valorUsoPorExtenso(s: Faixa): string {
  if (!temFaixa(s)) return 'Grátis';
  const v = valorCheio(s);
  if (v === null) return A_COMBINAR;
  if (s.faixaGratisAte > 0) return `Grátis até ${s.faixaGratisAte} ${s.faixaGratisAte === 1 ? 'pessoa' : 'pessoas'} · ${formatarMoeda(v)} acima`;
  return `${formatarMoeda(v)} por reserva`;
}

/** Linha do valor no modal, a partir do que o banco devolveu: com valor, diz onde será cobrado. */
export function textoValorPedido(s: Faixa, valor: number, ehEquipe: boolean): string {
  if (valor > 0) return `Valor de uso: ${formatarMoeda(valor)}. ${ehEquipe ? 'O síndico combina a cobrança com o morador.' : 'O síndico combina a cobrança com você.'}`;
  return textoValorModal(s, valor);
}

/** Soma em centavos (sem erro de ponto flutuante). */
const somar = (a: number, b: number) => Math.round((a + b) * 100) / 100;

/**
 * Linha do TOTAL a pagar do pedido (L3): valor de uso + higienização. Só o total final; nunca a cota nem o percentual.
 * Vazio quando não há nada a pagar. A higienização continua em linha própria.
 */
export function textoTotalPedido(valorUso: number, taxaHigienizacao: number): string {
  const total = somar(valorUso, taxaHigienizacao);
  return total > 0 ? `Total a pagar: ${formatarMoeda(total)}.` : '';
}

/** Prévia do cálculo na tela da gestão: "5% da cota de R$ 1.225,00 = R$ 61,25." (o banco grava o valor de verdade). */
export function previaDoCalculo(modo: RegraValor, limite: number | null, percentual: number | null, cota: number | null): string {
  if (percentual === null) return 'Informe o percentual para ver o valor.';
  if (cota === null) return 'Cadastre a cota do condomínio para ver o valor.';
  const conta = `${percentualTexto(percentual)} da cota de ${formatarMoeda(cota)} = ${formatarMoeda(calcularPercentual(cota, percentual))}.`;
  return modo === 'FAIXA' && limite !== null && limite > 0 ? `Acima de ${limite} ${limite === 1 ? 'pessoa' : 'pessoas'}: ${conta}` : conta;
}
