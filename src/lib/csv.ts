// CSV seguro para planilha. Célula que começa com =, +, -, @, tab ou CR é lida como fórmula pelo Excel/Planilhas:
// ganha um apóstrofo na frente (vira texto) e as aspas são duplicadas. Sem dependências de runtime.

/** Uma célula pronta para o CSV (já entre aspas). */
export function celulaCsv(valor: unknown): string {
  let t = valor === null || valor === undefined ? '' : String(valor);
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
  return `"${t.replace(/"/g, '""')}"`;
}

export const linhaCsv = (celulas: unknown[], separador = ';') => celulas.map(celulaCsv).join(separador);
