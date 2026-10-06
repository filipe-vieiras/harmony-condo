'use client';

import { CheckCircle2, ChevronRight, Clock, Lock } from 'lucide-react';
import type { CommonSpace } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { formatarMoeda } from '@/lib/formatadores';
import { resumoCurtoDoValor, valorUsoPorExtenso } from '@/lib/valorEspaco';

const FOTO_PADRAO = 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=800&q=80';

interface Props {
  espaco: CommonSpace;
  aberto: boolean;
  onAlternar: () => void;
  /** Nomes dos espaços que este bloqueia no mesmo dia. Só a gestão recebe (RLS); vazio = não mostra a linha. */
  bloqueiaNomes: string[];
}

/**
 * Resumo de uma linha do espaço escolhido e, atrás de "Ver regras e valores", o bloco recolhível
 * "Detalhes do {espaço}" (fechado por padrão). Substitui a galeria de cartões grandes.
 */
export function DetalhesEspaco({ espaco, aberto, onAlternar, bloqueiaNomes }: Props) {
  const exige = espaco.exigeAprovacao !== false;
  return (
    <section aria-label={`Resumo do ${espaco.nome}`} className="no-print rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-xs">
      <p className="text-sm font-bold text-slate-900">{espaco.nome} · até {espaco.capacidadeMax} pessoas</p>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600">
        {exige
          ? <Badge icon={<Clock className="h-3 w-3" aria-hidden="true" />} className="bg-pendente-100 text-pendente-800">Precisa de aprovação</Badge>
          : <Badge icon={<CheckCircle2 className="h-3 w-3" aria-hidden="true" />} className="bg-emerald-100 text-emerald-800">Confirma na hora</Badge>}
        <span>{resumoCurtoDoValor(espaco)}</span>
      </p>
      <button
        type="button"
        aria-expanded={aberto}
        aria-controls="detalhes-espaco-corpo"
        onClick={onAlternar}
        className="-mb-1 mt-1 inline-flex min-h-11 items-center gap-1 text-xs font-semibold text-accent-strong underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
      >
        Ver regras e valores
        <ChevronRight aria-hidden="true" className={`h-4 w-4 transition-transform motion-reduce:transition-none ${aberto ? 'rotate-90' : ''}`} />
      </button>

      <div id="detalhes-espaco-corpo" role="region" aria-labelledby="detalhes-espaco-titulo" hidden={!aberto} className="mt-2 border-t border-slate-100 pt-3">
        <h3 id="detalhes-espaco-titulo" className="font-display text-[15px] font-bold text-slate-900">Detalhes do {espaco.nome}</h3>
        <div className="mt-3 flex items-start gap-3">
          <img
            src={espaco.imagemUrl || FOTO_PADRAO}
            alt=""
            width={72}
            height={72}
            className="size-18 shrink-0 rounded-xl bg-slate-100 object-cover"
          />
          <p className="text-xs leading-relaxed text-slate-600">{espaco.descricao}</p>
        </div>
        <dl className="mt-3 text-xs">
          <Linha rotulo="Horário permitido" valor={espaco.horarioFuncionamento} />
          <Linha rotulo="Valor de uso" valor={valorUsoPorExtenso(espaco)} />
          <Linha rotulo="Taxa de higienização" valor={espaco.taxaLimpeza > 0 ? formatarMoeda(espaco.taxaLimpeza) : 'Isento'} />
          <Linha rotulo="Aprovação" valor={exige ? 'Precisa de aprovação' : 'Confirma na hora'} />
        </dl>
        <div className="mt-3 text-xs">
          <h4 className="font-bold text-slate-900">Regras de uso</h4>
          {espaco.regras.length > 0 ? (
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-slate-600">
              {espaco.regras.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          ) : (
            <p className="mt-1 text-slate-600">Este espaço não tem regras cadastradas.</p>
          )}
        </div>
        {/* Só a gestão lê os bloqueios (RLS): o morador nunca vê esta linha nem o motivo de um dia indisponível. */}
        {bloqueiaNomes.length > 0 && (
          <p className="mt-3 flex items-start gap-1.5 text-[12px] text-slate-600">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Não reservável no mesmo dia que: {bloqueiaNomes.join(', ')}.</span>
          </p>
        )}
      </div>
    </section>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-t border-slate-100 py-2.5 first:border-t-0">
      <dt className="shrink-0 text-slate-600">{rotulo}</dt>
      <dd className="text-right font-bold text-slate-900">{valor}</dd>
    </div>
  );
}
