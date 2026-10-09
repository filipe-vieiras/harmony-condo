# Reservas: regra de valor, atualização para cota única do condomínio (design)

Data: 2026-10-09 · Autor: designer · Atualiza `docs/design/reservas/2026-10-09-regra-de-valor.md`. As seções abaixo, marcadas por número, **substituem** as de mesmo número daquele documento. O que não está aqui continua valendo.

> Decisões do dono (09/10/2026): a **cota é única do condomínio** (não por unidade), a reserva é feita na plataforma e o **síndico cobra por fora**, e a cota é cadastrada na nova área de **Configurações** (`docs/design/2026-10-09-area-de-configuracoes.md`), só para Síndico, Subsíndico e ADM. O cálculo por unidade e a busca de unidade foram removidos.

Atenção ao texto de apoio do documento original: onde dizia "cobrado pela administradora na taxa do condomínio", passa a valer "o síndico cobra por fora" (seção 3). Conferir com o PM a redação final.

---

## SEÇÃO 0 (substitui os itens 2 e 3)

2. **Morador vê sempre o valor em reais**, calculado com a cota única, junto de uma frase de quem cobra ("O síndico combina a cobrança com você"). Na vitrine do espaço também aparece o valor em reais (agora é o mesmo para todos, porque a cota é única), com o percentual em letra pequena. A cota em si **não** aparece para o morador.
3. **A gestão vê uma prévia simples e honesta** no próprio formulário do espaço: "5% da cota de R$ 1.225,00 = R$ 61,25", com o link "Alterar a cota" para Configurações. Sem busca de unidade, sem lista, sem cálculo por unidade.

## SEÇÃO 1 (acrescentar ao fim)

- **Atualização de 09/10/2026:** a cota única é cadastrada em `/configuracoes` (`docs/design/2026-10-09-area-de-configuracoes.md`). Não existe cota por unidade em nenhuma tabela ou tela.

## SEÇÃO 2.2 (substitui os itens 3, 5, 6 e 8)

3. **Pergunta 2 (`fieldset`, legenda "Como o valor é definido?")**, só na regra 2 ou 3. Dois cartões de rádio lado a lado a partir de `sm`, empilhados no celular:
   - "Valor fixo" / "Um valor em reais, igual em todas as reservas."
   - "Percentual da cota condominial" / "Um percentual da cota do condomínio. Se a cota mudar, o valor muda nos novos pedidos."
   - Com a cota **não cadastrada**, o cartão "Percentual da cota condominial" fica desabilitado, com o motivo escrito e o link (seção 2.3).

5. **Frase-resumo** em negrito, `aria-live="polite"` (2.5).

6. **Prévia do cálculo** (só percentual; seção 4): linha simples dentro do bloco, depois da frase-resumo, sem painel nem campo.

8. **Nota de efeito:** "Mudar a regra vale só para novos pedidos. Reservas já feitas mantêm o valor de quando foram pedidas." Só ao editar espaço que já tinha regra salva e a regra mudou. Estilo do aviso azul informativo, sem borda preta. **Texto adicional quando o tipo é Percentual:** "Se a cota for alterada em Configurações, os novos pedidos usam a cota nova."

Campos de valor, item 4, percentual: "Digite 5 para 5% da cota. Pode usar vírgula: 7,5." (sem mudança; sem máscara de centavos).

## SEÇÃO 2.3 (substitui as linhas "Desabilitado" e "Carregando")

