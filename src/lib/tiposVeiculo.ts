import { Bike, Car, CircleHelp, type LucideIcon } from 'lucide-react';
import type { TipoVeiculo } from '@/types';

/**
 * Fonte única dos tipos de veículo (issue #43): seletor, selo, filtro, planilha e
 * relatórios leem daqui. A ordem é a de exibição: Carro, Moto, Outro.
 */
export const TIPOS_VEICULO: { valor: TipoVeiculo; rotulo: string; plural: string; icone: LucideIcon }[] = [
  { valor: 'CARRO', rotulo: 'Carro', plural: 'Carros', icone: Car },
  { valor: 'MOTO', rotulo: 'Moto', plural: 'Motos', icone: Bike },
  { valor: 'OUTRO', rotulo: 'Outro', plural: 'Outros', icone: CircleHelp },
];

export function ehTipoVeiculo(v: unknown): v is TipoVeiculo {
  return v === 'CARRO' || v === 'MOTO' || v === 'OUTRO';
}

export function tipoVeiculoDe(v: unknown) {
  return TIPOS_VEICULO.find((t) => t.valor === v);
}
