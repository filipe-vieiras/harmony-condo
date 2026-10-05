import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Cancela uma transferência pendente (pessoa nova ainda não aceitou). Ninguém muda de cargo. */
export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const transferenciaId = body?.transferenciaId;
  if (typeof transferenciaId !== 'string' || !UUID.test(transferenciaId)) {
    return NextResponse.json({ error: 'Transferência não informada.', codigo: 'dados_invalidos' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc('cancelar_transferencia_cargo', { p_executor: user.id, p_transferencia: transferenciaId });
  if (error || !data) {
    console.error('cancelar transferencia rpc:', error);
    return NextResponse.json({ error: 'Não deu para cancelar. Tente de novo.', codigo: 'erro' }, { status: 500 });
  }
  if (!data.ok) {
    const mensagens: Record<string, string> = {
      sem_permissao: 'Você não tem permissão para cancelar esta transferência.',
      nao_pendente: 'Esta transferência já foi concluída ou cancelada.',
      dados_invalidos: 'Transferência não informada.',
    };
    return NextResponse.json(
      { error: mensagens[data.codigo] ?? 'Não deu para cancelar. Tente de novo.', codigo: data.codigo },
      { status: data.codigo === 'sem_permissao' ? 403 : data.codigo === 'dados_invalidos' ? 400 : 409 },
    );
  }

  // A conta provisória criada para o convite não tem mais motivo de existir.
  if (data.contaParaApagar) await admin.auth.admin.deleteUser(data.contaParaApagar);
  return NextResponse.json({ success: true, destinoNome: data.destinoNome });
}
