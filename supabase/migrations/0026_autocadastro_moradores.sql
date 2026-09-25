-- Harmony Residence — autocadastro de moradores por link aberto.
--
-- Fluxo: o síndico importa bloco/número das unidades, abre o formulário e
-- divulga o link /cadastro. O morador escolhe a unidade, preenche os dados e
-- entra na hora com ACESSO PROVISÓRIO (mural, lista de unidades, próprio
-- cadastro). Multas, reservas e veículos só aparecem depois que o síndico
-- valida. Criação de conta, validação e recusa rodam em rotas de servidor
-- com service role; o cliente só lê.
--
-- Idempotente.

-- ──────────────────────────────────────────────
-- 1) Perfil provisório
-- ──────────────────────────────────────────────

alter table public.profiles
  add column if not exists cadastro_validado boolean not null default true;

create or replace function public.is_cadastro_provisorio()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and cadastro_validado = false
  );
$$;

-- ──────────────────────────────────────────────
-- 2) Configuração: formulário aberto/fechado (singleton)
-- ──────────────────────────────────────────────

create table if not exists public.autocadastro_config (
  id int primary key default 1,
  aberto boolean not null default false,
  atualizado_em timestamptz not null default now(),
  constraint autocadastro_config_singleton check (id = 1)
);

insert into public.autocadastro_config (id, aberto) values (1, false)
on conflict (id) do nothing;

alter table public.autocadastro_config enable row level security;

drop policy if exists "autocadastro_config_select_authenticated" on public.autocadastro_config;
create policy "autocadastro_config_select_authenticated"
  on public.autocadastro_config for select
  using (auth.uid() is not null);

drop policy if exists "autocadastro_config_update_admin" on public.autocadastro_config;
create policy "autocadastro_config_update_admin"
  on public.autocadastro_config for update
  using (public.is_admin())
  with check (public.is_admin());

-- ──────────────────────────────────────────────
-- 3) Envios do formulário
-- ──────────────────────────────────────────────

create table if not exists public.autocadastros (
  id uuid primary key default gen_random_uuid(),
  unit_id text not null references public.units(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  nome text not null,
  email text not null,
  telefone text not null,
  rg_cpf text,
  tipo text not null check (tipo in ('PROPRIETARIO', 'INQUILINO')),
  dependentes jsonb not null default '[]'::jsonb,
  veiculos jsonb not null default '[]'::jsonb,
  status text not null default 'AGUARDANDO' check (status in ('AGUARDANDO', 'VALIDADO', 'RECUSADO')),
  motivo_recusa text,
  origem_ip_hash text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  validado_em timestamptz,
  validado_por text
);

create index if not exists autocadastros_unit_idx on public.autocadastros (unit_id);
create index if not exists autocadastros_status_idx on public.autocadastros (status);
create index if not exists autocadastros_ip_idx on public.autocadastros (origem_ip_hash, criado_em);

alter table public.autocadastros enable row level security;

-- Só leitura pelo cliente: admin vê todos, o morador vê o próprio envio.
-- Escrita acontece apenas nas rotas de servidor (service role).
drop policy if exists "autocadastros_select" on public.autocadastros;
create policy "autocadastros_select"
  on public.autocadastros for select
  using (public.is_admin() or user_id = auth.uid());

-- ──────────────────────────────────────────────
-- 4) Acesso provisório — policies RESTRITIVAS: são combinadas com AND sobre
--    as permissivas existentes (inclusive as criadas no painel), então o
--    morador provisório fica bloqueado aqui mesmo que alguma delas libere.
-- ──────────────────────────────────────────────

drop policy if exists "fines_block_provisorio" on public.fines;
create policy "fines_block_provisorio"
  on public.fines as restrictive for all
  using (not public.is_cadastro_provisorio())
  with check (not public.is_cadastro_provisorio());

drop policy if exists "reservations_block_provisorio" on public.reservations;
create policy "reservations_block_provisorio"
  on public.reservations as restrictive for all
  using (not public.is_cadastro_provisorio())
  with check (not public.is_cadastro_provisorio());

drop policy if exists "vehicles_block_provisorio" on public.vehicles;
create policy "vehicles_block_provisorio"
  on public.vehicles as restrictive for all
  using (not public.is_cadastro_provisorio())
  with check (not public.is_cadastro_provisorio());

-- ──────────────────────────────────────────────
-- 5) Lista de unidades para todos os moradores — só bloco, número, nome do
--    responsável e situação (sem telefone, e-mail ou CPF). SECURITY DEFINER
--    porque a RLS de units (0025) não deixa o morador ler outras unidades.
-- ──────────────────────────────────────────────

create or replace function public.diretorio_unidades()
returns table (bloco text, numero text, responsavel text, situacao text)
language sql
security definer
set search_path = public
stable
as $$
  with base as (
    select
      u.id,
      u.bloco,
      u.numero,
      coalesce(
        (select m->>'nome' from jsonb_array_elements(coalesce(u.moradores, '[]'::jsonb)) m
          where m->>'tipo' in ('TITULAR', 'INQUILINO') limit 1),
        coalesce(u.moradores, '[]'::jsonb)->0->>'nome',
        nullif(u.proprietario_nome, '')
      ) as responsavel
    from public.units u
  )
  select * from (
    select b.bloco, b.numero, b.responsavel, 'VALIDADO'::text as situacao
    from base b
    where b.responsavel is not null
    union all
    select b.bloco, b.numero, a.nome, 'AGUARDANDO_VALIDACAO'::text
    from public.autocadastros a
    join base b on b.id = a.unit_id
    where a.status = 'AGUARDANDO'
    union all
    select b.bloco, b.numero, null::text, 'SEM_CADASTRO'::text
    from base b
    where b.responsavel is null
      and not exists (
        select 1 from public.autocadastros a
        where a.unit_id = b.id and a.status = 'AGUARDANDO'
      )
  ) d
  where auth.uid() is not null
  order by d.bloco, d.numero, d.situacao;
$$;

revoke all on function public.diretorio_unidades() from public, anon;
grant execute on function public.diretorio_unidades() to authenticated;
