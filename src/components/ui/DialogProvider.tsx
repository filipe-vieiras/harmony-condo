'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  /** Pinta o botão de confirmação de vermelho (exclusões e ações irreversíveis). */
  destructive?: boolean;
}

interface ReasonOptions extends ConfirmOptions {
  label?: string;
  placeholder?: string;
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
  const [text, setText] = useState('');
  const textRef = useRef<HTMLTextAreaElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancel = () => onClose(isReason ? null : false);

  useEffect(() => {
    (isReason ? textRef.current : confirmRef.current)?.focus();
  }, [isReason]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose(isReason ? null : false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isReason, onClose]);

  const canConfirm = !isReason || text.trim().length > 0;
  const confirmClasses = options.destructive || isReason
    ? 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-500/40'
    : 'bg-[#0B2545] hover:bg-[#134074] focus-visible:ring-[#00A8E8]/40';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 no-print">
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={cancel} />
      <form
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby={options.message ? 'dialog-message' : undefined}
        onSubmit={(e) => {
          e.preventDefault();
          if (canConfirm) onClose(isReason ? text.trim() : true);
        }}
        className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          {(options.destructive || isReason) && (
            <div className="mt-0.5 rounded-xl bg-red-100 p-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
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
              {active.options.label ?? 'Motivo'}
            </label>
            <textarea
              id="dialog-reason"
              ref={textRef}
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={active.options.placeholder ?? 'Explique o motivo para o morador'}
              className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
            />
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={cancel}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8]/40"
          >
            Cancelar
          </button>
          <button
            type="submit"
            ref={confirmRef}
            disabled={!canConfirm}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 ${confirmClasses}`}
          >
            {options.confirmLabel ?? (options.destructive ? 'Excluir' : 'Confirmar')}
          </button>
        </div>
      </form>
    </div>
  );
}
