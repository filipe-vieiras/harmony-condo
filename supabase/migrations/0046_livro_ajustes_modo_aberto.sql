-- Harmony — Livro de reclamações: ajustes de segurança antes de ligar o modo ABERTO (revisão de segurança, A1 e A6).
-- Aditiva e idempotente (CREATE OR REPLACE; os grants são refeitos).
--
-- A1) livro_definir_modo avisa no sino, com texto FIXO, Síndico, Subsíndico, ADM e Conselho quando o modo muda de fato.
--     Insere direto em notifications (e não por _livro_avisar): aquela função só avisa quem PODERIA ler o Livro no modo
--     novo, então a mudança para DESLIGADO não avisaria ninguém. Aqui o aviso é justamente sobre a mudança.
-- A6) O teto de 200 respostas por tópico passa a contar só as NÃO removidas (antes, o n_respostas contava as removidas e
--     um tópico podia "encher" de lixo já apagado). Novo teto: 20 respostas por autor no mesmo tópico (também só as não
--     removidas), para uma pessoa não ocupar sozinha o tópico.

create or replace function public.livro_definir_modo(p_modo text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_antes text;
  v_texto text;
begin
  if auth.uid() is null or public.get_user_role() not in ('SINDICO', 'ADM') then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  if p_modo is null or p_modo not in ('DESLIGADO', 'EQUIPE', 'ABERTO') then
    raise exception 'modo_invalido' using errcode = 'P0001';
  end if;
  -- Trava a linha: duas trocas ao mesmo tempo não avisam duas vezes nem gravam auditoria com "de" errado.
  select modo into v_antes from public.livro_config where id = 1 for update;
  if v_antes is distinct from p_modo then
    update public.livro_config set modo = p_modo, atualizado_em = now(), atualizado_por = auth.uid() where id = 1;
    perform public._livro_auditar('Alterou o modo do Livro de reclamações', jsonb_build_object('de', v_antes, 'para', p_modo));
    -- Texto fixo por modo: nada do que o chamador mandou entra na notificação.
    v_texto := case p_modo
      when 'ABERTO' then 'O Livro de reclamações foi aberto: moradores, Zelador e Portaria agora leem as mensagens. Quem não precisa agir: você não precisa fazer nada, é só para você saber.'
      when 'EQUIPE' then 'O Livro de reclamações passou para "Só a equipe": os moradores deixaram de ver. Quem não precisa agir: você não precisa fazer nada, é só para você saber.'
      else 'O Livro de reclamações foi desligado: ninguém acessa até ser ligado de novo. Quem não precisa agir: você não precisa fazer nada, é só para você saber.'
    end;
    insert into public.notifications (titulo, mensagem, tipo, usuario_id_alvo, link_destino)
    select 'Livro de reclamações: mudança de modo', v_texto, 'GERAL', p.id, '/livro'
      from public.profiles p
     where p.role in ('SINDICO', 'SUBSINDICO', 'ADM', 'CONSELHO') and p.desativado_em is null;
  end if;
  return jsonb_build_object('ok', true, 'modo', p_modo);
end $$;

-- Antes de gravar uma resposta: o pai precisa ser um tópico, não removido e com vaga.
-- Vale para qualquer caminho de escrita (inclusive o do service role).
create or replace function public.livro_msg_antes()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_pai public.livro_mensagens%rowtype;
begin
  if tg_op = 'INSERT' then
    if new.pai_id is not null then
      -- O "for update" serializa as respostas do mesmo tópico: as contagens abaixo não correm em paralelo.
      select * into v_pai from public.livro_mensagens where id = new.pai_id for update;
      if not found then raise exception 'topico_inexistente' using errcode = 'P0001'; end if;
      if v_pai.pai_id is not null then raise exception 'resposta_a_resposta' using errcode = 'P0001'; end if;
      if v_pai.removida_em is not null then raise exception 'topico_removido' using errcode = 'P0001'; end if;
      -- Só as não removidas contam (n_respostas conta todas, inclusive as removidas).
      if (select count(*) from public.livro_mensagens r where r.pai_id = new.pai_id and r.removida_em is null) >= 200 then
        raise exception 'topico_cheio' using errcode = 'P0001';
      end if;
      if new.autor_id is not null
         and (select count(*) from public.livro_mensagens r
               where r.pai_id = new.pai_id and r.autor_id = new.autor_id and r.removida_em is null) >= 20 then
        raise exception 'limite_respostas_autor' using errcode = 'P0001';
      end if;
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

-- Create or replace mantém os grants, mas refazemos por segurança (idempotente).
revoke all on function public.livro_definir_modo(text), public.livro_msg_antes() from public, anon, authenticated;
grant execute on function public.livro_definir_modo(text) to authenticated;
