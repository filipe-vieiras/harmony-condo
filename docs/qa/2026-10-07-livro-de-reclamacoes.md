# QA: Livro de reclamações, primeira versão (migração 0043)

Data: 2026-10-07. Ambiente: staging (app local, contas `*@staging.test`). Spec: `docs/specs/2026-10-07-livro-de-reclamacoes-v2.md`.
Estado final: seed rodado (`node scripts/seed-staging.mjs`) e interruptor do Livro em **DESLIGADO**.

## Veredito
Segurança e regras do banco: **sólidas**. Resumo: 0 bloqueia, 0 grave, 9 leves (L1 a L9), mais 2 defeitos de teste (T1, T2). A falha intermitente do 401 não se reproduziu e parece defeito de teste/infra.

Resultados dos scripts (todos em staging):
- `node scripts/qa/bateria.mjs` inteiro: **1429 verificações, TUDO OK** (segunda rodada, após seed). A primeira rodada deu 1 falha, defeito de teste (T1).
- `node scripts/qa/livro.mjs` (218 verificações do Livro): TUDO OK.
- `node scripts/qa/webkit-mobile.mjs` (WebKit 375px): TUDO OK, agora com `/livro` (Morador e Síndico) e `/livro/remocoes` (Síndico) acrescentados.
- Novos, criados por mim em `scripts/qa/`: `livro-extra.mjs` (matriz perfil x modo, REST forjado, texto hostil, concorrência, perda de perfil; 273 verificações), `livro-corrida.mjs`, `livro-tela.mjs` (Playwright: WebKit 375px e Chromium 1280px, 9 perfis, fluxos; ~300 verificações), `livro-foco.mjs`, `transferir-401.mjs`.
- Para rodar os de tela: `npm i --no-save playwright` (já feito em node_modules, sem alterar package.json).

## Falhas e observações (por severidade)

### Leves (produto)
**L1. Corrida no resumo diário à gestão: mais de 1 aviso por dia.** `livro_msg_avisos` checa "já houve aviso nas últimas 24h" e insere sem trava. Reprodução: `node scripts/qa/livro-corrida.mjs` (6 pessoas publicando ao mesmo tempo; o Síndico recebeu 2 avisos "Há novas mensagens no Livro" em 3 de 6 rodadas). Esperado: no máximo 1 por dia.

**L2. Corrida em "Avisar a gestão": aviso duplicado.** `livro_sin_avisos` conta sinalizações (`count > 1`) e duas transações simultâneas não se enxergam. Reprodução: 3 pessoas tocam em "Avisar a gestão" na mesma mensagem ao mesmo tempo (`livro-extra.mjs`, caso 4d): Síndico recebeu 2 avisos (esperado 1). Obs.: citações simultâneas ao mesmo alvo no mesmo tópico NÃO duplicam (6 de 6 rodadas ok; o bloqueio da linha do tópico serializa).

**L3. Citação de mensagem removida continua legível por REST.** A tela e a RPC escondem os citados de mensagem removida, mas `livro_citacoes` (colunas `mensagem_id`, `tipo`, `rotulo`) é legível por qualquer perfil que lê o livro. Passos: Morador publica citando o Síndico; Síndico remove; outro Morador faz `GET /rest/v1/livro_citacoes?mensagem_id=eq.{id}` e recebe "Síndico ...". Contraria "citação em mensagem removida some da tela" (spec seção 4) e expõe quem foi citado numa mensagem possivelmente ofensiva. Sugestão: a policy de leitura de `livro_citacoes` exigir mensagem não removida.

**L4. Texto só de seletores de variação (U+FE0F) é aceito.** 30 x U+FE0F passam como mensagem válida e ficam em branco na tela. Os demais invisíveis testados (U+200B, U+3164, U+2800, NBSP, soft hyphen, U+2060, FEFF, U+034F, tags U+E00xx, U+115F/1160, direção) são recusados com `texto_vazio`. Também é recusado NUL (erro técnico "unsupported Unicode escape", sem mensagem em português: cai no genérico "Tente de novo").

**L5. Contador do editor conta unidades UTF-16, o banco conta caracteres.** 600 emojis aparecem como "1200/1000", o botão fica desativado, mas o banco aceitaria (guarda 600 caracteres). A tela é mais restritiva que a regra. Reprodução: colar 600 x emoji no campo de tópico.

**L6. Erros esperados do banco viram `console.error`.** `chamar()` em `src/lib/supabase/livro.ts` faz `console.error` em toda recusa (ex.: `dado_pessoal`, id inválido). No dev, o Next abre o overlay "Console Error" por cima da tela (atrapalha o uso e a automação). Sugestão: logar só erros inesperados.

