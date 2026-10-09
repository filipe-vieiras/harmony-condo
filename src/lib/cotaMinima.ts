// Campo da cota mínima do condomínio (0048). Só máscara e validação de tela: quem decide é a função
// definir_cota_minima do banco (de R$ 1,00 a R$ 100.000,00, 2 casas), que confere de novo.

/** Piso (decisão do dono): R$ 1,00, em centavos. */
export const PISO_COTA_CENTAVOS = 100;

/** Teto: R$ 100.000,00, em centavos. */
export const LIMITE_COTA_CENTAVOS = 10_000_000;

/** Só dígitos, lidos como centavos (122500 = R$ 1.225,00). Sem zeros à esquerda; até 9 dígitos. */
export const mascaraCentavos = (texto: string): string => texto.replace(/\D/g, '').replace(/^0+/, '').slice(0, 9);

/** "122500" -> "1.225,00" (o "R$" fica no prefixo do campo). */
export const centavosParaReais = (centavos: string): string =>
  (Number(centavos) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Centavos digitados como número inteiro finito; nulo se vazio. */
export function cotaEmCentavos(centavos: string): number | null {
  if (centavos === '') return null;
  const n = Number(centavos);
  return Number.isFinite(n) ? n : null;
}

/** Erro do campo; vazio = sem erro. */
export function erroDaCota(centavos: string): string {
  const n = cotaEmCentavos(centavos);
  if (n === null || n === 0) return 'Informe a cota em reais, de no mínimo R$ 1,00.';
  if (n < PISO_COTA_CENTAVOS) return 'A cota mínima é de R$ 1,00. Confira o valor digitado.';
  if (n > LIMITE_COTA_CENTAVOS) return 'Esse valor parece alto demais. Confira se não sobrou algum zero. O máximo é R$ 100.000,00.';
  return '';
}
