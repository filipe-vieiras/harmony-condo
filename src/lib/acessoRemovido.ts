// Remoção e devolução de acesso no Auth (só servidor: recebe o cliente com a service role).
//
// A barreira de verdade é o banco: conta com `profiles.desativado_em` não tem perfil e nenhuma policy devolve linha. O ban no Auth
// e o fim das sessões são o cinto e suspensório: a pessoa não consegue nem entrar nem renovar a sessão. Falha aqui NÃO desfaz a
// remoção (o banco já barra) e é registrada sem segredo.
import type { SupabaseClient } from '@supabase/supabase-js';

const BAN_LONGO = '876000h'; // ~100 anos

export async function removerAcessoAuth(admin: SupabaseClient, userId: string): Promise<{ ban: boolean; sessoes: boolean }> {
  let ban = false;
  let sessoes = false;
  try {
    const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: BAN_LONGO });
    ban = !error;
    if (error) console.error('removerAcessoAuth ban:', error.message);
  } catch (e) {
    console.error('removerAcessoAuth ban (exceção):', e instanceof Error ? e.message : 'erro');
  }
  try {
    const { data, error } = await admin.rpc('encerrar_sessoes_usuario', { p_usuario: userId });
    sessoes = !error && data === true;
    if (error) console.error('removerAcessoAuth sessões:', error.message);
  } catch (e) {
    console.error('removerAcessoAuth sessões (exceção):', e instanceof Error ? e.message : 'erro');
  }
  return { ban, sessoes };
}

export async function devolverAcessoAuth(admin: SupabaseClient, userId: string): Promise<boolean> {
  try {
    const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: 'none' });
    if (error) console.error('devolverAcessoAuth:', error.message);
    return !error;
  } catch (e) {
    console.error('devolverAcessoAuth (exceção):', e instanceof Error ? e.message : 'erro');
    return false;
  }
}
