import type { TipoVeiculo } from '@/types';
import { tipoVeiculoDe } from '@/lib/tiposVeiculo';

/**
 * Selo do tipo do veículo: ícone + texto (nunca só o ícone). "Outro" não usa cor de alerta,
 * porque é um tipo válido. Sem tipo (dado antigo de autocadastro), mostra "Tipo não informado".
 */
export function TipoVeiculoBadge({ tipo }: { tipo?: TipoVeiculo | null }) {
  const t = tipoVeiculoDe(tipo);
  const Icone = t?.icone;
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-slate-100 px-1.5 py-0.5 text-[12px] font-bold text-slate-700">
      {Icone && <Icone className="h-3.5 w-3.5" aria-hidden="true" />}
      {t ? t.rotulo : 'Tipo não informado'}
    </span>
  );
}
