-- Transferir cargo (issue #53, PRD docs/specs/2026-10-04-transferir-cargo.md).
--
-- ADM e Síndico passam Síndico, Subsíndico, Conselho ou Portaria de uma pessoa para outra, para uma
-- conta que já existe ou para uma pessoa nova (convite que só vale quando ela aceitar).
--
-- Regra de ouro: `profiles` é só leitura para o navegador (0027). A mudança de perfil acontece
-- SOMENTE nestas funções, que são SECURITY DEFINER e só o service role executa (a rota de servidor
-- chama). Cada uma revalida quem executa DENTRO da própria função, lendo `profiles` na hora.
--
-- Idempotente e aditiva: tabela e colunas com IF NOT EXISTS, funções com CREATE OR REPLACE,
-- policies recriadas.

-- ──────────────────────────────────────────────
-- 1) Registro das transferências (histórico + pendências)
-- ──────────────────────────────────────────────
create table if not exists public.cargo_transferencias (
  id uuid primary key default gen_random_uuid(),
  cargo text not null check (cargo in ('SINDICO', 'SUBSINDICO', 'CONSELHO', 'PORTARIA')),
  origem_id uuid references auth.users(id) on delete set null,
  origem_nome text not null,
  destino_id uuid references auth.users(id) on delete set null,
  destino_nome text not null,
  destino_tipo text not null check (destino_tipo in ('EXISTENTE', 'NOVO')),
  status text not null check (status in ('PENDENTE', 'CONCLUIDA', 'CANCELADA', 'FALHOU')),
  executor_id uuid references auth.users(id) on delete set null,
  executor_nome text not null,
  executor_role text not null,
  invite_id uuid references public.pending_invites(id) on delete set null,
  motivo_falha text,
  criado_em timestamptz not null default now(),
  concluido_em timestamptz
);

-- No máximo uma pendência por cargo único; para Conselho/Portaria, uma por pessoa que sai e uma por quem entra.
create unique index if not exists cargo_transf_pendente_cargo_unico
  on public.cargo_transferencias (cargo)
  where status = 'PENDENTE' and cargo in ('SINDICO', 'SUBSINDICO');
create unique index if not exists cargo_transf_pendente_origem
  on public.cargo_transferencias (origem_id) where status = 'PENDENTE';
create unique index if not exists cargo_transf_pendente_destino
  on public.cargo_transferencias (destino_id) where status = 'PENDENTE';

alter table public.pending_invites add column if not exists transferencia_id uuid;

alter table public.cargo_transferencias enable row level security;

-- Só leitura, e só para a equipe e para as duas pessoas envolvidas (faixa do Início). Ninguém grava pelo navegador.
drop policy if exists cargo_transferencias_select on public.cargo_transferencias;
create policy cargo_transferencias_select on public.cargo_transferencias for select
  using (public.is_admin() or origem_id = auth.uid() or destino_id = auth.uid());

revoke all on public.cargo_transferencias from anon, authenticated;
grant select on public.cargo_transferencias to authenticated;
grant all on public.cargo_transferencias to service_role;

-- ──────────────────────────────────────────────
-- 2) Aviso por usuário (o sino só sabia de unidade e de perfil)
-- ──────────────────────────────────────────────
alter table public.notifications add column if not exists usuario_id_alvo uuid;

-- Aviso com `usuario_id_alvo` só aparece para essa pessoa (nem para a equipe, nem para outro morador).
-- Sem alvo de usuário, vale a regra de antes.
-- (a 0028 apagou o auxiliar de remoção de policies: faz inline, inclusive as de nome livre)
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'notifications' and cmd = 'SELECT'
  loop
    execute format('drop policy if exists %I on public.notifications', p.policyname);
  end loop;
