-- Harmony Residence — anular e apagar multa (spec docs/specs/2026-10-02-anular-e-apagar-multa.md).
--
-- Decisão do dono do produto (2026-10-02):
--   • Síndico, Subsíndico e ADM ANULAM multa, sempre com motivo (mín. 10, máx. 500
--     caracteres depois do trim). A multa continua existindo, marcada ANULADA.
--   • Só o ADM APAGA multa (sem justificativa), e toda exclusão fica no histórico.
--   • Conselho, Portaria, Morador e visitante não anulam nem apagam.
--
-- A regra vale no banco (gatilhos e policy), não só na tela: quem chamar a API direto
-- cai nas mesmas recusas. Nenhuma rota de API anula ou apaga com a chave de serviço.
-- Idempotente.

-- ──────────────────────────────────────────────
-- 1) Status ANULADA e campos da anulação
-- ──────────────────────────────────────────────

alter table public.fines drop constraint if exists fines_status_check;
alter table public.fines add constraint fines_status_check
  check (status = any (array['PENDENTE_CIENCIA', 'CIENCIA_REGISTRADA', 'EM_RECURSO', 'RECURSO_DEFERIDO', 'RECURSO_INDEFERIDO', 'CONCLUIDA', 'ANULADA']));

-- Quem anulou fica copiado (nome e papel) para sobreviver à exclusão da conta; por isso
-- anulada_por não tem FK (uma exclusão de conta não pode mexer em multa anulada).
alter table public.fines add column if not exists anulada_motivo text;
alter table public.fines add column if not exists anulada_por uuid;
alter table public.fines add column if not exists anulada_por_nome text;
alter table public.fines add column if not exists anulada_por_papel text;
alter table public.fines add column if not exists anulada_em timestamptz;

-- Não existe anulação "sem estado" nem estado ANULADA sem motivo e data.
alter table public.fines drop constraint if exists fines_anulacao_coerente;
alter table public.fines add constraint fines_anulacao_coerente check (
  (status = 'ANULADA' and anulada_motivo is not null and anulada_em is not null)
  or (status <> 'ANULADA' and anulada_motivo is null and anulada_por is null
      and anulada_por_nome is null and anulada_por_papel is null and anulada_em is null)
);

-- ──────────────────────────────────────────────
-- 2) Guarda da anulação (antes de gravar)
-- ──────────────────────────────────────────────

create or replace function public.fines_anulacao_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_motivo text;
begin
  if tg_op = 'INSERT' then
    -- Multa nova nasce ativa: senão a anulação escaparia do motivo obrigatório.
    if new.status = 'ANULADA'
      or new.anulada_motivo is not null or new.anulada_por is not null
      or new.anulada_por_nome is not null or new.anulada_por_papel is not null
      or new.anulada_em is not null
    then
      raise exception 'Uma multa nova não pode nascer anulada. Emita a multa e depois anule, informando o motivo.'
        using errcode = '42501';
    end if;
    return new;
  end if;

  -- UPDATE
  if old.status = 'ANULADA' then
    -- Estado final. Manutenção direta no banco (sem usuário logado) continua possível.
    if auth.uid() is not null and (
      new.status is distinct from old.status
      or new.anulada_motivo is distinct from old.anulada_motivo
      or new.anulada_por is distinct from old.anulada_por
      or new.anulada_por_nome is distinct from old.anulada_por_nome
      or new.anulada_por_papel is distinct from old.anulada_por_papel
      or new.anulada_em is distinct from old.anulada_em
    ) then
      raise exception 'Esta multa já foi anulada e não pode mais ser alterada.'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if new.status = 'ANULADA' then
    v_role := public.get_user_role();
    if v_role is null or v_role not in ('SINDICO', 'SUBSINDICO', 'ADM') then
      raise exception 'Só o Síndico, o Subsíndico ou a administradora podem anular uma multa.'
        using errcode = '42501';
    end if;

    if old.status = 'RECURSO_DEFERIDO' then
      raise exception 'Esta multa já foi anulada pela decisão do recurso.'
        using errcode = '42501';
    end if;

    v_motivo := regexp_replace(coalesce(new.anulada_motivo, ''), '^\s+|\s+$', '', 'g');
    if char_length(v_motivo) < 10 then
      raise exception 'Escreva pelo menos 10 caracteres para explicar o motivo da anulação.'
        using errcode = '23514';
    end if;
    if char_length(v_motivo) > 500 then
      raise exception 'O motivo da anulação pode ter no máximo 500 caracteres.'
        using errcode = '23514';
    end if;

    -- Quem, quando e papel são do servidor: o que o cliente mandar é ignorado.
    new.anulada_motivo := v_motivo;
    new.anulada_em := now();
    new.anulada_por := auth.uid();
    new.anulada_por_papel := v_role;
    select p.name into new.anulada_por_nome from public.profiles p where p.id = auth.uid();
    new.anulada_por_nome := coalesce(new.anulada_por_nome, 'Usuário');
    return new;
  end if;

  -- Fora de ANULADA, os campos da anulação não podem ser preenchidos.
  if new.anulada_motivo is not null or new.anulada_por is not null
    or new.anulada_por_nome is not null or new.anulada_por_papel is not null
    or new.anulada_em is not null
  then
    raise exception 'Os dados da anulação só valem para uma multa com status ANULADA.'
      using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists fines_anulacao_guard on public.fines;
