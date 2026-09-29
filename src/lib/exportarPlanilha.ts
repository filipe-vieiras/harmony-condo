import type { CellObject, Row } from 'write-excel-file/browser';
import type { Autocadastro, ConviteStatus, Unit, Vehicle } from '@/types';

// Exportação de moradores e veículos para .xlsx (uma aba para cada). Roda no
// navegador com os dados que o admin já tem carregados — a RLS garante que só
// Síndico, Subsíndico e ADM enxergam todas as unidades e veículos.

type Linha = Row;

const OCUPACAO: Record<Unit['tipoOcupacao'], string> = {
  PROPRIETARIO: 'Proprietário',
  INQUILINO: 'Inquilino',
  DESOCUPADO: 'Desocupado',
};

const VINCULO = {
  TITULAR: 'Titular',
  DEPENDENTE: 'Dependente',
  INQUILINO: 'Inquilino',
} as const;

const CONVITE: Record<ConviteStatus, string> = {
  NAO_ENVIADO: 'Não enviado',
  PENDENTE: 'Pendente',
  ENVIADO: 'Convite enviado',
  ATIVO: 'Ativo',
};

// Texto forçado ("@"): sem isso o Excel converte telefone, CPF e "0101" em número.
const texto = (v?: string | null): CellObject | null => {
  const valor = v?.trim();
  return valor ? { value: valor, type: String, format: '@' } : null;
};

const cabecalho = (titulos: string[]): Linha =>
  titulos.map((t): CellObject => ({ value: t, fontWeight: 'bold', backgroundColor: '#0B2545', textColor: '#FFFFFF' }));

function ordenarUnidades<T extends { bloco: string; numero: string }>(lista: T[]): T[] {
  return [...lista].sort(
    (a, b) => a.bloco.localeCompare(b.bloco) || a.numero.localeCompare(b.numero, undefined, { numeric: true })
  );
}

export function montarAbaMoradores(units: Unit[], autocadastros: Autocadastro[]): Linha[] {
  const linhas: Linha[] = [
    cabecalho(['Bloco', 'Apto', 'Ocupação', 'Nome', 'Vínculo', 'Situação', 'Telefone', 'E-mail', 'CPF/RG', 'Acesso ao portal', 'Vagas', 'Animais', 'Observações']),
  ];

  for (const u of ordenarUnidades(units)) {
    const base = (nome: string | null, vinculo: string, situacao: string, extra: { telefone?: string; email?: string; rgCpf?: string; convite?: string } = {}): Linha => [
      texto(u.bloco),
      texto(u.numero),
      texto(OCUPACAO[u.tipoOcupacao]),
      texto(nome),
      texto(vinculo),
      texto(situacao),
      texto(extra.telefone),
      texto(extra.email),
      texto(extra.rgCpf),
      texto(extra.convite),
      texto(u.vagasGaragem?.join(', ')),
      texto(u.animais),
      texto(u.observacoes),
    ];

    const moradores = u.moradores ?? [];
    const pendentes = autocadastros.filter((a) => a.unitId === u.id && a.status === 'AGUARDANDO');
    let temLinha = false;

    for (const m of moradores) {
      const prioritario = m.tipo === 'TITULAR' || m.tipo === 'INQUILINO';
      linhas.push(base(m.nome, VINCULO[m.tipo], 'Validado', {
        telefone: m.telefone,
        email: m.email,
        rgCpf: m.rgCpf,
        convite: prioritario ? CONVITE[u.statusConvite ?? 'NAO_ENVIADO'] : undefined,
      }));
      temLinha = true;
    }

    // Proprietário que não mora na unidade (alugada). Quando o formulário não
    // informou o dono, proprietarioNome repete o inquilino — não duplica.
    const nomesMoradores = new Set(moradores.map((m) => m.nome.trim().toLowerCase()));
    if (u.tipoOcupacao === 'INQUILINO' && u.proprietarioNome && !nomesMoradores.has(u.proprietarioNome.trim().toLowerCase())) {
      linhas.push(base(u.proprietarioNome, 'Proprietário (não reside)', 'Validado', {
        telefone: u.proprietarioTelefone,
        email: u.proprietarioEmail,
      }));
      temLinha = true;
    }

    // Envios do formulário que o síndico ainda não validou.
    for (const a of pendentes) {
      linhas.push(base(a.nome, a.tipo === 'PROPRIETARIO' ? 'Titular' : 'Inquilino', 'Aguardando validação', {
        telefone: a.telefone,
        email: a.email,
        rgCpf: a.rgCpf,
      }));
      for (const d of a.dependentes) {
        linhas.push(base(d.nome, 'Dependente', 'Aguardando validação', { telefone: d.telefone }));
      }
      temLinha = true;
    }

    if (!temLinha) linhas.push(base(null, '', 'Sem cadastro'));
  }

  return linhas;
}

