-- Harmony Residence — morador edita placa, marca, modelo, cor e tipo do veículo da própria
-- unidade (issue #46). Depende da 0030 (coluna tipo_veiculo e policy vehicles_update_morador).
--
-- Decisão do dono do produto (2026-10-03):
--   • Edição DIRETA, sem aprovação do síndico, por UNIDADE (qualquer morador da unidade).
--   • Morador edita: placa, marca, modelo, cor e tipo. Vaga, status (ATIVO/VISITANTE),
--     proprietário, telefone, unidade e bloco seguem só da equipe.
--   • Síndico, Subsíndico e ADM editam tudo (policy vehicles_update_admin, já existente).
--   • Placa ÚNICA no condomínio inteiro (decisão do dono, 2026-10-03, "vamos pelo simples"):
--     cadastrar ou editar para uma placa já cadastrada é recusado (23505, vehicles_placa_key).
--     O gatilho de normalização em maiúsculas garante que abc1234 e ABC1234 sejam a mesma.
--
-- Migração aditiva e idempotente (drop ... if exists / create or replace). Nenhuma linha
-- existente é reescrita.
--
-- Placa: o formato (antigo ABC1234 ou Mercosul ABC1D23, em maiúsculas) é conferido por GATILHO,
-- e não por CHECK, de propósito. Um CHECK (mesmo NOT VALID) é reavaliado em TODO update da
-- linha, então um veículo antigo com placa fora do padrão deixaria de poder ter a cor ou o
-- modelo corrigidos. O gatilho só confere na inserção e quando a placa MUDA; o resto dos
-- veículos antigos continua editável nos outros campos.

-- ──────────────────────────────────────────────
-- 0) A placa é única no condomínio inteiro (restrição do baseline)
-- ──────────────────────────────────────────────
-- Uma versão anterior desta migração derrubou vehicles_placa_key (regra "só avisar" que caiu).
-- Aqui ela é recriada, só se não existir, e o índice por unidade daquela versão sai.
-- Se houver placas repetidas no banco, o ADD CONSTRAINT falha: limpe-as antes (no staging, o seed).
drop index if exists public.vehicles_unidade_placa_key;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.vehicles'::regclass and conname = 'vehicles_placa_key'
  ) then
    alter table public.vehicles add constraint vehicles_placa_key unique (placa);
  end if;
end $$;

-- Se uma versão anterior desta migração criou o CHECK, ele sai (veículo antigo precisa editar).
alter table public.vehicles drop constraint if exists vehicles_placa_formato_check;

-- ──────────────────────────────────────────────
-- 1) Placa: normaliza para maiúsculas e confere o formato (insert e mudança de placa)
-- ──────────────────────────────────────────────

create or replace function public.vehicles_placa_normalizar()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.placa is not distinct from old.placa then
    return new; -- placa intocada: veículo antigo fora do padrão segue editável nos outros campos
  end if;

  new.placa := upper(btrim(new.placa));
  if new.placa !~ '^[A-Z]{3}[0-9]{4}$' and new.placa !~ '^[A-Z]{3}[0-9][A-Z][0-9]{2}$' then
    raise exception 'Placa inválida. Use o formato ABC1234 ou ABC1D23.'
      using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists vehicles_placa_normalizar on public.vehicles;
create trigger vehicles_placa_normalizar
  before insert or update on public.vehicles
  for each row execute function public.vehicles_placa_normalizar();

-- ──────────────────────────────────────────────
-- 2) Cadastro do morador: o banco decide vaga, status e o texto da unidade
-- ──────────────────────────────────────────────

create or replace function public.vehicles_guard_morador_insert()
returns trigger
language plpgsql
security definer  -- lê units sem depender da RLS dela; só preenche bloco/unidade da unidade do próprio unit_id
set search_path = public
as $$
declare
  v_bloco text;
  v_numero text;
