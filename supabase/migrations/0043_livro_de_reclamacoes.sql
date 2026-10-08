-- Harmony — Livro de reclamações (fórum aberto entre moradores e gestão), primeira versão.
-- Spec: docs/specs/2026-10-07-livro-de-reclamacoes-v2.md (decisões D1 a D6 e as duas respostas do dono adotadas).
--
-- Regras que o BANCO garante (a tela só espelha):
--  * Interruptor próprio (livro_config.modo): DESLIGADO (padrão), EQUIPE ou ABERTO. Nasce DESLIGADO em todo ambiente.
--  * Ler: conta ativa, validada, perfil na lista explícita. NUNCA tem_perfil_operacao() (inclui o Zelador por outro motivo)
--    nem is_admin() (inclui o Subsíndico): cada regra abaixo usa lista de perfis escrita à mão.
--  * Escrever: só Síndico, Subsíndico, Conselho e Morador, e só por livro_publicar (SECURITY DEFINER). Nenhum INSERT,
--    UPDATE ou DELETE direto para anon nem authenticated em nenhuma tabela do livro.
--  * Apagar: remoção lógica (livro_remover). Só Síndico e ADM apagam de outros; o autor apaga a própria. O texto original
--    vai para livro_remocoes (imutável) por 90 dias e depois é apagado de verdade.
--  * Avisos no sino: só por gatilho, com texto fixo (sem trecho da mensagem e sem nome do autor).
--  * Auditoria (audit_logs) sem texto livre: só códigos.
--
-- LIBERAÇÃO PARA ABRIR (livro_config.liberado_para_abrir): esta migração NÃO libera (default false, e nenhum papel do navegador
-- tem UPDATE). O modo ABERTO só passa a valer quando alguém com acesso ao banco (migração futura ou service role) marcar a
-- coluna como true, e isso depende de: aviso de privacidade (#55) aprovado e publicado, conversa com o advogado (spec 7.9),
-- regras de uso revisadas, correções B-1/B-2/B-4 aceitas ou feitas, e pelo menos 1 semana em EQUIPE com o Conselho lendo o
-- registro (revisão de segurança de 2026-10-07). EQUIPE e DESLIGADO não dependem dela.
--
-- Aditiva e idempotente (IF NOT EXISTS, CREATE OR REPLACE, policies, gatilhos e grants refeitos).

-- ──────────────────────────────────────────────
-- 1) Tabelas
-- ──────────────────────────────────────────────

-- Uma linha só. Quem muda é livro_definir_modo (Síndico e ADM). Sem nenhum acesso direto do navegador.
create table if not exists public.livro_config (
  id integer primary key default 1,
  modo text not null default 'DESLIGADO' check (modo in ('DESLIGADO', 'EQUIPE', 'ABERTO')),
  regras_versao integer not null default 1,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users(id) on delete set null,
  constraint livro_config_singleton check (id = 1)
);
alter table public.livro_config add column if not exists liberado_para_abrir boolean not null default false;
insert into public.livro_config (id, modo) values (1, 'DESLIGADO') on conflict (id) do nothing;

-- Sal para os códigos opacos de "citáveis": o morador nunca recebe o id interno de unidade nem de conta.
create table if not exists public.livro_segredo (
  id integer primary key default 1,
  valor text not null default gen_random_uuid()::text,
  constraint livro_segredo_singleton check (id = 1)
);
insert into public.livro_segredo (id) values (1) on conflict (id) do nothing;

create table if not exists public.livro_mensagens (
  id uuid primary key default gen_random_uuid(),
  -- Nulo = tópico. Resposta aponta para o TÓPICO (resposta a resposta não existe: o gatilho recusa).
  pai_id uuid references public.livro_mensagens(id) on delete cascade,
  -- Vira nulo quando a conta é excluída (e o gatilho anonimiza nome e unidade).
  autor_id uuid references auth.users(id) on delete set null,
  -- Fotografia do momento da mensagem: o morador não lê profiles nem units dos outros.
  autor_nome text not null,
  autor_unidade text,
  autor_papel text not null check (autor_papel in ('SINDICO', 'SUBSINDICO', 'CONSELHO', 'MORADOR', 'EX_MORADOR')),
  texto text not null default '',
  criada_em timestamptz not null default now(),
  ultima_atividade_em timestamptz not null default now(),
  n_respostas integer not null default 0,
  removida_em timestamptz,
  removida_por text check (removida_por in ('GESTAO', 'AUTOR')),
  constraint livro_mensagens_texto_tam check (
    char_length(texto) <= 1000
    and (
      removida_em is not null
      or (pai_id is null and char_length(texto) between 10 and 1000)
      or (pai_id is not null and char_length(texto) between 1 and 500)
    )
  ),
  constraint livro_mensagens_removida_coerente check ((removida_em is null) = (removida_por is null))
);
create index if not exists livro_mensagens_topicos on public.livro_mensagens (ultima_atividade_em desc, id desc) where pai_id is null;
create index if not exists livro_mensagens_respostas on public.livro_mensagens (pai_id, criada_em, id) where pai_id is not null;
create index if not exists livro_mensagens_autor on public.livro_mensagens (autor_id, criada_em);

create table if not exists public.livro_citacoes (
  id uuid primary key default gen_random_uuid(),
  mensagem_id uuid not null references public.livro_mensagens(id) on delete cascade,
  tipo text not null check (tipo in ('UNIDADE', 'PESSOA')),
  -- Quem recebe o aviso: a conta ligada à unidade, ou a pessoa citada. Interno: o navegador não lê estas colunas.
  alvo_usuario_id uuid references auth.users(id) on delete set null,
  alvo_unit_id text,
  -- Fotografia mostrada na tela ("Unidade A-101", "Síndico Fulana").
  rotulo text not null
);
create unique index if not exists livro_citacoes_unica
  on public.livro_citacoes (mensagem_id, tipo, coalesce(alvo_unit_id, alvo_usuario_id::text));

