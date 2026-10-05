import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ADMIN_ROLES } from '@/lib/roles';

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role, name')
    .eq('id', user.id)
    .single();

  if (!callerProfile || !ADMIN_ROLES.includes(callerProfile.role)) {
    return NextResponse.json({ error: 'Apenas Síndico ou Administradora podem excluir usuários.' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const userId: string | undefined = body?.userId;
  if (!userId) {
    return NextResponse.json({ error: 'Usuário não informado.' }, { status: 400 });
  }

  if (userId === user.id) {
    return NextResponse.json({ error: 'Você não pode excluir a própria conta enquanto está logado.' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Ninguém exclui o Síndico pelo app (nem o ADM): o condomínio não pode ficar sem Síndico por engano.
  // A saída do cargo é "Transferir cargo" (issue #53); depois de rebaixado, ele é uma conta comum.
  const { data: alvo } = await admin.from('profiles').select('role').eq('id', userId).maybeSingle();
  if (alvo?.role === 'SINDICO') {
    return NextResponse.json({ error: 'O Síndico não pode ser excluído por aqui. Para sair do cargo, transfira-o.' }, { status: 403 });
  }

  // Transferência de cargo pendente que envolve essa conta (origem ou destino) perde o sentido: cancela
  // junto, com o convite dela, para a tela não ficar com um convite fantasma.
  const { data: pendentes } = await admin
    .from('cargo_transferencias')
    .select('id, cargo, destino_nome')
    .eq('status', 'PENDENTE')
    .or(`origem_id.eq.${userId},destino_id.eq.${userId}`);
  for (const t of pendentes ?? []) {
    await admin.from('cargo_transferencias').update({ status: 'CANCELADA', concluido_em: new Date().toISOString(), invite_id: null }).eq('id', t.id);
    await admin.from('pending_invites').delete().eq('transferencia_id', t.id);
    await admin.from('audit_logs').insert({
      usuario_id: user.id,
      usuario_nome: callerProfile.name,
      usuario_role: callerProfile.role,
      acao: `Cancelou a transferência do cargo para ${t.destino_nome} (a conta envolvida foi excluída)`,
      modulo: 'SISTEMA',
      detalhes: { transferenciaId: t.id, cargo: t.cargo, resultado: 'CANCELADA', executorId: user.id },
    });
  }

  // Um autocadastro ainda pendente dessa conta deixaria de fazer sentido (e
  // continuaria aparecendo como "aguardando" na lista de unidades).
  await admin
    .from('autocadastros')
    .update({ status: 'RECUSADO', motivo_recusa: 'Acesso excluído pela administração', validado_em: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('status', 'AGUARDANDO');

  // Se o usuário for o morador prioritário de alguma unidade, desvincula antes
  // de excluir, pra não deixar a unidade apontando pra uma conta inexistente.
  await supabase
    .from('units')
    .update({ usuario_id: null, status_convite: 'NAO_ENVIADO' })
    .eq('usuario_id', userId);

  await admin.from('profiles').delete().eq('id', userId);
  const { error: authDeleteError } = await admin.auth.admin.deleteUser(userId);
  if (authDeleteError) {
    console.error('excluir usuario - deleteUser:', authDeleteError);
    return NextResponse.json({ error: 'Erro ao excluir o usuário do sistema de autenticação.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
