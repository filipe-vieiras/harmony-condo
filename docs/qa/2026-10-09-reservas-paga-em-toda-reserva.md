# QA: Reservas, Fase 1 da regra de valor ("Paga em toda reserva")

Data: 2026-10-09. Ambiente: staging (app local, contas `*@staging.test`). Commits testados: `e118bcb` e `dd35e49` (branch `develop`). Navegadores: Chromium (1280x800 e 375x812) e WebKit (375x812), via Playwright. Perfis: Síndico, ADM, Morador, Portaria (tela); Síndico, Subsíndico, ADM, Conselho, Portaria, Morador, Zelador, Provisório e Inquilino (API, com o token de cada um).
Estado final: seed rodado antes e depois (`node scripts/seed-staging.mjs`), servidor parado, nada commitado.

## Veredito

**Aprovado com ressalvas: o bloco "Valor de uso" funciona como especificado, mas 2 critérios da spec não foram atendidos. Não recomendo liberar para produção sem corrigir o texto do aviso ao morador (G1).**

Contagem: 0 bloqueia, 1 grave, 3 leves (L2 é anterior a esta entrega).

## Falhas

**G1. GRAVE: depois de reservar, o morador lê "A administração lança o valor na sua taxa."**
O aviso de sucesso de um pedido com valor ainda usa o texto antigo. Contradiz a decisão D2 (o síndico cobra por fora) e o critério 10 da spec ("não diz que a administradora lança na taxa"). É texto sobre cobrança, dinheiro real, e o morador vai entender errado quem cobra.
Origem: `src/context/AppContext.tsx`, linha 1438, constante `aviso` do `createReservation`.
Passos: entrar como `morador@staging.test`, abrir `/reservas`, escolher um espaço pago (ex.: espaço com "Paga em toda reserva"), clicar num dia livre, preencher horário e pessoas, aceitar o termo e enviar.
Obtido: "Reserva confirmada! Valor desta reserva: R$ 90,00. A administração lança o valor na sua taxa." (para espaço que confirma na hora; para o que exige aprovação a mesma frase vai dentro de "Pedido enviado! ...").
Esperado: "O síndico combina a cobrança com você." (mesma frase do formulário).

**L1. LEVE (critério 7 e design 2.2 item 8 não atendido): a tela não avisa "vale só para novos pedidos".**
Passos: Síndico, editar um espaço que já tem reservas, trocar a regra (ex.: Faixa para "Paga em toda reserva") e olhar o bloco "Valor de uso".
Obtido: nenhuma nota de efeito. `grep` em `src` não acha esse texto. O dado está correto: as reservas existentes não mudaram (conferido, ver "O que passou").
Esperado: nota azul "Mudar a regra vale só para novos pedidos. Reservas já feitas mantêm o valor de quando foram pedidas."

**L2. LEVE (já existia antes desta entrega): duplo clique em "Cadastrar espaço" cria o espaço duas vezes.**
Passos: Síndico ou ADM, novo espaço, preencher, dar duplo clique no botão final. Reproduzido em Chromium desktop, Chromium 375 e WebKit 375: 2 linhas em `spaces` com o mesmo nome. O botão não tem trava de envio nem o estado "Salvando…" que o design (seção 2.3) prevê. Não é regressão (o código anterior também não tinha), mas na edição o risco é menor e na criação gera duplicata.

**L3. LEVE (critério 5 da spec): o formulário do morador não mostra o total.**
Com espaço pago e higienização R$ 80, o modal mostra "Valor de uso: R$ 100,00..." e, em linha própria, "Taxa de higienização: R$ 80,00", mas nenhum total. O design diz para não somar numa linha só; o critério de aceite diz "os dois valores e o total". Decidir com o PM se o total é necessário. Valor e higienização estão corretos e separados.

Observação (não é falha): o rodapé "O valor é calculado pelo Dona Wanda e cobrado pelo síndico. O Dona Wanda não recebe pagamento." (spec, seção 3, item 4) não existe no formulário do morador; o morador só vê "O síndico combina a cobrança com você." junto do valor. Não bloqueia, mas o item 4 da spec pede o rodapé. Conferir com o PM.

