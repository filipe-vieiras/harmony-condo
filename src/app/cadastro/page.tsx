'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { AutocadastroForm, type UnidadeOpcao } from '@/components/autocadastro/AutocadastroForm';
import { Loader2, Lock, CheckCircle2 } from 'lucide-react';

type Estado = { tipo: 'carregando' } | { tipo: 'fechado' } | { tipo: 'aberto'; unidades: UnidadeOpcao[] } | { tipo: 'concluido' };

export default function CadastroPage() {
  const [supabase] = useState(() => createClient());
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' });

  useEffect(() => {
    fetch('/api/autocadastro/publico')
      .then((r) => r.json())
      .then((body) => setEstado(body.aberto ? { tipo: 'aberto', unidades: body.unidades ?? [] } : { tipo: 'fechado' }))
      .catch(() => setEstado({ tipo: 'fechado' }));
  }, []);

  const handleSubmit = async (payload: Record<string, unknown>) => {
    let response: Response;
    try {
      response = await fetch('/api/autocadastro/publico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      return { success: false, message: 'Sem conexão. Verifique sua internet e tente novamente.' };
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return { success: false, message: body.error ?? 'Não foi possível concluir o cadastro.' };

    setEstado({ tipo: 'concluido' });
    const { error } = await supabase.auth.signInWithPassword({ email: payload.email as string, password: payload.senha as string });
    // Se o login automático falhar, a conta já existe: o morador entra pela tela de login.
    window.location.href = error ? '/login' : '/';
    return { success: true, message: '' };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#07162c] via-[#0B2545] to-[#134074] px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex flex-col items-center text-center">
          <Image src="/images/logo.png" alt="Harmony Residence" width={562} height={508} preload className="h-20 w-auto rounded-2xl object-contain shadow-2xl ring-1 ring-white/20" />
          <h1 className="mt-5 text-2xl font-bold tracking-tight text-white">Cadastro de Moradores</h1>
          <p className="mt-2 max-w-md text-sm text-cyan-100/90">
            Preencha os dados da sua unidade. Você entra no portal na hora; o acesso completo é liberado depois que o síndico confirmar o cadastro.
          </p>
        </div>

        <div className="mt-6 rounded-3xl border border-white/10 bg-white p-5 shadow-2xl sm:p-8">
          {estado.tipo === 'carregando' && (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-[#0B2545]" /></div>
          )}

          {estado.tipo === 'fechado' && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700"><Lock className="h-6 w-6" /></div>
              <p className="text-sm font-semibold text-slate-900">O cadastro pelo link está fechado</p>
              <p className="max-w-sm text-xs text-slate-500">Fale com o síndico do condomínio para receber o seu acesso.</p>
              <a href="/login" className="mt-1 text-xs font-medium text-[#0A6E9C] hover:underline">Já tenho cadastro — entrar</a>
            </div>
          )}

          {estado.tipo === 'aberto' && (
            estado.unidades.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-600">Nenhuma unidade disponível ainda. Fale com o síndico.</p>
            ) : (
              <>
                <AutocadastroForm modo="novo" unidades={estado.unidades} submitLabel="Enviar cadastro e entrar" onSubmit={handleSubmit} />
                <p className="mt-5 text-center text-xs text-slate-500">
                  Já tem cadastro? <a href="/login" className="font-medium text-[#0A6E9C] hover:underline">Entrar</a>
                </p>
              </>
            )
          )}

          {estado.tipo === 'concluido' && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><CheckCircle2 className="h-6 w-6" /></div>
              <p className="text-sm font-semibold text-slate-900">Cadastro enviado!</p>
              <p className="text-xs text-slate-500">Entrando no portal...</p>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-cyan-100/70">Harmony Residence • Sistema Operacional e Convivência Digital</p>
      </div>
    </div>
  );
}
