# QA: Zelador (#82) endurecimento e hierarquia (#68), migração 0042

Data: 06/10/2026 · Ambiente: staging (app local, contas `@staging.test`). Produção não foi tocada.
Perfis testados no navegador: Síndico, ADM, Subsíndico, Zelador, Conselho, Portaria, Morador, em desktop (1280x800) e celular (375px, Chromium emulado).
Também: chamadas diretas por API com a sessão de cada perfil, bateria `scripts/qa/bateria.mjs` e `scripts/qa/webkit-mobile.mjs`.

## Resultado

| Área | Resultado |
|---|---|
| Bateria `bateria.mjs` (inclui hierarquia e Z-01 a Z-09) | PASSOU (1149 verificações, "TUDO OK") |
| `webkit-mobile.mjs` | PASSOU ("TUDO OK") |
| Matriz de redefinir senha (7 executores x 7 alvos, por API) | PASSOU (49/49) |
| Excluir conta (recusas por nível, ADM, Síndico, si mesmo) | PASSOU |
| Convidar cargo acima / para ADM / Subsíndico convida só Portaria e Conselho (tela) | PASSOU |
| Link do convite lido só por Síndico e ADM (tabela `convite_links`, tela) | PASSOU na tabela e na tela; **FALHOU pela resposta da API (H-2)** |
| Escalada de nível | **FALHOU: H-1, Subsíndico vira Síndico** |
| Z-04, Z-02, Z-05, Z-06, aviso no sino, "Ver reservas futuras", L1 a L4 | PASSOU |
| 375px: todas as telas dos 7 perfis | PASSOU (sem rolagem horizontal, sem elemento fora da tela) |

## Bugs

### H-1 · BLOQUEIA (grave, escalada de privilégio) · Subsíndico assume o cargo de Síndico sequestrando a conta convidada de uma transferência
A pessoa convidada numa transferência de cargo para "Pessoa nova" existe no banco como `MORADOR` (nível 0) até aceitar. A regra de hierarquia deixa o Subsíndico (nível 3) gerar o link de redefinição de senha de um Morador. Ele usa o link, define a senha dessa conta e aceita a transferência pendente, ficando com o cargo.

Reproduzir (staging, só por API; o `esc2.mjs` do QA fez isso de ponta a ponta):
1. Síndico faz `POST /api/usuarios/transferir-cargo` com `{cargo:"SINDICO", origemId:<id do Síndico>, destino:{tipo:"NOVO", nome:"X", email:"qa.alvo@staging.test"}}` (200; a conta convidada nasce `MORADOR`, aguardando aceite).
2. Subsíndico faz `POST /api/usuarios/resetar-senha` com `{userId:<id da conta convidada>}`: **200 e devolve o link** (esperado: 403).
3. Com o link: `verifyOtp` (`token_hash`, tipo do link), `updateUser({password})`, depois `POST /api/usuarios/transferir-cargo/aceitar` com a sessão dessa conta: **200 `{aplicada:true, cargo:"SINDICO"}`**.
4. Resultado no banco: o convidado vira `SINDICO` e o Síndico original vira `MORADOR`.

O Subsíndico também apaga essa conta (`POST /api/usuarios/excluir` devolve 200) e a transferência pendente some, cancelando a decisão do Síndico. Na tela de Usuários o Subsíndico vê "Gerar link" e "Excluir acesso" na linha "Novo Porteiro (Cargo pendente)".
Mesma brecha vale para qualquer cargo em transferência pendente. Para o Zelador a conta pendente já é bloqueada (403), por ter perfil `ZELADOR` desativado, então o furo é só nas transferências por pessoa nova.
Sugestão: tratar conta com transferência pendente (convidada) pelo nível do cargo destino, ou recusar redefinir senha e excluir nela por quem não é Síndico/ADM.