## O que passou

Roteiro (Síndico, ADM; desktop e 375px; Chromium e WebKit). Resultado igual nos três ambientes, salvo o que está dito.

1. Espaço novo: abre com "Grátis" marcada, sem campos de valor, frase "Grátis para qualquer número de pessoas.", resumo "Valor: grátis". PASSOU.
2. "Paga em toda reserva": só "Valor (R$)"; digitar 15000 mostra `150,00`; frase "Todas as reservas: R$ 150,00."; resumo "R$ 150,00 por reserva". Salvar sem valor (acordeão fechado): o acordeão abre e o foco vai para `#espaco-faixa-valor` com `aria-invalid="true"` e `aria-describedby` apontando para a ajuda e o erro "Informe o valor em reais, maior que zero.". Nada é gravado nesse caso. Salvar com valor grava `faixa_gratis_ate = 0`, `faixa_valor = 150`; reabrir mantém a regra e o valor. PASSOU.
3. Espaço antigo com limite 0 (criado pela API com o token do Síndico; o banco aceita): abre como "Paga em toda reserva", valor 90,00, sem erro. Trocar para "Grátis até certo número" deixa o limite vazio e sem erro até tentar salvar. PASSOU.
4. Espaço com limite 5 e valor 100,00: abre em "Grátis até certo número", limite 5, valor 100,00, frase "Até 5 pessoas: grátis. Acima de 5: R$ 100,00.". PASSOU.
5. Erros da faixa: vazio mostra "Informe quantas pessoas podem usar sem pagar. Mínimo 1." e leva o foco ao campo; 0 manda escolher "Paga em toda reserva"; limite igual ou maior que a capacidade mostra "O limite grátis precisa ser menor que a capacidade do espaço (20 pessoas)..."; valor vazio ou "000" mostra "Informe o valor em reais, maior que zero." e o foco vai ao campo. Colar "abc12" no limite fica "12". PASSOU.
6. Banco, como Morador (pela tela): "QA Paga" com 1 e com 20 pessoas gravam `valor_uso = 150` nos dois; espaço antigo (limite 0) com 1 e 20 pessoas grava 90 nos dois; faixa 5/R$ 100 grava 0 com 5 pessoas e 100 com 6; Salão (limite 10) grava 0 com 10 e 150 com 11. A higienização (80 e 150) vai em `taxa_higienizacao`, fora do valor. As 5 reservas do seed: `valor_uso`, `taxa_higienizacao`, `convidados_estimados` e status idênticos antes e depois (0 alteradas, soma de `valor_uso` antes 450). Mudar um espaço de Faixa para Paga com reservas feitas: reservas antigas intactas (0 e 100). PASSOU (a nota na tela é a falha L1).
7. Aviso âmbar de "Confirma na hora": com "Grátis" só o aviso antigo; com regra paga acrescenta "Reservas com valor serão confirmadas sem passar pela equipe, e o síndico combina a cobrança com o morador." PASSOU.
8. 375px (Chromium e WebKit): sem rolagem horizontal (Chromium `scrollWidth` 375; WebKit 369, dentro da largura), rádios com 54 a 90px de altura de alvo, campos com 44px e fonte 16px, foco visível (anel azul nos campos; contorno nativo no rádio), setas navegam entre os rádios sem tirar o foco do grupo, Tab sai do grupo para o campo de valor, label inteiro clicável (clicar no texto de apoio marca o rádio), `fieldset` com `legend` "Quando este espaço é pago?", rádios com `aria-describedby` para o apoio, frase-resumo com `aria-live="polite"`, Esc fecha o modal. Console sem erros e sem resposta 4xx em todas as execuções. `scripts/qa/webkit-mobile.mjs`: TUDO OK (inclui `/reservas` do Síndico e do Morador). PASSOU. Obs.: no WebKit as setas não dão a volta do último para o primeiro rádio (comportamento nativo do Safari, não do app).
9. Textos: o bloco usa "Dona Wanda" e "a cobrança é feita pelo síndico, por fora". "Harmony" na tela só em "Condomínio Harmony Residence" e no rodapé "Harmony Residence • Versão 1.0" (nome do cliente). Lista de espaços (`EspacosCadastrados`): "Grátis", "R$ 90,00 por reserva", "Grátis até 10 pessoas, depois R$ 150,00". Detalhes (`DetalhesEspaco`): "R$ 90,00 por reserva" e "Grátis até 10 pessoas · R$ 150,00 acima". Cartão do espaço para o morador: "R$ 150,00 por reserva". Formulário do morador: "Valor de uso: R$ 150,00. O síndico combina a cobrança com você." (sem "acima de N"). Portaria e Síndico no "Registrar reserva": "...O síndico combina a cobrança com o morador.". PASSOU.

