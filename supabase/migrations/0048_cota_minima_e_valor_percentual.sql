-- Dona Wanda — reservas: cota mínima do condomínio e valor de uso em percentual (fase 2 da regra de valor).
-- Depende da 0039 (valor_reserva, gatilhos 05 e 12) e da 0022 (is_admin). Specs: docs/specs/2026-10-09-reservas-valor-pago-e-percentual.md
-- e docs/specs/2026-10-09-area-de-configuracoes.md. Decisões do dono (09/10/2026):
--
--   1) UMA cota mínima do condomínio, digitada por Síndico/Subsíndico/ADM (is_admin()). Não é o menor valor entre unidades,
--      não é lida de nenhuma unidade e não muda quando unidades são criadas ou editadas.
--   2) O espaço tem valor FIXO (R$) ou PERCENTUAL da cota. Vale para "paga em toda reserva" (limite 0) e para "grátis até N,
--      acima disso paga" (limite > 0). A higienização continua só em R$. Espaços e reservas existentes ficam como estão.
--   3) O valor em R$ é calculado NO BANCO, no pedido: round(cota x percentual / 100, 2), meio para cima, nunca menos de R$ 0,01
--      (um percentual não vira "grátis" por arredondamento). CONGELADO: a reserva grava valor_uso no momento do pedido e
--      depois ele não muda (gatilho 05 da 0039). Mudar a cota ou o percentual do espaço vale só para pedidos novos.
--   4) A cota NÃO é exposta ao morador: a tabela só é lida por is_admin(); o morador recebe só o R$ final (valor_reserva e
--      valores_espacos_percentual). A cota e o percentual usados em cada reserva ficam numa tabela à parte, só da gestão
--      (reservas_valor_base), para que `select *` em reservations (morador, Portaria, Conselho) não vaze a cota.
--   5) Escrita da cota só pela função definir_cota_minima(), que valida, grava e registra a auditoria na MESMA transação
--      (sem alteração sem rastro; o registro não traz valores, porque o Conselho lê o histórico).
--
-- Limites assumidos (a confirmar com o dono): cota de R$ 0,01 a R$ 100.000,00, até 2 casas; percentual de 0,01 a 100, até 2 casas.
-- A cota não pode ser apagada depois de cadastrada (a função recusa nulo; nenhum perfil tem update direto).
--
-- Aditiva e idempotente (add column if not exists, create or replace, constraints e gatilhos recriados). Não altera nenhuma
-- linha existente de spaces nem de reservations. As funções redefinidas aqui são a versão FINAL: não reaplicar a 0039.

-- ──────────────────────────────────────────────
-- 1) Configuração do condomínio (linha única)
-- ──────────────────────────────────────────────
create table if not exists public.condominio_config (
  id smallint primary key default 1 check (id = 1),
  cota_minima numeric(12,2) check (cota_minima is null or (cota_minima > 0 and cota_minima <= 100000)),
  atualizado_por uuid references auth.users(id) on delete set null,
  atualizado_por_nome text,
  atualizado_em timestamptz
);

insert into public.condominio_config (id) values (1) on conflict (id) do nothing;

alter table public.condominio_config enable row level security;

-- Nenhum perfil logado escreve direto; só a função abaixo (security definer) grava. Leitura só da gestão.
revoke all on public.condominio_config from public, anon, authenticated;
grant select on public.condominio_config to authenticated;

drop policy if exists condominio_config_leitura_gestao on public.condominio_config;
create policy condominio_config_leitura_gestao on public.condominio_config
  for select to authenticated
  using (public.is_admin());

-- ──────────────────────────────────────────────
-- 2) Definir a cota (única porta de escrita)
-- ──────────────────────────────────────────────
-- Códigos curtos que a tela traduz: sem_permissao (42501), cota_invalida (22023).
create or replace function public.definir_cota_minima(p_valor numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text;
  v_role text;
  v_antes numeric;
  v_em timestamptz := now();
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;

  -- Nulo, NaN, infinito, zero, negativo, acima do teto ou com mais de 2 casas: recusa (nunca assume 0).
  if p_valor is null
     or p_valor = 'NaN'::numeric
     or p_valor = 'Infinity'::numeric
     or p_valor = '-Infinity'::numeric
     or p_valor <= 0
     or p_valor > 100000
     or p_valor <> round(p_valor, 2) then
    raise exception 'cota_invalida' using errcode = '22023';
  end if;

  select p.name, p.role into v_nome, v_role from public.profiles p where p.id = auth.uid();

  -- Trava a linha única: duas gravações simultâneas não se misturam e a auditoria sabe o estado anterior.
  select c.cota_minima into v_antes from public.condominio_config c where c.id = 1 for update;

  insert into public.condominio_config as c (id, cota_minima, atualizado_por, atualizado_por_nome, atualizado_em)
  values (1, round(p_valor, 2), auth.uid(), v_nome, v_em)
  on conflict (id) do update
    set cota_minima = excluded.cota_minima,
        atualizado_por = excluded.atualizado_por,
        atualizado_por_nome = excluded.atualizado_por_nome,
        atualizado_em = excluded.atualizado_em;

  -- Sem os valores (antigo e novo): o Conselho lê o histórico e a cota é da gestão.
  insert into public.audit_logs (usuario_id, usuario_nome, usuario_role, acao, modulo, detalhes)
  values (
    auth.uid(), coalesce(v_nome, 'Usuário'), coalesce(v_role, 'SISTEMA'),
    case when v_antes is null then 'Cadastrou a cota mínima do condomínio' else 'Alterou a cota mínima do condomínio' end,
    'SISTEMA', '{}'::jsonb
  );

  return jsonb_build_object('cota_minima', round(p_valor, 2), 'atualizado_por_nome', v_nome, 'atualizado_em', v_em);
end $$;

revoke all on function public.definir_cota_minima(numeric) from public, anon;
grant execute on function public.definir_cota_minima(numeric) to authenticated;

-- ──────────────────────────────────────────────
-- 3) Espaço: tipo do valor e percentual
-- ──────────────────────────────────────────────
alter table public.spaces add column if not exists valor_tipo text not null default 'FIXO';
alter table public.spaces add column if not exists faixa_percentual numeric(5,2);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'spaces_valor_tipo_check' and conrelid = 'public.spaces'::regclass) then
    alter table public.spaces add constraint spaces_valor_tipo_check check (valor_tipo in ('FIXO', 'PERCENTUAL'));
  end if;
