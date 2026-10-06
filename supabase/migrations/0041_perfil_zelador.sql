-- Harmony — Perfil de Zelador, fase 1 (issue #82, PRD docs/specs/2026-10-05-perfil-zelador.md).
--
-- O Zelador é um FUNCIONÁRIO EXTERNO, sem unidade, operacional e sem dado sensível. Cargo único,
-- designado por Síndico e ADM (convite de pessoa nova). Pode: aprovar, recusar e cancelar reservas,
-- registrar reserva em nome de morador, ver nome/telefone/e-mail de moradores e dependentes (sem
-- documento: a 0040 já separou o RG/CPF), ver veículos e cadastrar veículo e visitante, ler e
-- publicar avisos, ler Links e Documentos e INTERDITAR espaço. Não pode: documento, multa, auditoria,
-- usuários, convites, autocadastro, exportação, transferência de cargo, nem mexer em valor, faixa,
-- bloqueios, aprovação ou cadastro de espaço.
--
-- O que esta migração faz:
--   1) profiles.desativado_em; papel ZELADOR nos checks; índice único parcial (ignora desativado);
--      tem_perfil() e get_user_role() tratam conta desativada como SEM perfil.
--   2) tem_perfil_operacao(): Síndico, Subsíndico, ADM ou Zelador. is_admin() NÃO muda. Só entra nas
--      policies que o PRD autoriza (reservas, spaces só leitura, notices, notificações de reserva).
--   3) Trava de unidade: conta ZELADOR nunca é ligada a unidade (units e profiles).
--   4) Interdição: spaces.motivo_interdicao e a função interditar_espaco(), SECURITY DEFINER, que
--      altera SÓ ativo e motivo, audita e NÃO toca em reservas nem em notificações.
--   5) Reservas: Zelador lê tudo, registra em nome de morador, aprova/recusa/cancela, mas só mexe em
--      status/parecer (gatilho). Apagar reserva continua só da gestão.
--   6) Units (leitura), vehicles (ver/inserir), notices (publicar) e notificações para o Zelador.
--   7) Transferência de cargo (0037): ZELADOR só para pessoa nova; quem sai tem o ACESSO REMOVIDO
--      (desativado_em), nunca vira Morador/provisório. Sessões encerradas por função própria.
--   8) Reativar o acesso de um ex-Zelador (só Síndico/ADM, só com o cargo vago, auditado).
--
-- Aditiva e idempotente: colunas com IF NOT EXISTS, funções com CREATE OR REPLACE, policies
-- recriadas, constraints trocadas por DROP IF EXISTS + ADD.

-- ──────────────────────────────────────────────
-- 1) Papel, desativação e funções de perfil
-- ──────────────────────────────────────────────
alter table public.profiles add column if not exists desativado_em timestamptz;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('SINDICO', 'SUBSINDICO', 'ADM', 'PORTARIA', 'CONSELHO', 'MORADOR', 'ZELADOR'));

alter table public.pending_invites drop constraint if exists pending_invites_role_check;
alter table public.pending_invites add constraint pending_invites_role_check
  check (role in ('SINDICO', 'SUBSINDICO', 'ADM', 'PORTARIA', 'CONSELHO', 'MORADOR', 'ZELADOR'));

-- Um Zelador ATIVO por vez (como Síndico e Subsíndico). Conta desativada não ocupa a vaga.
create unique index if not exists profiles_singleton_zelador
  on public.profiles (role) where role = 'ZELADOR' and desativado_em is null;

-- Conta desativada = sem perfil para o banco inteiro. Todas as policies passam por estas duas funções
-- (SECURITY DEFINER: leem profiles sem passar pela RLS dele, então não há recursão).
create or replace function public.tem_perfil()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and desativado_em is null);
$$;

create or replace function public.get_user_role()
returns text language sql security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and desativado_em is null;
$$;

-- Cada um lê o próprio perfil, menos quem teve o acesso removido (a gestão continua lendo pelas outras policies).
drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles
  using (auth.uid() = id and desativado_em is null);

-- O histórico só aceita linha própria de quem ainda tem acesso.
drop policy if exists audit_logs_insert_proprio on public.audit_logs;
create policy audit_logs_insert_proprio on public.audit_logs for insert
  with check (
    usuario_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = audit_logs.usuario_role and p.name = audit_logs.usuario_nome
        and p.desativado_em is null
    )
  );

-- ──────────────────────────────────────────────
-- 2) tem_perfil_operacao()
-- ──────────────────────────────────────────────
create or replace function public.tem_perfil_operacao()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and desativado_em is null and role in ('SINDICO', 'SUBSINDICO', 'ADM', 'ZELADOR')
  );
$$;

-- ──────────────────────────────────────────────
-- 3) Trava de unidade para o Zelador
-- ──────────────────────────────────────────────
create or replace function public.units_sem_zelador()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.usuario_id is not null
     and exists (select 1 from public.profiles p where p.id = new.usuario_id and p.role = 'ZELADOR') then
    raise exception 'O Zelador é funcionário externo e não pode ser ligado a uma unidade.' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists units_sem_zelador on public.units;
create trigger units_sem_zelador
  before insert or update of usuario_id on public.units
  for each row execute function public.units_sem_zelador();

create or replace function public.profiles_zelador_sem_unidade()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role = 'ZELADOR' then
    if nullif(btrim(coalesce(new.bloco, '')), '') is not null or nullif(btrim(coalesce(new.unidade, '')), '') is not null
       or exists (select 1 from public.units u where u.usuario_id = new.id) then
      raise exception 'O Zelador é funcionário externo e não pode ter unidade.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists profiles_zelador_sem_unidade on public.profiles;
