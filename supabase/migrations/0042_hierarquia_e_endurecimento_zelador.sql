-- Harmony — hierarquia entre perfis de gestão (issue #68) e endurecimento do perfil de Zelador (issue #82).
--
-- 1) Hierarquia: níveis explícitos (ADM e Síndico 4, Subsíndico 3, Zelador 2, Conselho e Portaria 1, Morador 0). O espelho
--    de src/lib/hierarquia.ts: nivel_cargo, pode_agir_sobre, pode_convidar_cargo. A fila de convites só aceita (e só
--    deixa mexer em) cargo que o executor pode convidar; a auditoria de convite sai de gatilho do banco, não do navegador.
-- 2) O link de acesso do convite sai de pending_invites para convite_links, que só Síndico e ADM leem.
-- 3) Zelador: conta convidada pela fila nasce desativada e ativa no aceite; parecer da reserva íntegro e auditado no banco
--    (para qualquer perfil); avisos do Zelador limitados e o sino gerado pelo banco; leitura de unidades por função mínima;
--    texto livre sem caracteres invisíveis ou de direção; reserva encerrada não é reaberta; erro claro ao interditar espaço
--    que não existe; o Zelador edita e apaga só os avisos que ele publicou.
--
-- Aditiva e idempotente (IF NOT EXISTS, CREATE OR REPLACE, policies e gatilhos recriados).

-- ──────────────────────────────────────────────
-- 1) Hierarquia
-- ──────────────────────────────────────────────
create or replace function public.nivel_cargo(p text)
returns integer language sql immutable set search_path = public as $$
  select case p
    when 'ADM' then 4 when 'SINDICO' then 4 when 'SUBSINDICO' then 3 when 'ZELADOR' then 2
    when 'CONSELHO' then 1 when 'PORTARIA' then 1 when 'MORADOR' then 0 else -1 end;
$$;

-- Só sobre nível estritamente menor; exceções: ADM redefine a senha do Síndico; ninguém exclui ADM nem Síndico; o Zelador é
-- administrado só por Síndico e ADM; ninguém age sobre a própria conta.
create or replace function public.pode_agir_sobre(p_executor text, p_alvo text, p_acao text, p_mesma_conta boolean default false)
returns boolean language sql immutable set search_path = public as $$
  select case
    when coalesce(p_mesma_conta, false) or p_executor is null or p_alvo is null then false
    when public.nivel_cargo(p_executor) < 0 or public.nivel_cargo(p_alvo) < 0 then false
    when p_acao = 'EXCLUIR' and p_alvo in ('ADM', 'SINDICO') then false
    when p_acao = 'RESETAR_SENHA' and p_executor = 'ADM' and p_alvo = 'SINDICO' then true
    when p_alvo = 'ZELADOR' and p_executor not in ('SINDICO', 'ADM') then false
    else public.nivel_cargo(p_executor) > public.nivel_cargo(p_alvo) and public.nivel_cargo(p_executor) >= 3
  end;
$$;

create or replace function public.pode_convidar_cargo(p_executor text, p_cargo text)
returns boolean language sql immutable set search_path = public as $$
  select case
    when p_executor is null or p_cargo is null then false
    when public.nivel_cargo(p_executor) < 3 or public.nivel_cargo(p_cargo) < 0 or p_cargo = 'ADM' then false
    when p_cargo = 'ZELADOR' then p_executor in ('SINDICO', 'ADM')
    when p_executor = 'SUBSINDICO' then p_cargo in ('MORADOR', 'PORTARIA', 'CONSELHO')
    when p_executor = 'ADM' and p_cargo = 'SINDICO' then true
    else public.nivel_cargo(p_cargo) < public.nivel_cargo(p_executor)
  end;
$$;

