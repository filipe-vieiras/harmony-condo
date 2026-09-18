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
    return NextResponse.json({ error: 'Apenas Síndico ou Administradora podem gerar links de redefinição de senha.' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const userId: string | undefined = body?.userId;
  if (!userId) {
    return NextResponse.json({ error: 'Usuário não informado.' }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: targetProfile } = await admin
    .from('profiles')
    .select('email')
    .eq('id', userId)
    .single();

  if (!targetProfile?.email) {
    return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
  }

  const origin = request.nextUrl.origin;

  // Assim como no convite: redireciona direto pra /definir-senha (não pra
  // /api/auth/callback), porque links gerados via Admin API voltam com o
  // token no fragmento da URL (#access_token=...), que só o navegador lê —
  // uma rota server-side nunca recebe o fragmento.
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: targetProfile.email,
    options: {
      redirectTo: `${origin}/definir-senha`,
    },
  });

  if (linkError || !linkData?.properties?.action_link) {
    return NextResponse.json({ error: linkError?.message ?? 'Falha ao gerar o link de redefinição.' }, { status: 500 });
  }

  return NextResponse.json({ link: linkData.properties.action_link });
}
