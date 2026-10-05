# Reservas: bloqueio entre espaços e cobrança por faixa de pessoas

Data: 2026-10-05 · Autor: PM · Status: decisões do dono incorporadas (05/10/2026), pronta para o developer · Issue: #81 · Sem dados reais (repositório público).

Continua o PRD `docs/specs/2026-10-04-reservas-calendario.md` (já em produção: um pedido por espaço por dia no banco, RPC de disponibilidade, "Exige aprovação da equipe" por espaço). Respeita a decisão de `docs/produto.md` e `docs/pesquisas/2026-10-04-integracao-financeiro.md`: **o Harmony não cobra dinheiro; a administradora emite os boletos.**

## 0. Decisões do dono (05/10/2026)

1. **Bloqueio entre espaços.** No cadastro/edição do espaço aparece uma **lista dos outros espaços** já cadastrados; o síndico marca quais este espaço bloqueia (ex.: Churrasqueira 1 bloqueia Salão de Festas e Churrasqueira 2). A regra é **sempre simétrica**: marcar de um lado vale para os dois; desmarcar também. Significa: **no mesmo dia, uma reserva (PENDENTE ou APROVADA) em um espaço torna o outro indisponível.** **Sem cadeia** (A bloqueia B e B bloqueia C não faz A bloquear C). **Reservas já existentes não são alteradas** ao criar a regra.
2. **Cobrança por faixa, simples**, no cadastro/edição do espaço: ou **"grátis independente do número de pessoas"**, ou **"grátis até X pessoas e, acima disso, R$ Y fixos"**. O Harmony **só calcula e mostra** o valor (o morador vê antes de enviar o pedido) e **grava o valor na reserva**; **não emite cobrança nem recebe pagamento** (a administradora lança na taxa do morador). Entra um relatório simples "valores de reservas a lançar". A **taxa de higienização** existente continua como valor fixo à parte. O número de pessoas é **declarado pelo morador** (risco). O valor gravado **não muda** se a tabela do espaço mudar depois.

**Premissas do PM (a confirmar):**
- **P1.** O bloqueio vale para **todas as unidades, inclusive a mesma que reservou o outro espaço** (a unidade não pode ter Churrasqueira 1 e Salão no mesmo dia). Vale também para reservas registradas pela equipe, sem exceção.
- **P2.** "Número de pessoas" = total no espaço (moradores + convidados). O campo existente "Estimativa de convidados" (`convidados_estimados`) passa a se chamar "Número de pessoas" na tela; sem coluna nova de pessoas.
- **P3.** Faixa "até X" é inclusiva: com X = 20, 20 pessoas é grátis; 21 paga R$ Y (valor fixo, não por pessoa).
- **P4.** A taxa de higienização do espaço também é **gravada na reserva** no momento do pedido, para o relatório não mudar se o valor do espaço mudar.
- **P5.** Espaço inativo continua com seus pares gravados (se for reativado, a regra volta); só não aceita pedidos novos.

## 1. Problema e quem usa

**Quem sofre.**
- **Síndico/ADM:** hoje o banco só impede duas reservas do **mesmo** espaço no dia. Espaços que na prática se atrapalham (churrasqueiras vizinhas, churrasqueira que ocupa a área do salão) podem ser reservados no mesmo dia por unidades diferentes; o conflito é descoberto só no dia, ou resolvido à mão na aprovação. Churrasqueira para 8 pessoas e salão para 80 também têm hoje o mesmo tratamento: uso de evento grande não gera nenhum valor, e o síndico não tem como aplicar no sistema o que o regimento diz (suposição, validar).
- **Morador (celular):** quer saber se o dia está livre **e quanto vai custar** antes de pedir, sem precisar perguntar.
- **Equipe/administradora:** precisa saber quais valores lançar na taxa de cada unidade; hoje não há lista.

