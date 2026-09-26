-- Harmony Residence — estrutura completa do banco (schema public), SEM dados.
--
-- Gerado com pg_dump a partir de PRODUÇÃO em 2026-09-26, já com as migrações
-- 0001–0027 aplicadas. As tabelas originais foram criadas pelo painel do
-- Supabase e não estavam em nenhuma migração; este arquivo é o ponto de
-- partida para montar um banco novo (staging, outro condomínio):
--
--   1. Criar o projeto no Supabase (Data API ligada, "Automatically expose new
--      tables" ligado, RLS automático desligado — igual a produção).
--   2. Rodar este arquivo inteiro no banco novo.
--   3. Rodar só as migrações com número MAIOR que 0027 que existirem.
--
-- Removido do dump original: CREATE SCHEMA public e ALTER DEFAULT PRIVILEGES
-- (o Supabase já cria os dois em todo projeto novo).

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--



--
-- Name: can_manage_reservations(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_manage_reservations() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('SINDICO', 'SUBSINDICO', 'ADM', 'PORTARIA')
  );
$$;


--
-- Name: diretorio_unidades(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.diretorio_unidades() RETURNS TABLE(bloco text, numero text, responsavel text, situacao text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with base as (
    select
      u.id,
      u.bloco,
      u.numero,
      coalesce(
        (select m->>'nome' from jsonb_array_elements(coalesce(u.moradores, '[]'::jsonb)) m
          where m->>'tipo' in ('TITULAR', 'INQUILINO') limit 1),
        coalesce(u.moradores, '[]'::jsonb)->0->>'nome',
        nullif(u.proprietario_nome, '')
      ) as responsavel
    from public.units u
  )
  select * from (
    select b.bloco, b.numero, b.responsavel, 'VALIDADO'::text as situacao
    from base b
    where b.responsavel is not null
    union all
    select b.bloco, b.numero, a.nome, 'AGUARDANDO_VALIDACAO'::text
    from public.autocadastros a
    join base b on b.id = a.unit_id
    where a.status = 'AGUARDANDO'
    union all
    select b.bloco, b.numero, null::text, 'SEM_CADASTRO'::text
    from base b
    where b.responsavel is null
      and not exists (
        select 1 from public.autocadastros a
        where a.unit_id = b.id and a.status = 'AGUARDANDO'
      )
  ) d
  where auth.uid() is not null
  order by d.bloco, d.numero, d.situacao;
$$;


--
-- Name: fines_guard_morador_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fines_guard_morador_update() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  if public.get_user_role() is distinct from 'MORADOR' then
    return new;
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


--
-- Name: get_my_unit_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_unit_id() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select id from public.units where usuario_id = auth.uid() limit 1;
$$;


--
-- Name: get_user_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_role() RETURNS text
    LANGUAGE sql SECURITY DEFINER
    AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;


--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('SINDICO', 'SUBSINDICO', 'ADM')
  );
$$;


--
-- Name: is_cadastro_provisorio(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_cadastro_provisorio() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and cadastro_validado = false
  );
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id text DEFAULT gen_random_uuid() NOT NULL,
    usuario_id uuid,
    usuario_nome text NOT NULL,
    usuario_role text NOT NULL,
    acao text NOT NULL,
    modulo text NOT NULL,
    detalhes jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: autocadastro_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.autocadastro_config (
    id integer DEFAULT 1 NOT NULL,
    aberto boolean DEFAULT false NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT autocadastro_config_singleton CHECK ((id = 1))
);


--
-- Name: autocadastros; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.autocadastros (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    unit_id text NOT NULL,
    user_id uuid,
    nome text NOT NULL,
    email text NOT NULL,
    telefone text NOT NULL,
    rg_cpf text,
    tipo text NOT NULL,
    dependentes jsonb DEFAULT '[]'::jsonb NOT NULL,
    veiculos jsonb DEFAULT '[]'::jsonb NOT NULL,
    status text DEFAULT 'AGUARDANDO'::text NOT NULL,
    motivo_recusa text,
    origem_ip_hash text,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    validado_em timestamp with time zone,
    validado_por text,
    CONSTRAINT autocadastros_status_check CHECK ((status = ANY (ARRAY['AGUARDANDO'::text, 'VALIDADO'::text, 'RECUSADO'::text]))),
    CONSTRAINT autocadastros_tipo_check CHECK ((tipo = ANY (ARRAY['PROPRIETARIO'::text, 'INQUILINO'::text])))
);


--
-- Name: document_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_links (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    titulo text NOT NULL,
    descricao text NOT NULL,
    categoria text NOT NULL,
    arquivo_nome text,
    tamanho_arquivo text,
    link_externo text,
    telefone text,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT document_links_categoria_check CHECK ((categoria = ANY (ARRAY['REGIMENTO'::text, 'CONVENCAO'::text, 'ATA'::text, 'FINANCEIRO'::text, 'EMERGENCIA'::text])))
);


--
-- Name: documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documents (
    id text DEFAULT gen_random_uuid() NOT NULL,
    titulo text NOT NULL,
    descricao text NOT NULL,
    categoria text NOT NULL,
    link_externo text NOT NULL,
    arquivo_nome text,
    tamanho_arquivo text,
    telefone text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: fines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fines (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    numero_protocolo text NOT NULL,
    bloco text NOT NULL,
    unidade text NOT NULL,
    morador_nome text NOT NULL,
    data_infracao date NOT NULL,
    prazo_recurso_data date NOT NULL,
    artigo_regimento text NOT NULL,
    descricao_infracao text NOT NULL,
    valor numeric(10,2) DEFAULT 0 NOT NULL,
    tipo text NOT NULL,
    status text DEFAULT 'PENDENTE_CIENCIA'::text NOT NULL,
    ciencia_data timestamp with time zone,
    ciencia_usuario_nome text,
    recurso_data timestamp with time zone,
    recurso_texto text,
    recurso_status text,
    recurso_resposta text,
    recurso_data_resposta timestamp with time zone,
    recurso_analisado_por text,
    created_at timestamp with time zone DEFAULT now(),
    unit_id text,
    recurso_anexo_nome text,
    CONSTRAINT fines_status_check CHECK ((status = ANY (ARRAY['PENDENTE_CIENCIA'::text, 'CIENCIA_REGISTRADA'::text, 'EM_RECURSO'::text, 'RECURSO_DEFERIDO'::text, 'RECURSO_INDEFERIDO'::text, 'CONCLUIDA'::text]))),
    CONSTRAINT fines_tipo_check CHECK ((tipo = ANY (ARRAY['ADVERTENCIA'::text, 'MULTA'::text])))
);


--
-- Name: notices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notices (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    titulo text NOT NULL,
    conteudo text NOT NULL,
    categoria text NOT NULL,
    autor text NOT NULL,
    fixado boolean DEFAULT false,
    anexo_nome text,
    anexo_url text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT notices_categoria_check CHECK ((categoria = ANY (ARRAY['URGENTE'::text, 'MANUTENCAO'::text, 'ASSEMBLEIA'::text, 'COMUNICADO'::text])))
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    titulo text NOT NULL,
    mensagem text NOT NULL,
    tipo text DEFAULT 'GERAL'::text NOT NULL,
    lida boolean DEFAULT false,
    unidade_alvo text,
    perfil_alvo text,
    link_destino text,
    created_at timestamp with time zone DEFAULT now(),
    unidade_id_alvo text,
    CONSTRAINT notifications_tipo_check CHECK ((tipo = ANY (ARRAY['AVISO'::text, 'MULTA'::text, 'RESERVA'::text, 'GERAL'::text])))
);


--
-- Name: pending_invites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pending_invites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    email text NOT NULL,
    role text NOT NULL,
    bloco text,
    unidade text,
    unit_id text,
    status text DEFAULT 'PENDENTE'::text NOT NULL,
    erro_mensagem text,
    criado_por text,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    enviado_em timestamp with time zone,
    link_acesso text,
    CONSTRAINT pending_invites_role_check CHECK ((role = ANY (ARRAY['SINDICO'::text, 'SUBSINDICO'::text, 'ADM'::text, 'PORTARIA'::text, 'CONSELHO'::text, 'MORADOR'::text]))),
    CONSTRAINT pending_invites_status_check CHECK ((status = ANY (ARRAY['PENDENTE'::text, 'ENVIADO'::text, 'ERRO'::text])))
);


--
-- Name: portal_administradora; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.portal_administradora (
    id integer DEFAULT 1 NOT NULL,
    descricao text DEFAULT 'Emissão de 2ª via de boletos de condomínio e demonstrativos de despesas.'::text NOT NULL,
    link_externo text DEFAULT ''::text NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT portal_administradora_singleton CHECK ((id = 1))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    name text NOT NULL,
    role text NOT NULL,
    cargo text,
    bloco text,
    unidade text,
    telefone text,
    created_at timestamp with time zone DEFAULT now(),
    email text,
    cadastro_validado boolean DEFAULT true NOT NULL,
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['SINDICO'::text, 'SUBSINDICO'::text, 'ADM'::text, 'PORTARIA'::text, 'CONSELHO'::text, 'MORADOR'::text])))
);


