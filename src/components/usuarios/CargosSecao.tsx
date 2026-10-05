'use client';

import React, { useState } from 'react';
import { ChevronDown, Clock, Copy, UserCog } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Badge } from '@/components/ui/Badge';
import { CARGO_ROTULO, podeTransferirCargo, type CargoTransferivel } from '@/lib/cargos';

interface Props {
  onTransferir: (cargo: CargoTransferivel, origemId?: string) => void;
  onIndicarSubsindico: () => void;
  onCopiarLink: (transferenciaId: string) => void;
  onCancelar: (transferenciaId: string) => void;
}

const botaoSecundario =
  'flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong';

/**
 * Seção "Cargos" da tela de Usuários (issue #53): quem tem cada cargo e a ação de transferir.
 * Só ADM e Síndico a veem (o Subsíndico não ganha botão desabilitado: a seção nem existe para ele).
 */
export function CargosSecao({ onTransferir, onIndicarSubsindico, onCopiarLink, onCancelar }: Props) {
  const { currentUser, systemUsers, transferenciasCargo } = useApp();
  // No celular a seção começa recolhida num resumo de uma linha; no computador fica sempre aberta.
  const [aberta, setAberta] = useState(false);

  if (!currentUser || (currentUser.role !== 'ADM' && currentUser.role !== 'SINDICO')) return null;

  const pendentes = transferenciasCargo.filter((t) => t.status === 'PENDENTE');
  const titularesDe = (cargo: CargoTransferivel) => systemUsers.filter((u) => u.role === cargo);
  const sindico = titularesDe('SINDICO')[0];
  const subsindico = titularesDe('SUBSINDICO')[0];

  const resumo = `Cargos: ${sindico ? `Síndico ${sindico.name}` : 'sem Síndico'}, ${subsindico ? `Subsíndico ${subsindico.name}` : 'sem Subsíndico'}`;

  const cargos: CargoTransferivel[] = ['SINDICO', 'SUBSINDICO', 'CONSELHO', 'PORTARIA'];

  return (
    <section aria-label="Cargos" className="space-y-2">
      <button
        type="button"
        onClick={() => setAberta((a) => !a)}
        aria-expanded={aberta}
        aria-controls="cargos-grade"
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 text-left text-xs font-semibold text-slate-800 sm:hidden"
      >
        <span className="truncate" title={resumo}>{resumo}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform motion-reduce:transition-none ${aberta ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      <h2 className="hidden text-xs font-bold uppercase tracking-wider text-slate-800 sm:block">Cargos</h2>

      <div id="cargos-grade" className={`${aberta ? 'grid' : 'hidden'} gap-3 sm:grid sm:grid-cols-2 xl:grid-cols-4`}>
        {cargos.map((cargo) => {
          const titulares = titularesDe(cargo);
          const pendentesDoCargo = pendentes.filter((t) => t.cargo === cargo);
          const unico = cargo === 'SINDICO' || cargo === 'SUBSINDICO';
          // Quem pode ser origem aqui: titular sem pendência e dentro do que o executor pode transferir.
          const origens = titulares.filter(
            (u) => !pendentesDoCargo.some((t) => t.origemId === u.id) && podeTransferirCargo(currentUser.role, cargo, u.id, currentUser.id),
          );
          const idTitulo = `cargo-card-${cargo}`;

          return (
            <div key={cargo} className="flex flex-col rounded-xl border border-slate-200 bg-white p-4">
              <h3 id={idTitulo} tabIndex={-1} className="text-xs font-bold uppercase tracking-wider text-slate-500 outline-none">
                {CARGO_ROTULO[cargo]}
              </h3>

              {titulares.length === 0 ? (
                <p className="mt-1 text-sm font-semibold text-slate-600">Sem titular</p>
              ) : unico ? (
                <p className="mt-1 text-sm font-bold text-slate-900">{titulares[0].name}</p>
              ) : (
                <p className="mt-1 text-sm font-bold text-slate-900">
                  {titulares.slice(0, 3).map((u) => u.name).join(', ')}
                  {titulares.length > 3 && <span className="ml-1 font-semibold text-slate-600">+{titulares.length - 3}</span>}
                </p>
              )}

              {pendentesDoCargo.map((t) => (
                <div key={t.id} className="mt-3 space-y-2 rounded-lg border border-pendente-200 bg-pendente-50 p-3">
                  <Badge className="bg-pendente-50 text-pendente-800" icon={<Clock className="h-3 w-3" aria-hidden="true" />}>
                    Transferência pendente
                  </Badge>
                  <p className="text-xs text-pendente-900">
                    {!unico && <>De {t.origemNome}. </>}Para {t.destinoNome}. Aguardando aceitar o convite.
                  </p>
                  <div className="flex flex-col gap-2">
                    <button type="button" onClick={() => onCopiarLink(t.id)} className={botaoSecundario}>
                      <Copy className="h-4 w-4" aria-hidden="true" />
                      Copiar link
                    </button>
                    <button type="button" onClick={() => onCancelar(t.id)} className={botaoSecundario}>
                      Cancelar transferência
                    </button>
                  </div>
                </div>
              ))}

              <div className="mt-auto pt-3">
                {cargo === 'SUBSINDICO' && titulares.length === 0 ? (
                  pendentesDoCargo.length === 0 && (
                    <button type="button" onClick={onIndicarSubsindico} className={`${botaoSecundario} w-full`}>
                      <UserCog className="h-4 w-4" aria-hidden="true" />
                      Indicar subsíndico
                    </button>
                  )
                ) : (
                  origens.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onTransferir(cargo, unico ? origens[0].id : undefined)}
                      aria-label={`Transferir cargo de ${CARGO_ROTULO[cargo]}`}
                      className={`${botaoSecundario} w-full`}
                    >
                      Transferir cargo
                    </button>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