Permissões e API (critérios 8 e 9):
- Alterar o espaço por API (`update` com o token de cada perfil): Síndico, Subsíndico e ADM alteram (1 linha); Conselho, Portaria, Morador, Zelador, Provisório e Inquilino recebem 0 linhas (negado). Valor restaurado depois. PASSOU.
- `valor_uso = 1` enviado no `insert` da reserva: Morador, Portaria, Conselho, Síndico, ADM e Subsíndico gravaram 150 (o valor vindo do cliente foi ignorado). O Inquilino levou 42501 de RLS porque usei a unidade A-101, que não é a dele (erro do meu roteiro, não do app; não repeti). PASSOU.
- Na tela, Portaria, Morador, Conselho e Zelador não veem "Cadastrar espaço" nem "Editar". Visitante sem login em `/reservas` vai para `/login`. PASSOU.

Tente quebrar:
- Valor colado "R$ 1.500,50 abc" vira 1.500,50; "0000150" vira 1,50; 20 dígitos são cortados em 9 dígitos (9.999.999,99). PASSOU.
- Trocar de regra com valores digitados: o valor fica ao alternar Grátis, Faixa e Paga e volta ao reescolher "Paga". PASSOU.
- Rede indo embora ao salvar (offline simulado): o modal fica aberto, mostra "Não foi possível salvar o espaço agora. Seus dados continuam aqui, tente de novo." e mantém o valor digitado. PASSOU.
- Duplo clique em Salvar: falhou (L2).
- `node scripts/qa/valor-espaco.mjs`: "valor-espaco: ok". PASSOU.

## O que ficou sem testar

- Leitor de tela real (NVDA, VoiceOver): só conferi `aria-live`, `aria-describedby`, `fieldset` e `legend` no DOM.
- Subsíndico na tela (só por API); Conselho e Zelador só confirmei que não veem os botões.
- Teclado virtual aberto no celular de verdade (só emulação de 375px).
- Criar e editar o espaço com o cursor em "Salvar espaço" por Enter no teclado (usei clique).
- Fase 2 (cota, percentual, Configurações): fora do escopo.
- Tela de detalhes do espaço para "QA Faixa 5" e "Churrasqueira" (a captura do texto falhou nesses dois; os de Limite 0 e do Salão foram lidos).

## Evidências e reprodução

Capturas e scripts de apoio ficaram fora do repositório (pasta temporária da sessão), por isso não estão em `docs/qa/`. Os passos acima bastam para reproduzir. Dados criados no staging: espaços "QA Antigo Limite 0", "QA Faixa 5", "QA Paga D/M/W" (alguns duplicados pelo L2), reservas "QA ..." e 8 reservas do Morador. O seed foi rodado de novo ao final e recriou a base (5 reservas do seed, soma de `valor_uso` 450).

## Reteste (09/10/2026)

Ambiente: staging, app local, correções não commitadas sobre `dd35e49` (AppContext, reservas/page, valorEspaco, valor-espaco.mjs). Seed rodado antes e depois, servidor parado. Chromium 1280 e 375, WebKit 375 (Playwright).

**Veredito geral atualizado: APROVADO com 2 observações leves novas. G1, L1 e L2 corrigidos. Restam L3 e o rodapé "Dona Wanda não recebe pagamento" (decisão de PM, da rodada anterior).**