### H-2 · Média · A resposta de "enviar convite" entrega o link ao Subsíndico
Regra pedida: só Síndico e ADM leem o link. A tela e a tabela `convite_links` respeitam (o Subsíndico vê "Link gerado" sem "Copiar Link"; leitura direta devolve 0 linhas; a auditoria também não tem link). Mas `POST /api/convites/enviar` chamado pelo Subsíndico devolve `results[].link` com o link completo (200). Quem chama a API consegue o link do convite que acabou de gerar.
Reproduzir: Subsíndico insere convite `PORTARIA` na fila e chama `/api/convites/enviar`; a resposta traz `link`.
Impacto limitado (o cargo convidado é de nível menor), mas contraria o objetivo declarado. Sugestão: não devolver `link` quando o executor for Subsíndico.

### H-3 · Leve · Convite da equipe aceita nome só com espaços
Subsíndico/Síndico em Usuários > Novo Usuário da Equipe: nome com "   " (só espaços) e e-mail válido criam o convite ("Convite adicionado à fila"), a linha aparece sem nome na fila e na equipe, e a auditoria grava "Cadastrou convite de acesso para     (PORTARIA)". Esperado: recusar nome vazio após remover espaços. (O campo vazio é barrado pelo navegador.)

### H-4 · Leve · Clique duplo em "enviar convite" por API dá mensagem técnica
Três chamadas simultâneas de `/api/convites/enviar` para o mesmo convite: uma gera o link e cria uma conta, as outras respondem "Database error saving new user" (200 com `ok:false`). Não há duplicidade nem estado quebrado (convite fica ENVIADO, 1 perfil, 1 link). Na tela o botão trava durante o envio, então só aparece por chamada direta.

### Observações
- **Divergência com o pedido, a confirmar:** o brief diz "Subsíndico só convida Portaria e Conselho". Na tela é assim (o seletor só mostra Portaria e Conselho Fiscal). Pela API/RLS o Subsíndico também cria e envia convite de `MORADOR` (a regra implementada é "nível estritamente menor"). Se Morador deve ficar de fora, ajustar `podeConvidarPara` e o espelho SQL.
- `POST /api/usuarios/resetar-senha` sem login responde 307 (redireciona ao login) em vez de 401. Não expõe nada.
- Concordância: o nome do contador e textos novos do diálogo de interdição estão corretos ("Interditar este espaço?", "Reabrir este espaço?").

## O que foi executado e passou

**Hierarquia por API (sessão de cada perfil).**
- Redefinir senha: ADM redefine Síndico, Subsíndico, Zelador, Conselho, Portaria e Morador (200), nunca outro ADM; Síndico redefine Subsíndico, Zelador, Conselho, Portaria, Morador; Subsíndico só Conselho, Portaria, Morador (403 em ADM, Síndico, Subsíndico, Zelador); Zelador, Conselho, Portaria e Morador recebem 403 em todos. Auditoria gravada pelo servidor e o titular de Síndico/ADM/Zelador é avisado no sino (bateria).
- Excluir: ninguém exclui ADM nem Síndico ("O Síndico não pode ser excluído por aqui...", "A conta da Administradora é gerida fora do aplicativo..."); ninguém exclui a si mesmo (400); Subsíndico não exclui Zelador (403 com mensagem própria); Zelador/Conselho/Portaria/Morador recebem 403.
- Convidar (inserir na fila + enviar): ninguém convida ADM (recusado por RLS); Síndico não convida Síndico (RLS) nem ADM; ADM convida Síndico (cargo vago: recusado com "Já existe um usuário ativo"), e Conselho/Portaria/Morador enviam; Subsíndico não insere convite de ADM, Síndico, Subsíndico, Zelador; convite de Zelador criado pelo Síndico não é enviado, alterado nem apagado pelo Subsíndico; Síndico/Subsíndico não mudam convite existente para cargo acima (RLS). Zelador, Conselho, Portaria, Morador não inserem convite nenhum.
- Escalada de papel por REST (`profiles.update role`): 20 tentativas (Subsíndico, Zelador, Conselho, Portaria, Morador sobre si e sobre outros): todas "permission denied".
- Leitura de link: `convite_links` devolve linha só para Síndico e ADM; Subsíndico, Zelador, Conselho, Portaria e Morador leem 0; `pending_invites` não tem coluna de link; auditoria lida por Conselho e Subsíndico não contém URL nem token.

