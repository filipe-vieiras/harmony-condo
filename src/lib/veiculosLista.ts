// Regras puras da lista de veículos (busca, filtro, ordem, telefone). Sem dependências de runtime para a bateria importar.
import type { TipoVeiculo, Vehicle } from '../types';

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/** Tira hífen, espaço e ponto: "ABC-1D23" e "abc 1d23" viram "abc1d23". */
const compacto = (t: string) => semAcento(t).replace(/[\s.\-]/g, '');

/** Busca por placa (ignora hífen e espaço), unidade ("A-101", "a101", "101"), modelo, marca, nome e vaga. */
export function veiculoCombina(v: Vehicle, termo: string): boolean {
  const t = termo.trim();
  if (!t) return true;
  const tc = compacto(t);
  const tx = semAcento(t);
  return (
    compacto(v.placa).includes(tc) ||
    compacto(`${v.bloco}${v.unidade}`).includes(tc) ||
    compacto(v.unidade).includes(tc) ||
    compacto(v.vaga).includes(tc) ||
    semAcento(`${v.marca} ${v.modelo}`).includes(tx) ||
    semAcento(v.proprietarioNome).includes(tx)
  );
}

export function filtrarVeiculos(lista: Vehicle[], termo: string, tipo: 'TODOS' | TipoVeiculo): Vehicle[] {
  return lista.filter((v) => (tipo === 'TODOS' || v.tipoVeiculo === tipo) && veiculoCombina(v, termo));
}

const cmp = (a: string, b: string) => a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' });

/** Ordem padrão: bloco, apartamento (número como número), depois placa. */
export const ordemPadrao = (a: Vehicle, b: Vehicle) => cmp(a.bloco, b.bloco) || cmp(a.unidade, b.unidade) || cmp(a.placa, b.placa);

export type ColunaOrdem = 'PLACA' | 'UNIDADE' | 'MORADOR';

export function ordenarVeiculos(lista: Vehicle[], coluna: ColunaOrdem | null, desc: boolean): Vehicle[] {
  const base = [...lista].sort(ordemPadrao);
  if (!coluna) return base;
  const chave = (v: Vehicle) => (coluna === 'PLACA' ? v.placa : coluna === 'MORADOR' ? v.proprietarioNome : '');
  const r = [...base].sort((a, b) => (coluna === 'UNIDADE' ? ordemPadrao(a, b) : cmp(chave(a), chave(b)) || ordemPadrao(a, b)));
  return desc ? r.reverse() : r;
}

/** "11987654321" -> "(11) 98765-4321". Texto fora do padrão volta como veio (sem espaços nas pontas). */
export function formatarTelefone(t: string | null | undefined): string {
  const bruto = (t ?? '').trim();
  const d = bruto.replace(/\D/g, '');
  const n = d.startsWith('55') && d.length > 11 ? d.slice(2) : d;
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return bruto;
}

/** Link tel: só com dígitos; sem número, nada. */
export function hrefTelefone(t: string | null | undefined): string | null {
  const d = (t ?? '').replace(/\D/g, '');
  return d.length >= 8 ? `tel:${d}` : null;
}

export const rotuloUnidadeCurto = (v: { bloco: string; unidade: string }) => `${v.bloco}-${v.unidade}`;

export function textoContagem(mostrando: number, total: number): string {
  const veic = (n: number) => (n === 1 ? '1 veículo' : `${n} veículos`);
  return mostrando === total ? veic(total) : `${mostrando} de ${total} veículos`;
}
