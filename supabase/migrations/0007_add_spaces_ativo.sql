-- Harmony Residence — spaces.ativo não existia, mas o app já lê/grava esse
-- campo (toggle "espaço em manutenção"). Sem essa coluna, qualquer insert ou
-- update em spaces falha. Achado ao testar reserva real como morador: a
-- tabela spaces estava vazia e o insert de seed falhou por causa disso.

alter table public.spaces add column if not exists ativo boolean not null default true;
