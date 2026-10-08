# QA rodada 2: Veículos & Garagem (cartão #91, Alternativa B) e regressão do Livro (L1 a L9)

Data: 2026-10-07. Ambiente: staging (app local, contas `*@staging.test`). Navegadores: Chromium e WebKit (Playwright), larguras 375, 600 a 1100 e 1280.
Estado final: seed rodado (`node scripts/seed-staging.mjs`), interruptor do Livro **DESLIGADO**, servidor parado, dados de teste que criei removidos.

## Veredito

- **Livro: L1 a L9 corrigidos.** Bateria completa: **1440 verificações, TUDO OK**. `livro.mjs` (212) TUDO OK, `livro-extra.mjs` (277) TUDO OK, `livro-corrida.mjs` 3 execuções (18 rodadas de resumo e 18 de citação) TUDO OK. Pendências leves no Livro: foco no WebKit (V-L1) e 2 expectativas desatualizadas em `livro-tela.mjs`.
- **Veículos: a tela nova cumpre quase tudo, mas há 2 falhas graves e 3 leves.** Graves: "Nenhum veículo cadastrado ainda" falso durante a carga (V1) e o botão "Cadastrar Veículo" cortado, com rolagem horizontal da página, de 640px a 1279px (V2).

Contagem: 0 bloqueia, 2 graves, 5 leves.

## PARTE 1: Veículos & Garagem

### Falhas

**V1. GRAVE: durante a carga a tela afirma "Nenhum veículo cadastrado ainda." (esqueleto quase não aparece).**
Causa observada: `isLoading` do `AppContext` vira `false` quando o perfil da sessão chega (`onAuthStateChange`), antes de `loadAllData()` trazer os veículos. Entre os dois eventos `vehicles` é `[]`.
Passos: entrar como Portaria ou Síndico e abrir `/veiculos`. Medi, sem simular rede lenta, a mensagem falsa visível de ~270 ms até ~780 ms (Portaria e Síndico). Com `GET /rest/v1/vehicles` atrasado (route do Playwright), ela fica na tela o tempo todo e o contador diz "0 veículos". Para o Morador sem veículos aparece "Sua unidade não tem veículos cadastrados" com o botão Cadastrar, nos mesmos instantes.
Esperado (pedido): esqueletos e nada de "sem veículos" durante a carga. Os 4 esqueletos existem no código, mas só aparecem enquanto o perfil carrega. Risco real: porteiro com internet lenta lê "nenhum veículo" e age sobre isso.
Obs.: com `[]` devolvido pela API (vazio de verdade) a tela mostra corretamente "Nenhum veículo cadastrado ainda." (gestão) e o Morador vê o botão de cadastrar (44px).

**V2. GRAVE: de 640px a 1279px a página ganha rolagem horizontal e o botão "Cadastrar Veículo" fica cortado.**
Larguras de `scrollWidth` medidas com Síndico: 600 ok; 640 -> 725; 700 -> 780; 768 -> 822; 820 -> 854; 1000 e 1023 ok; 1024 -> 1086; 1100 -> 1132; 1280 ok. Vale para todo perfil que vê o botão (Síndico, Subsíndico, ADM, Portaria, Zelador, Morador). Conselho (sem o botão) não estoura.
Passos: logar como Síndico, abrir `/veiculos` em 768px (tablet pedido). O botão "Cadastrar Veículo" fica com o lado direito além da tela (corte visível no cabeçalho). O cabeçalho `flex-row` (título + subtítulo + dois botões) não quebra linha entre `sm` e `xl`. O `webkit-mobile.mjs` não pega porque só mede 375.
Obs.: o contêiner do cabeçalho é igual ao de antes do #91 (não conferi se o estouro já existia).

**V3. LEVE: girar o aparelho com a folha aberta deixa um modal invisível preso.**
Passos: 800px de largura, abrir a folha de um veículo, redimensionar para 1280px (iPad em retrato para paisagem). A folha é `lg:hidden`, mas o estado `aberto` continua: o fundo segue com `overflow:hidden` (sem rolagem), o foco fica no `body` e Tab não chega a lugar nenhum, até apertar Esc. Esperado: fechar a folha ao cruzar 1024px.

