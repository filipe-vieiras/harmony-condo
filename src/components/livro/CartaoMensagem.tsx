'use client';

// Uma mensagem do Livro (tópico ou resposta). Texto sempre como texto puro (React escapa; nada de HTML nem link clicável).
// Ações: remover (autor, ou Síndico e ADM) e "Avisar a gestão" (só avisa, não oculta nada).
import React, { useState } from 'react';
import Link from 'next/link';
import { Flag, MessageSquare, Trash2 } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SELO_DO_CARGO, tempoRelativo, type LivroAcesso, type LivroMensagem } from '@/lib/livro';
import { livroRemover, livroSinalizar } from '@/lib/supabase/livro';
import { useDialog } from '@/components/ui/DialogProvider';
import { RemoverDialog } from '@/components/livro/RemoverDialog';

interface Props {
  msg: LivroMensagem;
  acesso: LivroAcesso;
  supabase: SupabaseClient;
  /** Na lista, o texto é resumido em 3 linhas e o cartão leva à conversa. */
  resumido?: boolean;
  /** Depois de remover: a página troca só esta mensagem, sem recarregar a lista (mantém o ponto de leitura). */
  onRemovida: (id: string) => void;
}

export function CartaoMensagem({ msg, acesso, supabase, resumido, onRemovida }: Props) {
  const { confirm } = useDialog();
  const [removendo, setRemovendo] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [sinalizada, setSinalizada] = useState(msg.jaSinalizei);
  const [ocupado, setOcupado] = useState(false);

  const quando = tempoRelativo(msg.criadaEm);
  const absoluto = new Date(msg.criadaEm).toLocaleString('pt-BR');
  const selo = SELO_DO_CARGO[msg.autorPapel];
  const onde = msg.autorUnidade ? `unidade ${msg.autorUnidade}` : selo ? selo.toLowerCase() : '';
  const rotuloLeitor = `Mensagem de ${msg.autorNome}${onde ? `, ${onde}` : ''}, ${quando}`;

  const podeRemover = !msg.removida && (msg.minha || acesso.podeRemoverQualquer);
  const podeSinalizar = !msg.removida && !msg.minha && acesso.podeSinalizar;

  const removerPropria = async () => {
    const ok = await confirm({
      title: 'Apagar a sua mensagem?',
      message: 'Ela deixa de aparecer para todos. Você ainda vê o texto por 90 dias. Não dá para editar: depois é só escrever de novo.',
      confirmLabel: 'Apagar mensagem',
      destructive: true,
      loadingLabel: 'Apagando...',
      onSubmit: async () => {
        const r = await livroRemover(supabase, msg.id);
        return r.ok ? { ok: true } : { ok: false, message: r.erro };
      },
    });
    if (ok) onRemovida(msg.id);
  };

  const sinalizar = async () => {
    if (ocupado) return;
    setOcupado(true);
    const r = await livroSinalizar(supabase, msg.id);
    setOcupado(false);
    if (!r.ok) { setAviso({ tipo: 'erro', texto: r.erro }); return; }
    setSinalizada(true);
    setAviso({ tipo: 'ok', texto: r.dados.jaAvisado ? 'Já avisado. A gestão recebeu o aviso.' : 'A gestão foi avisada. Nada foi ocultado.' });
  };

  const textoRemovida = msg.removidaPor === 'AUTOR'
    ? (msg.minha ? 'Você removeu esta mensagem' : 'Mensagem removida pelo autor')
    : (msg.minha ? 'Sua mensagem foi removida pela gestão' : 'Mensagem removida pela gestão');

  return (
    <article aria-label={rotuloLeitor} className={`rounded-2xl border bg-white p-4 shadow-xs ${msg.minha ? 'border-accent-200' : 'border-slate-200'}`}>
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="break-words text-sm font-bold text-slate-900">{msg.autorNome}</span>
        {selo ? (
          <span className="rounded-full bg-accent-100 px-2.5 py-0.5 text-[12px] font-bold text-accent-800">{selo}</span>
        ) : msg.autorUnidade ? (
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[12px] font-bold text-slate-700">Unidade {msg.autorUnidade}</span>
        ) : null}
        {msg.minha && <span className="rounded-full bg-primary px-2.5 py-0.5 text-[12px] font-bold text-white">Você</span>}
        <time dateTime={msg.criadaEm} title={absoluto} className="text-sm text-slate-600">{quando}</time>
      </header>

      {msg.removida ? (
        <div role="note" className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-sm italic text-slate-700">
          {textoRemovida}
          {msg.textoOriginal !== null && (
            <details className="mt-2 not-italic">
              <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-accent-strong">Ver o texto removido</summary>
              <p className="mt-1 text-xs text-slate-600">Só o autor e a gestão veem este texto, por 90 dias.</p>
              <p className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-white p-3 text-base text-slate-800">{msg.textoOriginal}</p>
            </details>
          )}
        </div>
      ) : (
        <p className={`mt-3 whitespace-pre-wrap break-words text-base text-slate-800 ${resumido ? 'line-clamp-3' : ''}`}>{msg.texto}</p>
      )}

      {msg.citados.length > 0 && (
        <p className="mt-3 flex flex-wrap items-center gap-1.5 text-sm text-slate-600">
          <span>Citou:</span>
          {msg.citados.map((c) => (
            <span key={`${c.tipo}-${c.rotulo}`} className="rounded-full bg-accent-50 px-2.5 py-0.5 text-[12px] font-semibold text-accent-900">{c.rotulo}</span>
          ))}
        </p>
      )}

      <footer className="mt-3 flex flex-wrap items-center gap-2">
        {resumido && (
          <Link href={`/livro/${msg.id}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent-50 px-3.5 text-sm font-semibold text-accent-900 transition hover:bg-accent-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong">
            <MessageSquare className="h-4 w-4" aria-hidden="true" />
            {msg.nRespostas === 0 ? 'Abrir conversa' : msg.nRespostas === 1 ? 'Ver conversa (1 resposta)' : `Ver conversa (${msg.nRespostas} respostas)`}
          </Link>
        )}
        {podeSinalizar && (
          <button type="button" onClick={sinalizar} disabled={sinalizada || ocupado} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong disabled:opacity-60">
            <Flag className="h-4 w-4" aria-hidden="true" /> {sinalizada ? 'Gestão avisada' : 'Avisar a gestão'}
          </button>
        )}
        {podeRemover && (
          <button
            type="button"
            onClick={() => (msg.minha ? void removerPropria() : setRemovendo(true))}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium text-red-700 transition hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" /> {msg.minha ? 'Apagar' : 'Remover'}
          </button>
        )}
      </footer>

      {aviso && <p role={aviso.tipo === 'erro' ? 'alert' : 'status'} className={`mt-2 text-sm ${aviso.tipo === 'erro' ? 'text-red-700' : 'text-slate-700'}`}>{aviso.texto}</p>}

      {removendo && (
        <RemoverDialog
          onFechar={() => setRemovendo(false)}
          onConfirmar={async (motivo) => {
            const r = await livroRemover(supabase, msg.id, motivo);
            if (!r.ok) return r.erro;
            setRemovendo(false);
            onRemovida(msg.id);
            return null;
          }}
        />
      )}
    </article>
  );
}
