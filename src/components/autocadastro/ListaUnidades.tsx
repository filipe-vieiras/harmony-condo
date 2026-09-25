'use client';

import React, { useEffect, useState } from 'react';
import { Users, Search, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { fetchDiretorioUnidades } from '@/lib/supabase/db';
import { Badge } from '@/components/ui/Badge';
import type { DiretorioUnidade } from '@/types';

const SITUACAO: Record<DiretorioUnidade['situacao'], { label: string; cls: string }> = {
  VALIDADO: { label: 'Confirmado', cls: 'bg-emerald-50 text-emerald-800' },
  AGUARDANDO_VALIDACAO: { label: 'Aguardando validação', cls: 'bg-amber-50 text-amber-800' },
  SEM_CADASTRO: { label: 'Sem cadastro', cls: 'bg-slate-100 text-slate-600' },
};

/**
 * Lista pública do condomínio: só unidade, nome do responsável e situação.
 * Serve para os vizinhos conferirem quem se cadastrou em cada apartamento.
 */
export function ListaUnidades() {
  const [supabase] = useState(() => createClient());
  const [linhas, setLinhas] = useState<DiretorioUnidade[] | null>(null);
  const [busca, setBusca] = useState('');

  useEffect(() => {
    fetchDiretorioUnidades(supabase).then(setLinhas);
  }, [supabase]);

  const termo = busca.trim().toLowerCase();
  const filtradas = (linhas ?? []).filter(
    (l) => !termo || l.numero.toLowerCase().includes(termo) || (l.responsavel ?? '').toLowerCase().includes(termo)
  );

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Users className="h-6 w-6 text-[#00A8E8]" />
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Lista de Unidades</h1>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Confira quem está cadastrado em cada apartamento. Se algo estiver errado, avise o síndico.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-500" />
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por apartamento ou nome..."
          aria-label="Buscar por apartamento ou nome"
          className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2 text-xs text-slate-900 placeholder:text-slate-500 focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        {linhas === null ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-[#0B2545]" /></div>
        ) : filtradas.length === 0 ? (
          <p className="py-10 text-center text-xs text-slate-500">Nenhuma unidade encontrada.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtradas.map((l, i) => (
              <li key={`${l.bloco}-${l.numero}-${i}`} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-[#0B2545] text-white">
                    <span className="text-xs font-bold leading-none">{l.numero}</span>
                    <span className="mt-0.5 text-[10px] leading-none text-cyan-200">Bl. {l.bloco}</span>
                  </div>
                  <span className={`truncate text-sm ${l.responsavel ? 'font-semibold text-slate-900' : 'italic text-slate-400'}`}>
                    {l.responsavel ?? 'Ninguém cadastrado ainda'}
                  </span>
                </div>
                <Badge className={SITUACAO[l.situacao].cls}>{SITUACAO[l.situacao].label}</Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