**O que existe (conferido no código).**
- `src/app/reservas/page.tsx`: cadastro de espaço com capacidade máxima, taxa de higienização (`taxa_limpeza`, valor fixo, "Isento" quando 0) e "Exige aprovação"; formulário do morador com "Estimativa de convidados" (limitado à capacidade, padrão 15) e termo; modal do dia no calendário (`src/components/reservas/ReservasCalendario.tsx`).
- Banco: `reservations_espaco_data_ocupado_key` (0032, uma reserva ativa por espaço e dia), gatilho de validação (`reservations_00_validar_criacao`: dia passado, espaço inativo), gatilho de status inicial (`reservations_10_status_inicial`, 0034), RPC `disponibilidade_reservas(inicio, fim)` devolvendo só `espaco_id, data, ocupado` (0033). Tabelas: `spaces` (nome, descricao, capacidade_max, horario_funcionamento, taxa_limpeza, regras, ativo, exige_aprovacao) e `reservations` (espaco_id, espaco_nome, bloco, unidade, morador_nome, data, horários, convidados_estimados, status, avaliado_por...). **Não há** nenhuma relação entre espaços nem valor gravado na reserva.
- Bateria de QA em `scripts/qa/bateria.mjs` (+ `lib.mjs`) já testa o calendário e a RPC como outro morador; os novos testes entram aqui.

**Se nada for feito:** dois eventos incompatíveis no mesmo dia, mais mensagens ao síndico, valor de uso combinado por fora (WhatsApp) e esquecido na hora de lançar na taxa.

## 2. Objetivos e não-objetivos

**Objetivos**
- Síndico/ADM configura, no cadastro do espaço, quais outros espaços ele bloqueia e a faixa de valor, sem sair da tela de espaços.
- O banco impede reservas simultâneas entre espaços que se bloqueiam, mesmo em corrida.
- O morador vê "Indisponível neste dia" (sem motivo) e o valor da reserva antes de enviar.
- A equipe obtém, em uma tela/CSV, os valores aprovados a lançar na administradora.

**Não-objetivos:** ver seção 9.

## 3. Regras por perfil

| Perfil | Bloqueio entre espaços | Faixa de valor | Relatório "a lançar" |
|---|---|---|---|
| **Síndico / Subsíndico / ADM** (`is_admin()`) | Configura (cadastro/edição do espaço) e lê a lista de bloqueios | Configura | Vê e exporta |
| **Morador** | Só vê o efeito: dia "Indisponível neste dia". Não vê a configuração nem qual espaço bloqueou | Vê o valor do espaço escolhido e o valor calculado ao pedir; vê o valor gravado nas reservas da própria unidade | Não acessa |
| **Portaria** | Não configura; lê reservas como hoje; o bloqueio vale quando registra pedido em nome de morador | Não configura; vê o valor na reserva (já lê todas as reservas) | Não acessa |
| **Conselho** | Não configura; leitura como hoje | Não configura; vê o valor na reserva | Não acessa (a confirmar com o dono se auditoria precisa) |
| **Provisório / visitante** | Sem acesso (RPC negada, como hoje) | Sem acesso | Sem acesso |

## 4. Modelo de dados proposto (a cargo do developer; numeração das migrações a confirmar)

