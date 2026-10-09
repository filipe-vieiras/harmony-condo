# Reservas: três regras de valor e valor em percentual da cota (especificação de design)

Data: 2026-10-09 · Autor: designer · Status: proposta, aguarda decisões de produto (seção 10) · Sem implementação, sem dados reais.

> Nota da sessão principal (09/10/2026): a spec de produto do PM já existe em `docs/specs/2026-10-09-reservas-valor-pago-e-percentual.md`. Ela confirma que a regra "paga sempre" é só tela (sem migração) e recomenda cota única do condomínio se todas as unidades pagarem a mesma cota. A prévia por unidade da seção 4 só faz sentido se a cota for por unidade; com cota única, ela vira uma conferência simples com uma unidade qualquer. Reconciliar as seções 3, 4 e 10 com a decisão do dono.

> Atualização (09/10/2026): as decisões do dono (cota única, cobrança por fora, área de Configurações) estão em `docs/design/reservas/2026-10-09-regra-de-valor-atualizacao-cota-unica.md`. As seções 0, 1, 2.2, 2.3, 2.4, 2.5, 3, 4, 5, 6, 7, 8, 10, 11 e 12 de lá **substituem** as de mesmo número deste documento; a prévia por unidade (seção 4 original) foi removida.

Pedido do dono (literal): "Em reserva de espaços, existem duas regras: 'Grátis independente do número de pessoas' e 'Grátis até certo número de pessoas e, acima disso, valor fixo'. Precisa existir uma regra 'Pago independente do número de pessoas', ou seja, reservando o lugar já tem que pagar o valor. Outra questão é que o valor pode ser cadastrado pelos criadores do espaço (Síndico, ADM etc.) como um valor percentual, tipo 5% da cota condominial, ou valor fixo (como está atualmente)."

Continua `docs/specs/2026-10-05-reservas-bloqueio-e-faixa-de-valor.md` (valor calculado pelo banco, gravado na reserva, imutável; o produto não cobra, a administradora lança na taxa). A spec de produto do PM (`docs/specs/2026-10-09-reservas-valor-pago-e-percentual.md`) ainda não existia quando o designer escreveu isto (conferido em 09/10/2026). Tudo que depende dela está na seção 10, com a recomendação de partida do designer.

## 0. Recomendação em uma tela

1. **Duas perguntas separadas, nessa ordem:** (a) "Quando este espaço é pago?" com 3 opções de rádio; (b) "Como o valor é definido?" com 2 opções (valor fixo em R$ ou percentual da cota), que **só aparece** se a resposta de (a) não for "Grátis". Nada de lista única com 5 itens.
2. **Morador nunca vê "5%" sozinho:** vê o valor em reais já calculado para a unidade dele, com a frase "Cobrado pela administradora na sua taxa do condomínio". Na vitrine do espaço (antes de escolher unidade, vale para todos) aparece só a regra em palavras ("5% da taxa do condomínio"), nunca um valor em reais.
3. **A gestão confere o cálculo sob demanda, uma unidade por vez** ("5% da cota = R$ X para a unidade Y?"), em um campo de busca. Nenhuma lista, tabela ou cartão do app passa a mostrar cota.

## 1. O que existe hoje (conferido no código)

- `src/app/reservas/page.tsx`, acordeão "Pedidos e valor" (linhas ~1517 a 1613): caixa "Precisa de aprovação da equipe" com aviso âmbar; bloco "Valor de uso" com 2 rádios (`GRATIS`, `FAIXA`); campos `Grátis até (pessoas)` e `Valor acima disso (R$)` (máscara de centavos); frase-resumo em negrito (`previaDaFaixa`); "Taxa de Higienização (R$)" à parte.
- Resumo do acordeão (linha 615): `Confirma na hora · Higienização: isento · Valor: grátis até 10 pessoas`.
- `src/lib/valorEspaco.ts`: só apresentação; o valor de verdade vem do banco (`valor_reserva`, migração 0039).
- **Achado importante:** a regra "paga sempre" **já existe na prática**: `faixaGratisAte = 0` cobra de todos ("R$ 90,00 por reserva" em `resumoCurtoDoValor`, "Todas as reservas: R$..." em `previaDaFaixa`), e a mensagem de erro atual manda "Use 0 se o valor vale para todos". É um caminho escondido atrás de uma instrução que ninguém acha. Esta spec **promove** esse caso a uma opção própria. Consequência de design: ao abrir um espaço salvo com limite 0, a tela mostra a regra 3 (paga em toda reserva); na regra 2 o limite mínimo passa a ser 1. A regra nova não exige migração; o percentual exige (dev e PM decidem).
- Textos existentes que citam "Harmony" como produto (ex.: linha 1546, "O Harmony só calcula e mostra...") devem virar "Dona Wanda" junto com esta entrega.
- Ainda não há cota por unidade em nenhuma tabela ou tela (busca por "cota" no repositório só acha a spec de 05/10 e a auditoria de segurança). **A base do percentual é uma decisão de produto** (seção 10, P1).

