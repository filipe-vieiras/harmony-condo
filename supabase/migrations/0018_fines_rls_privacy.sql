-- A policy "fines_no_portaria" liberava SELECT em fines pra qualquer
-- usuário com role SINDICO, CONSELHO ou MORADOR, SEM nenhuma condição de
-- unidade — ou seja, qualquer morador logado conseguia consultar o
-- prontuário disciplinar de TODAS as unidades do condomínio direto pela
-- API, driblando a policy "fines_morador_own" que deveria restringir
-- (RLS é permissiva: basta uma policy liberar pra linha ficar visível).
-- Mesma classe do bug de veículos já corrigido nesta sessão, mas aqui
-- o dado é mais sensível (prontuário disciplinar, com aviso de LGPD
-- explícito na própria tela). Não havia nenhuma policy de INSERT/UPDATE
-- registrada — este migration substitui o conjunto por um completo e
-- explícito, alinhado ao que a tela de multas realmente faz.

alter table public.fines enable row level security;

-- Resolve a unidade do usuário logado via units.usuario_id (o vínculo
-- real e mantido pelo app) em vez de profiles.unit_id (existe no schema
-- mas nunca é escrito) ou profiles.bloco/unidade (texto solto, sujeito
-- a divergência). SECURITY DEFINER pra não ficar sujeita à RLS de units.
create or replace function public.get_my_unit_id()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select id from public.units where usuario_id = auth.uid() limit 1;
$$;

drop policy if exists "fines_morador_own" on public.fines;
drop policy if exists "fines_no_portaria" on public.fines;

-- Leitura: Síndico/ADM/Conselho veem tudo; Portaria não tem nenhuma
-- policy (fica de fora por padrão — reforça o bloqueio que já existe na tela).
create policy "fines_read_staff"
on public.fines for select
using (public.get_user_role() = ANY (ARRAY['SINDICO', 'ADM', 'CONSELHO']));

create policy "fines_read_morador"
on public.fines for select
using (public.get_user_role() = 'MORADOR' and unit_id = public.get_my_unit_id());

-- Escrita: só Síndico/ADM emitem e julgam recursos.
create policy "fines_insert_staff"
on public.fines for insert
with check (public.is_admin());

create policy "fines_update_staff"
on public.fines for update
using (public.is_admin())
with check (public.is_admin());

-- Morador só atualiza a própria multa (confirmar ciência / enviar recurso).
create policy "fines_update_morador_own"
on public.fines for update
using (public.get_user_role() = 'MORADOR' and unit_id = public.get_my_unit_id())
with check (public.get_user_role() = 'MORADOR' and unit_id = public.get_my_unit_id());
