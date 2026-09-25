import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { validarNovaConta } from '@/lib/autocadastro';

// Rota pública (liberada no middleware): sem sessão, por isso tudo aqui usa o
// service role e só devolve o mínimo — bloco e número das unidades.

const LIMITE_POR_HORA = 5;

export async function GET() {
  const admin = createAdminClient();
  const { data: config } = await admin.from('autocadastro_config').select('aberto').eq('id', 1).single();
  if (!config?.aberto) {
    return NextResponse.json({ aberto: false, unidades: [] });
  }
  const { data: unidades } = await admin
    .from('units')
    .select('id, bloco, numero')
    .order('bloco', { ascending: true })
    .order('numero', { ascending: true });
  return NextResponse.json({ aberto: true, unidades: unidades ?? [] });
}

function hashIp(request: NextRequest): string {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'desconhecido';
  // Guarda só o hash (LGPD): serve para limitar envios repetidos, não para identificar ninguém.
  return createHash('sha256').update(`${ip}:${process.env.SUPABASE_SERVICE_ROLE_KEY}`).digest('hex');
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  // Campo invisível para humanos: se veio preenchido, é robô.
  if (body?.website) {
    return NextResponse.json({ error: 'Não foi possível concluir o cadastro.' }, { status: 400 });
  }

  const validacao = validarNovaConta(body);
  if (!validacao.ok) {
    return NextResponse.json({ error: validacao.erro }, { status: 400 });
  }
  const dados = validacao.dados;

  const admin = createAdminClient();

  const { data: config } = await admin.from('autocadastro_config').select('aberto').eq('id', 1).single();
  if (!config?.aberto) {
    return NextResponse.json({ error: 'O cadastro pelo link está fechado no momento. Fale com o síndico.' }, { status: 403 });
  }

  const ipHash = hashIp(request);
  const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: enviosRecentes } = await admin
    .from('autocadastros')
    .select('id', { count: 'exact', head: true })
    .eq('origem_ip_hash', ipHash)
    .gte('criado_em', umaHoraAtras);
  if ((enviosRecentes ?? 0) >= LIMITE_POR_HORA) {
    return NextResponse.json({ error: 'Muitos cadastros enviados desta conexão. Tente novamente mais tarde.' }, { status: 429 });
  }

  const { data: unidade } = await admin.from('units').select('id').eq('id', dados.unitId).maybeSingle();
  if (!unidade) {
    return NextResponse.json({ error: 'Unidade não encontrada. Recarregue a página e selecione novamente.' }, { status: 400 });
  }

  const { data: criado, error: authError } = await admin.auth.admin.createUser({
    email: dados.email,
    password: dados.senha,
    email_confirm: true,
    user_metadata: { name: dados.nome },
  });
  if (authError || !criado?.user) {
    const msg = authError?.message?.toLowerCase() ?? '';
    if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
      return NextResponse.json(
        { error: 'Já existe uma conta com esse e-mail. Entre pela tela de login (use "Esqueceu a senha?" se precisar).' },
        { status: 409 }
      );
    }
    console.error('autocadastro createUser:', authError);
    return NextResponse.json({ error: 'Não foi possível criar a sua conta. Tente novamente.' }, { status: 500 });
  }
  const userId = criado.user.id;

  // Bloco/unidade ficam vazios no perfil até a validação: várias policies
  // antigas liberam dados da unidade comparando com profiles.unidade.
  const { error: perfilError } = await admin.from('profiles').insert({
    id: userId,
    name: dados.nome,
    email: dados.email,
    role: 'MORADOR',
    telefone: dados.telefone,
    cadastro_validado: false,
  });
  if (perfilError) {
    console.error('autocadastro profile:', perfilError);
    await admin.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: 'Não foi possível criar a sua conta. Tente novamente.' }, { status: 500 });
  }

  const { error: envioError } = await admin.from('autocadastros').insert({
    unit_id: dados.unitId,
    user_id: userId,
    nome: dados.nome,
    email: dados.email,
    telefone: dados.telefone,
    rg_cpf: dados.rgCpf ?? null,
    tipo: dados.tipo,
    dependentes: dados.dependentes,
    veiculos: dados.veiculos,
    origem_ip_hash: ipHash,
  });
  if (envioError) {
    console.error('autocadastro insert:', envioError);
    await admin.from('profiles').delete().eq('id', userId);
    await admin.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: 'Não foi possível registrar o seu cadastro. Tente novamente.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