end $$;

-- Mesma regra da 0039 para FIXO (linhas existentes continuam válidas) e a nova para PERCENTUAL.
-- Grátis = os três nulos. Fixo e percentual nunca juntos. Limite sempre menor que a capacidade.
alter table public.spaces drop constraint if exists spaces_faixa_check;
alter table public.spaces add constraint spaces_faixa_check check (
  (valor_tipo = 'FIXO' and faixa_gratis_ate is null and faixa_valor is null and faixa_percentual is null)
  or (
    valor_tipo = 'FIXO' and faixa_percentual is null
    and faixa_gratis_ate is not null and faixa_valor is not null
    and faixa_gratis_ate >= 0 and faixa_valor > 0
    and faixa_gratis_ate < capacidade_max
  )
  or (
    valor_tipo = 'PERCENTUAL' and faixa_valor is null
    and faixa_gratis_ate is not null and faixa_percentual is not null
    and faixa_gratis_ate >= 0 and faixa_percentual > 0 and faixa_percentual <= 100
    and faixa_gratis_ate < capacidade_max
  )
);

-- Percentual só com cota cadastrada (o banco recusa; nunca grava um espaço sem base de cálculo).
create or replace function public.spaces_validar_cota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.valor_tipo = 'PERCENTUAL'
     and not exists (select 1 from public.condominio_config c where c.id = 1 and c.cota_minima is not null) then
    raise exception 'cota_nao_cadastrada' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists spaces_validar_cota on public.spaces;
create trigger spaces_validar_cota
  before insert or update of valor_tipo, faixa_percentual on public.spaces
  for each row execute function public.spaces_validar_cota();

revoke all on function public.spaces_validar_cota() from public, anon, authenticated;

-- ──────────────────────────────────────────────
-- 4) Conta única do percentual
-- ──────────────────────────────────────────────
create or replace function public.valor_percentual(p_cota numeric, p_percentual numeric)
returns numeric
language sql
immutable
set search_path = public
as $$
  select greatest(round(p_cota * p_percentual / 100, 2), 0.01);
$$;

revoke all on function public.valor_percentual(numeric, numeric) from public, anon, authenticated;

-- ──────────────────────────────────────────────
-- 5) Cálculo da reserva (fixo ou percentual) — interna, usada por valor_reserva e pelo gatilho
-- ──────────────────────────────────────────────
-- Devolve nenhuma linha se o espaço não existe ou se pessoas é nulo. valor = 0 dentro da faixa grátis (cota nula nas duas
-- colunas). Percentual cobrado sem cota cadastrada: reserva_cota_indefinida (nunca grava 0 em silêncio).
create or replace function public.calcular_valor_reserva(p_espaco_id text, p_pessoas integer)
returns table (valor numeric, cota_base numeric, percentual numeric)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ate integer;
  v_fixo numeric;
  v_tipo text;
  v_pct numeric;
  v_cota numeric;
begin
  if p_pessoas is null then
    return;
  end if;

  select s.faixa_gratis_ate, s.faixa_valor, s.valor_tipo, s.faixa_percentual
    into v_ate, v_fixo, v_tipo, v_pct
  from public.spaces s where s.id = p_espaco_id;
  if not found then
    return;
  end if;

  if v_ate is null or p_pessoas <= v_ate then
    return query select 0::numeric, null::numeric, null::numeric;
    return;
  end if;

  if v_tipo = 'PERCENTUAL' then
    select c.cota_minima into v_cota from public.condominio_config c where c.id = 1;
    if v_cota is null then
      raise exception 'reserva_cota_indefinida' using errcode = 'P0001';
    end if;
    return query select public.valor_percentual(v_cota, v_pct), v_cota, v_pct;
    return;
  end if;

  return query select v_fixo, null::numeric, null::numeric;
