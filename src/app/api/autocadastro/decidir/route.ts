import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ADMIN_ROLES } from '@/lib/roles';
import type { AutocadastroDependente, AutocadastroVeiculo, UnitResident } from '@/types';

interface Resultado {
  id: string;
  ok: boolean;
  mensagem: string;
}

type Admin = ReturnType<typeof createAdminClient>;
type Envio = {
  id: string;
  unit_id: string;
  user_id: string | null;
  nome: string;
  email: string;
  telefone: string;
  rg_cpf: string | null;
  tipo: 'PROPRIETARIO' | 'INQUILINO';
  dependentes: AutocadastroDependente[];
  veiculos: AutocadastroVeiculo[];
  status: string;
};

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const { data: caller } = await supabase.from('profiles').select('name, role').eq('id', user.id).single();
  if (!caller || !ADMIN_ROLES.includes(caller.role)) {
    return NextResponse.json({ error: 'Apenas Síndico, Subsíndico ou Administradora podem validar cadastros.' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((i: unknown) => typeof i === 'string') : [];
  const acao = body?.acao === 'VALIDAR' ? 'VALIDAR' : body?.acao === 'RECUSAR' ? 'RECUSAR' : null;
  const motivo = typeof body?.motivo === 'string' ? body.motivo.trim().slice(0, 300) : '';
  if (ids.length === 0 || !acao) {
    return NextResponse.json({ error: 'Informe os cadastros e a ação (validar ou recusar).' }, { status: 400 });
  }

  const admin = createAdminClient();
  const resultados: Resultado[] = [];

  for (const id of ids) {
    const { data: envio } = await admin.from('autocadastros').select('*').eq('id', id).maybeSingle<Envio>();
    if (!envio || envio.status !== 'AGUARDANDO') {
      resultados.push({ id, ok: false, mensagem: 'Cadastro não encontrado ou já decidido.' });
      continue;
    }
    const r = acao === 'VALIDAR'
      ? await validar(admin, envio, caller.name)
      : await recusar(admin, envio, caller.name, motivo);
    resultados.push({ id, ...r });

    if (r.ok) {
      await admin.from('audit_logs').insert({
        usuario_id: user.id,
        usuario_nome: caller.name,
        usuario_role: caller.role,
        acao: acao === 'VALIDAR'
          ? `Validou o autocadastro de ${envio.nome}`
          : `Recusou o autocadastro de ${envio.nome}${motivo ? ` (${motivo})` : ''}`,
        modulo: 'UNIDADES',
        detalhes: { autocadastroId: envio.id, unitId: envio.unit_id, email: envio.email },
      });
    }
  }

  return NextResponse.json({ resultados });
}

async function validar(admin: Admin, envio: Envio, validadoPor: string): Promise<{ ok: boolean; mensagem: string }> {
  if (!envio.user_id) {
    return { ok: false, mensagem: `A conta de ${envio.nome} não existe mais. Recuse este cadastro.` };
  }

  const { data: unidade } = await admin.from('units').select('*').eq('id', envio.unit_id).maybeSingle();
  if (!unidade) {
    return { ok: false, mensagem: 'A unidade deste cadastro não existe mais.' };
  }
  const rotulo = `${unidade.numero} (Bloco ${unidade.bloco})`;

  // Uma unidade tem um único login de titular. Trocar de titular exige
  // remover o atual antes, pra não deixar duas contas com acesso à unidade.
  if (unidade.usuario_id && unidade.usuario_id !== envio.user_id) {
    return {
      ok: false,
      mensagem: `A unidade ${rotulo} já tem um titular com acesso. Remova o acesso dele em Usuários antes de validar ${envio.nome}, ou recuse este cadastro.`,
    };
  }

  const prioritario: UnitResident = {
    nome: envio.nome,
    tipo: envio.tipo === 'PROPRIETARIO' ? 'TITULAR' : 'INQUILINO',
    telefone: envio.telefone,
    rgCpf: envio.rg_cpf ?? undefined,
    email: envio.email,
  };
  const novosDependentes: UnitResident[] = envio.dependentes.map((d) => ({ nome: d.nome, tipo: 'DEPENDENTE', telefone: d.telefone }));
  const nomesNovos = new Set([prioritario, ...novosDependentes].map((m) => m.nome.toLowerCase()));

  // Mantém moradores adicionais que o síndico já tinha cadastrado (sem
  // duplicar nomes); o titular anterior sem login é substituído.
  const existentes: UnitResident[] = Array.isArray(unidade.moradores) ? unidade.moradores : [];
  const prioritarioAntigo = existentes.findIndex((m) => m.tipo === 'TITULAR' || m.tipo === 'INQUILINO');
  const mantidos = existentes.filter((m, i) => i !== prioritarioAntigo && !nomesNovos.has(m.nome.toLowerCase()));

  const updateUnidade: Record<string, unknown> = {
    moradores: [prioritario, ...novosDependentes, ...mantidos],
    tipo_ocupacao: envio.tipo,
    usuario_id: envio.user_id,
    status_convite: 'ATIVO',
  };
  if (envio.tipo === 'PROPRIETARIO') {
    updateUnidade.proprietario_nome = envio.nome;
    updateUnidade.proprietario_telefone = envio.telefone;
    updateUnidade.proprietario_email = envio.email;
  }

  const { error: unidadeError } = await admin.from('units').update(updateUnidade).eq('id', unidade.id);
  if (unidadeError) {
    console.error('autocadastro validar unit:', unidadeError);
    return { ok: false, mensagem: `Erro ao atualizar a unidade ${rotulo}.` };
  }

  const { error: perfilError } = await admin
    .from('profiles')
    .update({ cadastro_validado: true, name: envio.nome, telefone: envio.telefone, bloco: unidade.bloco, unidade: unidade.numero })
    .eq('id', envio.user_id);
  if (perfilError) {
    console.error('autocadastro validar profile:', perfilError);
    return { ok: false, mensagem: `Unidade atualizada, mas houve erro ao liberar o acesso de ${envio.nome}. Tente validar de novo.` };
  }

  const placasIgnoradas: string[] = [];
  for (const v of envio.veiculos) {
    const { data: existente } = await admin.from('vehicles').select('id').eq('placa', v.placa).maybeSingle();
    if (existente) {
      placasIgnoradas.push(v.placa);
      continue;
    }
    const { error } = await admin.from('vehicles').insert({
      placa: v.placa,
      marca: v.marca || '—',
      modelo: v.modelo,
      cor: v.cor || '—',
      bloco: unidade.bloco,
      unidade: unidade.numero,
      unit_id: unidade.id,
      vaga: unidade.vagas_garagem?.[0] || 'A definir',
      proprietario_nome: envio.nome,
      telefone_contato: envio.telefone,
      status: 'ATIVO',
    });
    if (error) {
      console.error('autocadastro validar vehicle:', error);
      placasIgnoradas.push(v.placa);
    }
  }

  await admin
    .from('autocadastros')
    .update({ status: 'VALIDADO', validado_em: new Date().toISOString(), validado_por: validadoPor })
    .eq('id', envio.id);

  await admin.from('notifications').insert({
    titulo: 'Cadastro validado!',
    mensagem: `Seu cadastro na Unidade ${rotulo} foi validado pela administração. Agora você tem acesso completo ao portal.`,
    tipo: 'GERAL',
    unidade_alvo: unidade.numero,
    unidade_id_alvo: unidade.id,
    link_destino: '/',
  });

  return {
    ok: true,
    mensagem: placasIgnoradas.length
      ? `${envio.nome} validado(a) na unidade ${rotulo}. Veículo(s) não cadastrado(s) por já existir(em) ou erro: ${placasIgnoradas.join(', ')}.`
      : `${envio.nome} validado(a) na unidade ${rotulo}.`,
  };
}

async function recusar(admin: Admin, envio: Envio, validadoPor: string, motivo: string): Promise<{ ok: boolean; mensagem: string }> {
  if (envio.user_id) {
    await admin.from('units').update({ usuario_id: null, status_convite: 'NAO_ENVIADO' }).eq('usuario_id', envio.user_id);
    await admin.from('profiles').delete().eq('id', envio.user_id);
    const { error } = await admin.auth.admin.deleteUser(envio.user_id);
    if (error) {
      console.error('autocadastro recusar deleteUser:', error);
      return { ok: false, mensagem: `Erro ao remover a conta de ${envio.nome}. Tente novamente.` };
    }
  }

  await admin
    .from('autocadastros')
    .update({
      status: 'RECUSADO',
      motivo_recusa: motivo || null,
      validado_em: new Date().toISOString(),
      validado_por: validadoPor,
    })
    .eq('id', envio.id);

  return { ok: true, mensagem: `Cadastro de ${envio.nome} recusado e acesso removido.` };
}
