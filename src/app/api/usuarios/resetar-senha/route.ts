import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { montarLinkAcesso } from '@/lib/linkAcesso';
import { avisaTitularNaRedefinicao, MSG_CONTA_PENDENTE, MSG_SEM_NIVEL, podeAdministrarContaPendente, podeAgirSobre } from '@/lib/hierarquia';
import { cargoEfetivoDoAlvo } from '@/lib/alvoEfetivo';
import { avisarUsuario, gravarAuditoria } from '@/lib/auditoriaServidor';
import { ROLE_LABELS_CURTO } from '@/lib/roles';
import type { Role } from '@/types';

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const admin = createAdminClient();
  // O perfil de quem pede é relido do banco a cada chamada (nunca do que o navegador manda).
  const { data: caller } = await admin.from('profiles').select('id, name, role, desativado_em').eq('id', user.id).maybeSingle();
  if (!caller || caller.desativado_em || (caller.role !== 'SINDICO' && caller.role !== 'SUBSINDICO' && caller.role !== 'ADM')) {
    return NextResponse.json({ error: 'Apenas Síndico, Subsíndico ou Administradora podem gerar links de redefinição de senha.' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const userId: string | undefined = body?.userId;
  if (!userId) {
    return NextResponse.json({ error: 'Usuário não informado.' }, { status: 400 });
  }

  const { data: targetProfile } = await admin
    .from('profiles')
    .select('id, name, role, email, desativado_em')
    .eq('id', userId)
    .maybeSingle();

  if (!targetProfile?.email) {
    return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
  }

  // Hierarquia (#68): só sobre conta de nível estritamente menor; o ADM também recupera o acesso do Síndico.
  // Conta convidada com cargo pendente vale pelo nível do cargo de destino (senão o Subsíndico a sequestraria e aceitaria o cargo).
  const efetivo = await cargoEfetivoDoAlvo(admin, targetProfile);
  if (efetivo.pendente && !podeAdministrarContaPendente(caller.role)) {
    return NextResponse.json({ error: MSG_CONTA_PENDENTE, codigo: 'conta_pendente' }, { status: 403 });
  }
  if (!podeAgirSobre(caller.role, efetivo.cargo, 'RESETAR_SENHA', targetProfile.id === caller.id)) {
    return NextResponse.json({ error: efetivo.cargo === 'ZELADOR' ? MSG_SEM_NIVEL.ZELADOR_CONTA : MSG_SEM_NIVEL.RESETAR_SENHA, codigo: 'sem_nivel' }, { status: 403 });
  }
  // Acesso removido (ex-Zelador): não se gera link para conta que não entra. Reative o acesso antes.
  if (targetProfile.desativado_em) {
    return NextResponse.json({ error: 'O acesso dessa conta foi removido. Reative o acesso antes de gerar um link.' }, { status: 409 });
  }

  // No Vercel, request.nextUrl.origin às vezes reflete a URL interna do
  // deploy (com hash), não o domínio público — por isso SITE_URL tem
  // prioridade quando configurada (ver .env.local / env do Vercel).
  const origin = process.env.SITE_URL ?? request.nextUrl.origin;

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

  // Auditoria no servidor, depois do sucesso: quem, em quem e o quê (sem e-mail nem telefone).
  await gravarAuditoria(admin, caller, `Gerou link de redefinição de senha para ${targetProfile.name} (${ROLE_LABELS_CURTO[targetProfile.role as Role] ?? targetProfile.role})`, {
    acao: 'RESETAR_SENHA', alvoId: targetProfile.id, alvoCargo: targetProfile.role,
  });
  // Quem tem a senha redefinida em conta de nível alto (Síndico, ADM) ou o Zelador é avisado no sino.
  if (avisaTitularNaRedefinicao(targetProfile.role)) {
    await avisarUsuario(admin, targetProfile.id, 'Link de redefinição de senha gerado',
      `${caller.name} (${ROLE_LABELS_CURTO[caller.role as Role] ?? caller.role}) gerou um link para redefinir a senha da sua conta. Se você não esperava isso, fale com a administração.`);
  }

  // Link para a nossa página (token só é gasto no toque em "Continuar"), não o
  // action_link do Supabase, que robôs de pré-visualização consomem.
  return NextResponse.json({ link: montarLinkAcesso(origin, linkData.properties) });
}
