-- A política de leitura de reservations só liberava SINDICO/CONSELHO (+ a
-- própria unidade do morador). Isso bloqueava até o RETURNING do próprio
-- INSERT feito pela Portaria (o Postgres valida a policy de SELECT ao
-- devolver a linha recém-criada), mesmo com a policy de INSERT já liberada.
-- Portaria e ADM também precisam ver o cronograma completo (controle de
-- acesso aos espaços comuns).
drop policy if exists "reservations_read" on public.reservations;
create policy "reservations_read"
  on public.reservations for select
  using (
    (get_user_role() = ANY (ARRAY['SINDICO'::text, 'ADM'::text, 'CONSELHO'::text, 'PORTARIA'::text]))
    or (unidade = (select profiles.unidade from profiles where profiles.id = auth.uid()))
  );
