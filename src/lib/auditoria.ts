// Texto legível para a trilha de auditoria (tela de Relatórios). Só apresentação:
// nada daqui é gravado. Sem dependências de runtime para a bateria de QA poder importar.

export type DetalhesAuditoria = Record<string, unknown> | null | undefined;

export interface AuditoriaLegivel {
  /** Frase em português que resume o que aconteceu. */
  frase: string;
  /** Pares "chave: valor" legíveis, só quando a ação não é conhecida (sem ids). */
  detalhes: string[];
  /** Ids e dados técnicos, para o "Detalhes técnicos" recolhido. */
  tecnicos: { chave: string; valor: string }[];
}

export const ROTULOS_MODULO: Record<string, string> = {
  UNIDADES: 'Unidades',
  RESERVAS: 'Reservas',
  MULTAS: 'Multas',
  ESPACOS: 'Espaços',
  DOCUMENTOS: 'Documentos',
  SISTEMA: 'Sistema',
};

const ROTULOS_CHAVE: Record<string, string> = {
  espaco: 'Espaço',
  unidade: 'Unidade',
  bloco: 'Bloco',
  protocolo: 'Protocolo',
  valor: 'Valor',
  aprovado: 'Aprovado',
  deferido: 'Deferido',
  motivoRecusa: 'Motivo da recusa',
  resposta: 'Justificativa',
  nome: 'Nome',
  titulo: 'Título',
  email: 'E-mail',
  role: 'Perfil',
  proprietario: 'Proprietário',
  taxaLimpeza: 'Taxa de limpeza',
};

const STATUS_DA_MULTA: Record<string, string> = {
  PENDENTE_CIENCIA: 'aguardando ciência',
  CIENCIA_REGISTRADA: 'com ciência registrada',
  EM_RECURSO: 'em recurso',
  RECURSO_DEFERIDO: 'com recurso deferido',
  RECURSO_INDEFERIDO: 'com recurso indeferido',
  CONCLUIDA: 'encerrada',
  ANULADA: 'anulada',
};

// "id", "reservationId", "fineId", "unitId", "contaId", "usuario_id"…
const ehChaveTecnica = (chave: string) => /^id$/i.test(chave) || /(Id|_id|Ids|_ids)$/.test(chave);

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function texto(valor: unknown): string {
  if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não';
  if (typeof valor === 'string') return valor;
  if (typeof valor === 'number') return String(valor);
  return JSON.stringify(valor);
}

const str = (v: unknown): string => (typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '');

function rotuloUnidade(d: Record<string, unknown>): string {
  const unidade = str(d.unidade);
  const bloco = str(d.bloco);
  if (!unidade) return '';
  return bloco ? `unidade ${unidade}, bloco ${bloco}` : `unidade ${unidade}`;
}

/** "Multa NOT-2026/004" (ou "Notificação" quando não há protocolo gravado). */
function multa(d: Record<string, unknown>): string {
  const p = str(d.protocolo);
  return p ? `Multa ${p}` : 'Multa';
}

/**
 * Transforma um registro de auditoria em frase legível. Ações conhecidas ganham
 * uma frase própria; as demais mostram o texto da ação e uma lista "chave: valor"
 * sem ids. Ids e objetos aninhados vão sempre para `tecnicos`.
 */
