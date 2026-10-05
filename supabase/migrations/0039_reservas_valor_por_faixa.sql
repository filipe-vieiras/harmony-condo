-- Harmony — reservas: valor de uso por faixa de pessoas (issue #81, fase 2).
-- Depende da 0034 (gatilhos 00/10 e aviso de confirmação automática) e da 0038.
--
-- Decisão do dono (2026-10-05): o espaço é "grátis independente do número de pessoas" OU "grátis
-- até X pessoas e, acima disso, R$ Y fixos". "Até X" é INCLUSIVO (X pessoas ainda é grátis);
-- X = 0 cobra de todos. O Harmony só CALCULA e MOSTRA: não cobra, não exporta e não emite
-- relatório (isso fica para a integração com a API da administradora).
--
--   • O valor é calculado NO BANCO por uma função única, valor_reserva(), usada pelo gatilho de
--     criação e pela prévia da tela. Qualquer valor enviado pelo navegador é ignorado.
--   • A reserva grava o valor de uso, o número de pessoas (convidados_estimados) e a taxa de
--     higienização do momento. Depois de criada, valor, taxa, pessoas, espaço e data NÃO mudam
--     mais (para nenhum perfil logado). Mudar a tabela do espaço não altera reservas existentes.
--   • Só a equipe edita as faixas: a policy spaces_write_staff (is_admin()) já cobre as colunas novas.
--   • Reservas anteriores à regra ficam com valor NULO (a tela mostra "—"): nada é recalculado.
--
-- Migração aditiva e idempotente.

-- ──────────────────────────────────────────────
-- 1) Faixa no espaço
-- ──────────────────────────────────────────────
alter table public.spaces add column if not exists faixa_gratis_ate integer;
alter table public.spaces add column if not exists faixa_valor numeric(10,2);

-- Os dois nulos = grátis para qualquer número de pessoas (os espaços existentes continuam assim).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'spaces_faixa_check' and conrelid = 'public.spaces'::regclass) then
    alter table public.spaces add constraint spaces_faixa_check check (
      (faixa_gratis_ate is null and faixa_valor is null)
      or (
        faixa_gratis_ate is not null and faixa_valor is not null
        and faixa_gratis_ate >= 0
        and faixa_valor > 0
        -- Limite igual ou maior que a capacidade: a cobrança nunca ocorreria.
        and faixa_gratis_ate < capacidade_max
      )
    );
  end if;
end $$;

-- ──────────────────────────────────────────────
-- 2) Valor e taxa gravados na reserva
-- ──────────────────────────────────────────────
-- Nulos nas reservas antigas (anteriores à regra); o gatilho abaixo sempre preenche as novas.
alter table public.reservations add column if not exists valor_uso numeric(10,2);
alter table public.reservations add column if not exists taxa_higienizacao numeric(10,2);

-- ──────────────────────────────────────────────
-- 3) Função única da regra
-- ──────────────────────────────────────────────
-- 0 se o espaço não tem faixa ou se pessoas <= faixa_gratis_ate; senão faixa_valor (fixo, não por
-- pessoa). Nulo se o espaço não existe, se pessoas é nulo ou se quem chama não tem perfil.
create or replace function public.valor_reserva(p_espaco_id text, p_pessoas integer)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ate integer;
  v_valor numeric;
begin
  -- Conta sem perfil (cadastro direto na API): nada. Sem usuário (service role) segue.
  if auth.uid() is not null and not public.tem_perfil() then
    return null;
  end if;
  if p_pessoas is null then
    return null;
  end if;

  select s.faixa_gratis_ate, s.faixa_valor into v_ate, v_valor from public.spaces s where s.id = p_espaco_id;
  if not found then
    return null;
  end if;

  if v_ate is null or p_pessoas <= v_ate then
    return 0;
  end if;
  return v_valor;
end $$;

revoke all on function public.valor_reserva(text, integer) from public, anon;
grant execute on function public.valor_reserva(text, integer) to authenticated;

-- ──────────────────────────────────────────────
-- 4) Criação: o banco calcula e grava
-- ──────────────────────────────────────────────
-- "12": depois da validação (00) e do status inicial (10). Ignora qualquer valor_uso e
-- taxa_higienizacao enviados, para QUALQUER perfil (inclusive is_admin(): o valor não é digitado).
-- Para quem está logado, o número de pessoas precisa ficar entre 1 e a capacidade do espaço: sem
-- isso, declarar 0 pessoas escaparia da faixa paga. O código é curto, a tela o traduz.
create or replace function public.reservations_calcular_valor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capacidade integer;
  v_limpeza numeric;
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

  new.valor_uso := coalesce(public.valor_reserva(new.espaco_id, new.convidados_estimados), 0);
  new.taxa_higienizacao := coalesce(v_limpeza, 0);
  return new;