| Estado | Comportamento |
|---|---|
| **Desabilitado** | (a) Rádios e campos durante "Salvando…": `disabled`, contraste mantido, botão mostra "Salvando…". (b) **Tipo "Percentual" com cota não cadastrada:** o cartão fica `disabled` (`aria-disabled`, opacidade reduzida mas contraste do texto mantido), e logo abaixo dele, em texto visível (não só `title`): "Para usar percentual, cadastre antes a cota do condomínio." + link "Cadastrar a cota" que abre `/configuracoes#reservas` (abre em outra aba, `target="_blank"`, com "(abre em outra aba)" no texto acessível, para não perder o formulário não salvo). Se o espaço já estava salvo como percentual e a cota some do banco (não deve acontecer; a cota não pode ser removida), mostrar o mesmo aviso em âmbar e **não deixar salvar**. (c) A prévia não existe até haver percentual válido. |
| **Carregando** | Cota ainda carregando: o cartão "Percentual da cota condominial" fica desabilitado com o texto "Verificando a cota do condomínio…" (`aria-live`); o resto do bloco não depende dela |

## SEÇÃO 2.4 (acrescentar ao quadro)

| Situação | Mensagem |
|---|---|
| Percentual escolhido, cota não cadastrada (tentou salvar) | "Cadastre a cota do condomínio em Configurações antes de usar percentual." (com o link "Cadastrar a cota") |
| Falha ao ler a cota | "Não foi possível ler a cota agora. Tente de novo. Se preferir, use valor fixo." |

## SEÇÃO 2.5 (substitui as linhas de percentual da tabela e o resumo do acordeão e a vitrine)

| Regra · tipo | Frase-resumo (negrito, 14px) |
|---|---|
| Regra 2 · percentual | "Até 10 pessoas: grátis. Acima de 10: 5% da cota do condomínio." |
| Regra 3 · percentual | "Todas as reservas: 5% da cota do condomínio." |

Resumo do acordeão (`resumoCurtoDoValor`), na gestão, acompanha a cota quando existe:
- `... · Valor: grátis até 10 pessoas, depois 5% da cota (R$ 61,25)`
- `... · Valor: 5% da cota por reserva (R$ 61,25)`
- Percentual sem cota cadastrada: `... · Valor: 5% da cota (cota não cadastrada)`.

Vitrine do espaço para todos (`valorUsoDoEspaco`/`valorUsoPorExtenso`), **agora com valor em reais**, porque a cota única torna o valor igual para todas as unidades:
- "R$ 61,25 acima de 10 pessoas" / "R$ 61,25 por reserva", com a linha de apoio em `text-[12px] text-slate-600`: "5% da cota do condomínio."
- Se a cota não estiver cadastrada (espaço percentual antigo): "Valor a combinar com o síndico."

## SEÇÃO 3 (substitui inteira): O que o MORADOR vê

### 3.1 Princípios
- O morador precisa de **um número em reais** antes de enviar; percentual sozinho é abstração para leigo e idoso.
- Como a cota é única, o valor em reais é **igual para todas as unidades**. Isso muda o que o documento original dizia: a vitrine **pode** mostrar o valor em reais (não revela dado de unidade).
- **Recomendação: mostrar o valor em reais e o percentual em letra pequena; não mostrar a cota.** Por quê: (a) o morador decide com o R$, não com a base; (b) a cota é um número a mais para um leigo interpretar, e mostrá-la convida a conferir contra o boleto dele e a abrir discussão de "minha cota não é essa"; (c) quem quiser deduz a cota (R$ ÷ %), então não é segredo, apenas não é informação útil na tela do pedido. Se o dono preferir transparência total (ex.: assembleia pediu), a cota entra uma linha abaixo do valor: "Calculado com 5% da cota do condomínio (R$ 1.225,00)". Fica como decisão P1 do dono; recomendação: **não** mostrar.
- Para o morador a palavra é "cota do condomínio" (já que o valor-base é do condomínio), não "fração ideal" nem "alíquota". Na gestão, "cota condominial".
- Deixar claro quem cobra: **"O síndico combina a cobrança com você."** (decisão do dono: a reserva é feita na plataforma e o síndico cobra por fora). A Dona Wanda não cobra.