create table if not exists public.livro_remocoes (
  id uuid primary key default gen_random_uuid(),
  mensagem_id uuid not null unique references public.livro_mensagens(id) on delete cascade,
  removido_por_id uuid references auth.users(id) on delete set null,
  removido_por_nome text not null,
  removido_por_papel text not null,
  removida_em timestamptz not null default now(),
  -- Lista fechada, sem texto livre. AUTOR = o próprio autor apagou.
  motivo text not null check (motivo in ('OFENSA', 'DADO_PESSOAL', 'FORA_DO_ASSUNTO', 'REPETIDA', 'OUTRO', 'AUTOR')),
  tipo text not null check (tipo in ('TOPICO', 'RESPOSTA')),
  autor_id uuid references auth.users(id) on delete set null,
  autor_nome text not null,
  autor_unidade text,
  -- Marcadores de conflito de interesse, calculados pelo banco sem ler o texto.
  autor_era_quem_removeu boolean not null default false,
  citava_quem_removeu boolean not null default false,
  texto_original text,
  texto_expira_em timestamptz not null
);

create index if not exists livro_remocoes_expira on public.livro_remocoes (texto_expira_em) where texto_original is not null;

create table if not exists public.livro_sinalizacoes (
  mensagem_id uuid not null references public.livro_mensagens(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  criada_em timestamptz not null default now(),
  primary key (mensagem_id, usuario_id)
);

create table if not exists public.livro_ciencia (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  versao integer not null,
  em timestamptz not null default now()
);

alter table public.livro_config enable row level security;
alter table public.livro_segredo enable row level security;
alter table public.livro_mensagens enable row level security;
alter table public.livro_citacoes enable row level security;
alter table public.livro_remocoes enable row level security;
alter table public.livro_sinalizacoes enable row level security;
alter table public.livro_ciencia enable row level security;

-- Texto livre sem caracteres invisíveis nem de direção (ampliada: marca árabe U+061C, hífen suave U+00AD, word joiner e
-- operadores invisíveis U+2060 a U+2064, tags U+E0000 a U+E007F, preenchimentos de Hangul e Khmer, seletores mongóis,
-- controles C0/C1 exceto tab e quebra de linha). Substitui a de 0042 (mesma assinatura): superconjunto do que ela removia.
create or replace function public.limpar_texto_livre(t text)
returns text language sql immutable set search_path = public as $$
  select regexp_replace(coalesce(t, ''),
    '[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180B-\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\u206A-\u206F\u3164\uFEFF\uFFA0\uFFF9-\uFFFB\U000E0000-\U000E007F]',
    '', 'g');
$$;

-- ──────────────────────────────────────────────
-- 2) Quem pode o quê (funções de apoio; listas explícitas de perfil)
-- ──────────────────────────────────────────────

-- Perfil de quem chama SE ele pode ler o livro agora: conta ativa, validada, perfil da lista e modo que o admite.
-- DESLIGADO: ninguém. EQUIPE: Síndico, Subsíndico, ADM e Conselho. ABERTO: todos os perfis da lista.
create or replace function public.livro_papel()
returns text language sql stable security definer set search_path = public as $$
  select p.role
  from public.profiles p
  join public.livro_config c on c.id = 1
  where p.id = auth.uid()
    and p.desativado_em is null
    and p.cadastro_validado = true
    and p.role in ('SINDICO', 'SUBSINDICO', 'ADM', 'CONSELHO', 'MORADOR', 'ZELADOR', 'PORTARIA')
    and (
      c.modo = 'ABERTO'
      or (c.modo = 'EQUIPE' and p.role in ('SINDICO', 'SUBSINDICO', 'ADM', 'CONSELHO'))
    );
$$;

create or replace function public.livro_pode_ler()
returns boolean language sql stable security definer set search_path = public as $$
  select public.livro_papel() is not null;
$$;

-- Escrever: só quatro perfis (Zelador, Portaria e ADM só leem). NÃO usa tem_perfil_operacao() nem is_admin().
create or replace function public.livro_papel_escrita()
returns text language sql stable security definer set search_path = public as $$
  select p from (select public.livro_papel() as p) x where x.p in ('SINDICO', 'SUBSINDICO', 'CONSELHO', 'MORADOR');
$$;

create or replace function public.livro_pode_ver_registro()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.livro_papel() in ('SINDICO', 'SUBSINDICO', 'ADM', 'CONSELHO'), false);
$$;

