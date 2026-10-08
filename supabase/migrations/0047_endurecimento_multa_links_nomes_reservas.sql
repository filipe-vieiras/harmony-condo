-- Harmony — endurecimento de regras que só existiam na tela (revisão de segurança, itens M2, L5, L7, L10, L11).
--
-- 1) Multa (M2 + L5): o morador só registra a ciência UMA vez (a data e o nome saem do servidor, não do navegador) e o
--    recurso UMA vez, dentro do prazo (até o fim do dia de prazo_recurso_data, fuso America/Sao_Paulo), com texto de pelo menos
--    10 caracteres depois do trim. Depois disso ciencia_*, recurso_texto, recurso_data e recurso_anexo_nome ficam imutáveis
--    para ele. A gestão mantém o que já podia (o gatilho só restringe MORADOR).
-- 2) Links (L11): documents.link_externo e portal_administradora.link_externo só aceitam http(s) ('#' é o marcador antigo de
--    "sem link" nos contatos; '' é o portal ainda não preenchido). Constraint NOT VALID (vale para o que for gravado daqui em
--    diante) e VALIDATE só se os dados atuais já estiverem limpos; senão avisa e não derruba a migração.
-- 3) Nomes reservados (L10): "Aguardando validação" (com ou sem acento, caixa, espaços ou pontuação) não pode ser nome de
--    unidade, morador nem autocadastro, para ninguém fingir ser a etiqueta de status na lista de unidades. Nome antigo que
--    já estava gravado e não mudou continua passando.
-- 4) Reserva (L7): horario_fim > horario_inicio. A reserva é de um único dia (data + dois horários), não cruza a meia-noite.
--
-- Aditiva e idempotente (CREATE OR REPLACE, constraints e gatilhos recriados). Não altera nem apaga nenhum dado.

-- ──────────────────────────────────────────────
-- 1) Multa: guarda do morador (substitui a de 0029)
-- ──────────────────────────────────────────────
create or replace function public.fines_guard_morador_update()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_texto text;
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

  -- Ciência: uma vez só (de nula para preenchida). Data e nome são do servidor: o que o navegador mandar é ignorado.
  if new.ciencia_data is distinct from old.ciencia_data
    or new.ciencia_usuario_nome is distinct from old.ciencia_usuario_nome
    or (new.status is distinct from old.status and new.status = 'CIENCIA_REGISTRADA')
  then
    if old.ciencia_data is not null or old.ciencia_usuario_nome is not null or old.status <> 'PENDENTE_CIENCIA' then
      raise exception 'A ciência desta notificação já foi registrada e não pode ser alterada.'
        using errcode = '42501';
    end if;
    if new.status is distinct from 'CIENCIA_REGISTRADA' or new.ciencia_data is null or new.ciencia_usuario_nome is null then
      raise exception 'Para registrar a ciência, o status e os dados da ciência precisam ir juntos.'
        using errcode = '42501';
    end if;
    new.ciencia_data := now();
    select coalesce(p.name, 'Usuário') into new.ciencia_usuario_nome from public.profiles p where p.id = auth.uid();
    new.ciencia_usuario_nome := coalesce(new.ciencia_usuario_nome, 'Usuário');
  end if;

  -- Recurso: uma vez só, depois da ciência, dentro do prazo e com texto de verdade.
  if new.recurso_texto is distinct from old.recurso_texto
    or new.recurso_data is distinct from old.recurso_data
    or new.recurso_anexo_nome is distinct from old.recurso_anexo_nome
    or new.recurso_status is distinct from old.recurso_status
    or (new.status is distinct from old.status and new.status = 'EM_RECURSO')
  then
    if old.recurso_texto is not null or old.recurso_data is not null or old.recurso_anexo_nome is not null
      or old.recurso_status is not null or old.status <> 'CIENCIA_REGISTRADA'
    then
      raise exception 'O recurso desta notificação já foi enviado, ou ainda falta registrar a ciência. Ele não pode ser alterado.'
        using errcode = '42501';
    end if;
    if new.status is distinct from 'EM_RECURSO' or new.recurso_status is distinct from 'EM_ANALISE' or new.recurso_data is null then
      raise exception 'Para enviar o recurso, o status e os dados do recurso precisam ir juntos.'
        using errcode = '42501';
    end if;
    -- Prazo vale até o fim do dia, no horário de Brasília.
    if (now() at time zone 'America/Sao_Paulo')::date > old.prazo_recurso_data then
      raise exception 'O prazo para recurso desta notificação já terminou.'
        using errcode = '42501';
    end if;
    v_texto := regexp_replace(coalesce(new.recurso_texto, ''), '^\s+|\s+$', '', 'g');
    if char_length(v_texto) < 10 then
      raise exception 'Escreva pelo menos 10 caracteres para explicar o recurso.'
        using errcode = '23514';
    end if;
    new.recurso_texto := v_texto;
    new.recurso_data := now();
  end if;

  return new;