## 2. Nova estrutura do bloco "Valor de uso" (gestão)

### 2.1 Decisão: rádio de regra + segundo controle de tipo (não uma lista única)

| | Lista única (5 itens) | **Rádio de regra + controle de tipo (escolhida)** |
|---|---|---|
| Itens a ler | 5 frases longas combinando regra e tipo | 3 + 2, cada pergunta com uma resposta |
| Mistura duas decisões | sim | não: regra e tipo são independentes |
| Cresce bem | não (um 3º tipo vira 8 itens) | sim (entra mais um item no tipo) |
| Mensagem de erro e resumo | difícil apontar o campo | cada pergunta tem seu erro |
| Custo | menor | um bloco a mais que aparece |

Escolhida a segunda. A regra 2 pode ser fixa ou percentual, a 3 também; o público de gestão pensa "primeiro quando, depois quanto". O segundo controle só aparece depois da primeira resposta: quem escolhe "Grátis" (maioria hoje) vê o mesmo bloco curto de antes. No máximo 3 perguntas visíveis: regra, tipo, valores.

### 2.2 Ordem e hierarquia (de cima para baixo)

1. `h4` "Valor de uso" (igual ao atual) + frase: "A Dona Wanda só calcula e mostra o valor ao morador. A cobrança é feita pela administradora."
2. **Pergunta 1 (`fieldset`, legenda visível "Quando este espaço é pago?")**, 3 rádios, rótulo em negrito e uma linha de apoio:
   - "Grátis" / "Qualquer número de pessoas pode usar sem pagar." (padrão para espaços novos e existentes)
   - "Grátis até certo número de pessoas" / "Acima desse número, o morador paga."
   - "Paga em toda reserva" / "O valor vale desde a primeira pessoa, qualquer que seja o número de pessoas."
3. **Pergunta 2 (`fieldset`, legenda "Como o valor é definido?")**, só na regra 2 ou 3. Dois cartões de rádio lado a lado a partir de `sm`, empilhados no celular:
   - "Valor fixo" / "Um valor em reais, igual para todas as unidades."
   - "Percentual da cota condominial" / "Um percentual da cota de cada unidade. O valor em reais muda de unidade para unidade."
4. **Campos de valor:**
   - Regra 2: "Grátis até (pessoas)" + campo do valor. Regra 3: só o campo do valor.
   - Fixo: "Valor (R$)" (regra 3) ou "Valor acima disso (R$)" (regra 2), máscara de centavos atual, apoio "Digite só os números: 15000 = R$ 150,00."
   - Percentual: "Percentual da cota (%)", **sem** máscara de centavos (a máscara confundiria: "500" viraria 5,00%?). Texto com `inputMode="decimal"`, aceita vírgula e ponto, até 2 casas, sufixo "%" dentro do campo (mesmo padrão do prefixo "R$" do `CampoVeiculo`). Apoio: "Digite 5 para 5% da cota. Pode usar vírgula: 7,5."
5. **Frase-resumo** em negrito, `aria-live="polite"` (2.5).
6. **Prévia do cálculo** (só percentual; seção 4).
7. Nota fixa já existente: "A taxa de higienização não entra neste valor."
8. Nota de efeito: "Mudar a regra vale só para novos pedidos. Reservas já feitas mantêm o valor de quando foram pedidas." Só ao editar espaço que já tinha regra salva e a regra mudou. Estilo do aviso azul informativo, sem borda preta.

"Grátis" vem primeiro: é o padrão seguro; quem erra o clique não cobra ninguém por engano.