**4.1 Pares de bloqueio** (tabela nova, p.ex. `space_blocks`):
- Colunas: `espaco_a text`, `espaco_b text`, ambos FK para `spaces(id)` com **`on delete cascade`** (apagar um espaço limpa seus pares).
- **Unicidade simétrica garantida pelo banco:** guardar o par **ordenado** e impor `check (espaco_a < espaco_b)` + `primary key (espaco_a, espaco_b)`. Assim (A,B) e (B,A) não coexistem e não existe espaço bloqueando a si mesmo. A aplicação sempre ordena antes de gravar.
- RLS: **leitura e escrita só `is_admin()`**; nenhum acesso para anon, morador, Portaria, Conselho e provisório. `revoke` dos grants padrão do Supabase para anon.
- **Gravação pela tela:** função (RPC) `definir_bloqueios_espaco(espaco_id, outros_ids text[])`, só `is_admin()`, `security definer`, `search_path` fixo, que em **uma transação** apaga os pares do espaço e insere os novos (ordenados). Marcar/desmarcar numa edição reflete nos dois lados automaticamente. Valida que os ids existem e que não há o próprio espaço na lista. Ao **criar** um espaço novo, a tela salva o espaço e depois chama a função; se a segunda etapa falhar, avisa e o síndico repete (o espaço não fica "meio configurado" com bloqueio errado).
- Auditoria: mudança de bloqueios registrada em `audit_logs` com frase legível ("Passou a bloquear Salão de Festas e Churrasqueira 2 no espaço Churrasqueira 1"), sem dado pessoal.

**4.2 Faixa de valor em `spaces`:**
- `faixa_gratis_ate integer null` e `faixa_valor numeric(10,2) null`.
- Os dois nulos = **grátis independente do número de pessoas** (padrão; espaços existentes continuam assim, nada muda).
- Os dois preenchidos = grátis até `faixa_gratis_ate` pessoas; acima disso, `faixa_valor` fixo.
- `check`: ambos nulos **ou** ambos preenchidos; `faixa_gratis_ate >= 0`; `faixa_valor > 0`; `faixa_gratis_ate < capacidade_max` (senão a cobrança nunca ocorreria). A edição é só `is_admin()` (política de escrita de `spaces` existente).
- A taxa de higienização (`taxa_limpeza`) **não muda de função**.

**4.3 Na reserva (`reservations`):**
- `valor_uso numeric(10,2) not null default 0` e `taxa_higienizacao numeric(10,2) not null default 0` (P4), gravados **no momento do pedido**. Pessoas continua em `convidados_estimados` (P2).
- Reservas existentes recebem 0 e 0 (nada é recalculado; sem efeito retroativo).

## 5. Regras de banco

1. **Gatilho de conflito com pares** (novo, `before insert` e `before update` em `reservations`, rodando junto aos gatilhos 00/10 existentes): quando a linha vai para status PENDENTE ou APROVADA **e** antes não estava (inserção, ou reativação de RECUSADA/CANCELADA, ou troca de espaço/data), rejeitar com código curto (`reserva_dia_indisponivel`) se existir reserva PENDENTE/APROVADA **no mesmo dia** em qualquer espaço **parceiro direto** (par na tabela). **Sem cadeia:** consulta só os pares diretos do espaço da linha, nunca os parceiros dos parceiros. Aprovar uma PENDENTE já existente não dispara a checagem (a ocupação não muda); regra também vale para quem tem `is_admin()` (P1, sem exceção).
2. **Concorrência:** o índice único atual só cobre o **mesmo** espaço; entre espaços diferentes ele não protege. O gatilho precisa serializar a checagem (p.ex. `pg_advisory_xact_lock` por data antes de conferir) para que **duas reservas simultâneas de espaços que se bloqueiam gerem uma só**; a segunda recebe o erro. Teste obrigatório.
3. **Reservas existentes:** criar um par **não** apaga nem recusa nada. Se já houver reservas dos dois espaços no mesmo dia, ambas permanecem (e o calendário continua mostrando os dois ocupados); novos pedidos nesses dias são barrados.
4. **Cálculo do valor no banco, nunca no navegador.** Função estável `valor_reserva(espaco_id, pessoas)` (única fonte da regra) usada pelo gatilho `before insert`, que **ignora qualquer `valor_uso`/`taxa_higienizacao` enviado** por morador, Portaria ou Conselho e grava o calculado; para `is_admin()` também (o valor não é digitado à mão). `pessoas <= faixa_gratis_ate` (ou espaço sem faixa) → 0; senão `faixa_valor`. `taxa_higienizacao` copia `spaces.taxa_limpeza` do momento. Rodar **depois** da validação 00 e do status inicial 10.
5. **Valor imutável:** `update` de `valor_uso`, `taxa_higienizacao`, `convidados_estimados`, `espaco_id` e `data` em reserva existente é negado a todos os perfis (só `status`, `motivo_recusa`, `avaliado_por`, `data_avaliacao` mudam, como hoje, e só admin). Se o pedido estiver errado, cancela-se e refaz-se. Mudar a faixa do espaço depois **não** altera reservas já criadas.
6. **RPC `disponibilidade_reservas`:** passa a devolver `ocupado = true` também para o dia de um espaço cujo **parceiro direto** tem reserva PENDENTE/APROVADA naquele dia. O contrato continua `(espaco_id, data, ocupado)`, uma linha por espaço e data, **sem** indicar o motivo, **sem** nome do espaço que bloqueou, unidade, status ou id. Mantém: perfil válido, nega provisório, janela limitada, `revoke` de public/anon. O retorno de um dia bloqueado deve ser **indistinguível** de um dia ocupado no próprio espaço.
7. **Relatório:** função `relatorio_valores_reservas(inicio, fim)` só `is_admin()` (checa dentro da função, retorna vazio/erro para os demais), devolvendo reservas **APROVADAS** com `valor_uso + taxa_higienizacao > 0` no período (por data de uso): data, espaço, bloco, unidade, pessoas, valor de uso, higienização, total. **Sem nome do morador, telefone ou e-mail.**
8. **Notificação:** reserva com valor > 0 acrescenta ao aviso existente a frase com o valor (seção 7). Texto escolhido pelo valor devolvido pelo banco, nunca calculado no navegador.
9. **Apagar espaço:** pares somem por cascata; as reservas dele continuam com `espaco_id` nulo (0014) e deixam de bloquear. **Desativar:** pares ficam (P5); reservas existentes do espaço inativo ainda bloqueiam seus parceiros até a data passar.