end $$;
create policy "notifications_read" on public.notifications for select
  using (
    (usuario_id_alvo is not null and usuario_id_alvo = auth.uid() and public.tem_perfil())
    or (
      usuario_id_alvo is null
      and (
        public.is_admin()
        or (
          public.tem_perfil()
          and (perfil_alvo is null or perfil_alvo = public.get_user_role())
          and (
            (unidade_id_alvo is null and unidade_alvo is null)
            or exists (
              select 1 from public.units u
              where u.id = notifications.unidade_id_alvo and u.usuario_id = auth.uid()
            )
          )
        )
      )
    )
  );

-- O cliente (mesmo a equipe) não cria aviso para um usuário específico: isso é só das funções abaixo.
-- Reescreve a policy de INSERT acrescentando `usuario_id_alvo is null`, sem mudar o resto.
do $$
declare v_check text;
begin
  select pg_get_expr(p.polwithcheck, p.polrelid) into v_check
  from pg_policy p
  where p.polrelid = 'public.notifications'::regclass and p.polcmd = 'a' and p.polname = 'notifications_insert';
  if v_check is not null and v_check not like '%usuario_id_alvo%' then
    execute 'drop policy notifications_insert on public.notifications';
    execute format('create policy notifications_insert on public.notifications for insert with check ((%s) and usuario_id_alvo is null)', v_check);
  end if;
end $$;

-- ──────────────────────────────────────────────
-- 3) Funções internas
-- ──────────────────────────────────────────────
create or replace function public._cargo_rotulo(p_cargo text)
returns text language sql immutable set search_path = public as $$
  select case p_cargo
    when 'SINDICO' then 'Síndico'
    when 'SUBSINDICO' then 'Subsíndico'
    when 'CONSELHO' then 'Conselho'
    when 'PORTARIA' then 'Portaria'
    when 'MORADOR' then 'Morador'
    else p_cargo
  end;
$$;

-- Troca os perfis. Quem chama JÁ travou (FOR UPDATE) as contas e JÁ validou tudo.
-- Os índices únicos de Síndico e Subsíndico são conferidos linha a linha, então a ordem dos UPDATEs
-- importa: quem sai libera a vaga antes de quem entra ocupá-la. Nunca existe estado com dois titulares
-- (e, como é uma transação, ninguém enxerga o meio).
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
    'origemProvisorio', (v_origem_novo = 'MORADOR' and not v_tem_unidade)
  );
end $$;

-- Aviso no sino de uma pessoa só.
create or replace function public._avisar_usuario(p_usuario uuid, p_titulo text, p_mensagem text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.notifications (titulo, mensagem, tipo, usuario_id_alvo, link_destino)
  values (p_titulo, p_mensagem, 'GERAL', p_usuario, '/');
$$;

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
    else 'buscar placas e registrar pedidos de reserva'
  end;
  v_acesso := public._cargo_rotulo(p_res->>'origemNovoPerfil');

  perform public._avisar_usuario(
    p_destino,
    'Você agora é ' || v_rotulo,
    p_origem_nome || ' passou o cargo de ' || v_rotulo || ' para você. Você já pode ' || v_poderes || '.'
  );
  perform public._avisar_usuario(
    p_origem,
    'Você passou o cargo de ' || v_rotulo,
    'O cargo agora é de ' || p_destino_nome || '. Seu acesso é de ' || v_acesso || '.'
  );
end $$;

-- ──────────────────────────────────────────────
-- 4) Transferir para uma conta que já existe (imediato)
-- ──────────────────────────────────────────────
-- Devolve {ok:true,...} ou {ok:false, codigo:...}. Recusas não gravam nada. Falha inesperada
-- levanta exceção e desfaz tudo. `p_simular_falha_apos` é gancho de TESTE (bateria): só o service
-- role chama a função, então não abre nada que ele já não pudesse fazer.
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

  -- Contas travadas em ordem fixa (id): duas transferências ao mesmo tempo esperam uma pela outra
  -- sem impasse, e a segunda enxerga o resultado da primeira.
  perform 1 from public.profiles where id in (p_executor, p_origem, p_destino) order by id for update;

  select * into e from public.profiles where id = p_executor;
  if not found or e.role not in ('ADM', 'SINDICO') or e.cadastro_validado is not true then
    return jsonb_build_object('ok', false, 'codigo', 'sem_permissao');
  end if;
  -- Síndico só passa o PRÓPRIO cargo; o dos outros quatro cargos ele transfere livremente.
  if e.role = 'SINDICO' and p_cargo = 'SINDICO' and p_origem <> e.id then
    return jsonb_build_object('ok', false, 'codigo', 'sem_permissao');
  end if;

  select * into o from public.profiles where id = p_origem;
  if not found or o.role <> p_cargo then
    return jsonb_build_object('ok', false, 'codigo', 'origem_desatualizada',
      'titularAtual', (select name from public.profiles where role = p_cargo order by name limit 1));
  end if;

  select * into d from public.profiles where id = p_destino;
  if not found
     or d.id = o.id or d.id = e.id
     or d.role not in ('MORADOR', 'SUBSINDICO', 'CONSELHO', 'PORTARIA')
     or d.cadastro_validado is not true
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

    -- Histórico na MESMA transação (o navegador pode inserir em audit_logs, então não confiamos nele).
    -- Sem e-mail nem telefone: só os nomes que a trilha já mostra e ids em `detalhes`.
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
    -- Cinto e suspensório: as travas acima já impedem, mas o banco é a última palavra.
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