-- Conta com cargo PENDENTE de aceite (convidada numa transferência, ou convite aberto) vale pelo nível do cargo de destino:
-- do contrário ela existe como Morador e um perfil de nível menor a sequestraria (redefinir a senha e aceitar o cargo).
create or replace function public.cargo_efetivo(p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce((
    select c from (
      select p.role as c from public.profiles p where p.id = p_user
      union all select t.cargo from public.cargo_transferencias t where t.destino_id = p_user and t.status = 'PENDENTE'
      union all select i.role from public.pending_invites i join public.profiles p2 on lower(i.email) = lower(p2.email) where p2.id = p_user
    ) x order by public.nivel_cargo(c) desc limit 1
  ), null);
$$;

create or replace function public.conta_com_cargo_pendente(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.cargo_transferencias t where t.destino_id = p_user and t.status = 'PENDENTE')
      or exists (select 1 from public.pending_invites i join public.profiles p on lower(i.email) = lower(p.email)
                  where p.id = p_user and i.transferencia_id is not null);
$$;

-- Espelho de src/lib/hierarquia.ts para uma conta concreta: nível efetivo e, com cargo pendente, só Síndico e ADM administram.
create or replace function public.pode_agir_sobre_conta(p_executor text, p_alvo uuid, p_acao text, p_mesma_conta boolean default false)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when public.conta_com_cargo_pendente(p_alvo) and p_executor not in ('SINDICO', 'ADM') then false
    else public.pode_agir_sobre(p_executor, public.cargo_efetivo(p_alvo), p_acao, p_mesma_conta)
  end;
$$;

-- Quem muda de cargo perde os links de uso único pendentes (redefinição de senha, convite) e as sessões abertas: um link gerado
-- ANTES da promoção não vale depois dela.
create or replace function public._invalidar_acesso_anterior(p_user uuid)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if p_user is null then return; end if;
  delete from auth.one_time_tokens where user_id = p_user;
  delete from auth.sessions where user_id = p_user;
end $$;
revoke all on function public._invalidar_acesso_anterior(uuid) from public, anon, authenticated;
grant execute on function public._invalidar_acesso_anterior(uuid) to service_role;

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
  perform public._invalidar_acesso_anterior(p_origem);
  perform public._invalidar_acesso_anterior(p_destino);
  select role into v_destino_antes from public.profiles where id = p_destino;
  select exists (select 1 from public.units where usuario_id = p_origem) into v_tem_unidade;

  if p_cargo = 'ZELADOR' then
    update public.profiles set desativado_em = now() where id = p_origem;
    update public.profiles set role = 'ZELADOR', cadastro_validado = true, desativado_em = null where id = p_destino;
    return jsonb_build_object('origemNovoPerfil', null, 'destinoPerfilAnterior', v_destino_antes,
      'origemProvisorio', false, 'origemAcessoRemovido', true);
  end if;

  if p_cargo = 'SINDICO' and v_destino_antes = 'SUBSINDICO' then
    update public.profiles set role = 'MORADOR', cadastro_validado = true where id = p_origem;
    update public.profiles set role = 'SINDICO', cadastro_validado = true where id = p_destino;
    update public.profiles set role = 'SUBSINDICO' where id = p_origem;
    v_origem_novo := 'SUBSINDICO';
  else
    update public.profiles set role = 'MORADOR', cadastro_validado = v_tem_unidade where id = p_origem;
    update public.profiles set role = p_cargo, cadastro_validado = true where id = p_destino;
    v_origem_novo := 'MORADOR';
  end if;

  return jsonb_build_object('origemNovoPerfil', v_origem_novo, 'destinoPerfilAnterior', v_destino_antes,
    'origemProvisorio', (v_origem_novo = 'MORADOR' and not v_tem_unidade), 'origemAcessoRemovido', false);
end $$;
revoke all on function public._trocar_cargo(text, uuid, uuid) from public, anon, authenticated;

-- Perfil de quem chama, relido do banco a cada vez.
create or replace function public.pode_convidar_para(p_cargo text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.pode_convidar_cargo(public.get_user_role(), p_cargo);
$$;

-- Nome "em branco": espaço, tab, NBSP, controles e invisíveis de formato (largura zero, direção, WORD JOINER, soft hyphen,
-- U+2800, U+3164, U+034F, fillers de Hangul, tags...). Uma função só, usada pela fila de convites e pelas unidades.
create or replace function public.nome_em_branco(t text)
returns boolean language sql immutable set search_path = public as $$
  select coalesce(t, '') ~ '^[[:space:]\u0001-\u001F\u007F-\u009F\u00A0\u00AD\u034F\u0600-\u0605\u061C\u06DD\u070F\u08E2\u115F\u1160\u1680\u17B4\u17B5\u180B-\u180E\u2000-\u200F\u2028-\u202F\u205F-\u206F\u2800\u3000\u3164\uFEFF\uFFA0\uFFF9-\uFFFB\U000110BD\U0001D173-\U0001D17A\U000E0001\U000E0020-\U000E007F]*$';
$$;

alter table public.pending_invites drop constraint if exists pending_invites_nome_nao_vazio;
alter table public.pending_invites add constraint pending_invites_nome_nao_vazio check (not public.nome_em_branco(nome));

-- Um convite por e-mail. Se a base já tiver e-mail repetido na fila, o índice NÃO é criado (a migração não falha): o aviso
-- lista a contagem e o índice entra quando a duplicidade for resolvida e a migração rodar de novo.
do $$
begin
  if exists (select 1 from public.pending_invites group by lower(email) having count(*) > 1) then
    raise warning '0042: há e-mail repetido em pending_invites; índice único NÃO criado. Resolva os duplicados e reaplique.';
  else
    create unique index if not exists pending_invites_email_unico on public.pending_invites (lower(email));
  end if;
end $$;

-- E-mail já usado por alguma conta (perfil ou Auth): o envio de convite recusa antes de gerar link (um link novo invalidaria o da conta que já existe).
create or replace function public.email_em_uso(p_email text)
returns boolean language sql stable security definer set search_path = public, auth as $$
  select exists (select 1 from public.profiles where lower(email) = lower(btrim(p_email)))
      or exists (select 1 from auth.users where lower(email) = lower(btrim(p_email)));
$$;
revoke all on function public.email_em_uso(text) from public, anon, authenticated;
grant execute on function public.email_em_uso(text) to service_role;

-- Morador (titular, inquilino ou dependente) sem nome não grava na unidade. `moradores` precisa ser lista; cada morador novo
-- ou alterado precisa de nome (texto) que não seja só branco/invisível. Morador que já estava na unidade e não mudou passa:
-- dado antigo sem nome não trava a edição do resto da unidade.
create or replace function public.units_moradores_nome_valido()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.moradores is null then return new; end if;
  if jsonb_typeof(new.moradores) <> 'array' then
    raise exception 'moradores_invalido' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from jsonb_array_elements(new.moradores) m
    where (tg_op = 'INSERT' or old.moradores is null or jsonb_typeof(old.moradores) <> 'array'
           or not exists (select 1 from jsonb_array_elements(old.moradores) o where o = m))
      and (jsonb_typeof(m) <> 'object' or jsonb_typeof(m->'nome') is distinct from 'string' or public.nome_em_branco(m->>'nome'))
  ) then
    raise exception 'morador_sem_nome' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists units_moradores_nome_valido on public.units;
create trigger units_moradores_nome_valido before insert or update of moradores on public.units
  for each row execute function public.units_moradores_nome_valido();

-- Conta com cargo pendente de aceite (convidada numa transferência) também não é ligada a unidade: a exclusão da unidade a levaria junto.
create or replace function public.units_sem_zelador()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.usuario_id is not null then
    if exists (select 1 from public.profiles p where p.id = new.usuario_id and p.role = 'ZELADOR') then
      raise exception 'O Zelador é funcionário externo e não pode ser ligado a uma unidade.' using errcode = 'P0001';
    end if;
    if public.conta_com_cargo_pendente(new.usuario_id) then
      raise exception 'conta_com_cargo_pendente' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

-- Fila de convites: nem inserir, nem mudar, nem apagar convite para cargo que o executor não pode convidar (consulta direta
-- ao banco inclusive). Ler continua da gestão (sem o link, que sai abaixo).
drop policy if exists pending_invites_insert_admin on public.pending_invites;
create policy pending_invites_insert_admin on public.pending_invites for insert
  with check (public.pode_convidar_para(role) and transferencia_id is null);
-- Convite de TRANSFERÊNCIA de cargo (transferencia_id) é decisão do Síndico e da ADM: só eles o alteram ou apagam.
drop policy if exists pending_invites_update_admin on public.pending_invites;
create policy pending_invites_update_admin on public.pending_invites for update
  using (public.pode_convidar_para(role) and (transferencia_id is null or public.get_user_role() in ('SINDICO', 'ADM')))
  with check (public.pode_convidar_para(role) and (transferencia_id is null or public.get_user_role() in ('SINDICO', 'ADM')));
drop policy if exists pending_invites_delete_admin on public.pending_invites;
create policy pending_invites_delete_admin on public.pending_invites for delete
  using (public.pode_convidar_para(role) and (transferencia_id is null or public.get_user_role() in ('SINDICO', 'ADM')));

-- Auditoria do convite gravada pelo banco, na mesma operação (nada de e-mail nem telefone).
create or replace function public.pending_invites_auditar()
returns trigger language plpgsql security definer set search_path = public as $$
declare p public.profiles%rowtype;
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  select * into p from public.profiles where id = auth.uid();
  if not found then return coalesce(new, old); end if;
  if tg_op = 'INSERT' then
    insert into public.audit_logs (usuario_id, usuario_nome, usuario_role, acao, modulo, detalhes)
    values (p.id, p.name, p.role, 'Cadastrou convite de acesso para ' || new.nome || ' (' || new.role || ')', 'SISTEMA',
            jsonb_build_object('conviteId', new.id, 'cargo', new.role));
  elsif old.transferencia_id is null then
    insert into public.audit_logs (usuario_id, usuario_nome, usuario_role, acao, modulo, detalhes)
    values (p.id, p.name, p.role, 'Cancelou o convite de acesso', 'SISTEMA',
            jsonb_build_object('conviteId', old.id, 'cargo', old.role, 'nome', old.nome));
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists pending_invites_auditar_ins on public.pending_invites;
create trigger pending_invites_auditar_ins after insert on public.pending_invites for each row execute function public.pending_invites_auditar();
drop trigger if exists pending_invites_auditar_del on public.pending_invites;
create trigger pending_invites_auditar_del after delete on public.pending_invites for each row execute function public.pending_invites_auditar();

-- ──────────────────────────────────────────────
-- 2) Link do convite fora do alcance do Subsíndico e do Zelador
-- ──────────────────────────────────────────────
create table if not exists public.convite_links (
  invite_id uuid primary key references public.pending_invites (id) on delete cascade,
  link_acesso text not null,
  criado_em timestamptz not null default now()
);
alter table public.convite_links enable row level security;
revoke all on table public.convite_links from public, anon, authenticated;
grant select on table public.convite_links to authenticated;
grant all on table public.convite_links to service_role;
drop policy if exists convite_links_select on public.convite_links;
create policy convite_links_select on public.convite_links for select using (public.get_user_role() in ('SINDICO', 'ADM'));

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'pending_invites' and column_name = 'link_acesso') then
    insert into public.convite_links (invite_id, link_acesso)
      select id, link_acesso from public.pending_invites where link_acesso is not null
      on conflict (invite_id) do nothing;
    alter table public.pending_invites drop column link_acesso;
  end if;
