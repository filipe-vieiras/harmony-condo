import type { AutocadastroDependente, AutocadastroVeiculo } from '@/types';

export const MAX_VEICULOS = 5;
export const MAX_DEPENDENTES = 10;

export interface AutocadastroDados {
  unitId: string;
  nome: string;
  telefone: string;
  rgCpf?: string;
  tipo: 'PROPRIETARIO' | 'INQUILINO';
  dependentes: AutocadastroDependente[];
  veiculos: AutocadastroVeiculo[];
}

export interface AutocadastroNovaConta extends AutocadastroDados {
  email: string;
  senha: string;
}

// Placa antiga (ABC1234) ou Mercosul (ABC1D23).
const PLACA_RE = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizarPlaca(placa: string): string {
  return placa.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

const texto = (v: unknown, max = 120): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/**
 * Valida e normaliza os dados do formulário. Roda no navegador (feedback
 * imediato) e de novo no servidor, que é quem decide de verdade — o corpo da
 * requisição pública pode vir de qualquer lugar.
 */
export function validarDados(body: unknown): { ok: true; dados: AutocadastroDados } | { ok: false; erro: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const unitId = texto(b.unitId, 64);
  const nome = texto(b.nome);
  const telefone = texto(b.telefone, 30);
  const rgCpf = texto(b.rgCpf, 30);
  const tipo = b.tipo === 'INQUILINO' ? 'INQUILINO' : b.tipo === 'PROPRIETARIO' ? 'PROPRIETARIO' : null;

  if (!unitId) return { ok: false, erro: 'Selecione a sua unidade.' };
  if (nome.length < 3) return { ok: false, erro: 'Informe o nome completo.' };
  if (telefone.replace(/\D/g, '').length < 10) return { ok: false, erro: 'Informe um telefone com DDD.' };
  if (!tipo) return { ok: false, erro: 'Informe se você é proprietário ou inquilino.' };

  const depsBrutos = Array.isArray(b.dependentes) ? b.dependentes : [];
  if (depsBrutos.length > MAX_DEPENDENTES) return { ok: false, erro: `No máximo ${MAX_DEPENDENTES} moradores adicionais.` };
  const dependentes: AutocadastroDependente[] = [];
  for (const d of depsBrutos) {
    const r = (d ?? {}) as Record<string, unknown>;
    const depNome = texto(r.nome);
    if (!depNome) continue;
    dependentes.push({ nome: depNome, telefone: texto(r.telefone, 30) });
  }

  const veicBrutos = Array.isArray(b.veiculos) ? b.veiculos : [];
  if (veicBrutos.length > MAX_VEICULOS) return { ok: false, erro: `No máximo ${MAX_VEICULOS} veículos.` };
  const veiculos: AutocadastroVeiculo[] = [];
  const placasVistas = new Set<string>();
  for (const v of veicBrutos) {
    const r = (v ?? {}) as Record<string, unknown>;
    const placa = normalizarPlaca(texto(r.placa, 12));
    const modelo = texto(r.modelo, 60);
    if (!placa && !modelo) continue;
    if (!PLACA_RE.test(placa)) return { ok: false, erro: `Placa inválida: "${texto(r.placa, 12)}". Use o formato ABC1234 ou ABC1D23.` };
    if (placasVistas.has(placa)) return { ok: false, erro: `A placa ${placa} foi informada duas vezes.` };
    if (!modelo) return { ok: false, erro: `Informe o modelo do veículo ${placa}.` };
    placasVistas.add(placa);
    veiculos.push({ placa, marca: texto(r.marca, 40), modelo, cor: texto(r.cor, 30) });
  }

  return { ok: true, dados: { unitId, nome, telefone, rgCpf: rgCpf || undefined, tipo, dependentes, veiculos } };
}

export function validarNovaConta(body: unknown): { ok: true; dados: AutocadastroNovaConta } | { ok: false; erro: string } {
  const base = validarDados(body);
  if (!base.ok) return base;
  const b = (body ?? {}) as Record<string, unknown>;
  const email = texto(b.email, 120).toLowerCase();
  const senha = typeof b.senha === 'string' ? b.senha : '';
  if (!EMAIL_RE.test(email)) return { ok: false, erro: 'Informe um e-mail válido.' };
  if (senha.length < 6) return { ok: false, erro: 'A senha precisa ter no mínimo 6 caracteres.' };
  if (senha.length > 72) return { ok: false, erro: 'A senha pode ter no máximo 72 caracteres.' };
  if (b.consentimento !== true) return { ok: false, erro: 'É preciso concordar com a exibição do seu nome na lista de unidades.' };
  return { ok: true, dados: { ...base.dados, email, senha } };
}