## 6. Regra de edição do espaço (tela)

- No cadastro/edição aparecem duas seções novas, só para equipe com permissão de gerir espaços:
  - **"Bloqueia outros espaços"**: lista com caixas de marcar dos **outros** espaços (inclui inativos, com o rótulo "(inativo)"; não lista o próprio). Texto de ajuda: "No mesmo dia, uma reserva aqui deixa os espaços marcados indisponíveis, e o contrário também." Salvou, vale para os dois lados; desmarcou, some dos dois.
  - **"Valor da reserva"**: escolha entre "Grátis, independente do número de pessoas" e "Grátis até [X] pessoas e, acima disso, R$ [Y]". Validação em português ("O limite grátis precisa ser menor que a capacidade do espaço", "Informe um valor maior que zero").
- O cartão do espaço mostra, para todos, o valor ("Grátis" ou "Grátis até 20 pessoas; acima, R$ 150,00") ao lado da higienização existente. A lista de bloqueios só aparece para a equipe.
- Alterar o bloqueio ou a faixa vale **só para reservas novas**; avisar isso na tela.

## 7. O que o morador vê

- **Calendário/modal do dia:** espaço bloqueado aparece exatamente como ocupado: **"Indisponível neste dia"**, sem motivo, sem dizer qual espaço bloqueou, sem identificar quem reservou. Se o morador tentar enviar num dia que ficou bloqueado em corrida, recebe "Este dia acabou de ficar indisponível. Escolha outro dia." e os dados recarregam.
- **Formulário:** campo "Número de pessoas" (com o máximo do espaço). Abaixo, o **valor antes de enviar**, atualizado conforme o número digitado: "Valor da reserva: Grátis" ou "Valor da reserva: R$ 150,00 (acima de 20 pessoas)", mais a higienização como hoje. Texto fixo: "O valor será lançado pela administradora na sua taxa de condomínio. O Harmony não cobra nem recebe pagamento." (texto final depende da pergunta 1.) Recomenda-se a mesma função `valor_reserva` para a prévia (única fonte da regra); depois do envio a tela mostra o valor **devolvido pelo banco**.
- **Confirmação e lista:** "Pedido enviado" / "Reserva confirmada" mostra o valor gravado; na lista/histórico da unidade o valor aparece na reserva.
- **Notificação:** em reserva com valor, a equipe recebe a frase "Valor a lançar: R$ X" no aviso de pedido ou de confirmação automática; o morador recebe "Valor da reserva: R$ X. Será lançado pela administradora." na confirmação/aprovação. Reserva sem valor: textos iguais aos de hoje.

