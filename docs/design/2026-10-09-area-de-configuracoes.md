# Área de Configurações (v1: cota condominial de referência) — especificação de design

Data: 2026-10-09 · Autor: designer · Status: proposta, pronta para implementar após os pontos da seção 10 · Sem implementação, sem dados reais.

Decisões do dono (09/10/2026): (1) a cota é **única do condomínio**, um valor usado como base de cálculo dos percentuais, não por unidade; (2) a reserva é feita na plataforma e o síndico cobra por fora; (3) o síndico cadastra a cota numa **nova área de Configurações**, só para Síndico, Subsíndico e ADM, pensada para receber outras configurações no futuro.

Relacionados: `docs/design/reservas/2026-10-09-regra-de-valor.md` e a atualização `docs/design/reservas/2026-10-09-regra-de-valor-atualizacao-cota-unica.md` (valor em percentual da cota) e `docs/specs/2026-10-09-reservas-valor-pago-e-percentual.md` (spec do PM). Spec de produto desta área: `docs/specs/2026-10-09-area-de-configuracoes.md`.

## 0. Recomendação em uma tela

1. **Item de menu "Configurações"**, ícone `Settings` (engrenagem, lucide), **último da lista**, depois de "Autocadastro", visível só para `ADMIN_ROLES` (Síndico, Subsíndico, ADM). Rota `/configuracoes`. Sem selo de contagem.
2. **Página com cartões por assunto.** Na v1 há um só: "Reservas de espaços" com o campo "Cota condominial de referência". O padrão de cartão (cabeçalho cinza em caixa-alta + corpo) é o mesmo de `/usuarios`, para crescer por repetição, sem reinventar a tela.
3. **Modo leitura primeiro, edição sob demanda.** Com cota cadastrada, a tela mostra o valor grande e "Atualizada em 09/10/2026 por Nome", com botão "Alterar cota". A edição pede **confirmação que explica o efeito**: vale para novos pedidos; reservas já feitas mantêm o valor. O primeiro cadastro não pede confirmação (não há nada a perder).
4. **A cota nunca fica "vazia" depois de cadastrada.** Não existe "remover cota": só trocar por outro valor maior que zero. Isso elimina o estado perigoso "espaço percentual sem base".

## 1. O que existe hoje (conferido no código)

- `src/components/layout/Sidebar.tsx`: lista `navItems` com `label`, `href`, `icon` (lucide), `roles` e opcionais `badgeCount`. Último item hoje: "Autocadastro" (`ClipboardCheck`). "Usuários & Convites" (`UserCog`) e "Autocadastro" usam `roles: [...ADMIN_ROLES]`. O destaque do item ativo usa `pathname.startsWith(href)`, então `/configuracoes` e subrotas futuras funcionam sem mudança. O menu do celular é o mesmo `Sidebar` com `onCloseMobile`; alvos já têm `min-h-11`.
- `src/app/usuarios/page.tsx` (padrão de gestão): título `h1` com ícone `text-accent` + frase de apoio `text-xs text-slate-500`; cartões `rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden` com cabeçalho `border-b bg-slate-50/75 p-4` e `h2` `text-xs font-bold uppercase tracking-wider text-slate-800`; mensagem de retorno `role="status"` ou `role="alert"` com ícone, fechável; bloqueio por perfil com cartão âmbar "Área Restrita" (ícone `Lock`); diálogos de confirmação via `useDialog().confirm({ title, message, confirmLabel, cancelLabel, destructive })`; botão primário `bg-primary ... hover:bg-primary-hover`, `min-h-11 sm:min-h-0`.
- Rótulo do app a corrigir junto: o rodapé do `Sidebar` ainda diz "Harmony Residence • Versão 1.0" e o `alt` do logo diz "Harmony Residence". Isso é nome do condomínio cliente, não do produto; fora do escopo desta tela, mas anote para a mesma entrega.

## 2. Menu