### 3.2 Telas
**Vitrine e detalhes do espaço:** "Valor de uso: R$ 61,25 acima de 10 pessoas." Apoio (12px): "5% da cota do condomínio. O síndico combina a cobrança com você." Se a cota mudar, a vitrine acompanha na hora; o valor gravado é o do momento do pedido.

**Formulário do pedido (modal/folha no celular):** a linha de `textoValorPedido`, atualizada com o número de pessoas.
- Dentro da faixa grátis: "Valor de uso: grátis (até 10 pessoas)."
- Fixo: "Valor de uso: R$ 350,00. O síndico combina a cobrança com você."
- Percentual: valor em destaque (`font-display`) e abaixo: "Valor de uso: R$ 61,25" / "Calculado com 5% da cota do condomínio. O síndico combina a cobrança com você."
- Higienização como hoje, em linha própria. Carregando: "Calculando o valor…". Falha: "Não foi possível mostrar o valor agora. Ele é calculado ao enviar." (ambos já existem).
- **Cota não cadastrada** (não deve ocorrer: o espaço não pode ser salvo como percentual sem cota, e a cota não pode ser removida; só como proteção): "O valor deste espaço ainda não foi definido. Fale com a administração." e o botão de enviar fica desabilitado, com o motivo escrito. Não criar reserva com valor 0 em silêncio.

**Confirmação e lista da unidade:** valor **gravado** em reais, nunca o percentual. A reserva não muda se a cota mudar depois.

**Equipe e Portaria registrando pedido:** veem o mesmo valor em reais do espaço; sem diferença por unidade.

Nota honesta: com cota única, "R$ 61,25 com 5%" revela a cota a quem fizer a conta. Aceitável (é dado do condomínio, não de uma unidade, e não é situação de pagamento); a spec do PM decide a visibilidade.

## SEÇÃO 4 (substitui inteira): Gestão, prévia simples do cálculo

Local: dentro de "Valor de uso", depois da frase-resumo, só no tipo "Percentual", sem painel, em uma linha de texto (`text-xs text-slate-700`, `aria-live="polite"`).

- **Texto da prévia:** "5% da cota de R$ 1.225,00 = R$ 61,25." Regra 2: "Acima de 10 pessoas: 5% da cota de R$ 1.225,00 = R$ 61,25."
- **Link ao lado:** "Alterar a cota" (`text-accent-strong underline`, alvo de 44px no celular via `min-h-11 inline-flex items-center`) que abre `/configuracoes#reservas` em outra aba, com "(abre em outra aba)" no nome acessível, para não perder o formulário. Como só Síndico, Subsíndico e ADM editam espaço, todos que veem a prévia têm acesso a Configurações; se no futuro um perfil sem acesso editar espaço, mostrar a prévia **sem** o link.
- **Cota que a gestão cadastrou:** é mostrada na prévia porque a gestão a cadastrou e já a vê em Configurações. Não é dado de unidade; não há lista, tabela nem cartão com cota.
- Arredondamento: centavo mais próximo; a prévia mostra já o valor que será gravado.

**Estados:**
| Estado | Texto |
|---|---|
| Sem percentual válido | "Informe o percentual para ver o valor." |
| Calculando | "Calculando…" |
| Cota não cadastrada | "Cadastre a cota do condomínio para ver o valor." + link "Cadastrar a cota" (substitui o texto antigo de "unidade sem cota"; ver 2.3 para o rádio desabilitado) |
| Erro | "Não foi possível ler a cota agora. Tente de novo." |
| Cota alterada em outra aba | Atualiza ao voltar para a aba (recarregar ao ganhar foco) ou, no mínimo, ao tocar em "Atualizar valor" (botão de texto); a prévia é só informação, o valor gravado vem sempre do banco |

A prévia não grava nada nem vai ao histórico de ações.

## SEÇÃO 5 (substitui o trecho de microcopy)

