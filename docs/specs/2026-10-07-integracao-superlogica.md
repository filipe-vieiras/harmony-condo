# PRD: Integração do Harmony com o Superlógica Condomínios (administradora Garden)

Data: 2026-10-07 · Autor: PM · Status: **proposta para decisão do dono; nada para construir antes da Fase 0** · Issues: #18 (qual sistema a administradora usa: respondida) e #21 (atalho "Boleto e 2ª via") · Repositório público: nenhum dado real, token ou credencial neste documento.

Legenda: **DECIDIDO** = decisão já registrada do dono. **RECOMENDO** = recomendação do PM. **SUPOSIÇÃO** = número ou fato que eu não sei; precisa de validação. **A CONFIRMAR** = fato do Superlógica não confirmado.
Fonte técnica (não repetida aqui): `docs/pesquisas/2026-10-07-api-superlogica.md` (o "estudo"; seções citadas como "estudo §N"). Contexto: `docs/pesquisas/2026-10-04-integracao-financeiro.md`, `docs/specs/2026-10-05-reservas-bloqueio-e-faixa-de-valor.md`, `docs/produto.md`.
Observação: não consultei o GitHub; as issues #18 e #21 foram lidas pelo backlog (`docs/backlog/2026-10-05-backlog.md`).

---

## 0. Resumo e recomendação (primeiro)

