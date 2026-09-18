-- Permite que a equipe (Síndico, Administradora, Portaria) registre uma
-- reserva em nome de um morador (ex: pedido por telefone), além do próprio
-- morador. Política adicional — combina via OR com a existente para morador.
--
-- Usa uma função SECURITY DEFINER (mesmo padrão de public.is_admin() na
-- migration 0001) em vez de "select ... from profiles" direto na policy:
-- a subquery direta roda sob as RLS policies de profiles do usuário atual,
-- e pode não enxergar nem o próprio registro dependendo do contexto.
create or replace function public.can_manage_reservations()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('SINDICO', 'ADM', 'PORTARIA')
  );
$$;

drop policy if exists "reservations_insert_staff" on public.reservations;
create policy "reservations_insert_staff"
  on public.reservations for insert
  with check (public.can_manage_reservations());