## 8. Relatório "valores de reservas a lançar"

- Local: aba/botão "Valores a lançar" na página de Reservas, **visível só para Síndico, Subsíndico e ADM**.
- Filtro por mês (padrão: mês atual e seguinte). Tabela simples: data de uso, espaço, bloco, unidade, pessoas, valor de uso, higienização, total; total do período no rodapé. Botão "Baixar CSV" (UTF-8 com BOM, vírgula decimal, aberto no Excel pt-BR, protegido contra injeção de fórmula em células que comecem com `=`, `+`, `-`, `@`).
- Só reservas APROVADAS com total maior que zero. Reserva cancelada depois de lançada some da lista (risco 10.6: a equipe avisa a administradora).
- Sem nome nem contato do morador (a unidade basta). A exportação fica no histórico de ações ("Exportou valores de reservas a lançar de 10/2026"), sem o conteúdo.
- Impressão não é requisito.

## 9. Fica de fora

Cobrança, emissão de boleto/Pix e recebimento de pagamento (decisão do dono); integração com a administradora; marcar como "lançado"/conciliação; preço por dia da semana, feriado ou horário; valor **por pessoa excedente**; várias faixas; **bloqueio por horário** (o bloqueio é o dia inteiro); **cadeias** de bloqueio; bloqueio parcial (unidade pode, outra não); verificação do número de pessoas (lista de convidados, contagem na portaria); recálculo ou ajuste manual do valor após criado; relatório para morador/Conselho; alterar reservas existentes ao criar regra.

## 10. Riscos

1. **Declaração de pessoas pelo morador:** quem declara 18 para escapar da faixa paga menos. Não há verificação nesta entrega. Mitigação: o termo existente + texto "o número declarado vale para a cobrança"; a equipe pode cancelar; considerar contagem na portaria como etapa futura (validar o tamanho do problema com o síndico antes de investir).
2. **Valor gravado versus tabela atual:** o síndico muda a faixa e acha que valeu para tudo. Mitigação: aviso na edição ("vale para novos pedidos") e o valor mostrado na reserva é o gravado.
3. **Regimento/assembleia (a confirmar com o síndico):** cobrar por uso de espaço normalmente precisa estar previsto no regimento ou aprovado em assembleia; o Harmony só calcula, mas não deve induzir cobrança sem base. Não é parecer jurídico.
4. **LGPD:** valor por unidade é dado financeiro leve. Só a própria unidade e a gestão veem o relatório; a RPC de disponibilidade não revela valor, motivo, espaço bloqueador nem unidade; Portaria e Conselho já leem as reservas e, portanto, o valor (decisão do dono se quiser restringir). Exportação CSV com dado por unidade: guardar como informação restrita; sem nome do morador.
5. **Dependência da administradora:** a entrega só gera valor se ela **conseguir lançar um valor avulso** por unidade na taxa do mês e a que prazo (pergunta 1). Se não conseguir, o relatório vira lista de cobrança manual e a feature perde sentido. Validar **antes** de construir a fase 2.
6. **Reserva cancelada depois de lançada:** o relatório não detecta estorno. Mitigação: aviso na tela de cancelamento de reserva com valor ("já pode ter sido lançada; avise a administradora"); acompanhar se vira problema.
7. **Bloqueio mal configurado derruba disponibilidade:** marcar tudo como bloqueando tudo deixa só um espaço por dia. Mitigação: lista visível ao síndico e texto claro; mudança auditada; fácil desfazer.
8. **Corrida entre espaços:** o índice único não cobre pares; sem a trava no gatilho haveria duas reservas incompatíveis. Teste de concorrência é bloqueante.
9. **Vazamento por inferência:** morador pode deduzir "Salão indisponível sempre que a Churrasqueira 1 está reservada". Aceito (revela só ocupação, não quem); por isso a configuração de bloqueios é invisível ao morador.
10. **Premissa P1 (mesma unidade):** se o dono preferir permitir que a mesma unidade reserve os dois, muda o gatilho e o texto; confirmar antes da fase 1 ir ao staging.
11. **Escopo G em uma issue:** mitigação, 2 fases independentes (fase 1 vale sozinha).
12. **Suporte:** o morador não entende por que um dia está indisponível. Mitigação: texto neutro e curto; legenda existente; sem explicar a regra interna.