--
-- Name: reservations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reservations (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    espaco_id text,
    espaco_nome text NOT NULL,
    bloco text NOT NULL,
    unidade text NOT NULL,
    morador_nome text NOT NULL,
    data date NOT NULL,
    horario_inicio time without time zone NOT NULL,
    horario_fim time without time zone NOT NULL,
    convidados_estimados integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'PENDENTE'::text NOT NULL,
    motivo_recusa text,
    avaliado_por text,
    data_avaliacao timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT reservations_status_check CHECK ((status = ANY (ARRAY['PENDENTE'::text, 'APROVADA'::text, 'RECUSADA'::text, 'CANCELADA'::text])))
);


--
-- Name: spaces; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.spaces (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    nome text NOT NULL,
    descricao text NOT NULL,
    capacidade_max integer NOT NULL,
    horario_funcionamento text NOT NULL,
    taxa_limpeza numeric(10,2) DEFAULT 0 NOT NULL,
    regras text[] DEFAULT '{}'::text[],
    imagem_url text,
    ativo boolean DEFAULT true NOT NULL
);


--
-- Name: units; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.units (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    bloco text NOT NULL,
    numero text NOT NULL,
    proprietario_nome text NOT NULL,
    proprietario_telefone text NOT NULL,
    proprietario_email text NOT NULL,
    tipo_ocupacao text NOT NULL,
    vagas_garagem text[] DEFAULT '{}'::text[],
    animais text,
    observacoes text,
    created_at timestamp with time zone DEFAULT now(),
    moradores jsonb DEFAULT '[]'::jsonb,
    status_convite text DEFAULT 'NAO_ENVIADO'::text NOT NULL,
    usuario_id uuid,
    CONSTRAINT units_status_convite_check CHECK ((status_convite = ANY (ARRAY['NAO_ENVIADO'::text, 'PENDENTE'::text, 'ENVIADO'::text, 'ATIVO'::text]))),
    CONSTRAINT units_tipo_ocupacao_check CHECK ((tipo_ocupacao = ANY (ARRAY['PROPRIETARIO'::text, 'INQUILINO'::text, 'DESOCUPADO'::text])))
);


