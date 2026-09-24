-- Harmony Residence — Síndico, Subsíndico e Administradora com permissões
-- idênticas em todas as tabelas.
--
-- Várias policies foram criadas direto no painel do Supabase listando perfis
-- na mão (role = 'SINDICO', ou ARRAY['SINDICO','ADM',...]) em vez de usar
-- public.is_admin(). Resultado, medido com uma sonda de RLS por perfil:
--   • units: ADM e Subsíndico não conseguiam criar/editar/excluir unidade
--   • reservations: ADM não conseguia aprovar/recusar; Subsíndico nem via
--   • audit_logs: ADM e Subsíndico não viam a trilha de auditoria
--   • vehicles, fines: Subsíndico não via nada
--   • notifications: "marcar como lida" dava "infinite recursion detected
--     in policy" para TODOS os perfis
--   • reservations: Conselho Fiscal (somente leitura) conseguia editar
--
-- Idempotente. Onde o nome da policy antiga não está versionado no repo, as
-- policies do comando afetado são descobertas e removidas dinamicamente.

create or replace function public._drop_policies(p_table text, p_cmds "char"[])
returns void
language plpgsql
as $$
declare
  r record;
begin
  for r in
    select pol.polname
    from pg_policy pol
    join pg_class cls on cls.oid = pol.polrelid
    join pg_namespace nsp on nsp.oid = cls.relnamespace
    where nsp.nspname = 'public'
      and cls.relname = p_table
      and pol.polcmd = any (p_cmds) -- r=select a=insert w=update d=delete *=all
  loop
    execute format('drop policy if exists %I on public.%I', r.polname, p_table);
  end loop;
end $$;

-- ──────────────────────────────────────────────
-- Funções auxiliares passam a reconhecer SUBSINDICO
-- ──────────────────────────────────────────────

create or replace function public.can_manage_reservations()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('SINDICO', 'SUBSINDICO', 'ADM', 'PORTARIA')
  );
$$;

-- ──────────────────────────────────────────────
-- UNITS — escrita passa a ser de qualquer admin. A leitura de hoje (todo
-- usuário autenticado lê todas as unidades) é recriada explicitamente,
-- porque ela podia estar embutida numa policy FOR ALL removida abaixo.
-- ──────────────────────────────────────────────

select public._drop_policies('units', array['a', 'w', 'd', '*']::"char"[]);

drop policy if exists "units_read_authenticated" on public.units;
create policy "units_read_authenticated"
  on public.units for select
  using (auth.uid() is not null);

create policy "units_write_admin"
  on public.units for all
  using (public.is_admin())
  with check (public.is_admin());

-- ──────────────────────────────────────────────
-- VEHICLES
-- ──────────────────────────────────────────────

drop policy if exists "vehicles_read" on public.vehicles;
create policy "vehicles_read"
  on public.vehicles for select
  using (
    public.get_user_role() = any (array['SINDICO', 'SUBSINDICO', 'ADM', 'PORTARIA', 'CONSELHO'])
    or unit_id = public.get_my_unit_id()
  );

drop policy if exists "vehicles_write" on public.vehicles;
create policy "vehicles_write"
  on public.vehicles for insert
  with check (public.get_user_role() = any (array['SINDICO', 'SUBSINDICO', 'ADM', 'PORTARIA', 'MORADOR']));

drop policy if exists "vehicles_update_admin" on public.vehicles;
create policy "vehicles_update_admin"
  on public.vehicles for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "vehicles_delete" on public.vehicles;
create policy "vehicles_delete"
  on public.vehicles for delete
  using (
    public.get_user_role() = any (array['SINDICO', 'SUBSINDICO', 'ADM', 'PORTARIA'])
    or unit_id = public.get_my_unit_id()
  );

-- ──────────────────────────────────────────────
-- FINES — insert/update já usavam is_admin(); faltava leitura e exclusão
-- ──────────────────────────────────────────────

drop policy if exists "fines_read_staff" on public.fines;
create policy "fines_read_staff"
  on public.fines for select
  using (public.get_user_role() = any (array['SINDICO', 'SUBSINDICO', 'ADM', 'CONSELHO']));

drop policy if exists "fines_delete_admin" on public.fines;
create policy "fines_delete_admin"
  on public.fines for delete
  using (public.is_admin());

-- ──────────────────────────────────────────────
-- RESERVATIONS — aprovar/recusar/excluir só admin (tira o Conselho, põe ADM
-- e Subsíndico). Insert continua via can_manage_reservations() + a policy
-- já existente do morador.
-- ──────────────────────────────────────────────

drop policy if exists "reservations_read" on public.reservations;
create policy "reservations_read"
  on public.reservations for select
  using (
    public.get_user_role() = any (array['SINDICO', 'SUBSINDICO', 'ADM', 'CONSELHO', 'PORTARIA'])
    or unidade = (select profiles.unidade from public.profiles where profiles.id = auth.uid())
  );

select public._drop_policies('reservations', array['w', 'd', '*']::"char"[]);

create policy "reservations_update_admin"
  on public.reservations for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "reservations_delete_admin"
  on public.reservations for delete
  using (public.is_admin());

-- ──────────────────────────────────────────────
-- AUDIT_LOGS — leitura para admins + Conselho. Insert (0004) continua
-- aberto a qualquer autenticado; sem update/delete (trilha imutável).
-- ──────────────────────────────────────────────

select public._drop_policies('audit_logs', array['r']::"char"[]);

create policy "audit_logs_read"
  on public.audit_logs for select
  using (public.get_user_role() = any (array['SINDICO', 'SUBSINDICO', 'ADM', 'CONSELHO']));

-- ──────────────────────────────────────────────
-- NOTIFICATIONS — a policy de update antiga consultava a própria tabela e
-- entrava em recursão infinita. Quem enxerga a notificação pode marcá-la
-- como lida, e só a coluna "lida" pode ser alterada (grant por coluna).
-- ──────────────────────────────────────────────

select public._drop_policies('notifications', array['w']::"char"[]);

create policy "notifications_mark_read"
  on public.notifications for update
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

revoke update on public.notifications from authenticated, anon;
grant update (lida) on public.notifications to authenticated;

drop function public._drop_policies(text, "char"[]);
