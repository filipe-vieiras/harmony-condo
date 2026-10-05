-- Harmony — reservas: bloqueio entre espaços (issue #81, fase 1).
-- Depende da 0032 (conflito no banco), da 0033 (disponibilidade) e da 0034 (status inicial).
--
-- Decisão do dono (2026-10-05): o síndico marca, no cadastro do espaço, quais OUTROS espaços ele
-- bloqueia. Regras:
--   • Sempre SIMÉTRICA: o par (A, B) vale para os dois lados; marcar ou desmarcar de um lado muda
--     os dois. O banco guarda o par ORDENADO (espaco_a < espaco_b), então (A,B) e (B,A) não
--     coexistem e um espaço nunca bloqueia a si mesmo.
--   • No mesmo dia, uma reserva PENDENTE ou APROVADA em um espaço torna o outro indisponível para
--     TODAS as unidades, inclusive a que fez a reserva, e também para reservas registradas pela
--     equipe (Síndico, Subsíndico e ADM não têm exceção).
--   • SEM cadeia: A–B e B–C não fazem A bloquear C (só os pares diretos entram na conta).
--   • Reservas que já existem NÃO mudam ao criar o par: só novos pedidos são barrados.
--   • Apagar um espaço apaga seus pares (cascata); desativar mantém os pares.
--   • Concorrência: duas reservas simultâneas de espaços que se bloqueiam geram UMA só. O índice
--     único da 0032 só cobre o MESMO espaço; aqui o gatilho serializa a checagem com um
--     advisory lock por data.
--   • A função de disponibilidade passa a marcar o dia como ocupado também por bloqueio, SEM
--     revelar o espaço que bloqueou nem quem reservou (resposta idêntica à de um dia ocupado).
--   • Só Síndico, Subsíndico e ADM (is_admin()) leem e gravam os pares. Portaria, Conselho, morador,
--     provisório e visitante não têm acesso à configuração.
--
-- Migração aditiva e idempotente. Não apaga nem altera nenhuma reserva.

-- ──────────────────────────────────────────────
-- 1) Pares de bloqueio
-- ──────────────────────────────────────────────
-- A ordem usa collate "C" para a comparação ser exatamente a mesma no CHECK, na função de
-- gravação e em qualquer consulta, independente do idioma do banco.
create table if not exists public.space_blocks (
  espaco_a text not null references public.spaces(id) on delete cascade,
  espaco_b text not null references public.spaces(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (espaco_a, espaco_b),
  constraint space_blocks_ordem_check check (espaco_a collate "C" < espaco_b collate "C")
);

-- A chave primária já atende a busca por espaco_a; este índice atende a busca pelo outro lado.
create index if not exists space_blocks_espaco_b_idx on public.space_blocks (espaco_b);

alter table public.space_blocks enable row level security;

-- O Supabase dá ALL a anon e authenticated por padrão: tira tudo e devolve só a leitura (e a RLS
-- ainda limita a leitura à gestão). A escrita é SÓ pela função definir_bloqueios_espaco().
revoke all on table public.space_blocks from public, anon, authenticated;
grant select on table public.space_blocks to authenticated;

drop policy if exists "space_blocks_read_admin" on public.space_blocks;
create policy "space_blocks_read_admin" on public.space_blocks for select
  using (public.is_admin());

-- ──────────────────────────────────────────────
-- 2) Gravação pela tela: uma transação, os dois lados de uma vez
-- ──────────────────────────────────────────────
-- Recebe o espaço e a lista COMPLETA dos outros espaços que ele bloqueia: apaga os pares dele
-- e grava os novos, já ordenados. Marcar ou desmarcar numa edição reflete nos dois lados porque
-- o par é único. A mudança fica no histórico de ações com uma frase legível, sem dado pessoal.
create or replace function public.definir_bloqueios_espaco(p_espaco_id text, p_outros text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text;
  v_ids text[];
  v_antes text[];
  v_adicionados text[];
  v_removidos text[];
  v_lista text;
  v_ator text;
  v_role text;
begin
  if not public.is_admin() then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;

  select s.nome into v_nome from public.spaces s where s.id = p_espaco_id;
  if v_nome is null then
    raise exception 'espaco_inexistente' using errcode = '22023';
  end if;

  select coalesce(array_agg(distinct x), '{}') into v_ids
  from unnest(coalesce(p_outros, '{}'::text[])) as x
  where x is not null;

  if p_espaco_id = any (v_ids) then
    raise exception 'bloqueio_proprio_espaco' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(v_ids) as x where not exists (select 1 from public.spaces s where s.id = x)) then
    raise exception 'espaco_inexistente' using errcode = '22023';
  end if;

  -- Duas edições de bloqueio ao mesmo tempo não se atropelam.
  perform pg_advisory_xact_lock(hashtext('space_blocks'));

  select coalesce(array_agg(case when b.espaco_a = p_espaco_id then b.espaco_b else b.espaco_a end), '{}')
    into v_antes
  from public.space_blocks b
  where b.espaco_a = p_espaco_id or b.espaco_b = p_espaco_id;

  delete from public.space_blocks where espaco_a = p_espaco_id or espaco_b = p_espaco_id;

  insert into public.space_blocks (espaco_a, espaco_b)
  select case when p_espaco_id collate "C" < x collate "C" then p_espaco_id else x end,
         case when p_espaco_id collate "C" < x collate "C" then x else p_espaco_id end
  from unnest(v_ids) as x;

  select coalesce(array_agg(x), '{}') into v_adicionados from unnest(v_ids) as x where x <> all (v_antes);
  select coalesce(array_agg(x), '{}') into v_removidos from unnest(v_antes) as x where x <> all (v_ids);

  select p.name, p.role into v_ator, v_role from public.profiles p where p.id = auth.uid();

  -- "A, B e C": a última vírgula vira " e ".
  if cardinality(v_adicionados) > 0 then
    select regexp_replace(string_agg(s.nome, ', ' order by s.nome), ', ([^,]*)$', ' e \1') into v_lista
    from public.spaces s where s.id = any (v_adicionados);
    insert into public.audit_logs (usuario_id, usuario_nome, usuario_role, acao, modulo, detalhes)
    values (auth.uid(), coalesce(v_ator, 'Manutenção direta no banco'), coalesce(v_role, 'SISTEMA'),
      'Passou a bloquear ' || v_lista || ' no espaço ' || v_nome, 'ESPACOS',
      jsonb_build_object('spaceId', p_espaco_id, 'espaco', v_nome, 'bloqueados', v_lista));
  end if;
  if cardinality(v_removidos) > 0 then
    select regexp_replace(string_agg(s.nome, ', ' order by s.nome), ', ([^,]*)$', ' e \1') into v_lista
    from public.spaces s where s.id = any (v_removidos);
    insert into public.audit_logs (usuario_id, usuario_nome, usuario_role, acao, modulo, detalhes)
    values (auth.uid(), coalesce(v_ator, 'Manutenção direta no banco'), coalesce(v_role, 'SISTEMA'),
      'Deixou de bloquear ' || v_lista || ' no espaço ' || v_nome, 'ESPACOS',
      jsonb_build_object('spaceId', p_espaco_id, 'espaco', v_nome, 'desbloqueados', v_lista));
  end if;