## 11. Critérios de aceite (testáveis)

**Fase 1: bloqueio entre espaços**
1. Equipe (Síndico, Subsíndico, ADM) vê, no cadastro/edição, a lista dos outros espaços com caixas de marcar; marca Churrasqueira 2 e Salão na edição da Churrasqueira 1; ao abrir a Churrasqueira 2 e o Salão, a Churrasqueira 1 aparece marcada. Desmarcar de um lado desmarca no outro.
2. O banco impede par duplicado ou invertido e espaço bloqueando a si mesmo (tentativa direta via API falha).
3. Com o par criado, uma reserva PENDENTE **ou** APROVADA da Churrasqueira 1 no dia D torna o Salão indisponível em D: novo pedido de **outra unidade** é recusado pelo banco, e o da **mesma unidade** também (P1). Em outro dia, ambos passam.
4. Recusar ou cancelar a reserva libera o outro espaço no dia.
5. **Sem cadeia:** com A bloqueia B e B bloqueia C, reservar A em D **permite** reservar C em D.
6. **Reservas existentes** de espaços que passam a se bloquear permanecem intactas após criar a regra.
7. **Concorrência:** dois pedidos simultâneos (moradores diferentes) para Churrasqueira 1 e Salão no mesmo dia geram **uma só** reserva; o outro recebe "Este dia acabou de ficar indisponível".
8. A RPC `disponibilidade_reservas` marca o Salão como ocupado em D por causa da Churrasqueira 1, devolvendo só `espaco_id, data, ocupado`: a resposta de rede não contém nome do espaço bloqueador, unidade, bloco, status nem id; é igual à de um dia ocupado no próprio espaço.
9. Morador vê "Indisponível neste dia" no calendário e no modal; nenhum texto, `title`, rótulo acessível ou resposta de rede explica o motivo.
10. **Segurança (testes por perfil, no staging):** morador, Portaria, Conselho, provisório e visitante **não** leem, criam, alteram nem apagam pares (`space_blocks`) e **não** chamam `definir_bloqueios_espaco`; só Síndico/Subsíndico/ADM. Outro morador não vê a reserva alheia nem o bloqueio. Provisório e visitante: RPC negada.
11. Apagar um espaço remove seus pares; desativá-lo mantém os pares; reativar restaura a regra.
12. Mudança de bloqueio aparece no histórico de ações com frase legível e sem dado pessoal.
13. Em 375px o seletor de bloqueio não gera rolagem horizontal, tem alvo de toque de 44px e as caixas têm rótulo; no desktop idem.

