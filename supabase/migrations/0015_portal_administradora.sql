-- PORTAL_ADMINISTRADORA: cadastro estruturado, singleton (mesmo padrão de
-- zelador). Antes esse card em Links & Documentos era 100% fixo no código
-- (até o link "https://google.com" era hardcoded) — agora é editável
-- pelo Síndico/ADM, sem opção de excluir (é um item fixo do sistema).
create table if not exists public.portal_administradora (
  id int primary key default 1,
  descricao text not null default 'Emissão de 2ª via de boletos de condomínio e demonstrativos de despesas.',
  link_externo text not null default '',
  atualizado_em timestamptz not null default now(),
  constraint portal_administradora_singleton check (id = 1)
);

insert into public.portal_administradora (id, descricao, link_externo)
values (1, 'Emissão de 2ª via de boletos de condomínio e demonstrativos de despesas.', '')
on conflict (id) do nothing;

alter table public.portal_administradora enable row level security;

drop policy if exists "portal_administradora_select_authenticated" on public.portal_administradora;
create policy "portal_administradora_select_authenticated"
  on public.portal_administradora for select
  using (auth.role() = 'authenticated');

drop policy if exists "portal_administradora_update_admin" on public.portal_administradora;
create policy "portal_administradora_update_admin"
  on public.portal_administradora for update
  using (public.is_admin());