export function descreverAuditoria(acao: string, detalhesBrutos: DetalhesAuditoria): AuditoriaLegivel {
  const d: Record<string, unknown> = detalhesBrutos && typeof detalhesBrutos === 'object' ? detalhesBrutos : {};
  const entradas = Object.entries(d).filter(([, v]) => v !== null && v !== undefined && v !== '');

  const tecnicos = entradas
    .filter(([k, v]) => ehChaveTecnica(k) || (typeof v === 'object'))
    .map(([chave, v]) => ({ chave, valor: texto(v) }));

  let frase: string | null = null;

  if (/^(Aprovou|Recusou) reserva de /.test(acao)) {
    const espaco = str(d.espaco) || acao.replace(/^(Aprovou|Recusou) reserva de /, '');
    const aprovada = acao.startsWith('Aprovou');
    const un = rotuloUnidade(d);
    frase = `Reserva de ${espaco}${un ? `, ${un}` : ''}: ${aprovada ? 'aprovada' : 'recusada'}.`;
    const motivo = str(d.motivoRecusa);
    if (!aprovada && motivo) frase += ` Motivo: ${motivo}`;
  } else if (/^Reserva confirmada automaticamente/.test(acao)) {
    // Gravado pelo banco (0034) quando o espaço não exige aprovação: sem nome de pessoa.
    const espaco = str(d.espaco) || 'espaço';
    const un = rotuloUnidade(d);
    frase = `Reserva de ${espaco}${un ? `, ${un}` : ''}: confirmada automaticamente (o espaço não exige aprovação).`;
  } else if (/^Emitiu notificação\/multa /.test(acao)) {
    const protocolo = str(d.protocolo) || acao.replace('Emitiu notificação/multa ', '');
    const valor = typeof d.valor === 'number' ? d.valor : d.valor == null || d.valor === '' ? NaN : Number(d.valor);
    const advertencia = Number.isFinite(valor) && valor === 0;
    const un = rotuloUnidade(d);
    frase = `${advertencia ? 'Advertência' : 'Multa'} ${protocolo} emitida${un ? ` para a ${un}` : ''}`;
    if (Number.isFinite(valor) && valor > 0) frase += ` (${brl.format(valor).replace(/ /g, ' ')})`;
    frase += '.';
  } else if (/^Registrou ciência/.test(acao)) {
    frase = `${multa(d)}: ciência registrada.`;
  } else if (/^Interpôs recurso/.test(acao)) {
    frase = `${multa(d)}: recurso interposto.`;
  } else if (/^(Deferiu|Indeferiu) recurso/.test(acao)) {
    const deferido = acao.startsWith('Deferiu');
    frase = `${multa(d)}: recurso ${deferido ? 'deferido (multa anulada)' : 'indeferido (multa mantida)'}.`;
    const resposta = str(d.resposta);
    if (resposta) frase += ` Justificativa: ${resposta}`;
  } else if (/^Anulou multa/.test(acao)) {
    // Gravado pelo banco (0029). O texto do motivo é do síndico/ADM e o morador também lê.
    const un = rotuloUnidade(d);
    frase = `${multa(d)}${un ? ` (${un})` : ''} anulada.`;
    const motivo = str(d.motivo);
    if (motivo) frase += ` Motivo: ${motivo}`;
  } else if (/^Apagou multa/.test(acao)) {
    // Sem motivo e sem dados do morador, de propósito: só qual multa era e em que estado estava.
    const un = rotuloUnidade(d);
    const valor = typeof d.valor === 'number' ? d.valor : d.valor == null || d.valor === '' ? NaN : Number(d.valor);
    const tipo = d.tipo === 'ADVERTENCIA' || valor === 0 ? 'advertência' : Number.isFinite(valor) ? `multa de ${brl.format(valor).replace(/ /g, ' ')}` : 'multa';
    const estado = STATUS_DA_MULTA[str(d.statusAnterior)];
    const partes = [un, tipo, estado ? `estava ${estado}` : ''].filter(Boolean).join(', ');
    frase = `${multa(d)}${partes ? ` (${partes})` : ''} apagada.`;
  } else if (/^Alterou um veículo da unidade /.test(acao)) {
    // Gravado pelo banco (0031); a acao já é a frase completa (quais campos mudaram), sem placa.
    // O de-para (placa antiga e nova, marca, cor...) fica em `alteracoes`, nos detalhes técnicos.
    frase = `${acao}.`;
  } else if (/^Removeu um veículo da unidade /.test(acao)) {
    // Gravado pelo banco (0036); a acao já é a frase completa, sem placa.
    frase = `${acao}.`;
  } else if (/^Alterou o tipo de um veículo/.test(acao)) {
    // Gravado pelo banco (0030); a acao já é a frase completa, sem placa. Os valores de/para
    // (CARRO/MOTO/OUTRO) ficam só nos detalhes técnicos.
    frase = `${acao}.`;
  } else if (/^(Transferiu o cargo de |Iniciou a transferência do cargo de |Cancelou a transferência do cargo |A transferência do cargo de |Aceitou o convite e assumiu o cargo de )/.test(acao)) {
    // Gravado pelo banco (0037, funções de transferir cargo); a acao já é a frase completa, só com nomes
    // (sem e-mail nem telefone). Cargos, resultado e ids ficam nos detalhes técnicos.
    frase = `${acao}.`;
  }

  if (frase) return { frase, detalhes: [], tecnicos: [...tecnicos, ...entradas.filter(([k]) => k === 'de' || k === 'para').map(([chave, v]) => ({ chave, valor: texto(v) }))] };

  // Ação não mapeada: o texto da ação já é uma frase; o resto vira "chave: valor" sem ids.
  const detalhes = entradas
    .filter(([k, v]) => !ehChaveTecnica(k) && typeof v !== 'object')
    .map(([k, v]) => `${ROTULOS_CHAVE[k] ?? k}: ${texto(v)}`);
  return { frase: acao, detalhes, tecnicos };
}