Estilo (tokens existentes): rótulos `text-xs font-semibold text-slate-700` (14px), apoio `text-[12px] text-slate-600`; cartões de rádio `rounded-xl border border-slate-200 p-3`, selecionado `border-accent-strong bg-accent-50` (sem contorno preto fino), `gap-3` entre cartões; entre blocos `border-t border-slate-100 pt-3`. Cada rádio é um `label` inteiro com `min-h-11`. Sem `select` nativo (evita a seta colada na borda).

### 2.3 Estados

| Estado | Comportamento |
|---|---|
| **Vazio** (espaço novo) | "Grátis" marcada; pergunta 2 e campos escondidos. Frase: "Grátis para qualquer número de pessoas." |
| **Regra 2 ou 3 sem tipo** | Nenhum rádio de tipo marcado, campos escondidos, frase "Escolha como o valor é definido." (alternativa: "Valor fixo" marcado por ser o comportamento de hoje; P8) |
| **Em preenchimento** | Frase se monta; erros só após tentar salvar ou sair do campo (comportamento atual de `tentouSalvarEspaco`) |
| **Erro** | Mensagem abaixo do campo, vermelho com ícone (nunca só cor), `aria-invalid`, `aria-describedby`. Ao salvar com erro, foco no primeiro campo inválido e o acordeão abre sozinho (`secoes`) |
| **Desabilitado** | (a) Rádios e campos durante "Salvando…": `disabled`, contraste mantido, botão mostra "Salvando…". (b) **Tipo "Percentual"** desabilitado enquanto a cota das unidades não estiver disponível, motivo escrito (não só `title`): "Disponível quando as cotas das unidades estiverem cadastradas." (c) Prévia desabilitada até haver percentual válido |
| **Carregando** | Prévia: "Calculando…" (`aria-live`); lista de unidades: "Carregando unidades…". O bloco principal não depende de carregamento |
| **Sucesso** | Toast atual de espaço salvo; sem confirmação extra |

**Aviso âmbar (existente, ampliado):** com "Confirma na hora" ativo **e** regra 2 ou 3, acrescentar na caixa âmbar: "Atenção: reservas com valor serão confirmadas e lançadas na taxa do condomínio sem passar pela equipe." É a combinação de maior risco.

### 2.4 Erros

| Situação | Mensagem |
|---|---|
| Regra 2 sem limite | "Informe quantas pessoas podem usar sem pagar. Mínimo 1." |
| Regra 2, limite maior ou igual à capacidade | "O limite grátis precisa ser menor que a capacidade do espaço (X pessoas). Se ninguém deve pagar, escolha 'Grátis'." |
| Regra 2, limite 0 | "Com 0 pessoas grátis, todos pagam. Escolha 'Paga em toda reserva'." (botão de texto opcional "Trocar para essa opção") |
| Valor fixo vazio ou zero | "Informe o valor em reais, maior que zero." |
| Percentual vazio, zero ou acima de 100 | "Informe um percentual maior que 0 e até 100. Exemplo: 5." |
| Percentual com texto | "Use só números. Exemplo: 7,5." |
| Tipo não escolhido | "Escolha se o valor é fixo ou um percentual da cota." |
| Falha ao salvar | "Não foi possível salvar o espaço. Nada foi alterado. Tente de novo; se continuar, avise o suporte." |
| Percentual alto (aviso, não erro; P9) | "É um percentual alto. Confira com o regimento ou a ata de assembleia antes de salvar." |

### 2.5 Frase-resumo e resumo do acordeão

| Regra · tipo | Frase-resumo (negrito, 14px) |
|---|---|
| Grátis | "Grátis para qualquer número de pessoas." |
| Regra 2 · fixo | "Até 10 pessoas: grátis. Acima de 10: R$ 350,00." (igual a hoje) |
| Regra 2 · percentual | "Até 10 pessoas: grátis. Acima de 10: 5% da cota de cada unidade." |
| Regra 3 · fixo | "Todas as reservas: R$ 350,00." |
| Regra 3 · percentual | "Todas as reservas: 5% da cota de cada unidade." |
| Incompleta | "Preencha o valor para ver o resumo." |