**Dados sensíveis para o Zelador.** `units` direto: 0 linhas; `unidades_para_zelador` devolve só id, bloco, número e moradores (sem documento); `unit_documentos`, `audit_logs`, `fines`, `pending_invites`, `cargo_transferencias`, `convite_links`, `autocadastros` voltam vazios; `profiles` só o próprio. Conselho, Portaria e Subsíndico recebem 0 linhas na função do Zelador. Tela Moradores & Unidades do Zelador: nome, telefone, e-mail, dependentes; sem RG/CPF (texto e HTML), sem "Imprimir Relação", sem botões de edição.

**Zelador, avisos (Z-02).** Por API: só COMUNICADO e MANUTENCAO; URGENTE, ASSEMBLEIA, fixar, anexo e autor falso são barrados; edita e apaga só os próprios (não edita nem apaga aviso do Síndico); não consegue fixar nem mudar a categoria do próprio aviso. Pela tela: o formulário só tem "Comunicado Geral" e "Manutenção", sem fixar nem anexo; publicou "Manutenção"; só o aviso dele tem "Excluir comunicado"; Esc fecha a confirmação. O aviso gera linha no sino do Morador ("Novo comunicado: ...") e aparece no Mural do Morador.

**Zelador, reservas e interdição.** Diálogo "Interditar este espaço?" (texto novo, com "1 aguardando aprovação e 1 confirmada" e link "Ver reservas futuras deste espaço", que abre a lista com "Cancelar reserva" em desktop e a 375px). Motivo de 141 caracteres é recusado com mensagem; com caracteres de largura zero e de direção (Z-05) a interdição grava "Obra no piso da sala" limpo. Motivo é opcional. Interditar, reabrir e aprovar reserva geram uma linha de auditoria cada, com autor "Zelador Teste (ZELADOR)"; o parecer gravado vem do banco ("Zelador Teste (Zelador)", hora do servidor). O Morador vê "Em manutenção" e o motivo, e o texto "(em manutenção)" da lista de bloqueios está no código (`src/app/reservas/page.tsx`), não visto na tela.

**Z-04 pela tela (Síndico).** Excluir o Zelador, "Novo Usuário da Equipe" com perfil Zelador (opção habilitada com o cargo vago), "Gerar Links": a conta nasce `ZELADOR`, desativada e "aguardando aceite" ("Aguardando aceitar o convite · Funcionário externo"); login antes do aceite é recusado; abrindo o link: Continuar, senha divergente é recusada, senha criada, "Seu novo cargo já está ativo", auditoria "Aceitou o convite e assumiu o cargo de Zelador".

**Rotas sem permissão.** Zelador: `/usuarios` volta ao Início. Conselho, Morador: `/usuarios` mostra "Área Restrita" sem dados. Visitante sem login em `/usuarios` vai para o login.

**Tela de Usuários por perfil (desktop e 375px).** Síndico: sem ações sobre ADM e a si mesmo; "Gerar link" em Subsíndico/Zelador/demais; "Excluir acesso" não aparece para Síndico e ADM. ADM: "Gerar link" no Síndico, sem "Excluir" no Síndico. Subsíndico: sem ações em ADM, Síndico, Subsíndico, Zelador; sem "Copiar Link" e sem "Cancelar transferência". Seletor do Subsíndico: só Portaria e Conselho Fiscal.

**Console e rede.** Todas as telas de cada perfil, em navegação interna, sem nenhuma resposta 4xx/5xx de dados. Erros 400/403 no console aparecem só nas trocas de conta (logout/login), já registrados na rodada anterior.

