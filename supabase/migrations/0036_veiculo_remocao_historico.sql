-- Histórico da remoção de veículo (issue #51). O morador passa a remover os veículos da
-- própria unidade pela tela (a policy vehicles_delete já permitia), então a remoção precisa
-- deixar rastro gravado pelo banco, que o navegador não consegue pular.
-- A frase NÃO traz a placa (LGPD): unidade e bloco bastam; o id do veículo fica nos detalhes.
-- Idempotente e aditiva.

create or replace function public.vehicles_remocao_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text;
  v_role text;
begin
  -- Sem usuário logado (manutenção direta no banco) não há quem registrar.
  if auth.uid() is null then
    return old;
  end if;

  select p.name, p.role into v_nome, v_role from public.profiles p where p.id = auth.uid();
  insert into public.audit_logs (usuario_id, usuario_nome, usuario_role, acao, modulo, detalhes)
  values (
    auth.uid(),
    coalesce(v_nome, 'Usuário'),
    coalesce(v_role, 'SISTEMA'),
    'Removeu um veículo da unidade ' || old.unidade || ' (Bloco ' || old.bloco || ')',
    'UNIDADES',
    jsonb_build_object('vehicleId', old.id, 'tipo', old.tipo_veiculo, 'status', old.status)
  );
  return old;
end $$;

drop trigger if exists vehicles_remocao_audit on public.vehicles;
create trigger vehicles_remocao_audit
  after delete on public.vehicles
  for each row execute function public.vehicles_remocao_audit();
