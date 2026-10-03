import type { AutocadastroVeiculo } from '@/types';
import { tipoVeiculoDe } from '@/lib/tiposVeiculo';

/** Conteúdo do chip de veículo do autocadastro: "ABC1D23 · Moto · Onix" (ícone do tipo + texto). */
export function ChipVeiculo({ v }: { v: AutocadastroVeiculo }) {
  const t = tipoVeiculoDe(v.tipoVeiculo);
  const Icone = t?.icone;
  return (
    <>
      {Icone && <Icone className="h-3 w-3 text-slate-500" aria-hidden="true" />}
      {v.placa} · {t ? t.rotulo : 'Tipo não informado'} · {v.modelo}
    </>
  );
}
