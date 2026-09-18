-- Harmony Residence — impede duas unidades com o mesmo número no mesmo bloco.
-- Achado real: um duplo-clique no cadastro criou 3-4 unidades "403/A" idênticas
-- antes que o app tivesse qualquer trava. O app agora bloqueia isso no cliente
-- antes de tentar salvar; este índice é a rede de segurança no banco.

create unique index if not exists units_bloco_numero_key
  on public.units (bloco, numero);