begin
  if public.get_user_role() is distinct from 'MORADOR' then
    return new;
  end if;

  -- Morador não define vaga nem situação: o que vier do navegador é ignorado.
  new.status := 'ATIVO';
  new.vaga := '';

  -- Bloco e unidade em texto vêm da chave (unit_id), nunca do navegador.
  select u.bloco, u.numero into v_bloco, v_numero from public.units u where u.id = new.unit_id;
  if v_bloco is not null then
    new.bloco := v_bloco;
    new.unidade := v_numero;
  end if;
  return new;
end $$;

drop trigger if exists vehicles_guard_morador_insert on public.vehicles;
create trigger vehicles_guard_morador_insert
  before insert on public.vehicles
  for each row execute function public.vehicles_guard_morador_insert();

-- ──────────────────────────────────────────────
-- 3) Edição do morador: libera placa, marca, modelo, cor e tipo
-- ──────────────────────────────────────────────

-- O RLS (vehicles_update_morador, 0030) já limita o morador à própria unidade; este gatilho
-- limita as colunas. Síndico, Subsíndico, ADM e o service role não são afetados.
create or replace function public.vehicles_guard_morador_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.get_user_role() is distinct from 'MORADOR' then
    return new;
  end if;

  -- Veículo de visitante é da equipe (o status é só dela).
  if old.status = 'VISITANTE' then
    raise exception 'Morador não pode alterar veículo de visitante.'
      using errcode = '42501';
  end if;

  if new.id is distinct from old.id
    or new.vaga is distinct from old.vaga
    or new.status is distinct from old.status
    or new.proprietario_nome is distinct from old.proprietario_nome
    or new.telefone_contato is distinct from old.telefone_contato
    or new.unidade is distinct from old.unidade
    or new.bloco is distinct from old.bloco
    or new.unit_id is distinct from old.unit_id
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Morador só pode alterar placa, marca, modelo, cor e tipo do veículo da própria unidade.'
      using errcode = '42501';
  end if;

  return new;
end $$;

drop trigger if exists vehicles_guard_morador_update on public.vehicles;
create trigger vehicles_guard_morador_update
  before update on public.vehicles
  for each row execute function public.vehicles_guard_morador_update();

-- ──────────────────────────────────────────────
-- 4) Histórico gravado pelo banco (o navegador não pode pular)
--    A frase NÃO traz a placa (unidade e id bastam); o de-para fica nos detalhes, que só a
--    equipe lê. Telefone e nome do proprietário entram só como "campo alterado", sem valores.
-- ──────────────────────────────────────────────

drop trigger if exists vehicles_tipo_audit on public.vehicles;
drop function if exists public.vehicles_tipo_audit();

create or replace function public.vehicles_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text;
  v_role text;
  v_rotulos text[] := '{}';
  v_lista text;
  v_alteracoes jsonb := '{}'::jsonb;
  v_sem_valor text[] := '{}';
  v_frase text;
  v_detalhes jsonb;