Gestão: pergunta 2 "Como o valor é definido?" · "Valor fixo" · "Percentual da cota condominial". Campos: "Percentual da cota (%)". Prévia: "5% da cota de R$ X = R$ Y." Links: "Alterar a cota", "Cadastrar a cota". Aviso de bloqueio: "Para usar percentual, cadastre antes a cota do condomínio."

Morador: "Valor de uso: R$ 61,25" · "Calculado com 5% da cota do condomínio." · "O síndico combina a cobrança com você."

Evitar: "fração ideal", "rateio", "alíquota", "base de cálculo", "lançada na taxa" (a cobrança agora é por fora, combinada com o síndico).

Notificações e comprovante: reais gravados. Equipe: "Valor de uso: R$ 61,25 (5% da cota)."; morador: só reais.

## SEÇÃO 6 (substitui o item do combobox)

Removido o combobox da prévia (não há campo de unidade). A prévia é texto com `aria-live="polite"`; o link "Alterar a cota" tem nome acessível "Alterar a cota do condomínio (abre em outra aba)". O cartão de rádio "Percentual" desabilitado usa `aria-disabled="true"` e `aria-describedby` apontando para o texto do motivo.

## SEÇÃO 7 (substitui o item "Prévia" e a parte do morador)

- Prévia: texto simples, quebra em linhas no celular; o link "Alterar a cota" abaixo do texto no celular, alvo de 44px.
- Cartão "Percentual" desabilitado: o motivo e o link ficam logo abaixo do cartão, não em tooltip.
- Morador: o valor em reais fica logo abaixo de "Número de pessoas" e acima do botão de enviar, para o teclado não cobrir.

## SEÇÃO 8 (substitui 8.1, o trecho da prévia, e 8.3)

### 8.1 Desktop (gestão), trecho de "Valor de uso" com percentual
```
| Como o valor é definido?                                                |
| +---------------------------+  +--------------------------------------+ |
| | ( ) Valor fixo            |  | (o) Percentual da cota condominial   | |
| | Um valor em reais, igual  |  | Um percentual da cota do condomínio. | |
| | em todas as reservas.     |  | Se a cota mudar, o valor muda.       | |
| +---------------------------+  +--------------------------------------+ |
|                                                                         |
| Grátis até (pessoas)            Percentual da cota (%)                  |
| [ 10              ]             [ 5                         %]          |
|                                 Digite 5 para 5% da cota. Pode usar     |
|                                 vírgula: 7,5.                           |
|                                                                         |
| Até 10 pessoas: grátis. Acima de 10: 5% da cota do condomínio.          |
| Acima de 10 pessoas: 5% da cota de R$ 1.225,00 = R$ 61,25.              |
| Alterar a cota (abre em outra aba)                                      |
| A taxa de higienização não entra neste valor.                           |
```

### 8.1b Cota não cadastrada (percentual desabilitado)
```
| Como o valor é definido?                                                |
| +---------------------------+  +--------------------------------------+ |
| | (o) Valor fixo            |  | ( ) Percentual da cota condominial   | |
| | Um valor em reais, igual  |  | (cartão esmaecido, desabilitado)     | |
| | em todas as reservas.     |  |                                      | |
| +---------------------------+  +--------------------------------------+ |
| (i) Para usar percentual, cadastre antes a cota do condomínio.          |
|     Cadastrar a cota (abre em outra aba)                                |
```

### 8.3 Celular 375px, morador, formulário do pedido (percentual)
```
+---------------------------------+
| Número de pessoas               |
| [ 25                          ] |
|                                 |
| Valor de uso                    |
| R$ 61,25                        |
| Calculado com 5% da cota do     |
| condomínio. O síndico combina   |
| a cobrança com você.            |
| Higienização: R$ 80,00 (à parte)|
|                                 |
| [x] Li e aceito as regras       |
| [ Enviar pedido ]               |
+---------------------------------+
```
Variações: "Calculando o valor…"; "Informe o número de pessoas para ver o valor."; valor ainda não definido (cota não cadastrada, proteção): botão desabilitado com o motivo escrito.

