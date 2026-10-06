// Auditoria gravada pelo SERVIDOR (service role), depois que a ação deu certo. Nada aqui depende do navegador.
// Sem e-mail nem telefone: só nomes (que a trilha já mostra), cargos e ids.
import type { SupabaseClient } from '@supabase/supabase-js';

export interface Executor { id: string; name: string; role: string }

export async function gravarAuditoria(
  admin: SupabaseClient,
  executor: Executor,
  acao: string,
  detalhes: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await admin.from('audit_logs').insert({
    usuario_id: executor.id,
    usuario_nome: executor.name,
    usuario_role: executor.role,
    acao,
    modulo: 'SISTEMA',
    detalhes,
  });
  if (error) console.error('gravarAuditoria:', error.message);
}

/** Aviso no sino de uma pessoa só (o titular da conta). */
export async function avisarUsuario(admin: SupabaseClient, usuarioId: string, titulo: string, mensagem: string): Promise<void> {
  const { error } = await admin.from('notifications').insert({ titulo, mensagem, tipo: 'GERAL', usuario_id_alvo: usuarioId, link_destino: '/' });
  if (error) console.error('avisarUsuario:', error.message);
}