**Fase 2: cobrança por faixa de pessoas**
14. No cadastro/edição, equipe escolhe "Grátis" ou "Grátis até X pessoas e, acima, R$ Y"; validações em português para X maior ou igual à capacidade, Y menor ou igual a zero e campos faltando; só equipe grava (morador, Portaria, Conselho, provisório recebem negação, testado por API).
15. Espaços existentes continuam "Grátis" após a migração.
16. Morador vê o valor **antes de enviar**, que muda ao alterar o número de pessoas; o valor mostrado após o envio é o gravado e é igual ao da prévia.
17. Com faixa "até 20 / R$ 150": 20 pessoas grava 0; 21 grava 150 (valor fixo, não por pessoa); espaço sem faixa grava 0 para qualquer número.
18. **O cálculo é do banco:** enviar `valor_uso` (ou `taxa_higienizacao`) manipulado via API como morador, Portaria ou Conselho é ignorado e o valor gravado é o da regra.
19. Depois de criada a reserva, mudar a faixa ou a higienização do espaço não altera o valor da reserva; update direto de valor, pessoas, espaço ou data é negado a todos.
20. A taxa de higienização continua aparecendo à parte, como valor fixo.
21. Relatório: Síndico/Subsíndico/ADM veem as reservas aprovadas com valor no mês, com total; baixam CSV legível no Excel pt-BR; Portaria, Conselho, morador e provisório não acessam a tela nem a função (testado por API); o CSV e a tela não contêm nome, telefone ou e-mail; exportação fica no histórico de ações.
22. Reserva com valor mostra o valor na confirmação, na lista da unidade e nas notificações (equipe e morador); sem valor, os textos são os atuais.
23. Em 375px o formulário e o relatório não rolam na horizontal; o valor aparece sem ser coberto pelo teclado.

**Bateria:** os critérios 3 a 11, 14 a 22 entram em `scripts/qa/bateria.mjs`, com dados fictícios, como outro morador, Portaria, Conselho, visitante e provisório, e **com a trava de concorrência (7)** executada de verdade.

## 12. Fases e ordem

- **Fase 1: bloqueio entre espaços** (valor independente; vale sozinha): tabela de pares + função de gravação + gatilho com trava + ajuste da RPC + testes no banco, **depois** a lista no cadastro do espaço e o "Indisponível neste dia". Confirmar P1 antes de ir ao staging. Estimativa (a confirmar com o developer): 2 a 3 dias.
- **Fase 2: faixa de valor:** colunas, função `valor_reserva`, gatilho, imutabilidade, tela do cadastro, prévia no formulário, notificação, relatório e CSV. **Só começar depois de saber se a administradora lança valor avulso** (pergunta 1). Estimativa: 3 a 4 dias.
- Migrações no staging primeiro; produção só com aprovação do dono, depois de conferir reservas existentes no dia dos pares (sem apagar nada).

## 13. Perguntas em aberto ao dono (máx. 2)

1. **Na reunião com a administradora:** ela consegue lançar um **valor avulso por unidade** (reserva de espaço) na taxa do mês? Em que formato e com que prazo quer receber a lista (planilha mensal, por reserva)? Sem isso, a fase 2 não deve ser construída.
2. **Com o síndico:** a cobrança por faixa de pessoas está prevista no regimento ou foi aprovada em assembleia? E o bloqueio vale mesmo para a **mesma unidade** (premissa P1)?

## 14. Trecho proposto para `docs/produto.md` (aguarda aprovação do dono)

> **Reservas: bloqueio entre espaços e valor por faixa (decidido em 2026-10-05):** o síndico marca, no cadastro do espaço, quais outros espaços ele bloqueia; a regra é simétrica, sem cadeia, no mesmo dia, e vale com reserva PENDENTE ou APROVADA (reservas existentes não mudam). Cada espaço é "grátis independente do número de pessoas" ou "grátis até X pessoas e acima R$ Y fixos"; o Harmony calcula no banco, mostra ao morador antes de enviar e grava o valor na reserva, que não muda depois. **O Harmony continua sem cobrar nem receber**: a administradora lança na taxa do morador, e um relatório "valores a lançar" (só gestão, sem nome) serve de ponte. Risco aberto: o número de pessoas é declarado pelo morador. Dependências: a administradora aceitar lançar valor avulso; regimento/assembleia a confirmar.
