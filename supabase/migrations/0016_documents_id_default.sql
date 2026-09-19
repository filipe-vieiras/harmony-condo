-- A coluna "id" da tabela documents não tinha valor padrão — todo INSERT
-- (sem informar id manualmente) falhava com "null value in column id
-- violates not-null constraint". Corrige pra gerar UUID automaticamente,
-- igual às outras tabelas do sistema.
alter table public.documents alter column id set default gen_random_uuid();
