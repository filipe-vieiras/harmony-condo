-- Issue #56: o nome de um autocadastro AGUARDANDO (qualquer pessoa pode enviar, até para
-- unidade já validada) aparecia na Lista de Unidades de todos os moradores.
-- Agora o nome pendente só aparece para a gestão (is_admin). Para os demais, a unidade
-- mostra apenas o titular validado, ou "Sem cadastro" se ainda não houver; a fila do
-- síndico (tabela autocadastros, já restrita por RLS) continua exibindo o conflito.
-- Idempotente e aditiva: só recria a função, mesma assinatura e mesmos GRANTs.

create or replace function public.diretorio_unidades()
returns table (bloco text, numero text, responsavel text, situacao text)
language sql
security definer
set search_path = public
stable
as $$
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
  ),
  gestao as (select public.is_admin() as sim)
  select * from (
    select b.bloco, b.numero, b.responsavel, 'VALIDADO'::text as situacao
    from base b
    where b.responsavel is not null
    union all
    -- Nome pendente: só para a gestão.
    select b.bloco, b.numero, a.nome, 'AGUARDANDO_VALIDACAO'::text
    from public.autocadastros a
    join base b on b.id = a.unit_id
    where a.status = 'AGUARDANDO' and (select sim from gestao)
    union all
    select b.bloco, b.numero, null::text, 'SEM_CADASTRO'::text
    from base b
    where b.responsavel is null
      and (
        not (select sim from gestao)
        or not exists (
          select 1 from public.autocadastros a
          where a.unit_id = b.id and a.status = 'AGUARDANDO'
        )
      )
  ) d
  where public.tem_perfil()
  order by d.bloco, d.numero, d.situacao;
$$;

revoke all on function public.diretorio_unidades() from public, anon;
grant execute on function public.diretorio_unidades() to authenticated;