| Item | Decisão |
|---|---|
| Nome | **Configurações** (uma palavra, entendida por todos; a página cresce sem renomear) |
| Ícone | `Settings` (lucide). Não usar `Sliders` nem `Wrench` (o Zelador usa `Wrench`) |
| Posição | **Última**, depois de "Autocadastro". Configuração é a tarefa menos frequente; tarefas do dia (Usuários, Autocadastro) ficam acima |
| Quem vê | `roles: [...ADMIN_ROLES]` (Síndico, Subsíndico, ADM). Portaria, Conselho, Zelador e Morador **não** veem o item |
| Selo | Nenhum (não há pendência a contar) |
| Cabeçalho do celular | Sem mudança; o item aparece no mesmo menu com animação e botão de fechar |

Observação: com o item novo, o administrador passa a ter 11 itens. No celular de 375px o painel precisa rolar até o último; confirmar no QA (critério 14).

## 3. Estrutura da página

Rota: `/configuracoes`. Envolvida por `AppShell`, como as demais.

```
h1  [Settings] Configurações
p   Ajustes do condomínio que valem para todo o portal.

[ mensagem de retorno (sucesso/erro), quando houver ]

+-- cartão de seção ----------------------------------------------+
| RESERVAS DE ESPAÇOS                    (cabeçalho cinza, caixa-alta) |
|-----------------------------------------------------------------|
| corpo: um bloco por configuração (v1: só a cota)                 |
+-----------------------------------------------------------------+
```

Regras do padrão (para a v2, v3...):
1. **Um cartão por assunto** (ex.: "Reservas de espaços", futuramente "Multas", "Avisos"). Título do cartão em caixa-alta, igual aos cartões de `/usuarios`.
2. **Dentro do cartão, um bloco por configuração**, separados por `border-t border-slate-100 pt-4`. Cada bloco tem: título (`h3`, `text-sm font-bold text-slate-900`), uma frase do que a configuração faz, o controle e a linha "Atualizada em ... por ...".
3. **Cada cartão tem `id`** (`#reservas`) e o título é `h2`, para link direto e para o leitor de tela navegar por títulos. Com 4 ou mais cartões, entra um índice de âncoras no topo (não agora).
4. **Cada configuração salva sozinha**, com seu botão e sua mensagem. Nada de um "Salvar tudo" no rodapé (evita perder alteração e mistura de efeitos).
5. Sem abas na v1. Se a página passar de ~5 cartões, avaliar menu lateral interno em `lg` (decisão futura).

### 3.1 Bloco "Cota condominial de referência" (v1)

Texto do bloco:
- Título: **Cota condominial de referência**
- Frase: "É o valor-base usado para calcular os espaços com valor em percentual. Exemplo: com cota de R$ 1.225,00, um espaço de 5% custa R$ 61,25."
- Dica sob o campo: "Informe o menor valor de cota condominial pago no condomínio, em reais. Todos os percentuais são calculados sobre ele."
- Aviso fixo (azul informativo, sem contorno preto): "A mesma cota vale para todas as unidades. Se algum espaço for cobrado por unidade de forma diferente, use valor fixo nesse espaço."
- Rodapé do bloco: "Atualizada em 09/10/2026 por Maria Souza." (só quando houver cota)

O morador **nunca** vê esta tela nem a cota (ver seção 10, P1 sobre a vitrine).

### 3.2 Campo de valor

- Rótulo visível (`label`): **Valor da cota (R$)**. `htmlFor`/`id` ligados.
- Máscara de centavos **igual à de "Valor de uso"** de Reservas: o usuário digita só números, `15000` vira `R$ 150,00`. Prefixo "R$" dentro do campo (mesmo padrão do `CampoVeiculo`).
- `inputMode="numeric"`, `type="text"`, `autoComplete="off"`.
- Tamanho de fonte 16px no celular e `text-xs` (que vale 14px) a partir de `sm`: `text-base sm:text-xs`.
- Classes do campo: `min-h-11 w-full rounded-xl border border-slate-200 px-3 py-2 focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-strong/30`. Em erro: `border-red-500` + mensagem com ícone.
- Dica de digitação abaixo do campo (`text-[12px] text-slate-600`): "Digite só os números: 122500 = R$ 1.225,00."
- Limites: maior que zero e até R$ 100.000,00 (SUPOSIÇÃO; evita erro de digitação com zero a mais; confirmar na seção 10, P4).
- Botão principal: **"Salvar cota"** (primeiro cadastro) / **"Salvar nova cota"** (alteração). Botão secundário (só na alteração): "Cancelar".

