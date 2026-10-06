// Cargo "de verdade" de uma conta para a hierarquia (só servidor). Ver cargoEfetivo em hierarquia.ts.
import type { SupabaseClient } from '@supabase/supabase-js';
import { cargoEfetivo } from './hierarquia';

export async function cargoEfetivoDoAlvo(
  admin: SupabaseClient,
  alvo: { id: string; role: string; email?: string | null },
): Promise<{ cargo: string; pendente: boolean }> {
  const { data: transf } = await admin.from('cargo_transferencias').select('cargo').eq('destino_id', alvo.id).eq('status', 'PENDENTE');
  let convites: { role: string; transferencia_id: string | null }[] = [];
  if (alvo.email) {
    // ilike sem curingas: "_" e "%" de um e-mail não casam com outros convites.
    const { data } = await admin.from('pending_invites').select('role, transferencia_id').ilike('email', alvo.email.replace(/[\\%_]/g, '\\$&'));
    convites = data ?? [];
  }
  const pendentes = [...(transf ?? []).map((t) => t.cargo as string), ...convites.map((c) => c.role)];
  return {
    cargo: cargoEfetivo(alvo.role, pendentes) ?? alvo.role,
    pendente: (transf ?? []).length > 0 || convites.some((c) => !!c.transferencia_id),
  };
}