## SEÇÃO 10 (substitui as perguntas P1 a P4; as demais seguem, com ajustes)

1. **P1. A cota aparece para o morador?** Recomendação: **não**; ele vê R$ e, em letra pequena, o percentual (seção 3.1). Se a assembleia pedir transparência, a cota entra uma linha abaixo do valor. Decisão do dono.
2. **P2. "Valor mínimo de cota" é o menor valor de cota entre as unidades?** Se as cotas forem diferentes, 5% do mínimo cobra menos que 5% das unidades maiores. O texto da tela de Configurações diz "o menor valor de cota condominial pago no condomínio". Confirmar com o dono e o síndico (também define o rótulo: "Cota condominial de referência").
3. **P3. O que entra na cota:** ordinária mensal, com ou sem fundo de reserva e rateios extras? Escrever na tela depois de confirmado.
4. **P4. Quem vê o valor em reais:** morador, equipe, Portaria e Conselho veem o mesmo valor (igual para todos). Recomendação: sim para todos que já leem reservas; a spec do PM decide a restrição de Portaria e Conselho.
5. P5 (arredondamento): centavo mais próximo, sem mínimo. P6 (cota atualizada depois): reservas já pedidas mantêm o valor gravado. **P7 ("paga sempre" antes do percentual): sim.** P8 (padrão do tipo): decisão do dono; com cota ausente o padrão efetivo é "Valor fixo". P9 (aviso de percentual alto): decisão do dono. P10 (cancelar reserva com valor): agora a cobrança é por fora; o texto de cancelamento passa a "Avise o síndico para ajustar a cobrança". P11 (espaço pago com aprovação): o valor só vale na aprovação. P12 (pessoas declaradas): na regra 3 o número serve só à capacidade.
6. **Removidas:** a origem da base (Superlógica, planilha, campo por unidade) e o tratamento de unidade sem cota, que deixam de existir com a cota única.

## SEÇÃO 11 (substitui)

1. Bloco "Valor de uso" em 375px em 3 estados (Grátis; regra 2 com percentual e prévia simples; regra 3 fixa), com comparação de cartões de tipo versus rádios simples.
2. Bloco "Valor de uso" com a cota **não cadastrada** (cartão "Percentual" desabilitado, motivo e link) em 375px.
3. Formulário do morador com valor percentual (2 variações de texto: "O síndico combina a cobrança com você" versus "O valor será combinado com o síndico"), para teste com 2 ou 3 moradores leigos. Perguntas: "Quem vai cobrar esse valor?" e "Quanto você vai pagar?".

## SEÇÃO 12 (substitui os critérios 8, 9 e 10 e acrescenta 12 e 13)

8. Morador, em espaço com percentual, vê R$ calculado com a cota única e a frase "O síndico combina a cobrança com você"; a **cota em si não é exibida** em nenhuma tela (pela API ela pode ser inferida: risco aceito pelo dono), `title` ou rótulo acessível dele (se a decisão P1 for manter oculta).
9. Lista de unidades, cartões e tabelas continuam sem cota; não existe cota por unidade em nenhuma tabela.
10. A gestão vê a prévia "5% da cota de R$ X = R$ Y" apenas no tipo Percentual; ela bate com a cota de Configurações e com o valor gravado numa reserva nova do mesmo espaço; o link "Alterar a cota" abre `/configuracoes#reservas`.
12. **Cota não cadastrada:** no formulário do espaço, o cartão "Percentual da cota condominial" fica desabilitado com o motivo escrito e o link "Cadastrar a cota"; não é possível salvar espaço com tipo percentual; nenhum texto antigo de "cotas das unidades" aparece.
13. Depois de cadastrar a cota em Configurações e voltar ao formulário, o cartão "Percentual" fica habilitado (ao ganhar foco a aba, ou ao recarregar) e a prévia aparece.