-- Aviso no sino de uma pessoa, com texto fixo. p_equiv: textos equivalentes; se já há um desses NÃO LIDO no mesmo link
-- para a pessoa, não cria outro (um aviso por pessoa por tópico enquanto não lido). p_papeis: só quem tem um desses perfis
-- (e conta ativa e validada) recebe: Zelador, Portaria e ADM nunca recebem aviso de citação.
create or replace function public._livro_avisar(p_usuario uuid, p_texto text, p_link text, p_equiv text[], p_papeis text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_usuario is null then return; end if;
  -- Só avisa quem PODERIA ler o livro no modo atual (em EQUIPE, morador não recebe aviso de um livro que ainda não abre).
  if not exists (
    select 1 from public.profiles p
    join public.livro_config c on c.id = 1
    where p.id = p_usuario and p.desativado_em is null and p.cadastro_validado = true and p.role = any (p_papeis)
      and (
        (c.modo = 'ABERTO' and p.role in ('SINDICO', 'SUBSINDICO', 'ADM', 'CONSELHO', 'MORADOR', 'ZELADOR', 'PORTARIA'))
        or (c.modo = 'EQUIPE' and p.role in ('SINDICO', 'SUBSINDICO', 'ADM', 'CONSELHO'))
      )
  ) then return; end if;
  if p_equiv is not null and exists (
    select 1 from public.notifications n
    where n.usuario_id_alvo = p_usuario and n.link_destino = p_link and n.mensagem = any (p_equiv)
      and not exists (select 1 from public.notification_reads r where r.notification_id = n.id and r.user_id = p_usuario)
  ) then return; end if;
  insert into public.notifications (titulo, mensagem, tipo, usuario_id_alvo, link_destino)
  values ('Livro de reclamações', p_texto, 'GERAL', p_usuario, p_link);
end $$;

-- Auditoria do livro: só códigos e ids, nunca o texto da mensagem.
create or replace function public._livro_auditar(p_acao text, p_detalhes jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare p public.profiles%rowtype;
begin
  select * into p from public.profiles where id = auth.uid();
  if not found then return; end if;
  insert into public.audit_logs (usuario_id, usuario_nome, usuario_role, acao, modulo, detalhes)
  values (p.id, p.name, p.role, p_acao, 'LIVRO', coalesce(p_detalhes, '{}'::jsonb));
end $$;

-- ──────────────────────────────────────────────
-- 3) Gatilhos de integridade e de aviso
-- ──────────────────────────────────────────────

-- Antes de gravar uma resposta: o pai precisa ser um tópico, não removido e com vaga (200 respostas no máximo).
-- Vale para qualquer caminho de escrita (inclusive o do service role).
create or replace function public.livro_msg_antes()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_pai public.livro_mensagens%rowtype;
begin
  if tg_op = 'INSERT' then
    if new.pai_id is not null then
      select * into v_pai from public.livro_mensagens where id = new.pai_id for update;
      if not found then raise exception 'topico_inexistente' using errcode = 'P0001'; end if;
      if v_pai.pai_id is not null then raise exception 'resposta_a_resposta' using errcode = 'P0001'; end if;
      if v_pai.removida_em is not null then raise exception 'topico_removido' using errcode = 'P0001'; end if;
      if v_pai.n_respostas >= 200 then raise exception 'topico_cheio' using errcode = 'P0001'; end if;
    end if;
    return new;
  end if;
  -- UPDATE: conta excluída (a FK zera autor_id) => a mensagem fica, anonimizada e sem unidade.
  if new.autor_id is null and old.autor_id is not null then
    new.autor_nome := 'Ex-morador';
    new.autor_unidade := null;
    new.autor_papel := 'EX_MORADOR';
  end if;
  return new;
end $$;
drop trigger if exists livro_msg_antes_ins on public.livro_mensagens;
create trigger livro_msg_antes_ins before insert on public.livro_mensagens
  for each row execute function public.livro_msg_antes();
drop trigger if exists livro_msg_antes_upd on public.livro_mensagens;
create trigger livro_msg_antes_upd before update on public.livro_mensagens
  for each row execute function public.livro_msg_antes();

-- Depois de uma resposta: o tópico sobe no feed e ganha a contagem.
create or replace function public.livro_msg_depois()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.pai_id is not null then
    update public.livro_mensagens
       set n_respostas = n_respostas + 1, ultima_atividade_em = new.criada_em
     where id = new.pai_id;
  end if;
  return new;
end $$;
drop trigger if exists livro_msg_depois_ins on public.livro_mensagens;
create trigger livro_msg_depois_ins after insert on public.livro_mensagens
  for each row execute function public.livro_msg_depois();

-- Avisos da mensagem nova. É um gatilho ADIADO (roda no fim da transação, depois das citações gravadas):
-- assim "resposta ao seu tópico" não repete para quem já foi citado na mesma mensagem.
create or replace function public.livro_msg_avisos()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_topico uuid := coalesce(new.pai_id, new.id);
  v_dono uuid;
  r record;
begin
  if new.pai_id is not null then
    select autor_id into v_dono from public.livro_mensagens where id = new.pai_id;
    if v_dono is not null and v_dono is distinct from new.autor_id
       and not exists (select 1 from public.livro_citacoes c where c.mensagem_id = new.id and c.alvo_usuario_id = v_dono) then
      perform public._livro_avisar(v_dono, 'Há novas respostas no seu tópico', '/livro/' || v_topico,
        array['Há novas respostas no seu tópico'], array['SINDICO', 'SUBSINDICO', 'CONSELHO', 'MORADOR']);
    end if;
  end if;
  -- Resumo à gestão: no máximo 1 por dia por pessoa (é o que traz Síndico e ADM ao livro, sem prazo de resposta).
  for r in select p.id from public.profiles p
           where p.role in ('SINDICO', 'ADM') and p.desativado_em is null and p.id is distinct from new.autor_id
           order by p.id
  loop
    -- Trava por pessoa: duas mensagens ao mesmo tempo não enxergam o aviso uma da outra sem ela (no máximo 1 por dia).
    perform pg_advisory_xact_lock(hashtextextended('livro-resumo:' || r.id::text, 43));
    if not exists (
      select 1 from public.notifications n
      where n.usuario_id_alvo = r.id and n.mensagem = 'Há novas mensagens no Livro' and n.created_at > now() - interval '1 day'
    ) then
      perform public._livro_avisar(r.id, 'Há novas mensagens no Livro', '/livro', null, array['SINDICO', 'ADM']);
    end if;
  end loop;
  return null;
end $$;
drop trigger if exists livro_msg_avisos_ins on public.livro_mensagens;
create constraint trigger livro_msg_avisos_ins after insert on public.livro_mensagens
  deferrable initially deferred for each row execute function public.livro_msg_avisos();

-- Citação: texto fixo, sem trecho e sem nome do autor. O autor nunca avisa a si mesmo.
create or replace function public.livro_cit_avisos()
returns trigger language plpgsql security definer set search_path = public as $$
declare m public.livro_mensagens%rowtype;
begin
  select * into m from public.livro_mensagens where id = new.mensagem_id;
  if new.alvo_usuario_id is null or new.alvo_usuario_id is not distinct from m.autor_id then return null; end if;
  perform public._livro_avisar(
    new.alvo_usuario_id,
    case new.tipo when 'UNIDADE' then 'Sua unidade foi citada no Livro' else 'Você foi citado no Livro' end,
    '/livro/' || coalesce(m.pai_id, m.id),
    array['Sua unidade foi citada no Livro', 'Você foi citado no Livro'],
    array['SINDICO', 'SUBSINDICO', 'CONSELHO', 'MORADOR']);
  return null;
end $$;
drop trigger if exists livro_cit_avisos_ins on public.livro_citacoes;
create trigger livro_cit_avisos_ins after insert on public.livro_citacoes
  for each row execute function public.livro_cit_avisos();

-- Remoção pela gestão: o autor é avisado (texto fixo). Quem apaga a própria não se avisa.
create or replace function public.livro_rem_avisos()
returns trigger language plpgsql security definer set search_path = public as $$
declare m public.livro_mensagens%rowtype;
begin
  select * into m from public.livro_mensagens where id = new.mensagem_id;
  if new.autor_id is not null and new.autor_id is distinct from new.removido_por_id then
    perform public._livro_avisar(new.autor_id, 'Sua mensagem foi removida pela gestão', '/livro/' || coalesce(m.pai_id, m.id),
      null, array['SINDICO', 'SUBSINDICO', 'CONSELHO', 'MORADOR']);
  end if;
  return null;
end $$;
drop trigger if exists livro_rem_avisos_ins on public.livro_remocoes;
create trigger livro_rem_avisos_ins after insert on public.livro_remocoes
  for each row execute function public.livro_rem_avisos();

-- "Avisar a gestão": UM aviso agregado ("Há mensagens sinalizadas...") para Síndico e ADM enquanto houver um não lido, sem texto da
-- mensagem nem de quem sinalizou. A trava por destinatário evita aviso duplicado sob concorrência.
create or replace function public.livro_sin_avisos()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select p.id from public.profiles p where p.role in ('SINDICO', 'ADM') and p.desativado_em is null order by p.id
  loop
    perform pg_advisory_xact_lock(hashtextextended('livro-sinaliza:' || r.id::text, 43));
    perform public._livro_avisar(r.id, 'Há mensagens sinalizadas à gestão no Livro', '/livro',
      array['Há mensagens sinalizadas à gestão no Livro'], array['SINDICO', 'ADM']);
  end loop;
  return null;
end $$;
drop trigger if exists livro_sin_avisos_ins on public.livro_sinalizacoes;
create trigger livro_sin_avisos_ins after insert on public.livro_sinalizacoes
  for each row execute function public.livro_sin_avisos();

-- Registro de remoções imutável. Só duas exceções: a limpeza do texto vencido (flag de transação) e as ações do banco sem
-- usuário logado (conta excluída zera as referências; reset do ambiente de teste).
create or replace function public.livro_remocoes_imutavel()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    if tg_op = 'UPDATE' and new.autor_id is null and old.autor_id is not null then
      new.autor_nome := 'Ex-morador';
      new.autor_unidade := null;
    end if;
    -- Quem removeu teve a conta excluída: o nome também sai (o papel fica, é o que importa para a auditoria).
    if tg_op = 'UPDATE' and new.removido_por_id is null and old.removido_por_id is not null then
      new.removido_por_nome := 'Ex-morador';
    end if;
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'UPDATE' and current_setting('livro.limpeza', true) = 'on'
     and new.texto_original is null
     and (to_jsonb(new) - 'texto_original') = (to_jsonb(old) - 'texto_original') then
    return new;
  end if;
  raise exception 'registro_imutavel' using errcode = '42501';
end $$;
drop trigger if exists livro_remocoes_imutavel_upd on public.livro_remocoes;
create trigger livro_remocoes_imutavel_upd before update or delete on public.livro_remocoes
  for each row execute function public.livro_remocoes_imutavel();

-- Citado teve a conta excluída: o rótulo com o nome de Síndico/Subsíndico/Conselho vira "Ex-membro".
create or replace function public.livro_cit_anonimiza()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.alvo_usuario_id is null and old.alvo_usuario_id is not null and new.tipo = 'PESSOA' then
    new.rotulo := 'Ex-membro';
  end if;
  return new;
end $$;
drop trigger if exists livro_cit_anonimiza_upd on public.livro_citacoes;
create trigger livro_cit_anonimiza_upd before update on public.livro_citacoes
  for each row execute function public.livro_cit_anonimiza();

-- Texto vencido (90 dias) é apagado de verdade. Roda a cada remoção e a cada leitura do registro
-- e a cada listagem de tópicos (não dependemos de agendador); a leitura já esconde o texto vencido de qualquer jeito.
create or replace function public._livro_limpar_vencidos()
returns void language plpgsql security definer set search_path = public as $$
begin
  perform set_config('livro.limpeza', 'on', true);
  update public.livro_remocoes set texto_original = null where texto_original is not null and texto_expira_em <= now();
  perform set_config('livro.limpeza', 'off', true);
end $$;

-- ──────────────────────────────────────────────
-- 4) Leitura (RPCs; o navegador não recebe autor_id nem ids internos)
-- ──────────────────────────────────────────────