-- ──────────────────────────────────────────────
-- 5) Transferir para uma pessoa nova (pendente até ela aceitar)
-- ──────────────────────────────────────────────
-- A rota já criou a conta no Auth e o link de acesso (p_destino_id, p_link). Aqui nasce o perfil SEM poder
-- (Morador provisório e sem unidade), o convite na fila e a pendência. O titular continua até o aceite.
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
  if p_cargo is null or p_cargo not in ('SINDICO', 'SUBSINDICO', 'CONSELHO', 'PORTARIA') then
    return jsonb_build_object('ok', false, 'codigo', 'cargo_invalido');
  end if;
  if p_executor is null or p_origem is null or p_destino_id is null
     or v_nome = '' or length(v_nome) > 120
     or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or length(v_email) > 200 then
    return jsonb_build_object('ok', false, 'codigo', 'dados_invalidos');
  end if;

  perform 1 from public.profiles where id in (p_executor, p_origem) order by id for update;

  select * into e from public.profiles where id = p_executor;
  if not found or e.role not in ('ADM', 'SINDICO') or e.cadastro_validado is not true then
    return jsonb_build_object('ok', false, 'codigo', 'sem_permissao');
  end if;
  if e.role = 'SINDICO' and p_cargo = 'SINDICO' and p_origem <> e.id then
    return jsonb_build_object('ok', false, 'codigo', 'sem_permissao');
  end if;

  select * into o from public.profiles where id = p_origem;
  if not found or o.role <> p_cargo then
    return jsonb_build_object('ok', false, 'codigo', 'origem_desatualizada',
      'titularAtual', (select name from public.profiles where role = p_cargo order by name limit 1));
  end if;

  -- E-mail que já tem conta não vira convite: a pessoa é escolhida em "Usuário já cadastrado".
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
    and ((p_cargo in ('SINDICO', 'SUBSINDICO') and t.cargo = p_cargo) or t.origem_id = p_origem)
  limit 1;
  if found then
    return jsonb_build_object('ok', false, 'codigo', 'pendencia_existente',
      'transferenciaId', v_pend.id, 'destinoNome', v_pend.destino_nome);
  end if;

  begin
    insert into public.profiles (id, name, email, role, telefone, cadastro_validado)
    values (p_destino_id, v_nome, v_email, 'MORADOR', nullif(btrim(coalesce(p_telefone, '')), ''), false);

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