end $$;

drop trigger if exists fines_guard_morador_update on public.fines;
create trigger fines_guard_morador_update
  before update on public.fines
  for each row execute function public.fines_guard_morador_update();

-- ──────────────────────────────────────────────
-- 2) Links: só http(s)
-- ──────────────────────────────────────────────
create or replace function public.url_http_valida(u text)
returns boolean language sql immutable set search_path = public as $$
  select coalesce(u, '') ~* '^https?://[^[:space:]]+$';
$$;

alter table public.documents drop constraint if exists documents_link_externo_http;
alter table public.documents add constraint documents_link_externo_http
  check (link_externo = '#' or public.url_http_valida(link_externo)) not valid;

alter table public.portal_administradora drop constraint if exists portal_administradora_link_http;
alter table public.portal_administradora add constraint portal_administradora_link_http
  check (link_externo = '' or public.url_http_valida(link_externo)) not valid;

do $$
begin
  if exists (select 1 from public.documents where not (link_externo = '#' or public.url_http_valida(link_externo))) then
    raise warning '0047: há documento com link que não é http(s); a constraint vale só para novos dados. Corrija e rode VALIDATE CONSTRAINT.';
  else
    alter table public.documents validate constraint documents_link_externo_http;
  end if;
  if exists (select 1 from public.portal_administradora where not (link_externo = '' or public.url_http_valida(link_externo))) then
    raise warning '0047: o link do portal da administradora não é http(s); a constraint vale só para novos dados.';
  else
    alter table public.portal_administradora validate constraint portal_administradora_link_http;
  end if;
end $$;

-- ──────────────────────────────────────────────
-- 3) Nomes reservados
-- ──────────────────────────────────────────────
-- Só letras minúsculas sem acento: espaço, pontuação, invisíveis e acentos combinados somem antes de comparar.
create or replace function public.nome_reservado(t text)
returns boolean language sql immutable set search_path = public as $$
  select regexp_replace(
           translate(lower(coalesce(t, '')), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'),
           '[^a-z]', '', 'g') like '%aguardandovalidacao%';
$$;

create or replace function public.units_nome_reservado()
returns trigger language plpgsql set search_path = public as $$
begin
  if (tg_op = 'INSERT' or new.proprietario_nome is distinct from old.proprietario_nome)
     and public.nome_reservado(new.proprietario_nome) then
    raise exception 'nome_reservado' using errcode = 'P0001';
  end if;
  if new.moradores is not null and jsonb_typeof(new.moradores) = 'array' and exists (
    select 1 from jsonb_array_elements(new.moradores) m
    where (tg_op = 'INSERT' or old.moradores is null or jsonb_typeof(old.moradores) <> 'array'
           or not exists (select 1 from jsonb_array_elements(old.moradores) o where o = m))
      and jsonb_typeof(m) = 'object' and jsonb_typeof(m->'nome') = 'string' and public.nome_reservado(m->>'nome')
  ) then
    raise exception 'nome_reservado' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists units_nome_reservado on public.units;
create trigger units_nome_reservado before insert or update of proprietario_nome, moradores on public.units
  for each row execute function public.units_nome_reservado();

alter table public.autocadastros drop constraint if exists autocadastros_nome_nao_reservado;
alter table public.autocadastros add constraint autocadastros_nome_nao_reservado
  check (not public.nome_reservado(nome)) not valid;

-- ──────────────────────────────────────────────
-- 4) Reserva: fim depois do início
-- ──────────────────────────────────────────────
alter table public.reservations drop constraint if exists reservations_horario_fim_apos_inicio;
alter table public.reservations add constraint reservations_horario_fim_apos_inicio
  check (horario_fim > horario_inicio) not valid;

do $$
begin
  if exists (select 1 from public.reservations where not (horario_fim > horario_inicio)) then
    raise warning '0047: há reserva com fim <= início; a constraint vale só para novos dados. Corrija e rode VALIDATE CONSTRAINT.';
  else
    alter table public.reservations validate constraint reservations_horario_fim_apos_inicio;
  end if;
  if exists (select 1 from public.autocadastros where public.nome_reservado(nome)) then
    raise warning '0047: há autocadastro com nome reservado; a constraint vale só para novos dados.';
  else
    alter table public.autocadastros validate constraint autocadastros_nome_nao_reservado;
  end if;
end $$;