create or replace function public._livro_msg_json(m public.livro_mensagens, p_eu uuid, p_ve_registro boolean)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', m.id,
    'paiId', m.pai_id,
    'texto', m.texto,
    'autorNome', m.autor_nome,
    'autorUnidade', m.autor_unidade,
    'autorPapel', m.autor_papel,
    'criadaEm', m.criada_em,
    'ultimaAtividadeEm', m.ultima_atividade_em,
    'nRespostas', m.n_respostas,
    'removida', m.removida_em is not null,
    'removidaPor', m.removida_por,
    'minha', m.autor_id is not null and m.autor_id = p_eu,
    -- Citação em mensagem removida some da tela.
    'citados', case when m.removida_em is not null then '[]'::jsonb else (
      select coalesce(jsonb_agg(jsonb_build_object('tipo', c.tipo, 'rotulo', c.rotulo) order by c.rotulo), '[]'::jsonb)
      from public.livro_citacoes c where c.mensagem_id = m.id) end,
    -- Texto original (90 dias): só o autor e quem lê o registro.
    'textoOriginal', (
      select r.texto_original from public.livro_remocoes r
      where r.mensagem_id = m.id and r.texto_original is not null and r.texto_expira_em > now()
        and ((m.autor_id is not null and m.autor_id = p_eu) or p_ve_registro)),
    'jaSinalizei', exists (select 1 from public.livro_sinalizacoes s where s.mensagem_id = m.id and s.usuario_id = p_eu)
  );
$$;

-- Estado do livro para quem chama (a tela só obedece; o banco decide de novo a cada operação).
create or replace function public.livro_acesso()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  c public.livro_config%rowtype;
  p public.profiles%rowtype;
  v_papel text := public.livro_papel();
  v_esc text := public.livro_papel_escrita();
begin
  if auth.uid() is null then raise exception 'sem_permissao' using errcode = '42501'; end if;
  select * into c from public.livro_config where id = 1;
  select * into p from public.profiles where id = auth.uid() and desativado_em is null;
  return jsonb_build_object(
    'modo', c.modo,
    'papel', v_papel,
    'podeLer', v_papel is not null,
    'podeEscrever', v_esc is not null,
    'podeSinalizar', v_esc is not null,
    'podeRemoverQualquer', coalesce(v_papel in ('SINDICO', 'ADM'), false),
    'podeVerRegistro', coalesce(v_papel in ('SINDICO', 'SUBSINDICO', 'ADM', 'CONSELHO'), false),
    'podeAlterarModo', coalesce(found and p.role in ('SINDICO', 'ADM'), false),
    'regrasVersao', c.regras_versao,
    'liberadoParaAbrir', c.liberado_para_abrir,
    'cienciaOk', exists (select 1 from public.livro_ciencia ci where ci.usuario_id = auth.uid() and ci.versao >= c.regras_versao)
  );
end $$;

