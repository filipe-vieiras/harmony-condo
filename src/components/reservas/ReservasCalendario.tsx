'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Clock, Lock } from 'lucide-react';
import type { CommonSpace, Reservation } from '@/types';
import {
  DIAS_SEMANA_ABREV,
  DIAS_SEMANA_NOME,
  dataCurta,
  diaDaSemana,
  diasNoMes,
  hojeBrasilia,
  montarData,
  partesDaData,
  rotuloMes,
  somarDias,
  somarMeses,
} from '@/lib/datasReservas';

interface Props {
  spaces: CommonSpace[];
  /** Reservas que o usuário pode ler: todas para a equipe, só as da própria unidade para o morador. */
  reservations: Reservation[];
  /** Equipe (Síndico, Subsíndico, ADM, Portaria, Conselho): o texto de leitor de tela fala de "reservas". */
  ehEquipe: boolean;
  /** Dias ocupados do período, vindos da função do banco (sem nome nem unidade). null = falhou. */
  buscar: (inicio: string, fim: string) => Promise<{ espacoId: string; data: string }[] | null>;
  /** Muda quando algo foi criado ou decidido: o mês visível é consultado de novo, sem piscar. */
  recarregarKey: number;
  diaSelecionado: string | null;
  onSelecionarDia: (dia: string) => void;
  /** Espaço que o calendário mostra (chip escolhido). null = todos os espaços (só a equipe usa). */
  espacoId: string | null;
  /** Só a gestão recebe (RLS): serve para dizer "Bloqueado pelo X" ao invés de só "Ocupado". */
  bloqueiosDoEspaco?: (espacoId: string) => string[];
}

type Estado = 'livre' | 'ocupado' | 'aguardando' | 'confirmada';
interface Item { nome: string; pendente: boolean }

const MESES_A_FRENTE = 11; // mês atual + 11 = 12 meses

function titulo(iso: string) {
  const r = rotuloMes(iso);
  return r.charAt(0).toUpperCase() + r.slice(1);
}

/**
 * Calendário mensal de reservas, sem biblioteca. Mostra UM espaço por vez (o chip escolhido):
 *  - Livre, Ocupado (inclusive por bloqueio de outro espaço, sem dizer o motivo ao morador);
 *  - Aguardando / Confirmada: há reserva do usuário naquele espaço (a equipe enxerga qualquer uma;
 *    o morador, as da própria unidade).
 * Com "Todos" (só a equipe), cada dia traz uma etiqueta por espaço reservado (máximo 3 e "+N").
 * Teclado no padrão ARIA grid: setas, Home/End, PageUp/PageDown, Enter/Espaço.
 * Texto nunca depende só de cor; só o mês visível é consultado.
 */
