-- "notices" e "documents" tinham policy de escrita restrita a role='SINDICO'
-- exato (mesmo problema já corrigido em 0013 para "spaces"): ADM tem as
-- mesmas permissões de SINDICO no resto do app, mas ficava com o botão de
-- "Novo Comunicado"/"Cadastrar Documento" na tela sem conseguir salvar —
-- a gravação falhava silenciosamente com "new row violates row-level
-- security policy". Achado ao logar como ADM e testar cada módulo.
--
-- Descobre dinamicamente o nome das policies de escrita (INSERT/UPDATE/
-- DELETE/ALL) em vez de supor o nome exato, e reusa public.is_admin() —
-- mesma técnica de 0006/0013. Não toca em policies de SELECT (leitura
-- continua liberada pra todos os perfis autenticados).
do $$
declare
  r record;
begin
  for r in
    select pol.polname, cls.relname
    from pg_policy pol
    join pg_class cls on cls.oid = pol.polrelid
    join pg_namespace nsp on nsp.oid = cls.relnamespace
    where nsp.nspname = 'public'
      and cls.relname in ('notices', 'documents')
      and pol.polcmd in ('a', 'w', 'd', '*') -- a=insert, w=update, d=delete, *=all
  loop
    execute format('drop policy if exists %I on public.%I', r.polname, r.relname);
  end loop;
end $$;

create policy "notices_write_staff"
  on public.notices for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "documents_write_staff"
  on public.documents for all
  using (public.is_admin())
  with check (public.is_admin());