create trigger profiles_zelador_sem_unidade
  before insert or update of role, bloco, unidade on public.profiles
  for each row execute function public.profiles_zelador_sem_unidade();

-- ──────────────────────────────────────────────
-- 4) Interdição de espaço
-- ──────────────────────────────────────────────
alter table public.spaces add column if not exists motivo_interdicao text;
alter table public.spaces drop constraint if exists spaces_motivo_interdicao_check;
alter table public.spaces add constraint spaces_motivo_interdicao_check
  check (motivo_interdicao is null or (char_length(motivo_interdicao) between 1 and 140 and ativo = false));

-- Quem está logado (authenticated/anon) NUNCA muda `ativo` nem o motivo direto na tabela: só por
-- interditar_espaco(), que roda como dono da função (current_user diferente de authenticated) e audita.
-- Service role e manutenção direta passam. Espaço ativo nunca guarda motivo velho.
create or replace function public.spaces_guard_interdicao()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null and current_user in ('authenticated', 'anon') then
      new.motivo_interdicao := null;
    end if;
  elsif auth.uid() is not null and current_user in ('authenticated', 'anon')
        and (new.ativo is distinct from old.ativo or new.motivo_interdicao is distinct from old.motivo_interdicao) then
    raise exception 'interdicao_pela_funcao' using errcode = '42501';
  end if;
  if new.ativo then
    new.motivo_interdicao := null;
  end if;
  return new;
end $$;

drop trigger if exists spaces_00_guard_interdicao on public.spaces;
create trigger spaces_00_guard_interdicao
  before insert or update on public.spaces
  for each row execute function public.spaces_guard_interdicao();

-- Interditar (p_ativo = false) ou reabrir (p_ativo = true). Altera SÓ spaces.ativo e spaces.motivo_interdicao.
-- NÃO cancela nem altera reserva nenhuma e NÃO cria notificação: as reservas futuras continuam valendo e
-- quem precisar cancela uma a uma. O perfil é relido do banco a cada chamada.
create or replace function public.interditar_espaco(p_espaco_id text, p_ativo boolean, p_motivo text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.profiles%rowtype;
  s public.spaces%rowtype;
  v_motivo text;
  v_acao text;
begin
  if auth.uid() is null then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  select * into p from public.profiles where id = auth.uid() and desativado_em is null;
  if not found or p.role not in ('SINDICO', 'SUBSINDICO', 'ADM', 'ZELADOR') then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  if p_ativo is null or p_espaco_id is null then
    raise exception 'dados_invalidos' using errcode = 'P0001';
  end if;

  select * into s from public.spaces where id = p_espaco_id for update;
  if not found then
    raise exception 'espaco_nao_encontrado' using errcode = 'P0002';
  end if;

  -- Motivo: uma linha. Quebras e caracteres de controle viram espaço; só vale ao interditar.
  if p_ativo then
    v_motivo := null;
  else
    v_motivo := nullif(btrim(regexp_replace(regexp_replace(coalesce(p_motivo, ''), '[[:cntrl:]]', ' ', 'g'), ' {2,}', ' ', 'g')), '');
    if v_motivo is not null and char_length(v_motivo) > 140 then
      raise exception 'motivo_muito_longo' using errcode = 'P0001';
    end if;
  end if;

  if s.ativo = p_ativo and s.motivo_interdicao is not distinct from v_motivo then
    return jsonb_build_object('ok', true, 'alterado', false, 'ativo', s.ativo, 'motivo', s.motivo_interdicao);
  end if;

  v_acao := case
    when p_ativo then 'Reabriu o espaço ' || s.nome
    when s.ativo then 'Interditou o espaço ' || s.nome
    else 'Alterou o motivo da interdição do espaço ' || s.nome
  end;

  update public.spaces set ativo = p_ativo, motivo_interdicao = v_motivo where id = s.id;

  insert into public.audit_logs (usuario_id, usuario_nome, usuario_role, acao, modulo, detalhes)
  values (
    p.id, p.name, p.role, v_acao, 'RESERVAS',
    jsonb_build_object('espacoId', s.id, 'espaco', s.nome, 'ativo', p_ativo, 'ativoAntes', s.ativo, 'motivo', v_motivo)
  );

  return jsonb_build_object('ok', true, 'alterado', true, 'ativo', p_ativo, 'motivo', v_motivo);
end $$;

revoke all on function public.interditar_espaco(text, boolean, text) from public, anon;
grant execute on function public.interditar_espaco(text, boolean, text) to authenticated, service_role;

-- Quem interditou e quando, só para a equipe operacional (o morador lê o motivo, não o nome de quem escreveu).
-- Vem da própria auditoria da função acima: a última linha de interdição de cada espaço hoje interditado.
create or replace function public.interdicoes_atuais()
returns table (espaco_id text, por_nome text, em timestamptz)
language sql stable security definer set search_path = public as $$
  select s.id, a.usuario_nome, a.created_at
  from public.spaces s
  join lateral (
    select l.usuario_nome, l.created_at
    from public.audit_logs l
    where l.modulo = 'RESERVAS' and l.detalhes->>'espacoId' = s.id and l.detalhes->>'ativo' = 'false'
    order by l.created_at desc
    limit 1
  ) a on true
  where s.ativo = false and public.tem_perfil_operacao();
$$;

revoke all on function public.interdicoes_atuais() from public, anon;
grant execute on function public.interdicoes_atuais() to authenticated, service_role;

-- ──────────────────────────────────────────────
-- 5) Reservas
-- ──────────────────────────────────────────────
-- Ver: a equipe de antes + Zelador. O ramo da própria unidade só vale para conta com acesso.
drop policy if exists reservations_read on public.reservations;
create policy reservations_read on public.reservations for select using (
  public.get_user_role() in ('SINDICO', 'SUBSINDICO', 'ADM', 'CONSELHO', 'PORTARIA', 'ZELADOR')
  or (
    public.tem_perfil()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.bloco = reservations.bloco and p.unidade = reservations.unidade
    )
  )
);

