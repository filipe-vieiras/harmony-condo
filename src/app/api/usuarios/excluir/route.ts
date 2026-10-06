import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { MSG_CONTA_PENDENTE, MSG_SEM_NIVEL, podeAdministrarContaPendente, podeAgirSobre } from '@/lib/hierarquia';
import { cargoEfetivoDoAlvo } from '@/lib/alvoEfetivo';
import { gravarAuditoria } from '@/lib/auditoriaServidor';
import { ROLE_LABELS_CURTO } from '@/lib/roles';
import type { Role } from '@/types';

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: caller } = await admin.from('profiles').select('id, name, role, desativado_em').eq('id', user.id).maybeSingle();
  if (!caller || caller.desativado_em || (caller.role !== 'SINDICO' && caller.role !== 'SUBSINDICO' && caller.role !== 'ADM')) {
    return NextResponse.json({ error: 'Apenas Síndico, Subsíndico ou Administradora podem excluir usuários.' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const userId: string | undefined = body?.userId;
  if (!userId) {
    return NextResponse.json({ error: 'Usuário não informado.' }, { status: 400 });
  }

  if (userId === user.id) {
    return NextResponse.json({ error: MSG_SEM_NIVEL.PROPRIA_CONTA }, { status: 400 });
  }

  const { data: alvo } = await admin.from('profiles').select('id, name, role').eq('id', userId).maybeSingle();
  if (!alvo) {
    return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
  }

  // Ninguém exclui o Síndico (sai por transferência de cargo) nem a Administradora (gerida fora do app); e só se exclui
  // conta de nível estritamente menor que o de quem pede (#68).
  if (alvo.role === 'SINDICO') return NextResponse.json({ error: MSG_SEM_NIVEL.SINDICO_NAO_EXCLUI, codigo: 'sem_nivel' }, { status: 403 });
  if (alvo.role === 'ADM') return NextResponse.json({ error: MSG_SEM_NIVEL.ADM_NAO_EXCLUI, codigo: 'sem_nivel' }, { status: 403 });
  // Conta convidada com cargo pendente vale pelo nível do cargo de destino e só Síndico/ADM a administram.
  const { data: alvoMail } = await admin.from('profiles').select('email').eq('id', userId).maybeSingle();
  const efetivo = await cargoEfetivoDoAlvo(admin, { ...alvo, email: alvoMail?.email });
  if (efetivo.pendente && !podeAdministrarContaPendente(caller.role)) {
    return NextResponse.json({ error: MSG_CONTA_PENDENTE, codigo: 'conta_pendente' }, { status: 403 });
  }
  if (efetivo.cargo === 'SINDICO' || efetivo.cargo === 'ADM') {
    return NextResponse.json({ error: efetivo.cargo === 'SINDICO' ? MSG_SEM_NIVEL.SINDICO_NAO_EXCLUI : MSG_SEM_NIVEL.ADM_NAO_EXCLUI, codigo: 'sem_nivel' }, { status: 403 });
  }
  if (!podeAgirSobre(caller.role, efetivo.cargo, 'EXCLUIR', false)) {
    return NextResponse.json({ error: efetivo.cargo === 'ZELADOR' ? MSG_SEM_NIVEL.ZELADOR_CONTA : MSG_SEM_NIVEL.EXCLUIR, codigo: 'sem_nivel' }, { status: 403 });
  }

  // Transferência de cargo pendente que envolve essa conta (origem ou destino) perde o sentido: cancela junto, com o
  // convite dela. Se quem sai é a ORIGEM, a conta convidada (provisória, sem poder, sem unidade) não pode ficar sobrando:
  // some do banco e do Auth, como no cancelamento normal.
  const { data: pendentes } = await admin
    .from('cargo_transferencias')
    .select('id, cargo, destino_nome, destino_id, origem_id')
    .eq('status', 'PENDENTE')
    .or(`origem_id.eq.${userId},destino_id.eq.${userId}`);
  const contasConvidadasParaApagar: string[] = [];
  for (const t of pendentes ?? []) {
    await admin.from('cargo_transferencias').update({ status: 'CANCELADA', concluido_em: new Date().toISOString(), invite_id: null }).eq('id', t.id);
    await admin.from('pending_invites').delete().eq('transferencia_id', t.id);
    if (t.origem_id === userId && t.destino_id && t.destino_id !== userId) {
      const { data: conv } = await admin.from('profiles').select('id, role, cadastro_validado').eq('id', t.destino_id).maybeSingle();
      const { count: comUnidade } = await admin.from('units').select('id', { count: 'exact', head: true }).eq('usuario_id', t.destino_id);
      const { count: comAutocad } = await admin.from('autocadastros').select('id', { count: 'exact', head: true }).eq('user_id', t.destino_id);
      if (conv && conv.role === 'MORADOR' && conv.cadastro_validado === false && !comUnidade && !comAutocad) {
        contasConvidadasParaApagar.push(conv.id);
      }
    }
    await gravarAuditoria(admin, caller, `Cancelou a transferência do cargo para ${t.destino_nome} (a conta envolvida foi excluída)`, {
      transferenciaId: t.id, cargo: t.cargo, resultado: 'CANCELADA', executorId: caller.id,
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
  await admin
    .from('units')
    .update({ usuario_id: null, status_convite: 'NAO_ENVIADO' })
    .eq('usuario_id', userId);

  // Convite antigo (já aceito) com o e-mail da conta que sai: limpa, para o e-mail poder ser convidado de novo.
  if (alvoMail?.email) await admin.from('pending_invites').delete().ilike('email', alvoMail.email.replace(/[\\%_]/g, '\\$&')).is('transferencia_id', null);
  await admin.from('profiles').delete().eq('id', userId);
  const { error: authDeleteError } = await admin.auth.admin.deleteUser(userId);
  if (authDeleteError) {
    console.error('excluir usuario - deleteUser:', authDeleteError);
    return NextResponse.json({ error: 'Erro ao excluir o usuário do sistema de autenticação.' }, { status: 500 });
  }

  for (const id of contasConvidadasParaApagar) {
    await admin.from('profiles').delete().eq('id', id);
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) console.error('excluir usuario - conta convidada:', error.message);
  }

  await gravarAuditoria(admin, caller, `Excluiu o acesso de ${alvo.name} (${ROLE_LABELS_CURTO[alvo.role as Role] ?? alvo.role})`, {
    acao: 'EXCLUIR', alvoId: alvo.id, alvoCargo: alvo.role,
  });
  return NextResponse.json({ success: true });
}