--
-- Name: vehicles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vehicles (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    placa text NOT NULL,
    marca text NOT NULL,
    modelo text NOT NULL,
    cor text NOT NULL,
    bloco text NOT NULL,
    unidade text NOT NULL,
    vaga text NOT NULL,
    proprietario_nome text NOT NULL,
    telefone_contato text NOT NULL,
    status text DEFAULT 'ATIVO'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    unit_id text,
    CONSTRAINT vehicles_status_check CHECK ((status = ANY (ARRAY['ATIVO'::text, 'VISITANTE'::text])))
);


--
-- Name: zelador; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.zelador (
    id integer DEFAULT 1 NOT NULL,
    nome text DEFAULT ''::text NOT NULL,
    telefone text DEFAULT ''::text NOT NULL,
    horario_atendimento text DEFAULT ''::text NOT NULL,
    observacoes text,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT zelador_singleton CHECK ((id = 1))
);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: autocadastro_config autocadastro_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autocadastro_config
    ADD CONSTRAINT autocadastro_config_pkey PRIMARY KEY (id);


--
-- Name: autocadastros autocadastros_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autocadastros
    ADD CONSTRAINT autocadastros_pkey PRIMARY KEY (id);


--
-- Name: document_links document_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_links
    ADD CONSTRAINT document_links_pkey PRIMARY KEY (id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: fines fines_numero_protocolo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fines
    ADD CONSTRAINT fines_numero_protocolo_key UNIQUE (numero_protocolo);


--
-- Name: fines fines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fines
    ADD CONSTRAINT fines_pkey PRIMARY KEY (id);


--
-- Name: notices notices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notices
    ADD CONSTRAINT notices_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: pending_invites pending_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_invites
    ADD CONSTRAINT pending_invites_pkey PRIMARY KEY (id);


--
-- Name: portal_administradora portal_administradora_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portal_administradora
    ADD CONSTRAINT portal_administradora_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: reservations reservations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT reservations_pkey PRIMARY KEY (id);


--
-- Name: spaces spaces_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spaces
    ADD CONSTRAINT spaces_pkey PRIMARY KEY (id);


--
-- Name: units units_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_pkey PRIMARY KEY (id);


--
-- Name: vehicles vehicles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_pkey PRIMARY KEY (id);


--
-- Name: vehicles vehicles_placa_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_placa_key UNIQUE (placa);


--
-- Name: zelador zelador_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zelador
    ADD CONSTRAINT zelador_pkey PRIMARY KEY (id);


--
-- Name: autocadastros_ip_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX autocadastros_ip_idx ON public.autocadastros USING btree (origem_ip_hash, criado_em);


--
-- Name: autocadastros_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX autocadastros_status_idx ON public.autocadastros USING btree (status);


--
-- Name: autocadastros_unit_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX autocadastros_unit_idx ON public.autocadastros USING btree (unit_id);


--
-- Name: pending_invites_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pending_invites_status_idx ON public.pending_invites USING btree (status);


--
-- Name: profiles_singleton_sindico; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX profiles_singleton_sindico ON public.profiles USING btree (role) WHERE (role = 'SINDICO'::text);


--
-- Name: profiles_singleton_subsindico; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX profiles_singleton_subsindico ON public.profiles USING btree (role) WHERE (role = 'SUBSINDICO'::text);


--
-- Name: units_bloco_numero_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX units_bloco_numero_key ON public.units USING btree (bloco, numero);


--
-- Name: fines fines_guard_morador_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER fines_guard_morador_update BEFORE UPDATE ON public.fines FOR EACH ROW EXECUTE FUNCTION public.fines_guard_morador_update();


--
-- Name: audit_logs audit_logs_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: autocadastros autocadastros_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autocadastros
    ADD CONSTRAINT autocadastros_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE CASCADE;


--
-- Name: autocadastros autocadastros_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.autocadastros
    ADD CONSTRAINT autocadastros_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: fines fines_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fines
    ADD CONSTRAINT fines_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE SET NULL;


--
-- Name: notifications notifications_unidade_id_alvo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_unidade_id_alvo_fkey FOREIGN KEY (unidade_id_alvo) REFERENCES public.units(id) ON DELETE SET NULL;


--
-- Name: pending_invites pending_invites_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_invites
    ADD CONSTRAINT pending_invites_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id);


