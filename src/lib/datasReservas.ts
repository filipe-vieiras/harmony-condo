// Datas das reservas, sempre no fuso de Brasília (America/Sao_Paulo), nunca o do aparelho nem UTC:
// "hoje" e "dia passado" precisam bater com o que o banco decide (migração 0032).
// Datas viajam como "YYYY-MM-DD". A conta de dias usa o meio-dia UTC para o horário de verão
// (que o Brasil já não tem) ou qualquer virada nunca mudar o dia. Sem dependências de runtime.

export const FUSO_CONDOMINIO = 'America/Sao_Paulo';

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const DIAS_SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
export const DIAS_SEMANA_ABREV = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const DIAS_SEMANA_NOME = DIAS_SEMANA.map((d) => d.charAt(0).toUpperCase() + d.slice(1));

/** Data de hoje em Brasília, "YYYY-MM-DD". */
export function hojeBrasilia(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: FUSO_CONDOMINIO });
}

const paraUtc = (iso: string) => new Date(`${iso}T12:00:00Z`);
const deUtc = (d: Date) => d.toISOString().slice(0, 10);

export function somarDias(iso: string, n: number): string {
  return deUtc(new Date(paraUtc(iso).getTime() + n * 864e5));
}

/** 0 = domingo ... 6 = sábado. */
export function diaDaSemana(iso: string): number {
  return paraUtc(iso).getUTCDay();
}

export function partesDaData(iso: string): { ano: number; mes: number; dia: number } {
  const [a, m, d] = iso.split('-').map(Number);
  return { ano: a, mes: m, dia: d }; // mes de 1 a 12
}

export function montarData(ano: number, mes: number, dia: number): string {
  return `${String(ano).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

export function diasNoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

/** Primeiro dia do mês de `iso`, deslocado `n` meses. */
export function somarMeses(iso: string, n: number): string {
  const { ano, mes } = partesDaData(iso);
  const total = ano * 12 + (mes - 1) + n;
  return montarData(Math.floor(total / 12), (total % 12) + 1, 1);
}

/** "outubro de 2026" */
export function rotuloMes(iso: string): string {
  const { ano, mes } = partesDaData(iso);
  return `${MESES[mes - 1]} de ${ano}`;
}

/** "5 de outubro" */
export function dataCurta(iso: string): string {
  const { mes, dia } = partesDaData(iso);
  return `${dia} de ${MESES[mes - 1]}`;
}

/** "Sábado, 5 de outubro" */
export function dataLonga(iso: string): string {
  const nome = DIAS_SEMANA[diaDaSemana(iso)];
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)}, ${dataCurta(iso)}`;
}