end $$;

-- ──────────────────────────────────────────────
-- 3) Zelador convidado pela fila: conta desativada até o aceite
-- ──────────────────────────────────────────────
alter table public.profiles add column if not exists aguardando_aceite boolean not null default false;
create unique index if not exists profiles_singleton_zelador_convite
  on public.profiles (role) where role = 'ZELADOR' and aguardando_aceite;

create or replace function public.ativar_convite_zelador(p_usuario uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a public.profiles%rowtype;
begin
  if p_usuario is null then return jsonb_build_object('ok', true, 'aplicada', false); end if;
  select * into a from public.profiles where id = p_usuario for update;
  if not found or a.role <> 'ZELADOR' or not a.aguardando_aceite then
    return jsonb_build_object('ok', true, 'aplicada', false);
  end if;
  perform public._invalidar_acesso_anterior(a.id);
  begin
    update public.profiles set desativado_em = null, aguardando_aceite = false where id = a.id;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'codigo', 'cargo_ocupado');
  end;
  insert into public.audit_logs (usuario_id, usuario_nome, usuario_role, acao, modulo, detalhes)
  values (a.id, a.name, 'ZELADOR', 'Aceitou o convite e assumiu o cargo de Zelador', 'SISTEMA',
          jsonb_build_object('cargo', 'ZELADOR', 'tipoDestino', 'NOVO', 'origem', 'FILA'));
  return jsonb_build_object('ok', true, 'aplicada', true, 'cargo', 'ZELADOR');
