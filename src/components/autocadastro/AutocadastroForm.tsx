'use client';

import React, { useState } from 'react';
import { AlertCircle, Car, Plus, Trash2, Users, Building2, UserRound, Loader2 } from 'lucide-react';
import { MAX_DEPENDENTES, MAX_VEICULOS, validarDados } from '@/lib/autocadastro';
import type { AutocadastroDependente, AutocadastroVeiculo } from '@/types';

export interface UnidadeOpcao {
  id: string;
  bloco: string;
  numero: string;
}

export interface AutocadastroFormValores {
  unitId: string;
  nome: string;
  telefone: string;
  rgCpf?: string;
  tipo: 'PROPRIETARIO' | 'INQUILINO';
  dependentes: AutocadastroDependente[];
  veiculos: AutocadastroVeiculo[];
}

interface Props {
  modo: 'novo' | 'correcao';
  unidades: UnidadeOpcao[];
  inicial?: Partial<AutocadastroFormValores>;
  submitLabel: string;
  onSubmit: (payload: Record<string, unknown>) => Promise<{ success: boolean; message: string }>;
  onCancel?: () => void;
}

// 16px no celular: abaixo disso o iOS dá zoom ao focar o campo (o link chega pelo WhatsApp).
const inputCls =
  'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20';
const labelCls = 'block text-xs font-semibold text-slate-700';
const sectionCls = 'space-y-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4';

