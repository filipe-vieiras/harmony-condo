-- Multa sem valor negativo (issue #51, achado L1 do QA geral de 04/10/2026).
-- Antes, uma inserção por API com valor -50 era aceita (201). A tela passa a exigir valor
-- maior que zero para Multa Financeira, e o banco garante o piso: valor >= 0 (advertência
-- guarda 0). Vale até para a chave de serviço, porque é restrição da tabela.
--
-- Idempotente e aditiva: rodar duas vezes não dá erro. Entra como NOT VALID (protege toda
-- inserção e alteração desde já, sem varrer nem quebrar linhas antigas) e só é validada
-- se não houver nenhuma linha antiga negativa; se houver, fica pendente e o aviso aparece.

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'fines_valor_nao_negativo' and conrelid = 'public.fines'::regclass
  ) then
    alter table public.fines
      add constraint fines_valor_nao_negativo check (valor >= 0) not valid;
  end if;

  if exists (select 1 from public.fines where valor < 0) then
    raise warning 'fines_valor_nao_negativo ficou NOT VALID: existem multas antigas com valor negativo para corrigir.';
  else
    alter table public.fines validate constraint fines_valor_nao_negativo;
  end if;
end $$;
