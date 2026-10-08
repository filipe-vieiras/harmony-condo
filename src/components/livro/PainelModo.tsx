'use client';

// Interruptor do Livro (Síndico e ADM). Desligado por padrão em todo ambiente. Os três modos estão sempre disponíveis.
import React, { useState } from 'react';
import { Loader2, Settings2 } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { MODOS, type LivroModo } from '@/lib/livro';
import { livroDefinirModo } from '@/lib/supabase/livro';
import { useDialog } from '@/components/ui/DialogProvider';

interface Props {
  supabase: SupabaseClient;
  modo: LivroModo;
  onMudou: () => Promise<void>;
}

export function PainelModo({ supabase, modo, onMudou }: Props) {
  const { confirm } = useDialog();
  const [salvando, setSalvando] = useState<LivroModo | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const mudar = async (novo: LivroModo) => {
    if (novo === modo || salvando) return;
    const abrir = novo === 'ABERTO';
    const ok = await confirm({
      title: `Mudar o Livro para "${MODOS.find((m) => m.valor === novo)?.titulo}"?`,
      message: abrir
        ? 'Os moradores validados, o Zelador e a Portaria passam a ler tudo, com nome e unidade.'
        : novo === 'EQUIPE'
        ? 'Só Síndico, Subsíndico, Administradora e Conselho entram. Nada é apagado.'
        : 'Ninguém acessa o Livro. Nada é apagado e dá para ligar de novo.',
      confirmLabel: 'Mudar',
      destructive: false,
    });
    if (!ok) return;
    setSalvando(novo);
    setErro(null);
    const r = await livroDefinirModo(supabase, novo);
    if (!r.ok) setErro(r.erro);
    else await onMudou();
    setSalvando(null);
  };

  return (
    <section aria-labelledby="modo-titulo" className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
      <h2 id="modo-titulo" className="flex items-center gap-2 text-base font-bold text-slate-900">
        <Settings2 className="h-5 w-5 text-slate-500" aria-hidden="true" /> Quem pode usar o Livro
      </h2>
      <div role="radiogroup" aria-labelledby="modo-titulo" className="grid gap-2 sm:grid-cols-3">
        {MODOS.map((m) => {
          const ativo = m.valor === modo;
          return (
            <button
              key={m.valor}
              type="button"
              role="radio"
              aria-checked={ativo}
              onClick={() => void mudar(m.valor)}
              disabled={!!salvando}
              className={`min-h-11 rounded-xl border p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong ${ativo ? 'border-accent-strong bg-accent-50' : 'border-slate-200 bg-white hover:bg-slate-50'} disabled:opacity-60`}
            >
              <span className="flex items-center gap-2 text-sm font-bold text-slate-900">
                {salvando === m.valor && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {m.titulo}{ativo ? ' (atual)' : ''}
              </span>
              <span className="mt-1 block text-sm text-slate-600">{m.descricao}</span>
            </button>
          );
        })}
      </div>
      {erro && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{erro}</p>}
    </section>
  );
}
