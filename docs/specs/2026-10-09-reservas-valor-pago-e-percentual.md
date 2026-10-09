# Reservas: regra "pago em toda reserva" e valor em percentual da cota mínima do condomínio

Data: 2026-10-09 · Autor: PM · Status: **decisões do dono registradas em 09/10/2026; Fase 1 liberada para o developer; Fase 2 aguarda 1 pergunta residual (seção 9)** · Repositório público: nenhum dado real aqui.

Continua `docs/specs/2026-10-05-reservas-bloqueio-e-faixa-de-valor.md` (valor por faixa, migração 0039, em produção) e respeita `docs/produto.md`. Spec irmã: `docs/specs/2026-10-09-area-de-configuracoes.md` (onde a cota é cadastrada). Fontes lidas: 0039, `src/lib/valorEspaco.ts`, seção "Pedidos e valor" de `src/app/reservas/page.tsx`, `docs/specs/2026-10-07-integracao-superlogica.md`, `docs/processo-de-entrega.md`.

Legenda: **FATO** = conferido no código ou dito pelo dono. **RECOMENDO** = minha recomendação. **SUPOSIÇÃO** = a validar.

---

## 0. Decisões do dono (09/10/2026) e o que mudou nesta revisão

| # | Pergunta feita | Resposta do dono (literal, resumida) | Decisão |
|---|---|---|---|
| **D1** | Todas as unidades pagam a mesma cota? | "Existe uma **cota mínima**." Criar uma **área de Configurações**, com acesso só de Síndico, Subsíndico e ADM, para inserir isso; "no futuro algumas outras coisas vão precisar entrar ali". | **Cota ÚNICA do condomínio (opção a).** Nenhum dado de cota por unidade. Cadastrada numa área de Configurações restrita à gestão. |
| **D2** | "Reservando já tem que pagar": valor devido à reserva ou pagamento antecipado? | "A reserva é feita pela plataforma e o síndico faz a **cobrança por fora**." | **Opção (i):** o valor é devido pela reserva e cobrado por fora pelo síndico. **Sem pagamento online**, sem confirmar reserva por pagamento. Mantém a decisão de `docs/produto.md` ("não cobrar por enquanto"). |
| **D3** | O que é "a cota" e quem digita? | "É um valor **mínimo de cota** que serve de cálculo para tudo. O síndico deve ter uma área, que poderia ser em configurações, para cadastrar o valor." | O síndico (e Subsíndico e ADM) digita a **cota mínima (R$)** em Configurações; o percentual dos espaços incide sobre ela. |

**O que saiu desta spec por causa disso:** a opção (b) cota por unidade e a (c) leitura do Superlógica (ficam como "Depois", só com demanda); a tabela separada `unit_cotas`; a prévia por unidade; o erro `reserva_cota_indefinida` **por unidade**; a pergunta P2 (unidades iguais?), P1 (interpretação do pagamento), P3 (o que é a cota, resolvida pelo dono); a discussão de vazamento por inferência da cota de uma unidade (P5 antiga: com cota única não há dado por unidade, o risco some).
**O que simplificou:** uma configuração do condomínio com um campo; o morador não precisa de nada de cota; a auditoria é de uma única alteração.

**Termo adotado na tela:** "**Cota mínima do condomínio (R$)**", com a explicação "Valor de referência usado para calcular os valores em percentual." (SUPOSIÇÃO: o dono quis dizer valor de referência único e não o piso legal; a tela não promete mais que isso.)

---

## 1. Resumo e recomendação (primeiro)

