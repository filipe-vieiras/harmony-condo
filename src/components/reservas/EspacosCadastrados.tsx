'use client';

import type { CommonSpace } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { formatarMoeda, pluralizar } from '@/lib/formatadores';
import { resumoCurtoDoValor } from '@/lib/valorEspaco';
import { Acordeao } from './Acordeao';

interface Props {
  spaces: CommonSpace[];
  aberto: boolean;
  onAlternar: () => void;
  onEditar: (s: CommonSpace) => void;
  onAlternarAtivo: (s: CommonSpace) => void;
}

/** "Espaços cadastrados" (só quem gere espaços): lista recolhível com botões de texto, no lugar dos ícones sobre a foto. */
export function EspacosCadastrados({ spaces, aberto, onAlternar, onEditar, onAlternarAtivo }: Props) {
  const emManutencao = spaces.filter((s) => s.ativo === false).length;
  const resumo = `${pluralizar(spaces.length, 'espaço', 'espaços')}${emManutencao ? ` · ${emManutencao} em manutenção` : ''}`;
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
              return (
                <tr key={s.id}>
                  <td data-label="Espaço" className="px-4 py-3 font-bold text-slate-900">{s.nome}</td>
                  <td data-label="Capacidade" className="px-4 py-3">Até {s.capacidadeMax} pessoas</td>
                  <td data-label="Aprovação" className="px-4 py-3">{s.exigeAprovacao !== false ? 'Precisa de aprovação' : 'Confirma na hora'}</td>
                  <td data-label="Valor de uso" className="px-4 py-3">{resumoCurtoDoValor(s).replace(/^./, (c) => c.toUpperCase())}</td>
                  <td data-label="Higienização" className="px-4 py-3">{s.taxaLimpeza > 0 ? formatarMoeda(s.taxaLimpeza) : 'Isento'}</td>
                  <td data-label="Situação" className="px-4 py-3">
                    {ativo
                      ? <Badge className="bg-emerald-100 text-emerald-800">Ativo</Badge>
                      : <Badge className="bg-pendente-100 text-pendente-800">Em manutenção</Badge>}
                  </td>
                  <td data-label="Ações" className="px-4 py-3 text-right">
                    <div className="flex w-full gap-2 md:justify-end">
                      <button
                        type="button"
                        onClick={() => onEditar(s)}
                        aria-label={`Editar ${s.nome}`}
                        className="flex min-h-11 flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-primary transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong md:flex-none"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => onAlternarAtivo(s)}
                        aria-label={`${ativo ? 'Desativar' : 'Ativar'} ${s.nome}`}
                        className="flex min-h-11 flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong md:flex-none"
                      >
                        {ativo ? 'Desativar' : 'Ativar'}
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