end $$;

revoke all on function public.definir_bloqueios_espaco(text, text[]) from public, anon;
grant execute on function public.definir_bloqueios_espaco(text, text[]) to authenticated;

-- ──────────────────────────────────────────────
-- 3) Gatilho de conflito com os espaços parceiros
-- ──────────────────────────────────────────────
-- "15": roda depois da validação (00) e do status inicial (10), quando o status já é o definitivo.
-- Só age quando a linha PASSA a ocupar o dia (criação, reativação de RECUSADA/CANCELADA, troca de
-- espaço ou de data): aprovar um PENDENTE que já existe não muda a ocupação e não dispara nada.
-- Vale para qualquer perfil logado, inclusive quem tem is_admin(). Sem usuário (service role:
-- seed e manutenção) não age, como os outros gatilhos desta tabela.
create or replace function public.reservations_bloqueio_entre_espacos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if new.espaco_id is null or new.status not in ('PENDENTE', 'APROVADA') then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and old.status in ('PENDENTE', 'APROVADA')
     and old.espaco_id is not distinct from new.espaco_id
     and old.data = new.data then
    return new;
  end if;

  -- Sem par, nada a conferir (e nada a serializar).
  if not exists (
    select 1 from public.space_blocks b where b.espaco_a = new.espaco_id or b.espaco_b = new.espaco_id
  ) then
    return new;
  end if;

  -- Trava por DATA até o fim da transação: a segunda reserva espera a primeira confirmar e então
  -- enxerga a linha dela (cada consulta do plpgsql tira uma foto nova em READ COMMITTED).
  perform pg_advisory_xact_lock(hashtext('reservas_dia'), (new.data - date '2000-01-01'));

  if exists (
    select 1
    from public.space_blocks b
    join public.reservations r
      on r.espaco_id = case when b.espaco_a = new.espaco_id then b.espaco_b else b.espaco_a end
    where (b.espaco_a = new.espaco_id or b.espaco_b = new.espaco_id)
      and r.data = new.data
      and r.status in ('PENDENTE', 'APROVADA')
      and r.id is distinct from new.id
  ) then
    raise exception 'reserva_dia_indisponivel' using errcode = 'P0001';
  end if;

  return new;