--
-- Name: reservations reservations_espaco_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT reservations_espaco_id_fkey FOREIGN KEY (espaco_id) REFERENCES public.spaces(id) ON DELETE SET NULL;


--
-- Name: units units_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: vehicles vehicles_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE SET NULL;


--
-- Name: audit_logs Insercao de log para qualquer autenticado; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Insercao de log para qualquer autenticado" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: documents Leitura de documentos para autenticados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Leitura de documentos para autenticados" ON public.documents FOR SELECT TO authenticated USING (true);


--
-- Name: spaces Leitura de espacos para autenticados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Leitura de espacos para autenticados" ON public.spaces FOR SELECT TO authenticated USING (true);


--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs audit_logs_insert_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_logs_insert_authenticated ON public.audit_logs FOR INSERT WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: audit_logs audit_logs_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_logs_read ON public.audit_logs FOR SELECT USING ((public.get_user_role() = ANY (ARRAY['SINDICO'::text, 'SUBSINDICO'::text, 'ADM'::text, 'CONSELHO'::text])));


--
-- Name: autocadastro_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.autocadastro_config ENABLE ROW LEVEL SECURITY;

--
-- Name: autocadastro_config autocadastro_config_select_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY autocadastro_config_select_authenticated ON public.autocadastro_config FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: autocadastro_config autocadastro_config_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY autocadastro_config_update_admin ON public.autocadastro_config FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: autocadastros; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.autocadastros ENABLE ROW LEVEL SECURITY;

--
-- Name: autocadastros autocadastros_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY autocadastros_select ON public.autocadastros FOR SELECT USING ((public.is_admin() OR (user_id = auth.uid())));


