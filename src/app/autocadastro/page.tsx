'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { PrintReportHeader } from '@/components/reports/PrintReportHeader';
import { useDialog } from '@/components/ui/DialogProvider';
import { Badge } from '@/components/ui/Badge';
import { useApp } from '@/context/AppContext';
import { isAdmin } from '@/lib/roles';
import type { Autocadastro, Unit } from '@/types';
import {
  AlertTriangle,
  Car,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  FileUp,
  Link2,
  Lock,
  Printer,
  Upload,
  Users,
  X,
} from 'lucide-react';

export default function AutocadastroPage() {
  return (
    <AppShell>
      <AutocadastroContent />
    </AppShell>
  );
}

type Situacao = 'VALIDADO' | 'AGUARDANDO' | 'CONFLITO' | 'SEM_CADASTRO';

interface LinhaUnidade {
  unit: Unit;
  responsavel?: string;
  pendentes: Autocadastro[];
  situacao: Situacao;
}

const SITUACAO: Record<Situacao, { label: string; cls: string }> = {
  VALIDADO: { label: 'Validada', cls: 'bg-emerald-50 text-emerald-800' },
  AGUARDANDO: { label: 'Aguardando validação', cls: 'bg-amber-50 text-amber-800' },
  CONFLITO: { label: 'Conflito', cls: 'bg-red-50 text-red-800' },
  SEM_CADASTRO: { label: 'Sem cadastro', cls: 'bg-slate-100 text-slate-600' },
};

const FILTROS: Array<{ valor: Situacao | 'TODAS'; label: string }> = [
  { valor: 'TODAS', label: 'Todas' },
  { valor: 'AGUARDANDO', label: 'Aguardando' },
  { valor: 'CONFLITO', label: 'Conflito' },
  { valor: 'SEM_CADASTRO', label: 'Sem cadastro' },
  { valor: 'VALIDADO', label: 'Validadas' },
];

function responsavelDaUnidade(u: Unit): string | undefined {
  const prioritario = u.moradores?.find((m) => m.tipo === 'TITULAR' || m.tipo === 'INQUILINO');
  return prioritario?.nome || u.moradores?.[0]?.nome || u.proprietarioNome || undefined;
}

/**
 * Aceita CSV (";" ou ","), ou colunas coladas direto do Excel (tab).
 * Primeira coluna = bloco, segunda = número. Cabeçalho é ignorado.
 */
function lerPlanilha(texto: string): { linhas: Array<{ bloco: string; numero: string }>; invalidas: number } {
  const vistos = new Set<string>();
  const linhas: Array<{ bloco: string; numero: string }> = [];
  let invalidas = 0;
  texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((linha, i) => {
      if (i === 0 && /bloco|apto|apartamento|unidade|n[uú]mero/i.test(linha)) return;
      const [b, n] = linha.split(/[;,\t]/).map((c) => c.trim().replace(/^"|"$/g, ''));
      const bloco = (b ?? '').replace(/^bloco\s*/i, '').toUpperCase();
      const numero = (n ?? '').replace(/^(apto|apt|ap)\.?\s*/i, '');
      if (!bloco || !numero || bloco.length > 10 || numero.length > 10) {
        invalidas++;
        return;
      }
      const chave = `${bloco}|${numero.toLowerCase()}`;
      if (vistos.has(chave)) return;
      vistos.add(chave);
      linhas.push({ bloco, numero });
    });
  return { linhas, invalidas };
}

