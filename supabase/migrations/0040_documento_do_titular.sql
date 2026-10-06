-- Harmony — documento (RG/CPF) do morador fora do alcance de Portaria e Conselho (issue #67).
--
-- Problema: o documento ficava DENTRO do JSON units.moradores[].rgCpf. A policy units_read
-- (0025) devolve a linha inteira da unidade a Síndico, Subsíndico, ADM, Portaria e Conselho;
-- então Portaria e Conselho, que só precisam de telefone, e-mail e responsável, recebiam
-- também o documento (princípio da necessidade, LGPD).
--
-- Decisão do dono (06/10/2026): Portaria e Conselho (e o futuro Zelador) continuam lendo
-- telefone, e-mail e responsável. Quem lê o documento: Síndico, Subsíndico, ADM e o próprio
-- morador da unidade. Ninguém mais.
--
-- O que esta migração faz:
--   1) Cria public.unit_documentos (unit_id + morador_id → documento), com RLS:
--        • leitura: gestão (is_admin()) OU morador (perfil MORADOR) da própria unidade;
--        • restritiva: morador provisório nunca lê;
--        • escrita: nenhuma policy e nenhum GRANT de escrita ao cliente. Só o servidor
--          (service role) e a função salvar_documentos_unidade() (SECURITY DEFINER, só gestão).
--      O perfil CONSELHO/PORTARIA que também é titular de uma unidade NÃO lê o documento pelo
--      vínculo com a unidade: a leitura própria exige o perfil MORADOR.
--   2) Dá um id estável a cada morador do JSON (units.moradores[].id), pois o morador não
--      tinha chave: é por ele que o documento é ligado a quem é.
--   3) MIGRA os dados existentes: copia cada rgCpf do JSON para a tabela nova e remove a chave
--      do JSON. Idempotente: na segunda execução não há mais rgCpf no JSON e nada se duplica.
--      A migração se recusa a terminar (e desfaz tudo) se sobrar rgCpf no JSON ou faltar
--      documento na tabela.
--   4) Gatilho em units: a partir de agora, qualquer escrita em units.moradores tira a chave
--      rgCpf e dá id a quem não tem. Mesmo um cliente antigo ou um erro de código não
--      reabre a exposição.
--
-- COMO CONFERIR A CONTAGEM (antes e depois; rode no SQL Editor do projeto alvo):
--   ANTES (documentos que estão no JSON e serão migrados):
--     select count(*) from public.units u, jsonb_array_elements(u.moradores) m
--      where jsonb_typeof(u.moradores) = 'array' and jsonb_typeof(m) = 'object'
--        and nullif(btrim(m->>'rgCpf'), '') is not null;
--   DEPOIS (o JSON deve dar 0 e a tabela deve ter o mesmo número que o "antes"):
--     select count(*) from public.units u, jsonb_array_elements(u.moradores) m
--      where jsonb_typeof(u.moradores) = 'array' and jsonb_typeof(m) = 'object' and m ? 'rgCpf';
--     select count(*) from public.unit_documentos;
--   A migração também imprime "documentos migrados: N" (aviso do Postgres) e aborta se os
--   números não fecharem.
--
-- Migração aditiva e idempotente (a estrutura nova só é criada se não existir; o JSON só é
-- alterado onde ainda há rgCpf ou morador sem id).

-- ──────────────────────────────────────────────
-- 1) Tabela e RLS
-- ──────────────────────────────────────────────
create table if not exists public.unit_documentos (
  unit_id text not null references public.units (id) on delete cascade,
  morador_id text not null,
  documento text not null check (length(btrim(documento)) between 1 and 60),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  primary key (unit_id, morador_id)
);

alter table public.unit_documentos enable row level security;

-- O Supabase dá ALL a anon e authenticated em tabela nova: tira tudo e devolve só a leitura.
revoke all on table public.unit_documentos from public, anon, authenticated;
grant select on table public.unit_documentos to authenticated;
grant all on table public.unit_documentos to service_role;

drop policy if exists "unit_documentos_select" on public.unit_documentos;
create policy "unit_documentos_select"
  on public.unit_documentos for select
  to authenticated
  using (
    public.is_admin()
    or (public.get_user_role() = 'MORADOR' and unit_id = public.get_my_unit_id())
  );

-- Mesmo padrão de fines/vehicles (0026): restritiva, vale sobre qualquer policy permissiva.
drop policy if exists "unit_documentos_block_provisorio" on public.unit_documentos;
create policy "unit_documentos_block_provisorio"
  on public.unit_documentos as restrictive for select
  to authenticated
  using (not public.is_cadastro_provisorio());

-- ──────────────────────────────────────────────
-- 2) Migra os dados do JSON para a tabela (e dá id aos moradores)
-- ──────────────────────────────────────────────
do $$
declare
  u record;
  novo jsonb;
  antes integer;
  migrados integer := 0;
  restantes integer;
