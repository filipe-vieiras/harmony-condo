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
    .select('role')
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
