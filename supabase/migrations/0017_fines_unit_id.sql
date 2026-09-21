-- Vincula a multa à unidade cadastrada (FK), em vez de depender só do
-- texto bloco/unidade digitado no formulário de emissão. Sem isso, uma
-- multa podia ser criada com sucesso e nunca aparecer pro morador, porque
-- o texto digitado na hora não batia exatamente com o que está salvo no
-- perfil dele (ex: "304" vs "0304"). Mesma finalidade para a notificação
-- disparada junto, que usava o mesmo texto solto pra decidir quem avisa.

alter table public.fines
  add column if not exists unit_id text references public.units(id) on delete set null;

alter table public.notifications
  add column if not exists unidade_id_alvo text references public.units(id) on delete set null;
