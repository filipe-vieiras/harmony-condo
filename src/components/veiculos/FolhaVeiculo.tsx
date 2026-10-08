'use client';

// Folha inferior com os detalhes do veículo (celular, < 1024px). Foco preso (useModalFocus), Esc, toque fora e botão
// Fechar fecham; a rolagem da página de fundo fica travada; sobe com animação só se a pessoa não pediu menos movimento.
// Editar e Remover só aparecem quando `podeAgir` (Morador nos próprios, exceto visitante; Síndico, Subsíndico e ADM em todos).
import React, { useEffect } from 'react';
import { Pencil, Trash2, X } from 'lucide-react';
import type { Vehicle } from '@/types';
import { TipoVeiculoBadge } from '@/components/ui/TipoVeiculoBadge';
import { tipoVeiculoDe } from '@/lib/tiposVeiculo';
import { formatarTelefone, hrefTelefone, rotuloUnidadeCurto } from '@/lib/veiculosLista';
import { useEscapeToClose } from '@/lib/useEscapeToClose';
import { useModalFocus } from '@/lib/useModalFocus';

interface Props {
  veiculo: Vehicle;
  podeAgir: boolean;
  onEditar: () => void;
  onRemover: () => void;
  onFechar: () => void;
}

function Campo({ rotulo, children, largo }: { rotulo: string; children: React.ReactNode; largo?: boolean }) {
  return (
    <div className={largo ? 'col-span-2' : ''}>
      <dt className="text-[12px] font-semibold uppercase tracking-wide text-slate-600">{rotulo}</dt>
      <dd className="mt-0.5 break-words text-base font-semibold text-slate-900">{children}</dd>
    </div>
  );
}

export function FolhaVeiculo({ veiculo: v, podeAgir, onEditar, onRemover, onFechar }: Props) {
  const Icone = tipoVeiculoDe(v.tipoVeiculo)?.icone;
  const tel = hrefTelefone(v.telefoneContato);

  useEscapeToClose(true, onFechar);
  useModalFocus(true);

  // Trava a rolagem do fundo (no iOS, overflow no body basta com o painel em overscroll-contain).
  useEffect(() => {
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = antes; };
  }, []);

  return (
    <div className="fixed inset-0 z-50 lg:hidden print:hidden">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onFechar} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Detalhes do veículo ${v.placa}`}
        className="folha-animada absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto overscroll-contain rounded-t-3xl bg-white px-4 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl"
      >
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-slate-300" aria-hidden="true" />
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 font-mono text-base font-bold tracking-widest text-white">
            {Icone && <Icone className="h-4 w-4" aria-hidden="true" />}
            {v.placa}
          </span>
          <button
            type="button"
            onClick={onFechar}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong"
          >
            <X className="h-4 w-4" aria-hidden="true" /> Fechar
          </button>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
          <Campo rotulo="Veículo" largo>
            {v.marca} {v.modelo}{v.cor ? ` · ${v.cor}` : ''}{' '}
            <span className="align-middle font-normal"><TipoVeiculoBadge tipo={v.tipoVeiculo} /></span>
          </Campo>
          <Campo rotulo="Unidade">{rotuloUnidadeCurto(v)}</Campo>
          <Campo rotulo="Vaga"><span className="font-mono">{v.vaga || '—'}</span></Campo>
          <Campo rotulo="Morador" largo>
            {v.proprietarioNome}
            {v.status === 'VISITANTE' && (
              <span className="ml-2 rounded-full border border-pendente-200 bg-pendente-50 px-2 py-0.5 align-middle text-[12px] font-bold text-pendente-800">Visitante</span>
            )}
            <div className="mt-1">
              {tel ? (
                <a href={tel} className="inline-flex min-h-11 items-center text-base font-semibold text-accent-strong underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong">
                  {formatarTelefone(v.telefoneContato)}
                </a>
              ) : (
                <span className="text-sm font-normal text-slate-600">Sem telefone</span>
              )}
            </div>
          </Campo>
        </dl>

        {podeAgir && (
          <div className="mt-4 flex items-center gap-6">
            <button
              type="button"
              onClick={onEditar}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" /> Editar veículo
            </button>
            <button
              type="button"
              onClick={onRemover}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" /> Remover
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