export function ReservasCalendario({ spaces, reservations, ehEquipe, buscar, recarregarKey, diaSelecionado, onSelecionarDia, espacoId, bloqueiosDoEspaco }: Props) {
  const hoje = hojeBrasilia();
  const minMes = somarMeses(hoje, 0);
  const maxMes = somarMeses(hoje, MESES_A_FRENTE);

  const [mes, setMes] = useState(minMes);
  const [foco, setFoco] = useState(hoje);
  const [tentativa, setTentativa] = useState(0);
  const [resultado, setResultado] = useState<{ chave: string; ocupados: Set<string> | null } | null>(null);
  const focarAposRender = useRef(false);
  // `buscar` muda a cada render do contexto; a consulta só deve rodar quando o mês ou os dados mudam.
  const buscarRef = useRef(buscar);
  useEffect(() => { buscarRef.current = buscar; });

  const chave = mes;
  const carregando = resultado?.chave !== chave;
  const erro = !carregando && resultado?.ocupados === null;

  // Consulta só o mês visível (e só de hoje em diante: o passado não tem ação). Ao recarregar por
  // mudança de dados o resultado anterior fica na tela até o novo chegar.
  useEffect(() => {
    let cancelado = false;
    const { ano, mes: m } = partesDaData(mes);
    const ultimo = montarData(ano, m, diasNoMes(ano, m));
    const inicio = mes < hoje ? hoje : mes;
    buscarRef.current(inicio, ultimo).then((linhas) => {
      if (cancelado) return;
      setResultado({ chave: mes, ocupados: linhas ? new Set(linhas.map((l) => `${l.espacoId}|${l.data}`)) : null });
    });
    return () => { cancelado = true; };
  }, [mes, hoje, recarregarKey, tentativa]);

  const espaco = useMemo(() => (espacoId ? spaces.find((s) => s.id === espacoId) ?? null : null), [spaces, espacoId]);
  const modoTodos = !espaco;

  // Reservas que o usuário enxerga, por dia, só PENDENTE e APROVADA (as demais liberam o dia).
  const ativasPorDia = useMemo(() => {
    const m = new Map<string, Reservation[]>();
    for (const r of reservations) {
      if (r.status !== 'PENDENTE' && r.status !== 'APROVADA') continue;
      const lista = m.get(r.data) ?? [];
      lista.push(r);
      m.set(r.data, lista);
    }
    return m;
  }, [reservations]);

  const ocupadoNoDia = useCallback((id: string, dia: string) => {
    if (resultado?.ocupados?.has(`${id}|${dia}`)) return true;
    // Dado local (a própria unidade ou a equipe) é mais novo que a consulta: vale também.
    return (ativasPorDia.get(dia) ?? []).some((r) => r.espacoId === id);
  }, [resultado, ativasPorDia]);

  // Semanas do mês (domingo a sábado); células de fora do mês ficam vazias.
  const semanas = useMemo(() => {
    const { ano, mes: m } = partesDaData(mes);
    const total = diasNoMes(ano, m);
    const celulas: (string | null)[] = Array(diaDaSemana(mes)).fill(null);
    for (let d = 1; d <= total; d++) celulas.push(montarData(ano, m, d));
    while (celulas.length % 7 !== 0) celulas.push(null);
    const linhas: (string | null)[][] = [];
    for (let i = 0; i < celulas.length; i += 7) linhas.push(celulas.slice(i, i + 7));
    return linhas;
  }, [mes]);

  // Situação de um dia para o espaço escolhido.
  const estadoDoDia = useCallback((dia: string): { estado: Estado; bloqueadoPor?: string } => {
    if (!espaco) return { estado: 'livre' };
    const doEspaco = (ativasPorDia.get(dia) ?? []).filter((r) => r.espacoId === espaco.id);
    if (doEspaco.length > 0) return { estado: doEspaco.some((r) => r.status === 'PENDENTE') ? 'aguardando' : 'confirmada' };
    if (!ocupadoNoDia(espaco.id, dia)) return { estado: 'livre' };
    // Ocupado sem reserva própria: bloqueio por outro espaço. O motivo é só da gestão.
    const parceiros = bloqueiosDoEspaco?.(espaco.id) ?? [];
    const quem = (ativasPorDia.get(dia) ?? []).find((r) => r.espacoId && parceiros.includes(r.espacoId));
    return { estado: 'ocupado', bloqueadoPor: quem?.espacoNome };
  }, [espaco, ativasPorDia, ocupadoNoDia, bloqueiosDoEspaco]);

  // "Todos": uma etiqueta por reserva do dia (só o que o usuário enxerga).
  const itensDoDia = useCallback((dia: string): Item[] => (
    (ativasPorDia.get(dia) ?? []).map((r) => ({ nome: r.espacoNome, pendente: r.status === 'PENDENTE' }))
  ), [ativasPorDia]);

  const rotuloDoDia = (dia: string): string => {
    const partes = [dataCurta(dia)];
    if (dia === hoje) partes.push('hoje');
    if (dia < hoje) { partes.push('passado', 'indisponível'); return partes.join(', '); }
    if (carregando || erro) return partes.join(', ');
    if (modoTodos) {
      const itens = itensDoDia(dia);
      partes.push(itens.length === 0 ? 'sem reservas' : itens.map((i) => `${i.nome}, ${i.pendente ? 'aguardando aprovação' : 'confirmada'}`).join('; '));
      return partes.join(', ');
    }
    const { estado, bloqueadoPor } = estadoDoDia(dia);
    if (estado === 'livre') partes.push(`${espaco!.nome}: livre`);
    else if (estado === 'ocupado') partes.push(bloqueadoPor ? `${espaco!.nome}: ocupado, bloqueado por ${bloqueadoPor}` : `${espaco!.nome}: ocupado`);
    else if (ehEquipe) partes.push(`${espaco!.nome}, reserva ${estado === 'aguardando' ? 'aguardando aprovação' : 'confirmada'}`);
    else partes.push(`sua reserva ${estado === 'aguardando' ? 'aguardando aprovação' : 'confirmada'}`);
    return partes.join(', ');
  };

  const irParaMes = (iso: string, diaFoco?: string) => {
    const novoMes = somarMeses(iso, 0);
    if (novoMes < minMes || novoMes > maxMes) return;
    setMes(novoMes);
    const { ano, mes: m } = partesDaData(novoMes);
    setFoco(diaFoco ?? (novoMes === minMes ? hoje : montarData(ano, m, 1)));
  };

  const abrirDia = (dia: string) => {
    if (dia < hoje) return;
    onSelecionarDia(dia);
  };

  const moverFoco = (novo: string) => {
    if (novo < minMes) return;
    const mesDoNovo = somarMeses(novo, 0);
    if (mesDoNovo > maxMes) return;
    focarAposRender.current = true;
    if (mesDoNovo !== mes) setMes(mesDoNovo);
    setFoco(novo);
  };

  // Depois de mover o foco por teclado (inclusive para outro mês), foca a célula nova.
  useEffect(() => {
    if (!focarAposRender.current) return;
    const el = document.querySelector<HTMLElement>(`[data-dia="${foco}"]`);
    if (el) {
      el.focus();
      focarAposRender.current = false;
    }
  }, [foco, mes, resultado]);

  const aoTeclar = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const { dia } = partesDaData(foco);
    switch (e.key) {
      case 'ArrowLeft': e.preventDefault(); moverFoco(somarDias(foco, -1)); break;
      case 'ArrowRight': e.preventDefault(); moverFoco(somarDias(foco, 1)); break;
      case 'ArrowUp': e.preventDefault(); moverFoco(somarDias(foco, -7)); break;
      case 'ArrowDown': e.preventDefault(); moverFoco(somarDias(foco, 7)); break;
      case 'Home': e.preventDefault(); moverFoco(maxData(somarDias(foco, -diaDaSemana(foco)), mes)); break;
      case 'End': e.preventDefault(); moverFoco(minData(somarDias(foco, 6 - diaDaSemana(foco)), mes)); break;
      case 'PageUp':
      case 'PageDown': {
        e.preventDefault();
        const alvo = somarMeses(foco, e.key === 'PageUp' ? -1 : 1);
        const { ano: a2, mes: m2 } = partesDaData(alvo);
        const novo = montarData(a2, m2, Math.min(dia, diasNoMes(a2, m2)));
        moverFoco(novo < hoje && somarMeses(novo, 0) === minMes ? hoje : novo);
        break;
      }
      case 'Enter':
      case ' ': e.preventDefault(); abrirDia(foco); break;
      default: break;
    }
  };

  const noMesAtual = mes === minMes;
  const noUltimoMes = mes === maxMes;
  const anuncio = carregando ? '' : erro ? 'Não foi possível carregar o calendário.' : `${titulo(mes)}${espaco ? `, ${espaco.nome}` : ', todos os espaços'}.`;

  return (
    <section aria-label={`Calendário de reservas${espaco ? `, ${espaco.nome}` : ', todos os espaços'}`} className="no-print rounded-2xl border border-slate-200 bg-white p-2 shadow-xs sm:p-5">
      {/* Navegação do mês */}
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold text-slate-900 sm:text-xl">{titulo(mes)}</h2>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => irParaMes(hoje, hoje)}
            className="min-h-11 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
          >
            Hoje
          </button>
          <button
            type="button"
            aria-label="Mês anterior"
            disabled={noMesAtual}
            onClick={() => irParaMes(somarMeses(mes, -1))}
            className="flex size-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Próximo mês"
            disabled={noUltimoMes}
            onClick={() => irParaMes(somarMeses(mes, 1))}
            className="flex size-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Anuncia a troca de mês para leitor de tela */}
      <p className="sr-only" aria-live="polite">{anuncio}</p>

      <div className="mt-3" aria-busy={carregando}>
        {erro ? (
          <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800 sm:flex-row sm:items-center sm:justify-between">
            <span>Não conseguimos carregar o calendário. Tente de novo.</span>
            <button
              type="button"
              onClick={() => { setResultado(null); setTentativa((t) => t + 1); }}
              className="min-h-11 rounded-xl border border-red-300 bg-white px-4 text-xs font-semibold text-red-800 transition hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
            >
              Tentar de novo
            </button>
          </div>
        ) : carregando ? (
          // Esqueleto: nunca mostra "tudo livre" antes de a consulta voltar.
          <div role="status" aria-label="Carregando o calendário" className="animate-pulse">
            <div className="grid grid-cols-7 gap-0.5 pb-1 text-center text-[12px] font-bold text-slate-600" aria-hidden="true">
              {DIAS_SEMANA_ABREV.map((d) => <div key={d}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-0.5 sm:gap-1.5" aria-hidden="true">
              {Array.from({ length: 35 }, (_, i) => (
                <div key={i} className={`min-h-12 rounded-xl bg-slate-100 ${modoTodos ? 'sm:min-h-[96px]' : 'sm:min-h-[76px]'}`} />
              ))}
            </div>
          </div>
        ) : (
          <div
            role="grid"
            aria-label={`Calendário de reservas${espaco ? `, ${espaco.nome}` : ''}, ${rotuloMes(mes)}`}
            onKeyDown={aoTeclar}
          >
            <div role="row" className="grid grid-cols-7 gap-0.5 pb-1 text-center text-[12px] font-bold text-slate-600 sm:gap-1.5">
              {DIAS_SEMANA_ABREV.map((d, i) => (
                <div key={d} role="columnheader">
                  <abbr title={DIAS_SEMANA_NOME[i]} className="no-underline">{d}</abbr>
                </div>
              ))}
            </div>
            <div className="space-y-0.5 sm:space-y-1.5">
              {semanas.map((semana, i) => (
                <div key={i} role="row" className="grid grid-cols-7 gap-0.5 sm:gap-1.5">
                  {semana.map((dia, j) => dia ? (
                    <CelulaDia
                      key={dia}
                      dia={dia}
                      numero={partesDaData(dia).dia}
                      ehHoje={dia === hoje}
                      selecionado={dia === diaSelecionado}
                      comFoco={dia === foco}
                      rotulo={rotuloDoDia(dia)}
                      passado={dia < hoje}
                      modoTodos={modoTodos}
                      {...(modoTodos ? { itens: itensDoDia(dia) } : estadoDoDia(dia))}
                      onAbrir={() => { setFoco(dia); abrirDia(dia); }}
                      onFocar={() => setFoco(dia)}
                    />
                  ) : (
                    <div key={`v${j}`} role="presentation" />
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Legenda: ícone e texto, nunca só cor */}
      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-100 pt-3 text-[12px] text-slate-700">
        {!modoTodos && <li className="flex items-center gap-1.5"><span aria-hidden="true" className="size-2.5 rounded-full bg-accent-strong" />Livre</li>}
        {!modoTodos && <li className="flex items-center gap-1.5"><Lock aria-hidden="true" className="h-3.5 w-3.5 text-slate-600" />Ocupado</li>}
        <li className="flex items-center gap-1.5"><Clock aria-hidden="true" className="h-3.5 w-3.5 text-pendente-800" />Aguardando</li>
        <li className="flex items-center gap-1.5"><Check aria-hidden="true" className="h-3.5 w-3.5 text-emerald-800" />Confirmada</li>
        <li className="flex items-center gap-1.5"><span aria-hidden="true" className="size-3.5 rounded-md ring-2 ring-primary" />Hoje</li>
      </ul>
    </section>
  );
}

// Home/End ficam dentro do mês visível.
function maxData(a: string, mes: string) { return a < mes ? mes : a; }
function minData(a: string, mes: string) {
  const { ano, mes: m } = partesDaData(mes);
  const ultimo = montarData(ano, m, diasNoMes(ano, m));
  return a > ultimo ? ultimo : a;
}

interface CelulaProps {
  dia: string;
  numero: number;
  ehHoje: boolean;
  selecionado: boolean;
  comFoco: boolean;
  rotulo: string;
  passado: boolean;
  modoTodos: boolean;
  /** Um espaço: situação do dia. */
  estado?: Estado;
  bloqueadoPor?: string;
  /** Todos: reservas do dia. */
  itens?: Item[];
  onAbrir: () => void;
  onFocar: () => void;
}

const MAX_ETIQUETAS = 3;

/** Nome curto da etiqueta: primeira palavra ("Salão de Festas" -> "Salão"), mantendo número ou letra final ("Churrasqueira 2"). */
function abreviar(nome: string): string {
  const p = nome.trim().split(/\s+/);
  const ultimo = p[p.length - 1];
  return p.length > 1 && /^(\d+|[A-Za-z])$/.test(ultimo) ? `${p[0]} ${ultimo}` : p[0];
}

function CelulaDia({ numero, dia, ehHoje, selecionado, comFoco, rotulo, passado, modoTodos, estado, bloqueadoPor, itens = [], onAbrir, onFocar }: CelulaProps) {
  const algumPendente = itens.some((i) => i.pendente);
  // Cor de fundo da célula: só reforça; o texto e o ícone dizem o estado.
  const situacao: 'livre' | 'ocupado' | 'aguardando' | 'confirmada' = modoTodos
    ? (itens.length === 0 ? 'livre' : algumPendente ? 'aguardando' : 'confirmada')
    : (estado ?? 'livre');

  let fundo = 'bg-white border-slate-200 text-slate-900 hover:bg-slate-50 cursor-pointer';
  if (passado) fundo = 'bg-transparent border-transparent text-slate-500 cursor-default';
  else if (selecionado) fundo = 'bg-primary border-primary text-white cursor-pointer';
  else if (situacao === 'ocupado') fundo = 'bg-slate-100 border-slate-200 text-slate-700 cursor-pointer';
  else if (situacao === 'aguardando') fundo = 'bg-pendente-50 border-pendente-200 text-pendente-800 cursor-pointer hover:bg-pendente-100';
  else if (situacao === 'confirmada') fundo = 'bg-emerald-50 border-emerald-200 text-emerald-800 cursor-pointer hover:bg-emerald-100';

  let marca: React.ReactNode = null;
  if (!passado && !modoTodos) {
    if (situacao === 'aguardando') {
      marca = <MarcaTexto icone={<Clock aria-hidden="true" className="h-3.5 w-3.5" />} texto="Aguardando" />;
    } else if (situacao === 'confirmada') {
      marca = <MarcaTexto icone={<Check aria-hidden="true" className="h-3.5 w-3.5" />} texto="Confirmada" />;
    } else if (situacao === 'ocupado') {
      marca = <MarcaTexto icone={<Lock aria-hidden="true" className="h-3.5 w-3.5" />} texto={bloqueadoPor ? `Bloqueado: ${bloqueadoPor}` : 'Ocupado'} />;
    } else {
      marca = (
        <span className={`inline-flex items-center gap-1 text-[12px] font-semibold leading-none ${selecionado ? 'text-white' : 'text-accent-strong'}`}>
          <span aria-hidden="true" className={`size-2 rounded-full ${selecionado ? 'bg-white' : 'bg-accent-strong'}`} />
          <span className="hidden sm:inline">Livre</span>
        </span>
      );
    }
  } else if (!passado && modoTodos && itens.length > 0) {
    const Icone = algumPendente ? Clock : Check;
    const visiveis = itens.length > MAX_ETIQUETAS ? itens.slice(0, MAX_ETIQUETAS - 1) : itens;
    const resto = itens.length - visiveis.length;
    marca = (
      <>
        {/* Celular: sem espaço para nomes; ícone do estado dominante e a quantidade. */}
        <span className="inline-flex items-center gap-0.5 text-[12px] font-bold leading-none sm:hidden">
          <Icone aria-hidden="true" className="h-3.5 w-3.5" />
          {itens.length > 1 && <span>{itens.length}</span>}
        </span>
        <span className="hidden w-full flex-col gap-1 sm:flex">
          {visiveis.map((it, i) => (
            <span
              key={i}
              title={`${it.nome}: ${it.pendente ? 'aguardando aprovação' : 'confirmada'}`}
              className={`flex w-full items-center gap-1 rounded-md px-1.5 py-0.5 text-[12px] font-semibold leading-tight ${it.pendente ? 'bg-pendente-200 text-pendente-800' : 'bg-emerald-200 text-emerald-800'}`}
            >
              {it.pendente ? <Clock aria-hidden="true" className="h-3 w-3 shrink-0" /> : <Check aria-hidden="true" className="h-3 w-3 shrink-0" />}
              <span className="truncate">{abreviar(it.nome)}</span>
            </span>
          ))}
          {resto > 0 && <span className="rounded-md bg-slate-200 px-1.5 py-0.5 text-[12px] font-semibold leading-tight text-slate-700">+{resto}</span>}
        </span>
      </>
    );
  }

  return (
    <div
      role="gridcell"
      data-dia={dia}
      tabIndex={comFoco ? 0 : -1}
      aria-label={rotulo}
      aria-disabled={passado ? true : undefined}
      aria-selected={selecionado || undefined}
      onFocus={onFocar}
      onClick={passado ? undefined : (e) => { e.currentTarget.focus(); onAbrir(); }}
      className={`flex min-h-12 select-none flex-col items-center justify-between gap-0.5 rounded-xl border p-1 text-xs transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong sm:items-start sm:p-2 ${modoTodos ? 'sm:min-h-[96px]' : 'sm:min-h-[76px]'} ${fundo} ${ehHoje ? 'ring-2 ring-primary' : ''}`}
    >
      <span aria-hidden="true" className={`text-sm leading-none ${ehHoje && !passado ? 'font-extrabold' : 'font-semibold'}`}>{numero}</span>
      {ehHoje && <span className="sr-only">hoje</span>}
      <span aria-hidden="true" className="flex min-h-4 w-full items-center justify-center sm:justify-start">{marca}</span>
    </div>
  );
}

function MarcaTexto({ icone, texto }: { icone: React.ReactNode; texto: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 text-[12px] font-bold leading-none">
      {icone}
      <span className="hidden truncate sm:inline">{texto}</span>
    </span>
  );
}