1. **Fase 1 (liberada, sem migração): "Pago em toda reserva".** FATO: a 0039 já aceita `faixa_gratis_ate = 0` e `valor_reserva` devolve `faixa_valor` para qualquer número de pessoas. Falta só a opção existir na tela com nome claro. Esforço P, sem risco em produção.
2. **Fase 2 (migração 0048): área de Configurações + cota mínima + valor em percentual.** Cota única numa configuração do condomínio de linha única; espaço pode ser "Fixo (R$)" ou "Percentual da cota (%)"; o banco calcula e congela o R$ na reserva. **Revisão de segurança obrigatória** (dado financeiro e RLS) e processo de `docs/processo-de-entrega.md`.
3. **Cobrança é por fora (D2).** O Dona Wanda calcula, mostra e registra; o síndico cobra. Consequência de produto: o síndico precisa **conseguir ver o que cobrar**. O relatório "valores a lançar" continua inexistente (FATO); hoje só há a coluna "Valor" na lista. Como não há mais a Garden como destino obrigatório do lançamento, o relatório deixa de ser pré-requisito de produção e vira **melhoria separada** (seção 10, 2b).
4. **Não fazer agora:** pagamento antecipado ou online; cota por unidade; leitura da cota no Superlógica; histórico de cotas por vigência; mais de uma cota.
5. **Pergunta residual ao dono (1 linha, seção 9):** o morador pode ver a cota mínima na tela? **Recomendo que não** (ele vê só o R$ da reserva); só a gestão vê e edita.

---

## 2. Problema, quem sofre e o que acontece sem a feature

**Pedido do dono (09/10/2026):** (1) regra "Pago independente do número de pessoas"; (2) valor cadastrável em percentual (ex.: 5% da cota condominial) ou valor fixo.

- **Síndico/ADM:** espaços que sempre custam (churrasqueira, salão) hoje só têm "grátis até N e acima fixo"; quem não descobre o "0" cadastra errado ou combina por WhatsApp. Com valor fixo, a cada reajuste da cota o síndico reedita todos os espaços; esquecer significa cobrar valor defasado. Com a cota mínima única, **muda-se um número** e todos os percentuais acompanham (reservas já feitas não mudam).
- **Morador (celular, leigo):** quer saber antes de pedir quanto vai pagar, **em reais**. Percentual nunca é mostrado como conta ao morador; ele vê R$.
- **Cobrança:** fica com o síndico, por fora, usando o valor gravado na reserva.

**Se nada for feito:** espaço pago cadastrado errado ou combinado fora do sistema; reajuste manual de valores. Custo baixo hoje (um condomínio, 2 unidades em produção, FATO informado pelo dono), por isso a Fase 1 é barata e vale já, e a Fase 2 é conveniência com risco controlável.

---

## 3. Escopo mínimo por fase

### Fase 1: "Pago independente do número de pessoas" (sem migração)

**Objetivo:** o síndico cadastra um espaço sempre pago escolhendo uma opção clara. **Usuário:** Síndico, Subsíndico, ADM (quem edita espaços). **Texto da regra na tela:** "Pago em toda reserva" (o pedido do dono dizia "Pago independente do número de pessoas"; os dois são equivalentes, use o primeiro no rótulo curto e o segundo na explicação).

**Entra**
1. Na seção "Pedidos e valor" > "Valor de uso", **três opções** (hoje há duas):
   - "Grátis independente do número de pessoas" (como hoje);
   - **"Pago em toda reserva"** (nova): um campo, "Valor da reserva (R$)";
   - "Grátis até certo número de pessoas e, acima disso, valor fixo" (como hoje; passa a exigir **X maior que 0**, porque X = 0 agora é a opção nova).