end $$;

drop trigger if exists reservations_12_calcular_valor on public.reservations;
create trigger reservations_12_calcular_valor
  before insert on public.reservations
  for each row execute function public.reservations_calcular_valor();

revoke all on function public.reservations_calcular_valor() from public, anon, authenticated;

-- ──────────────────────────────────────────────
-- 5) Depois de criada, valor, pessoas, espaço e data não mudam
-- ──────────────────────────────────────────────
-- Só status, motivo_recusa, avaliado_por e data_avaliacao mudam (como hoje, e só a gestão). Se o
-- pedido estiver errado, cancela-se e refaz-se. Exceção única: o espaço apagado zera espaco_id
-- (ON DELETE SET NULL, 0014), e isso precisa passar. Sem usuário (service role: seed e
-- manutenção) o gatilho não age.
create or replace function public.reservations_proteger_valor()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if new.valor_uso is distinct from old.valor_uso
     or new.taxa_higienizacao is distinct from old.taxa_higienizacao
     or new.convidados_estimados is distinct from old.convidados_estimados
     or new.data is distinct from old.data
     or (new.espaco_id is distinct from old.espaco_id and new.espaco_id is not null) then
    raise exception 'reserva_imutavel' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists reservations_05_proteger_valor on public.reservations;
create trigger reservations_05_proteger_valor
  before update on public.reservations
  for each row execute function public.reservations_proteger_valor();

revoke all on function public.reservations_proteger_valor() from public, anon, authenticated;

-- ──────────────────────────────────────────────
-- 6) Aviso da confirmação automática traz o valor (só quando houver)
-- ──────────────────────────────────────────────
-- Mesma função da 0034, com a frase do valor no aviso à EQUIPE. A frase sai do valor gravado pelo
-- banco, nunca de conta do navegador. O aviso à unidade do morador não muda.
create or replace function public.reservations_avisar_confirmacao_automatica()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unit_id text;
  v_dia text := to_char(new.data, 'DD/MM/YYYY');
  v_ate integer;
  v_valor_txt text;
  v_frase_valor text := '';
begin
  if new.status is distinct from 'APROVADA' or new.avaliado_por is distinct from 'Aprovação automática' then
    return new;
  end if;

  select u.id into v_unit_id from public.units u
  where u.bloco = new.bloco and lower(btrim(u.numero)) = lower(btrim(new.unidade))
  limit 1;

  if coalesce(new.valor_uso, 0) > 0 then
    select s.faixa_gratis_ate into v_ate from public.spaces s where s.id = new.espaco_id;
    -- 1234.5 -> "1.234,50"
    v_valor_txt := replace(replace(replace(to_char(new.valor_uso, 'FM999,999,990.00'), ',', '#'), '.', ','), '#', '.');
    v_frase_valor := ' Valor de uso: R$ ' || v_valor_txt
      || case when coalesce(v_ate, 0) > 0 then ' (acima de ' || v_ate || ' pessoas)' else '' end || '.';
  end if;

  if public.get_user_role() = 'MORADOR' then
    insert into public.notifications (titulo, mensagem, tipo, perfil_alvo, link_destino)
    values (
      'Reserva confirmada automaticamente',
      new.espaco_nome || ', dia ' || v_dia || ', Apto ' || new.unidade || ' - Bloco ' || new.bloco
        || ' (' || new.morador_nome || '). Este espaço não exige aprovação.' || v_frase_valor,
      'RESERVA', 'SINDICO', '/reservas'
    );
  end if;

  insert into public.notifications (titulo, mensagem, tipo, unidade_alvo, unidade_id_alvo, link_destino)
  values (
    'Reserva confirmada!',
    'Sua reserva do ' || new.espaco_nome || ' para ' || v_dia || ' está confirmada.',
    'RESERVA', new.unidade, v_unit_id, '/reservas'
  );

  insert into public.audit_logs (usuario_id, usuario_nome, usuario_role, acao, modulo, detalhes)
  values (
    null, 'Sistema', 'SISTEMA', 'Reserva confirmada automaticamente', 'RESERVAS',
    jsonb_build_object('reservationId', new.id, 'espaco', new.espaco_nome, 'unidade', new.unidade, 'bloco', new.bloco, 'data', new.data)
  );
  return new;
end $$;

revoke all on function public.reservations_avisar_confirmacao_automatica() from public, anon, authenticated;