end $$;

create or replace function public.reativar_acesso_zelador(p_executor uuid, p_alvo uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e public.profiles%rowtype; a public.profiles%rowtype;
begin
  if p_executor is null or p_alvo is null then return jsonb_build_object('ok', false, 'codigo', 'dados_invalidos'); end if;
  perform 1 from public.profiles where id in (p_executor, p_alvo) order by id for update;
  select * into e from public.profiles where id = p_executor;
  if not found or e.role not in ('ADM', 'SINDICO') or e.cadastro_validado is not true or e.desativado_em is not null then
    return jsonb_build_object('ok', false, 'codigo', 'sem_permissao');
  end if;
  select * into a from public.profiles where id = p_alvo;
  if not found or a.role <> 'ZELADOR' or a.desativado_em is null or a.aguardando_aceite then
    return jsonb_build_object('ok', false, 'codigo', 'nao_desativado');
  end if;
  if exists (select 1 from public.profiles where role = 'ZELADOR' and (desativado_em is null or aguardando_aceite))
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

-- A transferência para pessoa nova guarda o link na tabela nova (a coluna antiga não existe mais).
create or replace function public.iniciar_transferencia_cargo(
  p_executor uuid, p_cargo text, p_origem uuid, p_destino_id uuid,
  p_nome text, p_email text, p_telefone text, p_link text)
returns jsonb language plpgsql security definer set search_path = public as $$
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

    insert into public.pending_invites (nome, email, role, status, criado_por, enviado_em, transferencia_id)
    values (v_nome, v_email, p_cargo, 'ENVIADO', e.name, now(), v_tid)
    returning id into v_invite;
    insert into public.convite_links (invite_id, link_acesso) values (v_invite, p_link);

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

-- ──────────────────────────────────────────────
-- 4) Texto livre sem caracteres invisíveis nem de direção
-- ──────────────────────────────────────────────
create or replace function public.limpar_texto_livre(t text)
returns text language sql immutable set search_path = public as $$
  select regexp_replace(coalesce(t, ''), '[​-‏‪-‮⁦-⁩﻿]', '', 'g');
