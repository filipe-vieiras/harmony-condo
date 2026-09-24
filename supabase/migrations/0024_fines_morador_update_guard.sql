-- Harmony Residence — a policy "fines_update_morador_own" (0018) libera o
-- UPDATE da linha inteira para o morador dono da multa, porque RLS não
-- restringe colunas. Na prática o morador conseguia, pela API, zerar o valor,
-- trocar o artigo ou marcar a própria multa como RECURSO_DEFERIDO.
--
-- O app só precisa que o morador:
--   • registre ciência   → status CIENCIA_REGISTRADA, ciencia_data, ciencia_usuario_nome
--   • interponha recurso → status EM_RECURSO, recurso_status EM_ANALISE,
--                          recurso_data, recurso_texto, recurso_anexo_nome
-- Este trigger rejeita qualquer outra alteração vinda de um MORADOR.
-- Admins (is_admin) e o service role não são afetados.

create or replace function public.fines_guard_morador_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.get_user_role() is distinct from 'MORADOR' then
    return new;
  end if;

  if new.numero_protocolo is distinct from old.numero_protocolo
    or new.bloco is distinct from old.bloco
    or new.unidade is distinct from old.unidade
    or new.unit_id is distinct from old.unit_id
    or new.morador_nome is distinct from old.morador_nome
    or new.data_infracao is distinct from old.data_infracao
    or new.prazo_recurso_data is distinct from old.prazo_recurso_data
    or new.artigo_regimento is distinct from old.artigo_regimento
    or new.descricao_infracao is distinct from old.descricao_infracao
    or new.valor is distinct from old.valor
    or new.tipo is distinct from old.tipo
    or new.created_at is distinct from old.created_at
    or new.recurso_resposta is distinct from old.recurso_resposta
    or new.recurso_data_resposta is distinct from old.recurso_data_resposta
    or new.recurso_analisado_por is distinct from old.recurso_analisado_por
  then
    raise exception 'Morador não pode alterar os dados da notificação, apenas registrar ciência ou recurso.'
      using errcode = '42501';
  end if;

  if new.status is distinct from old.status
    and new.status not in ('CIENCIA_REGISTRADA', 'EM_RECURSO')
  then
    raise exception 'Morador não pode alterar o status da notificação para %.', new.status
      using errcode = '42501';
  end if;

  if new.recurso_status is distinct from old.recurso_status
    and new.recurso_status is distinct from 'EM_ANALISE'
  then
    raise exception 'Morador não pode julgar o próprio recurso.'
      using errcode = '42501';
  end if;

  return new;
end $$;

drop trigger if exists fines_guard_morador_update on public.fines;
create trigger fines_guard_morador_update
  before update on public.fines
  for each row execute function public.fines_guard_morador_update();