Resumo do acordeão (`resumoCurtoDoValor`), pode quebrar em 2 linhas no celular (sem `truncate`):
- `Confirma na hora · Higienização: isento · Valor: grátis`
- `... · Valor: grátis até 10 pessoas, depois R$ 350,00` / `..., depois 5% da cota`
- `... · Valor: R$ 350,00 por reserva` / `... · Valor: 5% da cota por reserva`
- Incompleto: `... · Valor: informe o tipo e o valor` (hoje: "informe o limite e o valor").

Vitrine do espaço para todos (`valorUsoDoEspaco`/`valorUsoPorExtenso`): "Grátis", "R$ 350,00 acima de 10 pessoas", "5% da taxa do condomínio acima de 10 pessoas", "5% da taxa do condomínio por reserva". **Nunca** R$ calculado na vitrine.

## 3. O que o MORADOR vê

### 3.1 Princípios
- O morador precisa de **um número em reais** antes de enviar; percentual sozinho é abstração para leigo e idoso.
- Nunca vê cota, percentual aplicado ou valor de outra unidade. Nenhuma tela ou resposta de rede devolve cota de outra unidade; o cálculo roda no banco para a unidade do usuário logado.
- Para o morador a palavra é "taxa do condomínio" (já usada em `textoValorPedido`), não "cota condominial". Na gestão, "cota condominial" (palavra do dono). Ver P2.
- Deixar claro quem cobra: "Cobrado pela administradora na sua taxa do condomínio". A Dona Wanda não cobra.

### 3.2 Telas
**Vitrine e detalhes do espaço (antes de escolher unidade/data):** só a regra em palavras: "Valor de uso: 5% da taxa do condomínio acima de 10 pessoas." Apoio (12px): "O valor em reais aparece quando você escolhe o dia e o número de pessoas."

**Formulário do pedido (modal/folha no celular):** a linha de `textoValorPedido`, atualizada com o número de pessoas.
- Dentro da faixa grátis: "Valor de uso: grátis (até 10 pessoas)."
- Fixo: igual a hoje: "Valor de uso: R$ 350,00. Cobrado na sua taxa do condomínio."
- Percentual: valor em destaque (`font-display`) e abaixo: "Valor de uso: R$ 61,25" / "Calculado com 5% da taxa do condomínio da sua unidade. A administradora lança esse valor na sua taxa do condomínio."
- Higienização como hoje. Carregando: "Calculando o valor…". Falha: "Não foi possível mostrar o valor agora. Ele é calculado ao enviar." (ambos já existem).
- **Unidade sem cota cadastrada** (P3, recomendação de partida): "O valor deste espaço depende da sua taxa do condomínio, que ainda não está cadastrada. A administradora informa o valor depois. Você pode enviar o pedido mesmo assim." Alternativa se bloquear: "Não foi possível calcular o valor. Fale com a administração."

**Confirmação e lista da unidade:** valor **gravado** em reais, nunca o percentual. A reserva não muda se a cota mudar depois.

**Equipe/Portaria registrando pedido em nome da unidade:** vê o valor em reais da unidade escolhida: "Cobrado na taxa do condomínio da unidade." Isso deixa deduzir a cota daquela unidade (P4). Recomendação: sim para a unidade em atendimento; a lista de unidades não ganha campo.

Nota honesta: R$ 61,25 com 5% revela a cota da **própria unidade**. Para o morador é dado dele; aceitável se a spec de produto confirmar. A alternativa (só percentual e "valor informado pela administradora") piora muito o uso; não recomendo.

## 4. Gestão: prévia do cálculo sem expor cota

Local: dentro de "Valor de uso", depois da frase-resumo, só no tipo "Percentual", em painel `rounded-xl border border-slate-200 bg-slate-50 p-3`.

- Título: "Conferir o cálculo".
- Campo "Unidade para conferir" com busca (digita "A-1" e filtra). Apoio: "Escolha uma unidade para ver quanto ficaria. A cota não aparece, só o valor."
- Resultado em uma linha, `aria-live="polite"`: "5% da cota = R$ 61,25 para a unidade A-101." Na regra 2: "Acima de 10 pessoas, a unidade A-101 pagaria R$ 61,25."

Por que uma unidade por vez e sem mostrar a cota: nenhuma lista ou tabela do app ganha coluna de cota (mesma lógica da decisão de pagamento: só a própria unidade e o síndico, nunca na lista de unidades). Quem precisa ver a cota vê no sistema da administradora. O cálculo roda no servidor (função só `is_admin()`); o navegador recebe só o valor final da unidade escolhida, nunca a lista de cotas.