--
-- Name: document_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_links ENABLE ROW LEVEL SECURITY;

--
-- Name: documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

--
-- Name: documents documents_write_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY documents_write_staff ON public.documents USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: fines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fines ENABLE ROW LEVEL SECURITY;

--
-- Name: fines fines_block_provisorio; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fines_block_provisorio ON public.fines AS RESTRICTIVE USING ((NOT public.is_cadastro_provisorio())) WITH CHECK ((NOT public.is_cadastro_provisorio()));


--
-- Name: fines fines_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fines_delete_admin ON public.fines FOR DELETE USING (public.is_admin());


--
-- Name: fines fines_insert_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fines_insert_staff ON public.fines FOR INSERT WITH CHECK (public.is_admin());


--
-- Name: fines fines_read_morador; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fines_read_morador ON public.fines FOR SELECT USING (((public.get_user_role() = 'MORADOR'::text) AND (unit_id = public.get_my_unit_id())));


--
-- Name: fines fines_read_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fines_read_staff ON public.fines FOR SELECT USING ((public.get_user_role() = ANY (ARRAY['SINDICO'::text, 'SUBSINDICO'::text, 'ADM'::text, 'CONSELHO'::text])));


--
-- Name: fines fines_update_morador_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fines_update_morador_own ON public.fines FOR UPDATE USING (((public.get_user_role() = 'MORADOR'::text) AND (unit_id = public.get_my_unit_id()))) WITH CHECK (((public.get_user_role() = 'MORADOR'::text) AND (unit_id = public.get_my_unit_id())));


--
-- Name: fines fines_update_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fines_update_staff ON public.fines FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: notices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;

--
-- Name: notices notices_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notices_read ON public.notices FOR SELECT TO authenticated USING (true);


--
-- Name: notices notices_write_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notices_write_staff ON public.notices USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications notifications_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_insert ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: notifications notifications_mark_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_mark_read ON public.notifications FOR UPDATE USING ((auth.uid() IS NOT NULL)) WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: notifications notifications_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_read ON public.notifications FOR SELECT USING ((public.is_admin() OR (((perfil_alvo IS NULL) OR (perfil_alvo = public.get_user_role())) AND (((unidade_id_alvo IS NULL) AND (unidade_alvo IS NULL)) OR (EXISTS ( SELECT 1
   FROM public.units u
  WHERE ((u.id = notifications.unidade_id_alvo) AND (u.usuario_id = auth.uid())))) OR ((unidade_id_alvo IS NULL) AND (unidade_alvo = ( SELECT p.unidade
   FROM public.profiles p
  WHERE (p.id = auth.uid()))))))));


--
-- Name: pending_invites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pending_invites ENABLE ROW LEVEL SECURITY;

--
-- Name: pending_invites pending_invites_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pending_invites_delete_admin ON public.pending_invites FOR DELETE USING (public.is_admin());


--
-- Name: pending_invites pending_invites_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pending_invites_insert_admin ON public.pending_invites FOR INSERT WITH CHECK (public.is_admin());


--
-- Name: pending_invites pending_invites_select_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pending_invites_select_admin ON public.pending_invites FOR SELECT USING (public.is_admin());


--
-- Name: pending_invites pending_invites_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pending_invites_update_admin ON public.pending_invites FOR UPDATE USING (public.is_admin());


--
-- Name: portal_administradora; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.portal_administradora ENABLE ROW LEVEL SECURITY;

--
-- Name: portal_administradora portal_administradora_select_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY portal_administradora_select_authenticated ON public.portal_administradora FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: portal_administradora portal_administradora_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY portal_administradora_update_admin ON public.portal_administradora FOR UPDATE USING (public.is_admin());


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_select_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_select_admin ON public.profiles FOR SELECT USING (public.is_admin());


--
-- Name: profiles profiles_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_self ON public.profiles USING ((auth.uid() = id));


--
-- Name: profiles profiles_sindico; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_sindico ON public.profiles FOR SELECT USING ((public.get_user_role() = 'SINDICO'::text));


--
-- Name: reservations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

--
-- Name: reservations reservations_block_provisorio; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reservations_block_provisorio ON public.reservations AS RESTRICTIVE USING ((NOT public.is_cadastro_provisorio())) WITH CHECK ((NOT public.is_cadastro_provisorio()));


