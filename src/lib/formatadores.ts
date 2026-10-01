// Formatadores de exibição (pt-BR). Só mudam como o valor aparece na tela:
// nada aqui é gravado no banco nem usado em comparação de datas.
// Sem dependências de runtime para a bateria de QA poder importar.

/**
 * Data para exibição: "2026-10-01" -> "01/10/2026".
 * "AAAA-MM-DD" é lido na mão (new Date('2026-10-01') é meia-noite UTC e, no
 * Brasil, viraria o dia anterior). Um timestamp completo (ex.: ciência gravada
 * com ISO) vira a data local de quem vê. Texto que não é data volta como veio.
 */
export function formatarData(valor: string | null | undefined): string {
  if (!valor) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  if (/^\d{4}-\d{2}-\d{2}T/.test(valor)) {
    const d = new Date(valor);
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString('pt-BR');
  }
  return valor;
}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Moeda: 150 -> "R$ 150,00". */
export function formatarMoeda(valor: number): string {
  return brl.format(valor).replace(/ /g, ' ');
}

/** Horário: "12:00:00" -> "12h"; "12:30:00" -> "12h30". Texto fora do padrão volta como veio. */
export function formatarHorario(valor: string | null | undefined): string {
  if (!valor) return '';
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(valor);
  if (!m) return valor;
  const h = String(Number(m[1]));
  return m[2] === '00' ? `${h}h` : `${h}h${m[2]}`;
}

/** Intervalo: ("12:00:00", "18:00:00") -> "12h às 18h". */
export function formatarIntervalo(inicio: string, fim: string): string {
  return `${formatarHorario(inicio)} às ${formatarHorario(fim)}`;
}

/** Plural: (1, 'recurso', 'recursos') -> "1 recurso"; 0 e 2+ usam o plural. */
export function pluralizar(qtd: number, singular: string, plural: string): string {
  return `${qtd} ${qtd === 1 ? singular : plural}`;
}
