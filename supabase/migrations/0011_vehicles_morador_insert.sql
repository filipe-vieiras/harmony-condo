-- vehicles_write (INSERT) só liberava SINDICO/PORTARIA — o morador nunca
-- conseguia cadastrar o próprio veículo, mesmo a tela sendo feita pra isso
-- (vem pré-preenchida com nome/telefone do usuário logado). Libera MORADOR
-- pra cadastrar o próprio veículo, e inclui ADM (mesmas permissões de
-- SINDICO em todo o resto do app) que também estava faltando aqui.
drop policy if exists "vehicles_write" on public.vehicles;
create policy "vehicles_write"
  on public.vehicles for insert
  with check (get_user_role() = ANY (ARRAY['SINDICO'::text, 'ADM'::text, 'PORTARIA'::text, 'MORADOR'::text]));

drop policy if exists "vehicles_delete" on public.vehicles;
create policy "vehicles_delete"
  on public.vehicles for delete
  using (get_user_role() = ANY (ARRAY['SINDICO'::text, 'ADM'::text, 'PORTARIA'::text]));