## 4. Estados

### 4.1 Carregando
Cartão já aparece com cabeçalho e três barras `animate-pulse rounded-xl bg-slate-100` (título, valor, rodapé), `aria-busy="true"` no corpo e `role="status"` com texto oculto `sr-only`: "Carregando configurações". Nada de "0" ou campo vazio piscando antes da cota chegar (parece "não cadastrada").

### 4.2 Erro ao carregar
Dentro do cartão, aviso vermelho com ícone `AlertTriangle` (`role="alert"`): "Não foi possível carregar a cota agora. Nada foi alterado. Tente de novo." + botão "Tentar de novo" (`min-h-11`).

### 4.3 Vazio: "Cota ainda não cadastrada"
Primeiro acesso. O campo já vem aberto (sem botão "Alterar").

```
Cota condominial de referência
É o valor-base usado para calcular os espaços com valor em percentual...

[i] A cota ainda não foi cadastrada. Sem ela, nenhum espaço
    pode ter valor em percentual.

Valor da cota (R$)
[R$ 0,00                         ]
Informe o menor valor de cota condominial pago no condomínio...

[ Salvar cota ]
```
O aviso usa estilo âmbar do sistema (`border-pendente-200 bg-pendente-50 text-pendente-900`, ícone `Info` ou `Clock`, nunca só cor). Campo mostra o placeholder "R$ 0,00" (não preenchido de verdade, para não parecer valor salvo).

### 4.4 Com cota cadastrada (modo leitura)
```
Cota condominial de referência
É o valor-base usado para...

R$ 1.225,00                            [ Alterar cota ]
Atualizada em 09/10/2026 por Maria Souza.
```
- Valor em `font-display text-2xl font-semibold text-slate-900` (hierarquia: é a única informação do bloco).
- "Alterar cota" é botão secundário (`border border-slate-300 bg-white text-slate-800 hover:bg-slate-50`, `min-h-11`). O primário azul-marinho só aparece quando se está salvando.
- Data no formato `dd/mm/aaaa` (completo, para não ser ambíguo; "dd/mm" curto só em lista). Quem: nome de exibição de quem salvou. Se a conta foi removida: "Atualizada em 09/10/2026." sem nome.

### 4.5 Editando
Campo aberto com o valor atual preenchido, foco no campo, botões "Salvar nova cota" (primário) e "Cancelar". Botão "Salvar nova cota" fica **desabilitado enquanto o valor é igual ao atual**, com texto de apoio: "Digite um valor diferente do atual para salvar." (o motivo está escrito, não só no `disabled`). "Cancelar" restaura o valor salvo e devolve o foco ao botão "Alterar cota".

### 4.6 Confirmação ao alterar
Só ao **alterar** uma cota existente. Usa `confirm()` do `useDialog`, **sem** `destructive` (não apaga nada; botão azul-marinho, não vermelho).

- Título: **Alterar a cota para R$ 1.300,00?**
- Mensagem: "A cota passa de R$ 1.225,00 para R$ 1.300,00. Vale para os novos pedidos de reserva em espaços com valor em percentual. As reservas já feitas mantêm o valor de quando foram pedidas."
- Botões: **"Alterar cota"** (confirma) e **"Voltar"** (cancela).
- Se já existir quantidade de espaços com percentual disponível sem custo, acrescentar uma linha: "Hoje 2 espaços usam percentual da cota." (opcional; ver seção 10, P5).

### 4.7 Salvando
Botão "Salvar nova cota" vira "Salvando…", `disabled`, `aria-busy`; campo e "Cancelar" `disabled` com contraste mantido. Sem fechar a tela nem permitir segundo clique.

### 4.8 Sucesso
Mensagem verde no topo da página (mesmo padrão de `feedbackMsg`: `role="status"`, ícone `CheckCircle2`, botão de fechar de 44px):
- Primeiro cadastro: "Cota cadastrada: R$ 1.225,00. Já dá para usar percentual nos espaços."
- Alteração: "Cota alterada para R$ 1.300,00. Vale para os novos pedidos; as reservas já feitas não mudam."

O bloco volta ao modo leitura com "Atualizada em ... por ..." já atualizado, e o foco vai ao botão "Alterar cota".