## O que NÃO foi testado
- Exportação CSV (Z-03) pela tela: o download exige confirmação; coberto só pela bateria (função de CSV).
- Aviso "O cargo de Zelador está vago" no Início do Síndico/ADM e a notificação de acesso removido ao Síndico/ADM: não conferidos na tela.
- Z-07 (excluir origem de transferência pendente) e Z-08/Z-09 (reserva encerrada, espaço inexistente): só pela bateria, não pela tela.
- Chromium emulado para os 375px; WebKit real só no `webkit-mobile.mjs` (Morador e Síndico).
- Rede caindo no meio e recarga no meio de um fluxo longo: não simulados.

## Ambiente
- Dados criados nos testes (contas `qa.*@staging.test`, avisos, convites, transferências, interdição, novo Zelador) ficam no staging. O seed `node scripts/seed-staging.mjs` foi rodado ao final para recriar a base.
- A bateria cria e apaga contas `@qa.harmony.test` e desfaz o Síndico/Subsíndico do seed; por isso o seed foi rodado depois dela e de novo após o teste de H-1 (que deixou o Síndico como Morador).
- O teste de H-1 usou uma senha só de teste na conta `qa.alvo@staging.test`, removida pelo seed.

---

# Reteste das correções (H-1 a H-4) e da nova regra do Subsíndico

Staging, app local, contas `@staging.test`. Produção não foi tocada. Ataques por API com a sessão de cada perfil (cookie), tela no Chromium emulado (desktop e 375px), bateria e WebKit.

## Resultado

| Item | Resultado |
|---|---|
| H-1 (escalada pela conta convidada) | CORRIGIDO. Subsíndico, Zelador, Conselho, Portaria e Morador recebem 403 em redefinir senha e excluir, para todos os cargos de destino e iniciador Síndico ou ADM (de ponta a ponta, 2 iniciadores x 5 cargos). Sem link na resposta. |
| H-2 (link ao Subsíndico) | CORRIGIDO. Subsíndico envia convite de Portaria e de Conselho: `ok:true`, sem `link`, sem token na resposta, sem link na auditoria, `convite_links` lido com 0 linhas. Síndico e ADM recebem o link. |
| H-3 (nome só com espaços) | CORRIGIDO para espaços (REST: restrição `pending_invites_nome_nao_vazio`; tela: "Informe o nome completo"; transferência: 400; UPDATE também recusado). Resíduo leve abaixo (R-1). |
| H-4 (3+ chamadas simultâneas) | CORRIGIDO no essencial: 5 simultâneas = 1 sucesso, 1 perfil, 1 link, convite ENVIADO; as perdedoras recebem "Este convite já está sendo enviado. Aguarde e atualize a lista." Resíduo leve (R-2). |
| Subsíndico convida só Portaria e Conselho | PASSOU na tela (seletor), na rota (MORADOR recusado: "Você não pode convidar para um cargo igual ou acima do seu.") e no REST (INSERT de MORADOR, ZELADOR, SUBSINDICO, SINDICO, ADM: RLS nega; UPDATE PORTARIA para MORADOR nega). |
| `bateria.mjs` | TUDO OK (1185 verificações). |
| `webkit-mobile.mjs` | TUDO OK. |
| 375px Síndico, ADM, Subsíndico, Zelador em Usuários e Moradores | Sem rolagem horizontal nem elemento fora da tela. Zelador: Moradores sem botões e sem documento; `/usuarios` volta ao Início. |