1. **A (atalho, #21) já está 80% pronto no código.** Existe o cartão "Portal da Administradora" (tabela `portal_administradora`, migração 0015, singleton, link editável por Síndico/ADM, **vazio por padrão**). Falta: a Garden dar o link, o dono cadastrar, validar `http(s)` e um atalho curto no Início do morador. É trabalho de horas. **Faça já.**
2. **B (consulta somente leitura da PRÓPRIA unidade): construir só depois de três coisas** — (a) a Garden responder as 6 perguntas bloqueantes da seção 11; (b) uma prova de conceito contra um ERP de teste (não contra a Garden); (c) evidência de que o atalho A não basta. Ceticismo de PM: o morador **já consegue** pagar e pedir 2ª via no portal da Garden. O ganho real do B é **tirar o login separado** (idosos, senha esquecida) e reduzir perguntas ao síndico. Se, depois de 30 dias de A, ninguém reclama de login nem pede 2ª via ao síndico, **o B não vale o risco** (token amplo, dado financeiro de terceiros, suporte). Isto é hipótese a validar, não fato.
3. **C (taxa de reserva virar lançamento no Superlógica): não construir agora.** Escreve dinheiro real na conta de um morador real, sem idempotência documentada. Hoje o relatório "valores de reservas a lançar" (spec de 05/10, migração 0039) cobre a necessidade com uma pessoa da Garden lançando à mão. C só entra com demanda concreta (gatilho na D8) e depois de B rodando.
4. **Não pedir nem aceitar token de um usuário "completo" da Garden.** Sem usuário dedicado, limitado ao nosso condomínio e só de consulta, o B para (critério de parada, seção 3.2).

---

## 1. Problema, quem sofre e o que acontece sem a feature

**Problema.** Quem emite e cobra o boleto do condomínio é a administradora (Garden), no Superlógica. O Harmony é onde o morador já está (link no WhatsApp, celular), mas **não tem nada financeiro**: o morador vai a outro site, com outro login, para achar o boleto ou a 2ª via.

**Quem sofre e quando**
- **Morador proprietário (muitos, leigos, alguns idosos, no celular):** perde o boleto, ou esquece a senha do portal da administradora, e pergunta ao síndico ou ao grupo do WhatsApp. É o que faz hoje: pergunta a alguém ou liga para a Garden.
- **Inquilino:** em geral nem sabe onde está o boleto (costuma ser do proprietário; **A CONFIRMAR** com a Garden, estudo §6).
- **Síndico/Subsíndico:** vira balcão de "cadê meu boleto". Não consegue ver "esta unidade está em dia?" sem ligar para a Garden.
- **ADM (Garden):** recebe a pergunta repetida; hoje lança à mão a taxa de reserva a partir do relatório.
- **Conselho, Portaria, Zelador:** sem necessidade de ver situação financeira individual (tabela abaixo).

**Se nada for feito:** o síndico segue como balcão de 2ª via; o morador segue indo ao portal da Garden (que funciona). O custo de não fazer B é baixo e conhecido; o custo de fazer errado (vazamento de inadimplência entre vizinhos) é alto. Por isso A primeiro e B condicionado.

**Quem vê o quê financeiro (RECOMENDO).** "Financeiro" = boletos em aberto, valores, vencimentos, situação, 2ª via. Reafirma `docs/produto.md`: situação de pagamento **só para a própria unidade e para o síndico, nunca na lista de unidades**.

| Perfil | Atalho do portal (A) | Consulta no app (B) | Lançar taxa de reserva (C) |
|---|---|---|---|
| **Morador proprietário** (validado) | Vê | **Só a PRÓPRIA unidade** | Vê o valor da própria reserva (já existe) |
| **Morador inquilino** (validado) | Vê | **Não por padrão.** A gestão libera por unidade se a Garden confirmar que o inquilino recebe o boleto (D2) | Vê o valor da própria reserva |
| **Síndico / Subsíndico** | Vê | **Unidade por unidade, sob demanda, com registro de acesso.** **Sem** lista de inadimplentes na v1 (o Superlógica já entrega isso à Garden) | Aciona, confere e vê o estado |
| **ADM (Garden)** | Vê | Igual ao Síndico (mesmo `is_admin()`) | Igual ao Síndico |
| **Conselho** | Vê | **Não** (fiscaliza pela prestação de contas da Garden, não por situação individual). Decisão nova: D3 | Não |
| **Portaria** | Vê | **Não** | Não |
| **Zelador** | Vê (é link público; sem unidade) | **Não** (já decidido em `docs/specs/2026-10-05-perfil-zelador.md`: sem situação financeira) | Não |
| **Provisório / visitante** | Não (mantém a regra de hoje do provisório) | **Não** | Não |

Por que o síndico vê unidade a unidade e não um painel: o painel de inadimplência é outro produto (o Superlógica e os concorrentes já fazem), traz o maior risco LGPD (lista de devedores no celular de várias pessoas) e não resolve o problema do morador.

---

## 2. Objetivos e métricas de sucesso

Princípio: antes de medir o B, medir o problema. Hoje **não há medição** de "quantas vezes por mês o morador pede 2ª via ao síndico/Garden" (SUPOSIÇÃO de que é frequente). O Harmony também não tem análise de uso (#58 adiada); as métricas de adoção são **conversa e contagem manual**, não painel.

| # | Objetivo | Métrica testável | Meta (SUPOSIÇÃO; ajustar com a linha de base) | Fase |
|---|---|---|---|---|
| M0 | Conhecer o tamanho do problema | Síndico e Garden anotam por 2 a 4 semanas quantos pedidos de 2ª via/boleto recebem | Linha de base registrada em `docs/` antes de decidir o B | 0 |
| M1 | O atalho resolve | Depois de 30 dias de A, síndico e Garden dizem se os pedidos caíram | Queda percebida; se nenhuma, **não fazer B** | A |
| M2 | B é seguro | Testes de isolamento (seção 9): morador A nunca recebe dado da unidade B | **0 falhas** (bloqueante) | B |
| M3 | Vínculos corretos | % de unidades ocupadas com vínculo CONFIRMADO; acerto na conferência por amostra | ≥ 95% vinculadas na abertura geral; 100% de acerto na amostra | B |
| M4 | Funciona | Consultas com sucesso (excluindo queda do Superlógica); latência p95 | ≥ 99%; p95 < 3 s com cache quente (sem medição real da API, estudo §9) | B |
| M5 | Reduz suporte | Pedidos de 2ª via ao síndico/Garden por mês contra M0 | -50% em 60 dias de piloto | B |
| M6 | Adoção | Moradores que consultaram boleto em 60 dias (contagem no banco, sem identificar) | ≥ 30% das unidades vinculadas | B |
| M7 | Sem tocar o que não deve | CPF, RG, nascimento, dado bancário ou de cartão do Superlógica em tabela, log, cache ou resposta | **0 ocorrências** na varredura de QA e segurança | B, C |
| M8 | Sem cobrança duplicada ou errada | Lançamentos duplicados ou com valor diferente do aprovado | **0** | C |
| M9 | C vale o custo | Tempo e erros do lançamento manual atual na Garden versus automático | Só construir C com ganho medido (D8) | C |

---

## 3. Fases: escopo, fora de escopo, dependências, ordem

### 3.0 Ordem recomendada

1. **Fase 0: perguntas à Garden + conversa com o síndico (M0) + prova de conceito num ERP de teste.** Paralela à Fase A. Esforço **P** nosso; **o prazo depende da Garden**.
2. **Fase A: atalho (#21).** **P.** Pode ir já.
3. **Fase B0 (fundação):** vínculo unidade↔Superlógica, tela de gestão, camada segura de servidor, feature flag. **M.**
4. **Fase B1 (consulta e 2ª via):** tela do morador e da gestão. **M.**
5. **Fase B2 (piloto, QA, segurança, abertura gradual).** **P a M.**
6. **Fase C: congelada** até a D8. **G.**

### 3.1 Fase A: atalho para o portal (#21)

**Objetivo:** o morador chega ao boleto e à 2ª via em 1 toque, sem o Harmony tocar em dado financeiro.
**Usuário:** morador validado (proprietário e inquilino) e equipe.
**Já existe (conferido):** `portal_administradora` (singleton `id = 1`, `descricao`, `link_externo`, vazio por padrão), leitura por `tem_perfil()` (0028), escrita só `is_admin()`, cartão "Portal da Administradora" em Links e Documentos (`src/app/links/page.tsx`) com o botão "Acessar Portal do Condômino", que só aparece com link; sem link, "A administração ainda não informou o link do portal". O Início tem o cartão "Zeladoria", mas **não tem atalho de boleto**.

**Entra**
1. **Conteúdo (sem código):** a Garden informa o endereço da Área do condômino (formato típico `https://LICENCA.superlogica.net/areadocondomino/...`, **A CONFIRMAR**); o dono (ou ADM) cadastra no cartão existente. Em staging, endereço fictício.
2. **Validação do link:** só `http://` ou `https://` (recomendo só `https`), no cadastro e na exibição. Corrige o achado B6 de `docs/seguranca/2026-10-05-auditoria-geral.md`. Abrir com `target="_blank"` e `rel="noopener noreferrer"` (já é assim).
3. **Atalho "Boleto e 2ª via" no Início do morador** (e do inquilino): linha ou botão pequeno que abre o mesmo link, **só se houver link**. Não é um Início novo: o dono reverteu o último redesenho do Início sem dizer o motivo (`docs/produto.md`); o designer escolhe a posição mais discreta, sem mexer no resto.
4. **Texto honesto no cartão e no atalho:** "Abre o site da administradora. Pode ser pedido um login separado." Com a resposta da Garden sobre como o morador entra (pergunta 5.1), acrescentar a dica certa.

**Fora de escopo:** qualquer chamada à API; mostrar valor; login único; guardar o que o morador faz no portal.
**Dependências:** o link da Garden; a Garden **ter dado acesso ao portal aos moradores** (pergunta 5.1). Se os moradores não têm login, o atalho leva a um beco sem saída: é o risco principal da Fase A.
**NÃO fazer:** receber a senha do morador no Superlógica (estudo §3.11); abrir o portal dentro de quadro (iframe); pré-preencher e-mail ou CPF na URL; contar cliques identificando o morador.

**Requisitos e critérios de aceite (Dado/Quando/Então)**
- **A1.** *Dado* link cadastrado e morador validado, *quando* abre o Início no celular, *então* vê "Boleto e 2ª via" e, ao tocar, abre o portal em nova aba, com alvo de toque de 44px e sem rolagem horizontal a 375px.
- **A2 (vazio).** *Dado* nenhum link cadastrado, *quando* o morador abre o Início, *então* o atalho **não aparece**; em Links e Documentos o cartão mostra "A administração ainda não informou o link do portal"; Síndico/ADM veem "Link ainda não cadastrado" e o lápis para editar.
- **A3 (validação).** *Dado* Síndico/ADM cadastrando `javascript:alert(1)`, `ftp://x` ou texto sem endereço, *quando* salva, *então* recebe erro em português e nada é gravado; um `https://` válido grava.
- **A4 (permissão).** *Dado* Portaria, Conselho ou Zelador, *quando* abrem Links, *então* leem o cartão (como hoje) e **não** editam; só Síndico, Subsíndico e ADM editam (testado por API). **Conferir** que o `isSindico` de `links/page.tsx` cobre Subsíndico e ADM como a policy `is_admin()`.
- **A5 (provisório).** *Dado* morador provisório, *quando* abre o Início, *então* não vê o atalho.
- **A6 (destino fora do ar).** O Harmony não verifica se o portal está no ar; sem estado de erro nosso.

**Esforço: P (horas).**

### 3.2 Fase B: consulta somente leitura da própria unidade

**Objetivo:** o morador liberado vê **os boletos em aberto da própria unidade e abre a 2ª via**, sem outro login, com a hora da última consulta visível. O síndico/ADM faz o mesmo por unidade, para suporte.
**Usuário:** proprietário validado (v1); gestão (suporte). Inquilino só se a D2 liberar.

**Entra (v1, escopo mínimo que ensina algo)**
1. **Vínculo** unidade↔cadastro do Superlógica, com confirmação humana (seção 5).
2. **Tela do morador "Boleto e 2ª via"** (nome final: designer): situação ("Nenhum boleto em aberto" ou "N boleto(s) em aberto"), lista de boletos **pendentes** (a vencer e vencidos) com competência, vencimento e valor, e o botão "Abrir 2ª via". Mostra "Atualizado às HH:MM". Sempre com o atalho A ao lado.
3. **Tela da gestão:** na unidade (Moradores/Unidades), "Ver boletos desta unidade" e o estado do vínculo; e uma tela "Vínculos com o Superlógica" (propor, confirmar, suspender).
4. **Registro de acesso** (6.7) e **feature flag** (seção 8).

**Fora de escopo (cortes meus):** histórico de boletos pagos (v1.1, só com pedido); painel/lista de inadimplentes; extrato e prestação de contas; saldo do condomínio; aviso de vencimento por WhatsApp (hipótese não validada, `docs/produto.md`); e-mail de 2ª via por CPF (endpoint público com CPF na URL, estudo §3.1); linha digitável e Pix (a API não mostra campo, **A CONFIRMAR**); qualquer escrita no Superlógica; ler ou espelhar contatos, comunicados e documentos; morador com várias unidades (etapa 2 de `docs/produto.md`); multi-condomínio; webhook (a API não documenta, estudo §4); sincronização em lote.

**Dependências**
- Garden: plano com API, usuário dedicado só de consulta e limitado ao Harmony Residence, autorização escrita para mostrar ao morador, condomínio de teste (seção 11).
- Fase 0 concluída (POC com resposta real de `cobranca/index`, `gerarlinksegundavia`, significado de status, formato do link, boleto vencido).
- Nosso lado: decisões D1 a D7 e D10.

**Critérios de parada (qualquer um para o B):** (1) o plano da Garden não inclui API ou custa mais do que o dono aceita (D9); (2) não dá para restringir o token a consulta e ao Harmony Residence; (3) a Garden não autoriza mostrar o boleto ao morador, ou o contrato proíbe; (4) o POC mostra que não dá para garantir que cada cobrança devolvida pertence à unidade pedida; (5) rate limit baixo demais mesmo com cache; (6) após 30 dias de A não há evidência de dor (M1).
**NÃO fazer:** pedir token "completo"; espelhar a base do Superlógica; chamar a API pelo navegador; token em `NEXT_PUBLIC_*`, URL, log ou repositório; afirmar "pago" ou "em aberto" sem a hora da consulta; mostrar situação na lista de unidades; usar `comContatosDaUnidade`, `comDadosDasUnidades` ou `exibirDadosDoContato`; interpretar `fl_status_recb` por número (usar o filtro `status=pendentes`).

**Esforço: M (B0 + B1) mais P a M (B2).**

### 3.3 Fase C: taxa de reserva vira lançamento no Superlógica

**Contexto (DECIDIDO):** o valor da reserva fica só no app até haver integração; hoje a Garden lança à mão a partir do relatório "valores a lançar". **Esta fase é o que levantaria essa restrição.** Não contesto a decisão: proponho que ela só caia quando os gatilhos da D8 forem cumpridos. O Harmony **não recebe nem cobra**: ele pede à administradora, no ERP dela, que lance. Mesmo assim cria débito real; trato como cobrança para efeito de risco.

**Objetivo:** Síndico/Subsíndico/ADM lançam, com um botão, a taxa de uma reserva **aprovada** no Superlógica, sem redigitar na Garden.
**Usuário:** Síndico, Subsíndico e ADM. O morador só vê o que já vê hoje.

**Entra (se a D8 liberar)**
1. Botão **"Lançar no Superlógica"** por reserva APROVADA com `valor_uso + taxa_higienizacao > 0` (campos existentes, 0039). **Ação humana, nunca automática** (o número de pessoas é declarado pelo morador, risco já aceito no PRD de 05/10; com dinheiro real, o humano confere antes).
2. Usar **cobrança avulsa** (`POST cobranca/`, estudo §3.9), **não** a reserva do Superlógica (`POST reservas/`), para o Harmony continuar dono da reserva (estudo §3.8, caminho b).
3. Estado do lançamento por reserva: NÃO_LANÇADO, ENVIANDO, LANÇADO (com `id_cobranca`), ERRO, INCERTO. Visível na lista de reservas da gestão e no relatório existente.
4. **Usuário e token separados** do de leitura (menor privilégio): o de escrita só existe depois da D8.

**Fora de escopo:** lançamento automático ao aprovar; editar, estornar ou invalidar cobrança pelo Harmony (a Garden faz, v1); criar reserva no Superlógica; bloquear inadimplente; parcelas e encargos próprios; conciliação de pagamento; refletir o pagamento na reserva.
**Dependências:** B rodando (vínculo e camada segura); a Garden informar conta/categoria de receita (`ST_CONTA_CONT`), conta bancária (`ID_CONTABANCO_CB`), regra de vencimento e quem trata contestação e estorno; ERP de teste para provar a duplicidade; regimento/assembleia prevendo a taxa (`docs/specs/2026-10-05-reservas-bloqueio-e-faixa-de-valor.md` §10.3).
**NÃO fazer:** reenvio automático em timeout (a API não tem idempotência documentada, estudo §3.9); lançar sem vínculo CONFIRMADO; deixar o navegador montar o valor (vem do banco: `valor_uso` e `taxa_higienizacao` gravados e imutáveis); lançar reserva não aprovada ou cancelada; usar o token de leitura para escrever.

**Esforço: G.**

---

## 4. Requisitos funcionais por fase (B e C)

(A está na 3.1.) Estados do B: **Carregando**, **Vazio**, **Erro**, **Falha do Superlógica**, **Unidade sem vínculo**.

### 4.1 Fase B: morador

- **B1 (feliz).** *Dado* proprietário validado, unidade com vínculo CONFIRMADO e financeiro liberado, *quando* abre "Boleto e 2ª via", *então* vê a situação, os pendentes (competência, vencimento, valor) e "Atualizado às HH:MM"; **nenhum** dado de outra unidade, de contato, CPF ou conta bancária aparece na tela nem na resposta de rede.
- **B2 (carregando).** *Quando* a consulta demora, *então* aparece esqueleto e o botão de 2ª via fica desabilitado; **não** aparece "em aberto" nem "nenhum boleto" antes da resposta.
- **B3 (vazio).** *Dado* resposta válida sem pendentes, *então* "Nenhum boleto em aberto em {data, hora}" mais "Se você pagou há pouco, pode levar alguns dias para aparecer" (SUPOSIÇÃO; validar com a Garden, pergunta 4.6); sem tom de garantia legal.
- **B4 (sem vínculo).** *Dado* unidade sem vínculo, vínculo SUSPENSO ou REVISAR, ou financeiro não liberado (inquilino), *quando* o morador abre a tela ou o atalho, *então* vê só o atalho do portal (Fase A) com texto neutro ("Veja seus boletos no site da administradora"), **sem** mensagem de erro e sem expor o motivo.
- **B5 (falha do Superlógica).** *Dado* timeout, 5xx, 401/403 (token inválido ou revogado), 429 (limite) ou resposta inválida, *quando* o morador consulta, *então* vê "Não foi possível consultar agora" **com o atalho do portal**, sem código técnico e sem dado antigo; o servidor registra o erro (sem corpo da resposta) e, em 401/403, **avisa a gestão** ("A integração com o Superlógica precisa de atenção"). Nova tentativa só por ação do usuário ("Tentar de novo", com espera mínima).
- **B6 (2ª via).** *Dado* boleto pendente da própria unidade, *quando* toca "Abrir 2ª via", *então* o servidor **reconfere que o boleto pertence à unidade** (6.4), chama `gerarlinksegundavia` e abre o link; o link **não é guardado**. Se o link não vier ou a Área do condômino não disponibilizar (estudo §3.1), mostra "Esta 2ª via não está disponível aqui" e o atalho.
- **B7 (boleto vencido).** Só habilitar 2ª via atualizada (nova data, com encargos) se o POC provar que o valor sai correto (data em MM/DD/AAAA, estudo §2). Senão, vencido mostra "Boleto vencido: peça a atualização no portal" com o atalho. Decisão final depois do POC.
- **B8 (permissões).** *Dado* inquilino sem liberação, Portaria, Conselho, Zelador, provisório ou visitante, *quando* chamam a rota por API, *então* 403; a tela nem mostra a entrada.
- **B9 (isolamento).** *Dado* o proprietário da unidade X que envia, por API, outra unidade, outro id de cobrança ou bloco/número, *então* a rota **ignora o que veio do cliente** (a unidade é a do banco) e rejeita id de cobrança que não pertença à unidade dele.
- **B10 (celular e formatos).** Funciona a 375px; valores em R$ com vírgula, datas dd/mm/aaaa (a API usa MM/DD/AAAA; converter só no servidor); alvos de 44px.

### 4.2 Fase B: gestão (Síndico, Subsíndico, ADM)

- **G1 (vínculos).** *Dado* a tela "Vínculos com o Superlógica", *quando* a gestão pede "Buscar unidades da administradora", *então* o servidor lista as unidades do Superlógica **descartando tudo exceto `id_unidade_uni`, bloco e número**, propõe pares por bloco+número normalizado (maiúsculas, sem espaços, sem zeros à esquerda) e a tela mostra a unidade do Harmony, a proposta e um indicador "nome confere: sim/parcial/não/sem dado" (calculado no servidor; o nome do Superlógica **não é exibido nem guardado**).
- **G2 (confirmar).** *Quando* a gestão confirma um par, *então* grava vínculo CONFIRMADO, quem e quando, e uma linha no histórico. Par com indicador "não" exige o campo "como conferi" e fica marcado. **Nenhum vínculo é confirmado automaticamente.**
- **G3 (sem vínculo).** A tela lista "Unidades sem vínculo" e "Unidades do Superlógica sem equivalente aqui" (só informativa; nada é importado). Nunca "chutar" o par mais parecido.
- **G4 (suspender e revisar).** A gestão pode SUSPENDER um vínculo (a unidade volta ao atalho, B4). Editar bloco/número de uma unidade no Harmony move o vínculo para REVISAR automaticamente.
- **G5 (consulta de suporte).** *Quando* a gestão abre "Ver boletos desta unidade", *então* vê o mesmo que o morador veria, com o aviso "Visualização da gestão: este acesso é registrado". Sem exportar, imprimir em lote ou baixar CSV financeiro.
- **G6 (liberar inquilino).** Por unidade, a gestão liga/desliga "Mostrar boletos ao morador desta unidade" (padrão: ligado se `tipo_ocupacao = PROPRIETARIO`; desligado se `INQUILINO` ou `DESOCUPADO`). Mudança registrada.
- **G7 (permissões).** Portaria, Conselho, Zelador e Morador: 403 em todas as rotas e funções de vínculo e de consulta alheia (API e consulta direta).

### 4.3 Fase C: lançamento de taxa de reserva (se a D8 liberar)

- **C1.** *Dado* reserva APROVADA com total > 0 e unidade com vínculo CONFIRMADO, *quando* a gestão toca "Lançar no Superlógica", *então* aparece confirmação com unidade, valor de uso, higienização, total e vencimento; só após confirmar o servidor grava ENVIANDO **antes** de chamar a API.
- **C2.** *Dado* sucesso, *então* grava `id_cobranca`, estado LANÇADO, quem e quando; a lista mostra "Lançado em dd/mm"; o botão some (um segundo toque não lança de novo).
- **C3 (timeout/resposta perdida).** *Dado* timeout sem resposta, *então* estado INCERTO; **não reenviar sozinho**. A tela oferece "Conferir no Superlógica": o servidor consulta as cobranças da unidade no período e, se achar uma com o mesmo valor e vencimento, adota o `id_cobranca`; se não achar, libera "Tentar de novo".
- **C4 (dois cliques simultâneos).** *Dado* duas pessoas lançando a mesma reserva ao mesmo tempo, *então* só uma passa de NÃO_LANÇADO para ENVIANDO (trava no banco: atualização condicionada ao estado); a outra vê "Já está sendo lançado".
- **C5 (cancelada depois de lançada).** *Dado* reserva LANÇADA que é cancelada, *então* a tela avisa "Já foi lançada no Superlógica: peça o estorno à administradora" e marca PENDÊNCIA DE ESTORNO até a gestão confirmar que a Garden estornou. **O Harmony não estorna na v1.**
- **C6 (erro).** *Dado* erro da API (conta inválida, unidade inexistente), *então* estado ERRO com texto curto para a gestão, sem corpo bruto; nada é duplicado.
- **C7 (valor imutável).** O valor lançado é o gravado na reserva (imutável, 0039); mudar a faixa do espaço depois não altera.
- **C8 (permissões).** Só Síndico, Subsíndico e ADM; o servidor relê o perfil no banco; demais perfis, 403.
- **C9 (relatório).** O relatório "valores a lançar" ganha a coluna de estado; reservas LANÇADAS saem do "a lançar".

---

## 5. Modelo de dados e vínculo unidade↔Superlógica

### 5.1 Princípio
**Guardar o mínimo; consultar na hora o resto.** Não existe espelho do Superlógica no Supabase.

### 5.2 O que guardar (desenho final de tabelas e migrações: developer)

1. **`superlogica_vinculos`** (uma linha por unidade vinculada)
   - `unit_id` (PK, ligado a `units`), `id_condominio` e `id_unidade` do Superlógica (números), `status` (PROPOSTO, CONFIRMADO, REVISAR, SUSPENSO), `financeiro_morador` (booleano da D2/G6), `confirmado_por`, `confirmado_em`, `conferido_em` (última verificação de coerência).
   - Único por (`id_condominio`, `id_unidade`): duas unidades do Harmony **não** podem apontar para a mesma do Superlógica.
   - **RLS ligado; sem leitura nem escrita direta pelo cliente** (nem morador): quem decide e lê é a rota de servidor com a service role; a tela da gestão lê por rota/função restrita a `is_admin()`. Revogar os grants padrão do Supabase (aprendizado da 0040).
   - Não guarda nome, e-mail, telefone ou CPF do Superlógica.
2. **`superlogica_vinculos_historico`** (só INSERT): `unit_id` e o rótulo bloco/número **como texto** (sem cascata: o histórico sobrevive à exclusão da unidade), ação (proposto, confirmado, suspenso, revisar, desfeito), de → para, quem, quando, motivo. Leitura pela gestão.
3. **Registro de acesso a dado financeiro** (6.7): reutilizar `audit_logs` via `src/lib/auditoriaServidor.ts` (gravação no servidor, como nas ações da #68).
4. **Fase C apenas:** `reserva_lancamentos` (`reserva_id`, estado, `id_cobranca`, valor e vencimento lançados, quem, quando, tentativas). RLS só gestão. Sem texto bruto da resposta.
5. **Configuração não secreta** (`id_condominio`; conta e banco da Fase C): variável de ambiente do servidor ou tabela só-gestão; **o id do condomínio nunca vem do navegador**.

### 5.3 Consultar na hora (nunca persistir)
Lista de boletos e valores, situação, link de 2ª via (expira por configuração da Garden, estudo §3.1), qualquer dado de contato. Linha digitável e Pix: não persistir.

### 5.4 Cache
- **v1: sem tabela de cache de boleto.** Cache curto **só em memória do servidor**, por `id_unidade` (10 a 15 min, "a decidir" depois de conhecer o limite de uso, estudo §4), para não estourar um rate limit desconhecido.
- A chave do cache **inclui a unidade e nunca é compartilhada entre unidades**; só é lido **depois** da autorização (6.4). O Next.js desta versão tem convenções novas: o developer lê `node_modules/next/dist/docs/` antes de escolher o mecanismo (regra do `AGENTS.md`).
- Em falha, **nunca** devolver cache vencido como atual (B5). Mostrar sempre a hora do dado.
- Invalidação: botão "Atualizar" (com espera mínima); cache zerado quando o vínculo muda.

### 5.5 Quem confirma, como evitar divergência, histórico
- **Quem confirma:** Síndico, Subsíndico ou ADM (`is_admin()`). Recomendo que a **ADM (Garden)** faça a primeira passada, por conhecer o cadastro do Superlógica, e o síndico revise. Cada confirmação é auditada; Zelador e demais perfis não confirmam.
- **Chave de integração:** `id_unidade` + `id_condominio`. Nunca nome, e-mail ou bloco+número como chave de consulta (estudo §6).
- **Camadas contra divergência:**
  1. **Confirmação humana** de cada par (G2); sem confirmação, sem consulta.
  2. **Verificação a cada consulta:** as cobranças trazem bloco e número do Superlógica; o servidor compara com os do Harmony (normalizados). Se divergir, **bloqueia**, move o vínculo para REVISAR e avisa a gestão. É o detector barato de renumeração, desmembramento ou par errado.
  3. **Mudança local:** editar bloco/número no Harmony → REVISAR.
  4. **Botão "Conferir vínculos"** da gestão (sem rotina agendada na v1): relista as unidades do Superlógica e marca REVISAR onde o id sumiu ou o rótulo mudou.
  5. Trocar o responsável no Harmony não muda o vínculo: ele é da **unidade**; quem vê o boleto é a conta validada naquela unidade (e, para inquilino, a regra G6).
- **Histórico:** tabela só de inserção; ninguém apaga linha.
- **Em aberto de modelagem:** unidade comercial/garagem/loja com id próprio (pergunta 4.3); unidades unificadas ou desmembradas (4.3).

---

## 6. Segurança e LGPD

### 6.1 Onde ficam as credenciais
- `app_token` e `access_token` **só como variáveis de ambiente do servidor** (Vercel). **Um par para produção** (escopo Production) **e outro, de ERP de teste, para staging/prévia** (escopo Preview). **O token de produção não pode existir no escopo Preview**: a prévia da Vercel liga no banco de staging e quem acessa a prévia rodaria código com ele.
- Nunca em `NEXT_PUBLIC_*`, nunca no repositório (público), nunca em log, resposta, mensagem de erro, relatório de QA, standup ou `docs/`. Cabeçalhos HTTP, **nunca na URL** (a documentação do Superlógica tem exemplo errado, estudo §2).
- **Como o dono recebe o token:** nunca por WhatsApp, e-mail ou chat aberto. A Garden gera e mostra ao dono (tela, ligação) ou usa um cofre de senhas; o dono cola direto na Vercel. Se vazar em mensagem: **revogar na hora** e gerar outro.
- **Acesso à Vercel é acesso ao token:** poucos membros no time e autenticação em dois fatores (verificar).
- Validade provável de 1 ano (**A CONFIRMAR**, estudo §2): lembrete no calendário do dono 30 dias antes e alerta no sistema quando a API devolver 401/403.
- Rotação: gerar o novo, trocar na Vercel, redeploy, revogar o antigo (como revogar: **A CONFIRMAR**, pergunta 2.5).

### 6.2 O token herda o poder do usuário que o criou
Fato do estudo §2: o token herda os acessos do usuário do ERP que o criou e a API não oferece "token só leitura". Regras:
- **Exigir um usuário dedicado "Harmony"** na Garden, com permissão só de **consultar** e, se possível, **só do Harmony Residence**. Sem isso, **parar** (critério de parada 2).
- Um token amplo daria acesso a **outros condomínios da carteira da Garden** (CPF, RG, nascimento, dados bancários de moradores que não são nossos). Vazá-lo é incidente da Garden, não só nosso (6.9).
- Se o usuário dedicado for apagado ou tiver a permissão mudada, o token deixa de funcionar (A CONFIRMAR); por isso o usuário é do **cargo**, não de uma pessoa da Garden que pode sair.
- Fase C: **segundo usuário e token com permissão de lançar**, só depois da D8; o código de leitura nunca recebe o token de escrita.
- O Harmony **nunca** chama as rotas de escrita de unidades e contatos do Superlógica (estudo §3.6): trava no código com lista de caminhos permitidos (só GET na Fase B; na C, só `POST cobranca/`).

### 6.3 Lista fixa de campos guardados ou repassados (o resto é descartado)
A API devolve CPF, CNPJ, RG, nascimento, endereço, telefone, e-mail, dados bancários e de cartão e `st_senha_site_uni` dentro de `contatos` (estudo §5.1). **Projeção por lista de permitidos**, no servidor, antes de qualquer log, cache ou resposta:

| Para quê | Campos permitidos (nomes da API) |
|---|---|
| Vincular unidades (uma vez) | `id_unidade_uni`, `id_condominio_cond`, `st_bloco_uni`, `st_unidade_uni` |
| Boleto (tela e 2ª via) | `id_recebimento_recb` (só no servidor ou como id opaco), `dt_vencimento_recb`, `dt_competencia_recb`, `vl_total_recb`, `vl_emitido_recb`; `id_unidade_uni` e bloco/número **só para conferir a unidade** (não vão ao navegador); situação derivada do **filtro** `status=pendentes` |
| Lançamento (Fase C) | `id_cobranca` da resposta; status e mensagem de erro **resumida** |

- Tudo que não está na tabela é **descartado**: nenhuma cópia do JSON bruto em cache, log, tabela, ferramenta de erro ou auditoria. Os logs da rota registram só: unidade (id interno), tipo de ação, código HTTP, latência; **nunca corpo de resposta**.
- Pedir sempre `apenasColunasPrincipais=1`; nunca `comContatosDaUnidade`, `comDadosDasUnidades`, `exibirDadosDoContato`.
- **Se aparecer valor preenchido em campo de cartão, conta ou senha:** descartar, **não** guardar nem registrar o valor; registrar só o evento "campo sensível preenchido no Superlógica" e **avisar a Garden** (problema no cadastro dela; pode ser incidente para ela).
- Teste obrigatório com um **Superlógica falso** devolvendo esses campos preenchidos: nada deles em resposta, log, tabela ou auditoria (seção 9).

### 6.4 Isolamento entre moradores sem RLS
O caminho do Superlógica usa token amplo e ignora o RLS: **a proteção é código no servidor**. Regras (todas testadas):
1. **A rota valida a sessão** e **relê o perfil no banco** (nunca do JWT ou do navegador).
2. **Descobre a unidade pelo banco** (`units.usuario_id` do usuário logado; para a gestão, a unidade escolhida e permitida). O cliente **não envia** unidade, bloco, número, `id_unidade_uni` nem id de condomínio; se enviar, é ignorado.
3. Lê o vínculo CONFIRMADO e o `financeiro_morador` no banco e **só então** chama o Superlógica com o `id_unidade_uni` **gravado**.
4. **Conferência por item:** cada cobrança devolvida precisa ter o `id_unidade_uni` esperado; **qualquer divergência descarta a resposta inteira**, não mostra nada, registra "divergência de unidade" (incidente) e move o vínculo para REVISAR.
5. **2ª via (risco de IDOR):** o navegador envia o id do boleto (opaco). O servidor **relista os pendentes da unidade do banco** e só segue se o id estiver nessa lista; nunca usa o id direto.
6. Perfis fora da tabela da seção 1: **403** pela rota e pelo servidor, sem depender de esconder o menu.
7. **Provisório:** 403. Morador de unidade **sem vínculo ou suspensa:** só o atalho A.
8. Não existe rota que devolva boletos de **várias** unidades.
9. **Cache** só lido após 1 a 3; chave com a unidade (5.4).
10. A conta `ZELADOR` (sem unidade) não consulta: não há `unit_id` para resolver; 403 antes.

### 6.5 Inquilino e proprietário
- Hoje o Harmony tem **uma conta ligada por unidade** (`units.usuario_id`) e `tipo_ocupacao` (PROPRIETARIO, INQUILINO, DESOCUPADO), **derivado** dos moradores cadastrados (`src/lib/supabase/db.ts`). O boleto no Superlógica costuma ser do **proprietário** (A CONFIRMAR, pergunta 4.5).
- **RECOMENDO:** padrão conservador. Boleto no app **só para unidade de proprietário**; para unidade de inquilino, a gestão libera caso a caso (G6) depois que Garden/síndico confirmarem. O inquilino sempre tem o atalho A (o portal da Garden decide quem entra).
- A conta ligada à unidade pode ser de inquilino mesmo que o tipo diga outra coisa. Por isso o `financeiro_morador` fica **explícito no vínculo**, confirmado por uma pessoa da gestão, e não inferido a cada consulta.
- Troca de conta ligada à unidade (mudança de proprietário/inquilino) deve **voltar o `financeiro_morador` para revisão** (a cargo do developer).

### 6.6 O que NÃO entra
Contatos, comunicados, CRM de cobrança, ocorrências, documentos (estudo §3.4, §3.7, §3.10). **Não receber senha do morador no Superlógica** (estudo §3.11).

### 6.7 Auditoria de acessos a dados financeiros
- Gravada **pelo servidor** (`auditoriaServidor`), nunca pelo navegador, **sem valores**: ação, quem, perfil, unidade (bloco/número), quando.
- **Registrar:** consulta da gestão a unidade alheia (**toda**); geração de 2ª via por qualquer perfil (**toda**); criação, confirmação, suspensão e desfazer de vínculo; liberação do financeiro de uma unidade; falha de autenticação do token; divergência de unidade; na Fase C, quem lançou, qual reserva e `id_cobranca`.
- **Não registrar:** o morador abrindo a própria tela (ruído; só a 2ª via).
- A decidir (D3): o Conselho lê o histórico de ações; as linhas não têm valores, mas mostram "quem consultou a unidade X". Recomendo aceitar (transparência) ou usar categoria que só a gestão lê.
- **Retenção do registro de acesso:** 12 meses (SUPOSIÇÃO; validar com advogado), alinhada à retenção de `audit_logs` (hoje sem prazo definido; segue na #66).

### 6.8 Retenção e base legal (**a confirmar com advogado**; não é parecer)
- **Situação financeira individual é dado pessoal** e revela inadimplência (estudo §5.8); não é "sensível" pelo art. 5º da LGPD, mas é delicado.
- **Base legal provável** (a confirmar): execução de contrato (relação condomínio/condômino) e legítimo interesse (art. 7º, V e IX), com a **Garden como controladora** do dado financeiro. O Harmony apenas **exibe**, ao titular, dado dele; **não grava** (v1). O dado financeiro não fica no Harmony.
- **Antes do piloto:** (1) autorização escrita da Garden; (2) acordo curto (termo ou cláusula) sobre quem é controlador, o que o Harmony pode fazer, onde o dado fica (região do Superlógica **a confirmar**) e o que fazer em incidente; (3) atualizar o aviso de privacidade (#55) dizendo que a situação de boletos vem da administradora; (4) o morador pode pedir exclusão do **vínculo** (o dado financeiro é da Garden).
- **Retenção:** dado financeiro = nenhuma (consultado na hora); vínculo = enquanto a unidade existir (cascata; o histórico fica só com rótulo da unidade e ações, sem dado pessoal); registro de acesso = 12 meses (SUPOSIÇÃO); `reserva_lancamentos` (C) = vida da reserva mais prazo contábil (a confirmar com contador).
- Dependentes e menores: nenhuma leitura deles do Superlógica.

### 6.9 O que um vazamento causaria
| Cenário | Efeito | Gravidade |
|---|---|---|
| **Token vazado com permissão ampla** (usuário "completo" da Garden) | Acesso a CPF, RG, nascimento e dados bancários de moradores de **outros condomínios da Garden**; incidente da Garden, possível comunicação à ANPD; quebra de confiança e contratual | **Crítica** (por isso o usuário dedicado é condição) |
| Token vazado de usuário dedicado, só do Harmony Residence | Leitura de cobranças e contatos do nosso condomínio (inclui CPF/RG se a API devolver) | Alta |
| Falha de isolamento (morador vê boleto de outro) | Expõe a inadimplência de um vizinho; constrangimento e conflito; dado pessoal a terceiro | Alta |
| Link de 2ª via repassado | O link (formato A CONFIRMAR) pode abrir com dados do boleto sem login; texto "não compartilhe" e link não guardado | Média |
| Registro de acesso | Nenhum valor registrado; só quem consultou | Baixa |
| Lançamento errado (C) | Débito indevido ao morador; disputa com a Garden e o síndico | Alta |

Em incidente: revogar token, desligar a flag, avisar Garden e dono na hora, avaliar comunicação à ANPD e aos titulares (prazo regulamentar **a confirmar com advogado**), registrar a linha do tempo.

---

## 7. Riscos e plano de mitigação

| # | Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|---|
| R1 | **Dependência da Garden** (plano, usuário dedicado, autorização, ERP de teste) e dos prazos dela | Alta | Alto | Fase 0 curta e escrita; A entrega valor sem ela; critérios de parada; nenhum dado real sem autorização escrita |
| R2 | **Mudança ou instabilidade da API** (`v2/condor`, campos, formatos reais não testados, estudo §9) | Média | Médio | Camada única no servidor com projeção por lista de permitidos e **contrato testado** contra o Superlógica falso; falha vira B5 com atalho; sem dado antigo |
| R3 | **Rate limit desconhecido** | Média | Médio | Consulta sob demanda por unidade, cache curto em memória, sem varredura, "Atualizar" com espera; medir no POC; 429 vira B5; limite de chamadas por usuário |
| R4 | **Token amplo ou vazado** | Média | Crítico | 6.1 e 6.2; usuário dedicado obrigatório; token fora do Preview; rotação; flag como interruptor |
| R5 | **Vínculo errado** (morador vê o boleto de outra unidade) | Média | Alto | Confirmação humana, conferência de bloco/número a cada consulta, REVISAR, piloto pequeno |
| R6 | **Duplicidade de reserva nos dois sistemas** (o Superlógica também tem "Reservas"; se o morador reserva lá, os calendários divergem) | Média | Alto | Pergunta 5.3; pedir à Garden para **desativar reservas na Área do condômino** deste condomínio; **fonte única = Harmony**; B e C **nunca** criam reserva no Superlógica (preferir cobrança avulsa) |
| R7 | **Superlógica cancela reserva de inadimplente** (`fl_bloquearinad_are`, `st_motivocancelamento_res`, estudo §3.8) | Baixa se R6 mitigado | Médio | Só ocorre com reserva criada lá. Bloquear inadimplente no Harmony seria **decisão de produto nova** e **não** entra aqui; issue própria se o dono quiser |
| R8 | **Custo de plano/licença** (a 2ª via por CPF é só Enterprise I+; usuário dedicado pode consumir licença paga) | Média | Médio | Perguntas 3.1 e 2.3; teto do dono (D9); critério de parada 1; POC no teste grátis |
| R9 | **Custo de suporte** ("o app diz que devo, o portal diz que paguei"; "meu boleto não aparece") | Alta | Médio | Hora da consulta sempre visível; texto sobre atraso de baixa; atalho em todo erro; piloto pequeno; o Harmony **não responde por valor**; roteiro curto de suporte |
| R10 | **LGPD** (inadimplência de terceiros, base legal, controlador/operador) | Média | Alto | Seção 6; autorização e acordo antes do piloto; sem armazenamento financeiro |
| R11 | **Dado velho vira "em aberto" para quem já pagou** (lição da planilha descartada) | Média | Médio | Sem cache persistente; hora da consulta; texto de atraso; nunca afirmar "pago/em dia" sem consulta válida |
| R12 | **Boleto vencido com valor errado** (encargos, data MM/DD/AAAA) | Média | Médio | B7: habilitar só se o POC provar; senão atalho |
| R13 | **Cobrança duplicada ou errada (C)** sem idempotência | Média | Alto | ENVIANDO antes da chamada; sem reenvio automático; conferir antes de reenviar; trava no banco; ERP de teste primeiro |
| R14 | **Token expira (1 ano, A CONFIRMAR)** e a integração cai | Média | Médio | Lembrete e alerta; atalho como degradação |
| R15 | **Escopo cresce** (painel de inadimplentes, WhatsApp, histórico) | Alta | Médio | Lista de fora de escopo explícita; PRD novo para cada item |
| R16 | **O Harmony vira canal de reclamação de cobrança** | Média | Médio | Rodapé fixo: "Dados da administradora. Dúvidas sobre valores: fale com a administradora" |

---

## 8. Rollout e rollback

### 8.1 Feature flag
- **Flag mestre no servidor** (variável de ambiente, ex.: "integração Superlógica habilitada"): desligada por padrão; ao desligar, as rotas respondem "indisponível" e as telas caem para o atalho A (B4). Mudar a variável exige novo deploy (minutos); aceitável porque o atalho cobre a falha. Interruptor no banco alterável pela gestão: **não na v1** (D11).
- **Flag por unidade:** o status do vínculo (SUSPENSO) é o interruptor fino.
- Migrações no staging primeiro; produção só com autorização escrita do dono; nada vai para Done sem o QA (coluna Teste).

### 8.2 Estágios
1. **Staging com Superlógica falso + ERP de teste** (testes da seção 9). Sem dado real.
2. **Piloto A: a unidade do dono** (dado real dele, com a autorização escrita da Garden). O dono confere com o portal da Garden.
3. **Piloto B:** 2 a 3 unidades de moradores que concordarem (consentimento explícito) por 2 semanas, com conferência boleto a boleto contra o portal.
4. **Abertura gradual** por blocos de unidades vinculadas e confirmadas; medir M3 a M6.
5. Fase C só depois (ERP de teste primeiro; depois 1 reserva real com conferência da Garden).

### 8.3 Rollback e o que fazer se o Superlógica cair
- **Superlógica fora do ar ou lento:** o morador vê B5 (mensagem calma + atalho). Nada a fazer do nosso lado; **não** alterar dados; sem tentativa em laço. A gestão vê o aviso.
- **Token revogado ou expirado (401/403):** B5 para o morador; aviso à gestão e ao dono; renovar o token (6.1).
- **Divergência de unidade ou suspeita de vazamento:** desligar a flag mestre na hora, revogar o token, avisar a Garden, preservar os registros (6.9).
- **Desfazer:** desligar a flag não perde nada (vínculos e histórico ficam). Desligar a Fase C não desfaz lançamentos já feitos (a Garden estorna se preciso).
- A Fase A permanece sempre.

---

## 9. Cenários de teste: o que QA e segurança precisam cobrir

**Ferramenta recomendada:** um **Superlógica falso** (servidor local em `scripts/qa/`) com fixtures fictícias e "armadilhas": cobrança de **outra** unidade na lista; contatos com CPF, RG, cartão e `st_senha_site_uni` preenchidos; status desconhecido; paginação; lista vazia; 401, 403, 429, 500; timeout; JSON inválido; resposta lenta; link de 2ª via vazio. O QA roda no staging com ele (e depois com o ERP de teste real). `scripts/qa/bateria.mjs` ganha os casos, com dados fictícios e por perfil.

**QA (funcional)**
1. A1 a A6; B1 a B10; G1 a G7; C1 a C9 (se existir).
2. Carga de vínculos: formatos "101", "0101", "A-101", "Bloco A apto 101"; unidade sem par; unidade do Superlógica sem par; duas unidades do Harmony propondo o mesmo id (recusado).
3. Estados: carregando, vazio, erro, falha, sem vínculo, suspenso, REVISAR, inquilino sem liberação, flag desligada.
4. Boleto vencido: B7 (com e sem POC aprovado).
5. Datas MM/DD/AAAA convertidas só no servidor; valores em texto ("75.00") exibidos como R$ 75,00.
6. 375px e desktop; teclado e leitor de tela; alvos de 44px.
7. Fase C: duplo clique, timeout, INCERTO e conferência, reserva cancelada depois de lançada, valor igual ao gravado.

**Segurança (bloqueantes)**
1. **Isolamento:** morador A com sessão válida tenta, por API, a unidade, o id de cobrança, o bloco e o número da unidade B: recebe só dado de A ou erro; nenhuma resposta traz a unidade B.
2. **Divergência de unidade:** o falso devolve cobrança de outra unidade: resposta **toda descartada**, vínculo em REVISAR, incidente registrado, morador vê B5.
3. **IDOR da 2ª via:** id de cobrança de outra unidade é recusado.
4. **Perfis (API e consulta direta ao banco):** Portaria, Conselho, Zelador (sem unidade), provisório, visitante, inquilino sem liberação e morador de unidade sem vínculo: 403 ou só atalho. Tabelas `superlogica_vinculos*` ilegíveis ao cliente fora da gestão; escrita direta negada (inclusive ao morador).
5. **Hierarquia (#68):** só `is_admin()` confirma, suspende ou libera; papel relido do banco.
6. **Vazamento de segredo:** varredura do repositório, do bundle do cliente, dos logs e das respostas por `app_token`, `access_token` e valores de teste; nada em `NEXT_PUBLIC_*`; token de produção ausente do escopo Preview; token nunca na URL.
7. **Campos sensíveis:** com CPF, RG, cartão, conta e senha no falso, **nenhum** aparece em resposta de rede, log, tabela, cache, auditoria ou relatório de QA.
8. **Sem log de corpo:** erro 500 do falso com corpo contendo dado pessoal: o log só tem código e latência.
9. **Escrita proibida:** nenhuma rota chama caminho de escrita do Superlógica na Fase B; a lista de permitidos é testada.
10. **Auditoria:** cada ação da 6.7 gera linha no servidor, sem valores; o cliente não grava nem apaga essas linhas.
11. **Falha segura:** com flag desligada, token ausente ou Superlógica fora do ar, **nenhum dado financeiro** aparece e o atalho aparece.
12. **Abuso:** limite de chamadas por usuário na rota; sessão vencida não consulta.
13. **Fase C:** concorrência (trava no banco), perfil relido, valor vindo do banco e não do cliente, token de leitura não escreve.
14. **LGPD:** relatório de QA e logs sem dado real; piloto só com consentimento e autorização da Garden.

---

## 10. Decisões em aberto do dono (cada uma com a minha recomendação)

| # | Decisão | Recomendação |
|---|---|---|
| D1 | Autorizar a Fase 0 (perguntas à Garden + POC no ERP de teste) e a Fase A já? | **Sim, as duas.** Baixo custo, nenhum risco. Fecha a #18 (respondida: Superlógica) e destrava a #21 |
| D2 | O inquilino vê boleto no app? | **Não por padrão**; a gestão libera por unidade quando a Garden confirmar quem recebe o boleto. O atalho A ele sempre tem |
| D3 | O Conselho vê situação financeira individual? E o registro de acesso aparece para ele? | **Não à situação individual** (tem a prestação de contas da Garden). Registro de acesso: aceitar que ele leia (transparência) ou separar em categoria só da gestão |
| D4 | Síndico e Subsíndico veem boleto de qualquer unidade? | **Sim, unidade a unidade, com registro; sem lista de inadimplentes na v1** |
| D5 | Mostrar boletos pagos? | **Não na v1.** Entra em v1.1 só se o suporte pedir ("já paguei") |
| D6 | Quem confirma os vínculos? | **ADM (Garden) propõe e confirma, síndico revisa**; qualquer `is_admin()` pode |
| D7 | Piloto | **A unidade do dono; depois 2 a 3 voluntários com consentimento**; nunca todos de uma vez |
| D8 | Construir a Fase C? Isto contesta a decisão "valor de reserva só no app até haver integração"? | **Não construir agora.** Não contesto a decisão: C é a "integração" que a levantaria. Gatilho: B estável por ao menos um ciclo de cobrança **e** (a Garden pedir **ou** o lançamento manual passar de um limiar de tempo/erros a definir com ela, SUPOSIÇÃO). Até lá o relatório "a lançar" resolve |
| D9 | Teto de custo para plano/licença da API | **Definir antes da resposta da pergunta 3.1.** Sugiro que o dono **não pague mensalidade** pela integração sem decisão explícita; se a Garden repassar custo, voltar ao dono |
| D10 | Acordo escrito com a Garden (autorização, controlador/operador, incidente) e revisão por advogado | **Sim, um termo curto antes do piloto**, revisado por advogado (a confirmar) |
| D11 | Interruptor no banco (sem deploy) ou só variável de ambiente? | **Só variável de ambiente na v1** |
| D12 | Fechar a #18 como respondida e pôr a #21 em Todo | **Sim** |

---

## 11. Perguntas para a administradora (Garden)

Escritas para quem **não é de tecnologia**. Quem leva é o dono. **Não enviar nenhum dado de morador do Harmony à Garden** nesta conversa. As 6 marcadas **[BLOQUEANTE]** decidem se a Fase B existe.

### 11.1 Acesso e plano

**1.1 [BLOQUEANTE] Qual é o plano de vocês no Superlógica Condomínios, e ele permite que um sistema de fora consulte os dados (a "integração por API")?**
- *Por que importa:* alguns recursos só existem em planos mais caros (o estudo viu isso numa função de 2ª via). Sem API, não há Fase B.
- *Muda:* **inclui** → segue para o POC. **Não inclui** → só Fase A; **B e C param** (critério de parada 1). **Inclui, com custo** → D9.

**1.2 Quem, na administradora, pode liberar essa integração, e quanto tempo isso costuma levar?**
- *Por que importa:* define o prazo e quem assina a autorização.
- *Muda:* o cronograma da Fase 0 e a quem endereçar o termo (D10).

**1.3 Vocês já usam integração com algum sistema de fora (banco, cobrança, aplicativo)? Já tiveram problema?**
- *Por que importa:* mostra o que esperar do suporte.
- *Muda:* o nível de acompanhamento no piloto.

### 11.2 Usuário dedicado e escopo do token

**2.1 [BLOQUEANTE] Dá para criar um "usuário só do Harmony" que **apenas consulte** (sem alterar nada) e **só enxergue o Harmony Residence**?**
- *Por que importa:* a chave de acesso herda tudo o que o usuário que a criou pode ver. Uma chave de usuário "completo" enxergaria os outros condomínios que vocês administram, com dados de moradores que não são nossos. É o maior risco de segurança do projeto.
- *Muda:* **sim** → B segue. **Não dá para limitar** → **B e C param**. **Limita ao condomínio mas não a "só consulta"** → decisão do dono (recomendo recusar).

**2.2 Se esse usuário for limitado, que outros condomínios ele ainda enxergaria? Como conferimos isso antes de usar?**
- *Por que importa:* queremos testar sem tocar em nada que não seja nosso.
- *Muda:* o POC e o critério de parada 2.

**2.3 Esse usuário especial ocupa uma "licença" paga? Ele é de uma pessoa ou do cargo (para não parar se alguém sair da empresa)?**
- *Por que importa:* se a conta é de uma pessoa e ela sai, a integração cai.
- *Muda:* custo (D9) e continuidade (R14).

**2.4 A chave de acesso tem validade? Quando vence e quem renova?**
- *Por que importa:* o estudo viu "1 ano" em um resumo de busca, não confirmado; vencendo sem aviso, o recurso some.
- *Muda:* o lembrete e o alerta (6.1).

**2.5 Como se cancela (revoga) uma chave rapidamente se ela vazar? Vocês conseguem fazer isso no mesmo dia?**
- *Por que importa:* é o plano de resposta a incidente.
- *Muda:* o rollback (8.3) e o prazo de resposta que prometemos.

**2.6 Como preferem nos entregar a chave com segurança (nunca por WhatsApp ou e-mail)?**
- *Por que importa:* a chave dá acesso a dados; mensagem aberta é vazamento.
- *Muda:* o procedimento de entrega.

### 11.3 Custo e contrato

**3.1 [BLOQUEANTE] Usar essa integração tem custo (mensal, por consulta ou na contratação)?**
- *Por que importa:* o dono não decidiu pagar mensalidade (D9).
- *Muda:* **grátis** → segue. **Pago** → D9; pode parar a Fase B.

**3.2 Existe um ambiente de teste, ou um condomínio de mentira, onde possamos testar sem mexer em dado de morador?**
- *Por que importa:* o estudo só confirmou um teste grátis do próprio Superlógica em plano alto, não um ambiente de vocês.
- *Muda:* **sim** → POC com a Garden. **Não** → POC no teste grátis do Superlógica (dados inventados). **Sem nenhum dos dois, parar** (não usar dado real).

**3.3 Existe contrato ou termo de uso da integração que diga o que podemos e não podemos fazer com os dados?**
- *Por que importa:* pode proibir mostrar o boleto ao morador por fora (critério de parada 3).
- *Muda:* se a Fase B é permitida; o conteúdo do acordo (D10).

**3.4 Se o Superlógica mudar plano ou preços, vocês nos avisam? Quem paga a diferença?**
- *Por que importa:* custo futuro e dependência.
- *Muda:* R8.

### 11.4 Dados e unidades

**4.1 [BLOQUEANTE] Vocês **autorizam por escrito** o Harmony a mostrar ao morador o boleto em aberto e a 2ª via **da própria unidade dele**?**
- *Por que importa:* a situação de pagamento é dado do morador que vocês controlam (LGPD). Sem a autorização, não usamos.
- *Muda:* **sim** → B. **Não** → só Fase A. **Com condições** → entram no termo (D10).

**4.2 A numeração das unidades no Superlógica ("101", "A-101", "Bloco A, apto 101") é igual à que o prédio usa no dia a dia? Podem mandar a lista (só código e numeração, sem nome de morador)?**
- *Por que importa:* o Harmony precisa casar cada apartamento com o cadastro de vocês; erro aqui mostraria o boleto de um vizinho.
- *Muda:* a carga de vínculos (G1) e quanto será manual.

**4.3 Existem cadastros que não são apartamento (garagem, loja, sala) ou apartamentos com mais de um cadastro (unificado ou desmembrado)?**
- *Por que importa:* uma unidade do Harmony poderia corresponder a mais de uma de vocês.
- *Muda:* o modelo do vínculo (um para um ou um para vários).

**4.4 Quando um apartamento muda de dono ou de inquilino, vocês atualizam o cadastro? Em quanto tempo?**
- *Por que importa:* quem recebe o boleto muda; o Harmony precisa saber quando revisar.
- *Muda:* a regra de revisão (5.5) e o aviso à gestão.

**4.5 O boleto sai no nome do proprietário ou de quem mora? O inquilino recebe o boleto?**
- *Por que importa:* define se o inquilino pode ver no app.
- *Muda:* **D2** e o padrão de `financeiro_morador`.

**4.6 Quanto tempo depois do pagamento o boleto sai da lista de "em aberto" (baixa do banco)?**
- *Por que importa:* quem pagou ontem pode ver "em aberto"; o texto do app precisa ser honesto.
- *Muda:* o texto B3 e o prazo do cache.

**4.7 Para boleto vencido: o sistema recalcula multa e juros ao pedir a 2ª via? Para qual data?**
- *Por que importa:* valor errado vira reclamação e dívida.
- *Muda:* B7 (habilitar ou não a 2ª via de vencido).

**4.8 Vocês veem, nos cadastros, campos de cartão, conta bancária ou senha preenchidos de moradores?**
- *Por que importa:* a API devolve esses campos se estiverem preenchidos; o Harmony descarta, mas vocês precisam saber.
- *Muda:* o aviso à Garden (6.3) e se há problema do lado de vocês.

### 11.5 Cobrança e reservas

**5.1 [BLOQUEANTE] Os moradores já têm acesso (e-mail e senha) ao portal de vocês? Como o morador entra? Quantos usam?**
- *Por que importa:* se a maioria não tem login, o atalho não ajuda e o ganho do B é maior; se todos usam sem dificuldade, o B vale menos.
- *Muda:* o texto da Fase A e **a decisão de fazer o B** (M1).

**5.2 Qual é o endereço exato da "Área do condômino" do Harmony Residence? É o mesmo para todos os moradores?**
- *Por que importa:* é o link do botão da Fase A.
- *Muda:* o cadastro do link (#21).

**5.3 Vocês usam o módulo de **reservas** do Superlógica (o morador reserva por lá)? Dá para desligá-lo para este condomínio?**
- *Por que importa:* com reserva nos dois sistemas, os calendários divergem e dois moradores podem pegar o mesmo dia.
- *Muda:* R6; se não puderem desligar, o Harmony **não pode** cobrar nem criar reserva lá e o C morre.

**5.4 Vocês bloqueiam ou cancelam reserva de quem está inadimplente? Querem que o Harmony faça o mesmo?**
- *Por que importa:* o Superlógica faz isso nas reservas dele; o Harmony hoje não sabe.
- *Muda:* se vira decisão de produto nova (R7); não entra nesta PRD.

**5.5 Hoje, como vocês cobram a taxa de churrasqueira ou salão? Lançam no boleto do mês? Em qual conta/categoria? Quanto tempo gastam por lançamento?**
- *Por que importa:* sem esse processo não dá para decidir o C; o tempo atual é a base do ganho.
- *Muda:* **D8** e a conta (`ST_CONTA_CONT`) do lançamento.

**5.6 A taxa de higienização e a de uso vão para a mesma conta ou contas diferentes?**
- *Por que importa:* o lançamento pode precisar de duas linhas.
- *Muda:* o desenho do C (C1).

**5.7 Se o Harmony lançar a taxa e a reserva for cancelada, como o estorno é feito e por quem?**
- *Por que importa:* o Harmony não estorna na v1; alguém precisa saber que tem de agir.
- *Muda:* C5 (aviso e fluxo de pendência).

**5.8 Quando a taxa é lançada, quem responde ao morador que contesta o valor?**
- *Por que importa:* evita o Harmony virar canal de reclamação de cobrança.
- *Muda:* o texto do rodapé (R16) e o suporte.

### 11.6 Segurança e LGPD

**6.1 Vocês têm política de proteção de dados e um responsável (encarregado/DPO)? Aceitam um termo curto com o Harmony sobre quem é responsável pelo dado e o que fazer em caso de incidente?**
- *Por que importa:* a LGPD exige papéis claros; a Garden é a controladora desse dado financeiro.
- *Muda:* o termo (D10) e o fluxo de incidente.

**6.2 Se a chave vazar, em quanto tempo vocês querem ser avisados e quem avisamos?**
- *Por que importa:* a chave pode expor outros moradores de vocês.
- *Muda:* 8.3 e o roteiro de incidente.

**6.3 Onde o Superlógica guarda os dados (país/região)? Vocês têm acordo de tratamento de dados com ele?**
- *Por que importa:* transferência internacional e responsabilidade em cadeia.
- *Muda:* o aviso de privacidade e a avaliação do advogado.

**6.4 Vocês conseguem ver quem acessou os dados pela chave (registro de acessos) e nos avisar se algo estranhar?**
- *Por que importa:* ajuda a detectar uso indevido.
- *Muda:* o monitoramento e o plano de incidente.

### 11.7 Suporte

**7.1 Se algo falhar (chave não funciona, boleto errado), quem na Garden atende e em que horário? Há um canal combinado?**
- *Por que importa:* o morador vai perguntar ao síndico e ao app; precisamos de contato rápido.
- *Muda:* o rollback e o roteiro de suporte (R9).

**7.2 Vocês avisam antes de manutenção, mudança de campos ou troca de versão do sistema?**
- *Por que importa:* mudança silenciosa pode quebrar a consulta ou mostrar dado errado.
- *Muda:* a rotina de testes após cada mudança deles (R2).

**7.3 Pedidos de "boleto errado" que chegarem pelo síndico podem ser tratados normalmente por vocês, sem passar pelo Harmony?**
- *Por que importa:* o app não corrige valor; a correção é da Garden.
- *Muda:* o texto de ajuda (R16).

**7.4 Quem na Garden confirma os vínculos de unidades (4.2) e em quanto tempo?**
- *Por que importa:* a primeira carga depende dessa pessoa.
- *Muda:* D6 e o cronograma da B0.

---

## 12. Cronograma por esforço relativo (sem datas)

P = horas a 1 ou 2 dias · M = cerca de 1 a 2 semanas · G = várias semanas. **Tudo é SUPOSIÇÃO do PM** (o developer revisa); os prazos de espera dependem da Garden.

| Etapa | Esforço | Depende de | Observação |
|---|---|---|---|
| Fase 0a: conversa com o síndico, linha de base M0 | P | síndico | em paralelo |
| Fase 0b: levar as perguntas à Garden e receber respostas | P (nosso) · prazo da Garden | Garden | as 6 bloqueantes primeiro |
| Fase 0c: POC com script isolado no ERP de teste (sem dado real) | P a M | 3.2 respondida, ou teste grátis | confirma formatos reais da API |
| **Fase A** (link, validação, atalho no Início) | **P** | link da Garden | independente de tudo |
| B0: vínculo, tela de gestão, camada segura, flag, Superlógica falso | **M** | Fase 0 aprovada; D1 a D7, D10 | inclui migração e RLS |
| B1: tela do morador e da gestão (consulta e 2ª via) | **M** | B0 | |
| B2: QA, segurança, piloto, abertura gradual | **P a M** | B1 | QA antes de Done |
| Rodar ao menos um ciclo de cobrança e medir M3 a M6 | espera | B2 | |
| **Fase C** | **G** | D8, token de escrita, ERP de teste | só com gatilho |

**O que eu cortaria, nesta ordem:** (1) Fase C inteira; (2) histórico de boletos pagos; (3) painel de inadimplentes; (4) aviso por WhatsApp; (5) a própria Fase B se, depois de 30 dias de A, não houver evidência de dor.

---

## 13. Trecho proposto para `docs/produto.md` (só após aprovação do dono)

> **Integração com o Superlógica (07/10/2026).** A administradora (Garden) usa o Superlógica Condomínios (confirmado pelo dono; responde a #18). Ordem: **A** atalho para o portal da administradora (#21; o cartão "Portal da Administradora" já existe, falta o link e um atalho no Início); **B** consulta somente leitura de boleto e 2ª via **da própria unidade**, só depois das respostas da Garden, de uma prova de conceito num ERP de teste e de evidência de que o atalho não basta; **C** lançamento da taxa de reserva no Superlógica **congelado** (o relatório "valores a lançar" cobre por ora). Regras: usuário dedicado da Garden só de consulta e só do nosso condomínio, ou a integração para; token só em variável de ambiente do servidor, fora do ambiente de prévia; o Harmony guarda só o vínculo unidade↔Superlógica (sem CPF, RG, contato, dado bancário), consulta o resto na hora e nunca mostra dado sem a hora da consulta; o isolamento entre moradores é feito no código do servidor (a unidade vem do banco, nunca do navegador, e cada cobrança devolvida é conferida); inquilino não vê boleto por padrão; Portaria, Conselho, Zelador e provisório não veem situação financeira; o síndico consulta unidade a unidade, com registro, sem lista de inadimplentes. Especificação: `docs/specs/2026-10-07-integracao-superlogica.md`.
