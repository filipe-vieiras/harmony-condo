# QA final: Veículos (#91, Alternativa B) e Livro (correções da revisão de segurança)

Data: 2026-10-07. Ambiente: staging (app local, contas `*@staging.test`). Chromium e WebKit (Playwright).
Estado final: seed refeito, Livro **DESLIGADO**, `liberado_para_abrir = false`, 0 mensagens, dados de teste removidos, servidor parado.

## Veredito

Sem falha que bloqueie ou grave. **V1, V2, V3, V4 e M-1, M-2, M-3, B-1 a B-4 estão corrigidos.** Sobram 3 itens leves e 3 informativos (abaixo).

| Verificação | Resultado |
|---|---|
| `webkit-mobile.mjs` | TUDO OK (57 verificações) |
| `livro.mjs` | TUDO OK (257) |
| `livro-extra.mjs` | TUDO OK (277) |
| `livro-corrida.mjs` | TUDO OK |
| `livro-tela.mjs` | TUDO OK (309; as 4 falhas da rodada anterior não repetem) |
| `bateria.mjs` completa | **TUDO OK, 1468** |
| Meus testes extras (Livro, 43 checks) | 43 OK |
| Medição de larguras (528 medições) | 0 falhas |

Observação de uso: `livro.mjs` troca a senha de contas do seed. Rodar `livro-extra.mjs` logo depois dá "Invalid login credentials". É preciso rodar `node scripts/seed-staging.mjs` entre um script e outro. Não é bug do app. Vale registrar no cabeçalho dos scripts.

## A) Veículos

- **V1 carga (PASSOU).** Para Portaria, Síndico e Morador, com `GET /rest/v1/vehicles` atrasado 3 s: durante a espera nunca aparece "Nenhum veículo cadastrado", "Sua unidade não tem veículos" nem "0 veículos". O aviso de "Carregando veículos" fica visível e a lista aparece depois. Com falha simulada (HTTP 500): "Não foi possível carregar os veículos" e o botão "Tentar de novo", sem contador nem "sem veículos". O botão recupera a lista.
- **V2 largura (PASSOU).** 8 perfis (Síndico, Subsíndico, ADM, Conselho, Portaria, Zelador, Morador, Inquilino) x `/veiculos`, `/reservas`, `/moradores`, `/usuarios`, `/` e `/mural` x 375, 600, 640, 768, 900, 1000, 1023, 1024, 1100, 1279 e 1280px: 528 medições, 0 com rolagem horizontal da página e 0 com o botão "Cadastrar Veículo" cortado. Entre 1024 e 1279 a tabela rola dentro do próprio quadro (scrollWidth 867 contra 678 a 754) e o botão fica inteiro. O `webkit-mobile.mjs` agora mede as 11 larguras e passa.
- **V3 (PASSOU).** Folha aberta em 800px, ao ir para 1280px ela fecha, a rolagem é liberada e não sobra modal invisível.
- **V4 (PASSOU).** Placa duplicada (Morador): a mensagem "Esta placa já está cadastrada." aparece 1 vez e não há `console.error` do app. A resposta 409 aparece só como a linha de rede do navegador.
- **Passada completa em 375px (Morador e Síndico): PASSOU.** Cadastrar, editar e remover pela interface nova.
  - Enviar vazio leva o foco ao campo Placa.
  - Duplo clique em Salvar cria 1 veículo (conferido no banco).
  - Foco: o cadastro abre no título; a folha abre em "Fechar"; a edição abre no título; depois de salvar, editar ou remover o foco vai ao aviso ("Veículo cadastrado", "atualizado", "removido").
  - Esc no diálogo de remoção cancela, não remove e devolve o foco ao cartão (o botão "Voltar" também).
  - Confirmar a remoção com duplo clique remove 1 vez.
  - Sem erro no console.
- **Comparação com o protótipo.** O cartão (chip da placa com ícone do tipo, unidade à direita, nome, modelo e cor) e a folha (Fechar, veículo e tipo, unidade e vaga, morador, telefone com `tel:`, Editar veículo e Remover em vermelho) seguem a Alternativa B. Sobram as divergências de texto da rodada anterior (V5).

### Falhas e observações de Veículos