$$;

-- Interdição: motivo limpo, erro claro quando o espaço não existe (22023 = 400, não 500).
create or replace function public.interditar_espaco(p_espaco_id text, p_ativo boolean, p_motivo text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  p public.profiles%rowtype;
  s public.spaces%rowtype;
  v_motivo text;
  v_acao text;
begin
  if auth.uid() is null then raise exception 'sem_permissao' using errcode = '42501'; end if;
  select * into p from public.profiles where id = auth.uid() and desativado_em is null;
  if not found or p.role not in ('SINDICO', 'SUBSINDICO', 'ADM', 'ZELADOR') then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  if p_ativo is null or p_espaco_id is null then raise exception 'dados_invalidos' using errcode = 'P0001'; end if;

  select * into s from public.spaces where id = p_espaco_id for update;
  if not found then raise exception 'espaco_nao_encontrado' using errcode = '22023'; end if;

  if p_ativo then
    v_motivo := null;
  else
    v_motivo := nullif(btrim(regexp_replace(regexp_replace(public.limpar_texto_livre(p_motivo), '[[:cntrl:]]', ' ', 'g'), ' {2,}', ' ', 'g')), '');
    if v_motivo is not null and char_length(v_motivo) > 140 then raise exception 'motivo_muito_longo' using errcode = 'P0001'; end if;
  end if;

  if s.ativo = p_ativo and s.motivo_interdicao is not distinct from v_motivo then
    return jsonb_build_object('ok', true, 'alterado', false, 'ativo', s.ativo, 'motivo', s.motivo_interdicao);
  end if;
  v_acao := case when p_ativo then 'Reabriu o espaço ' || s.nome when s.ativo then 'Interditou o espaço ' || s.nome
                 else 'Alterou o motivo da interdição do espaço ' || s.nome end;
  update public.spaces set ativo = p_ativo, motivo_interdicao = v_motivo where id = s.id;
  insert into public.audit_logs (usuario_id, usuario_nome, usuario_role, acao, modulo, detalhes)
  values (p.id, p.name, p.role, v_acao, 'RESERVAS',
          jsonb_build_object('espacoId', s.id, 'espaco', s.nome, 'ativo', p_ativo, 'ativoAntes', s.ativo, 'motivo', v_motivo));
  return jsonb_build_object('ok', true, 'alterado', true, 'ativo', p_ativo, 'motivo', v_motivo);
end $$;

-- ──────────────────────────────────────────────
-- 5) Reservas: parecer íntegro, reserva encerrada não reabre, decisão auditada e avisada pelo banco
-- ──────────────────────────────────────────────
create or replace function public.reservations_zelador_so_decide()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_role text; v_nome text;
begin
  if auth.uid() is null then return new; end if;

  -- Reserva recusada ou cancelada é registro encerrado: ninguém a reabre (por API também). Pedido novo, se for o caso.
  if new.status is distinct from old.status and old.status in ('CANCELADA', 'RECUSADA') then
    raise exception 'reserva_encerrada' using errcode = 'P0001';
  end if;

  v_role := public.get_user_role();
  if v_role is distinct from 'ZELADOR' then return new; end if;

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

  if new.motivo_recusa is not null then
    new.motivo_recusa := nullif(btrim(public.limpar_texto_livre(new.motivo_recusa)), '');
    if new.motivo_recusa is not null and char_length(new.motivo_recusa) > 300 then
      raise exception 'motivo_muito_longo' using errcode = 'P0001';
    end if;
  end if;

  -- Quem decidiu e quando vêm do banco, nunca do que o navegador mandou.
  if new.status is distinct from old.status then
    select name into v_nome from public.profiles where id = auth.uid();
    new.avaliado_por := coalesce(v_nome, 'Zelador') || ' (Zelador)';
    new.data_avaliacao := now();
  else
    new.avaliado_por := old.avaliado_por;
    new.data_avaliacao := old.data_avaliacao;
  end if;
  return new;
