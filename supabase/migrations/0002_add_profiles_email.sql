-- Harmony Residence — adiciona coluna de e-mail em profiles
-- A tabela profiles não tinha coluna email; o código já lia profiles.email
-- opcionalmente (voltando para '' quando ausente), mas a rota de convites
-- precisa GRAVAR o e-mail do usuário criado, e isso falhava.

alter table public.profiles add column if not exists email text;

-- Backfill: preenche o e-mail dos perfis existentes a partir do auth.users.
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id and p.email is null;