**V7. LEVE (novo). Cadastrar muito cedo, antes de `units` carregar, dá erro enganoso e `console.error` com 42501.**
Passos: logar como Morador, abrir `/veiculos` e, em menos de 1 s (ou com `GET /rest/v1/units` lento, por exemplo 6 s), tocar em "Cadastrar Veículo", preencher placa, tipo, marca e modelo e salvar. O envio sai com `unit_id: null`. O banco recusa (42501, RLS) e a tela mostra "Não foi possível salvar. Verifique a conexão e tente de novo.". O erro aparece no console. Reproduzido 4 de 4 vezes no envio imediato e com `units` lento. Com a tela carregada (espera normal) não ocorre.
Esperado: desativar "Salvar" ou o botão "Cadastrar" até a unidade chegar, ou dar mensagem correta. Dados não são corrompidos e tentar de novo depois da carga funciona. O Síndico não é afetado, pois escolhe a unidade.

**V5. LEVE (repetida, sem mudança).** O título da página segue "Cadastro e Controle de Veículos" (o protótipo diz "Veículos & Garagem", que é o nome do menu). A unidade aparece como "A-101" (o protótipo usa "Apto 403 · A"). Em tablet o app usa o cartão do celular.

**V6. INFORMATIVO (repetido).** Por API, a Portaria remove qualquer veículo e o Morador remove o visitante da própria unidade. A tela esconde essas ações (decisão do dono de 2026-10-04). Não reteste de novo, não mudou.

## B) Livro (correções da revisão de segurança)

### M-1 "Avisar a gestão" (PASSOU)
- Morador sinaliza 7 mensagens alheias: as 5 primeiras passam e a 6ª e a 7ª recebem `limite_sinalizacao`. Repetir uma já sinalizada devolve `jaAvisado` e não conta no limite.
- 8 chamadas simultâneas da mesma pessoa: exatamente 5 passam e o banco guarda 5.
- Limite diário: com 15 sinalizações feitas há 3 h (0 na última hora), a próxima é barrada. Com 14, passa.
- Aviso agregado à gestão: Síndico e ADM recebem exatamente 1 aviso "Há mensagens sinalizadas à gestão no Livro" (link `/livro`), sem texto da mensagem, sem nome nem id de quem sinalizou ou da mensagem. O Subsíndico não recebe.
- 5 pessoas sinalizando a mesma mensagem ao mesmo tempo: 1 aviso para cada gestor, sem duplicar.
- Negados: sinalizar a própria mensagem, sinalizar em DESLIGADO, Zelador e Portaria (`sem_permissao`).

### M-2 aviso de citação (PASSOU)
- EQUIPE: Conselho cita a unidade A-101. Morador e Inquilino **não** recebem aviso. O Síndico citado recebe.
- ABERTO: o Morador citado recebe 1 aviso ("Sua unidade foi citada no Livro", link `/livro/<id>`) sem o texto da mensagem.
- Nota técnica: a coluna do aviso é `usuario_id_alvo`. Meu primeiro rascunho filtrava a coluna errada e dava 0 vazio, então refiz o teste e conferi também o caso positivo.

### M-3 `liberado_para_abrir` (PASSOU)
- Síndico e ADM por RPC com `ABERTO`: `abertura_nao_liberada`. Variantes `aberto`, ` ABERTO` e `ABERTO ` dão `modo_invalido`.
- `UPDATE` direto em `livro_config` (modo ou `liberado_para_abrir`) e `INSERT`: `permission denied`. Valores intactos.
- DESLIGADO e EQUIPE seguem livres para Síndico e ADM. Conselho, Morador, Portaria e Zelador não mudam o modo.
- Tela (Síndico em 375px e ADM em 1280px, modo EQUIPE): "Aberto" vem desativado com a frase "Ainda não liberado: depende do aviso de privacidade e das regras de uso.". Clicar à força não muda nada (modo continua EQUIPE).

### B-1 a B-4 (PASSOU, com ressalva em B-1)
- B-1: pelo meu teste, recusados e-mail normal, `[at]`, `(at)...(dot)`, `＠` de largura total, CPF com pontuação, sem pontuação, com espaços, em largura total, CNPJ com e sem máscara, RG, telefones (com DDD, com `+55`, só números, com espaços, fixo, só `91234-5678`, largura total) e e-mail com caractere invisível. Passaram texto legítimo: hora "22h30", data "12/10", "R$ 1.234,56", "4 vagas, 12 carros", "45.678 reais".
- B-2 (invisíveis), B-3 (texto vencido apagado na listagem) e B-4 ("Ex-morador" e "Ex-membro" ao excluir conta): verificados em `livro.mjs` e na bateria, todos OK.
- Trava dos scripts: com `QA_ALVO=producao` e com `QA_SITE` apontando para o site de produção, `livro`, `livro-extra`, `livro-corrida`, `livro-tela`, `bateria` e `transferir-cargo` abortam na importação do `lib.mjs` ("QA recusado ... só rodam no staging") antes de qualquer conexão. Nada foi executado contra produção. `webkit-mobile.mjs`, `livro-foco.mjs` e `transferir-401.mjs` têm guarda própria que li, mas não testei com site de produção.