end $$;

create or replace function public.reservations_registrar_decisao()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  p public.profiles%rowtype;
  v_acao text;
  v_titulo text;
  v_msg text;
  v_dia text := to_char(new.data, 'DD/MM/YYYY');
  v_unit text;
begin
  if auth.uid() is null or new.status = old.status or new.status not in ('APROVADA', 'RECUSADA', 'CANCELADA') then
    return new;
  end if;
  select * into p from public.profiles where id = auth.uid() and desativado_em is null;
  if not found then return new; end if;

  v_acao := case new.status when 'APROVADA' then 'Aprovou reserva de ' when 'RECUSADA' then 'Recusou reserva de ' else 'Cancelou reserva de ' end || new.espaco_nome;
  insert into public.audit_logs (usuario_id, usuario_nome, usuario_role, acao, modulo, detalhes)
  values (p.id, p.name, p.role, v_acao, 'RESERVAS',
    case when new.status = 'CANCELADA'
      then jsonb_build_object('reservationId', new.id, 'espaco', new.espaco_nome, 'unidade', new.unidade, 'statusAnterior', old.status, 'motivo', new.motivo_recusa)
      else jsonb_build_object('reservationId', new.id, 'espaco', new.espaco_nome, 'unidade', new.unidade, 'aprovado', new.status = 'APROVADA', 'motivoRecusa', new.motivo_recusa)
    end);

  -- Aviso ao morador da unidade (o mesmo texto de sempre), gerado aqui para a decisão por API também avisar.
  select u.id into v_unit from public.units u
   where u.bloco = new.bloco and lower(btrim(u.numero)) = lower(btrim(new.unidade)) limit 1;
  if new.status = 'APROVADA' then
    v_titulo := 'Reserva Aprovada!';
    v_msg := 'Sua reserva do ' || new.espaco_nome || ' para ' || v_dia || ' foi confirmada!';
  elsif new.status = 'RECUSADA' then
    v_titulo := 'Reserva Não Aprovada';
    v_msg := 'Sua solicitação para ' || v_dia || ' foi recusada: ' || coalesce(new.motivo_recusa, 'Incompatibilidade com o regimento.');
  else
    v_titulo := 'Reserva Cancelada';
    v_msg := 'Sua reserva do ' || new.espaco_nome || ' para ' || v_dia || ' foi cancelada' || coalesce(': ' || new.motivo_recusa, '.');
  end if;
  insert into public.notifications (titulo, mensagem, tipo, unidade_alvo, unidade_id_alvo, link_destino)
  values (v_titulo, v_msg, 'RESERVA', new.unidade, v_unit, '/reservas');
  return new;
