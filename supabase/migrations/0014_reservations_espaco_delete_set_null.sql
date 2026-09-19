-- Permite excluir um espaço mesmo com reservas no histórico. Antes, a FK
-- reservations.espaco_id -> spaces.id bloqueava a exclusão (ON DELETE
-- padrão = NO ACTION). Troca pra ON DELETE SET NULL: a reserva antiga
-- continua existindo e exibindo o nome do espaço (espaco_nome já é
-- gravado direto na reserva, não depende de join com spaces), só o vínculo
-- com o espaço que não existe mais fica nulo.
do $$
declare
  constraint_name text;
begin
  select con.conname into constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  where rel.relname = 'reservations'
    and con.contype = 'f'
    and con.conname like '%espaco_id%';

  if constraint_name is not null then
    execute format('alter table public.reservations drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.reservations alter column espaco_id drop not null;

alter table public.reservations
  add constraint reservations_espaco_id_fkey
  foreign key (espaco_id) references public.spaces(id) on delete set null;
