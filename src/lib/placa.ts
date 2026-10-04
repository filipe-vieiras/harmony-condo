// Placa de veículo: formatos aceitos e normalização. Mesma regra do gatilho do banco (0031),
// para a tela avisar antes de o banco recusar.

/** Antiga: ABC1234. */
const PLACA_ANTIGA = /^[A-Z]{3}[0-9]{4}$/;
/** Mercosul: ABC1D23. */
const PLACA_MERCOSUL = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/;

export const TAMANHO_PLACA = 7;

/** Maiúsculas, só letras e números, no máximo 7 caracteres (o que a pessoa digita ou cola). */
export function normalizarPlacaDigitada(texto: string): string {
  return texto.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, TAMANHO_PLACA);
}

export function placaValida(placa: string): boolean {
  return PLACA_ANTIGA.test(placa) || PLACA_MERCOSUL.test(placa);
}

export const MENSAGEM_PLACA_INVALIDA = 'Placa inválida. Use o formato ABC1234 ou ABC1D23.';
export const AJUDA_PLACA = '3 letras e 4 números (ABC1234) ou 3 letras, número, letra e 2 números (ABC1D23).';
