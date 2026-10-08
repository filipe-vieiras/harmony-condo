'use client';

// Regras de uso do Livro e a ciência única ("Li as regras"), exigida pelo banco antes da primeira mensagem.
import React, { useState } from 'react';
import { Loader2, ScrollText } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { REGRAS_DE_USO } from '@/lib/livro';
import { livroDarCiencia } from '@/lib/supabase/livro';

export function ListaDeRegras() {
  return (
    <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-700">
      {REGRAS_DE_USO.map((r) => <li key={r}>{r}</li>)}
    </ul>
  );
}

export function CienciaDasRegras({ supabase, onAceito }: { supabase: SupabaseClient; onAceito: () => void }) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const aceitar = async () => {
    if (enviando) return;
    setEnviando(true);
    setErro(null);
    const r = await livroDarCiencia(supabase);
    setEnviando(false);
    if (!r.ok) { setErro(r.erro); return; }
    onAceito();
  };

  return (
    <section aria-labelledby="regras-titulo" className="space-y-3 rounded-2xl border border-accent-200 bg-accent-50 p-4">
      <h2 id="regras-titulo" className="flex items-center gap-2 text-base font-bold text-slate-900">
        <ScrollText className="h-5 w-5 text-accent-strong" aria-hidden="true" /> Antes de escrever, leia as regras
      </h2>
      <ListaDeRegras />
      {erro && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{erro}</p>}
      <button
        type="button"
        onClick={aceitar}
        disabled={enviando}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white transition hover:bg-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong focus-visible:ring-offset-2 disabled:opacity-60"
      >
        {enviando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        Li as regras
      </button>
    </section>
  );
}
