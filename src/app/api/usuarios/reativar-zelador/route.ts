import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { devolverAcessoAuth } from '@/lib/acessoRemovido';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MENSAGENS: Record<string, string> = {
  sem_permissao: 'Só o Síndico e a Administradora podem reativar o acesso do Zelador.',
  nao_desativado: 'Essa conta não é de um ex-Zelador com acesso removido.',
  cargo_ocupado: 'O cargo de Zelador não está vago. Cancele o convite ou a transferência pendente antes.',
  dados_invalidos: 'Usuário não informado.',
};

/**
 * Devolve o acesso a um ex-Zelador (conta desativada). Só Síndico e ADM, só com o cargo vago; a função do banco confere tudo
 * relendo o perfil de quem pede e audita. Depois dela, tira o ban do Auth.
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const userId = body?.userId;
  if (typeof userId !== 'string' || !UUID.test(userId)) {
    return NextResponse.json({ error: MENSAGENS.dados_invalidos, codigo: 'dados_invalidos' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc('reativar_acesso_zelador', { p_executor: user.id, p_alvo: userId });
  if (error || !data) {
    console.error('reativar-zelador rpc:', error);
    return NextResponse.json({ error: 'Não deu para reativar. Tente de novo.', codigo: 'erro' }, { status: 500 });
  }
  if (!data.ok) {
    const codigo = String(data.codigo ?? 'erro');
    return NextResponse.json(
      { error: MENSAGENS[codigo] ?? 'Não deu para reativar. Tente de novo.', codigo },
      { status: codigo === 'sem_permissao' ? 403 : codigo === 'dados_invalidos' ? 400 : 409 },
    );
  }

  const desbanido = await devolverAcessoAuth(admin, userId);
  if (!desbanido) console.error('reativar-zelador: acesso reativado no banco, mas o ban do Auth não saiu.');
  return NextResponse.json({ success: true, nome: data.nome, banRemovido: desbanido });
}