create or replace function public.livro_listar_topicos(p_antes_em timestamptz default null, p_antes_id uuid default null, p_limite integer default 20)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_lim integer := greatest(1, least(coalesce(p_limite, 20), 30));
  v_reg boolean := public.livro_pode_ver_registro();
  v_res jsonb;
begin
  if public.livro_papel() is null then return '[]'::jsonb; end if;
  -- Texto removido vencido é apagado de verdade também aqui (barato: índice parcial por vencimento).
  perform public._livro_limpar_vencidos();
  select coalesce(jsonb_agg(public._livro_msg_json(m, auth.uid(), v_reg) order by m.ultima_atividade_em desc, m.id desc), '[]'::jsonb)
    into v_res
  from (
    select * from public.livro_mensagens t
    where t.pai_id is null
      and (p_antes_em is null or t.ultima_atividade_em < p_antes_em
           or (t.ultima_atividade_em = p_antes_em and p_antes_id is not null and t.id < p_antes_id))
    order by t.ultima_atividade_em desc, t.id desc
    limit v_lim
  ) m;
  return v_res;
end $$;

create or replace function public.livro_obter_topico(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare m public.livro_mensagens%rowtype;
begin
  if public.livro_papel() is null then return null; end if;
  select * into m from public.livro_mensagens where id = p_id and pai_id is null;
  if not found then return null; end if;
  return public._livro_msg_json(m, auth.uid(), public.livro_pode_ver_registro());
end $$;

create or replace function public.livro_listar_respostas(p_topico uuid, p_depois_em timestamptz default null, p_depois_id uuid default null, p_limite integer default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_lim integer := greatest(1, least(coalesce(p_limite, 30), 50));
  v_reg boolean := public.livro_pode_ver_registro();
  v_res jsonb;
begin
  if public.livro_papel() is null then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(public._livro_msg_json(m, auth.uid(), v_reg) order by m.criada_em, m.id), '[]'::jsonb)
    into v_res
  from (
    select * from public.livro_mensagens t
    where t.pai_id = p_topico
      and (p_depois_em is null or t.criada_em > p_depois_em
           or (t.criada_em = p_depois_em and p_depois_id is not null and t.id > p_depois_id))
    order by t.criada_em, t.id
    limit v_lim
  ) m;
  return v_res;
end $$;

-- ──────────────────────────────────────────────
-- 5) Citáveis
-- ──────────────────────────────────────────────

-- Quem pode ser citado, com o id interno (uso só do banco). Unidades com conta ativa e validada de Síndico, Subsíndico,
-- Conselho ou Morador; pessoas: Síndico, Subsíndico e Conselho. ADM, Zelador, Portaria, provisório, dependente sem conta
-- e unidade sem conta ficam de fora. Quem chama nunca aparece (nem a própria unidade).
create or replace function public._livro_citaveis_todos(p_eu uuid)
returns table (ref text, tipo text, rotulo text, alvo_usuario_id uuid, alvo_unit_id text)
language sql stable security definer set search_path = public as $$
  with sal as (select valor from public.livro_segredo where id = 1)
  select md5((select valor from sal) || ':U:' || u.id), 'UNIDADE'::text,
         'Unidade ' || u.bloco || '-' || u.numero, u.usuario_id, u.id
  from public.units u
  join public.profiles p on p.id = u.usuario_id
  where p.desativado_em is null and p.cadastro_validado = true
    and p.role in ('SINDICO', 'SUBSINDICO', 'CONSELHO', 'MORADOR')
    and p.id <> p_eu
  union all
  select md5((select valor from sal) || ':P:' || p.id::text), 'PESSOA'::text,
         trim(case p.role when 'SINDICO' then 'Síndico' when 'SUBSINDICO' then 'Subsíndico' else 'Conselho' end
              || ' ' || case when public.nome_em_branco(p.name) then '' else left(public.limpar_texto_livre(p.name), 60) end),
         p.id, null::text
  from public.profiles p
  where p.desativado_em is null and p.cadastro_validado = true
    and p.role in ('SINDICO', 'SUBSINDICO', 'CONSELHO')
    and p.id <> p_eu;
$$;

-- O que o navegador recebe: só código opaco, tipo e rótulo. Só quem pode escrever.
create or replace function public.livro_citaveis()
returns table (ref text, tipo text, rotulo text)
language plpgsql stable security definer set search_path = public as $$
begin
  if public.livro_papel_escrita() is null then return; end if;
  return query select c.ref, c.tipo, c.rotulo from public._livro_citaveis_todos(auth.uid()) c order by c.tipo desc, c.rotulo;
end $$;

-- ──────────────────────────────────────────────
-- 6) Escrita
-- ──────────────────────────────────────────────

create or replace function public.livro_publicar(p_pai uuid, p_texto text, p_citados text[] default '{}')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_papel text;
  p public.profiles%rowtype;
  c public.livro_config%rowtype;
  v_texto text;
  v_min integer;
  v_max integer;
  v_unidade text;
  v_nome text;
  v_refs text[];
  v_id uuid;
  v_n integer;
  v_h integer;
  v_d integer;
  r record;
  v_achados integer := 0;
  v_norm text;
  v_dig text;
