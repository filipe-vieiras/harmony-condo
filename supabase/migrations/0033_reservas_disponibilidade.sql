-- Harmony Residence — reservas: função de disponibilidade (issue #49, bloco B).
--
-- O morador lê só as reservas da própria unidade (política reservations_read, 0028), então o
-- calendário não consegue saber sozinho se um espaço está ocupado. Esta função devolve, para
-- quem tem perfil validado, SOMENTE (espaco_id, data, ocupado): nunca nome, bloco, unidade,
-- horário, status, id da reserva, convidados ou motivo. A política de leitura NÃO é afrouxada.
--
-- Mesmo padrão de diretorio_unidades() (0028): security definer, search_path fixo, revoke de
-- public/anon, grant só a authenticated. Recusa conta sem perfil e morador provisório.
-- A janela é limitada para a função não virar extração em massa do histórico.
--
-- Idempotente.

create or replace function public.disponibilidade_reservas(inicio date, fim date)
returns table (espaco_id text, data date, ocupado boolean)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  -- Sem perfil (conta criada direto na API) ou provisório: nada, e sem erro que revele algo.
  if not public.tem_perfil() or public.is_cadastro_provisorio() then
    return;
  end if;

  if inicio is null or fim is null or fim < inicio then
    raise exception 'periodo_invalido' using errcode = '22023';
  end if;
  -- Até ~1 mês para trás e ~12 meses à frente, e no máximo 6 meses por consulta.
  if inicio < v_hoje - 31 or fim > v_hoje + 366 or fim - inicio > 186 then
    raise exception 'periodo_fora_da_janela' using errcode = '22023';
  end if;

  return query
    select r.espaco_id, r.data, true
    from public.reservations r
    where r.espaco_id is not null
      and r.status in ('PENDENTE', 'APROVADA')
      and r.data between inicio and fim
    group by r.espaco_id, r.data;
end;
$$;

revoke all on function public.disponibilidade_reservas(date, date) from public, anon;
grant execute on function public.disponibilidade_reservas(date, date) to authenticated;
