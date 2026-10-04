-- Harmony Residence — reservas: defesa de conflito no banco (issue #49, bloco A).
--
-- Decisão do dono (2026-10-04): um espaço NÃO tem mais de uma reserva por dia (conta PENDENTE e
-- APROVADA; RECUSADA e CANCELADA liberam o dia). Espaços diferentes podem no mesmo dia. Sem
-- antecedência mínima: só dia passado é recusado (fuso America/Sao_Paulo).
--
-- Antes desta migração o teste de conflito rodava só no navegador e era cego para o morador
-- (ele lê só as reservas da própria unidade): dois moradores podiam pedir o mesmo dia.
--
-- Migração aditiva e idempotente. NÃO apaga nem altera nenhuma reserva: se já houver dois
-- pedidos PENDENTE/APROVADA do mesmo espaço e dia, ela para com a lista dos conflitos e a
-- equipe resolve (recusar/cancelar um) antes de rodar de novo. Na produção rode antes:
--   select espaco_id, data, count(*) from public.reservations
--   where status in ('PENDENTE','APROVADA') and espaco_id is not null
--   group by 1, 2 having count(*) > 1;

-- ──────────────────────────────────────────────
-- 1) Índice único parcial: à prova de corrida (dois pedidos simultâneos geram uma só reserva)
-- ──────────────────────────────────────────────
do $$
declare
  v_conflitos text;
begin
  -- Só confere quando o índice ainda não existe (idempotente).
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'reservations_espaco_data_ocupado_key'
  ) then
    select string_agg(format('%s em %s (%s reservas)', coalesce(s.nome, r.espaco_id), r.data, r.qtd), '; ')
      into v_conflitos
    from (
      select espaco_id, data, count(*) as qtd
      from public.reservations
      where status in ('PENDENTE', 'APROVADA') and espaco_id is not null
      group by espaco_id, data
      having count(*) > 1
    ) r
    left join public.spaces s on s.id = r.espaco_id;

    if v_conflitos is not null then
      raise exception 'Existem reservas conflitantes (mesmo espaço e dia, PENDENTE/APROVADA): %. Recuse ou cancele uma delas e rode de novo.', v_conflitos;
    end if;

    create unique index reservations_espaco_data_ocupado_key
      on public.reservations (espaco_id, data)
      where status in ('PENDENTE', 'APROVADA') and espaco_id is not null;
  end if;
end $$;

-- ──────────────────────────────────────────────
-- 2) Validação na criação: dia passado e espaço indisponível
-- ──────────────────────────────────────────────
-- O nome começa com "00" para rodar ANTES do gatilho do status inicial (0034). Conexões sem
-- usuário (service role: seed e manutenção) não passam por aqui, como nos outros gatilhos.
-- As mensagens são códigos curtos: a tela os traduz para texto claro.
create or replace function public.reservations_validar_criacao()
returns trigger
language plpgsql
security definer  -- lê spaces sem depender da RLS de quem chama
set search_path = public
as $$
declare
  v_ativo boolean;
begin
  if auth.uid() is null then
    return new;
  end if;

  -- "Hoje" é o de Brasília: depois das 21h em UTC-3 o dia UTC já virou e não pode valer.
  if new.data < (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'reserva_dia_passado' using errcode = 'P0001';
  end if;

  select s.ativo into v_ativo from public.spaces s where s.id = new.espaco_id;
  if v_ativo is null or v_ativo = false then
    raise exception 'reserva_espaco_indisponivel' using errcode = 'P0001';
  end if;

  return new;
end $$;

drop trigger if exists reservations_00_validar_criacao on public.reservations;
create trigger reservations_00_validar_criacao
  before insert on public.reservations
  for each row execute function public.reservations_validar_criacao();

-- A função só roda como gatilho; ninguém precisa chamá-la direto.
revoke all on function public.reservations_validar_criacao() from public, anon, authenticated;
