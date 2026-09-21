-- A tabela fines nunca teve a coluna recurso_anexo_nome, mas o app sempre
-- tentou gravar nela ao protocolar um recurso (submitFineAppeal). O update
-- falhava com "Could not find the 'recurso_anexo_nome' column" e o erro
-- era engolido silenciosamente — o morador via a tela fechar como se
-- tivesse funcionado, mas o recurso nunca era salvo.
alter table public.fines
  add column if not exists recurso_anexo_nome text;