**V4. LEVE: placa duplicada gera `console.error` e HTTP 409 no console.**
Cadastrar placa já existente (Morador ou Inquilino) mostra a mensagem certa ("Esta placa já está cadastrada."), mas o console registra `insertVehicle: ... 23505`. É um erro esperado (mesma família do L6 do Livro). A mensagem também aparece duas vezes (no campo e na faixa do formulário).

**V5. LEVE: divergências com o protótipo (`mockup-veiculos.html`, Alternativa B).**
- Título da página: o protótipo diz "Veículos & Garagem"; a tela mantém "Cadastro e Controle de Veículos".
- Unidade: protótipo "Apto 403 · A"; app "A-403".
- Tablet: o protótipo fala em "lista do celular com uma linha mais rica"; em 768px o app usa o mesmo cartão do celular.
- Folha em 768px ocupa a largura toda (botão Editar esticado); funciona, só destoa.
- Fora isso o cartão (chip da placa com ícone do tipo, unidade à direita, nome com selo Visitante, modelo e cor) e a folha batem com o protótipo.

**V6. INFORMATIVO (conhecida, reconfirmada): o banco ainda deixa a Portaria remover qualquer veículo e o Morador remover o visitante da própria unidade.** Por REST, `DELETE /vehicles` da Portaria devolveu 1 linha. A tela esconde as ações, o que é a regra decidida pelo dono em 2026-10-04; o pedido desta rodada pedia que o banco negasse edição para Portaria, Conselho e Zelador, e isso nega (abaixo). Fica registrado só porque agora a regra "Portaria sem ações" está na especificação da tela.

### O que passou (Veículos)

Cartão e folha (375px, Síndico, Morador, Portaria, Conselho, Zelador testados):
- Cartão com 3 linhas (placa em chip com ícone do tipo + unidade; nome com selo Visitante; modelo · cor), altura ~110px, sem texto nem botão "Ligar", sem link ou botão dentro do cartão (é um botão só). Rótulo acessível: "Veículo STG1A01, unidade A-101, nome[, visitante]. Abrir detalhes".
- Folha: placa, Fechar, veículo e cor com o tipo, unidade, vaga, morador, telefone como `tel:11911111111`, "Sem telefone" sem link quando vazio ou só espaços. Ações: Editar veículo e Remover (só texto vermelho) para Síndico, Subsíndico, ADM e Morador nos próprios; **visitante do Morador: 0 ações**; Portaria, Conselho e Zelador: 0 ações.
- Foco inicial em Fechar; Tab e Shift+Tab ficam presos dentro da folha (8 Tab seguidos); Esc, toque fora e Fechar fecham; foco volta ao cartão; rolagem do fundo travada e liberada; Enter e Espaço abrem o cartão; alvos >= 44px; padding inferior respeita `safe-area` (20px, `max(1.25rem, env(safe-area-inset-bottom))`).
- Nome com 80 caracteres: cartão trunca com reticências (mesma altura), folha quebra linha, sem estouro horizontal.
- `webkit-mobile.mjs`: TUDO OK (inclui `/veiculos` para Síndico, Morador e Portaria).

Busca, filtros, ordem, contador (Síndico, 32 veículos):
- Busca ignora hífen, espaço e caixa e acentos: "stg-1a01", "STG 1A01", "stg1a01" -> 1; "a-101" e "A101" -> 4; nome ("maria", "Conceição", "conceicao") -> 1; só espaços -> lista toda.
- Com 1 resultado a folha **não** abre sozinha (cartão recebe só destaque de borda). Contador em `aria-live="polite"` ("1 de 32 veículos", "Carregando veículos…").
- Sem resultado: "Nenhum veículo encontrado para “zzzz”." + "Limpar busca" (zera a busca e o filtro e põe o foco na busca).
- Filtros em uma linha rolável (`overflow-x:auto`) com contagem (Todos 32, Carro 21, Moto 10, Outro 1); "Outro" some quando 0 (Morador: Todos 4, Carro 3, Moto 1).
- Ordem padrão bloco, apto, placa (A-101, A-102, A-103, A-104; placa ascendente dentro da unidade).
- Morador com até 3 veículos (Inquilino, 2): sem busca nem filtros; Morador proprietário (4 com o visitante): com busca e filtros.