| Item | Veredito | Evidência |
|---|---|---|
| G1 aviso de reserva paga | PASSOU | Morador, espaço pago que confirma na hora: "Reserva confirmada! Valor desta reserva: R$ 90,00. O síndico combina a cobrança com você." Espaço com aprovação (e Salão de Festas, faixa): "Pedido enviado! Valor desta reserva: R$ 90,00 (R$ 150,00 no Salão). O síndico combina a cobrança com você. A equipe vai analisar e você será avisado da decisão." Nenhum "administração lança" nem "taxa" (fora "higienização"). Aviso do síndico ao aprovar ("Pedido aprovado."), recusar ("Pedido recusado.") e cancelar ("Reserva cancelada. O morador foi avisado."), e notificações no banco (confirmada, aprovada, recusada com motivo, cancelada com motivo, nova solicitação para síndico/zelador): sem "taxa" nem "lança". `grep` em `src`: sem "lança". Obs.: no pedido com aprovação o aviso não "termina" na frase da cobrança, há mais uma frase sobre a análise; a frase da cobrança está intacta. |
| L1 nota "vale só para novos pedidos" | PASSOU | Editar sem mexer: sem nota. Paga para Grátis, para Faixa e valor 90 para 91: nota aparece; voltar ao original: some. Cadastrar espaço: nunca aparece (alternando as 3 regras). `role="note"`, nenhum `aria-live` na nota nem em ancestrais (o `aria-live` é só o da frase-resumo, que já existia). Fica entre a frase-resumo e "A taxa de higienização não entra neste valor". Contraste 5,29:1 (12px, azul sobre azul claro), texto exato da spec. 375px: nota quebra em 3 linhas, sem rolagem horizontal (scrollWidth 375), igual em Chromium e WebKit. |
| L2 duplo clique | PASSOU | `dblclick` real em "Cadastrar espaço" e em "Salvar espaço", com rede atrasada 2,5 s, nos 3 ambientes: 1 POST, 1 PATCH, 1 linha no banco por espaço (conferido com leitura). Botão vira "Salvando…", campos, Cancelar e Excluir espaço ficam desabilitados, texto dos campos com contraste 17,8:1. Offline simulado (duplo clique): mostra "Não foi possível salvar o espaço agora. Seus dados continuam aqui, tente de novo.", botão volta a "Salvar espaço" habilitado (Chromium e WebKit, desktop e 375). Console limpo (só os erros de rede esperados do offline). |
| Regressão | PASSOU | `valor-espaco.mjs`: ok (inclui `regraDeValorMudou`). `webkit-mobile.mjs`: TUDO OK. Casos 1 a 5: padrão "Grátis" sem campos de valor, "Paga" só com valor (15000 vira 150,00), erros de valor vazio, limite vazio, limite igual à capacidade (mensagens e foco corretos), "abc12" vira "12", Esc fecha, console limpo. Valor gravado: espaço "Paga" R$ 90 com 1 pessoa e com 20 pessoas: `valor_uso` 90 nos dois. |

Observações novas (leves, não bloqueiam):
- **L4.** Durante "Salvando…" os botões desabilitados ficam com opacidade 0,7: "Cancelar" cai para 3,6:1 e "Cadastrar espaço" para 4,5:1 no desktop (5,9:1 no 375). Controle desabilitado é isento na WCAG, e a leitura é possível, mas fica abaixo de 4,5:1.
- **L5.** O botão "Fechar" (X) do cabeçalho do modal continua ativo durante o salvar. Clicar nele fecha o modal; o salvamento termina mesmo assim (1 PATCH, dado gravado), mas a pessoa não vê o resultado nem o erro, se houver. Sugestão: travar o X e o Esc também, ou manter como está e avisar.
- A mensagem de campo obrigatório nativa ("Please fill out this field.") aparece em inglês no Chromium com o idioma do navegador em inglês ao salvar espaço sem descrição; vem do navegador, não do app (descrição é obrigatória no cadastro).

Não testado: leitor de tela real, Excluir espaço em si, Subsíndico/Conselho na tela, WebKit desktop, teclado virtual real, cancelamento pelo próprio morador (a tela só oferece cancelar à gestão).

Dados deixados no staging: espaços "QA Paga Imediata/Aprovacao", "QA L2 ..." e reservas de teste; o seed foi rodado de novo ao final e recriou a base.
