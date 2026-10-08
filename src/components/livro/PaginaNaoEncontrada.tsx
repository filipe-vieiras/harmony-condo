import React from 'react';
import Link from 'next/link';

/** Livro desligado para quem não o administra: página neutra, sem título nem frase do livro (nem confirma que ele existe). */
export function PaginaNaoEncontrada() {
  return (
    <div role="status" className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
      <h1 className="text-xl font-bold text-slate-900">Página não encontrada</h1>
      <p className="mt-2 text-sm text-slate-600">O endereço que você abriu não existe ou não está disponível.</p>
      <Link href="/" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-white hover:bg-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong">Ir para o início</Link>
    </div>
  );
}