-- Registrar em nome de morador: Portaria, Conselho e agora Zelador (mesmas regras de status do banco).
drop policy if exists reservations_insert on public.reservations;
create policy reservations_insert on public.reservations for insert with check (
  public.is_admin()
  or (
    status in ('PENDENTE', 'APROVADA')
    and exists (select 1 from public.spaces s where s.id = reservations.espaco_id and s.exige_aprovacao = (reservations.status = 'PENDENTE'))
    and (
      public.get_user_role() in ('PORTARIA', 'CONSELHO', 'ZELADOR')
      or exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role = 'MORADOR' and p.bloco = reservations.bloco and p.unidade = reservations.unidade
      )
    )
  )
);

-- Aprovar, recusar e cancelar (inclusive reserva já aprovada). Apagar continua só da gestão
-- (reservations_delete_admin). Quais colunas o Zelador pode mexer: gatilho abaixo.
drop policy if exists reservations_update_operacao on public.reservations;
create policy reservations_update_operacao on public.reservations for update
  using (public.tem_perfil_operacao()) with check (public.tem_perfil_operacao());

-- O Zelador decide, não edita: só status e parecer. Valor, pessoas, data, espaço, unidade e horário
-- ficam como estão (o gatilho de valor da 0039 já barra valor/pessoas/data/espaço para todos).
create or replace function public.reservations_zelador_so_decide()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is null or public.get_user_role() is distinct from 'ZELADOR' then
    return new;
  end if;
  if new.id is distinct from old.id
     or new.espaco_id is distinct from old.espaco_id
     or new.espaco_nome is distinct from old.espaco_nome
     or new.bloco is distinct from old.bloco
     or new.unidade is distinct from old.unidade
     or new.morador_nome is distinct from old.morador_nome
     or new.data is distinct from old.data
     or new.horario_inicio is distinct from old.horario_inicio
     or new.horario_fim is distinct from old.horario_fim
     or new.convidados_estimados is distinct from old.convidados_estimados
     or new.valor_uso is distinct from old.valor_uso
     or new.taxa_higienizacao is distinct from old.taxa_higienizacao
     or new.created_at is distinct from old.created_at then
    raise exception 'reserva_imutavel' using errcode = 'P0001';
  end if;
  if new.status not in ('APROVADA', 'RECUSADA', 'CANCELADA') then
    raise exception 'reserva_imutavel' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists reservations_06_zelador_so_decide on public.reservations;
create trigger reservations_06_zelador_so_decide
  before update on public.reservations
  for each row execute function public.reservations_zelador_so_decide();

-- ──────────────────────────────────────────────
-- 6) Units, veículos, avisos e notificações
-- ──────────────────────────────────────────────
-- Nome, telefone, e-mail, responsável e dependentes: sim. Documento: não (vive em unit_documentos, que
-- o Zelador nunca lê).
drop policy if exists units_read on public.units;
create policy units_read on public.units for select using (
  public.get_user_role() in ('SINDICO', 'SUBSINDICO', 'ADM', 'PORTARIA', 'CONSELHO', 'ZELADOR')
  or usuario_id = auth.uid()
);

drop policy if exists vehicles_read on public.vehicles;
create policy vehicles_read on public.vehicles for select using (
  public.get_user_role() in ('SINDICO', 'SUBSINDICO', 'ADM', 'PORTARIA', 'CONSELHO', 'ZELADOR')
  or unit_id = public.get_my_unit_id()
);

-- Veículo e visitante (a mesma policy de inserção, com o Zelador ao lado da Portaria). Editar e apagar
-- seguem sem ele.
drop policy if exists vehicles_insert on public.vehicles;
create policy vehicles_insert on public.vehicles for insert with check (
  public.get_user_role() in ('SINDICO', 'SUBSINDICO', 'ADM', 'PORTARIA', 'ZELADOR')
  or (public.get_user_role() = 'MORADOR' and unit_id is not null and unit_id = public.get_my_unit_id())
);

-- Publicar aviso: só com o próprio nome como autor e sem fixar (fixar, editar e apagar são da gestão).
drop policy if exists notices_insert_zelador on public.notices;
create policy notices_insert_zelador on public.notices for insert with check (
  public.get_user_role() = 'ZELADOR'
  and coalesce(fixado, false) = false
  and autor = (select p.name from public.profiles p where p.id = auth.uid())
);

-- Notificações: o pedido do morador também avisa o Zelador; e o Zelador avisa a unidade da decisão sobre
-- a reserva e o mural sobre o aviso que publicou (formas fixas, nada de aviso livre para todos).
drop policy if exists notifications_insert on public.notifications;
create policy notifications_insert on public.notifications for insert with check (
  usuario_id_alvo is null
  and (
    public.is_admin()
    or (
      public.tem_perfil() and not public.is_cadastro_provisorio()
      and perfil_alvo = any (array['SINDICO', 'SUBSINDICO', 'ADM', 'ZELADOR'])
      and unidade_alvo is null and unidade_id_alvo is null
    )
    or (
      public.get_user_role() = 'ZELADOR' and tipo = 'RESERVA' and perfil_alvo is null
      and unidade_id_alvo is not null and link_destino = '/reservas'
    )
    or (
      public.get_user_role() = 'ZELADOR' and tipo = 'AVISO' and perfil_alvo is null
      and unidade_alvo is null and unidade_id_alvo is null and link_destino = '/mural'
    )
  )
);

