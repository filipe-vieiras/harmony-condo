-- Harmony Residence — correções da avaliação de segurança pré-lançamento.
--
-- Achados em produção (2026-09-28), com conta criada direto na API do Supabase
-- e com moradores comuns:
--   1. Conta SEM perfil (cadastro público do Supabase) lia a lista de moradores,
--      mural, documentos, espaços e notificações, e criava reservas e
--      notificações. → tudo passa a exigir perfil (tem_perfil()).
--   2. Qualquer logado criava reserva em nome de qualquer unidade, já APROVADA.
--   3. Morador cadastrava veículo em qualquer unidade.
--   4. Reservas e notificações casavam só pelo NÚMERO do apto (A-101 via B-101).
--   5. Qualquer logado criava notificação para todos, com link externo.
--   6. Qualquer logado gravava registro falso no histórico de ações.
--  10. "Lida" era um campo único por notificação: um morador marcava e ela
--      sumia para todos. → leitura passa a ser por usuário.
--
-- Idempotente.

-- ──────────────────────────────────────────────
-- 0) Helper: usuário logado TEM perfil no sistema
-- ──────────────────────────────────────────────

create or replace function public.tem_perfil()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.profiles where id = auth.uid());
$$;

-- Remove todas as policies de uma tabela para um comando (inclusive as criadas
-- pelo painel com nomes livres), para recriar do zero sem sobra permissiva.
create or replace function public._drop_policies_cmd(tabela text, comando text)
returns void
language plpgsql
as $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = tabela and cmd = comando
  loop
    execute format('drop policy if exists %I on public.%I', p.policyname, tabela);
  end loop;
end;
$$;

-- ──────────────────────────────────────────────
-- 1) Leituras "para qualquer logado" passam a exigir perfil
-- ──────────────────────────────────────────────

select public._drop_policies_cmd('spaces', 'SELECT');
create policy "spaces_read" on public.spaces for select using (public.tem_perfil());

select public._drop_policies_cmd('documents', 'SELECT');
create policy "documents_read" on public.documents for select using (public.tem_perfil());

select public._drop_policies_cmd('notices', 'SELECT');
create policy "notices_read" on public.notices for select using (public.tem_perfil());

select public._drop_policies_cmd('autocadastro_config', 'SELECT');
create policy "autocadastro_config_read" on public.autocadastro_config for select using (public.tem_perfil());

select public._drop_policies_cmd('zelador', 'SELECT');
create policy "zelador_read" on public.zelador for select using (public.tem_perfil());

select public._drop_policies_cmd('portal_administradora', 'SELECT');
create policy "portal_administradora_read" on public.portal_administradora for select using (public.tem_perfil());

-- Lista de unidades com nomes: só quem tem perfil (antes: qualquer logado).
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
  where public.tem_perfil()
  order by d.bloco, d.numero, d.situacao;
$$;

revoke all on function public.diretorio_unidades() from public, anon;
grant execute on function public.diretorio_unidades() to authenticated;

-- ──────────────────────────────────────────────
-- 2 e 4) Reservas: criação amarrada à própria unidade (bloco + número)
-- ──────────────────────────────────────────────

select public._drop_policies_cmd('reservations', 'INSERT');
create policy "reservations_insert" on public.reservations for insert
  with check (
    public.is_admin()
    or (
      status = 'PENDENTE'
      and (
        -- Portaria e Conselho registram pedido em nome de um morador (só PENDENTE).
        public.get_user_role() in ('PORTARIA', 'CONSELHO')
        or exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and p.role = 'MORADOR'
            and p.bloco = reservations.bloco
            and p.unidade = reservations.unidade
        )
      )
    )
  );

select public._drop_policies_cmd('reservations', 'SELECT');
create policy "reservations_read" on public.reservations for select
  using (
    public.get_user_role() in ('SINDICO', 'SUBSINDICO', 'ADM', 'CONSELHO', 'PORTARIA')
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.bloco = reservations.bloco
        and p.unidade = reservations.unidade
    )
  );

-- ──────────────────────────────────────────────
-- 3) Veículos: morador só cadastra na própria unidade
-- ──────────────────────────────────────────────

select public._drop_policies_cmd('vehicles', 'INSERT');
create policy "vehicles_insert" on public.vehicles for insert
  with check (
    public.get_user_role() in ('SINDICO', 'SUBSINDICO', 'ADM', 'PORTARIA')
    or (public.get_user_role() = 'MORADOR' and unit_id is not null and unit_id = public.get_my_unit_id())
  );

-- ──────────────────────────────────────────────
-- 4, 5 e 10) Notificações
-- ──────────────────────────────────────────────

-- Leitura: alvo de unidade só pela FK (o texto "101" não diz o bloco).
select public._drop_policies_cmd('notifications', 'SELECT');
create policy "notifications_read" on public.notifications for select
  using (
    public.is_admin()
    or (
      public.tem_perfil()
      and (perfil_alvo is null or perfil_alvo = public.get_user_role())
      and (
        (unidade_id_alvo is null and unidade_alvo is null)
        or exists (
          select 1 from public.units u
          where u.id = notifications.unidade_id_alvo and u.usuario_id = auth.uid()
        )
      )
    )
  );

-- Criação: admin cria qualquer uma; os demais só avisam a administração
-- (pedido de reserva, recurso de multa) — nunca para todos nem para uma unidade.
select public._drop_policies_cmd('notifications', 'INSERT');
create policy "notifications_insert" on public.notifications for insert
  with check (
    public.is_admin()
    or (
      public.tem_perfil()
      and not public.is_cadastro_provisorio()
      and perfil_alvo in ('SINDICO', 'SUBSINDICO', 'ADM')
      and unidade_alvo is null
      and unidade_id_alvo is null
    )
  );

-- Link só para páginas do próprio portal ("/multas/..."), nunca externo.
alter table public.notifications drop constraint if exists notifications_link_interno;
alter table public.notifications add constraint notifications_link_interno
  check (link_destino is null or link_destino = '/' or link_destino ~ '^/[^/\\]');

-- "Lida" por usuário. A coluna notifications.lida fica sem uso.
create table if not exists public.notification_reads (
  notification_id text not null references public.notifications(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lida_em timestamptz not null default now(),
  primary key (notification_id, user_id)
);

alter table public.notification_reads enable row level security;

drop policy if exists "notification_reads_own_select" on public.notification_reads;
create policy "notification_reads_own_select" on public.notification_reads for select
  using (user_id = auth.uid());

drop policy if exists "notification_reads_own_insert" on public.notification_reads;
create policy "notification_reads_own_insert" on public.notification_reads for insert
  with check (user_id = auth.uid() and public.tem_perfil());

revoke all on public.notification_reads from anon;
revoke update, delete, truncate on public.notification_reads from authenticated;
grant select, insert on public.notification_reads to authenticated;

select public._drop_policies_cmd('notifications', 'UPDATE');
revoke update on public.notifications from anon, authenticated;
-- Admin continua podendo editar pelo servidor (service role não passa por GRANT/RLS).

-- ──────────────────────────────────────────────
-- 6) Histórico de ações: só em nome próprio
-- ──────────────────────────────────────────────

select public._drop_policies_cmd('audit_logs', 'INSERT');
create policy "audit_logs_insert_proprio" on public.audit_logs for insert
  with check (
    usuario_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = audit_logs.usuario_role and p.name = audit_logs.usuario_nome
    )
  );

drop function public._drop_policies_cmd(text, text);
