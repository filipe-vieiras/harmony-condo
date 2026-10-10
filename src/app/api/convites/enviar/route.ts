import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ADMIN_ROLES, SINGLETON_ROLES } from '@/lib/roles';
import { MSG_SEM_NIVEL, podeConvidarPara } from '@/lib/hierarquia';
import { gravarAuditoria } from '@/lib/auditoriaServidor';
import { textoVazio } from '@/lib/textoLivre';
import { montarLinkAcesso } from '@/lib/linkAcesso';

interface SendResult {
  id: string;
  ok: boolean;
  mensagem?: string;
  link?: string;
}

// Mensagem quando outra chamada já reservou/enviou o convite: não sobrescrevemos o estado dela.
const MSG_JA_ENVIANDO = 'Este convite já está sendo enviado. Aguarde e atualize a lista.';

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('id, name, role')
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
  // No Vercel, request.nextUrl.origin às vezes reflete a URL interna do
  // deploy (com hash), não o domínio público — por isso SITE_URL tem
  // prioridade quando configurada (ver .env.local / env do Vercel).
  const origin = process.env.SITE_URL ?? request.nextUrl.origin;

  // Aceita reenviar um convite que já tinha ficado com status ERRO (ex: limite de
  // e-mail do Supabase), sem exigir criar um registro novo na fila para tentar de novo.
  const { data: invites, error: fetchError } = await supabase
    .from('pending_invites')
    .select('*')
    .in('id', ids)
    .in('status', ['PENDENTE', 'ERRO']);

  if (fetchError) {
    return NextResponse.json({ error: 'Erro ao carregar convites pendentes.' }, { status: 500 });
  }

  const results: SendResult[] = [];

  // Convite que não veio da fila (já enviado, ou outra chamada está enviando agora): resposta clara, nunca lista vazia.
  const MSG_EM_ANDAMENTO = 'Este convite já está em andamento ou já foi enviado. Atualize a lista.';
  if (!invites || invites.length === 0) {
    return NextResponse.json({ error: MSG_EM_ANDAMENTO, codigo: 'em_andamento' }, { status: 409 });
  }
  for (const id of ids) {
    if (!invites.some((i) => i.id === id)) results.push({ id, ok: false, mensagem: MSG_EM_ANDAMENTO });
  }

  for (const invite of invites ?? []) {
    // Nome em branco (só espaços) não vira convite.
    if (textoVazio(String(invite.nome ?? ''))) {
      results.push({ id: invite.id, ok: false, mensagem: 'O convite está sem nome. Remova-o da fila e cadastre de novo.' });
      continue;
    }
    // Hierarquia (#68): só se convida para cargo que o executor pode convidar (nível menor que o dele; o Zelador, só Síndico e ADM).
    // Nada é criado nem alterado na fila quando a regra recusa.
    if (!podeConvidarPara(callerProfile.role, invite.role)) {
      results.push({ id: invite.id, ok: false, mensagem: invite.role === 'ZELADOR' ? MSG_SEM_NIVEL.ZELADOR : MSG_SEM_NIVEL.CONVITE });
      continue;
    }
    // O Zelador é funcionário externo: nunca com unidade (o banco também recusa).
    if (invite.role === 'ZELADOR' && (invite.unit_id || invite.bloco || invite.unidade)) {
      const recusa = 'O Zelador é funcionário externo e não pode ter unidade.';
      // Filtra por status: se outra chamada já reservou/enviou, não sobrescreve o ENVIADO dela com ERRO.
      const { data: marcado } = await admin.from('pending_invites').update({ status: 'ERRO', erro_mensagem: recusa })
        .eq('id', invite.id).in('status', ['PENDENTE', 'ERRO']).select('id');
      results.push({ id: invite.id, ok: false, mensagem: marcado && marcado.length > 0 ? recusa : MSG_JA_ENVIANDO });
      continue;
    }

    // Trava de singleton: no máximo um SINDICO e um ADM ativos.
    if (SINGLETON_ROLES.includes(invite.role)) {
      // Conta com acesso removido (ex-Zelador) não ocupa a vaga; transferência pendente do cargo ocupa.
      const { data: existing } = await admin
        .from('profiles')
        .select('id')
        .eq('role', invite.role)
        .or('desativado_em.is.null,aguardando_aceite.eq.true')
        .limit(1);
      const { data: transfPendente } = await admin
        .from('cargo_transferencias')
        .select('id')
        .eq('cargo', invite.role)
        .eq('status', 'PENDENTE')
        .limit(1);

      if ((existing && existing.length > 0) || (transfPendente && transfPendente.length > 0)) {
        const msg = `Já existe um usuário ativo com o perfil ${invite.role}.`;
        const { data: marcado } = await admin.from('pending_invites').update({ status: 'ERRO', erro_mensagem: msg })
          .eq('id', invite.id).in('status', ['PENDENTE', 'ERRO']).select('id');
        results.push({ id: invite.id, ok: false, mensagem: marcado && marcado.length > 0 ? msg : MSG_JA_ENVIANDO });
        continue;
      }
    }

    // Gera o link de convite sem enviar e-mail (o app não depende de SMTP): o
    // Síndico copia e encaminha manualmente (WhatsApp, etc.) pelo próprio app.
    //
    // redirectTo aponta direto pra /definir-senha (não pra /api/auth/callback):
    // links gerados via Admin API voltam com o token no fragmento da URL
    // (#access_token=...), que só o cliente no navegador consegue ler — o
    // fragmento nunca chega ao servidor, então uma rota server-side como
    // /api/auth/callback (que espera ?code=) nunca recebe nada e falha.
    // E-mail que já tem conta (perfil ou Auth): gerar link de novo invalidaria o link da conta existente. Recusa antes de tudo.
    const { data: emUso } = await admin.rpc('email_em_uso', { p_email: invite.email });
    if (emUso) {
      const msg = 'Já existe uma conta com este e-mail. Não é possível enviar outro convite para ele.';
      // Pedido tardio: a vencedora já criou a conta e marcou ENVIADO. Sem o filtro, o e-mail "em uso" seria o dela.
      const { data: marcado } = await admin.from('pending_invites').update({ status: 'ERRO', erro_mensagem: msg })
        .eq('id', invite.id).in('status', ['PENDENTE', 'ERRO']).select('id');
      results.push({ id: invite.id, ok: false, mensagem: marcado && marcado.length > 0 ? msg : MSG_JA_ENVIANDO });
      continue;
    }

    // Reserva o convite ANTES de gerar o link: chamadas simultâneas do mesmo convite não criam conta duas vezes.
    const { data: reservado } = await admin
      .from('pending_invites')
      .update({ status: 'ENVIADO', enviado_em: new Date().toISOString(), erro_mensagem: null })
      .eq('id', invite.id)
      .in('status', ['PENDENTE', 'ERRO'])
      .select('id');
    if (!reservado || reservado.length === 0) {
      results.push({ id: invite.id, ok: false, mensagem: MSG_JA_ENVIANDO });
      continue;
    }

    const { data: linkData, error: inviteError } = await admin.auth.admin.generateLink({
      type: 'invite',
      email: invite.email,
      options: {
        data: { name: invite.nome, role: invite.role, bloco: invite.bloco, unidade: invite.unidade },
        redirectTo: `${origin}/definir-senha`,
      },
    });

    if (inviteError || !linkData?.user) {
      const msg = inviteError?.message ?? 'Falha ao gerar o link de convite.';
      await supabase.from('pending_invites').update({ status: 'ERRO', erro_mensagem: msg }).eq('id', invite.id);
      results.push({ id: invite.id, ok: false, mensagem: msg });
      continue;
    }

    const newUserId = linkData.user.id;
    // Link para a nossa página (token só é gasto no toque em "Continuar"), não o
    // action_link do Supabase, que robôs de pré-visualização consomem.
    const actionLink = montarLinkAcesso(origin, linkData.properties);

    const { error: profileError } = await admin.from('profiles').insert({
      id: newUserId,
      name: invite.nome,
      email: invite.email,
      role: invite.role,
      bloco: invite.role === 'ZELADOR' ? null : invite.bloco,
      unidade: invite.role === 'ZELADOR' ? null : invite.unidade,
      // Zelador pela fila (cargo vago): a conta nasce DESATIVADA e só ativa quando a pessoa aceita o convite (como na transferência).
      ...(invite.role === 'ZELADOR' ? { desativado_em: new Date().toISOString(), aguardando_aceite: true } : {}),
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
    await supabase.from('pending_invites').update({ status: 'ENVIADO', enviado_em: nowIso, erro_mensagem: null }).eq('id', invite.id);
    // O link fica em tabela à parte, que só Síndico e ADM leem.
    await admin.from('convite_links').upsert({ invite_id: invite.id, link_acesso: actionLink });
    await gravarAuditoria(admin, { id: callerProfile.id, name: callerProfile.name, role: callerProfile.role },
      `Gerou o link de acesso de ${invite.nome} (${invite.role})`, { acao: 'CONVITE_ENVIADO', conviteId: invite.id, cargo: invite.role });

    if (invite.unit_id) {
      await supabase.from('units').update({ status_convite: 'ENVIADO', usuario_id: newUserId }).eq('id', invite.unit_id);
    }

    // O link só volta a Síndico e ADM (a regra vale também para quem chama a rota direto).
    results.push({ id: invite.id, ok: true, ...(callerProfile.role === 'SINDICO' || callerProfile.role === 'ADM' ? { link: actionLink } : {}) });
  }

  return NextResponse.json({ results });
}