begin
  -- Sem usuário logado (manutenção direta no banco) não há quem registrar.
  if auth.uid() is null then
    return new;
  end if;

  if new.placa is distinct from old.placa then
    v_rotulos := v_rotulos || 'placa'::text;
    v_alteracoes := v_alteracoes || jsonb_build_object('placa', jsonb_build_object('de', old.placa, 'para', new.placa));
  end if;
  if new.marca is distinct from old.marca then
    v_rotulos := v_rotulos || 'marca'::text;
    v_alteracoes := v_alteracoes || jsonb_build_object('marca', jsonb_build_object('de', old.marca, 'para', new.marca));
  end if;
  if new.modelo is distinct from old.modelo then
    v_rotulos := v_rotulos || 'modelo'::text;
    v_alteracoes := v_alteracoes || jsonb_build_object('modelo', jsonb_build_object('de', old.modelo, 'para', new.modelo));
  end if;
  if new.cor is distinct from old.cor then
    v_rotulos := v_rotulos || 'cor'::text;
    v_alteracoes := v_alteracoes || jsonb_build_object('cor', jsonb_build_object('de', old.cor, 'para', new.cor));
  end if;
  if new.tipo_veiculo is distinct from old.tipo_veiculo then
    v_rotulos := v_rotulos || 'tipo'::text;
    v_alteracoes := v_alteracoes || jsonb_build_object('tipo_veiculo', jsonb_build_object('de', old.tipo_veiculo, 'para', new.tipo_veiculo));
  end if;
  if new.vaga is distinct from old.vaga then
    v_rotulos := v_rotulos || 'vaga'::text;
    v_alteracoes := v_alteracoes || jsonb_build_object('vaga', jsonb_build_object('de', old.vaga, 'para', new.vaga));
  end if;
  if new.status is distinct from old.status then
    v_rotulos := v_rotulos || 'situação'::text;
    v_alteracoes := v_alteracoes || jsonb_build_object('status', jsonb_build_object('de', old.status, 'para', new.status));
  end if;
  if new.proprietario_nome is distinct from old.proprietario_nome then
    v_rotulos := v_rotulos || 'proprietário'::text;
    v_sem_valor := v_sem_valor || 'proprietario_nome'::text;
  end if;
  if new.telefone_contato is distinct from old.telefone_contato then
    v_rotulos := v_rotulos || 'telefone'::text;
    v_sem_valor := v_sem_valor || 'telefone_contato'::text;
  end if;

  if coalesce(array_length(v_rotulos, 1), 0) = 0 then
    return new;
  end if;

  select p.name, p.role into v_nome, v_role from public.profiles p where p.id = auth.uid();

  if v_rotulos = array['tipo'] then
    -- Mesma frase e mesmo formato de detalhes da 0030 (só o tipo mudou).
    v_frase := 'Alterou o tipo de um veículo da unidade ' || new.unidade || ' (Bloco ' || new.bloco || ') de '
      || case old.tipo_veiculo when 'CARRO' then 'Carro' when 'MOTO' then 'Moto' else 'Outro' end
      || ' para '
      || case new.tipo_veiculo when 'CARRO' then 'Carro' when 'MOTO' then 'Moto' else 'Outro' end;
    v_detalhes := jsonb_build_object('vehicleId', new.id, 'de', old.tipo_veiculo, 'para', new.tipo_veiculo);
  else
    v_lista := array_to_string(v_rotulos, ', ');
    v_lista := regexp_replace(v_lista, ', ([^,]*)$', ' e \1');
    v_frase := 'Alterou um veículo da unidade ' || new.unidade || ' (Bloco ' || new.bloco || '): ' || v_lista;
    v_detalhes := jsonb_build_object('vehicleId', new.id, 'unidade', new.unidade, 'bloco', new.bloco, 'alteracoes', v_alteracoes);
    if coalesce(array_length(v_sem_valor, 1), 0) > 0 then
      v_detalhes := v_detalhes || jsonb_build_object('camposAlteradosSemValor', to_jsonb(v_sem_valor));
    end if;
  end if;

  insert into public.audit_logs (usuario_id, usuario_nome, usuario_role, acao, modulo, detalhes)
  values (auth.uid(), coalesce(v_nome, 'Usuário'), coalesce(v_role, 'SISTEMA'), v_frase, 'UNIDADES', v_detalhes);
  return new;
end $$;

drop trigger if exists vehicles_audit on public.vehicles;
create trigger vehicles_audit
  after update on public.vehicles
  for each row execute function public.vehicles_audit();

-- ──────────────────────────────────────────────
-- 5) Limpeza da versão anterior (aviso de placa repetida entre unidades): a regra caiu
-- ──────────────────────────────────────────────

drop trigger if exists vehicles_aviso_placa_repetida on public.vehicles;
drop function if exists public.vehicles_aviso_placa_repetida();
delete from public.notifications where titulo = 'Placa repetida entre unidades';
