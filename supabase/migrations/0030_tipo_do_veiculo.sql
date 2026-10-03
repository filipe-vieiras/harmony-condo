-- Harmony Residence — tipo do veículo (issue #43).
--
-- Decisão do dono do produto (2026-10-02):
--   • O veículo é Carro, Moto ou Outro. Sem texto livre para "Outro".
--   • Veículos já cadastrados viram "Outro": o sistema nunca adivinha o tipo; a
--     administração corrige pela edição quando quiser.
--
-- Migração aditiva e idempotente: só acrescenta uma coluna com padrão 'OUTRO' (no
-- Postgres 11+ isso não reescreve a tabela) e uma restrição. Nenhuma linha antiga muda
-- além de ganhar o valor padrão.
--
-- Quem edita o tipo (decisão do dono, 2026-10-02, ampliada no mesmo dia):
--   • Síndico, Subsíndico e ADM: qualquer veículo (policy vehicles_update_admin, já existente).
--   • Morador: só o tipo, só dos veículos da PRÓPRIA unidade (policy nova abaixo). O guard
--     recusa qualquer outra coluna, e o morador provisório continua bloqueado pela policy
--     restritiva vehicles_block_provisorio.
--   • Portaria, Conselho e visitante: não editam.
-- Os GRANTs não mudam: o RLS e o guard decidem (RLS não restringe colunas, por isso o
-- guard, mesmo padrão da 0024 em fines).
--
-- O nome da coluna é tipo_veiculo (e não "tipo") para não confundir com status
-- (ATIVO/VISITANTE), que na planilha aparece como "Vínculo".

alter table public.vehicles add column if not exists tipo_veiculo text not null default 'OUTRO';

-- A restrição vale para qualquer caminho (tela, API, SQL): valor fora da lista é recusado.
alter table public.vehicles drop constraint if exists vehicles_tipo_veiculo_check;
alter table public.vehicles add constraint vehicles_tipo_veiculo_check
  check (tipo_veiculo = any (array['CARRO', 'MOTO', 'OUTRO']));

-- ──────────────────────────────────────────────
-- Morador corrige o tipo do veículo da própria unidade
-- ──────────────────────────────────────────────

drop policy if exists vehicles_update_morador on public.vehicles;
create policy vehicles_update_morador on public.vehicles
  for update
  using (
    public.get_user_role() = 'MORADOR'
    and unit_id is not null
    and unit_id = public.get_my_unit_id()
  )
  with check (
    public.get_user_role() = 'MORADOR'
    and unit_id is not null
    and unit_id = public.get_my_unit_id()
  );

-- O RLS libera a linha inteira; este gatilho deixa o morador mexer só em tipo_veiculo.
-- Síndico, Subsíndico, ADM e o service role não são afetados.
create or replace function public.vehicles_guard_morador_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.get_user_role() is distinct from 'MORADOR' then
    return new;
  end if;

  if new.id is distinct from old.id
    or new.placa is distinct from old.placa
    or new.marca is distinct from old.marca
    or new.modelo is distinct from old.modelo
    or new.cor is distinct from old.cor
    or new.bloco is distinct from old.bloco
    or new.unidade is distinct from old.unidade
    or new.vaga is distinct from old.vaga
    or new.proprietario_nome is distinct from old.proprietario_nome
    or new.telefone_contato is distinct from old.telefone_contato
    or new.status is distinct from old.status
    or new.unit_id is distinct from old.unit_id
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Morador só pode alterar o tipo do veículo da própria unidade.'
      using errcode = '42501';
  end if;

  return new;
end $$;

drop trigger if exists vehicles_guard_morador_update on public.vehicles;
create trigger vehicles_guard_morador_update
  before update on public.vehicles
  for each row execute function public.vehicles_guard_morador_update();

-- ──────────────────────────────────────────────
-- Histórico gravado pelo banco (o navegador não pode pular), com frase legível.
-- Sem placa: unidade e id bastam para achar o veículo.
-- ──────────────────────────────────────────────

create or replace function public.vehicles_tipo_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text;
  v_role text;
begin
  -- Sem usuário logado (manutenção direta no banco) não há quem registrar.
  if auth.uid() is null or new.tipo_veiculo is not distinct from old.tipo_veiculo then
    return new;
  end if;

  select p.name, p.role into v_nome, v_role from public.profiles p where p.id = auth.uid();
  insert into public.audit_logs (usuario_id, usuario_nome, usuario_role, acao, modulo, detalhes)
  values (
    auth.uid(),
    coalesce(v_nome, 'Usuário'),
    coalesce(v_role, 'SISTEMA'),
    'Alterou o tipo de um veículo da unidade ' || new.unidade || ' (Bloco ' || new.bloco || ') de '
      || case old.tipo_veiculo when 'CARRO' then 'Carro' when 'MOTO' then 'Moto' else 'Outro' end
      || ' para '
      || case new.tipo_veiculo when 'CARRO' then 'Carro' when 'MOTO' then 'Moto' else 'Outro' end,
    'UNIDADES',
    jsonb_build_object('vehicleId', new.id, 'de', old.tipo_veiculo, 'para', new.tipo_veiculo)
  );
  return new;
end $$;

drop trigger if exists vehicles_tipo_audit on public.vehicles;
create trigger vehicles_tipo_audit
  after update on public.vehicles
  for each row execute function public.vehicles_tipo_audit();