--
-- Name: reservations reservations_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reservations_delete_admin ON public.reservations FOR DELETE USING (public.is_admin());


--
-- Name: reservations reservations_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reservations_insert ON public.reservations FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: reservations reservations_insert_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reservations_insert_staff ON public.reservations FOR INSERT WITH CHECK (public.can_manage_reservations());


--
-- Name: reservations reservations_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reservations_read ON public.reservations FOR SELECT USING (((public.get_user_role() = ANY (ARRAY['SINDICO'::text, 'SUBSINDICO'::text, 'ADM'::text, 'CONSELHO'::text, 'PORTARIA'::text])) OR (unidade = ( SELECT profiles.unidade
   FROM public.profiles
  WHERE (profiles.id = auth.uid())))));


--
-- Name: reservations reservations_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reservations_update_admin ON public.reservations FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: spaces; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.spaces ENABLE ROW LEVEL SECURITY;

--
-- Name: spaces spaces_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY spaces_read ON public.spaces FOR SELECT TO authenticated USING (true);


--
-- Name: spaces spaces_write_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY spaces_write_staff ON public.spaces USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: units; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

--
-- Name: units units_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY units_read ON public.units FOR SELECT USING (((public.get_user_role() = ANY (ARRAY['SINDICO'::text, 'SUBSINDICO'::text, 'ADM'::text, 'PORTARIA'::text, 'CONSELHO'::text])) OR (usuario_id = auth.uid())));


--
-- Name: units units_write_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY units_write_admin ON public.units USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: vehicles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

--
-- Name: vehicles vehicles_block_provisorio; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY vehicles_block_provisorio ON public.vehicles AS RESTRICTIVE USING ((NOT public.is_cadastro_provisorio())) WITH CHECK ((NOT public.is_cadastro_provisorio()));


--
-- Name: vehicles vehicles_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY vehicles_delete ON public.vehicles FOR DELETE USING (((public.get_user_role() = ANY (ARRAY['SINDICO'::text, 'SUBSINDICO'::text, 'ADM'::text, 'PORTARIA'::text])) OR (unit_id = public.get_my_unit_id())));


--
-- Name: vehicles vehicles_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY vehicles_read ON public.vehicles FOR SELECT USING (((public.get_user_role() = ANY (ARRAY['SINDICO'::text, 'SUBSINDICO'::text, 'ADM'::text, 'PORTARIA'::text, 'CONSELHO'::text])) OR (unit_id = public.get_my_unit_id())));


--
-- Name: vehicles vehicles_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY vehicles_update_admin ON public.vehicles FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: vehicles vehicles_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY vehicles_write ON public.vehicles FOR INSERT WITH CHECK ((public.get_user_role() = ANY (ARRAY['SINDICO'::text, 'SUBSINDICO'::text, 'ADM'::text, 'PORTARIA'::text, 'MORADOR'::text])));


--
-- Name: zelador; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.zelador ENABLE ROW LEVEL SECURITY;

