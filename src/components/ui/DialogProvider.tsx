'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Ban, Loader2 } from 'lucide-react';
import { useModalFocus } from '@/lib/useModalFocus';

/** Resultado de uma ação assíncrona feita dentro do diálogo: erro mantém o diálogo aberto. */
export type DialogSubmitResult = { ok: true } | { ok: false; message: string };

interface BaseOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  /** Rótulo do botão neutro (padrão "Cancelar"). Use "Voltar" quando a ação confirmada já se chama "Cancelar ...". */
  cancelLabel?: string;
  /**
   * Pinta o botão de confirmação de vermelho (exclusões e ações irreversíveis) e, no confirm,
   * põe o foco inicial em "Voltar" para que Enter não confirme sem querer. No pedido de motivo,
   * ausente = julgamento de recurso de sempre (vermelho); `false` = ação séria que não apaga
   * (botão na cor primária e ícone neutro).
   */
  destructive?: boolean;
  /** Texto do botão de confirmação enquanto `onSubmit` roda (ex.: "Apagando…"). */
  loadingLabel?: string;
}

interface ConfirmOptions extends BaseOptions {
  /**
   * Ação confirmada, feita com o diálogo aberto: ele mostra "carregando" (trava botões e Esc) e,
   * se falhar, continua aberto com a mensagem de erro. Sem isso, o diálogo só devolve o resultado.
   */
  onSubmit?: () => Promise<DialogSubmitResult>;
}

interface ReasonOptions extends BaseOptions {
  label?: string;
  placeholder?: string;
  /**
   * Com `minLength`, o botão NÃO fica desabilitado: confirmar com texto curto mostra
   * `requiredMessage` ao lado do campo e devolve o foco a ele. Sem `minLength`, vale o
   * comportamento antigo (botão desabilitado até haver texto).
   */
  minLength?: number;
  maxLength?: number;
  requiredMessage?: string;
  /** Apoio abaixo do campo, ligado por aria-describedby (ex.: quem vai ler o texto). */
  helperText?: string;
  /** Mesma ideia do `onSubmit` do confirm, recebendo o texto já sem espaços nas pontas. */
  onSubmit?: (texto: string) => Promise<DialogSubmitResult>;
}

interface DialogApi {
  /** Resolve `true` se o usuário confirmou, `false` se cancelou. */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  /** Resolve o texto informado (obrigatório) ou `null` se o usuário cancelou. */
  askReason: (options: ReasonOptions) => Promise<string | null>;
}

type ActiveDialog =
  | { kind: 'confirm'; options: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: 'reason'; options: ReasonOptions; resolve: (v: string | null) => void };

const DialogContext = createContext<DialogApi | null>(null);

export function useDialog(): DialogApi {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog deve ser usado dentro de <DialogProvider>');
  return ctx;
}

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<ActiveDialog | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setActive({ kind: 'confirm', options, resolve })),
    []
  );

  const askReason = useCallback(
    (options: ReasonOptions) =>
      new Promise<string | null>((resolve) => setActive({ kind: 'reason', options, resolve })),
    []
  );

  const close = useCallback(
    (result: boolean | string | null) => {
      if (!active) return;
      if (active.kind === 'confirm') active.resolve(result === true);
      else active.resolve(typeof result === 'string' ? result : null);
      setActive(null);
    },
    [active]
  );

  return (
    <DialogContext.Provider value={{ confirm, askReason }}>
      {children}
      {active && <DialogView key={active.kind + active.options.title} active={active} onClose={close} />}
    </DialogContext.Provider>
  );
}

