import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { removerAcessoAuth } from '@/lib/acessoRemovido';

/**
 * Chamada pela tela "Criar senha" logo depois de a pessoa definir a senha: se ela é o destino de uma
 * transferência de cargo pendente, o cargo passa a valer agora (a função do banco confere de novo que
 * a origem ainda é a titular). Quem não tem pendência recebe `aplicada: false` e nada acontece.
 * Só age sobre a PRÓPRIA sessão: não recebe id de ninguém.
 */
export async function POST() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin.rpc('aceitar_transferencia_cargo', { p_usuario: user.id });
  if (error || !data) {
    console.error('aceitar transferencia rpc:', error);
    return NextResponse.json({ error: 'Não deu para ativar o cargo agora.', codigo: 'erro' }, { status: 500 });
  }
  if (!data.ok) {
    return NextResponse.json(
      { aplicada: false, falhou: true, error: `O cargo não foi ativado: ${data.motivo ?? 'a transferência mudou'}. Quem pediu foi avisado.`, codigo: data.codigo },
      { status: 409 },
    );
  }

  // Convite do Zelador pela fila (cargo vago): a conta nasceu desativada e o aceite a ativa (mesmo caminho da transferência).
  if (!data.aplicada) {
    const { data: ativ, error: ativErr } = await admin.rpc('ativar_convite_zelador', { p_usuario: user.id });
    if (ativErr || !ativ) {
      console.error('ativar convite zelador rpc:', ativErr);
      return NextResponse.json({ error: 'Não deu para ativar o cargo agora.', codigo: 'erro' }, { status: 500 });
    }
    if (!ativ.ok) {
      return NextResponse.json({ aplicada: false, falhou: true, error: 'O cargo de Zelador já está ocupado. Quem pediu foi avisado.', codigo: ativ.codigo }, { status: 409 });
    }
    if (ativ.aplicada) return NextResponse.json({ aplicada: true, cargo: ativ.cargo });
  }

  // Zelador: quem saiu teve o acesso removido no banco (conta desativada). Aqui entra o cinto e suspensório: ban no Auth e fim das
  // sessões. Falha não desfaz a troca (o banco já barra na próxima requisição) e nunca imprime segredo.
  let acessoRemovido: { ban: boolean; sessoes: boolean } | undefined;
  if (data.aplicada && data.origemAcessoRemovido && typeof data.origemId === 'string') {
    acessoRemovido = await removerAcessoAuth(admin, data.origemId);
    if (!acessoRemovido.ban || !acessoRemovido.sessoes) {
      console.error('aceitar transferencia: acesso removido no banco; ban/sessões incompletos', acessoRemovido);
    }
  }
  return NextResponse.json({ aplicada: !!data.aplicada, cargo: data.cargo, origemAcessoRemovido: !!acessoRemovido });
}