### Falhas e observações do Livro

**B-1b. LEVE (novo). E-mail com espaços ao redor dos símbolos passa no filtro.**
Passos: publicar `fulano @ gmail . com` (qualquer perfil que escreve). A mensagem é publicada. As demais variantes testadas são recusadas. Observação: ofuscações por escrito ("fulano arroba gmail ponto com") também passam por natureza. Sugestão: aceitar como risco residual ou tratar `\w+\s*@\s*\w+\s*\.\s*\w+`.

**L-i1. INFORMATIVO. Em EQUIPE o aviso amarelo do formulário diz "Este espaço é aberto. Todos os moradores veem o que você escreve..."** embora os moradores ainda não entrem. Texto confunde a equipe que testa.

**L-i2. INFORMATIVO. `/livro/remocoes` com o Livro DESLIGADO mostra "Sem acesso ao registro de remoções" até para o Síndico.** Em EQUIPE abre normalmente. A mensagem sugere falta de permissão quando na verdade é o Livro desligado.

**V-L1 (rodada anterior) resolvido.** No WebKit (iPhone 13, 375px) e no Chromium, fechar a folha "Citar" por Esc ou por "Concluir" devolve o foco ao botão "Citar".

## C) Regressão em 375px e Livro DESLIGADO

- 9 perfis (os 8 acima mais o Provisório) x `/`, `/reservas`, `/moradores`, `/usuarios`, `/mural`, `/veiculos`, `/livro` e `/livro/remocoes`, sem rolagem horizontal em nenhum, 0 erros de console do app em todos os perfis. Redirecionamentos de permissão como esperado (Zelador em `/usuarios` volta ao início, Morador em `/moradores` volta ao início, os demais mostram "Área Restrita").
- Em DESLIGADO a única menção ao Livro nas telas normais (Início, Reservas, Moradores, Usuários, Mural e Veículos) é o item de menu "Livro de reclamações", só para Síndico e ADM. Subsíndico, Conselho, Portaria, Zelador, Morador, Inquilino e Provisório: 0 menções, e não há aviso no sino.
- **Ressalva (informativo):** quem digita `/livro` na barra de endereço, mesmo Morador ou Portaria, vê a página com o título, a frase "Os moradores e a gestão podem responder aqui. Tudo o que é escrito fica visível, com nome e unidade." e "O Livro de reclamações não está disponível agora. Assim que for liberado, ele aparece aqui." Nenhum dado é exposto, mas revela que o recurso existe. Se a regra é "nada aparece", esconder o conteúdo da URL direta (por exemplo, a página de "não encontrado"). Só chama `livro_acesso` (1 chamada), nenhuma leitura de mensagens.

## Resumo por severidade

| ID | Severidade | Resumo |
|---|---|---|
| V7 | leve (novo) | salvar cedo demais (antes de `units`) manda `unit_id` nulo: erro enganoso e `console.error` 42501 |
| V5 | leve | título "Cadastro e Controle de Veículos" e unidade "A-101" diferem do protótipo |
| B-1b | leve (novo) | `fulano @ gmail . com` passa no filtro de e-mail |
| L-i1 | informativo | aviso "Este espaço é aberto" aparece em EQUIPE |
| L-i2 | informativo | `/livro/remocoes` com Livro desligado diz "Sem acesso" ao Síndico |
| `/livro` direto | informativo | URL direta mostra a página e a frase de "não disponível" a todos os perfis |
| V6 | informativo | Portaria e Morador (visitante próprio) removem por API (decisão do dono) |

Nada bloqueia a ida para produção pelos pontos testados. O que **não** foi testado: tela real em iPhone, notch e safe-area (só WebKit do Playwright e leitura do CSS), "dono" (sem conta no seed), e produção (proibido).

Dados de teste ficam só nas bases do staging. O seed foi rodado ao final (`node scripts/seed-staging.mjs`), então a base está limpa. Scripts auxiliares que escrevi ficaram no diretório temporário da sessão, fora do repositório.

## Rodada final (ajustes feitos depois deste relatório)

Ambiente: staging, app local, Chromium e WebKit (Playwright). Estado final: seed refeito, Livro DESLIGADO, `liberado_para_abrir = false`, 0 mensagens, servidor parado. Os scripts temporários que escrevi foram apagados. A trava dos scripts de QA não foi tocada.

