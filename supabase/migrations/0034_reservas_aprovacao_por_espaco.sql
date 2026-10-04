-- Harmony Residence — reservas: "Exige aprovação da equipe" por espaço (issue #49, bloco C).
-- Depende da 0032 (validação na criação) e da 0028 (policy de criação e notificações).
--
-- Decisão do dono (2026-10-04):
--   • Cada espaço tem spaces.exige_aprovacao (padrão ligado; os espaços existentes continuam
--     exigindo, ou seja, nada muda para eles).
--   • Exige: a reserva nasce PENDENTE. Não exige: nasce APROVADA. Quem decide é o BANCO
--     (gatilho), nunca o navegador: o status enviado por morador, Portaria e Conselho é ignorado.
--   • Só Síndico, Subsíndico e ADM alteram a configuração (spaces_write_staff, is_admin()).
--   • Mudar o campo vale só para reservas NOVAS: nada é recalculado nas já criadas.
--
-- Cuidado de segurança: a policy reservations_insert (0028) exigia status = 'PENDENTE' para quem
-- não é admin, e o WITH CHECK roda DEPOIS dos gatilhos BEFORE. Para aceitar a reserva já
-- aprovada pelo gatilho sem deixar o morador escolher, a policy passa a conferir que o status
-- gravado é exatamente o que a regra do espaço manda (defesa em profundidade: mesmo sem o
-- gatilho, forçar APROVADA em espaço que exige aprovação continua barrado).
--
-- Idempotente.

-- ──────────────────────────────────────────────
-- 1) Configuração por espaço
-- ──────────────────────────────────────────────
alter table public.spaces add column if not exists exige_aprovacao boolean not null default true;

-- Registra na trilha de auditoria quem mudou a configuração (efeito importante: tira o filtro da equipe).
create or replace function public.spaces_auditar_aprovacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text;
  v_role text;
begin
  if new.exige_aprovacao is distinct from old.exige_aprovacao then
    select p.name, p.role into v_nome, v_role from public.profiles p where p.id = auth.uid();
    insert into public.audit_logs (usuario_id, usuario_nome, usuario_role, acao, modulo, detalhes)
    values (
      auth.uid(),
      coalesce(v_nome, 'Manutenção direta no banco'),
      coalesce(v_role, 'SISTEMA'),
      case when new.exige_aprovacao
        then 'Passou a exigir aprovação da equipe no espaço ' || new.nome
        else 'Deixou de exigir aprovação da equipe no espaço ' || new.nome end,
      'ESPACOS',
      jsonb_build_object('spaceId', new.id, 'espaco', new.nome, 'exigeAprovacao', new.exige_aprovacao)
    );
  end if;
  return new;
end $$;

drop trigger if exists spaces_auditar_aprovacao on public.spaces;
create trigger spaces_auditar_aprovacao
  after update of exige_aprovacao on public.spaces
  for each row execute function public.spaces_auditar_aprovacao();

revoke all on function public.spaces_auditar_aprovacao() from public, anon, authenticated;

-- ──────────────────────────────────────────────
-- 2) Status inicial decidido pelo banco
-- ──────────────────────────────────────────────
-- "10" para rodar depois da validação (00). Sem usuário (service role: seed e manutenção)
-- o gatilho não age. Síndico/Subsíndico/ADM que enviam um status explícito diferente de
-- PENDENTE (ex.: lançar uma reserva já aprovada) continuam podendo; o PENDENTE padrão do
-- navegador também segue a regra do espaço.
create or replace function public.reservations_definir_status_inicial()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exige boolean;
begin
  if auth.uid() is null then
    return new;
  end if;

  if public.is_admin() and new.status is distinct from 'PENDENTE' then
    return new;
  end if;

  select s.exige_aprovacao into v_exige from public.spaces s where s.id = new.espaco_id;
  -- Espaço não achado: o caminho seguro é exigir aprovação (a 0032 já recusa espaço inexistente).
  v_exige := coalesce(v_exige, true);

  new.motivo_recusa := null;
  if v_exige then
    new.status := 'PENDENTE';
    new.avaliado_por := null;
    new.data_avaliacao := null;
  else
    -- Marcador do sistema: nunca o nome de quem pediu.
    new.status := 'APROVADA';
    new.avaliado_por := 'Aprovação automática';
    new.data_avaliacao := now();
  end if;
  return new;
end $$;

drop trigger if exists reservations_10_status_inicial on public.reservations;
create trigger reservations_10_status_inicial
  before insert on public.reservations
  for each row execute function public.reservations_definir_status_inicial();

revoke all on function public.reservations_definir_status_inicial() from public, anon, authenticated;

-- ──────────────────────────────────────────────
-- 3) Policy de criação: aceita o status que a regra do espaço mandou
-- ──────────────────────────────────────────────
drop policy if exists "reservations_insert" on public.reservations;
create policy "reservations_insert" on public.reservations for insert
  with check (
    public.is_admin()
    or (
      status in ('PENDENTE', 'APROVADA')
      -- O status gravado precisa ser o da regra do espaço: PENDENTE se exige aprovação,
      -- APROVADA se não exige. Quem pede não escolhe.
      and exists (
        select 1 from public.spaces s
        where s.id = reservations.espaco_id
          and s.exige_aprovacao = (reservations.status = 'PENDENTE')
      )
      and (
        -- Portaria e Conselho registram em nome de um morador (a mesma regra do espaço vale).
        public.get_user_role() in ('PORTARIA', 'CONSELHO')
        or exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and p.role = 'MORADOR'
            and p.bloco = reservations.bloco
            and p.unidade = reservations.unidade
        )
      )
    )
  );

-- ──────────────────────────────────────────────
-- 4) Avisos da reserva confirmada automaticamente (texto e destino decididos pelo banco)
-- ──────────────────────────────────────────────
-- O morador não pode criar aviso para a própria unidade (notifications_insert, 0028), então
-- quem grava é o banco, a partir do status que ELE definiu. Reserva que nasce PENDENTE segue
-- como hoje (o navegador avisa a equipe do pedido).
--  • Equipe: aviso informativo, sem ação pendente. Não sai quando a própria equipe registrou
--    a reserva em nome do morador (quem registrou já sabe).
--  • Unidade do morador: "Reserva confirmada!".
--  • Trilha de auditoria: "Reserva confirmada automaticamente", sem nome de pessoa.
create or replace function public.reservations_avisar_confirmacao_automatica()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unit_id text;
  v_dia text := to_char(new.data, 'DD/MM/YYYY');
begin
  if new.status is distinct from 'APROVADA' or new.avaliado_por is distinct from 'Aprovação automática' then
    return new;
  end if;

  select u.id into v_unit_id from public.units u
  where u.bloco = new.bloco and lower(btrim(u.numero)) = lower(btrim(new.unidade))
  limit 1;

  if public.get_user_role() = 'MORADOR' then
    insert into public.notifications (titulo, mensagem, tipo, perfil_alvo, link_destino)
    values (
      'Reserva confirmada automaticamente',
      new.espaco_nome || ', dia ' || v_dia || ', Apto ' || new.unidade || ' - Bloco ' || new.bloco
        || ' (' || new.morador_nome || '). Este espaço não exige aprovação.',
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

drop trigger if exists reservations_20_avisar_confirmacao on public.reservations;
create trigger reservations_20_avisar_confirmacao
  after insert on public.reservations
  for each row execute function public.reservations_avisar_confirmacao_automatica();

revoke all on function public.reservations_avisar_confirmacao_automatica() from public, anon, authenticated;