function AutocadastroContent() {
  const {
    currentUser,
    units,
    autocadastros,
    autocadastroAberto,
    setAutocadastroAberto,
    importarUnidades,
    decidirAutocadastros,
  } = useApp();
  const { confirm, askReason } = useDialog();

  const [copiado, setCopiado] = useState(false);
  const [planilha, setPlanilha] = useState('');
  const [importando, setImportando] = useState(false);
  const [filtro, setFiltro] = useState<Situacao | 'TODAS'>('TODAS');
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [processando, setProcessando] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string; detalhes?: string[] } | null>(null);

  const linhasUnidades: LinhaUnidade[] = useMemo(() => {
    return [...units]
      .sort((a, b) => a.bloco.localeCompare(b.bloco) || a.numero.localeCompare(b.numero, undefined, { numeric: true }))
      .map((unit) => {
        const responsavel = responsavelDaUnidade(unit);
        const pendentes = autocadastros.filter((a) => a.unitId === unit.id && a.status === 'AGUARDANDO');
        const situacao: Situacao =
          pendentes.length === 0
            ? responsavel ? 'VALIDADO' : 'SEM_CADASTRO'
            : pendentes.length > 1 || responsavel ? 'CONFLITO' : 'AGUARDANDO';
        return { unit, responsavel, pendentes, situacao };
      });
  }, [units, autocadastros]);

  if (!currentUser) return null;

  if (!isAdmin(currentUser.role)) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <Lock className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-base font-bold text-amber-900">Área Restrita</h2>
        <p className="mx-auto mt-2 max-w-md text-xs text-amber-700">
          A validação de cadastros é reservada ao Síndico, ao Subsíndico e à Administradora.
        </p>
      </div>
    );
  }

  const contagem = linhasUnidades.reduce(
    (acc, l) => ({ ...acc, [l.situacao]: acc[l.situacao] + 1 }),
    { VALIDADO: 0, AGUARDANDO: 0, CONFLITO: 0, SEM_CADASTRO: 0 } as Record<Situacao, number>
  );
  const visiveis = filtro === 'TODAS' ? linhasUnidades : linhasUnidades.filter((l) => l.situacao === filtro);
  const pendentesVisiveis = visiveis.flatMap((l) => l.pendentes.map((p) => p.id));
  // Só chega aqui no navegador: sem currentUser (inclusive na renderização do servidor) a página já retornou acima.
  const link = `${window.location.origin}/cadastro`;
  const previa = planilha.trim() ? lerPlanilha(planilha) : null;

  const handleToggle = async () => {
    const res = await setAutocadastroAberto(!autocadastroAberto);
    setFeedback({ type: res.success ? 'success' : 'error', text: res.message });
  };

  const handleCopiar = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setFeedback({ type: 'error', text: 'Não foi possível copiar automaticamente. Selecione o link e copie manualmente.' });
    }
  };

  const handleArquivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setPlanilha(await arquivo.text());
    e.target.value = '';
  };

  const handleImportar = async () => {
    if (!previa || previa.linhas.length === 0) return;
    setImportando(true);
    const res = await importarUnidades(previa.linhas);
    setImportando(false);
    setFeedback({ type: res.success ? 'success' : 'error', text: res.message });
    if (res.success) setPlanilha('');
  };

  const decidir = async (ids: string[], acao: 'VALIDAR' | 'RECUSAR') => {
    if (ids.length === 0 || processando) return;
    let motivo: string | undefined;
    if (acao === 'RECUSAR') {
      const r = await askReason({
        title: ids.length === 1 ? 'Recusar cadastro' : `Recusar ${ids.length} cadastros`,
        message: 'A conta criada pelo morador será removida. Ele poderá se cadastrar de novo pelo link, se o formulário estiver aberto.',
        label: 'Motivo (fica registrado na auditoria)',
        placeholder: 'Ex: não é morador desta unidade',
        confirmLabel: 'Recusar',
      });
      if (r === null) return;
      motivo = r;
    } else if (ids.length > 1) {
      const ok = await confirm({
        title: `Validar ${ids.length} cadastros?`,
        message: 'Cada morador passa a ter acesso completo à própria unidade, e os veículos informados são cadastrados.',
        confirmLabel: 'Validar todos',
      });
      if (!ok) return;
    }
    setProcessando(true);
    const res = await decidirAutocadastros(ids, acao, motivo);
    setProcessando(false);
    setSelecionados((s) => s.filter((id) => !ids.includes(id)));
    setFeedback({ type: res.success ? 'success' : 'error', text: res.message, detalhes: res.detalhes });
  };

  const alternarSelecao = (id: string) =>
    setSelecionados((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div className="space-y-6">
      <PrintReportHeader
        titulo="Situação do Cadastro das Unidades"
        subtitulo="Relação de unidades, responsáveis e situação do autocadastro"
      />

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center no-print">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-[#00A8E8]" />
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Autocadastro de Moradores</h1>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Os moradores se cadastram pelo link; você confere a lista e valida cada unidade.
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50"
        >
          <Printer className="h-4 w-4 text-slate-500" />
          <span>Imprimir relatório</span>
        </button>
      </div>

      {feedback && (
        <div
          className={`rounded-2xl border p-4 text-xs no-print ${
            feedback.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-red-200 bg-red-50 text-red-900'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2 font-semibold">
              {feedback.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />}
              <span>{feedback.text}</span>
            </div>
            <button onClick={() => setFeedback(null)} aria-label="Fechar mensagem" className="text-slate-500 hover:text-slate-700">
              <X className="h-4 w-4" />
            </button>
          </div>
          {feedback.detalhes && feedback.detalhes.length > 0 && (
            <ul className="mt-2 list-disc space-y-0.5 pl-8 font-normal">
              {feedback.detalhes.map((d, i) => <li key={i}>{d}</li>)}
            </ul>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 no-print">
        {/* Formulário: abrir/fechar e link */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <Link2 className="h-4 w-4 text-[#00A8E8]" /> Link do formulário
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {autocadastroAberto
                  ? 'Aberto: qualquer pessoa com o link consegue se cadastrar.'
                  : 'Fechado: o link não aceita novos cadastros.'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={autocadastroAberto}
              aria-label="Formulário de autocadastro aberto"
              onClick={handleToggle}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${autocadastroAberto ? 'bg-emerald-500' : 'bg-slate-300'}`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${autocadastroAberto ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <input
              readOnly
              value={link}
              aria-label="Link do formulário de autocadastro"
              onFocus={(e) => e.target.select()}
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700"
            />
            <button
              type="button"
              onClick={handleCopiar}
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-[#0B2545] px-3 py-2 text-xs font-semibold text-white hover:bg-[#134074]"
            >
              {copiado ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copiado ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
          {units.length === 0 && (
            <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Importe as unidades antes de divulgar o link: o morador escolhe o apartamento de uma lista.
            </p>
          )}
        </div>

        {/* Importação da planilha */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <FileUp className="h-4 w-4 text-[#00A8E8]" /> Importar unidades da planilha
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Só bloco e número. Copie as duas colunas do Excel e cole abaixo, ou envie um CSV. Unidades já cadastradas são ignoradas.
          </p>
          <label htmlFor="planilha" className="sr-only">Unidades da planilha</label>
          <textarea
            id="planilha"
            rows={4}
            value={planilha}
            onChange={(e) => setPlanilha(e.target.value)}
            placeholder={'Bloco;Número\nA;101\nA;102\nB;101'}
            className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <label className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-[#0A6E9C] hover:underline">
              <Upload className="h-3.5 w-3.5" /> Enviar arquivo CSV
              <input type="file" accept=".csv,.txt,text/csv" onChange={handleArquivo} className="sr-only" />
            </label>
            <div className="flex items-center gap-3">
              {previa && (
                <span className="text-xs text-slate-500">
                  {previa.linhas.length} unidade(s){previa.invalidas > 0 && `, ${previa.invalidas} linha(s) ignorada(s)`}
                </span>
              )}
              <button
                type="button"
                onClick={handleImportar}
                disabled={!previa || previa.linhas.length === 0 || importando}
                className="rounded-xl bg-[#0B2545] px-3 py-2 text-xs font-semibold text-white hover:bg-[#134074] disabled:opacity-50"
              >
                {importando ? 'Importando...' : 'Importar'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(['AGUARDANDO', 'CONFLITO', 'SEM_CADASTRO', 'VALIDADO'] as Situacao[]).map((s) => (
          <div key={s} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-slate-500">{SITUACAO[s].label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{contagem[s]}</p>
          </div>
        ))}
      </div>

      {/* Relatório / fila de validação */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between no-print">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por situação">
            {FILTROS.map((f) => (
              <button
                key={f.valor}
                type="button"
                onClick={() => setFiltro(f.valor)}
                aria-pressed={filtro === f.valor}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  filtro === f.valor ? 'bg-[#0B2545] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={selecionados.length === 0 || processando}
              onClick={() => decidir(selecionados, 'RECUSAR')}
              className="rounded-xl border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-40"
            >
              Recusar ({selecionados.length})
            </button>
            <button
              type="button"
              disabled={selecionados.length === 0 || processando}
              onClick={() => decidir(selecionados, 'VALIDAR')}
              className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
            >
              {processando ? 'Processando...' : `Validar selecionados (${selecionados.length})`}
            </button>
          </div>
        </div>

        {linhasUnidades.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500">
            <Users className="mx-auto mb-2 h-6 w-6 text-slate-400" />
            Nenhuma unidade cadastrada. Importe a planilha para começar.
          </div>
        ) : visiveis.length === 0 ? (
          <p className="p-10 text-center text-xs text-slate-500">Nenhuma unidade nesta situação.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[12px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="w-8 px-4 py-2.5 no-print">
                    <input
                      type="checkbox"
                      aria-label="Selecionar todos os cadastros aguardando"
                      checked={pendentesVisiveis.length > 0 && pendentesVisiveis.every((id) => selecionados.includes(id))}
                      disabled={pendentesVisiveis.length === 0}
                      onChange={(e) => setSelecionados(e.target.checked ? pendentesVisiveis : [])}
                      className="h-4 w-4 accent-[#0B2545]"
                    />
                  </th>
                  <th className="px-4 py-2.5">Unidade</th>
                  <th className="px-4 py-2.5">Responsável</th>
                  <th className="px-4 py-2.5">Situação</th>
                  <th className="px-4 py-2.5 no-print">Cadastro enviado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visiveis.map((l) => {
                  const linhasCadastro = l.pendentes.length > 0 ? l.pendentes : [null];
                  return linhasCadastro.map((p, idx) => (
                    <tr key={`${l.unit.id}-${p?.id ?? 'sem'}`} className="align-top">
                      <td className="px-4 py-3 no-print">
                        {p && (
                          <input
                            type="checkbox"
                            aria-label={`Selecionar cadastro de ${p.nome}`}
                            checked={selecionados.includes(p.id)}
                            onChange={() => alternarSelecao(p.id)}
                            className="h-4 w-4 accent-[#0B2545]"
                          />
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-bold text-slate-900">
                        {idx === 0 ? `Apto ${l.unit.numero} — Bl. ${l.unit.bloco}` : ''}
                      </td>
                      <td className="px-4 py-3">
                        {p ? (
                          <>
                            <span className="font-semibold text-slate-900">{p.nome}</span>
                            <span className="block text-[12px] text-slate-500">
                              {p.tipo === 'PROPRIETARIO' ? 'Proprietário(a)' : 'Inquilino(a)'} · enviado em {new Date(p.criadoEm).toLocaleDateString('pt-BR')}
                            </span>
                            {l.responsavel && idx === 0 && (
                              <span className="mt-1 block text-[12px] text-red-700">Já cadastrado na unidade: {l.responsavel}</span>
                            )}
                          </>
                        ) : l.responsavel ? (
                          <span className="font-semibold text-slate-900">{l.responsavel}</span>
                        ) : (
                          <span className="italic text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={SITUACAO[l.situacao].cls}>{SITUACAO[l.situacao].label}</Badge>
                      </td>
                      <td className="px-4 py-3 no-print">
                        {p ? (
                          <div className="space-y-1.5">
                            <p className="text-slate-600">{p.email} · {p.telefone}{p.rgCpf ? ` · ${p.rgCpf}` : ''}</p>
                            {p.dependentes.length > 0 && (
                              <p className="text-slate-600">Moradores: {p.dependentes.map((d) => d.nome).join(', ')}</p>
                            )}
                            {p.veiculos.length > 0 && (
                              <p className="flex flex-wrap gap-1">
                                {p.veiculos.map((v) => (
                                  <span key={v.placa} className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-slate-700">
                                    <Car className="h-3 w-3 text-slate-500" /> {v.placa} · {v.modelo}
                                  </span>
                                ))}
                              </p>
                            )}
                            <div className="flex gap-2 pt-1">
                              <button
                                type="button"
                                disabled={processando}
                                onClick={() => decidir([p.id], 'VALIDAR')}
                                className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[12px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                              >
                                Validar
                              </button>
                              <button
                                type="button"
                                disabled={processando}
                                onClick={() => decidir([p.id], 'RECUSAR')}
                                className="rounded-lg border border-red-200 px-2.5 py-1 text-[12px] font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                              >
                                Recusar
                              </button>
                            </div>
                          </div>
                        ) : l.situacao === 'VALIDADO' ? (
                          <Link href="/moradores" className="text-[12px] font-semibold text-[#0A6E9C] hover:underline">Editar em Moradores</Link>
                        ) : (
                          <span className="text-[12px] text-slate-400">Nenhum envio</span>
                        )}
                      </td>
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
