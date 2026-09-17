-- Harmony Residence — audit_logs nunca teve policy de INSERT para usuário autenticado.
-- Depois de corrigir o default de id (0003), o insert passou a bater na RLS:
-- "new row violates row-level security policy for table audit_logs".
-- Qualquer usuário logado pode registrar uma ação sua na trilha de auditoria
-- (é o app quem decide o conteúdo do log, não o usuário livremente).

drop policy if exists "audit_logs_insert_authenticated" on public.audit_logs;
create policy "audit_logs_insert_authenticated"
  on public.audit_logs for insert
  with check (auth.uid() is not null);