2. **Modelo (sem coluna nova):** "pago em toda reserva" = `faixa_gratis_ate = 0` e `faixa_valor = R$ informado`. A tela decide o rótulo pelos dados. Nenhuma migração.
3. **Cálculo (banco, sem mudança):** `valor_reserva` já devolve `faixa_valor` para qualquer número de pessoas. O número de pessoas continua obrigatório (capacidade) mas **não altera o valor**.
4. **Textos** (`src/lib/valorEspaco.ts` já tem os ramos `limite === 0`; ajustar só o que falta):
   - Cartão do espaço e detalhes: "R$ 150,00 por reserva" (já existe).
   - Formulário do morador: "Valor de uso: R$ 150,00." sem "(acima de N pessoas)".
   - Prévia do cadastro: "Toda reserva deste espaço custa R$ 150,00, qualquer que seja o número de pessoas."
   - Ajuda da opção: "O valor é devido assim que o morador pede. A cobrança é feita pelo síndico, fora do Dona Wanda." (reflete D2; **não** dizer "administradora lança na taxa", que não é mais o fluxo declarado.)
   - **Higienização:** campo à parte, inalterada; linha própria na tela do morador ("Valor de uso R$ 150,00 + Higienização R$ 80,00"). Não somar numa linha só.
   - Remover do erro da faixa a frase "Use 0 se o valor vale para todos".
   - **Rodapé do morador:** substituir o texto atual "O Harmony só calcula e mostra..." por "O valor é calculado pelo Dona Wanda e cobrado pelo síndico. O Dona Wanda não recebe pagamento." (nome do produto, decisão de 08/10).
5. **Reservas existentes:** nada muda (valor gravado imutável, gatilho 05 da 0039). Espaços já salvos com X = 0 passam a aparecer na opção "Pago", sem alterar dado.

**Fica de fora da Fase 1:** percentual; cota; Configurações; pagamento antecipado ou online; "pago por pessoa"; mudança de reservas existentes; relatório.

### Fase 2: área de Configurações, cota mínima e valor em percentual (migração 0048)

**Objetivo:** o síndico cadastra a cota mínima uma vez, define espaços como "5% da cota" e o sistema calcula o R$ **por reserva, no banco, congelado no pedido**.

**Entra**
1. **Área de Configurações** (spec `docs/specs/2026-10-09-area-de-configuracoes.md`), v1 só com "Cota mínima do condomínio (R$)".
2. **Configuração do condomínio:** tabela de **linha única** (seção 4).
3. No espaço: tipo do valor **Fixo (R$)** ou **Percentual da cota (%)**, valendo para "pago em toda reserva" e para "acima de N pessoas". Higienização continua só em R$.
4. Gravar na reserva, além de `valor_uso`: `cota_base` (R$ usado) e `percentual_aplicado`, para conferência ("5% de R$ 1.200,00 = R$ 60,00"). Imutáveis como o resto.
5. Auditoria (seção 4.3).
6. A lista de reservas da gestão mostra, quando percentual, o valor em R$ e "(5% da cota)".

**Fica de fora da Fase 2:** relatório "valores a lançar" como item próprio (2b); ler a cota do Superlógica; cota por unidade ou por tipo de unidade; percentual da higienização; reajuste automático retroativo; histórico de cotas por vigência (só "atual"); mais de uma cota (ordinária, extra, fundo).

---

## 4. Desenho de dados da Fase 2 (simplificado pela cota única)

**FATO:** `units` não tem cota; e `units_read` (0042) entrega a linha inteira a Síndico, Subsíndico, ADM, Portaria, Conselho e à própria unidade. Como a cota agora é do condomínio e não da unidade, **nada entra em `units`**.

### 4.1 Tabela de configuração de linha única (RECOMENDO)

`condominio_config`: `id smallint primary key default 1 check (id = 1)`, `cota_minima numeric(12,2)` **nula = não cadastrada**, com `check (cota_minima is null or cota_minima > 0)`, `atualizado_por uuid`, `atualizado_em timestamptz`. Uma linha criada pela própria migração.

**Por que linha única com colunas tipadas e não chave-valor:** cada configuração futura é uma coluna com seu tipo e seu `check` no banco (valor inválido não entra), a RLS é uma só e testável, sem `text` genérico. Chave-valor pareceria flexível, mas perde validação e convida a "guardar qualquer coisa". Custo: cada configuração nova exige uma migração aditiva pequena; aceitável (poucas e raras).

### 4.2 Quem lê e quem edita