## H-1 em detalhe (regra nova: conta com cargo pendente só Síndico e ADM administram)
- Subsíndico (e os demais não-gestão) em conta convidada de transferência SINDICO, SUBSINDICO, CONSELHO, PORTARIA, ZELADOR: reset 403 e excluir 403, mensagem "Esta conta tem um cargo aguardando aceite. Só o Síndico e a Administradora administram essa conta."
- Síndico e ADM: reset 200 com link em Portaria, Conselho e Subsíndico; ADM redefine a conta pendente de Síndico (200); Síndico não redefine conta pendente de Síndico (403, nível igual); conta pendente de Zelador (nasce desativada) responde 409 "Reative o acesso..." para ambos.
- Zelador por convite da fila (cargo vago, conta desativada aguardando aceite): Subsíndico e Conselho 403 em reset e excluir; Subsíndico não apaga nem altera o convite ZELADOR.
- Contornos: UPDATE do papel do convite de transferência para PORTARIA pelo Subsíndico (REST) não altera (SINDICO, SUBSINDICO, ZELADOR), com exceção do R-3; cancelar e refazer: a conta convidada some (reset 404) e a nova recebe id novo, mesma regra; id de outro alvo: matriz já coberta pela bateria.
- Convite comum de Portaria (sem transferência), já enviado: o Subsíndico ainda redefine a senha (200). É o comportamento esperado (nível menor, sem cargo pendente).

## Falhas e observações novas

**R-3 · Leve a média (sabotagem, sem ganho de poder) · Subsíndico apaga ou altera o convite de uma transferência de Portaria ou Conselho**
Síndico ou ADM inicia transferência de PORTARIA ou CONSELHO para pessoa nova. O Subsíndico, por REST, faz `DELETE` em `pending_invites` desse convite: 1 linha apagada. A transferência segue `PENDENTE` com `invite_id` nulo e o link do convite some (`convite_links` em cascata), então quem iniciou perde o link e precisa cancelar e refazer. Também consegue `UPDATE role` de CONSELHO para PORTARIA no convite da transferência. A conta convidada continua protegida (reset e excluir seguem 403), por isso não há escalada. Reproduzir: ADM `transferir-cargo` {cargo PORTARIA, destino NOVO}; Subsíndico `from('pending_invites').delete().eq('id', <convite da transferência>)`. Esperado: convite com `transferencia_id` só mexido por Síndico e ADM (RLS de update e delete).

**R-1 · Leve · Nome só com caracteres invisíveis passa**
A restrição usa `btrim` (só espaço). Nomes de tabulação, NBSP, quebra de linha e zero-width space inseridos por REST entram. Na tela, espaços, tab e NBSP são barrados; dois caracteres de largura zero criam o convite ("Convite adicionado à fila") e a linha da fila aparece sem nome visível. Sugestão: passar o nome por `limparTextoLivre` na tela e usar `~ '^[\s​-‏ ﻿]*$'` (ou equivalente) na restrição.

**R-2 · Leve · Chamada simultânea perdedora às vezes volta com `results: []`**
Das perdedoras, algumas recebem a mensagem clara; outra volta com `results: []` (o convite já saiu da seleção `PENDENTE/ERRO`). O `sendPendingInvites` da tela trata como sucesso e mostra "0 link(s) de acesso gerado(s) com sucesso." Na tela o botão trava, então só aparece em chamada direta ou duas abas.

**R-4 · Leve (UX) · Subsíndico ainda vê "Redefinir Senha" na linha "Cargo pendente"**
Clicar mostra a mensagem correta de recusa, mas o botão poderia ficar oculto (a regra do servidor é a de verdade).

**Moradores e Unidades para o Subsíndico (pergunta do pedido).** O botão "Gerar Link de Acesso" sumiu para ele, como pedido. Não quebra, mas deixa uma ponta solta:
- Ele ainda cadastra e edita unidade com e-mail do morador. Ao salvar, o app tenta enfileirar um convite de MORADOR, o banco recusa (`insertPendingInvite` 42501 no console) e a tela mostra "Unidade 103 atualizada com sucesso." O dado fica salvo, sem convite e sem aviso: no cartão da unidade não aparece status nem dica do que falta. (Leve, mensagem enganosa. Sugestão: texto "Para liberar o acesso do morador, peça o link ao Síndico ou à Administradora", e não tentar enfileirar.)
- Saída existente: o Síndico ou a ADM abrem o mesmo cartão e veem "Gerar Link de Acesso" (testado: gerou, passou a "Link de acesso gerado" + "Copiar Link"). Outra saída para o Subsíndico: a tela Autocadastro (link público do formulário, validar unidades), que ele acessa.
- Conclusão: nenhum fluxo fica sem saída para a operação, mas o Subsíndico sozinho não consegue conceder acesso a morador cadastrado por ele, e o app não explica isso.

