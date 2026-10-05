'use client';

import { AlertTriangle, Check } from 'lucide-react';
import type { TipoVeiculo } from '@/types';
import { TIPOS_VEICULO } from '@/lib/tiposVeiculo';

interface Props {
  /** '' = nada escolhido: nunca há opção pré-selecionada. */
  value: TipoVeiculo | '';
  onChange: (tipo: TipoVeiculo) => void;
  /** Mensagem de erro (ex.: "Escolha o tipo do veículo."). Vazio = sem erro. */
  erro?: string;
  /** Mesmo name nos três rádios (e diferente entre veículos do mesmo formulário). */
  name: string;
  /** Base dos ids; precisa ser única na página (um cartão de veículo por base). */
  idBase: string;
}

/** Id do primeiro rádio: o formulário foca nele quando o envio falha por falta do tipo. */
export const idPrimeiroTipoVeiculo = (idBase: string) => `${idBase}-${TIPOS_VEICULO[0].valor.toLowerCase()}`;

/**
 * Escolha do tipo do veículo: três botões grandes (alvo de 44px) feitos de rádios nativos,
 * então o teclado (setas, Tab) e o leitor de tela funcionam sem código extra. O selecionado
 * é marcado por cor, por um "check" e pelo próprio estado do rádio, não só pela cor.
 */
export function TipoVeiculoSelector({ value, onChange, erro, name, idBase }: Props) {
  const apoioId = `${idBase}-apoio`;
  const erroId = `${idBase}-erro`;

  return (
    // role="radiogroup" no fieldset: é o papel que aceita aria-invalid e aria-required (o radio sozinho
    // não aceita). O leitor de tela anuncia o grupo como inválido e obrigatório, e lê o erro pela descrição.
    <fieldset
      role="radiogroup"
      aria-required="true"
      aria-invalid={erro ? true : undefined}
      aria-describedby={erro ? erroId : undefined}
      className="min-w-0"
    >
      <legend className="text-xs font-semibold text-slate-700">
        Tipo do veículo <span className="font-normal text-slate-500">(obrigatório)</span>
      </legend>
      <div className="mt-1 grid grid-cols-3 gap-2">
        {TIPOS_VEICULO.map((t) => {
          const Icone = t.icone;
          return (
            <label key={t.valor} className="relative block cursor-pointer">
              <input
                id={`${idBase}-${t.valor.toLowerCase()}`}
                type="radio"
                name={name}
                value={t.valor}
                checked={value === t.valor}
                onChange={() => onChange(t.valor)}
                aria-describedby={erro ? `${apoioId} ${erroId}` : apoioId}
                className="peer sr-only"
              />
              <span
                className={`flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl border bg-white px-2 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 peer-checked:border-primary peer-checked:bg-primary peer-checked:text-white peer-checked:hover:bg-primary-hover peer-focus-visible:border-accent-strong peer-focus-visible:ring-2 peer-focus-visible:ring-accent-strong/30 ${
                  erro ? 'border-red-300' : 'border-slate-200'
                }`}
              >
                <Icone className="h-5 w-5" aria-hidden="true" />
                {t.rotulo}
              </span>
              <Check className="pointer-events-none absolute right-1.5 top-1.5 hidden h-3.5 w-3.5 text-white peer-checked:block" aria-hidden="true" />
            </label>
          );
        })}
      </div>
      <p id={apoioId} className="mt-1 text-[12px] text-slate-500">
        Escolha uma opção. Use &quot;Outro&quot; se não for carro nem moto.
      </p>
      {erro && (
        <p id={erroId} role="alert" className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-red-700">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {erro}
        </p>
      )}
    </fieldset>
  );
}