begin
  if auth.uid() is null then raise exception 'sem_permissao' using errcode = '42501'; end if;
  -- Perfil relido do banco: modo, conta ativa, validada, um dos quatro perfis que escrevem.
  v_papel := public.livro_papel_escrita();
  if v_papel is null then raise exception 'sem_permissao' using errcode = '42501'; end if;
  select * into p from public.profiles where id = auth.uid();
  select * into c from public.livro_config where id = 1;
  -- Evita corrida entre dois envios da mesma pessoa (limite de frequência).
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 43));

  if not exists (select 1 from public.livro_ciencia ci where ci.usuario_id = auth.uid() and ci.versao >= c.regras_versao) then
    raise exception 'sem_ciencia' using errcode = 'P0001';
  end if;

  -- Texto: invisíveis e direção fora, quebras e acentos empilhados domados, nada de só espaço.
  if p_texto is null then raise exception 'texto_vazio' using errcode = 'P0001'; end if;
  if char_length(p_texto) > 6000 then raise exception 'texto_longo' using errcode = 'P0001'; end if;
  v_texto := public.limpar_texto_livre(p_texto);
  v_texto := replace(v_texto, E'\r', '');
  -- Espaços incomuns (NBSP, em/en space, ideográfico...) viram espaço comum.
  v_texto := regexp_replace(v_texto, '[\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]', ' ', 'g');
  v_texto := regexp_replace(v_texto, '[ \t]+\n', E'\n', 'g');
  v_texto := regexp_replace(v_texto, '\n{3,}', E'\n\n', 'g');
  v_texto := regexp_replace(v_texto, '([̀-ͯ]{2})[̀-ͯ]+', '\1', 'g');
  v_texto := btrim(v_texto);
  -- Seletores de variação (U+FE00 a U+FE0F e U+E0100 a U+E01EF) sozinhos não são texto: o emoji os usa, mas só com um símbolo junto.
  if public.nome_em_branco(regexp_replace(v_texto, '[\uFE00-\uFE0F\U000E0100-\U000E01EF]', '', 'g')) then raise exception 'texto_vazio' using errcode = 'P0001'; end if;
  v_min := case when p_pai is null then 10 else 1 end;
  v_max := case when p_pai is null then 1000 else 500 end;
  if char_length(v_texto) < v_min then raise exception 'texto_curto' using errcode = 'P0001'; end if;
  if char_length(v_texto) > v_max then raise exception 'texto_longo' using errcode = 'P0001'; end if;
  -- Dado pessoal de terceiros não entra (o livro é aberto). O filtro é um acelerador, não uma barreira: normaliza antes de testar
  -- (largura total e demais formas de compatibilidade viram ASCII por NFKC; "[at]", "(arroba)" viram "@"; separadores entre
  -- dígitos somem) e recusa CPF, CNPJ, e-mail, telefone (com ou sem máscara) e RG. Aceita falso positivo: 8 ou mais
  -- dígitos seguidos (depois de tirar espaço, ponto, hífen e parênteses) são recusados; datas com barra (12/03/2026) passam.
  v_norm := lower(normalize(v_texto, NFKC));
  v_norm := regexp_replace(v_norm, '\s*[\[\(\{]\s*(at|arroba)\s*[\]\)\}]\s*', '@', 'g');
  v_norm := regexp_replace(v_norm, '\s*[\[\(\{]\s*(dot|ponto)\s*[\]\)\}]\s*', '.', 'g');
  v_norm := regexp_replace(v_norm, '\s+arroba\s+', '@', 'g');
  -- E-mail com espaços em volta de "@" e ".", só quando o final é um domínio conhecido (evita recusar "às 10h @ portaria. Obrigado").
  v_norm := regexp_replace(v_norm, '([a-z0-9._%+-])\s*@\s*([a-z0-9-]+)\s*\.\s*(com|net|org|br|gov|edu|io|me|info|biz|co|app|dev)\M', '\1@\2.\3', 'g');
  v_dig := regexp_replace(v_norm, '(?<=[0-9])[\s.\-()]+(?=[0-9])', '', 'g');
  if v_dig ~ '[0-9]{8,}'
     or v_norm ~ '(^|[^0-9])[0-9]{2}\.?[0-9]{3}\.?[0-9]{3}/?[0-9]{4}-?[0-9]{2}([^0-9]|$)'
     or v_norm ~ '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}' then
    raise exception 'dado_pessoal' using errcode = 'P0001';
  end if;

  -- Frequência: 10 por hora e 40 por dia; o mesmo texto não se repete em 1 minuto. Mensagem removida continua contando.
  select count(*) filter (where criada_em > now() - interval '1 hour'), count(*)
    into v_h, v_d
  from public.livro_mensagens where autor_id = auth.uid() and criada_em > now() - interval '1 day';
  if v_h >= 10 then raise exception 'limite_hora' using errcode = 'P0001'; end if;
  if v_d >= 40 then raise exception 'limite_dia' using errcode = 'P0001'; end if;
  if exists (select 1 from public.livro_mensagens where autor_id = auth.uid() and criada_em > now() - interval '1 minute' and texto = v_texto) then
    raise exception 'texto_repetido' using errcode = 'P0001';
  end if;

  -- Quem escreve: nome e unidade vêm do servidor (o que o navegador mandar é ignorado). Morador precisa de unidade.
  v_nome := case when public.nome_em_branco(p.name) then 'Morador' else left(public.limpar_texto_livre(p.name), 80) end;
  if v_papel = 'MORADOR' then
    select u.bloco || '-' || u.numero into v_unidade from public.units u where u.usuario_id = auth.uid() limit 1;
    if v_unidade is null and nullif(btrim(coalesce(p.bloco, '')), '') is not null and nullif(btrim(coalesce(p.unidade, '')), '') is not null then
      v_unidade := btrim(p.bloco) || '-' || btrim(p.unidade);
    end if;
    if v_unidade is null then raise exception 'sem_unidade' using errcode = 'P0001'; end if;
  end if;

  -- Citados: lista estruturada de códigos opacos (o "@" no texto não vale nada). Até 5, sem repetição.
  select coalesce(array_agg(distinct x), '{}') into v_refs from unnest(coalesce(p_citados, '{}')) x where x is not null;
  if cardinality(v_refs) > 5 then raise exception 'muitos_citados' using errcode = 'P0001'; end if;
  select count(*) into v_achados from public._livro_citaveis_todos(auth.uid()) t where t.ref = any (v_refs);
  if v_achados <> cardinality(v_refs) then raise exception 'alvo_invalido' using errcode = 'P0001'; end if;
  select count(*) into v_n from public.livro_citacoes ct join public.livro_mensagens m on m.id = ct.mensagem_id
   where m.autor_id = auth.uid() and m.criada_em > now() - interval '1 day';
  if v_n + cardinality(v_refs) > 15 then raise exception 'limite_citacoes' using errcode = 'P0001'; end if;

  insert into public.livro_mensagens (pai_id, autor_id, autor_nome, autor_unidade, autor_papel, texto)
  values (p_pai, auth.uid(), v_nome, v_unidade, v_papel, v_texto)
  returning id into v_id;

  for r in select * from public._livro_citaveis_todos(auth.uid()) t where t.ref = any (v_refs) loop
    insert into public.livro_citacoes (mensagem_id, tipo, alvo_usuario_id, alvo_unit_id, rotulo)
    values (v_id, r.tipo, r.alvo_usuario_id, r.alvo_unit_id, r.rotulo)
    on conflict do nothing;
  end loop;

  return jsonb_build_object('ok', true, 'id', v_id, 'topicoId', coalesce(p_pai, v_id));
end $$;

