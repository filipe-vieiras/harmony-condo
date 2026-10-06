import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { montarLinkAcesso } from '@/lib/linkAcesso';
import { textoVazio } from '@/lib/textoLivre';
import { ehCargoTransferivel, ehEmailValido, mensagemDoCodigo } from '@/lib/cargos';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STATUS_DO_CODIGO: Record<string, number> = {
  sem_permissao: 403,
  cargo_invalido: 400,
  dados_invalidos: 400,
};

/**
 * Transfere Síndico, Subsíndico, Conselho ou Portaria para uma conta que já existe (vale na hora)
 * ou para uma pessoa nova (convite: o cargo só vale quando ela aceitar).
 *
 * O cargo do executor é relido do banco a cada chamada e revalidado DENTRO da função SQL; nada que o
 * navegador manda (cargo, origem, destino) é aceito sem conferência. `profiles` é só leitura para o
 * cliente: quem muda o perfil é a função SECURITY DEFINER, que só o service role executa.
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  const admin = createAdminClient();

  // Porta de entrada barata (a função do banco decide de verdade): quem não é ADM nem Síndico nem chega lá.
  const { data: executor } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (!executor || (executor.role !== 'ADM' && executor.role !== 'SINDICO')) {
    return NextResponse.json({ error: 'Você não tem permissão para transferir cargos.', codigo: 'sem_permissao' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const cargo = body?.cargo;
  const origemId = body?.origemId;
  const destino = body?.destino;
  if (!ehCargoTransferivel(cargo)) {
    return NextResponse.json({ error: 'Esse cargo não pode ser transferido por aqui.', codigo: 'cargo_invalido' }, { status: 400 });
  }
  if (typeof origemId !== 'string' || !UUID.test(origemId) || !destino || typeof destino !== 'object') {
    return NextResponse.json({ error: mensagemDoCodigo('dados_invalidos'), codigo: 'dados_invalidos' }, { status: 400 });
  }

  const responder = (res: Record<string, unknown>) => {
    const codigo = String(res.codigo ?? 'erro');
    return NextResponse.json(
      {
        error: mensagemDoCodigo(codigo, {
          titularAtual: res.titularAtual as string | undefined,
          destinoNome: res.destinoNome as string | undefined,
          contaNome: res.contaNome as string | undefined,
        }, cargo),
        codigo,
        titularAtual: res.titularAtual,
        destinoNome: res.destinoNome,
        transferenciaId: res.transferenciaId,
        contaId: res.contaId,
        contaNome: res.contaNome,
      },
      { status: STATUS_DO_CODIGO[codigo] ?? 409 },
    );
  };

  // O Zelador é funcionário externo: só entra como pessoa nova (o banco também recusa).
  if (cargo === 'ZELADOR' && destino.tipo !== 'NOVO') {
    return NextResponse.json({ error: mensagemDoCodigo('cargo_invalido', {}, cargo), codigo: 'cargo_invalido' }, { status: 400 });
  }

  // ── Destino já cadastrado ──
  if (destino.tipo === 'EXISTENTE') {
    if (typeof destino.id !== 'string' || !UUID.test(destino.id)) {
      return NextResponse.json({ error: mensagemDoCodigo('dados_invalidos'), codigo: 'dados_invalidos' }, { status: 400 });
    }
    const { data, error } = await admin.rpc('transferir_cargo', {
      p_executor: user.id,
      p_cargo: cargo,
      p_origem: origemId,
      p_destino: destino.id,
    });
    if (error || !data) {
      console.error('transferir-cargo rpc:', error);
      return NextResponse.json({ error: 'Não deu para concluir. Nada foi alterado. Tente de novo.', codigo: 'erro' }, { status: 500 });
    }
    if (!data.ok) return responder(data);
    return NextResponse.json({
      success: true,
      tipo: 'EXISTENTE',
      cargo,
      origemNome: data.origemNome,
      destinoNome: data.destinoNome,
      origemNovoPerfil: data.origemNovoPerfil,
      destinoPerfilAnterior: data.destinoPerfilAnterior,
      origemProvisorio: data.origemProvisorio,
    });
  }

  // ── Pessoa nova: convite com cargo pendente ──
  if (destino.tipo === 'NOVO') {
    const nome = typeof destino.nome === 'string' ? destino.nome.trim() : '';
    const email = typeof destino.email === 'string' ? destino.email.trim().toLowerCase() : '';
    const telefone = typeof destino.telefone === 'string' ? destino.telefone.trim().slice(0, 30) : '';
    if (textoVazio(nome) || nome.length > 120 || !ehEmailValido(email)) {
      return NextResponse.json({ error: mensagemDoCodigo('dados_invalidos'), codigo: 'dados_invalidos' }, { status: 400 });
    }

    // E-mail que já tem conta não vira convite (a tela manda escolher a pessoa em "Usuário já cadastrado").
    // ilike sem curingas: "_" e "%" de um e-mail não podem casar com outras contas.
    const { data: conta } = await admin.from('profiles').select('id, name').ilike('email', email.replace(/[\\%_]/g, '\\$&')).limit(1);
    if (conta && conta.length > 0) {
      return responder({ codigo: 'email_com_conta', contaId: conta[0].id, contaNome: conta[0].name });
    }

    const origin = process.env.SITE_URL ?? request.nextUrl.origin;
    // Sem e-mail enviado: o link volta para o ADM/Síndico copiar (mesma forma do convite da fila).
    // Nada de role no metadado: o cargo nunca é lido do cadastro do Auth, só do banco.
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'invite',
      email,
      options: { data: { name: nome }, redirectTo: `${origin}/definir-senha` },
    });
    if (linkError || !linkData?.user) {
      if (linkError?.message?.toLowerCase().includes('already')) return responder({ codigo: 'email_com_conta' });
      console.error('transferir-cargo generateLink:', linkError);
      return NextResponse.json({ error: 'Não deu para gerar o link de acesso. Nada foi alterado. Tente de novo.', codigo: 'erro' }, { status: 500 });
    }
    const novoId = linkData.user.id;
    const link = montarLinkAcesso(origin, linkData.properties);

    const { data, error } = await admin.rpc('iniciar_transferencia_cargo', {
      p_executor: user.id,
      p_cargo: cargo,
      p_origem: origemId,
      p_destino_id: novoId,
      p_nome: nome,
      p_email: email,
      p_telefone: telefone,
      p_link: link,
    });
    if (error || !data || !data.ok) {
      // Recusada (ou falhou): a conta criada no Auth só serviria a esta transferência, então sai.
      await admin.auth.admin.deleteUser(novoId);
      if (error || !data) {
        console.error('transferir-cargo iniciar rpc:', error);
        return NextResponse.json({ error: 'Não deu para concluir. Nada foi alterado. Tente de novo.', codigo: 'erro' }, { status: 500 });
      }
      return responder(data);
    }
    return NextResponse.json({
      success: true,
      tipo: 'NOVO',
      cargo,
      origemNome: data.origemNome,
      destinoNome: data.destinoNome,
      transferenciaId: data.transferenciaId,
      link,
    });
  }

  return NextResponse.json({ error: mensagemDoCodigo('dados_invalidos'), codigo: 'dados_invalidos' }, { status: 400 });
}
