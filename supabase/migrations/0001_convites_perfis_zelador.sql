-- Harmony Residence — Convites de acesso, perfil ADM e cadastro do Zelador
-- Rode este arquivo no SQL Editor do Supabase (Dashboard > SQL Editor) do projeto.
-- Não há CLI/migrations versionadas neste repo ainda; este arquivo é a fonte da verdade manual.
-- Idempotente: pode rodar de novo do zero sem problema.

-- ──────────────────────────────────────────────
-- 0) Função auxiliar para checar admin sem recursão de RLS
-- ──────────────────────────────────────────────

-- IMPORTANTE: uma policy da tabela profiles NÃO pode fazer "select ... from profiles"
-- diretamente (Postgres detecta e recusa com "infinite recursion detected in policy").
-- Por isso usamos uma função SECURITY DEFINER, que roda a consulta interna ignorando
-- RLS, e as policies só chamam a função.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('SINDICO', 'ADM')
  );
$$;

-- ──────────────────────────────────────────────
-- 1) PROFILES: liberar o valor de role 'ADM' e travar SINDICO/ADM como singleton
-- ──────────────────────────────────────────────

-- Se a coluna profiles.role tiver um CHECK constraint fixo com a lista antiga de
-- roles, ele precisa ser recriado incluindo 'ADM' antes de rodar o bloco abaixo.
-- Descubra o nome do constraint com:
--   select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.profiles'::regclass;
-- e ajuste/rode manualmente algo como:
--   alter table public.profiles drop constraint <nome_do_constraint>;
--   alter table public.profiles add constraint profiles_role_check
--     check (role in ('SINDICO','ADM','PORTARIA','CONSELHO','MORADOR'));

-- Permite que SINDICO/ADM vejam a lista de todos os perfis (tela de Usuários &
-- Convites precisa disso para checar quem já ocupa SINDICO/ADM e listar moradores
-- com/sem conta ativa). Mantém a policy existente de "cada um vê o próprio perfil".
drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin"
  on public.profiles for select
  using (public.is_admin());

-- No máximo um SINDICO e no máximo um ADM ativos por vez (regra de produto).
create unique index if not exists profiles_singleton_sindico
  on public.profiles (role)
  where role = 'SINDICO';

create unique index if not exists profiles_singleton_adm
  on public.profiles (role)
  where role = 'ADM';

-- ──────────────────────────────────────────────
-- 2) UNITS: rastrear o convite de acesso do morador prioritário
-- ──────────────────────────────────────────────

alter table public.units
  add column if not exists status_convite text not null default 'NAO_ENVIADO',
  add column if not exists usuario_id uuid references auth.users(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'units_status_convite_check'
  ) then
    alter table public.units
      add constraint units_status_convite_check
      check (status_convite in ('NAO_ENVIADO', 'PENDENTE', 'ENVIADO', 'ATIVO'));
  end if;
end $$;

-- ──────────────────────────────────────────────
-- 3) PENDING_INVITES: fila de convites em lote (revisão antes de enviar)
-- ──────────────────────────────────────────────

create table if not exists public.pending_invites (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text not null,
  role text not null check (role in ('SINDICO', 'ADM', 'PORTARIA', 'CONSELHO', 'MORADOR')),
  bloco text,
  unidade text,
  -- units.id é text neste projeto (não uuid) — o tipo precisa bater para a FK.
  unit_id text references public.units(id) on delete cascade,
  status text not null default 'PENDENTE' check (status in ('PENDENTE', 'ENVIADO', 'ERRO')),
  erro_mensagem text,
  criado_por text,
  criado_em timestamptz not null default now(),
  enviado_em timestamptz
);

create index if not exists pending_invites_status_idx on public.pending_invites (status);

alter table public.pending_invites enable row level security;

-- Só SINDICO/ADM enxergam e gerenciam a fila de convites.
drop policy if exists "pending_invites_select_admin" on public.pending_invites;
create policy "pending_invites_select_admin"
  on public.pending_invites for select
  using (public.is_admin());

drop policy if exists "pending_invites_insert_admin" on public.pending_invites;
create policy "pending_invites_insert_admin"
  on public.pending_invites for insert
  with check (public.is_admin());

drop policy if exists "pending_invites_update_admin" on public.pending_invites;
create policy "pending_invites_update_admin"
  on public.pending_invites for update
  using (public.is_admin());

drop policy if exists "pending_invites_delete_admin" on public.pending_invites;
create policy "pending_invites_delete_admin"
  on public.pending_invites for delete
  using (public.is_admin());

-- ──────────────────────────────────────────────
-- 4) ZELADOR: cadastro estruturado (sem login), só um registro ativo
-- ──────────────────────────────────────────────

create table if not exists public.zelador (
  id int primary key default 1,
  nome text not null default '',
  telefone text not null default '',
  horario_atendimento text not null default '',
  observacoes text,
  atualizado_em timestamptz not null default now(),
  constraint zelador_singleton check (id = 1)
);

insert into public.zelador (id, nome, telefone, horario_atendimento)
values (1, '', '', '')
on conflict (id) do nothing;

alter table public.zelador enable row level security;

drop policy if exists "zelador_select_authenticated" on public.zelador;
create policy "zelador_select_authenticated"
  on public.zelador for select
  using (auth.role() = 'authenticated');

drop policy if exists "zelador_update_admin" on public.zelador;
create policy "zelador_update_admin"
  on public.zelador for update
  using (public.is_admin());
