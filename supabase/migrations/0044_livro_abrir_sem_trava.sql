-- Harmony — Livro de reclamações: "Aberto" passa a poder ser ligado pelo Síndico e pelo ADM, sem liberação externa.
-- Decisão do dono: sai a trava livro_config.liberado_para_abrir (0043). As regras de uso continuam: o morador as aceita
-- (ciência) antes de entrar. A coluna fica no banco, sem efeito, para não quebrar livro_acesso nem rollback.
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
  if v_antes is distinct from p_modo then
    update public.livro_config set modo = p_modo, atualizado_em = now(), atualizado_por = auth.uid() where id = 1;
    perform public._livro_auditar('Alterou o modo do Livro de reclamações', jsonb_build_object('de', v_antes, 'para', p_modo));
  end if;
  return jsonb_build_object('ok', true, 'modo', p_modo);
end $$;