## O que NÃO foi testado
- Recarga no meio do fluxo e rede caindo.
- Aceite real (clique no link) de transferência hijack: com 403 no reset não há link a usar; a parte de aceite foi coberta na bateria.
- 375px em WebKit real além do que o `webkit-mobile.mjs` cobre (Morador e Síndico).
- Console da navegação do Subsíndico mostra os 400/403 esperados nas trocas de conta e o 42501 acima.

## Ambiente
Dados de teste (contas `qa.h*@staging.test` removidas pelos próprios scripts, convite `qa.h3.tela`, unidade 103 editada, links) ficam no staging até o seed; `node scripts/seed-staging.mjs` foi rodado ao final.

---

# Reteste da rodada seguinte (R-1 a R-4 e Subsíndico convida Morador)

Staging, app local, seed refeito antes dos ataques, contas `@staging.test`. Produção não tocada. Ataques por REST (sessão de cada perfil) e pela rota, tela no Chromium (desktop 1280 e 375px).

## Resultado

| Item | Resultado |
|---|---|
| `bateria.mjs` | TUDO OK (1193 verificações, 0 falhas) |
| `webkit-mobile.mjs` | TUDO OK |
| Subsíndico convida só MORADOR, PORTARIA, CONSELHO | PASSOU. REST: insere os 3; ZELADOR, SUBSINDICO, SINDICO e ADM recusados (42501). Rota: os 3 enviam; ZELADOR, SUBSINDICO e SINDICO voltam com mensagem de recusa, convite segue PENDENTE e nenhuma conta é criada. Conselho, Portaria e Morador recebem 403; visitante barrado. |
| Link só para Síndico e ADM | PASSOU. Resposta da rota do Subsíndico sem `link`; `convite_links` lido por ele = 0 linhas; `pending_invites` sem coluna de link; auditoria sem link. Síndico e ADM leem 3/3 e recebem o link na resposta; Conselho, Portaria e Morador leem 0. |
| Tela Moradores e Unidades, Subsíndico | PASSOU em 1280 e 375px. "Gerar Link de Acesso" aparece em unidade com e-mail e sem convite, o clique (e duplo clique) gera 1 link e a unidade passa a "Link de acesso gerado". "Copiar Link" não aparece para ele; aparece para Síndico e ADM. Sem rolagem horizontal (375). |
| Escalada H-1 | CONTINUA BARRADA. Transferência de PORTARIA e CONSELHO para pessoa nova: reset e excluir da conta convidada = 403/403 para o Subsíndico, sem link. |
| R-3 | CORRIGIDO. Subsíndico por REST: DELETE e UPDATE (role, nome, status, transferencia_id) em convite com `transferencia_id` = 0 linhas; convite e link intactos; INSERT com `transferencia_id` recusado (42501). ADM ainda altera e cancela a transferência. |
| R-1 | PARCIAL. Recusados no banco (23514, insert e update): tab, NBSP, quebra de linha (LF e CRLF), U+2028/2029, largura zero (ZWSP, ZWNJ, ZWJ, BOM), LRM/RLM, LRO/RLO/LRI/PDI, combinações, só espaços, espaço ideográfico e em. Na tela Usuários (convite da equipe, Subsíndico) todos recusados com "Escreva o nome completo." e nenhuma fila criada. Falhas leves abaixo. |
| R-2 | CORRIGIDO no essencial. Com 6 chamadas simultâneas (Síndico e Subsíndico): 1 sucesso, 5 perdedoras com "Este convite já está sendo enviado. Aguarde e atualize a lista.", nenhuma resposta com lista vazia, 1 conta só. Reenvio de convite já enviado e id inexistente: 409 "Este convite já está em andamento ou já foi enviado. Atualize a lista." Na tela, quando a chamada perde por estado velho, aparece essa mensagem e não "0 link(s)". |
| R-4 | CORRIGIDO. Subsíndico: conta "Novo Porteiro" (cargo pendente) sem Redefinir Senha, sem Excluir acesso e sem Copiar Link; conta do Zelador sem botões. ADM e Síndico: Redefinir Senha, Excluir acesso e Copiar link na conta pendente; ADM também administra a conta do Zelador. |
| "This page couldn't load" | Não reproduzido. `/usuarios` e `/moradores` abertos como ADM, Síndico, Subsíndico, Zelador (Usuários volta ao Início; Moradores sem botões nem documento) e Conselho: nenhuma tela de erro, log do servidor sem erro de renderização. Console: só 400/403/409 esperados das trocas de conta e do teste de concorrência; nenhuma exceção de JS. |

