-- Harmony Residence — privacidade (LGPD) e alertas da administração.
--
-- 1) UNITS: qualquer usuário logado lia pela API todas as unidades, com CPF,
--    telefone e e-mail de todos os moradores (a tela escondia, o banco não).
--    Equipe continua lendo tudo; o morador passa a ler só a própria unidade.
--
-- 2) NOTIFICATIONS: a leitura só entregava avisos com perfil_alvo = o próprio
--    perfil, então ADM e Subsíndico nunca recebiam "Nova Solicitação de
--    Reserva" / "Novo Recurso de Multa" (endereçados a SINDICO). E avisos
--    endereçados a uma unidade (ex: notificação disciplinar) eram lidos por
--    Portaria, Conselho e qualquer outro morador.
--
-- Policies de leitura antigas são descobertas e removidas dinamicamente: basta
-- uma permissiva sobrar para o vazamento continuar.

create or replace function public._drop_read_policies(p_table text)
returns void
language plpgsql
as $$
declare
  r record;
begin
  for r in
    select pol.polname
    from pg_policy pol
    join pg_class cls on cls.oid = pol.polrelid
    join pg_namespace nsp on nsp.oid = cls.relnamespace
    where nsp.nspname = 'public' and cls.relname = p_table and pol.polcmd = 'r'
  loop
    execute format('drop policy if exists %I on public.%I', r.polname, p_table);
  end loop;
end $$;

-- ──────────────────────────────────────────────
-- UNITS — units_write_admin (FOR ALL, 0023) continua valendo para admins
-- ──────────────────────────────────────────────

select public._drop_read_policies('units');

create policy "units_read"
  on public.units for select
  using (
    public.get_user_role() = any (array['SINDICO', 'SUBSINDICO', 'ADM', 'PORTARIA', 'CONSELHO'])
    or usuario_id = auth.uid()
  );

-- ──────────────────────────────────────────────
-- NOTIFICATIONS — admin vê tudo. Demais perfis: o aviso precisa ser para o
-- perfil deles (ou para todos) E para a unidade deles (ou para todas).
-- unidade_id_alvo é a referência confiável; unidade_alvo (texto) é fallback
-- para avisos antigos sem FK — mesma regra do filtro em AppContext.
-- ──────────────────────────────────────────────

select public._drop_read_policies('notifications');

create policy "notifications_read"
  on public.notifications for select
  using (
    public.is_admin()
    or (
      (perfil_alvo is null or perfil_alvo = public.get_user_role())
      and (
        (unidade_id_alvo is null and unidade_alvo is null)
        or exists (
          select 1 from public.units u
          where u.id = notifications.unidade_id_alvo and u.usuario_id = auth.uid()
        )
        or (
          unidade_id_alvo is null
          and unidade_alvo = (select p.unidade from public.profiles p where p.id = auth.uid())
        )
      )
    )
  );

drop function public._drop_read_policies(text);