end $$;

drop trigger if exists reservations_30_registrar_decisao on public.reservations;
create trigger reservations_30_registrar_decisao
  after update of status on public.reservations
  for each row execute function public.reservations_registrar_decisao();

-- ──────────────────────────────────────────────
-- 6) Avisos do Zelador: limites, só os próprios, sino por gatilho
-- ──────────────────────────────────────────────
alter table public.notices add column if not exists autor_id uuid;

create or replace function public.notices_preparar()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' then
    new.autor_id := auth.uid();
  else
    new.autor_id := old.autor_id;
  end if;
  if public.get_user_role() = 'ZELADOR' then
    new.titulo := btrim(public.limpar_texto_livre(new.titulo));
    new.conteudo := btrim(public.limpar_texto_livre(new.conteudo));
  end if;
  return new;
end $$;
drop trigger if exists notices_00_preparar on public.notices;
create trigger notices_00_preparar before insert or update on public.notices
  for each row execute function public.notices_preparar();

create or replace function public.notices_avisar_zelador()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and public.get_user_role() = 'ZELADOR' then
    insert into public.notifications (titulo, mensagem, tipo, link_destino)
    values ('Novo comunicado: ' || left(new.titulo, 60),
            new.titulo || ' (' || case new.categoria when 'MANUTENCAO' then 'Manutenção' else 'Comunicado' end || ')',
            'AVISO', '/mural');
  end if;
  return new;
end $$;
drop trigger if exists notices_20_avisar_zelador on public.notices;
create trigger notices_20_avisar_zelador after insert on public.notices
  for each row execute function public.notices_avisar_zelador();