end $$;

drop trigger if exists reservations_15_bloqueio_entre_espacos on public.reservations;
create trigger reservations_15_bloqueio_entre_espacos
  before insert or update of status, espaco_id, data on public.reservations
  for each row execute function public.reservations_bloqueio_entre_espacos();

revoke all on function public.reservations_bloqueio_entre_espacos() from public, anon, authenticated;

-- ──────────────────────────────────────────────
-- 4) Disponibilidade: o dia também fica ocupado por bloqueio
-- ──────────────────────────────────────────────
-- Contrato inalterado: (espaco_id, data, ocupado), uma linha por espaço e data. O dia de um espaço
-- cujo parceiro direto tem reserva PENDENTE/APROVADA volta como ocupado, IGUAL a um dia ocupado no
-- próprio espaço: nada de motivo, nome do espaço que bloqueou, unidade, status ou id de reserva.
-- Mantém perfil válido, recusa provisório, janela limitada e revoke de public/anon.
create or replace function public.disponibilidade_reservas(inicio date, fim date)
returns table (espaco_id text, data date, ocupado boolean)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if not public.tem_perfil() or public.is_cadastro_provisorio() then
    return;
  end if;

  if inicio is null or fim is null or fim < inicio then
    raise exception 'periodo_invalido' using errcode = '22023';
  end if;
  if inicio < v_hoje - 31 or fim > v_hoje + 366 or fim - inicio > 186 then
    raise exception 'periodo_fora_da_janela' using errcode = '22023';
  end if;

  return query
    select x.e, x.d, true
    from (
      -- Ocupado no próprio espaço.
      select r.espaco_id as e, r.data as d
      from public.reservations r
      where r.espaco_id is not null
        and r.status in ('PENDENTE', 'APROVADA')
        and r.data between inicio and fim
      union
      -- Ocupado porque um parceiro DIRETO tem reserva no dia (sem cadeia).
      select case when b.espaco_a = r.espaco_id then b.espaco_b else b.espaco_a end, r.data
      from public.reservations r
      join public.space_blocks b on b.espaco_a = r.espaco_id or b.espaco_b = r.espaco_id
      where r.espaco_id is not null
        and r.status in ('PENDENTE', 'APROVADA')
        and r.data between inicio and fim
    ) x
    group by x.e, x.d;
end;
$$;

revoke all on function public.disponibilidade_reservas(date, date) from public, anon;
grant execute on function public.disponibilidade_reservas(date, date) to authenticated;
