import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

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
  return NextResponse.json({ aplicada: !!data.aplicada, cargo: data.cargo });
}