end $$;

revoke all on function public.calcular_valor_reserva(text, integer) from public, anon, authenticated;

-- Mesma assinatura e mesmo contrato da 0039 (a tela e o gatilho usam a mesma conta).
create or replace function public.valor_reserva(p_espaco_id text, p_pessoas integer)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_valor numeric;
begin
  -- Conta sem perfil (cadastro direto na API): nada. Sem usuário (service role) segue.
  if auth.uid() is not null and not public.tem_perfil() then
    return null;
  end if;
  select d.valor into v_valor from public.calcular_valor_reserva(p_espaco_id, p_pessoas) d;
  return v_valor;
end $$;

revoke all on function public.valor_reserva(text, integer) from public, anon;
grant execute on function public.valor_reserva(text, integer) to authenticated;

-- ──────────────────────────────────────────────
-- 6) Vitrine: valor cheio em R$ dos espaços em percentual (sem a cota)
-- ──────────────────────────────────────────────
-- Para o morador ver "R$ 61,25 por reserva" no cartão do espaço sem poder ler a cota nem o cálculo. Vazio se não há cota.
create or replace function public.valores_espacos_percentual()
returns table (espaco_id text, valor numeric)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, public.valor_percentual(c.cota_minima, s.faixa_percentual)
  from public.spaces s
  cross join public.condominio_config c
  where c.id = 1 and c.cota_minima is not null
    and s.valor_tipo = 'PERCENTUAL' and s.faixa_percentual is not null
    and (auth.uid() is null or public.tem_perfil());
$$;

revoke all on function public.valores_espacos_percentual() from public, anon;
grant execute on function public.valores_espacos_percentual() to authenticated;

-- ──────────────────────────────────────────────
-- 7) Cota e percentual usados em cada reserva (só a gestão lê)
-- ──────────────────────────────────────────────
-- Conferência ("5% de R$ 1.200,00 = R$ 60,00"). Fica fora de `reservations` de propósito: o morador, a Portaria e o Conselho
-- leem essa tabela, e a cota não é deles. O vínculo é adiado até o fim da transação porque a linha é escrita pelo gatilho
-- BEFORE INSERT, antes de a reserva existir. Sem insert/update/delete para nenhum perfil logado.
create table if not exists public.reservas_valor_base (
  reserva_id text primary key references public.reservations(id) on delete cascade deferrable initially deferred,
  cota_base numeric(12,2) not null,
  percentual_aplicado numeric(5,2) not null,
  criado_em timestamptz not null default now()
);

alter table public.reservas_valor_base enable row level security;
revoke all on public.reservas_valor_base from public, anon, authenticated;
grant select on public.reservas_valor_base to authenticated;

drop policy if exists reservas_valor_base_leitura_gestao on public.reservas_valor_base;
create policy reservas_valor_base_leitura_gestao on public.reservas_valor_base
  for select to authenticated
  using (public.is_admin());

-- ──────────────────────────────────────────────
-- 8) Criação: o banco calcula e grava (versão final do gatilho 12)
-- ──────────────────────────────────────────────
create or replace function public.reservations_calcular_valor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capacidade integer;
  v_limpeza numeric;
  v_valor numeric;
  v_cota numeric;
  v_pct numeric;
begin
  select s.capacidade_max, s.taxa_limpeza into v_capacidade, v_limpeza
  from public.spaces s where s.id = new.espaco_id;

  if not found then
    -- Espaço inexistente só passa aqui por manutenção direta (a 0032 recusa para quem está logado).
    new.valor_uso := 0;
    new.taxa_higienizacao := 0;
    return new;
  end if;

  if auth.uid() is not null
     and (new.convidados_estimados is null or new.convidados_estimados < 1 or new.convidados_estimados > v_capacidade) then
    raise exception 'reserva_pessoas_invalidas' using errcode = 'P0001';
  end if;

  -- Conta sem perfil: como na 0039, valor 0 (a RLS já a impede de criar reserva).
  if auth.uid() is not null and not public.tem_perfil() then
    new.valor_uso := 0;
  else
    select d.valor, d.cota_base, d.percentual into v_valor, v_cota, v_pct
    from public.calcular_valor_reserva(new.espaco_id, new.convidados_estimados) d;
    new.valor_uso := coalesce(v_valor, 0);
  end if;
  new.taxa_higienizacao := coalesce(v_limpeza, 0);

  if v_cota is not null then
    insert into public.reservas_valor_base (reserva_id, cota_base, percentual_aplicado)
    values (new.id, v_cota, v_pct)
    on conflict (reserva_id) do nothing;
  end if;
  return new;
end $$;

drop trigger if exists reservations_12_calcular_valor on public.reservations;
create trigger reservations_12_calcular_valor
  before insert on public.reservations
  for each row execute function public.reservations_calcular_valor();

revoke all on function public.reservations_calcular_valor() from public, anon, authenticated;
