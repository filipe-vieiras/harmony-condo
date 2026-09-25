import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { validarDados } from '@/lib/autocadastro';

// Lista de unidades (só bloco/número) para o morador provisório poder trocar a
// unidade escolhida — a RLS de units não deixa ele ler as outras diretamente.
export async function GET() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }
  const admin = createAdminClient();
  const { data: unidades } = await admin
    .from('units')
    .select('id, bloco, numero')
    .order('bloco', { ascending: true })
    .order('numero', { ascending: true });
  return NextResponse.json({ unidades: unidades ?? [] });
}

// Correção do próprio envio enquanto aguarda validação (inclusive trocar a
// unidade, caso tenha escolhido a errada). Depois de validado, quem edita é
// o síndico pelas telas de Moradores e Veículos.
export async function PATCH(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const validacao = validarDados(await request.json().catch(() => null));
  if (!validacao.ok) {
    return NextResponse.json({ error: validacao.erro }, { status: 400 });
  }
  const dados = validacao.dados;

  const admin = createAdminClient();

  const { data: envio } = await admin
    .from('autocadastros')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'AGUARDANDO')
    .order('criado_em', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!envio) {
    return NextResponse.json({ error: 'Não há cadastro aguardando validação para corrigir.' }, { status: 404 });
  }

  const { data: unidade } = await admin.from('units').select('id').eq('id', dados.unitId).maybeSingle();
  if (!unidade) {
    return NextResponse.json({ error: 'Unidade não encontrada.' }, { status: 400 });
  }

  const { error } = await admin
    .from('autocadastros')
    .update({
      unit_id: dados.unitId,
      nome: dados.nome,
      telefone: dados.telefone,
      rg_cpf: dados.rgCpf ?? null,
      tipo: dados.tipo,
      dependentes: dados.dependentes,
      veiculos: dados.veiculos,
      atualizado_em: new Date().toISOString(),
    })
    .eq('id', envio.id);
  if (error) {
    console.error('autocadastro meu update:', error);
    return NextResponse.json({ error: 'Não foi possível salvar a correção.' }, { status: 500 });
  }

  await admin.from('profiles').update({ name: dados.nome, telefone: dados.telefone }).eq('id', user.id);

  return NextResponse.json({ success: true });
}