**Veredito: sem falha que bloqueie ou grave. V7 corrigido. B-1b corrigido para o caso relatado, com 4 contornos leves que sobram. Livro por modo, patch do iPhone e regressão passaram.**

| Verificação | Resultado |
|---|---|
| `topo-sob-header.mjs` | TUDO OK (todas as telas, WebKit e Chromium) |
| `webkit-mobile.mjs` | TUDO OK (na 1ª execução deu timeout em `[data-dia]`, na 2ª passou; ver nota) |
| `livro-tela.mjs` | TUDO OK |
| `livro-modo-tela.mjs` | TUDO OK |
| `bateria.mjs` completa | **TUDO OK, 1470** |

Nota de ambiente: um `seed-staging.mjs` ficou rodando em segundo plano por engano meu (sobrepôs rodadas) e causou "Invalid login credentials" e um timeout em alguns scripts. Depois de ele terminar e o seed ser refeito, tudo repetiu limpo. O timeout do `webkit-mobile` na 1ª execução pode ter sido esse mesmo efeito.

### 1) V7 (PASSOU)
- Morador, `GET /rest/v1/units` atrasado 6 s, em 1280px e 375px: o botão "Cadastrar Veículo" fica desativado ao abrir e continua desativado aos 2,5 s. Clique forçado e `click()` por JS não abrem o formulário. Ao carregar, habilita; o cadastro com duplo clique faz 1 POST e mostra "Veículo cadastrado". Sem `console.error`.
- Com `GET /rest/v1/vehicles` atrasado 6 s: também fica desativado até a carga.
- Unidade não encontrada (units devolvendo `[]` com 200): a mensagem é "Não encontramos a unidade informada. Se a tela acabou de abrir, espere um instante e tente de novo; se continuar, fale com o síndico.", sem "verifique a conexão" e sem 42501 no console.
- Portaria, Síndico, Subsíndico e ADM cadastram normalmente (habilitado após a carga, escolhem a unidade, cadastro concluído, console limpo). Conselho: sem botão.
- **Divergência com o pedido (a confirmar):** o **Zelador TEM** o botão "Cadastrar Veículo" e fica habilitado. O pedido dizia "Conselho/Zelador sem botão". O código (`podeCadastrar`) e a policy `vehicles_insert` (0041) incluem o Zelador de propósito, então tela e banco são coerentes. Se a regra é que o Zelador não cadastra, é preciso mudar as duas pontas. Não testei o cadastro completo do Zelador.

### 2) B-1b (PASSOU para o caso relatado; sobram contornos leves)
Testado por RPC `livro_publicar` (Síndico, Subsíndico e Conselho, em EQUIPE) e no editor. Recusados no banco e no editor: `fulano @ gmail . com`, `fulano  @  gmail  .  com`, com tab, com quebra de linha (`\n` e `\r\n`, inclusive entre `gmail` e `.`), com NBSP, espaço largo U+2003 e espaço ideográfico U+3000, largura total (`＠`, `．`, letras inteiras), `fulano . silva @ gmail . com`, MAIÚSCULAS, `[at]`/`[dot]`, `(at)`/`(dot)`, `.org`, `.br`, `.io`, `com . br`, com caractere de largura zero no meio, CPF com pontos e com espaços, telefone `11 91234 5678`.
- Editor (tela): para esses textos o botão Publicar fica desativado e aparece "Retire dados pessoais (CPF, telefone, e-mail) antes de enviar." Forçar o envio por `requestSubmit` não grava (0 mensagens).
- Passam (corretamente), no banco e no editor: "às 10h @ portaria. Obrigado", "Reunião às 19h30 @ salão. Obrigado", "Estarei @ portaria às 10h. Obrigada.", datas com barra, "R$ 150,00", "R$ 1.234,56", "08:00 às 18:00", "4 vagas, 12 carros e 45 reais", "www.condominio.com.br", "https://harmony.com/livro", "condominio . com . br" sem arroba, "http://localhost:3000/livro".

Contornos que ainda passam (todos LEVES; o filtro é um acelerador, como diz o comentário da migração):
- **B-1c.** Domínio fora da lista fixa (com, net, org, br, gov, edu, io, me, info, biz, co, app, dev): `fulano @ gmail . pt`, `. de`, `. xyz` passam.
- **B-1d.** `fulano @ gmail 。 com` (ponto ideográfico U+3002, que o NFKC não converte) passa.
- **B-1e.** `fulano ( @ ) gmail . com` e `fulano@@gmail.com` passam.
- **B-1f.** Ofuscação com palavras ou letras separadas (`fulano arroba gmail ponto com`, `g mail`, `c o m`) passa. Já era esperado.
- Falso positivo leve: `Falei com @ fulano. Com certeza resolvemos` e `Nos vemos @ garagem.Com cuidado` são recusados (arroba, nome, ponto e "com" na sequência). Raro; dá para tratar como aceitável.
- Editor e banco concordam em todos os casos (o editor limpa os invisíveis antes de testar, igual ao banco).