drop policy if exists notices_insert_zelador on public.notices;
create policy notices_insert_zelador on public.notices for insert with check (
  public.get_user_role() = 'ZELADOR'
  and categoria in ('COMUNICADO', 'MANUTENCAO')
  and anexo_url is null and anexo_nome is null
  and coalesce(fixado, false) = false
  and char_length(btrim(titulo)) between 1 and 120
  and char_length(btrim(conteudo)) between 1 and 2000
  and autor = (select p.name from public.profiles p where p.id = auth.uid())
);
drop policy if exists notices_update_zelador on public.notices;
create policy notices_update_zelador on public.notices for update
  using (public.get_user_role() = 'ZELADOR' and autor_id = auth.uid())
  with check (
    public.get_user_role() = 'ZELADOR' and autor_id = auth.uid()
    and categoria in ('COMUNICADO', 'MANUTENCAO')
    and anexo_url is null and anexo_nome is null
    and coalesce(fixado, false) = false
    and char_length(btrim(titulo)) between 1 and 120
    and char_length(btrim(conteudo)) between 1 and 2000
    and autor = (select p.name from public.profiles p where p.id = auth.uid())
  );
drop policy if exists notices_delete_zelador on public.notices;
create policy notices_delete_zelador on public.notices for delete
  using (public.get_user_role() = 'ZELADOR' and autor_id = auth.uid());

-- Notificação: o Zelador não escreve mais nenhum aviso (o sino do mural e o da decisão da reserva saem dos gatilhos acima).
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
  )
);

-- ──────────────────────────────────────────────
-- 7) Unidades para o Zelador: só o que a operação precisa
-- ──────────────────────────────────────────────
-- Nome, telefone, e-mail e vínculo (titular, inquilino, dependente) de quem mora, mais bloco e número. Sem proprietário que
-- não mora, observações, animais, vagas, conta vinculada nem status de convite. Sem documento (nunca esteve em units).
create or replace function public.unidades_para_zelador()
returns table (id text, bloco text, numero text, moradores jsonb)
language sql stable security definer set search_path = public as $$
  select u.id, u.bloco, u.numero,
    case when jsonb_typeof(u.moradores) = 'array' then coalesce((
      select jsonb_agg(jsonb_build_object('id', m->>'id', 'nome', m->>'nome', 'tipo', m->>'tipo', 'telefone', m->>'telefone', 'email', m->>'email') order by t.ord)
      from jsonb_array_elements(u.moradores) with ordinality as t(m, ord)
      where jsonb_typeof(m) = 'object'
    ), '[]'::jsonb) else '[]'::jsonb end
  from public.units u
  where public.get_user_role() = 'ZELADOR'
  order by u.bloco, u.numero;
$$;
revoke all on function public.unidades_para_zelador() from public, anon;
grant execute on function public.unidades_para_zelador() to authenticated, service_role;

drop policy if exists units_read on public.units;
create policy units_read on public.units for select using (
  public.get_user_role() in ('SINDICO', 'SUBSINDICO', 'ADM', 'PORTARIA', 'CONSELHO')
  or usuario_id = auth.uid()
);

-- ──────────────────────────────────────────────
-- 8) Quem executa
-- ──────────────────────────────────────────────
revoke all on function public.iniciar_transferencia_cargo(uuid, text, uuid, uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.reativar_acesso_zelador(uuid, uuid) from public, anon, authenticated;
revoke all on function public.ativar_convite_zelador(uuid) from public, anon, authenticated;
revoke all on function public.cargo_efetivo(uuid) from public, anon, authenticated;
revoke all on function public.conta_com_cargo_pendente(uuid) from public, anon, authenticated;
revoke all on function public.pode_agir_sobre_conta(text, uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.cargo_efetivo(uuid) to service_role;
grant execute on function public.conta_com_cargo_pendente(uuid) to service_role;
grant execute on function public.pode_agir_sobre_conta(text, uuid, text, boolean) to service_role;
grant execute on function public.iniciar_transferencia_cargo(uuid, text, uuid, uuid, text, text, text, text) to service_role;
grant execute on function public.reativar_acesso_zelador(uuid, uuid) to service_role;
grant execute on function public.ativar_convite_zelador(uuid) to service_role;
