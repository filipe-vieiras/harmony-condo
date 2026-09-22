-- Harmony Residence — dois pedidos de produto:
-- 1) Permitir mais de uma "Administradora" ativa ao mesmo tempo (hoje travado
--    em 1 único ADM, igual Síndico).
-- 2) Criar o perfil "Subsíndico", com as mesmas permissões do Síndico
--    (entra em ADMIN_ROLES no código), mas único-por-vez como Síndico.
--
-- Idempotente: pode rodar de novo do zero sem problema.

-- ──────────────────────────────────────────────
-- 1) Libera o valor 'SUBSINDICO' no CHECK de profiles.role e pending_invites.role
-- ──────────────────────────────────────────────

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
  check (role in ('SINDICO', 'SUBSINDICO', 'ADM', 'PORTARIA', 'CONSELHO', 'MORADOR'));

do $$
declare
  r record;
begin
  for r in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    where rel.relname = 'pending_invites'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%role%'
  loop
    execute format('alter table public.pending_invites drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.pending_invites
  add constraint pending_invites_role_check
  check (role in ('SINDICO', 'SUBSINDICO', 'ADM', 'PORTARIA', 'CONSELHO', 'MORADOR'));

-- ──────────────────────────────────────────────
-- 2) is_admin() passa a reconhecer SUBSINDICO também — toda policy de RLS
--    que já usa essa função (spaces, fines, units, notices, documents, ...)
--    passa a liberar escrita pro subsíndico automaticamente, sem precisar
--    tocar em cada policy uma por uma.
-- ──────────────────────────────────────────────

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('SINDICO', 'SUBSINDICO', 'ADM')
  );
$$;

-- ──────────────────────────────────────────────
-- 3) Singleton: ADM sai da trava (pode ter várias administradoras ativas),
--    SUBSINDICO entra na trava (só um subsíndico ativo por vez, igual Síndico).
-- ──────────────────────────────────────────────

drop index if exists profiles_singleton_adm;

create unique index if not exists profiles_singleton_subsindico
  on public.profiles (role)
  where role = 'SUBSINDICO';
