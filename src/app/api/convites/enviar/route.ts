import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ADMIN_ROLES, SINGLETON_ROLES } from '@/lib/roles';

interface SendResult {
  id: string;
  ok: boolean;
  mensagem?: string;
}

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!callerProfile || !ADMIN_ROLES.includes(callerProfile.role)) {
    return NextResponse.json({ error: 'Apenas Síndico ou Administradora podem enviar convites.' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const ids: string[] = body?.ids ?? [];
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'Nenhum convite selecionado.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const origin = request.nextUrl.origin;

  const { data: invites, error: fetchError } = await supabase
    .from('pending_invites')
    .select('*')
    .in('id', ids)
    .eq('status', 'PENDENTE');

  if (fetchError) {
    return NextResponse.json({ error: 'Erro ao carregar convites pendentes.' }, { status: 500 });
  }

  const results: SendResult[] = [];

  for (const invite of invites ?? []) {
    // Trava de singleton: no máximo um SINDICO e um ADM ativos.
    if (SINGLETON_ROLES.includes(invite.role)) {
      const { data: existing } = await admin
        .from('profiles')
        .select('id')
        .eq('role', invite.role)
        .limit(1);

      if (existing && existing.length > 0) {
        const msg = `Já existe um usuário ativo com o perfil ${invite.role}.`;
        await supabase.from('pending_invites').update({ status: 'ERRO', erro_mensagem: msg }).eq('id', invite.id);
        results.push({ id: invite.id, ok: false, mensagem: msg });
        continue;
      }
    }

    const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(invite.email, {
      data: { name: invite.nome, role: invite.role, bloco: invite.bloco, unidade: invite.unidade },
      redirectTo: `${origin}/api/auth/callback?next=/`,
    });

    if (inviteError || !inviteData?.user) {
      const msg = inviteError?.message ?? 'Falha ao enviar convite.';
      await supabase.from('pending_invites').update({ status: 'ERRO', erro_mensagem: msg }).eq('id', invite.id);
      results.push({ id: invite.id, ok: false, mensagem: msg });
      continue;
    }

    const newUserId = inviteData.user.id;

    const { error: profileError } = await admin.from('profiles').insert({
      id: newUserId,
      name: invite.nome,
      email: invite.email,
      role: invite.role,
      bloco: invite.bloco,
      unidade: invite.unidade,
    });

    if (profileError) {
      // Sem profile, o usuário loga mas não tem perfil/permissão nenhuma — desfaz o
      // usuário criado no Auth para não deixar estado inconsistente e permitir reenvio.
      await admin.auth.admin.deleteUser(newUserId);
      const msg = `Falha ao criar o perfil: ${profileError.message}`;
      console.error('convites/enviar profile insert:', profileError);
      await supabase.from('pending_invites').update({ status: 'ERRO', erro_mensagem: msg }).eq('id', invite.id);
      results.push({ id: invite.id, ok: false, mensagem: msg });
      continue;
    }

    const nowIso = new Date().toISOString();
    await supabase.from('pending_invites').update({ status: 'ENVIADO', enviado_em: nowIso }).eq('id', invite.id);

    if (invite.unit_id) {
      await supabase.from('units').update({ status_convite: 'ENVIADO', usuario_id: newUserId }).eq('id', invite.unit_id);
    }

    results.push({ id: invite.id, ok: true });
  }

  return NextResponse.json({ results });
}
