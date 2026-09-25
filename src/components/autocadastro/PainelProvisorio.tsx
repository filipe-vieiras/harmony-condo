'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Hourglass, Pencil, Megaphone, Users, Car, CheckCircle2, X } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useEscapeToClose } from '@/lib/useEscapeToClose';
import { AutocadastroForm, type UnidadeOpcao } from '@/components/autocadastro/AutocadastroForm';
import type { AutocadastroDados } from '@/lib/autocadastro';

export function PainelProvisorio() {
  const { currentUser, meuAutocadastro, corrigirMeuAutocadastro } = useApp();
  const [unidades, setUnidades] = useState<UnidadeOpcao[]>([]);
  const [editando, setEditando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEscapeToClose(editando, () => setEditando(false));

  useEffect(() => {
    fetch('/api/autocadastro/meu')
      .then((r) => r.json())
      .then((body) => setUnidades(body.unidades ?? []))
      .catch(() => {});
  }, []);

  if (!currentUser) return null;

  const unidade = meuAutocadastro ? unidades.find((u) => u.id === meuAutocadastro.unitId) : undefined;
  const rotuloUnidade = unidade ? `Apto ${unidade.numero} — Bloco ${unidade.bloco}` : '…';

  const handleCorrigir = async (payload: Record<string, unknown>) => {
    const res = await corrigirMeuAutocadastro(payload as unknown as AutocadastroDados);
    if (res.success) {
      setEditando(false);
      setAviso(res.message);
    }
    return res;
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-r from-[#0B2545] via-[#134074] to-[#1D4E89] p-6 text-white shadow-lg sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Olá, {currentUser.name}</h1>
        <p className="mt-1 text-sm text-cyan-100">Bem-vindo(a) ao portal do condomínio.</p>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <Hourglass className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
        <div>
          <p className="text-sm font-bold text-amber-900">Seu cadastro está aguardando a validação do síndico</p>
          <p className="mt-1 text-xs text-amber-800">
            Enquanto isso você já acompanha o mural e a lista de unidades. Multas, reservas e veículos da sua unidade são liberados depois da validação.
          </p>
        </div>
      </div>

      {aviso && (
        <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-900">
          <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" />{aviso}</span>
          <button onClick={() => setAviso(null)} aria-label="Fechar mensagem" className="text-slate-500 hover:text-slate-700"><X className="h-4 w-4" /></button>
        </div>
      )}

      {meuAutocadastro ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Meu cadastro</h2>
              <p className="mt-0.5 text-xs text-slate-500">Confira os dados enviados. Se algo estiver errado, corrija antes da validação.</p>
            </div>
            <button onClick={() => setEditando(true)} className="flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-[#0B2545] hover:bg-slate-50">
              <Pencil className="h-3.5 w-3.5" /> Corrigir
            </button>
          </div>

          <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 text-xs sm:grid-cols-2">
            <div><dt className="text-slate-500">Unidade</dt><dd className="font-semibold text-slate-900">{rotuloUnidade}</dd></div>
            <div><dt className="text-slate-500">Vínculo</dt><dd className="font-semibold text-slate-900">{meuAutocadastro.tipo === 'PROPRIETARIO' ? 'Proprietário(a)' : 'Inquilino(a)'}</dd></div>
            <div><dt className="text-slate-500">Nome</dt><dd className="font-semibold text-slate-900">{meuAutocadastro.nome}</dd></div>
            <div><dt className="text-slate-500">Telefone</dt><dd className="font-semibold text-slate-900">{meuAutocadastro.telefone}</dd></div>
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Outros moradores</dt>
              <dd className="font-semibold text-slate-900">{meuAutocadastro.dependentes.length ? meuAutocadastro.dependentes.map((d) => d.nome).join(', ') : 'Nenhum'}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Veículos</dt>
              <dd className="font-semibold text-slate-900">
                {meuAutocadastro.veiculos.length ? (
                  <span className="flex flex-wrap gap-1.5">
                    {meuAutocadastro.veiculos.map((v) => (
                      <span key={v.placa} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5">
                        <Car className="h-3 w-3 text-slate-500" /> {v.placa} · {v.modelo}
                      </span>
                    ))}
                  </span>
                ) : 'Nenhum'}
              </dd>
            </div>
          </dl>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-xs text-slate-600 shadow-xs">
          Não encontramos o seu envio. Fale com o síndico do condomínio.
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link href="/mural" className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs transition hover:shadow-md">
          <Megaphone className="h-5 w-5 text-[#00A8E8]" />
          <span className="text-sm font-semibold text-slate-900">Mural de Avisos</span>
        </Link>
        <Link href="/moradores" className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs transition hover:shadow-md">
          <Users className="h-5 w-5 text-[#00A8E8]" />
          <span className="text-sm font-semibold text-slate-900">Lista de Unidades</span>
        </Link>
      </div>

      {editando && meuAutocadastro && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="fixed inset-0" onClick={() => setEditando(false)} />
          <div role="dialog" aria-modal="true" aria-labelledby="corrigir-titulo" className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 id="corrigir-titulo" className="text-base font-bold text-slate-900">Corrigir meu cadastro</h3>
              <button onClick={() => setEditando(false)} aria-label="Fechar" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <AutocadastroForm
              modo="correcao"
              unidades={unidades}
              inicial={meuAutocadastro}
              submitLabel="Salvar correção"
              onSubmit={handleCorrigir}
              onCancel={() => setEditando(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
