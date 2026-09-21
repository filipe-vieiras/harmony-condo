-- vehicles_read comparava bloco/unidade com uma subquery direta em
-- profiles ("select profiles.bloco from profiles where profiles.id =
-- auth.uid()") — sujeita à RLS da própria tabela profiles. Pra um
-- MORADOR essa subquery podia não devolver nada, fazendo a comparação
-- falhar sempre: o morador não via nem o próprio veículo. Isso também
-- quebrava o cadastro, porque insert().select() depende da mesma policy
-- de leitura pra devolver a linha recém-criada. vehicles_delete nunca
-- teve MORADOR na lista — o morador nunca pôde excluir o próprio veículo.
--
-- Corrige com o mesmo padrão já usado em fines (migration 0018): FK
-- unit_id + a função SECURITY DEFINER get_my_unit_id(), que não fica
-- sujeita à RLS de outras tabelas.

alter table public.vehicles
  add column if not exists unit_id text references public.units(id) on delete set null;

drop policy if exists "vehicles_read" on public.vehicles;
create policy "vehicles_read"
  on public.vehicles for select
  using (
    get_user_role() = ANY (ARRAY['SINDICO', 'ADM', 'PORTARIA', 'CONSELHO'])
    or unit_id = public.get_my_unit_id()
  );

drop policy if exists "vehicles_write" on public.vehicles;
create policy "vehicles_write"
  on public.vehicles for insert
  with check (get_user_role() = ANY (ARRAY['SINDICO', 'ADM', 'PORTARIA', 'MORADOR']));

drop policy if exists "vehicles_delete" on public.vehicles;
create policy "vehicles_delete"
  on public.vehicles for delete
  using (
    get_user_role() = ANY (ARRAY['SINDICO', 'ADM', 'PORTARIA'])
    or unit_id = public.get_my_unit_id()
  );