Estados: sem unidade: "Escolha uma unidade para ver o valor." (sem exemplo inventado). Calculando: "Calculando…". Unidade sem cota: "A unidade A-101 está sem cota cadastrada. Peça à administradora para informar." Erro: "Não foi possível calcular agora. Tente de novo." Desabilitado: "Informe o percentual para conferir o cálculo." Arredondamento: centavo mais próximo, mostrando já o valor que será gravado (P5). A prévia não grava nada nem vai ao histórico de ações.

## 5. Microcopy (resumo)

Gestão: pergunta 1 "Quando este espaço é pago?" · "Grátis" · "Grátis até certo número de pessoas" · "Paga em toda reserva". Pergunta 2 "Como o valor é definido?" · "Valor fixo" · "Percentual da cota condominial". Campos: "Grátis até (pessoas)", "Valor (R$)" / "Valor acima disso (R$)", "Percentual da cota (%)". Dicas e erros nas seções 2.2 e 2.4. Botão: "Salvar espaço" (atual); sem diálogo extra, as notas bastam.

Morador: frases da seção 3. Evitar: "fração ideal", "rateio", "alíquota", "base de cálculo".

Notificações e comprovante: reais gravados. Equipe: "Valor de uso: R$ 61,25 (5% da cota)."; morador: só reais.