begin
  select count(*) into antes
    from public.units un, jsonb_array_elements(un.moradores) m
   where jsonb_typeof(un.moradores) = 'array' and jsonb_typeof(m) = 'object'
     and nullif(btrim(m->>'rgCpf'), '') is not null;

  for u in
    select un.id, un.moradores
      from public.units un
     where jsonb_typeof(un.moradores) = 'array'
       and exists (
         select 1 from jsonb_array_elements(un.moradores) m
          where jsonb_typeof(m) = 'object' and (m ? 'rgCpf' or coalesce(m->>'id', '') = '')
       )
  loop
    -- Um id por morador (mantém o que já tem), na mesma ordem.
    select coalesce(jsonb_agg(
             case when jsonb_typeof(t.m) = 'object' and coalesce(t.m->>'id', '') = ''
                  then t.m || jsonb_build_object('id', gen_random_uuid()::text)
                  else t.m end
             order by t.ord), '[]'::jsonb)
      into novo
      from jsonb_array_elements(u.moradores) with ordinality as t(m, ord);

    insert into public.unit_documentos (unit_id, morador_id, documento)
    select u.id, m->>'id', left(btrim(m->>'rgCpf'), 60)
      from jsonb_array_elements(novo) m
     where jsonb_typeof(m) = 'object' and nullif(btrim(m->>'rgCpf'), '') is not null
    on conflict (unit_id, morador_id) do nothing;
    get diagnostics restantes = row_count;
    migrados := migrados + restantes;

    update public.units
       set moradores = (
         select coalesce(jsonb_agg(case when jsonb_typeof(t.m) = 'object' then t.m - 'rgCpf' else t.m end order by t.ord), '[]'::jsonb)
           from jsonb_array_elements(novo) with ordinality as t(m, ord)
       )
     where id = u.id;
  end loop;

  select count(*) into restantes
    from public.units un, jsonb_array_elements(un.moradores) m
   where jsonb_typeof(un.moradores) = 'array' and jsonb_typeof(m) = 'object' and m ? 'rgCpf';

  raise notice 'documentos migrados: % (no JSON antes: %, rgCpf restante no JSON: %)', migrados, antes, restantes;

  if restantes <> 0 or migrados <> antes then
    raise exception 'Migração do documento do titular não fechou (antes %, migrados %, restantes %).', antes, migrados, restantes;
  end if;
end $$;

-- ──────────────────────────────────────────────
-- 3) Gatilho: o JSON de units nunca mais guarda documento e todo morador tem id
-- ──────────────────────────────────────────────
create or replace function public.units_normaliza_moradores()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.moradores is null or jsonb_typeof(new.moradores) <> 'array' then
    return new;
  end if;
  new.moradores := coalesce((
    select jsonb_agg(
             case when jsonb_typeof(t.m) = 'object'
                  then (t.m - 'rgCpf')
                       || case when coalesce(t.m->>'id', '') = ''
                               then jsonb_build_object('id', gen_random_uuid()::text)
                               else '{}'::jsonb end
                  else t.m end
             order by t.ord)
      from jsonb_array_elements(new.moradores) with ordinality as t(m, ord)
  ), '[]'::jsonb);
  return new;
end $$;

drop trigger if exists units_normaliza_moradores on public.units;
create trigger units_normaliza_moradores
  before insert or update of moradores on public.units
  for each row execute function public.units_normaliza_moradores();

-- ──────────────────────────────────────────────
-- 4) Gravação pela gestão (o cliente não escreve na tabela)
--    p_docs: {"<id do morador>": "<documento>"}; texto vazio apaga o documento daquele morador.
--    Morador que não aparece em p_docs não muda. p_manter: ids que continuam na unidade; os
--    documentos de quem saiu da unidade são apagados (não sobra documento de ex-morador).
-- ──────────────────────────────────────────────
create or replace function public.salvar_documentos_unidade(
  p_unit_id text,
  p_docs jsonb,
  p_manter text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  valor text;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Apenas Síndico, Subsíndico ou Administradora gravam o documento do morador.'
      using errcode = '42501';
  end if;
  if not exists (select 1 from public.units where id = p_unit_id) then
    raise exception 'Unidade não encontrada.' using errcode = 'P0002';
  end if;

  for r in select key, value from jsonb_each(coalesce(p_docs, '{}'::jsonb)) loop
    -- O morador precisa existir de fato nesta unidade (nada de documento solto).
    if not exists (
      select 1 from public.units un, jsonb_array_elements(un.moradores) m
       where un.id = p_unit_id and jsonb_typeof(un.moradores) = 'array' and m->>'id' = r.key
    ) then
      continue;
    end if;
    valor := left(btrim(coalesce(r.value #>> '{}', '')), 60);
    if valor = '' then
      delete from public.unit_documentos where unit_id = p_unit_id and morador_id = r.key;
    else
      insert into public.unit_documentos (unit_id, morador_id, documento)
      values (p_unit_id, r.key, valor)
      on conflict (unit_id, morador_id)
      do update set documento = excluded.documento, atualizado_em = now();
    end if;
  end loop;

  delete from public.unit_documentos
   where unit_id = p_unit_id and not (morador_id = any (coalesce(p_manter, '{}'::text[])));
end $$;

revoke all on function public.salvar_documentos_unidade(text, jsonb, text[]) from public, anon;
grant execute on function public.salvar_documentos_unidade(text, jsonb, text[]) to authenticated;