export function AutocadastroForm({ modo, unidades, inicial, submitLabel, onSubmit, onCancel }: Props) {
  const [unitId, setUnitId] = useState(inicial?.unitId ?? '');
  const [nome, setNome] = useState(inicial?.nome ?? '');
  const [telefone, setTelefone] = useState(inicial?.telefone ?? '');
  const [rgCpf, setRgCpf] = useState(inicial?.rgCpf ?? '');
  const [tipo, setTipo] = useState<'PROPRIETARIO' | 'INQUILINO'>(inicial?.tipo ?? 'PROPRIETARIO');
  const [dependentes, setDependentes] = useState<AutocadastroDependente[]>(inicial?.dependentes ?? []);
  const [veiculos, setVeiculos] = useState<AutocadastroVeiculo[]>(inicial?.veiculos ?? []);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [consentimento, setConsentimento] = useState(false);
  const [website, setWebsite] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const blocos = Array.from(new Set(unidades.map((u) => u.bloco)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    const payload: Record<string, unknown> = { unitId, nome, telefone, rgCpf, tipo, dependentes, veiculos };
    const base = validarDados(payload);
    if (!base.ok) {
      setErro(base.erro);
      return;
    }
    if (modo === 'novo') {
      if (senha.length < 6) return setErro('A senha precisa ter no mínimo 6 caracteres.');
      if (senha !== confirmarSenha) return setErro('As senhas não coincidem.');
      if (!consentimento) return setErro('É preciso concordar com a exibição do seu nome na lista de unidades.');
      Object.assign(payload, { email, senha, consentimento, website });
    }

    setEnviando(true);
    const res = await onSubmit(payload);
    setEnviando(false);
    if (!res.success) setErro(res.message);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {/* Campo armadilha contra robôs: escondido de pessoas e leitores de tela. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="ac-website">Site</label>
        <input id="ac-website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>

      <div className={sectionCls}>
        <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
          <Building2 className="h-3.5 w-3.5 text-[#00A8E8]" /> Sua unidade
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="ac-unidade" className={labelCls}>Apartamento</label>
            <select id="ac-unidade" required value={unitId} onChange={(e) => setUnitId(e.target.value)} className={inputCls}>
              <option value="" disabled>Selecione o seu apartamento</option>
              {blocos.map((b) => (
                <optgroup key={b} label={`Bloco ${b}`}>
                  {unidades.filter((u) => u.bloco === b).map((u) => (
                    <option key={u.id} value={u.id}>Bloco {u.bloco} — Apto {u.numero}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="ac-tipo" className={labelCls}>Você é</label>
            <select id="ac-tipo" value={tipo} onChange={(e) => setTipo(e.target.value as 'PROPRIETARIO' | 'INQUILINO')} className={inputCls}>
              <option value="PROPRIETARIO">Proprietário(a)</option>
              <option value="INQUILINO">Inquilino(a)</option>
            </select>
          </div>
        </div>
      </div>

      <div className={sectionCls}>
        <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
          <UserRound className="h-3.5 w-3.5 text-[#00A8E8]" /> Responsável pela unidade
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="ac-nome" className={labelCls}>Nome completo</label>
            <input id="ac-nome" required autoComplete="name" value={nome} onChange={(e) => setNome(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label htmlFor="ac-telefone" className={labelCls}>Telefone / WhatsApp</label>
            <input id="ac-telefone" type="tel" required autoComplete="tel" inputMode="tel" placeholder="(11) 90000-0000" value={telefone} onChange={(e) => setTelefone(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label htmlFor="ac-cpf" className={labelCls}>CPF ou RG <span className="font-normal text-slate-500">(opcional)</span></label>
            <input id="ac-cpf" value={rgCpf} onChange={(e) => setRgCpf(e.target.value)} className={inputCls} />
          </div>
          {modo === 'novo' && (
            <>
              <div className="sm:col-span-2">
                <label htmlFor="ac-email" className={labelCls}>E-mail (será o seu login)</label>
                <input id="ac-email" type="email" required autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label htmlFor="ac-senha" className={labelCls}>Crie uma senha</label>
                <input id="ac-senha" type="password" required minLength={6} autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label htmlFor="ac-senha2" className={labelCls}>Confirme a senha</label>
                <input id="ac-senha2" type="password" required minLength={6} autoComplete="new-password" value={confirmarSenha} onChange={(e) => setConfirmarSenha(e.target.value)} className={inputCls} />
              </div>
            </>
          )}
        </div>
      </div>

      <div className={sectionCls}>
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
            <Users className="h-3.5 w-3.5 text-[#00A8E8]" /> Outros moradores
          </h3>
          {dependentes.length < MAX_DEPENDENTES && (
            <button type="button" onClick={() => setDependentes((p) => [...p, { nome: '', telefone: '' }])} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-[#0A6E9C] hover:bg-sky-50">
              <Plus className="h-3.5 w-3.5" /> Adicionar
            </button>
          )}
        </div>
        {dependentes.length === 0 ? (
          <p className="text-xs text-slate-500">Cônjuge, filhos ou outras pessoas que moram com você. Opcional.</p>
        ) : (
          dependentes.map((d, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[2fr_1fr_auto]">
              <div>
                <label htmlFor={`ac-dep-nome-${i}`} className="sr-only">Nome do morador {i + 1}</label>
                <input id={`ac-dep-nome-${i}`} placeholder="Nome" value={d.nome} onChange={(e) => setDependentes((p) => p.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)))} className={inputCls} />
              </div>
              <div className="col-span-1 row-start-2 sm:row-start-auto">
                <label htmlFor={`ac-dep-tel-${i}`} className="sr-only">Telefone do morador {i + 1}</label>
                <input id={`ac-dep-tel-${i}`} type="tel" placeholder="Telefone (opcional)" value={d.telefone} onChange={(e) => setDependentes((p) => p.map((x, j) => (j === i ? { ...x, telefone: e.target.value } : x)))} className={inputCls} />
              </div>
              <button type="button" onClick={() => setDependentes((p) => p.filter((_, j) => j !== i))} aria-label={`Remover morador ${i + 1}`} className="mt-1 self-start rounded-lg p-2.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>

      <div className={sectionCls}>
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
            <Car className="h-3.5 w-3.5 text-[#00A8E8]" /> Veículos
          </h3>
          {veiculos.length < MAX_VEICULOS && (
            <button type="button" onClick={() => setVeiculos((p) => [...p, { placa: '', marca: '', modelo: '', cor: '' }])} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-[#0A6E9C] hover:bg-sky-50">
              <Plus className="h-3.5 w-3.5" /> Adicionar
            </button>
          )}
        </div>
        {veiculos.length === 0 ? (
          <p className="text-xs text-slate-500">Carros e motos que usam a garagem. Opcional.</p>
        ) : (
          veiculos.map((v, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Veículo {i + 1}</span>
                <button type="button" onClick={() => setVeiculos((p) => p.filter((_, j) => j !== i))} aria-label={`Remover veículo ${i + 1}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(['placa', 'modelo', 'marca', 'cor'] as const).map((campo) => (
                  <div key={campo}>
                    <label htmlFor={`ac-v-${campo}-${i}`} className={labelCls}>
                      {{ placa: 'Placa', modelo: 'Modelo', marca: 'Marca', cor: 'Cor' }[campo]}
                    </label>
                    <input
                      id={`ac-v-${campo}-${i}`}
                      value={v[campo]}
                      placeholder={{ placa: 'ABC1D23', modelo: 'Ex: Onix', marca: 'Ex: Chevrolet', cor: 'Ex: Prata' }[campo]}
                      autoCapitalize={campo === 'placa' ? 'characters' : undefined}
                      onChange={(e) => setVeiculos((p) => p.map((x, j) => (j === i ? { ...x, [campo]: e.target.value } : x)))}
                      className={inputCls}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {modo === 'novo' && (
        <label className="flex items-start gap-2.5 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-xs text-slate-700">
          <input type="checkbox" checked={consentimento} onChange={(e) => setConsentimento(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#0B2545]" />
          <span>
            Concordo que meu <strong>nome</strong> e minha <strong>unidade</strong> fiquem visíveis para os demais moradores na lista de unidades do condomínio.
            Telefone, e-mail, CPF e veículos ficam restritos à administração.
          </span>
        </label>
      )}

      {erro && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          <p className="text-xs text-red-700">{erro}</p>
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={enviando} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            Cancelar
          </button>
        )}
        <button type="submit" disabled={enviando} className="flex items-center justify-center gap-2 rounded-xl bg-[#0B2545] px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-[#134074] disabled:opacity-60">
          {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