Desktop 1280px:
- Tabela com Placa, Unidade e Morador ordenáveis por clique, Enter e Espaço; `aria-sort` ascending/descending/none corretos; telefone formatado "(11) 93333-3333" com `tel:`; "Sem telefone" sem link; rodapé "Mostrando 6 de 32 veículos" respeita a busca.
- Atalho "/" foca a busca e a dica "atalho: /" aparece; "/" dentro do campo digita o caractere.
- Ações na tabela: Síndico, Subsíndico e ADM em todos; Morador só nos próprios (não no visitante); Portaria, Conselho e Zelador: nenhuma ação (só os 3 botões de ordenar).
- Impressão (`emulateMedia print`, 1280 e 375): sempre a tabela (cartões ocultos), 32 linhas, cabeçalho oficial, sem coluna Ações; PDF conferido. Obs.: com busca ativa a impressão sai filtrada.

Ponta a ponta (375px):
- Cadastrar (Síndico): erros de validação com foco no primeiro campo; marca só com espaços recusada; duplo clique em Salvar cria 1 veículo; aparece na lista com o telefone formatado.
- Editar pela folha (fecha a folha, abre o formulário com os dados; cor alterada aparece na folha); Esc cancela e devolve o foco ao cartão.
- Remover: diálogo "Remover este veículo?" sem a placa; "Voltar" e Esc cancelam e não removem; confirmar com duplo clique remove 1 vez ("Veículo removido." e foco no aviso); banco confirmado vazio.
- Morador e Inquilino: cadastrar (sem campos da equipe), placa duplicada, editar e remover o próprio, tudo ok e conferido no banco.
- Offline (desktop): salvar mostra "Não foi possível salvar. Verifique a conexão e tente de novo.", modal permanece aberto e funciona ao voltar a rede; remover offline mostra o erro fixo e mantém a linha.
- Provisório: "Disponível após a validação do seu cadastro" (sem lista). Visitante sem login em `/veiculos`: vai para `/login`.
- Console e rede sem erro nos fluxos normais (os únicos: 409 de placa duplicada e as quedas simuladas de rede).

Por REST com o token de cada perfil (o banco, não a tela, decide):

| Ação | Resultado |
|---|---|
| Morador edita ou remove veículo da outra unidade | 0 linhas (negado) |
| Inquilino edita ou remove veículo da A-101 | 0 linhas (negado) |
| Conselho, Zelador, Portaria, Provisório editam veículo | 0 linhas (negado) |
| Conselho, Zelador, Provisório removem | 0 linhas (negado) |
| Portaria remove | **1 linha (V6)** |
| Morador muda vaga ou status do próprio | negado, valores intactos |
| Morador edita o visitante da própria unidade | negado ("Morador não pode alterar veículo de visitante") |
| Morador remove o visitante da própria unidade | **1 linha (V6)** |
| Insert: Conselho e Provisório negado (42501); Morador em outra unidade negado; Síndico, Subsíndico, ADM, Portaria, Zelador e Morador na própria permitidos | conforme a regra |
| Síndico, Subsíndico e ADM editam e removem | ok |
| Leitura: gestão, Portaria, Conselho, Zelador 34 (com meus fixtures); Morador 4; Inquilino 2; Provisório 0; sem login 0 e sem insert nem delete | ok |

### Não testei / limites
- Tela real em iPhone: só WebKit do Playwright. Barra do Next dev ("N") cobre o canto inferior esquerdo em dev e atrapalha clique automatizado; ignorei como artefato de dev.
- Contagem exata de safe-area em aparelho com notch: só conferi a regra CSS.
- Usuário "dono" (Proprietário Ausente) não tem conta no seed.

## PARTE 2: Livro de reclamações, regressão L1 a L9