function DialogView({
  active,
  onClose,
}: {
  active: ActiveDialog;
  onClose: (result: boolean | string | null) => void;
}) {
  const { options } = active;
  const isReason = active.kind === 'reason';
  const reasonOpts = isReason ? (active.options as ReasonOptions) : null;
  const [text, setText] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const cancel = () => {
    if (!carregando) onClose(isReason ? null : false);
  };

  const minLength = reasonOpts?.minLength;
  // Pedido de motivo sem `destructive` é o julgamento de recurso (vermelho); `false` é a anulação.
  const vermelho = isReason ? options.destructive !== false : !!options.destructive;
  // Só o diálogo que apaga começa em "Voltar"; os outros confirmam com Enter como sempre.
  const focoNoVoltar = !isReason && !!options.destructive;
  const trimmed = text.trim();
  const validaNoClique = minLength !== undefined;

  // Antes do foco inicial abaixo: ele guarda quem abriu o diálogo e prende o Tab.
  useModalFocus(true);

  useEffect(() => {
    (isReason ? textRef.current : focoNoVoltar ? cancelRef.current : confirmRef.current)?.focus();
  }, [isReason, focoNoVoltar]);

  // Depois de um erro (texto curto ou falha ao enviar) o foco volta ao ponto de correção.
  useEffect(() => {
    if (!erro || carregando) return;
    (isReason ? textRef.current : cancelRef.current)?.focus();
  }, [erro, carregando, isReason]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !carregando) onClose(isReason ? null : false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isReason, onClose, carregando]);

  const confirmar = async () => {
    if (carregando) return;
    if (isReason) {
      const curto = validaNoClique ? trimmed.length < minLength! : trimmed.length === 0;
      if (curto) {
        setErro(reasonOpts?.requiredMessage ?? 'Escreva o motivo para continuar.');
        textRef.current?.focus();
        return;
      }
    }
    const submit = options.onSubmit as ((texto: string) => Promise<DialogSubmitResult>) | undefined;
    if (submit) {
      setCarregando(true);
      setErro(null);
      let res: DialogSubmitResult;
      try {
        res = await submit(trimmed);
      } catch {
        res = { ok: false, message: 'Não foi possível concluir. Tente de novo.' };
      }
      if (!res.ok) {
        setCarregando(false);
        setErro(res.message);
        return;
      }
    }
    onClose(isReason ? trimmed : true);
  };

  const canConfirm = !isReason || validaNoClique || trimmed.length > 0;
  const confirmClasses = vermelho
    ? 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-500/40'
    : 'bg-primary hover:bg-primary-hover focus-visible:ring-accent/40';
  const mostraIcone = vermelho || isReason || !!options.destructive;
  const max = reasonOpts?.maxLength;
  const abaixoDoMinimo = minLength !== undefined && trimmed.length < minLength;
  const descritoPor = ['dialog-reason-help', erro && isReason ? 'dialog-reason-erro' : null].filter(Boolean).join(' ');

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 no-print">
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={cancel} />
      <form
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby={options.message ? 'dialog-message' : undefined}
        aria-busy={carregando}
        onSubmit={(e) => {
          e.preventDefault();
          // Diálogo que apaga: só o clique no botão de confirmar vale, nunca um Enter solto.
          const origem = (e.nativeEvent as SubmitEvent).submitter;
          if (focoNoVoltar && origem !== confirmRef.current) return;
          void confirmar();
        }}
        className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          {mostraIcone && (
            <div className={`mt-0.5 rounded-xl p-2 ${vermelho ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'}`}>
              {vermelho ? <AlertTriangle className="h-5 w-5" /> : <Ban className="h-5 w-5" />}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 id="dialog-title" className="text-base font-bold text-slate-900">
              {options.title}
            </h2>
            {options.message && (
              <p id="dialog-message" className="mt-1 text-sm text-slate-600">
                {options.message}
              </p>
            )}
          </div>
        </div>

        {isReason && (
          <div className="mt-4">
            <label htmlFor="dialog-reason" className="block text-sm font-semibold text-slate-700">
              {reasonOpts?.label ?? 'Motivo'}
            </label>
            <textarea
              id="dialog-reason"
              ref={textRef}
              rows={3}
              value={text}
              maxLength={max}
              disabled={carregando}
              aria-invalid={erro ? true : undefined}
              aria-describedby={descritoPor || undefined}
              onChange={(e) => {
                setText(e.target.value);
                if (erro) setErro(null);
              }}
              placeholder={reasonOpts?.placeholder ?? 'Explique o motivo para o morador'}
              className={`mt-1 block w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 disabled:bg-slate-50 disabled:text-slate-600 ${
                erro
                  ? 'border-red-300 focus:border-red-400 focus:ring-red-300/40'
                  : 'border-slate-200 focus:border-accent-strong focus:ring-accent-strong/30'
              }`}
            />
            {(reasonOpts?.helperText || max !== undefined) && (
              <div className="mt-1 flex items-start justify-between gap-3 text-xs text-slate-600">
                <p id="dialog-reason-help">{reasonOpts?.helperText}</p>
                {max !== undefined && (
                  <span className="shrink-0 tabular-nums" aria-hidden="true">
                    {trimmed.length}/{abaixoDoMinimo ? minLength : max}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {erro && (
          <p id="dialog-reason-erro" role="alert" className="mt-3 text-xs font-semibold text-red-700">
            {erro}
          </p>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            ref={cancelRef}
            onClick={cancel}
            disabled={carregando}
            className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {options.cancelLabel ?? 'Cancelar'}
          </button>
          <button
            type="submit"
            ref={confirmRef}
            disabled={!canConfirm || carregando}
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 ${confirmClasses}`}
          >
            {carregando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            <span>
              {carregando
                ? (options.loadingLabel ?? 'Aguarde…')
                : (options.confirmLabel ?? (options.destructive ? 'Excluir' : 'Confirmar'))}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}
