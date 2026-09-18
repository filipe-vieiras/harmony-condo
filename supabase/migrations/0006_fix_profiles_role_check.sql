-- Harmony Residence — profiles.role ainda tinha o CHECK constraint antigo
-- (sem 'ADM'), então nenhuma conta ADM real conseguia ser criada. Isso já
-- estava avisado como pendência no comentário da migration 0001, mas nunca
-- tinha sido de fato corrigido. Achado ao rodar um teste real de cada perfil.

do $$
declare
  r record;
begin
  for r in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    where rel.relname = 'profiles'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%role%'
  loop
    execute format('alter table public.profiles drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('SINDICO', 'ADM', 'PORTARIA', 'CONSELHO', 'MORADOR'));
