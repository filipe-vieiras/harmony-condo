-- vehicles_read estava como "true" — qualquer morador logado conseguia ver
-- os veículos (placa, telefone, nome do proprietário) de TODAS as unidades,
-- não só a própria. Mesma classe de vazamento de dados pessoais (LGPD) já
-- corrigida antes na tela de Moradores. Equipe (Síndico/ADM/Portaria/
-- Conselho) continua vendo tudo — precisam pra controle de acesso/garagem.
drop policy if exists "vehicles_read" on public.vehicles;
create policy "vehicles_read"
  on public.vehicles for select
  using (
    (get_user_role() = ANY (ARRAY['SINDICO'::text, 'ADM'::text, 'PORTARIA'::text, 'CONSELHO'::text]))
    or (
      bloco = (select profiles.bloco from profiles where profiles.id = auth.uid())
      and unidade = (select profiles.unidade from profiles where profiles.id = auth.uid())
    )
  );