export function montarAbaVeiculos(vehicles: Vehicle[], units: Unit[], autocadastros: Autocadastro[]): Linha[] {
  const linhas: Linha[] = [
    cabecalho(['Bloco', 'Apto', 'Placa', 'Marca', 'Modelo', 'Cor', 'Vaga', 'Responsável', 'Telefone', 'Tipo', 'Situação']),
  ];

  type Item = { bloco: string; numero: string; linha: Linha };
  const itens: Item[] = [];
  const unitPorId = new Map(units.map((u) => [u.id, u]));

  for (const v of vehicles) {
    // Prefere a unidade pelo vínculo (FK); o texto bloco/unidade é só fallback.
    const u = v.unitId ? unitPorId.get(v.unitId) : undefined;
    const bloco = u?.bloco ?? v.bloco;
    const numero = u?.numero ?? v.unidade;
    itens.push({
      bloco,
      numero,
      linha: [
        texto(bloco), texto(numero), texto(v.placa), texto(v.marca), texto(v.modelo), texto(v.cor),
        texto(v.vaga), texto(v.proprietarioNome), texto(v.telefoneContato),
        texto(v.status === 'VISITANTE' ? 'Visitante' : 'Morador'), texto('Validado'),
      ],
    });
  }

  for (const a of autocadastros) {
    if (a.status !== 'AGUARDANDO') continue;
    const u = unitPorId.get(a.unitId);
    if (!u) continue;
    for (const v of a.veiculos) {
      itens.push({
        bloco: u.bloco,
        numero: u.numero,
        linha: [
          texto(u.bloco), texto(u.numero), texto(v.placa), texto(v.marca), texto(v.modelo), texto(v.cor),
          texto(null), texto(a.nome), texto(a.telefone), texto('Morador'), texto('Aguardando validação'),
        ],
      });
    }
  }

  for (const i of ordenarUnidades(itens)) linhas.push(i.linha);
  return linhas;
}

export async function baixarPlanilhaMoradoresVeiculos(units: Unit[], vehicles: Vehicle[], autocadastros: Autocadastro[]) {
  // Import dinâmico: a biblioteca só é baixada quando alguém exporta.
  const { default: writeExcelFile } = await import('write-excel-file/browser');

  const moradores = montarAbaMoradores(units, autocadastros);
  const veiculos = montarAbaVeiculos(vehicles, units, autocadastros);
  const hoje = new Date().toISOString().slice(0, 10);

  await writeExcelFile([
    {
      data: moradores,
      sheet: 'Moradores',
      stickyRowsCount: 1,
      columns: [{ width: 7 }, { width: 7 }, { width: 13 }, { width: 30 }, { width: 24 }, { width: 20 }, { width: 17 }, { width: 30 }, { width: 16 }, { width: 16 }, { width: 14 }, { width: 18 }, { width: 30 }],
    },
    {
      data: veiculos,
      sheet: 'Veículos',
      stickyRowsCount: 1,
      columns: [{ width: 7 }, { width: 7 }, { width: 10 }, { width: 14 }, { width: 16 }, { width: 12 }, { width: 12 }, { width: 30 }, { width: 17 }, { width: 10 }, { width: 20 }],
    },
  ], { fontFamily: 'Calibri', fontSize: 11 }).toFile(`harmony-moradores-veiculos-${hoje}.xlsx`);

  return {
    moradores: moradores.length - 1,
    veiculos: veiculos.length - 1,
  };
}