## Falhas e observações novas (todas leves)

**S-1 · Leve · Nomes com U+2060, U+00AD e caractere de controle passam no banco**
`pending_invites_nome_nao_vazio` não cobre WORD JOINER (U+2060), soft hyphen (U+00AD) nem controle (U+0007). INSERT e UPDATE por REST do Subsíndico aceitam; convite sem nome visível. Mesma sugestão: usar uma classe de invisíveis mais ampla (`\p{Cf}`, controles) ou checar "tem letra ou número".

**S-2 · Leve · transferir-cargo responde 500 para nome só de largura zero ou direção**
ADM, `POST /api/usuarios/transferir-cargo` com `destino.nome` = dois ZWSP, só U+202E ou U+2066: o banco recusa (23514) mas a rota devolve 500 "Não deu para concluir..." (a conta de Auth criada é removida e nada fica salvo). Esperado: 400 "Informe o nome completo", como nos casos de tab, NBSP e quebra de linha (esses dão 400).

**S-3 · Leve · Formulário da unidade (Moradores) aceita nome do titular com tab, NBSP e largura zero**
Subsíndico, Nova Unidade, titular com nome só de tab, NBSP ou dois ZWSP e e-mail: a unidade é salva com titular sem nome e a tela mostra "Unidade 888 cadastrada, mas houve erro ao registrar o convite. Envie manualmente pelo card." O convite foi recusado pelo banco (certo), mas a mensagem manda "enviar pelo card", o que também falharia. Sugestão: validar o nome do titular com o mesmo `textoVazio`.

**S-4 · Leve (texto) · Mensagem manda copiar um link que o Subsíndico não vê**
Ao cadastrar ou editar unidade com e-mail, o Subsíndico recebe "Link de acesso gerado para ... — copie e envie para o morador.", mas não tem "Copiar Link" (só Síndico e ADM). Sugestão: para o Subsíndico, "Link de acesso gerado. O Síndico ou a Administradora enviam o link ao morador."

**S-5 · Observação · perdedora de chamada simultânea volta HTTP 200**
As perdedoras que pegam o convite já reservado voltam 200 com `results[0].ok=false` e mensagem clara; só quem não acha o convite na seleção recebe 409. Aceitável (mensagem sempre presente, nunca lista vazia); anotado porque o pedido citava 409.

## O que NÃO foi testado
- Tela do Subsíndico quando a perdedora volta 200 com `ok:false` (só o caminho 409 foi visto na tela).
- Recarga no meio do fluxo e rede caindo.
- Conselho, Portaria e Morador em `/usuarios` e `/moradores` pela tela: só Conselho foi aberto; Portaria e Morador foram cobertos pela bateria e pelo WebKit (Morador).
- Aceite real (clique no link) do convite de morador gerado pelo Subsíndico.

## Ambiente
Dados criados (contas `qa.*@staging.test`, unidades 705, 873, 874, 888 e 103/104/B101 editadas) ficam no staging até o seed; `node scripts/seed-staging.mjs` foi rodado ao final.
