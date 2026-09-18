-- "Escrita de espacos apenas para Sindico" só liberava role='SINDICO' exato,
-- sem incluir ADM (que tem as mesmas permissões de SINDICO em todo o resto
-- do app). Reusa public.is_admin() (já existente, SECURITY DEFINER) em vez
-- de "select ... from profiles" direto na policy — subquery direta roda sob
-- as RLS policies de profiles do usuário atual, o que já causou bug antes.
drop policy if exists "Escrita de espacos apenas para Sindico" on public.spaces;
create policy "spaces_write_staff"
  on public.spaces for all
  using (public.is_admin())
  with check (public.is_admin());