**L7. URL com id que não é UUID** (`/livro/lixo`): a tela mostra "Não foi possível concluir agora. Tente de novo..." com "Tentar de novo" (e HTTP 400 no console) em vez de "Este tópico não existe mais."

**L8. Depois de apagar uma resposta, a conversa volta à primeira página** (30 respostas; perde o ponto de leitura se a pessoa estava na 36ª). Reprodução: tópico com 35 respostas, abrir tudo com "Ver mais respostas", apagar a última.

**L9. Autor que mudou de perfil não apaga a própria mensagem.** Ex-Conselho que virou Portaria (ou ex-Morador desativado) recebe `sem_permissao` em `livro_remover` das próprias mensagens. Spec: "o autor apaga a própria" (direito do titular, LGPD). Hoje só quem ainda é Síndico, Subsíndico, Conselho ou Morador consegue. Decisão de produto a confirmar; no mínimo, documentar o caminho (a gestão remove).

### Observações sem severidade
- Síndico, Subsíndico e Conselho também veem "Avisar a gestão" (`podeSinalizar` = quem escreve). Se o Síndico sinaliza, o aviso volta para ele mesmo. Coerente com a decisão, mas inútil para o Síndico.
- Leitura em massa por REST (`livro_mensagens` sem limite de página) segue possível para quem lê: já listado na spec (#71).
- A rótula do cargo duplica no seed ("Conselho Conselho Dois"): efeito dos nomes do seed, não do produto.
- A lista "Ver detalhes" do sino (link para `/livro/{id}`) tem 18px de altura (componente do Header, anterior ao Livro). O clique no texto do aviso só marca como lido; quem navega é o link "Ver detalhes →" (funciona: abre o tópico).
- Telefone no texto (ex.: "(11) 91234-5678"), link, "arroba", "@" de largura total e CPF com espaços passam: a spec só exige filtrar CPF/CNPJ/e-mail com formato normal, que funciona.
- Remover duas vezes não duplica registro; remover tópico não remove as respostas (conforme spec).
- Uma rodada da tela do Síndico no celular (375px) não registrou a remoção após `dblclick` em "Remover mensagem" (0 registros); na repetição passou (1 registro, duplo clique não duplica). Não consegui reproduzir de novo; pode ser automação de WebKit. Registrado como não confirmado.

### Defeitos de teste (para o developer)
**T1. `livro.mjs`: "a mudança do interruptor fica no histórico" não é idempotente.** Lê `logModo[0]` sem ordenar. Se `audit_logs` já tem mudanças de modo do Livro (qualquer uso manual da tela), a verificação falha (aconteceu na 1ª rodada completa da bateria, depois dos meus testes de tela). Passa logo após o seed. Sugestão: filtrar por `detalhes->>de/para` e ordenar por data.
**T2. `limparQA`/bateria apagam o Síndico/Subsíndico/etc. do seed** e trocam a senha do titular; depois da bateria é preciso rodar o seed (login `*@staging.test` falha antes disso). Já documentado em `lib.mjs`.

## Falha intermitente "Subsíndico NÃO cancela transferência → 401"
- Local: `scripts/qa/transferir-cargo.mjs` linha 104 (seção 1, antes de qualquer transferência), chamando `POST /api/usuarios/transferir-cargo/cancelar`. O 401 sai de `supabase.auth.getUser()` sem usuário (`cancelar/route.ts` linha 11).
- Tentativas de reproduzir: bateria inteira 2 vezes (seção J passou nas duas); `scripts/qa/transferir-401.mjs` com rajadas de 30 chamadas paralelas, segunda sessão da mesma conta aberta no meio, login de outra conta no meio da rajada e chamada imediata após o login (6x): **100% 403 esperados, nenhum 401**.
- O que sei: cada transferência/troca de cargo apaga as sessões de quem muda (`_invalidar_acesso_anterior`, 0042, dentro da transação, sem atraso), então não há corrida assíncrona do produto. O login do Auth tem limite de taxa (`Request rate limit reached` aparece depois de ~30 logins em 5 minutos; nesse caso `cookieDe` lança erro, não 401). A bateria faz 9 logins em paralelo mais clientes extras no início da seção, perto do limite.
- Conclusão (hipótese, não provada): **defeito de teste/infraestrutura, não do produto**. Causa mais provável: o `getUser()` do servidor local falhou naquela chamada (rede/Auth transitório, ou sessão do Subsíndico apagada por algo que o developer rodava no mesmo staging) e a rota traduz qualquer falha em 401. Não há evidência de defeito de acesso: o Subsíndico nunca conseguiu cancelar. Sugestão: no teste, em caso de 401, repetir uma vez com novo login antes de falhar, e imprimir a resposta completa quando acontecer de novo.

## Resultado por área

### 1. Perfil x modo do interruptor (RPC e REST, contas do seed)
Matriz completa passou para Síndico, Subsíndico, ADM, Conselho (2), Morador proprietário, inquilino, outro morador validado, Zelador, Portaria, Provisório e visitante, nos três modos:
- DESLIGADO: ninguém lê nem escreve (nem o Síndico); Síndico e ADM seguem mudando o interruptor.
- EQUIPE: leem Síndico, Subsíndico, ADM, Conselho; Morador, Zelador e Portaria 0 linhas (RPC e REST), nada escrevem.
- ABERTO: leem todos exceto provisório, visitante, sem perfil, desativado; escrevem só Síndico, Subsíndico, Conselho, Morador (todos pedem ciência antes). ADM, Zelador, Portaria: publicar, responder, citáveis e "Avisar a gestão" negados.
- Registro de remoções: só Síndico, Subsíndico, ADM, Conselho. Interruptor: só Síndico e ADM.
- Visitante (sem login) via REST puro e RPC: negado ou 0 linhas em todas as 7 tabelas do Livro.
- Conta desativada com sessão antiga e Zelador desativado: não leem nem escrevem.

### 2. REST/RPC forjados
Passaram: INSERT/UPDATE/DELETE direto em todas as tabelas para todos os perfis (inclusive Síndico e ADM); `autor_id` e `*` ilegíveis; embed de coluna interna negado; `texto_original` ilegível por REST; funções internas (`_livro_avisar`, `_livro_auditar`, `_livro_limpar_vencidos`, `_livro_citaveis_todos` etc.) negadas; `INSERT` em `notifications` com alvo negado; morador só lê os próprios avisos; Zelador e Portaria não veem avisos do Livro; forja de autor, nome, perfil, unidade ignorada (servidor define); citar ADM, Zelador, Portaria, id de conta, ref inventada, SQL, unidade sem conta, a si mesmo: `alvo_invalido`; 6 citados: `muitos_citados`, 5 passam; repetido vale 1; resposta a resposta, a tópico inexistente ou removido: recusadas; 201ª resposta: `topico_cheio`; 1001/501 caracteres, vazio, só espaços, CPF, CNPJ, e-mail: recusados; HTML e `<script>` guardados como texto puro; caracteres de direção e invisíveis removidos (exceto L4); acentos empilhados e quebras domados; texto repetido em 1 minuto; 11ª mensagem na hora (`limite_hora`), 41ª no dia, 16ª citação no dia.
Concorrência: 14 envios simultâneos da mesma conta passam 10; mesmo texto 5x em paralelo passa 1; 4 respostas disputando a última vaga (199 respostas): 1 passa, `n_respostas`=200; 3 remoções simultâneas: 1 registro e 1 aviso. Falhas: L1 e L2.

### 3. Citações e sino
Um aviso por pessoa por tópico enquanto não lido (também por cargo e unidade na mesma mensagem), novo aviso depois de lido; aviso de resposta ao dono do tópico (uma vez, e não repete a quem foi citado na mesma mensagem nem a si mesmo); aviso de remoção ao autor (1 só); resumo diário só a Síndico e ADM (exceto L1); "Avisar a gestão" neutro e sem identificar quem sinalizou (exceto L2); texto fixo, sem trecho nem nome; link `/livro/{tópico}`; digitar nome ou "@" não avisa; Zelador, Portaria e ADM não recebem avisos de citação. Na tela, o link "Ver detalhes →" do sino abre o tópico.

### 4. Remoção
Motivo só da lista (5 motivos; ausente, longo, minúsculo, com SQL, e `AUTOR` usado por ADM: `motivo_invalido`); Subsíndico, Conselho, Morador, Zelador, Portaria, visitante: negado; registro imutável (UPDATE/DELETE negados ao Síndico); marcadores "citava quem removeu" (por cargo e por unidade) e "autor era quem removeu"; texto retido por 90 dias, depois ausente da tela, da API e do banco; auditoria sem texto; autor remove a própria (registrada como "pelo autor"); conta excluída vira "Ex-morador" sem unidade e o feed segue funcionando.

### 5. Perda de perfil depois de postar ou ser citado
Ex-Conselho virou Morador: perde o registro na hora (JWT antigo, banco relê), ainda apaga a própria. Subsíndico rebaixado sem unidade: `sem_unidade`. Desativado: não lê, não apaga a própria, não lê avisos, some dos citáveis e citar a ref antiga dele dá `alvo_invalido`; chips de mensagens antigas mantêm a foto do cargo/unidade. Ex-autor que virou Portaria não apaga a própria (L9).

### 6. Tela (WebKit iPhone 375px e Chromium 1280x800, 9 perfis)
Passaram em ambos os tamanhos para Síndico, Subsíndico, ADM, Conselho, Morador, Inquilino, Zelador, Portaria: rota abre, lista com 20 cartões e "Ver mais tópicos", editor só para quem escreve (com ciência antes), "Avisar a gestão" só para quem escreve, "Remover" só para Síndico e ADM, link do registro só para os 4 perfis, painel do interruptor só para Síndico e ADM, **sem rolagem horizontal, alvos >= 44px na área principal, console e rede sem erro** (carga normal). Provisório: `/livro` e `/livro/remocoes` mostram "não está disponível"/"sem acesso", sem menu e sem mensagens. Visitante: `/livro`, `/livro/{id}`, `/livro/remocoes` redirecionam ao login. Zelador e Portaria abrem tópico por URL direta; Morador, Zelador e Portaria não abrem o registro.
Fluxos (Morador, 375px): ciência "Li as regras" esconde o editor até aceitar; Publicar desativado para vazio, curto, só espaços, só invisíveis, 1001 caracteres (contador "1001/1000", `aria-live` polite); CPF: banco recusa com mensagem em português e o texto não se perde; folha "Citar" ocupa a tela (375x812), busca sem acento, 6º item bloqueado, sem a própria unidade nem ADM/Zelador/Portaria, Esc fecha; foco entra na folha, Tab fica dentro, foco volta ao botão "Citar" (Chromium; no WebKit o clique não dá foco ao botão, comportamento do Safari); duplo clique em Publicar cria 1 tópico; offline: "Sem conexão" e Publicar bloqueado; erro 500: mensagem em português e texto preservado; paginação 20 tópicos e 30 respostas sem repetir; palavra de 300 letras quebra sem rolagem; HTML/script como texto, sem link; apagar a própria usa o diálogo do app (Esc cancela); "Você removeu esta mensagem" com "Ver o texto removido"; "Avisar a gestão" confirma e não oculta; tópico inexistente: "não existe mais". Estados: carregando (esqueleto de 3), erro com "Tentar de novo", vazio (convite para escrever só a quem escreve). Síndico (desktop e celular): diálogo com 5 motivos e sem texto livre, botão desativado sem motivo, Esc fecha e devolve o foco, duplo clique gera 1 registro, registro lista motivo e quem removeu, interruptor pede confirmação, cancelar não muda, EQUIPE esconde menu e conteúdo do Inquilino, DESLIGADO mostra a dica ao Síndico. Capturas ficaram fora do repositório.

### 7. Regressão
Bateria completa TUDO OK (1429). `webkit-mobile.mjs` TUDO OK nas rotas de Início, Veículos, Moradores, Multas, Mural, Links, Reservas (Morador) e as do Síndico incluindo Usuários, Relatórios e Reservas, e os modais de Reservas e de Multa. Reservas, Usuários, Mural e Início seguem normais pela bateria e pela medição em 375px. Não fiz inspeção visual manual dessas quatro telas em desktop.

## Não testado
- Rotina de limpeza agendada do texto vencido (a limpeza roda ao remover e ao ler o registro; testado forçando a expiração).
- Navegação por leitor de tela real; apenas rótulos, `aria-live`, `role=note` e `aria-label` do cartão conferidos no DOM ("Mensagem de {nome}, unidade A-101, {tempo}").
- Teclado virtual cobrindo o botão no iPhone real (WebKit do Playwright não emula).
- Aviso de privacidade (#55) e regras jurídicas: fora do escopo de QA.

## Arquivos
- Relatório: `/Users/filipevieira/Apps/Harmony/docs/qa/2026-10-07-livro-de-reclamacoes.md`
- Scripts novos/alterados em `/Users/filipevieira/Apps/Harmony/scripts/qa/`: `livro-extra.mjs`, `livro-corrida.mjs`, `livro-tela.mjs`, `livro-foco.mjs`, `transferir-401.mjs`, `webkit-mobile.mjs` (acrescentadas as rotas do Livro).
