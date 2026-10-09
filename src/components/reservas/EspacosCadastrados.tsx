'use client';

import type { CommonSpace } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { formatarData, formatarMoeda, pluralizar } from '@/lib/formatadores';
import type { InterdicaoInfo } from '@/lib/supabase/db';
import type { ModoInterdicao } from './InterditarEspacoDialog';
import { resumoCurtoDoValor } from '@/lib/valorEspaco';
import { Acordeao } from './Acordeao';

interface Props {
  spaces: CommonSpace[];
  aberto: boolean;
  onAlternar: () => void;
  /** Ausente = a pessoa não edita espaço (Zelador): o botão "Editar" nem aparece. */
  onEditar?: (s: CommonSpace) => void;
  onInterditar: (s: CommonSpace, modo: ModoInterdicao) => void;
  /** Quem interditou e quando (só a equipe operacional recebe). */
  interdicoes: Record<string, InterdicaoInfo>;
  /** Quantas reservas futuras (pendentes e aprovadas) o espaço tem. */
  futurasDo: (espacoId: string) => number;
  onVerFuturas: (s: CommonSpace) => void;
}

/**
 * "Espaços cadastrados" (gestão e Zelador): lista recolhível com botões de texto. A gestão edita; gestão e Zelador interditam e
 * reabrem (interditar bloqueia só novos pedidos e não cancela nenhuma reserva).
 */
export function EspacosCadastrados({ spaces, aberto, onAlternar, onEditar, onInterditar, interdicoes, futurasDo, onVerFuturas }: Props) {
  const emManutencao = spaces.filter((s) => s.ativo === false).length;
  const resumo = `${pluralizar(spaces.length, 'espaço', 'espaços')}${emManutencao ? ` · ${emManutencao} ${emManutencao === 1 ? 'interditado' : 'interditados'}` : ''}`;
  return (
    <Acordeao id="espacos-cadastrados" titulo="Espaços cadastrados" resumo={resumo} aberto={aberto} onAlternar={onAlternar} nivel={2} className="no-print">
      <div className="-mx-4 -mb-4 overflow-x-auto">
        <table className="stack-mobile w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50/75 text-[12px] font-bold uppercase tracking-wider text-slate-600">
            <tr>
              <th className="px-4 py-3">Espaço</th>
              <th className="px-4 py-3">Capacidade</th>
              <th className="px-4 py-3">Aprovação</th>
              <th className="px-4 py-3">Valor de uso</th>
              <th className="px-4 py-3">Higienização</th>
              <th className="px-4 py-3">Situação</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {spaces.map((s) => {
              const ativo = s.ativo !== false;
              const info = interdicoes[s.id];
              const futuras = futurasDo(s.id);
              return (
                <tr key={s.id}>
                  <td data-label="Espaço" className="px-4 py-3 font-bold text-slate-900">{s.nome}</td>
                  <td data-label="Capacidade" className="px-4 py-3">Até {s.capacidadeMax} pessoas</td>
                  <td data-label="Aprovação" className="px-4 py-3">{s.exigeAprovacao !== false ? 'Precisa de aprovação' : 'Confirma na hora'}</td>
                  <td data-label="Valor de uso" className="px-4 py-3">{resumoCurtoDoValor(s, true).replace(/^./, (c) => c.toUpperCase())}</td>
                  <td data-label="Higienização" className="px-4 py-3">{s.taxaLimpeza > 0 ? formatarMoeda(s.taxaLimpeza) : 'Isento'}</td>
                  <td data-label="Situação" className="px-4 py-3">
                    {ativo
                      ? <Badge className="bg-emerald-100 text-emerald-800">Ativo</Badge>
                      : (
                        <div className="space-y-1">
                          <Badge className="bg-pendente-100 text-pendente-800">Em manutenção</Badge>
                          {s.motivoInterdicao && <p className="text-[12px] text-slate-700">Motivo: {s.motivoInterdicao}</p>}
                          {info && <p className="text-[12px] text-slate-600">Interditado por {info.por} em {formatarData(info.em)}</p>}
                        </div>
                      )}
                    {futuras > 0 && (
                      <button
                        type="button"
                        onClick={() => onVerFuturas(s)}
                        className="mt-1 inline-flex min-h-11 items-center text-[12px] font-semibold text-accent-strong underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
                      >
                        {pluralizar(futuras, 'reserva futura', 'reservas futuras')}: ver e cancelar
                      </button>
                    )}
                  </td>
                  <td data-label="Ações" className="px-4 py-3 text-right">
                    <div className="flex w-full flex-wrap gap-2 md:justify-end">
                      {onEditar && (
                        <button
                          type="button"
                          onClick={() => onEditar(s)}
                          aria-label={`Editar ${s.nome}`}
                          className="flex min-h-11 flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-primary transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong md:flex-none"
                        >
                          Editar
                        </button>
                      )}
                      {!ativo && (
                        <button
                          type="button"
                          onClick={() => onInterditar(s, 'motivo')}
                          aria-label={`Editar o motivo da interdição de ${s.nome}`}
                          className="flex min-h-11 flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong md:flex-none"
                        >
                          Editar motivo
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onInterditar(s, ativo ? 'interditar' : 'reabrir')}
                        aria-label={`${ativo ? 'Interditar espaço' : 'Reabrir espaço'}: ${s.nome}`}
                        className="flex min-h-11 flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong md:flex-none"
                      >
                        {ativo ? 'Interditar espaço' : 'Reabrir espaço'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Acordeao>
  );
}