create trigger fines_anulacao_guard
  before insert or update on public.fines
  for each row execute function public.fines_anulacao_guard();

-- ──────────────────────────────────────────────
-- 3) Histórico gravado pelo banco (o navegador não pode pular)
--    Anular grava depois do UPDATE; apagar grava ANTES do DELETE e, se o registro
--    falhar, a exclusão falha junto (mesma transação).
-- ──────────────────────────────────────────────

create or replace function public.fines_anulacao_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'ANULADA' and old.status is distinct from 'ANULADA' then
    insert into public.audit_logs (usuario_id, usuario_nome, usuario_role, acao, modulo, detalhes)
    values (
      new.anulada_por, new.anulada_por_nome, new.anulada_por_papel,
      'Anulou multa ' || new.numero_protocolo, 'MULTAS',
      jsonb_build_object(
        'fineId', new.id,
        'protocolo', new.numero_protocolo,
        'unidade', new.unidade,
        'bloco', new.bloco,
        'statusAnterior', old.status,
        'motivo', new.anulada_motivo
      )
    );
  end if;
  return new;
end $$;

drop trigger if exists fines_anulacao_audit on public.fines;
create trigger fines_anulacao_audit
  after update on public.fines
  for each row execute function public.fines_anulacao_audit();

create or replace function public.fines_apagar_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text;
  v_role text;
begin
  select p.name, p.role into v_nome, v_role from public.profiles p where p.id = auth.uid();
  -- Só o necessário para saber quem apagou e qual multa era: sem nome do morador,
  -- descrição da infração, recurso, anexos, e-mail ou telefone (LGPD).
  insert into public.audit_logs (usuario_id, usuario_nome, usuario_role, acao, modulo, detalhes)
  values (
    auth.uid(),
    coalesce(v_nome, 'Manutenção direta no banco'),
    coalesce(v_role, 'SISTEMA'),
    'Apagou multa ' || old.numero_protocolo, 'MULTAS',
    jsonb_build_object(
      'fineId', old.id,
      'protocolo', old.numero_protocolo,
      'unidade', old.unidade,
      'bloco', old.bloco,
      'tipo', old.tipo,
      'valor', old.valor,
      'statusAnterior', old.status
    )
  );
  return old;
end $$;

drop trigger if exists fines_apagar_audit on public.fines;
create trigger fines_apagar_audit
  before delete on public.fines
  for each row execute function public.fines_apagar_audit();

-- ──────────────────────────────────────────────
-- 4) Só o ADM apaga. Remove toda policy de DELETE existente (inclusive as criadas
--    à mão no painel) e recria só a do ADM.
-- ──────────────────────────────────────────────

do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'fines' and cmd = 'DELETE'
  loop
    execute format('drop policy if exists %I on public.fines', p.policyname);
  end loop;
end $$;

create policy "fines_delete_adm"
  on public.fines for delete
  using (public.get_user_role() = 'ADM');

-- ──────────────────────────────────────────────
-- 5) Guard do morador (0024): não toca nos campos da anulação nem em multa anulada.
--    Mesma lógica de antes, só com as linhas novas.
-- ──────────────────────────────────────────────

create or replace function public.fines_guard_morador_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.get_user_role() is distinct from 'MORADOR' then
    return new;
  end if;

  if old.status = 'ANULADA' then
    raise exception 'Esta multa foi anulada e não pode mais ser alterada.'
      using errcode = '42501';
  end if;

  if new.numero_protocolo is distinct from old.numero_protocolo
    or new.bloco is distinct from old.bloco
    or new.unidade is distinct from old.unidade
    or new.unit_id is distinct from old.unit_id
    or new.morador_nome is distinct from old.morador_nome
    or new.data_infracao is distinct from old.data_infracao
    or new.prazo_recurso_data is distinct from old.prazo_recurso_data
    or new.artigo_regimento is distinct from old.artigo_regimento
    or new.descricao_infracao is distinct from old.descricao_infracao
    or new.valor is distinct from old.valor
    or new.tipo is distinct from old.tipo
    or new.created_at is distinct from old.created_at
    or new.recurso_resposta is distinct from old.recurso_resposta
    or new.recurso_data_resposta is distinct from old.recurso_data_resposta
    or new.recurso_analisado_por is distinct from old.recurso_analisado_por
    or new.anulada_motivo is distinct from old.anulada_motivo
    or new.anulada_por is distinct from old.anulada_por
    or new.anulada_por_nome is distinct from old.anulada_por_nome
    or new.anulada_por_papel is distinct from old.anulada_por_papel
    or new.anulada_em is distinct from old.anulada_em
  then
    raise exception 'Morador não pode alterar os dados da notificação, apenas registrar ciência ou recurso.'
      using errcode = '42501';
  end if;

  if new.status is distinct from old.status
    and new.status not in ('CIENCIA_REGISTRADA', 'EM_RECURSO')
  then
    raise exception 'Morador não pode alterar o status da notificação para %.', new.status
      using errcode = '42501';
  end if;

  if new.recurso_status is distinct from old.recurso_status
    and new.recurso_status is distinct from 'EM_ANALISE'
  then
    raise exception 'Morador não pode julgar o próprio recurso.'
      using errcode = '42501';
  end if;

  return new;
end $$;

drop trigger if exists fines_guard_morador_update on public.fines;
create trigger fines_guard_morador_update
  before update on public.fines
  for each row execute function public.fines_guard_morador_update();