### 4.9 Erro ao salvar
Mensagem vermelha (`role="alert"`, ícone `AlertTriangle`) **dentro do bloco**, acima dos botões, e o campo permanece preenchido para tentar de novo:
- Falha de rede ou servidor: "Não foi possível salvar a cota. Nada foi alterado. Tente de novo; se continuar, avise o suporte."
- Sem permissão (sessão perdeu o cargo): "Você não tem mais permissão para alterar a cota. Fale com o Síndico."
- Validação (abaixo do campo, `aria-invalid="true"`, `aria-describedby`, ícone + `text-red-700`):
  - Vazio ou zero: "Informe a cota em reais, maior que zero."
  - Acima do limite: "Esse valor parece alto demais. Confira se não sobrou algum zero. O máximo é R$ 100.000,00."
- Erros de validação aparecem ao tentar salvar ou ao sair do campo, não a cada tecla. Ao salvar com erro, o foco vai ao campo.

### 4.10 Sem permissão
O menu esconde o item, mas quem abrir `/configuracoes` por link direto vê o cartão âmbar do mesmo padrão de "Área Restrita" de `/usuarios`:
- Título: "Área restrita"
- Texto: "As configurações do condomínio são reservadas ao Síndico, ao Subsíndico e à Administradora."
- Ícone `Lock`. Sem botão. O servidor/banco recusam de qualquer forma (a tela não é a proteção).

Quem acabou de passar o cargo e já não é admin: mesma tela de restrição (não precisa do redirecionamento de `/usuarios`).

## 5. Microcopy (resumo)

| Onde | Texto |
|---|---|
| Item de menu | Configurações |
| `h1` | Configurações |
| Frase da página | Ajustes do condomínio que valem para todo o portal. |
| Título do cartão | RESERVAS DE ESPAÇOS (caixa-alta por estilo; o texto é "Reservas de espaços") |
| Título do bloco | Cota condominial de referência |
| Rótulo do campo | Valor da cota (R$) |
| Botões | Salvar cota · Salvar nova cota · Alterar cota · Cancelar · Tentar de novo · Voltar |
| Vazio | A cota ainda não foi cadastrada. Sem ela, nenhum espaço pode ter valor em percentual. |
| Rodapé | Atualizada em dd/mm/aaaa por Nome. |

Evitar: "Submeter", "base de cálculo", "alíquota", "parâmetro", "fração ideal". O produto se chama **Dona Wanda**; "Harmony" só aparece como nome do condomínio, nunca para o produto.

## 6. Acessibilidade