-- O Zelador nunca lê transferência de cargo, nem a que o envolve.
drop policy if exists cargo_transferencias_select on public.cargo_transferencias;
create policy cargo_transferencias_select on public.cargo_transferencias for select
  using (
    public.is_admin()
    or ((origem_id = auth.uid() or destino_id = auth.uid()) and public.get_user_role() is distinct from 'ZELADOR')
  );

-- ──────────────────────────────────────────────
-- 7) Transferência de cargo com Zelador (0037)
-- ──────────────────────────────────────────────
alter table public.cargo_transferencias drop constraint if exists cargo_transferencias_cargo_check;
alter table public.cargo_transferencias add constraint cargo_transferencias_cargo_check
  check (cargo in ('SINDICO', 'SUBSINDICO', 'CONSELHO', 'PORTARIA', 'ZELADOR'));

drop index if exists public.cargo_transf_pendente_cargo_unico;
create unique index if not exists cargo_transf_pendente_cargo_unico
  on public.cargo_transferencias (cargo)
  where status = 'PENDENTE' and cargo in ('SINDICO', 'SUBSINDICO', 'ZELADOR');

create or replace function public._cargo_rotulo(p_cargo text)
returns text language sql immutable set search_path = public as $$
  select case p_cargo
    when 'SINDICO' then 'Síndico'
    when 'SUBSINDICO' then 'Subsíndico'
    when 'CONSELHO' then 'Conselho'
    when 'PORTARIA' then 'Portaria'
    when 'ZELADOR' then 'Zelador'
    when 'MORADOR' then 'Morador'
    else p_cargo
  end;
$$;