## 6. Acessibilidade
- Duas `fieldset` com `legend` visível; rádios nativos com `name` distinto; setas navegam dentro do grupo, Tab sai do grupo.
- Ao escolher uma opção o foco **permanece** no rádio; campos novos entram logo depois no DOM; a frase-resumo (`aria-live="polite"`) anuncia a mudança.
- Todo campo com `label` visível; apoio e erro por `aria-describedby`; `aria-invalid="true"`; erro com ícone e texto, `text-red-700`. O "%" é decorativo (`aria-hidden`); a unidade está no rótulo.
- Foco visível `focus:ring-2 focus:ring-accent-strong/30` + borda `accent-strong`; o cartão de rádio mostra o anel quando o rádio interno tem foco.
- Selecionado sem depender de cor: rádio preenchido, além do fundo `accent-50`.
- Alvos de 44px (`min-h-11`), 8px entre alvos.
- Contraste (>= 4,5:1): `text-slate-700`/`slate-600` sobre branco, `accent-50` ou `slate-50`; erro `text-red-700`; âmbar `pendente-900` sobre `pendente-50`. Nada de `text-muted` (#94A3B8) em texto.
- Combobox da prévia: `aria-expanded`, `aria-controls`, `aria-activedescendant`; resultado anunciado por `aria-live`. Evitar `datalist` (ruim no iOS); alternativa simples: campo de texto + lista filtrada de botões.
- Ordem do DOM = ordem visual. Revelar campos sem animação (ou com `motion-reduce`).

## 7. Comportamento em 375px
- Uma coluna; cartões de tipo empilham (`grid-cols-1 sm:grid-cols-2`); "Grátis até" e valor empilham (já é assim).
- Sem rolagem horizontal; rótulos longos quebram; resumo do acordeão em até 2 linhas.
- Campos com 16px (inclui o do percentual); `inputMode="decimal"` para percentual e valor, `numeric` para pessoas; aceitar vírgula e ponto.
- Prévia: resultado acima do teclado; lista de unidades abaixo do campo com altura máxima (~5 itens) e rolagem interna.
- O acordeão abre sozinho no erro; "Salvar espaço" segue alcançável (rodapé do modal atual).
- Morador: o valor em reais fica logo abaixo de "Número de pessoas" e acima do botão de enviar, para o teclado não cobrir.

## 8. Wireframes

### 8.1 Desktop (gestão), seção "Pedidos e valor" aberta
```
+-- Pedidos e valor  ---------------------------------------------- [v] --+
| Confirma na hora · Higienização: isento · Valor: grátis até 10 pessoas, |
| depois 5% da cota                                                       |
|                                                                         |
| REGRAS DE RESERVA                                                       |
| [x] Precisa de aprovação da equipe                                      |
|                                                                         |
| ----------------------------------------------------------------------- |
| VALOR DE USO                                                            |
| A Dona Wanda só calcula e mostra o valor ao morador. A cobrança é       |
| feita pela administradora.                                              |
|                                                                         |
| Quando este espaço é pago?                                              |
| ( ) Grátis                                                              |
|     Qualquer número de pessoas pode usar sem pagar.                     |
| (o) Grátis até certo número de pessoas                                  |
|     Acima desse número, o morador paga.                                 |
| ( ) Paga em toda reserva                                                |
|     O valor vale desde a primeira pessoa, qualquer que seja o número.   |
|                                                                         |
| Como o valor é definido?                                                |
| +---------------------------+  +--------------------------------------+ |
| | ( ) Valor fixo            |  | (o) Percentual da cota condominial   | |
| | Um valor em reais, igual  |  | Um percentual da cota de cada        | |
| | para todas as unidades.   |  | unidade. O valor em reais muda.      | |
| +---------------------------+  +--------------------------------------+ |
|                                                                         |
| Grátis até (pessoas)            Percentual da cota (%)                  |
| [ 10              ]             [ 5                         %]          |
|                                 Digite 5 para 5% da cota. Pode usar     |
|                                 vírgula: 7,5.                           |
|                                                                         |
| Até 10 pessoas: grátis. Acima de 10: 5% da cota de cada unidade.        |
| A taxa de higienização não entra neste valor.                           |
|                                                                         |
| +-- Conferir o cálculo ---------------------------------------------+   |
| | Unidade para conferir  [ A-101                        ] (busca)    |   |
| | Escolha uma unidade para ver quanto ficaria. A cota não aparece,   |   |
| | só o valor.                                                        |   |
| | 5% da cota = R$ 61,25 para a unidade A-101.                        |   |
| +--------------------------------------------------------------------+   |
|                                                                         |
| (i) Mudar a regra vale só para novos pedidos. Reservas já feitas        |
|     mantêm o valor de quando foram pedidas.                             |
| ----------------------------------------------------------------------- |
| Taxa de Higienização (R$)  [ 0,00 ]                                     |
+-------------------------------------------------------------------------+
```

### 8.2 Celular 375px (gestão)
```
+---------------------------------+
| Pedidos e valor              [v]|
| Confirma na hora · Higienização:|
| isento · Valor: R$ 350,00 por   |
| reserva                         |
|                                 |
| VALOR DE USO                    |
| A Dona Wanda só calcula e mostra|
| o valor ao morador...           |
|                                 |
| Quando este espaço é pago?      |
| ( ) Grátis                      |
| ( ) Grátis até certo número...  |
| (o) Paga em toda reserva        |
|     O valor vale desde a        |
|     primeira pessoa...          |
|                                 |
| Como o valor é definido?        |
| +-----------------------------+ |
| | (o) Valor fixo              | |
| | Um valor em reais, igual... | |
| +-----------------------------+ |
| +-----------------------------+ |
| | ( ) Percentual da cota      | |
| |     condominial             | |
| +-----------------------------+ |
|                                 |
| Valor (R$)                      |
| [R$ 350,00                    ] |
| Digite só os números:           |
| 15000 = R$ 150,00.              |
|                                 |
| Todas as reservas: R$ 350,00.   |
+---------------------------------+
```

### 8.3 Celular 375px, morador, formulário do pedido (percentual)
```
+---------------------------------+
| Número de pessoas               |
| [ 25                          ] |
|                                 |
| Valor de uso                    |
| R$ 61,25                        |
| Calculado com 5% da taxa do     |
| condomínio da sua unidade. A    |
| administradora lança esse valor |
| na sua taxa do condomínio.      |
| Higienização: R$ 80,00 (à parte)|
|                                 |
| [x] Li e aceito as regras       |
| [ Enviar pedido ]               |
+---------------------------------+
```
Variações: "Calculando o valor…"; "Informe o número de pessoas para ver o valor."; unidade sem cota (3.2).

## 9. Fora desta entrega
Várias faixas, valor por pessoa excedente, preço por dia/horário, mínimo e máximo para o percentual, cota em qualquer lista, cota visível ao morador, cobrança ou pagamento no app, histórico de mudanças de cota. O Início novo do morador (rejeitado) não é recriado.

## 10. Dúvidas de design que dependem de decisão de produto (por prioridade)
A spec do PM não existia ao fechar este documento; cada item traz a recomendação de partida.
1. **P1 (bloqueante). De onde vem a base da cota?** Planilha da administradora, campo na unidade preenchido pela gestão, ou API Superlógica (spec 2026-10-07, depende da Garden)? Sem resposta, o tipo "Percentual" fica desabilitado. Recomendação: **fase 1 só com as 3 regras e valor fixo**; fase 2 percentual quando a base existir. Se for campo na unidade, só a gestão vê e a lista de unidades não o mostra.
2. **P2. "Cota condominial" é o valor mensal da taxa da unidade?** (a palavra tem mais de um sentido). Qual mês vale (da reserva, o mais recente) e inclui fundo de reserva ou extras? Afeta rótulo e prévia.
3. **P3. Unidade sem cota:** permitir o pedido com "valor a definir" ou bloquear? Recomendação: permitir e sinalizar à equipe; afeta o relatório "valores a lançar".
4. **P4. Quem vê o valor em reais derivado da cota:** morador (própria unidade), equipe, Portaria, Conselho. Recomendação: morador e equipe sim; Portaria só da unidade em atendimento; Conselho já lê o valor gravado (decisão de 05/10).
5. **P5. Arredondamento e valor mínimo.** Recomendação: centavo mais próximo, sem mínimo.
6. **P6. Cota atualizada depois:** reservas já pedidas mantêm o valor gravado? Recomendação: sim.
7. **P7. "Paga sempre" pode sair antes do percentual** aproveitando `faixaGratisAte = 0` (sem migração)? Recomendação: sim, é o ganho mais barato.
8. **P8. Padrão do tipo ao escolher regra 2 ou 3:** nenhum marcado ou "Valor fixo"? Decisão do dono.
9. **P9. Aviso de percentual alto:** quer? Qual limite? Existe teto no regimento? (risco 10.3 da spec de 05/10).
10. **P10. Cancelar reserva com valor:** como a cobrança é imediata, cancelar já lançado exige aviso à administradora (risco 10.6 da spec de 05/10); o texto de cancelamento muda.
11. **P11. Espaço pago com aprovação:** o valor só é lançado na aprovação? Recomendação: sim.
12. **P12. Pessoas declaradas** (risco 10.1 de 05/10): na regra 3 o número não muda o valor, então o campo serve só à capacidade.

## 11. Mockups que peço à sessão principal
1. Bloco "Valor de uso" em 375px em 3 estados (Grátis; regra 2 com percentual e prévia; regra 3 fixa), com comparação de cartões de tipo versus rádios simples.
2. Formulário do morador com valor percentual (3 variações de texto), para teste com 2 ou 3 moradores leigos. Perguntas: "Quem vai cobrar esse valor?" e "Quanto você vai pagar?".
3. Prévia da gestão (busca de unidade) em desktop e 375px.

## 12. Critérios de aceite de design (para o QA)
1. Espaço novo abre com "Grátis" marcada e sem a pergunta de tipo.
2. Escolher regra 2 ou 3 mostra a pergunta de tipo; trocar o tipo mostra o campo certo e mantém o que foi digitado no outro.
3. Espaço salvo com limite 0 abre na regra 3; na regra 2, 0 é recusado com a mensagem de 2.4.
4. Frase-resumo e resumo do acordeão batem com 2.5 nas 5 combinações.
5. Percentual aceita "5", "5,5" e "5.5" e recusa 0, 101 e texto, com mensagem em português, ligada ao campo, com ícone.
6. Em 375px sem rolagem horizontal; todo rádio, cartão e campo com 44px ou mais; campos com 16px.
7. Teclado: Tab percorre regra, tipo, campos, prévia; setas trocam a opção em cada grupo; foco sempre visível; leitor de tela lê legenda, opção, apoio e erro.
8. Morador, em espaço com percentual, vê R$ calculado e a frase da administradora; nenhuma tela, `title`, rótulo acessível ou resposta de rede traz cota ou valor de outra unidade.
9. Lista de unidades, cartões e tabelas continuam sem cota.
10. A prévia da gestão mostra só o valor da unidade escolhida e funciona só para Síndico, Subsíndico e ADM.
11. Nenhum texto novo usa "Harmony" para o produto; os textos antigos do bloco passam a "Dona Wanda".