create or replace function public.livro_dar_ciencia()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v integer;
begin
  if public.livro_papel_escrita() is null then raise exception 'sem_permissao' using errcode = '42501'; end if;
  select regras_versao into v from public.livro_config where id = 1;
  insert into public.livro_ciencia (usuario_id, versao) values (auth.uid(), v)
  on conflict (usuario_id) do update set versao = excluded.versao, em = now();
  return jsonb_build_object('ok', true, 'versao', v);
end $$;

-- Remoção lógica. O autor remove a própria; Síndico e ADM removem qualquer uma, com motivo de lista fechada.
-- Subsíndico, Conselho, Morador, Zelador e Portaria não removem de outros.
create or replace function public.livro_remover(p_mensagem uuid, p_motivo text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_papel text;
  m public.livro_mensagens%rowtype;
  p public.profiles%rowtype;
  v_proprio boolean;
  v_motivo text;
begin
  if auth.uid() is null then raise exception 'sem_permissao' using errcode = '42501'; end if;
  v_papel := public.livro_papel();
  -- Conta desativada não age. O autor, porém, apaga a própria mensagem mesmo se mudou de perfil ou o livro está fechado
  -- para o perfil atual: apagar é inofensivo e protege quem escreveu (direito do titular).
  if not exists (select 1 from public.profiles pf where pf.id = auth.uid() and pf.desativado_em is null) then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  select * into m from public.livro_mensagens where id = p_mensagem for update;
  if not found then raise exception 'mensagem_inexistente' using errcode = 'P0001'; end if;
  v_proprio := m.autor_id is not null and m.autor_id = auth.uid();

  if v_proprio then
    v_motivo := 'AUTOR';
  elsif v_papel in ('SINDICO', 'ADM') then
    if p_motivo is null or p_motivo not in ('OFENSA', 'DADO_PESSOAL', 'FORA_DO_ASSUNTO', 'REPETIDA', 'OUTRO') then
      raise exception 'motivo_invalido' using errcode = 'P0001';
    end if;
    v_motivo := p_motivo;
  else
    raise exception 'sem_permissao' using errcode = '42501';
  end if;

  -- Já removida: não duplica registro, aviso nem auditoria.
  if m.removida_em is not null then return jsonb_build_object('ok', true, 'jaRemovida', true); end if;

  select * into p from public.profiles where id = auth.uid();
  insert into public.livro_remocoes (
    mensagem_id, removido_por_id, removido_por_nome, removido_por_papel, motivo, tipo,
    autor_id, autor_nome, autor_unidade, autor_era_quem_removeu, citava_quem_removeu, texto_original, texto_expira_em)
  values (
    m.id, auth.uid(), left(p.name, 80), p.role, v_motivo, case when m.pai_id is null then 'TOPICO' else 'RESPOSTA' end,
    m.autor_id, m.autor_nome, m.autor_unidade, v_proprio,
    exists (select 1 from public.livro_citacoes c where c.mensagem_id = m.id and c.alvo_usuario_id = auth.uid()),
    m.texto, now() + interval '90 days');

  update public.livro_mensagens
     set texto = '', removida_em = now(), removida_por = case when v_motivo = 'AUTOR' then 'AUTOR' else 'GESTAO' end
   where id = m.id;

  perform public._livro_auditar(
    case when v_motivo = 'AUTOR' then 'Removeu a própria mensagem do Livro' else 'Removeu uma mensagem do Livro' end,
    jsonb_build_object('mensagemId', m.id, 'motivo', v_motivo, 'tipo', case when m.pai_id is null then 'TOPICO' else 'RESPOSTA' end));
  perform public._livro_limpar_vencidos();
  return jsonb_build_object('ok', true, 'jaRemovida', false);
end $$;

-- "Avisar a gestão": só avisa Síndico e ADM (uma vez por mensagem). Não oculta nada nem identifica quem sinalizou.
create or replace function public.livro_sinalizar(p_mensagem uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare m public.livro_mensagens%rowtype; v_linhas integer;
begin
  if auth.uid() is null or public.livro_papel_escrita() is null then raise exception 'sem_permissao' using errcode = '42501'; end if;
  select * into m from public.livro_mensagens where id = p_mensagem;
  if not found then raise exception 'mensagem_inexistente' using errcode = 'P0001'; end if;
  if m.removida_em is not null then raise exception 'mensagem_removida' using errcode = 'P0001'; end if;
  if m.autor_id = auth.uid() then raise exception 'mensagem_propria' using errcode = 'P0001'; end if;
  -- Já sinalizou esta: "já avisado", sem contar no limite.
  if exists (select 1 from public.livro_sinalizacoes s where s.mensagem_id = m.id and s.usuario_id = auth.uid()) then
    return jsonb_build_object('ok', true, 'jaAvisado', true);
  end if;
  -- Limite por pessoa: 5 por hora e 15 por dia (o sino da gestão não pode ser lotado por uma conta só).
  perform pg_advisory_xact_lock(hashtextextended('livro-sinaliza-pessoa:' || auth.uid()::text, 43));
  if (select count(*) from public.livro_sinalizacoes s where s.usuario_id = auth.uid() and s.criada_em > now() - interval '1 hour') >= 5
     or (select count(*) from public.livro_sinalizacoes s where s.usuario_id = auth.uid() and s.criada_em > now() - interval '1 day') >= 15 then
    raise exception 'limite_sinalizacao' using errcode = 'P0001';
  end if;
  insert into public.livro_sinalizacoes (mensagem_id, usuario_id) values (m.id, auth.uid()) on conflict do nothing;
  get diagnostics v_linhas = row_count;
  return jsonb_build_object('ok', true, 'jaAvisado', v_linhas = 0);
end $$;

-- ──────────────────────────────────────────────
-- 7) Interruptor e registro de remoções
-- ──────────────────────────────────────────────

create or replace function public.livro_definir_modo(p_modo text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_antes text;
begin
  if auth.uid() is null or public.get_user_role() not in ('SINDICO', 'ADM') then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  if p_modo is null or p_modo not in ('DESLIGADO', 'EQUIPE', 'ABERTO') then
    raise exception 'modo_invalido' using errcode = 'P0001';
  end if;
  select modo into v_antes from public.livro_config where id = 1;
  -- Abrir aos moradores exige a liberação feita FORA do app (#55, advogado): nem Síndico nem ADM a concedem por aqui.
  if p_modo = 'ABERTO' and not exists (select 1 from public.livro_config where id = 1 and liberado_para_abrir) then
    raise exception 'abertura_nao_liberada' using errcode = 'P0001';
  end if;
  if v_antes is distinct from p_modo then
    update public.livro_config set modo = p_modo, atualizado_em = now(), atualizado_por = auth.uid() where id = 1;
    perform public._livro_auditar('Alterou o modo do Livro de reclamações', jsonb_build_object('de', v_antes, 'para', p_modo));
  end if;
  return jsonb_build_object('ok', true, 'modo', p_modo);
end $$;

-- Registro de remoções: Síndico, Subsíndico, ADM e Conselho (nunca Morador, Zelador nem Portaria), com o texto por 90 dias.
create or replace function public.livro_registro_remocoes(p_limite integer default 30, p_antes_em timestamptz default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_lim integer := greatest(1, least(coalesce(p_limite, 30), 50));
  v_itens jsonb;
  v_resumo jsonb;
begin
  if not public.livro_pode_ver_registro() then raise exception 'sem_permissao' using errcode = '42501'; end if;
  perform public._livro_limpar_vencidos();
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', r.id, 'mensagemId', r.mensagem_id,
      'topicoId', coalesce(m.pai_id, m.id),
      'removidaEm', r.removida_em,
      'removidoPorNome', r.removido_por_nome, 'removidoPorPapel', r.removido_por_papel,
      'motivo', r.motivo, 'tipo', r.tipo,
      'autorNome', r.autor_nome, 'autorUnidade', r.autor_unidade,
      'autorEraQuemRemoveu', r.autor_era_quem_removeu, 'citavaQuemRemoveu', r.citava_quem_removeu,
      'textoOriginal', case when r.texto_expira_em > now() then r.texto_original end,
      'textoExpiraEm', r.texto_expira_em) order by r.removida_em desc, r.id desc), '[]'::jsonb)
    into v_itens
  from (select * from public.livro_remocoes x where p_antes_em is null or x.removida_em < p_antes_em
        order by x.removida_em desc, x.id desc limit v_lim) r
  left join public.livro_mensagens m on m.id = r.mensagem_id;
  -- Contagem dos últimos 30 dias por quem removeu (o autor que apaga a própria vai à parte): o Conselho nota padrão.
  select coalesce(jsonb_agg(jsonb_build_object('papel', g.papel, 'total', g.total) order by g.papel), '[]'::jsonb)
    into v_resumo
  from (select case when motivo = 'AUTOR' then 'AUTOR' else removido_por_papel end as papel, count(*) as total
        from public.livro_remocoes where removida_em > now() - interval '30 days' group by 1) g;
  return jsonb_build_object('itens', v_itens, 'resumo', v_resumo);
end $$;

-- ──────────────────────────────────────────────
-- 8) Políticas de leitura e GRANTs (nada de escrita direta para o navegador)
-- ──────────────────────────────────────────────
drop policy if exists livro_mensagens_ler on public.livro_mensagens;
create policy livro_mensagens_ler on public.livro_mensagens for select using (public.livro_pode_ler());
drop policy if exists livro_citacoes_ler on public.livro_citacoes;
create policy livro_citacoes_ler on public.livro_citacoes for select using (
  public.livro_pode_ler()
  -- Citação de mensagem removida some também pela API (a spec: some da tela e não é legível).
  and exists (select 1 from public.livro_mensagens m where m.id = livro_citacoes.mensagem_id and m.removida_em is null)
);
drop policy if exists livro_remocoes_ler on public.livro_remocoes;
create policy livro_remocoes_ler on public.livro_remocoes for select using (public.livro_pode_ver_registro());

