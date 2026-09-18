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
    return NextResponse.json({ error: 'Apenas Síndico ou Administradora podem excluir unidades.' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const unitId: string | undefined = body?.unitId;
  if (!unitId) {
    return NextResponse.json({ error: 'Unidade não informada.' }, { status: 400 });
  }

  const { data: unit, error: fetchError } = await supabase
    .from('units')
    .select('id, numero, bloco, usuario_id')
    .eq('id', unitId)
    .single();

  if (fetchError || !unit) {
    return NextResponse.json({ error: 'Unidade não encontrada.' }, { status: 404 });
  }

  const admin = createAdminClient();
  let usuarioRemovido = false;

  // Se já existe um usuário/login vinculado a essa unidade, remove ele também
  // (Auth + profile) para não deixar uma conta órfã sem unidade.
  if (unit.usuario_id) {
    await admin.from('profiles').delete().eq('id', unit.usuario_id);
    const { error: authDeleteError } = await admin.auth.admin.deleteUser(unit.usuario_id);
    if (authDeleteError) {
      console.error('excluir unidade - deleteUser:', authDeleteError);
    } else {
      usuarioRemovido = true;
    }
  }

  const { error: deleteError } = await supabase.from('units').delete().eq('id', unitId);
  if (deleteError) {
    return NextResponse.json({ error: 'Erro ao excluir a unidade.' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    numero: unit.numero,
    bloco: unit.bloco,
    usuarioRemovido,
  });
}