-- ──────────────────────────────────────────────
-- 6) Cancelar uma pendência
-- ──────────────────────────────────────────────
-- Devolve o id da conta provisória criada para o convite, para a rota apagá-la também no Auth.
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
  if not found or e.role not in ('ADM', 'SINDICO') or e.cadastro_validado is not true then
    return jsonb_build_object('ok', false, 'codigo', 'sem_permissao');
  end if;

  select * into t from public.cargo_transferencias where id = p_transferencia for update;
  if not found or t.status <> 'PENDENTE' then
    return jsonb_build_object('ok', false, 'codigo', 'nao_pendente');
  end if;
  -- Síndico só mexe na pendência do que ele mesmo pode transferir (o próprio cargo de Síndico, ou os demais).
  if e.role = 'SINDICO' and t.cargo = 'SINDICO' and t.origem_id is distinct from e.id then
    return jsonb_build_object('ok', false, 'codigo', 'sem_permissao');
  end if;

  update public.cargo_transferencias
     set status = 'CANCELADA', concluido_em = now(), invite_id = null
   where id = t.id;
  delete from public.pending_invites where transferencia_id = t.id;

  -- A conta provisória só existia por causa do convite: sem poder, sem unidade, sem autocadastro.
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

-- ──────────────────────────────────────────────
-- 7) Aceite do convite (a pessoa nova definiu a senha)
-- ──────────────────────────────────────────────
-- A rota passa o id da sessão de quem acabou de definir a senha. Sem pendência: não faz nada (ok, aplicada=false).
-- Confere de novo, na hora, que a origem ainda é a titular; se não for, a solicitação falha e avisa quem pediu.
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
    when o.id is null or o.role <> t.cargo then 'quem ocupava o cargo mudou desde o pedido'
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

    -- Quem agiu foi a própria pessoa que aceitou; quem pediu fica em `executorId`.
    insert into public.audit_logs (usuario_id, usuario_nome, usuario_role, acao, modulo, detalhes)
    values (
      d.id, d.name, t.cargo,
      'Aceitou o convite e assumiu o cargo de ' || public._cargo_rotulo(t.cargo) || ', passado por ' || o.name,
      'SISTEMA',
      jsonb_build_object(
        'transferenciaId', t.id, 'cargo', t.cargo, 'resultado', 'CONCLUIDA', 'tipoDestino', 'NOVO',
        'origemId', o.id, 'destinoId', d.id, 'executorId', t.executor_id,
        'origemCargoAnterior', o.role, 'origemCargoNovo', v_res->>'origemNovoPerfil',
        'destinoCargoAnterior', 'MORADOR', 'destinoCargoNovo', t.cargo,
        'origemProvisorio', (v_res->>'origemProvisorio')::boolean
      )
    );
    perform public._avisos_da_troca(t.cargo, o.name, d.name, o.id, d.id, v_res);
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'codigo', 'conflito');
  end;

  return jsonb_build_object('ok', true, 'aplicada', true, 'cargo', t.cargo,
    'origemNome', o.name, 'destinoNome', d.name, 'transferenciaId', t.id);
end $$;

-- ──────────────────────────────────────────────
-- 8) Quem pode executar: SÓ o service role (a rota de servidor)
-- ──────────────────────────────────────────────
revoke all on function public._cargo_rotulo(text) from public, anon, authenticated;
revoke all on function public._trocar_cargo(text, uuid, uuid) from public, anon, authenticated;
revoke all on function public._avisar_usuario(uuid, text, text) from public, anon, authenticated;
revoke all on function public._avisos_da_troca(text, text, text, uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.transferir_cargo(uuid, text, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.iniciar_transferencia_cargo(uuid, text, uuid, uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.cancelar_transferencia_cargo(uuid, uuid) from public, anon, authenticated;
revoke all on function public.aceitar_transferencia_cargo(uuid) from public, anon, authenticated;

grant execute on function public.transferir_cargo(uuid, text, uuid, uuid, text) to service_role;
grant execute on function public.iniciar_transferencia_cargo(uuid, text, uuid, uuid, text, text, text, text) to service_role;
grant execute on function public.cancelar_transferencia_cargo(uuid, uuid) to service_role;
grant execute on function public.aceitar_transferencia_cargo(uuid) to service_role;