| # | Resultado | Como confirmei |
|---|---|---|
| L1 resumo diário duplicado | **Corrigido** | `livro-corrida.mjs` x3 (6 publicações simultâneas por rodada): 18 de 18 rodadas com exatamente 1 aviso ao Síndico |
| L2 "Avisar a gestão" duplicado | **Corrigido** | `livro-extra.mjs` caso 4d + meu teste: 5 pessoas sinalizando ao mesmo tempo, 8 rodadas, sempre 1 aviso; 3 remoções simultâneas = 1 registro |
| L3 citação de mensagem removida legível por REST | **Corrigido** | `livro_citacoes` agora nega SELECT direto (42501) para Morador, Inquilino, Conselho, Síndico, Zelador, Portaria e sem login; a RPC segue escondendo o citado |
| L4 só U+FE0F aceito; NUL | **Corrigido** | 30 x U+FE0F -> `texto_vazio`; texto real + FE0F e emoji ❤️ passam; 20 x U+200B recusado. NUL por RPC devolve a mensagem técnica do Postgres, mas `src/lib/livro.ts` a mapeia para texto amigável; pela tela o navegador remove o NUL antes de enviar |
| L5 contador em UTF-16 | **Corrigido** | 600 emojis mostram 600/1000 com Publicar ativo; 1001 mostra 1001/1000 e desativa; ❤️ x12 = 24; contador = caracteres guardados (conferido no banco). Obs.: o banco remove o ZWJ, então a família 👨‍👩‍👧‍👦 vira 4 emojis soltos (contador 4 por família, igual ao guardado). Cosmético |
| L6 erros esperados com `console.error` | **Corrigido** | `erroEsperado()` em `src/lib/supabase/livro.ts`; recusa por CPF não gera `console.error` do app. Sobra só a linha do próprio navegador "Failed to load resource ... 400" (a RPC responde 400; o app não controla) |
| L7 `/livro/<não-uuid>` | **Corrigido** | `/livro/lixo`, `/livro/123` e `/livro/';drop` mostram "Este tópico não existe mais."; sem erro no console |
| L8 apagar resposta volta à 1ª página | **Corrigido** | tópico com 35 respostas, "Ver mais respostas", respondo (36) e apago a minha: continuam as 36 na tela, com "Você removeu esta mensagem" |
| L9 autor que mudou de perfil | **Corrigido** | ex-Conselho virado Portaria apaga a própria (`ok:true`) e não publica (`sem_permissao`); conta desativada não apaga (`sem_permissao`) |
| Duplo clique em Remover | **Passou** | `livro-tela.mjs`: 1 registro de remoção em desktop e em celular; remoção paralela por RPC = 1 registro |

Scripts: `livro.mjs` 212 verificações TUDO OK; `livro-extra.mjs` 277 TUDO OK; `livro-corrida.mjs` 3x TUDO OK; **`bateria.mjs` 1440 verificações, TUDO OK** (as linhas com o texto "FALHA" no log são nomes de teste do cenário de transferência, não falhas).

`livro-tela.mjs` (302 OK, 4 "FALHA" analisadas):
- **V-L1 LEVE (real, só WebKit): foco não volta ao botão "Citar" ao fechar a folha de citação.** No Chromium volta; no WebKit (Safari do iPhone) o foco cai no `body` (Esc e também o botão "Concluir"), porque o toque não foca o botão e a folha restaura o foco no elemento ativo na abertura. A tela de Veículos resolveu isso guardando o gatilho; o Livro não. Pode ser anterior às correções.
- T-1 (defeito de teste): `/livro/remocoes` por Conselho e Subsíndico "não abre". A spec (linha 206) diz que Síndico, Subsíndico, ADM e Conselho leem o registro; a tela abre para os quatro e mostra "Sem acesso" ao Morador. A expectativa do script está desatualizada.
- T-2 (defeito de teste): "clicar no aviso abre o tópico" falha porque o script clica no título do aviso. O link é "Ver detalhes →" e ele abre `/livro/<tópico>` corretamente.

Outros achados do Livro (informativos): a desistência do foco acima; o Síndico ainda vê "Avisar a gestão" (observação antiga).

## Resumo das falhas por severidade

| ID | Severidade | Resumo |
|---|---|---|
| V1 | grave | "Nenhum veículo cadastrado ainda" falso durante a carga; esqueleto só cobre a carga do perfil |
| V2 | grave | 640 a 1279px: botão Cadastrar Veículo cortado e rolagem horizontal |
| V3 | leve | folha aberta + girar para >=1024px: modal invisível, scroll travado e foco preso |
| V4 | leve | placa duplicada: `console.error` e mensagem duplicada |
| V5 | leve | divergências com o protótipo (título, formato da unidade, tablet) |
| V6 | informativo | Portaria e Morador (visitante próprio) removem por API (decisão anterior do dono) |
| V-L1 | leve | Livro: foco não volta ao "Citar" no WebKit |

Arquivos: relatório em `/Users/filipevieira/Apps/Harmony/docs/qa/2026-10-07-veiculos-e-livro-rodada2.md`. Os scripts que escrevi ficaram no diretório temporário da sessão, não no repositório.