- **RLS ligada; `revoke all ... from public, anon, authenticated`;** `grant select` e policy de leitura só para `is_admin()` (Síndico, Subsíndico, ADM).
- **Edição:** só por função `security definer` com `search_path` fixo (`definir_cota_minima(valor)`), que checa `is_admin()` e a faixa do valor; **sem `update` direto** para nenhum perfil logado. O servidor (rota de API) chama a função com a sessão do usuário.
- **Quem NÃO acessa:** Conselho, Portaria, Zelador, Morador e Provisório recebem negação por API (consulta direta à tabela).
- **O cálculo da reserva não depende do morador poder ler a tabela:** `valor_reserva` e o gatilho `reservations_calcular_valor` são `security definer` e leem a cota por dentro.
- A hierarquia entre perfis de gestão (05/10, #68) **não se aplica**: é configuração do condomínio, não ação sobre outra conta; Síndico, Subsíndico e ADM têm o mesmo poder aqui.

### 4.3 Auditoria

A alteração da cota é registrada em `audit_logs` **pelo servidor** (`gravarAuditoria`, `src/lib/auditoriaServidor.ts`, como a #68), com quem e quando, **sem os valores**: "Alterou a cota mínima do condomínio". Motivo: o Conselho lê o histórico, e cota/valor ficam só com a gestão. A tabela guarda `atualizado_por` e `atualizado_em`. Se o servidor não consegue gravar a auditoria, a alteração deve ser considerada **não concluída** para o usuário (decisão a confirmar com o developer: gravar auditoria e alteração na mesma função do banco, para não haver alteração sem rastro; **RECOMENDO** essa via, com o servidor só repassando o executor).

### 4.4 Quando a cota ainda não foi cadastrada

- **Salvar espaço percentual sem cota cadastrada:** **o banco recusa** (constraint ou gatilho em `spaces`, código curto `cota_nao_cadastrada`); a tela, antes, já bloqueia com "Cadastre antes a cota mínima em Configurações" e leva ao link da área (só a gestão chega aqui, pois só ela edita espaços).
- **Reserva de espaço percentual com a cota removida depois** (cota nula): o banco recusa a criação com `reserva_cota_indefinida` (agora **uma condição global**, não por unidade); tela do morador: "O valor desta reserva ainda não foi definido. Fale com a administração." e aviso à gestão no sino. **Nunca gravar 0 em silêncio.** Na prática só ocorre se a cota for apagada: **RECOMENDO que a v1 não permita apagar a cota** (só alterar para outro valor maior que 0), o que torna esse caso quase impossível; o código de recusa permanece como defesa.
- **Reservas já feitas mantêm o valor gravado** (`valor_uso`, `cota_base`, `percentual_aplicado` imutáveis). Mudar a cota ou o percentual do espaço **só vale para reservas novas**; o aviso "vale só para novos pedidos" continua.
- **Espaços Fixo e grátis** nunca dependem da cota.

### 4.5 Regras de cálculo

- O banco calcula `round(cota × percentual / 100, 2)`, **meio para cima**, uma única vez, na criação. Percentual com até 2 casas decimais, maior que 0 e até 100 (SUPOSIÇÃO: acima de 100% seria erro de digitação).
- O percentual vale para o **valor cobrado** em "pago em toda reserva" e em "grátis até N, acima disso valor". Um espaço não mistura fixo e percentual.
- O banco **ignora qualquer valor vindo do cliente** (inclusive `cota_base`).
- Cota: faixa aceita, **R$ 1,00 a R$ 100.000,00** (piso e teto decididos pelo dono em 09/10/2026, para pegar erro de digitação; o `numeric(12,2)` aguentaria mais). O valor FIXO do espaço também vai até R$ 100.000,00 e não aceita NaN.

---

## 5. Visibilidade (com cota única)

| Informação | Quem vê | Observação |
|---|---|---|
| **Cota mínima (R$)** | **Só Síndico, Subsíndico e ADM** | RECOMENDO. A cota do condomínio é provavelmente conhecida de todos pelo boleto (SUPOSIÇÃO), mas mostrá-la no app não traz benefício ao morador e abre pergunta de suporte ("por que 5% de X deu isso?"). Pergunta residual P7 (seção 9). |
| **Percentual do espaço** | Gestão sempre; morador, Portaria e Conselho veem no cartão do espaço "5% da cota" **só se** o dono quiser; padrão **não mostrar**: cartão e formulário do morador exibem R$ | Percentual e cota em R$ dariam a conta; sem a cota visível, o R$ já basta. |
| **Valor em R$ da reserva** | Morador: **só as da própria unidade**. Portaria e Conselho: todas (já leem reservas hoje, comportamento existente). Gestão: todas | Com cota única, o R$ de uma reserva não revela dado individual; a inferência por unidade (P5 antiga) deixa de existir. |
| **Cota e percentual aplicados na reserva** (`cota_base`, `percentual_aplicado`) | Gestão. Morador: não vê esses campos (vê só o R$) | Evitar que as colunas apareçam em listas do morador, Portaria e Conselho: **selecionar colunas explícitas** nas telas (sem `select *`). Se Portaria e Conselho já leem `reservations` inteira, `cota_base` vaza a cota para eles. **Item de segurança para o developer:** ou mover essas duas colunas para uma tabela filha só da gestão, ou aceitar que Portaria e Conselho vejam a cota (decidir com o dono em P7; **RECOMENDO aceitar**, é dado do condomínio, não de uma unidade; mas a cota "não exibida na tela do morador" fica valendo; pela API ela pode ser inferida (percentual do espaço + valor final), risco aceito pelo dono). |

---

## 6. Matriz de perfis

`is_admin()` = Síndico, Subsíndico e ADM.

| Perfil | Editar espaço e valor | Ver Configurações / cota | Editar a cota | Ver o R$ de uma reserva | Ver `cota_base` na reserva |
|---|---|---|---|---|---|
| **Síndico** | Sim | Sim | Sim | Todas | Sim |
| **Subsíndico** | Sim | Sim | Sim | Todas | Sim |
| **ADM** | Sim | Sim | Sim | Todas | Sim |
| **Conselho** | Não | **Não** (nem o item no menu) | Não | Todas (já lê reservas hoje) | Ver seção 5 (P7) |
| **Portaria** | Não | **Não** | Não | Todas (já lê reservas hoje) | Ver seção 5 (P7) |
| **Zelador** | Não | **Não** | Não | Conforme acesso atual à tela de reservas | Não |
| **Morador** (validado) | Não | **Não** | Não | **Só da própria unidade** | **Não** |
| **Provisório** | Não | **Não** | Não | Não (sem acesso a reservas, como hoje) | Não |

Todo "Não" é testado **por API** (consulta direta ao banco e à rota com a sessão daquele perfil), não só pela tela.

---

## 7. O que o morador vê

- **Formulário do pedido:** sempre valor em reais, calculado pelo banco (mesma função da prévia e da gravação). "Valor de uso: R$ 60,00." Higienização em linha própria. Rodapé: "O valor é calculado pelo Dona Wanda e cobrado pelo síndico. O Dona Wanda não recebe pagamento."
- **Pedido enviado e lista da unidade:** o valor **gravado**, nunca recalculado.
- **Cota não cadastrada (caso residual):** mensagem da seção 4.4, sem número nem erro técnico.
- **Número de pessoas** continua pedido mesmo em "pago em toda reserva": ajuda "Não muda o valor deste espaço."

---

## 8. Regras de banco (a cargo do developer; numeração 0048)

**Fase 1:** nenhuma. Conferir apenas, em staging, que a tela grava `faixa_gratis_ate = 0` e `faixa_valor > 0` e que `valor_reserva` devolve o valor para 1 e para `capacidade_max` pessoas.

**Fase 2 (migração única, aditiva, versão final das funções redefinidas, `docs/processo-de-entrega.md`):**
1. `condominio_config` (seção 4.1), com a linha única inserida pela migração, RLS e grants (4.2) e função `definir_cota_minima` (valida `is_admin()`, faixa; grava `atualizado_por`/`atualizado_em`; grava a auditoria na mesma transação, se confirmado).
2. `spaces`: `valor_tipo text not null default 'FIXO' check in ('FIXO','PERCENTUAL')`, `faixa_percentual numeric(5,2)`. Recriar `spaces_faixa_check`: FIXO exige `faixa_valor > 0` e `faixa_percentual` nulo; PERCENTUAL exige `faixa_percentual > 0 and <= 100` e `faixa_valor` nulo; `faixa_gratis_ate >= 0` e `< capacidade_max`; nulos juntos = grátis. Gatilho em `spaces` recusa PERCENTUAL se `cota_minima` for nula (`cota_nao_cadastrada`). Linhas de produção continuam válidas.
3. `reservations`: `cota_base numeric(12,2)`, `percentual_aplicado numeric(5,2)`, nulas nas existentes. Gatilho 05 (`reservations_proteger_valor`) estendido (redefinir a função completa).
4. `valor_reserva` e `reservations_calcular_valor` (gatilho 12): redefinidos completos; fixo ou percentual; ignoram valor do cliente; `reserva_cota_indefinida` se a cota for nula; arredondamento da 4.5.
5. `reservations_avisar_confirmacao_automatica` (última versão na 0039): frase do valor serve para percentual. **Reler a versão mais recente antes de reescrever; migração antiga não é reaplicada.**
6. `producao.sh checar` ganha item para a 0048 (tabela, função, constraint, policies).

---

## 9. Critérios de aceite (testáveis)

**Fase 1: "Pago em toda reserva"**
1. A seção "Valor de uso" mostra **três** opções; "Pago em toda reserva" pede só "Valor da reserva (R$)". A faixa ("Grátis até...") exige limite **maior que 0**, com mensagem em português.
2. Salvar espaço "Pago" com R$ 150,00 grava `faixa_gratis_ate = 0` e `faixa_valor = 150.00`; reabrir mostra a opção "Pago" marcada com o valor.
3. Morador pede com 1 pessoa e com `capacidade_max` pessoas: ambos gravam `valor_uso = 150.00`.
4. Espaço "Grátis" grava 0 para qualquer número; faixa "até 20 / R$ 150" continua 0 com 20 e 150 com 21 (sem regressão da 0039).
5. Higienização em linha à parte e fora do valor de uso; espaço pago com higienização R$ 80 mostra os dois valores e o total.
6. **Reservas existentes não mudam:** `valor_uso`, `taxa_higienizacao` e `convidados_estimados` de todas as reservas de staging idênticos antes e depois (contagem e soma).
7. Mudar o espaço para "Pago" depois de ter reservas não altera as já criadas; a tela avisa "vale só para novos pedidos".
8. `valor_uso` manipulado por API (morador, Portaria, Conselho e `is_admin()`) é ignorado; vale o da regra.
9. Morador, Portaria, Conselho, Zelador e provisório **não conseguem** alterar o espaço por API; Síndico, Subsíndico e ADM conseguem.
10. O rodapé diz "Dona Wanda" e **não** diz que a administradora lança na taxa; diz que o síndico cobra. "Harmony Residence" só como nome do cliente.
11. 375px: sem rolagem horizontal; alvos de 44px; valor visível com o teclado aberto; leitor de tela anuncia a opção e a prévia (`aria-live`).

**Fase 2: Configurações, cota mínima e percentual**
12. Com cota R$ 1.200,00, espaço "Pago: 5% da cota" e uma reserva: `valor_uso = 60.00`, `cota_base = 1200.00`, `percentual_aplicado = 5.00`. Arredondamento: cota 1.234,56 × 5% = 61,728 grava **61,73**; 1,10 × 5% = 0,055 grava **0,06**.
13. Depois da reserva, mudar a cota para R$ 1.500,00 ou o percentual do espaço **não altera** `valor_uso`, `cota_base` nem `percentual_aplicado` da reserva existente; `update` direto é negado a todos os perfis logados.
14. **Cota não cadastrada:** salvar espaço percentual é barrado na tela (mensagem com link para Configurações) **e recusado pelo banco por API** (`cota_nao_cadastrada`). Reserva em espaço percentual com cota nula é recusada (`reserva_cota_indefinida`), a tela mostra a mensagem da seção 4.4 e nenhuma reserva é criada com valor 0 por esse motivo.
15. Faixa percentual: "grátis até 20 / 5% acima": 20 pessoas grava 0 e `cota_base` nulo; 21 grava o valor calculado. "Pago em toda reserva 5%": grava o valor para 1 e para a capacidade.
16. O banco recusa espaço com valor fixo e percentual preenchidos ao mesmo tempo.
17. **Segurança:** só `is_admin()` lê `condominio_config` e chama `definir_cota_minima`; Portaria, Conselho, Zelador, Morador e Provisório recebem negação por API (leitura direta, função e `update`); nenhuma resposta de `units` contém cota.
18. Cota inválida (zero, negativa, texto, acima do teto) é recusada pelo banco com mensagem em português na tela.
19. **Auditoria:** alterar a cota gera linha em `audit_logs` gravada pelo servidor, com quem e quando, **sem valores**; o histórico visível ao Conselho não mostra a cota.
20. Reservas anteriores à migração mantêm `cota_base` e `percentual_aplicado` nulos e valores idênticos (conferência de soma em staging e, só leitura, em produção pelo `checar`).
21. Morador, na lista e no formulário, **não vê a cota** nem `cota_base` **na tela** (a resposta da API de reservas não traz esses campos). Inferir a cota pela API (percentual do espaço + R$ final) é possível: risco aceito pelo dono.

**Bateria:** casos 3 a 9 (Fase 1) e 12 a 21 (Fase 2) entram em `scripts/qa/bateria.mjs`, com dados fictícios, por perfil.

---

## 10. Riscos

1. **Cota errada gera cobrança errada em dinheiro real.** Com cota única, um número errado afeta **todos** os espaços percentuais. Mitigação: teto de valor, confirmação ao salvar ("Isto vale só para novas reservas"), valor sempre visível ao síndico na lista de reservas, reserva congela a base; o síndico confere o primeiro mês.
2. **A cota única só vale se todas as unidades pagam igual** (D1 afirma "cota mínima"; SUPOSIÇÃO de que isso significa todas iguais). Se o síndico descobrir frações diferentes, o percentual sobre o mínimo cobra a menos de umas e certo de outras: **explicar na tela que o percentual incide sobre a cota mínima**. Cota por unidade segue "Depois", só com demanda.
3. **Cobrança por fora (D2):** sem conciliação no sistema. Risco: o síndico esquecer de cobrar, ou o morador contestar o valor. Mitigação: valor e cálculo gravados e legíveis na reserva; relatório "a lançar" como melhoria (2b). Não é pagamento do Dona Wanda, então fora de regulação de dinheiro de terceiros; reavaliar se o dono pedir Pix/boleto (contestaria então a decisão "não cobrar").
4. **LGPD:** cota do condomínio não é dado pessoal; `cota_base` na reserva fica ligada a unidade, mas é idêntica para todas (sem informação individual). Mesmo assim, só a gestão edita; auditoria sem valores. Valor de uso por reserva continua como já é (Portaria e Conselho leem).
5. **Segurança (revisão obrigatória):** RLS e `revoke` na tabela nova; função `security definer` com `search_path` fixo; gatilhos que ignoram valor do cliente; `cota_base` visível a perfis que leem `reservations` (seção 5). Falha de configuração aqui = valor de cobrança adulterável.
6. **Regimento/assembleia:** cobrar por espaço, e em percentual da cota, precisa estar previsto (aberto na spec de 05/10, risco 3). O sistema não induz cobrança sem base; não é parecer jurídico.
7. **Migração em produção (Fase 2):** recriar `spaces_faixa_check`; colunas novas nulas; funções na **versão final** (a 0039 redefine o aviso da 0034; reaplicar migração antiga desfaz regra, incidente de 08/10). Uma migração por vez, uma vez cada; banco antes do código; backup antes; `checar` antes e depois. Efeito esperado: **zero linha de reserva alterada**.
8. **Fase 1 em produção não tem migração:** conferir antes, em leitura, se algum espaço de produção já tem `faixa_gratis_ate = 0` (aparece na opção nova, sem mudar dado) e que nenhum tem limite incoerente.
9. **Suporte:** o morador não entende percentual. Mitigação: só R$ ao morador. O síndico precisa de uma frase clara em Configurações.
10. **Escopo:** a área de Configurações vai atrair pedidos ("coloca também...") . Mitigação: regra de crescimento da spec de Configurações (cada item novo com dono, motivo e spec).
11. **Número de pessoas declarado pelo morador** (herdado da 0039): em "pago em toda reserva" deixa de afetar o valor.

---

## 11. Pergunta residual ao dono e decisões que ainda dependem de confirmação

| # | Pergunta (1 linha) | Recomendação |
|---|---|---|
| **P7** | **O morador pode ver o valor da cota mínima na tela, ou só o R$ da própria reserva?** | **Só o R$ da reserva**; cota visível só a Síndico, Subsíndico e ADM. |

Premissas que declarei (o dono contesta se discordar): cota mínima entre R$ 1,00 e R$ 100.000,00; a cota não pode ser apagada depois de cadastrada, só alterada; o texto "Cota mínima do condomínio"; a cobrança por fora é do síndico (não da Garden), então o relatório "a lançar" vira melhoria opcional.

**O que eu cortaria e NÃO fazer agora:** pagamento antecipado ou online; cota por unidade; leitura da cota do Superlógica; histórico de cotas por vigência; percentual para higienização; mais de uma cota; mostrar percentual ou cota ao morador; relatório antes de o síndico dizer que precisa.

---

## 12. Fases e ordem

| Fase | O quê | Esforço (SUPOSIÇÃO, developer revisa) | Depende de | Produção |
|---|---|---|---|---|
| **1** | Opção "Pago em toda reserva" na tela, textos, rodapé "Dona Wanda" e "cobrado pelo síndico", bateria | P (horas a 1 dia) | nada (D2 decidida) | **sem migração**; só código, depois do ok do dono |
| **2** | Área de Configurações + `condominio_config` + cota mínima + espaço Fixo/Percentual + gatilhos + congelamento + auditoria (migração 0048) | M | P7 (visibilidade), spec de Configurações | uma migração (0048), staging com `--duas-vezes`, **revisão de segurança obrigatória**, QA, processo de `docs/processo-de-entrega.md` |
| **2b (opcional)** | Relatório "valores a lançar" em R$ e base | M | síndico dizer que precisa | função só gestão, CSV |
| **Depois** | Cota por unidade; leitura do Superlógica; reajuste com lembrete | G | demanda concreta | fora |

Validação mais barata antes da Fase 2: **10 minutos com o síndico** (confirmar "cota mínima" = valor único; qual número ele digitaria; se o regimento fala em % da cota) e uma **planilha simples** "5% de R$ X = R$ Y" conferida por ele.

---

## 13. Trecho proposto para `docs/produto.md`

Ver o registro já adicionado (aprovação do dono sobre as decisões de 09/10/2026): seção "Decisões tomadas", entradas "Reservas: valor em toda reserva e percentual da cota única" e "Área de Configurações".