revoke all on public.livro_config, public.livro_segredo, public.livro_mensagens, public.livro_citacoes,
  public.livro_remocoes, public.livro_sinalizacoes, public.livro_ciencia from public, anon, authenticated;
-- Colunas internas ficam de fora: autor_id e ids de alvo (mensagens e citações), texto original (remoções, só pela RPC).
grant select (id, pai_id, autor_nome, autor_unidade, autor_papel, texto, criada_em, ultima_atividade_em, n_respostas, removida_em, removida_por)
  on public.livro_mensagens to authenticated;
grant select (id, mensagem_id, tipo, rotulo) on public.livro_citacoes to authenticated;
grant select (id, mensagem_id, removido_por_nome, removido_por_papel, removida_em, motivo, tipo, autor_nome, autor_unidade,
  autor_era_quem_removeu, citava_quem_removeu, texto_expira_em) on public.livro_remocoes to authenticated;

-- Funções: nada por padrão; só o que o navegador chama vai para authenticated. Gatilhos e apoio ficam só no banco.
revoke all on function public.livro_papel(), public.livro_pode_ler(), public.livro_papel_escrita(), public.livro_pode_ver_registro(),
  public._livro_avisar(uuid, text, text, text[], text[]), public._livro_auditar(text, jsonb),
  public.livro_msg_antes(), public.livro_msg_depois(), public.livro_msg_avisos(), public.livro_cit_avisos(),
  public.livro_rem_avisos(), public.livro_sin_avisos(), public.livro_remocoes_imutavel(), public._livro_limpar_vencidos(),
  public._livro_msg_json(public.livro_mensagens, uuid, boolean), public._livro_citaveis_todos(uuid),
  public.livro_acesso(), public.livro_listar_topicos(timestamptz, uuid, integer), public.livro_obter_topico(uuid),
  public.livro_listar_respostas(uuid, timestamptz, uuid, integer), public.livro_citaveis(),
  public.livro_publicar(uuid, text, text[]), public.livro_dar_ciencia(), public.livro_remover(uuid, text),
  public.livro_sinalizar(uuid), public.livro_definir_modo(text), public.livro_registro_remocoes(integer, timestamptz)
  from public, anon, authenticated;

-- As policies chamam estas quatro com o papel de quem consulta.
grant execute on function public.livro_papel(), public.livro_pode_ler(), public.livro_pode_ver_registro() to authenticated;
grant execute on function public.livro_acesso(), public.livro_listar_topicos(timestamptz, uuid, integer), public.livro_obter_topico(uuid),
  public.livro_listar_respostas(uuid, timestamptz, uuid, integer), public.livro_citaveis(),
  public.livro_publicar(uuid, text, text[]), public.livro_dar_ciencia(), public.livro_remover(uuid, text),
  public.livro_sinalizar(uuid), public.livro_definir_modo(text), public.livro_registro_remocoes(integer, timestamptz)
  to authenticated;