- Um `h1` ("Configurações"), `h2` por cartão, `h3` por bloco. Ordem do DOM = ordem visual.
- Campo com `label` visível; dica e erro ligados por `aria-describedby`; `aria-invalid="true"` em erro.
- Mensagens de sucesso em `role="status"`, de erro em `role="alert"`; ícone + texto, nunca só cor.
- Ao entrar em edição, foco no campo; ao cancelar ou salvar, foco volta ao botão "Alterar cota". O diálogo de confirmação reaproveita o foco preso e o Esc do `DialogProvider`.
- Foco visível: `focus:ring-2 focus:ring-accent-strong/30` com borda `accent-strong` nos campos; botões já seguem o padrão do app.
- Alvos de toque de 44px (`min-h-11`) em todos os botões e no campo; 8px entre alvos.
- Contraste: textos `text-slate-700`/`slate-600` sobre branco; erro `text-red-700`; âmbar `pendente-900` sobre `pendente-50`. Nada de `text-muted` (#94A3B8) em texto.
- Valor lido pelo leitor de tela como "R$ 1.225,00"; o valor em destaque é texto real (não imagem).
- Botão desabilitado explica o motivo por texto visível (4.5), não só por `title`.
- Movimento: sem animação obrigatória; troca leitura/edição sem transição (ou com `motion-reduce`).

## 7. Comportamento em 375px e no desktop

**375px:** uma coluna, cartões de largura total com `p-4`; valor em destaque acima do botão "Alterar cota" (botão em largura total, `w-full`); campo em largura total; botões "Salvar nova cota" e "Cancelar" empilhados, o primário primeiro, ambos `min-h-11`; textos longos quebram, sem rolagem horizontal; campo com 16px (sem zoom do iOS); a mensagem de sucesso aparece no topo e o foco/scroll leva até ela (`scrollIntoView`) para não ficar fora da tela atrás do teclado.

**Desktop (`lg`):** cartão com largura máxima ~`max-w-2xl` dentro da área de conteúdo (formulário curto não deve esticar 1.100px); valor em destaque à esquerda e botão "Alterar cota" à direita (`sm:flex-row sm:items-center sm:justify-between`); botões em linha, mantidos à esquerda sob o campo para leitura.

## 8. Wireframes

### 8.1 Desktop, cota cadastrada
```
[ Menu lateral ]  [Settings] Configurações
 ...               Ajustes do condomínio que valem para todo o portal.
 Autocadastro
 [Configurações]   +-- RESERVAS DE ESPAÇOS --------------------------------+
                   |                                                      |
                   | Cota condominial de referência                       |
                   | É o valor-base usado para calcular os espaços com    |
                   | valor em percentual. Exemplo: com cota de R$ 1.225,00,|
                   | um espaço de 5% custa R$ 61,25.                      |
                   |                                                      |
                   | R$ 1.225,00                       [ Alterar cota ]   |
                   | Atualizada em 09/10/2026 por Maria Souza.            |
                   +------------------------------------------------------+
```

### 8.2 Desktop, editando (com erro)
```
| Cota condominial de referência                                    |
| ...                                                               |
| Valor da cota (R$)                                                |
| [R$ 0,00                                  ]                       |
| (!) Informe a cota em reais, maior que zero.                      |
| Digite só os números: 122500 = R$ 1.225,00.                       |
|                                                                   |
| [ Salvar nova cota ]  [ Cancelar ]                                |
```

### 8.3 Celular 375px, vazio
```
+---------------------------------+
| [=] logo               sino  MS |
+---------------------------------+
| [gear] Configurações            |
| Ajustes do condomínio que valem |
| para todo o portal.             |
|                                 |
| RESERVAS DE ESPAÇOS             |
| ------------------------------- |
| Cota condominial de referência  |
| É o valor-base usado para...    |
|                                 |
| (i) A cota ainda não foi        |
| cadastrada. Sem ela, nenhum     |
| espaço pode ter valor em        |
| percentual.                     |
|                                 |
| Valor da cota (R$)              |
| [R$ 0,00                      ] |
| Informe o menor valor de cota   |
| condominial pago no condomínio. |
| Digite só os números: 122500 =  |
| R$ 1.225,00.                    |
|                                 |
| [        Salvar cota          ] |
+---------------------------------+
```

### 8.4 Celular 375px, confirmação
```
+---------------------------------+
| Alterar a cota para R$ 1.300,00?|
|                                 |
| A cota passa de R$ 1.225,00     |
| para R$ 1.300,00. Vale para os  |
| novos pedidos de reserva em     |
| espaços com valor em percentual.|
| As reservas já feitas mantêm o  |
| valor de quando foram pedidas.  |
|                                 |
| [ Voltar ]  [ Alterar cota ]    |
+---------------------------------+
```

## 9. Critérios de aceite para o QA

1. Síndico, Subsíndico e ADM veem o item "Configurações" (último do menu, ícone de engrenagem, também no menu do celular). Portaria, Conselho, Zelador, Morador e provisório não veem.
2. Abrir `/configuracoes` por link direto com perfil sem acesso mostra "Área restrita"; por API, a leitura e a gravação da cota são negadas a esses perfis (teste direto no banco com a sessão de cada perfil).
3. Sem cota cadastrada: cartão com aviso "A cota ainda não foi cadastrada...", campo aberto e botão "Salvar cota"; nenhum "R$ 0,00" aparece como se fosse valor salvo.
4. A máscara de centavos funciona como em "Valor de uso": digitar `122500` mostra `R$ 1.225,00`; colar texto com letras ignora as letras; apagar tudo volta ao placeholder.
5. Salvar vazio ou zero é recusado com "Informe a cota em reais, maior que zero.", ligada ao campo (`aria-invalid`, `aria-describedby`), com ícone e foco no campo; acima de R$ 100.000,00 mostra a mensagem do limite.
6. Primeiro cadastro salva **sem** diálogo de confirmação e mostra "Cota cadastrada: R$ ...".
7. Alterar abre o diálogo com título "Alterar a cota para R$ X?", valor antigo e novo e a frase de que reservas já feitas mantêm o valor; "Voltar" não grava; "Alterar cota" grava.
8. Depois de salvar, a tela mostra "Atualizada em dd/mm/aaaa por Nome" com a data de hoje e o nome de quem salvou; recarregar a página mantém o dado.
9. "Salvar nova cota" fica desabilitado com valor igual ao atual, com a frase de apoio visível.
10. Durante "Salvando…" o botão e o campo ficam desabilitados e não há segundo envio; falha de rede mostra a mensagem de erro com o valor digitado preservado.
11. Reservas já feitas mantêm `valor_uso` depois de mudar a cota; só os novos pedidos usam a cota nova (teste em staging, comparando soma antes e depois).
12. Não existe ação de remover a cota; o banco recusa valor nulo, zero ou negativo.
13. Alterar a cota gera linha em `audit_logs` gravada pelo servidor, com quem e quando e **sem valores** (o Conselho lê o histórico).
14. 375px: sem rolagem horizontal; campo e botões com 44px ou mais; campo com 16px (sem zoom no iOS); o menu lateral com 11 itens rola e mostra "Configurações" até o fim; botão de fechar e animação do menu seguem funcionando.
15. Teclado: Tab percorre campo, "Salvar", "Cancelar"; foco visível; ao entrar em edição o foco vai ao campo; ao cancelar/salvar volta a "Alterar cota"; Esc fecha o diálogo.
16. Leitor de tela: títulos `h1`/`h2`/`h3`, rótulo do campo, dica e erro lidos; mensagens de sucesso e erro anunciadas.
17. Nenhum texto novo usa "Harmony" para o produto; nenhuma cor fixa (`bg-[#...]`), só tokens.
18. A cota **não** aparece em nenhuma lista, cartão, tabela, exportação ou resposta de rede acessível a Portaria, Conselho, Zelador, Morador ou provisório.

## 10. Dúvidas que dependem de decisão de produto

1. **P1. O morador vê a cota?** Recomendação do designer: **não**. Ele vê o valor em reais calculado e, em letra pequena, o percentual. Detalhes na seção 3 da atualização do documento de regra de valor.
2. **P2. Significado de "valor mínimo de cota".** É o **menor valor de cota entre as unidades**? Se as cotas forem diferentes, 5% do mínimo cobra **menos que 5%** das unidades maiores. O texto da tela diz "o menor valor de cota condominial pago no condomínio" para ser honesto. O dono precisa confirmar que é isso e que aceita a diferença.
3. **P3. Qual mês e o que entra.** Cota ordinária mensal, sem fundo de reserva nem rateio extra? Recomendação: escrever isso na dica da tela depois que o dono confirmar. Hoje o texto não afirma.
4. **P4. Limite máximo do campo** (R$ 100.000,00 é suposição) e se aceita centavos (a máscara aceita).
5. **P5. Aviso "Hoje N espaços usam percentual"** no diálogo de confirmação: vale o custo de contar no banco? Recomendação: sim se for uma consulta simples; senão, tirar.
6. **P6. Lembrete de reajuste anual** (sino para Síndico/ADM em janeiro: "Confira se a cota ainda está correta"). Fora da v1, mas combina com a área.
7. **P7. Histórico de cotas antigas** (lista de valores anteriores): fora da v1. A reserva já congela o valor usado; a tela mostra só a última alteração.
8. **P8. Rodapé do menu e `alt` do logo ainda dizem "Harmony Residence"**: corrigir para o produto (Dona Wanda) com o condomínio como cliente, na mesma entrega ou antes.

## 11. Mockups que peço à sessão principal

1. Tela `/configuracoes` em 375px nos 3 estados: vazio, cota cadastrada (modo leitura) e editando com erro.
2. Diálogo de confirmação ao alterar (375px) com o texto da seção 4.6.
3. Menu do celular aberto, mostrando "Configurações" como último item (11 itens), para confirmar rolagem e equilíbrio visual.
