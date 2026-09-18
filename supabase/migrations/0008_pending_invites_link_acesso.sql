-- Guarda o link de definição de senha gerado para o convite, para o Síndico
-- copiar e enviar manualmente (WhatsApp, etc.) em vez de depender de e-mail.
alter table public.pending_invites add column if not exists link_acesso text;
