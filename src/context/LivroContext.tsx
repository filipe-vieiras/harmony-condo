'use client';

// Estado do Livro de reclamações para quem está logado (modo e o que a pessoa pode fazer). Quem decide é o banco
// (livro_acesso); aqui a tela só obedece: menu e rota respeitam o modo, mas esconder tela não é segurança.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { createClient } from '@/lib/supabase/client';
import { livroAcesso } from '@/lib/supabase/livro';
import type { LivroAcesso } from '@/lib/livro';

interface LivroCtx {
  acesso: LivroAcesso | null;
  /** Primeira consulta ainda em andamento. */
  carregando: boolean;
  recarregar: () => Promise<void>;
}

const Ctx = createContext<LivroCtx>({ acesso: null, carregando: true, recarregar: async () => {} });

export function LivroProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useApp();
  const [supabase] = useState(() => createClient());
  const [acesso, setAcesso] = useState<LivroAcesso | null>(null);
  const [carregando, setCarregando] = useState(true);
  const userId = currentUser?.id;

  const recarregar = useCallback(async () => {
    const r = await livroAcesso(supabase);
    setAcesso(r.ok ? r.dados : null);
    setCarregando(false);
  }, [supabase]);

  useEffect(() => {
    if (!userId) return;
    let cancelado = false;
    void (async () => {
      const r = await livroAcesso(supabase);
      if (cancelado) return;
      setAcesso(r.ok ? r.dados : null);
      setCarregando(false);
    })();
    return () => { cancelado = true; };
  }, [userId, supabase]);

  const valor = useMemo(() => ({ acesso, carregando, recarregar }), [acesso, carregando, recarregar]);
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export const useLivro = () => useContext(Ctx);