-- Troca os perfis. Quem chama JÁ travou (FOR UPDATE) as contas e JÁ validou tudo.
-- ZELADOR: quem sai NÃO vira Morador nem provisório; recebe desativado_em (papel e histórico intactos).
-- Quem entra recebe o cargo, fica validado e ativo. A vaga é liberada antes de ser ocupada.
create or replace function public._trocar_cargo(p_cargo text, p_origem uuid, p_destino uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_destino_antes text;
  v_tem_unidade boolean;
  v_origem_novo text;
begin
  select role into v_destino_antes from public.profiles where id = p_destino;
  select exists (select 1 from public.units where usuario_id = p_origem) into v_tem_unidade;

  if p_cargo = 'ZELADOR' then
    update public.profiles set desativado_em = now() where id = p_origem;
    update public.profiles set role = 'ZELADOR', cadastro_validado = true, desativado_em = null where id = p_destino;
    return jsonb_build_object(
      'origemNovoPerfil', null,
      'destinoPerfilAnterior', v_destino_antes,
      'origemProvisorio', false,
      'origemAcessoRemovido', true
    );
  end if;

  if p_cargo = 'SINDICO' and v_destino_antes = 'SUBSINDICO' then
    -- Troca: o Síndico antigo vira Subsíndico (decisão do dono). Passa por Morador no meio
    -- para não ter dois Síndicos nem dois Subsíndicos em nenhum instante.
    update public.profiles set role = 'MORADOR', cadastro_validado = true where id = p_origem;
    update public.profiles set role = 'SINDICO', cadastro_validado = true where id = p_destino;
    update public.profiles set role = 'SUBSINDICO' where id = p_origem;
    v_origem_novo := 'SUBSINDICO';
  else
    -- Quem sai vira Morador: validado se tem unidade ligada; sem unidade, provisório (menor acesso).
    update public.profiles set role = 'MORADOR', cadastro_validado = v_tem_unidade where id = p_origem;
    update public.profiles set role = p_cargo, cadastro_validado = true where id = p_destino;
    v_origem_novo := 'MORADOR';
  end if;

  return jsonb_build_object(
    'origemNovoPerfil', v_origem_novo,
    'destinoPerfilAnterior', v_destino_antes,
    'origemProvisorio', (v_origem_novo = 'MORADOR' and not v_tem_unidade),
    'origemAcessoRemovido', false
  );
end $$;

-- Textos dos avisos (os mesmos na transferência imediata e no aceite do convite).
create or replace function public._avisos_da_troca(
  p_cargo text, p_origem_nome text, p_destino_nome text, p_origem uuid, p_destino uuid, p_res jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rotulo text := public._cargo_rotulo(p_cargo);
  v_poderes text;
  v_acesso text;
begin
  v_poderes := case p_cargo
    when 'SINDICO' then 'validar cadastros, emitir multas e ver dados dos moradores'
    when 'SUBSINDICO' then 'validar cadastros, emitir multas e ver dados dos moradores'
    when 'CONSELHO' then 'acompanhar relatórios, multas e o histórico'
    when 'ZELADOR' then 'decidir e cancelar reservas, interditar espaços e consultar moradores e veículos'
    else 'buscar placas e registrar pedidos de reserva'
  end;

  perform public._avisar_usuario(
    p_destino,
    'Você agora é ' || v_rotulo,
    p_origem_nome || ' passou o cargo de ' || v_rotulo || ' para você. Você já pode ' || v_poderes || '.'
  );

  if coalesce((p_res->>'origemAcessoRemovido')::boolean, false) then
    -- Quem saiu não lê mais nada (acesso removido): o aviso vai para a gestão (Síndico, Subsíndico e ADM
    -- leem todo aviso sem alvo de usuário). Sem e-mail nem telefone.
    insert into public.notifications (titulo, mensagem, tipo, perfil_alvo, link_destino)
    values (
      'Acesso do Zelador removido',
      'O acesso de ' || p_origem_nome || ' como Zelador foi removido.',
      'GERAL', 'SINDICO', '/usuarios'
    );
  else
    v_acesso := public._cargo_rotulo(p_res->>'origemNovoPerfil');
    perform public._avisar_usuario(
      p_origem,
      'Você passou o cargo de ' || v_rotulo,
      'O cargo agora é de ' || p_destino_nome || '. Seu acesso é de ' || v_acesso || '.'
    );
  end if;
end $$;

-- Transferir para uma conta que já existe (imediato). ZELADOR não entra aqui: o Zelador é funcionário
-- externo e só nasce de convite de pessoa nova (iniciar_transferencia_cargo). Fica recusado como cargo_invalido.
create or replace function public.transferir_cargo(
  p_executor uuid, p_cargo text, p_origem uuid, p_destino uuid, p_simular_falha_apos text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  e public.profiles%rowtype;
  o public.profiles%rowtype;
  d public.profiles%rowtype;
  v_pend record;
  v_res jsonb;
  v_tid uuid;
  v_rotulo text;
begin
  if p_cargo is null or p_cargo not in ('SINDICO', 'SUBSINDICO', 'CONSELHO', 'PORTARIA') then
    return jsonb_build_object('ok', false, 'codigo', 'cargo_invalido');
  end if;
  if p_executor is null or p_origem is null or p_destino is null then
    return jsonb_build_object('ok', false, 'codigo', 'dados_invalidos');
  end if;

  perform 1 from public.profiles where id in (p_executor, p_origem, p_destino) order by id for update;

  select * into e from public.profiles where id = p_executor;
  if not found or e.role not in ('ADM', 'SINDICO') or e.cadastro_validado is not true or e.desativado_em is not null then
    return jsonb_build_object('ok', false, 'codigo', 'sem_permissao');
  end if;
  if e.role = 'SINDICO' and p_cargo = 'SINDICO' and p_origem <> e.id then
    return jsonb_build_object('ok', false, 'codigo', 'sem_permissao');
  end if;

  select * into o from public.profiles where id = p_origem;
  if not found or o.role <> p_cargo or o.desativado_em is not null then
    return jsonb_build_object('ok', false, 'codigo', 'origem_desatualizada',
      'titularAtual', (select name from public.profiles where role = p_cargo order by name limit 1));
  end if;

  select * into d from public.profiles where id = p_destino;
  if not found
     or d.id = o.id or d.id = e.id
     or d.role not in ('MORADOR', 'SUBSINDICO', 'CONSELHO', 'PORTARIA')
     or d.cadastro_validado is not true
     or d.desativado_em is not null
     or not exists (
       select 1 from auth.users u
       where u.id = d.id and u.email_confirmed_at is not null
         and (u.banned_until is null or u.banned_until < now())
     ) then
    return jsonb_build_object('ok', false, 'codigo', 'destino_invalido', 'destinoNome', d.name);
  end if;

  select t.id, t.destino_nome into v_pend
  from public.cargo_transferencias t
  where t.status = 'PENDENTE'
    and ((p_cargo in ('SINDICO', 'SUBSINDICO') and t.cargo = p_cargo) or t.origem_id = p_origem)
  limit 1;
  if found then
    return jsonb_build_object('ok', false, 'codigo', 'pendencia_existente',
      'transferenciaId', v_pend.id, 'destinoNome', v_pend.destino_nome);
  end if;

  v_rotulo := public._cargo_rotulo(p_cargo);
  begin
    v_res := public._trocar_cargo(p_cargo, o.id, d.id);
    if p_simular_falha_apos = 'troca' then
      raise exception 'falha simulada após a troca dos perfis';
    end if;

    insert into public.cargo_transferencias
      (cargo, origem_id, origem_nome, destino_id, destino_nome, destino_tipo, status,
       executor_id, executor_nome, executor_role, concluido_em)
    values
      (p_cargo, o.id, o.name, d.id, d.name, 'EXISTENTE', 'CONCLUIDA', e.id, e.name, e.role, now())
    returning id into v_tid;

    insert into public.audit_logs (usuario_id, usuario_nome, usuario_role, acao, modulo, detalhes)
    values (
      e.id, e.name, e.role,
      'Transferiu o cargo de ' || v_rotulo || ' de ' || o.name || ' para ' || d.name,
      'SISTEMA',
      jsonb_build_object(
        'transferenciaId', v_tid, 'cargo', p_cargo, 'resultado', 'CONCLUIDA', 'tipoDestino', 'EXISTENTE',
        'origemId', o.id, 'destinoId', d.id, 'executorId', e.id,
        'origemCargoAnterior', o.role, 'origemCargoNovo', v_res->>'origemNovoPerfil',
        'destinoCargoAnterior', v_res->>'destinoPerfilAnterior', 'destinoCargoNovo', p_cargo,
        'origemProvisorio', (v_res->>'origemProvisorio')::boolean
      )
    );

    perform public._avisos_da_troca(p_cargo, o.name, d.name, o.id, d.id, v_res);

    if p_simular_falha_apos = 'historico' then
      raise exception 'falha simulada após gravar o histórico';
    end if;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'codigo', 'conflito');
  end;

  return jsonb_build_object(
    'ok', true, 'transferenciaId', v_tid, 'cargo', p_cargo,
    'origemNome', o.name, 'destinoNome', d.name,
    'origemNovoPerfil', v_res->>'origemNovoPerfil',
    'destinoPerfilAnterior', v_res->>'destinoPerfilAnterior',
    'origemProvisorio', (v_res->>'origemProvisorio')::boolean
  );
end $$;

-- Pessoa nova (pendente até aceitar). Para ZELADOR o perfil do convidado nasce DESATIVADO (sem unidade,
-- sem acesso a nada): nem durante o convite existe conta sem poder vendo o diretório. O aceite o ativa.
create or replace function public.iniciar_transferencia_cargo(
  p_executor uuid, p_cargo text, p_origem uuid, p_destino_id uuid,
  p_nome text, p_email text, p_telefone text, p_link text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  e public.profiles%rowtype;
  o public.profiles%rowtype;
  v_pend record;
  v_conta record;
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_nome text := btrim(coalesce(p_nome, ''));
  v_tid uuid;
  v_invite uuid;
begin
  if p_cargo is null or p_cargo not in ('SINDICO', 'SUBSINDICO', 'CONSELHO', 'PORTARIA', 'ZELADOR') then
    return jsonb_build_object('ok', false, 'codigo', 'cargo_invalido');
  end if;
  if p_executor is null or p_origem is null or p_destino_id is null
     or v_nome = '' or length(v_nome) > 120
     or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or length(v_email) > 200 then
    return jsonb_build_object('ok', false, 'codigo', 'dados_invalidos');
  end if;

  perform 1 from public.profiles where id in (p_executor, p_origem) order by id for update;

  select * into e from public.profiles where id = p_executor;
  if not found or e.role not in ('ADM', 'SINDICO') or e.cadastro_validado is not true or e.desativado_em is not null then
    return jsonb_build_object('ok', false, 'codigo', 'sem_permissao');
  end if;
  if e.role = 'SINDICO' and p_cargo = 'SINDICO' and p_origem <> e.id then
    return jsonb_build_object('ok', false, 'codigo', 'sem_permissao');
  end if;

  select * into o from public.profiles where id = p_origem;
  if not found or o.role <> p_cargo or o.desativado_em is not null then
    return jsonb_build_object('ok', false, 'codigo', 'origem_desatualizada',
      'titularAtual', (select name from public.profiles where role = p_cargo and desativado_em is null order by name limit 1));
  end if;

  select id, name into v_conta from public.profiles where lower(email) = v_email limit 1;
  if found then
    return jsonb_build_object('ok', false, 'codigo', 'email_com_conta', 'contaId', v_conta.id, 'contaNome', v_conta.name);
  end if;
  if exists (select 1 from public.pending_invites where lower(email) = v_email) then
    return jsonb_build_object('ok', false, 'codigo', 'convite_existente');
  end if;

  select t.id, t.destino_nome into v_pend
  from public.cargo_transferencias t
  where t.status = 'PENDENTE'
    and ((p_cargo in ('SINDICO', 'SUBSINDICO', 'ZELADOR') and t.cargo = p_cargo) or t.origem_id = p_origem)
  limit 1;
  if found then
    return jsonb_build_object('ok', false, 'codigo', 'pendencia_existente',
      'transferenciaId', v_pend.id, 'destinoNome', v_pend.destino_nome);
  end if;

  begin
    insert into public.profiles (id, name, email, role, telefone, cadastro_validado, desativado_em)
    values (p_destino_id, v_nome, v_email, 'MORADOR', nullif(btrim(coalesce(p_telefone, '')), ''), false,
            case when p_cargo = 'ZELADOR' then now() else null end);

    insert into public.cargo_transferencias
      (cargo, origem_id, origem_nome, destino_id, destino_nome, destino_tipo, status,
       executor_id, executor_nome, executor_role)
    values
      (p_cargo, o.id, o.name, p_destino_id, v_nome, 'NOVO', 'PENDENTE', e.id, e.name, e.role)
    returning id into v_tid;

    insert into public.pending_invites (nome, email, role, status, criado_por, enviado_em, link_acesso, transferencia_id)
    values (v_nome, v_email, p_cargo, 'ENVIADO', e.name, now(), p_link, v_tid)
    returning id into v_invite;

    update public.cargo_transferencias set invite_id = v_invite where id = v_tid;

    insert into public.audit_logs (usuario_id, usuario_nome, usuario_role, acao, modulo, detalhes)
    values (
      e.id, e.name, e.role,
      'Iniciou a transferência do cargo de ' || public._cargo_rotulo(p_cargo) || ' de ' || o.name || ' para ' || v_nome
        || ' (aguarda aceitar o convite)',
      'SISTEMA',
      jsonb_build_object(
        'transferenciaId', v_tid, 'cargo', p_cargo, 'resultado', 'PENDENTE', 'tipoDestino', 'NOVO',
        'origemId', o.id, 'destinoId', p_destino_id, 'executorId', e.id, 'origemCargoAnterior', o.role
      )
    );
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'codigo', 'conflito');
  end;

  return jsonb_build_object('ok', true, 'transferenciaId', v_tid, 'conviteId', v_invite,
    'cargo', p_cargo, 'origemNome', o.name, 'destinoNome', v_nome);
end $$;

-- Cancelar uma pendência (quem pode e o que apaga não mudam; só reconhece o executor ativo).
create or replace function public.cancelar_transferencia_cargo(p_executor uuid, p_transferencia uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  e public.profiles%rowtype;
  t public.cargo_transferencias%rowtype;
  v_apagar_conta boolean;
begin
  if p_executor is null or p_transferencia is null then
    return jsonb_build_object('ok', false, 'codigo', 'dados_invalidos');
  end if;
  select * into e from public.profiles where id = p_executor for update;
  if not found or e.role not in ('ADM', 'SINDICO') or e.cadastro_validado is not true or e.desativado_em is not null then
    return jsonb_build_object('ok', false, 'codigo', 'sem_permissao');
  end if;

  select * into t from public.cargo_transferencias where id = p_transferencia for update;
  if not found or t.status <> 'PENDENTE' then
    return jsonb_build_object('ok', false, 'codigo', 'nao_pendente');
  end if;
  if e.role = 'SINDICO' and t.cargo = 'SINDICO' and t.origem_id is distinct from e.id then
    return jsonb_build_object('ok', false, 'codigo', 'sem_permissao');
  end if;

  update public.cargo_transferencias
     set status = 'CANCELADA', concluido_em = now(), invite_id = null
   where id = t.id;
  delete from public.pending_invites where transferencia_id = t.id;

  -- A conta provisória (no caso do Zelador, também desativada) só existia por causa do convite.
  v_apagar_conta := t.destino_tipo = 'NOVO' and t.destino_id is not null
    and exists (select 1 from public.profiles p where p.id = t.destino_id and p.role = 'MORADOR' and p.cadastro_validado is false)
    and not exists (select 1 from public.units u where u.usuario_id = t.destino_id)
    and not exists (select 1 from public.autocadastros a where a.user_id = t.destino_id);
  if v_apagar_conta then
    delete from public.profiles where id = t.destino_id;
  end if;

  insert into public.audit_logs (usuario_id, usuario_nome, usuario_role, acao, modulo, detalhes)
  values (
    e.id, e.name, e.role,
    'Cancelou a transferência do cargo de ' || public._cargo_rotulo(t.cargo) || ' para ' || t.destino_nome,
    'SISTEMA',
    jsonb_build_object(
      'transferenciaId', t.id, 'cargo', t.cargo, 'resultado', 'CANCELADA', 'tipoDestino', t.destino_tipo,
      'origemId', t.origem_id, 'destinoId', t.destino_id, 'executorId', e.id
    )
  );

  return jsonb_build_object('ok', true, 'cargo', t.cargo, 'destinoNome', t.destino_nome,
    'contaParaApagar', case when v_apagar_conta then t.destino_id else null end);
end $$;

-- Aceite do convite. Para ZELADOR a conta do convite está desativada: o aceite a ativa. Devolve também
-- o id de quem perdeu o acesso (a rota aplica o ban e encerra as sessões).
create or replace function public.aceitar_transferencia_cargo(p_usuario uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.cargo_transferencias%rowtype;
  o public.profiles%rowtype;
  d public.profiles%rowtype;
  v_res jsonb;
  v_email_convite text;
  v_motivo text;
begin
  if p_usuario is null then
    return jsonb_build_object('ok', true, 'aplicada', false);
  end if;

  select * into t from public.cargo_transferencias
   where destino_id = p_usuario and status = 'PENDENTE' for update;
  if not found then
    return jsonb_build_object('ok', true, 'aplicada', false);
  end if;

  perform 1 from public.profiles where id in (t.origem_id, t.destino_id) order by id for update;
  select * into d from public.profiles where id = t.destino_id;
  select * into o from public.profiles where id = t.origem_id;
  select email into v_email_convite from public.pending_invites where id = t.invite_id;

  v_motivo := case
    when d.id is null then 'a conta do convite não existe mais'
    when o.id is null or o.role <> t.cargo or o.desativado_em is not null then 'quem ocupava o cargo mudou desde o pedido'
    when d.role <> 'MORADOR' or d.cadastro_validado is not false then 'a conta do convite mudou desde o pedido'
    when v_email_convite is null or lower(v_email_convite) <> lower(coalesce(d.email, '')) then 'o e-mail da conta não confere com o do convite'
    when not exists (select 1 from auth.users u where u.id = d.id and lower(u.email) = lower(d.email)) then 'o e-mail da conta não confere com o do convite'
    else null
  end;

  if v_motivo is not null then
    update public.cargo_transferencias
       set status = 'FALHOU', motivo_falha = v_motivo, concluido_em = now(), invite_id = null
     where id = t.id;
    delete from public.pending_invites where transferencia_id = t.id;
    insert into public.audit_logs (usuario_id, usuario_nome, usuario_role, acao, modulo, detalhes)
    values (
      t.executor_id, t.executor_nome, t.executor_role,
      'A transferência do cargo de ' || public._cargo_rotulo(t.cargo) || ' para ' || t.destino_nome || ' não foi concluída: ' || v_motivo,
      'SISTEMA',
      jsonb_build_object('transferenciaId', t.id, 'cargo', t.cargo, 'resultado', 'FALHOU', 'tipoDestino', 'NOVO',
        'origemId', t.origem_id, 'destinoId', t.destino_id, 'executorId', t.executor_id)
    );
    if t.executor_id is not null then
      perform public._avisar_usuario(
        t.executor_id,
        'Transferência de cargo não concluída',
        t.destino_nome || ' aceitou o convite, mas ' || v_motivo || '. Nada foi alterado. Comece de novo.'
      );
    end if;
    return jsonb_build_object('ok', false, 'codigo', 'falhou', 'motivo', v_motivo);
  end if;

  begin
    v_res := public._trocar_cargo(t.cargo, o.id, d.id);
    update public.cargo_transferencias set status = 'CONCLUIDA', concluido_em = now(), invite_id = null where id = t.id;
    delete from public.pending_invites where transferencia_id = t.id;

    insert into public.audit_logs (usuario_id, usuario_nome, usuario_role, acao, modulo, detalhes)
    values (
      d.id, d.name, t.cargo,
      'Aceitou o convite e assumiu o cargo de ' || public._cargo_rotulo(t.cargo) || ', passado por ' || o.name,
      'SISTEMA',
      jsonb_build_object(
        'transferenciaId', t.id, 'cargo', t.cargo, 'resultado', 'CONCLUIDA', 'tipoDestino', 'NOVO',
        'origemId', o.id, 'destinoId', d.id, 'executorId', t.executor_id,
        'origemCargoAnterior', o.role,
        'origemCargoNovo', coalesce(v_res->>'origemNovoPerfil', 'ACESSO_REMOVIDO'),
        'destinoCargoAnterior', 'MORADOR', 'destinoCargoNovo', t.cargo,
        'origemProvisorio', (v_res->>'origemProvisorio')::boolean,
        'origemAcessoRemovido', (v_res->>'origemAcessoRemovido')::boolean
      )
    );
    perform public._avisos_da_troca(t.cargo, o.name, d.name, o.id, d.id, v_res);
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'codigo', 'conflito');
  end;

  return jsonb_build_object('ok', true, 'aplicada', true, 'cargo', t.cargo,
    'origemNome', o.name, 'destinoNome', d.name, 'transferenciaId', t.id,
    'origemAcessoRemovido', coalesce((v_res->>'origemAcessoRemovido')::boolean, false),
    'origemId', o.id);
end $$;

-- Encerra as sessões de uma conta (a rota também aplica o ban no Auth; o banco já barra sozinho porque a
-- conta desativada não tem perfil). Devolve false se o Auth não deixou apagar (o ban continua valendo).
create or replace function public.encerrar_sessoes_usuario(p_usuario uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  delete from auth.sessions where user_id = p_usuario;
  return true;
exception when others then
  return false;
end $$;

-- ──────────────────────────────────────────────
-- 8) Reativar o acesso de um ex-Zelador
-- ──────────────────────────────────────────────
-- Só Síndico e ADM, só com o cargo de Zelador vago e sem transferência pendente. A conta volta como estava
-- (mesmo papel, histórico preservado). A rota tira o ban do Auth.
create or replace function public.reativar_acesso_zelador(p_executor uuid, p_alvo uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  e public.profiles%rowtype;
  a public.profiles%rowtype;
begin
  if p_executor is null or p_alvo is null then
    return jsonb_build_object('ok', false, 'codigo', 'dados_invalidos');
  end if;
  perform 1 from public.profiles where id in (p_executor, p_alvo) order by id for update;
  select * into e from public.profiles where id = p_executor;
  if not found or e.role not in ('ADM', 'SINDICO') or e.cadastro_validado is not true or e.desativado_em is not null then
    return jsonb_build_object('ok', false, 'codigo', 'sem_permissao');
  end if;
  select * into a from public.profiles where id = p_alvo;
  if not found or a.role <> 'ZELADOR' or a.desativado_em is null then
    return jsonb_build_object('ok', false, 'codigo', 'nao_desativado');
  end if;
  if exists (select 1 from public.profiles where role = 'ZELADOR' and desativado_em is null)
     or exists (select 1 from public.pending_invites where role = 'ZELADOR' and (status = 'PENDENTE' or transferencia_id is not null))
     or exists (select 1 from public.cargo_transferencias where cargo = 'ZELADOR' and status = 'PENDENTE') then
    return jsonb_build_object('ok', false, 'codigo', 'cargo_ocupado');
  end if;

  begin
    update public.profiles set desativado_em = null where id = a.id;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'codigo', 'cargo_ocupado');
  end;

  insert into public.audit_logs (usuario_id, usuario_nome, usuario_role, acao, modulo, detalhes)
  values (e.id, e.name, e.role, 'Reativou o acesso de ' || a.name || ' como Zelador', 'SISTEMA',
          jsonb_build_object('cargo', 'ZELADOR', 'contaId', a.id, 'executorId', e.id));
  return jsonb_build_object('ok', true, 'nome', a.name);
end $$;

-- ──────────────────────────────────────────────
-- 9) Quem executa
-- ──────────────────────────────────────────────
revoke all on function public._cargo_rotulo(text) from public, anon, authenticated;
revoke all on function public._trocar_cargo(text, uuid, uuid) from public, anon, authenticated;
revoke all on function public._avisos_da_troca(text, text, text, uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.transferir_cargo(uuid, text, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.iniciar_transferencia_cargo(uuid, text, uuid, uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.cancelar_transferencia_cargo(uuid, uuid) from public, anon, authenticated;
revoke all on function public.aceitar_transferencia_cargo(uuid) from public, anon, authenticated;
revoke all on function public.encerrar_sessoes_usuario(uuid) from public, anon, authenticated;
revoke all on function public.reativar_acesso_zelador(uuid, uuid) from public, anon, authenticated;

grant execute on function public.transferir_cargo(uuid, text, uuid, uuid, text) to service_role;
grant execute on function public.iniciar_transferencia_cargo(uuid, text, uuid, uuid, text, text, text, text) to service_role;
grant execute on function public.cancelar_transferencia_cargo(uuid, uuid) to service_role;
grant execute on function public.aceitar_transferencia_cargo(uuid) to service_role;
grant execute on function public.encerrar_sessoes_usuario(uuid) to service_role;
grant execute on function public.reativar_acesso_zelador(uuid, uuid) to service_role;