### 3) Livro por modo (PASSOU)
- DESLIGADO, `/livro`, `/livro/<uuid>` e `/livro/remocoes`: Morador, Inquilino, Zelador, Conselho, Subsíndico, Portaria e Provisório veem só "Página não encontrada", sem o título nem a frase do livro. O visitante sem login vai para `/login`. Síndico e ADM veem o painel "Quem pode usar o Livro", e `/livro/remocoes` mostra "Livro desligado" (L-i2 resolvido).
- EQUIPE ligado pelo painel como Síndico (com o diálogo "Mudar"): o banco confirma. Aviso do editor: "Modo de teste da equipe: só a gestão e o Conselho veem este livro, com seu nome..." (L-i1 resolvido; sumiu o "Este espaço é aberto"). Conselho e Subsíndico leem e têm editor/ciência; ADM lê e não escreve; Morador, Inquilino, Zelador e Portaria veem só o título e "O Livro de reclamações não está disponível agora" e não têm editor.
- ABERTO: "Aberto" fica desativado ("Ainda não liberado..."); clique forçado não abre diálogo nem muda o modo (continua EQUIPE, `liberado_para_abrir = false`). Voltei a DESLIGADO pelo painel.
- Informativo: em EQUIPE, quem não entra (Morador, Zelador, Portaria) ainda vê o título e a frase do livro com "não está disponível agora". Se a regra "nada aparece" valer para EQUIPE, também deveria virar "Página não encontrada". No pedido essa regra era só para DESLIGADO.

### 4) Patch do iPhone (PASSOU)
- Cartões do Início: folga entre o rótulo e o ícone de no mínimo 8 px (NOTIFICAÇÕES = 8 px; no Morador, "Minhas Multas" = 8 px) em 375 e 320 px, WebKit e Chromium, ADM, Síndico e Morador (12 combinações, 4 cartões cada, ícone sem sair da tela).
- Topo sob o header: `topo-sob-header.mjs` OK. Em `/`, `/reservas`, `/veiculos`, `/moradores`, `/mural` e `/usuarios` (375px, WebKit e Chromium): ao voltar ao topo, o conteúdo fica 24 px abaixo do header; depois de rolar ao fim, `focus()` por código leva o elemento a 129 px ou mais, sempre abaixo da base do header (65 px).
- Erro de validação: Veículos (Morador) foca o campo Placa e ele fica visível (nada o cobre). Reservas foca "Termo" (`reserva-termo`), visível na janela, WebKit e Chromium.
- **V8. LEVE/cosmético (novo).** Em Veículos no Chromium (375px), ao enviar vazio a Placa focada fica colada no topo do diálogo (35 px) e o rótulo "Placa do veículo" e o título rolam para fora. Não está sob o header (o diálogo tem camada acima dele). No WebKit o campo fica a 155 px.
- Desktop 1280x800 (`min-h-dvh`): sidebar continua fixa ao rolar (88 a 89 px do topo) com altura 696 (100dvh menos 6,5rem); páginas curtas (`/mural`, `/links`) têm corpo de 809 px (maior que a janela, sem rolagem horizontal; scrollHeight 809); `/` tem 1231 px. Sem efeito colateral visto.

### Resumo da rodada

| ID | Severidade | Situação |
|---|---|---|
| V7 | leve | corrigido |
| B-1b | leve | corrigido (espaços em volta de `@` e `.`) |
| L-i1, L-i2, `/livro` direto | informativo | corrigidos (DESLIGADO neutro, aviso de EQUIPE, "Livro desligado") |
| B-1c, B-1d, B-1e | leve (novo) | domínios fora da lista, `。`, `( @ )` e `@@` ainda passam |
| V8 | leve (novo) | Placa colada no topo do diálogo no Chromium |
| Zelador com botão Cadastrar Veículo | a confirmar | divergente do pedido, coerente com a policy |
| EQUIPE mostra título do livro a quem não entra | informativo | confirmar se é o desejado |

Não testado: aparelho iPhone real, safe-area e notch, conta "dono" (sem conta no seed) e produção (proibido). O Zelador não foi exercitado até o fim no cadastro de veículo.