--
-- Name: zelador zelador_select_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY zelador_select_authenticated ON public.zelador FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: zelador zelador_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY zelador_update_admin ON public.zelador FOR UPDATE USING (public.is_admin());


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION can_manage_reservations(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.can_manage_reservations() TO anon;
GRANT ALL ON FUNCTION public.can_manage_reservations() TO authenticated;
GRANT ALL ON FUNCTION public.can_manage_reservations() TO service_role;


--
-- Name: FUNCTION diretorio_unidades(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.diretorio_unidades() FROM PUBLIC;
GRANT ALL ON FUNCTION public.diretorio_unidades() TO authenticated;
GRANT ALL ON FUNCTION public.diretorio_unidades() TO service_role;


--
-- Name: FUNCTION fines_guard_morador_update(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fines_guard_morador_update() TO anon;
GRANT ALL ON FUNCTION public.fines_guard_morador_update() TO authenticated;
GRANT ALL ON FUNCTION public.fines_guard_morador_update() TO service_role;


--
-- Name: FUNCTION get_my_unit_id(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_my_unit_id() TO anon;
GRANT ALL ON FUNCTION public.get_my_unit_id() TO authenticated;
GRANT ALL ON FUNCTION public.get_my_unit_id() TO service_role;


--
-- Name: FUNCTION get_user_role(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_user_role() TO anon;
GRANT ALL ON FUNCTION public.get_user_role() TO authenticated;
GRANT ALL ON FUNCTION public.get_user_role() TO service_role;


--
-- Name: FUNCTION is_admin(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_admin() TO anon;
GRANT ALL ON FUNCTION public.is_admin() TO authenticated;
GRANT ALL ON FUNCTION public.is_admin() TO service_role;


--
-- Name: FUNCTION is_cadastro_provisorio(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_cadastro_provisorio() TO anon;
GRANT ALL ON FUNCTION public.is_cadastro_provisorio() TO authenticated;
GRANT ALL ON FUNCTION public.is_cadastro_provisorio() TO service_role;


--
-- Name: TABLE audit_logs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.audit_logs TO anon;
GRANT ALL ON TABLE public.audit_logs TO authenticated;
GRANT ALL ON TABLE public.audit_logs TO service_role;


--
-- Name: TABLE autocadastro_config; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.autocadastro_config TO anon;
GRANT ALL ON TABLE public.autocadastro_config TO authenticated;
GRANT ALL ON TABLE public.autocadastro_config TO service_role;


--
-- Name: TABLE autocadastros; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.autocadastros TO anon;
GRANT ALL ON TABLE public.autocadastros TO authenticated;
GRANT ALL ON TABLE public.autocadastros TO service_role;


--
-- Name: TABLE document_links; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.document_links TO anon;
GRANT ALL ON TABLE public.document_links TO authenticated;
GRANT ALL ON TABLE public.document_links TO service_role;


--
-- Name: TABLE documents; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.documents TO anon;
GRANT ALL ON TABLE public.documents TO authenticated;
GRANT ALL ON TABLE public.documents TO service_role;


--
-- Name: TABLE fines; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.fines TO anon;
GRANT ALL ON TABLE public.fines TO authenticated;
GRANT ALL ON TABLE public.fines TO service_role;


--
-- Name: TABLE notices; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.notices TO anon;
GRANT ALL ON TABLE public.notices TO authenticated;
GRANT ALL ON TABLE public.notices TO service_role;


--
-- Name: TABLE notifications; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.notifications TO anon;
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.notifications TO authenticated;
GRANT ALL ON TABLE public.notifications TO service_role;


--
-- Name: COLUMN notifications.lida; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(lida) ON TABLE public.notifications TO authenticated;


--
-- Name: TABLE pending_invites; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.pending_invites TO anon;
GRANT ALL ON TABLE public.pending_invites TO authenticated;
GRANT ALL ON TABLE public.pending_invites TO service_role;


--
-- Name: TABLE portal_administradora; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.portal_administradora TO anon;
GRANT ALL ON TABLE public.portal_administradora TO authenticated;
GRANT ALL ON TABLE public.portal_administradora TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.profiles TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: TABLE reservations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.reservations TO anon;
GRANT ALL ON TABLE public.reservations TO authenticated;
GRANT ALL ON TABLE public.reservations TO service_role;


--
-- Name: TABLE spaces; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.spaces TO anon;
GRANT ALL ON TABLE public.spaces TO authenticated;
GRANT ALL ON TABLE public.spaces TO service_role;


--
-- Name: TABLE units; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.units TO anon;
GRANT ALL ON TABLE public.units TO authenticated;
GRANT ALL ON TABLE public.units TO service_role;


--
-- Name: TABLE vehicles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.vehicles TO anon;
GRANT ALL ON TABLE public.vehicles TO authenticated;
GRANT ALL ON TABLE public.vehicles TO service_role;


--
-- Name: TABLE zelador; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.zelador TO anon;
GRANT ALL ON TABLE public.zelador TO authenticated;
GRANT ALL ON TABLE public.zelador TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- PostgreSQL database dump complete
--



-- ──────────────────────────────────────────────
-- Permissões restritas. Num projeto novo, o "Automatically expose new tables"
-- dá ALL a anon/authenticated em toda tabela e função criada acima — e o
-- pg_dump não gera REVOKE para isso. Sem este bloco o banco novo reabre a
-- escalada de privilégio corrigida na 0027. Idêntico a produção.
-- ──────────────────────────────────────────────

revoke all on function public.diretorio_unidades() from public, anon;
grant execute on function public.diretorio_unidades() to authenticated;

revoke insert, update, delete on public.profiles from anon, authenticated;

revoke update on public.notifications from anon, authenticated;
grant update (lida) on public.notifications to authenticated;
