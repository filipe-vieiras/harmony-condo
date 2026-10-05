# QA: Reservas, bloqueio entre espaços e valor por faixa de pessoas (issue #81)

Data: 05/10/2026 · Ambiente: staging (app local em localhost:3000) · Migrações 0038 e 0039 já aplicadas · Contas `@staging.test`.
Escopo: alterações ainda sem commit no diretório de trabalho. Nenhum código foi alterado por este QA.
Método: API com o login de cada perfil (scripts Node, anon key) e interface no navegador (desktop e 375px), com apoio de DOM/JS para confirmar o que a automação de clique não pegou.

## Resumo

- **Nenhum bug que bloqueie ou seja grave.** Todas as regras de banco e de permissão testadas passaram.
- 5 observações leves de acabamento (nenhuma afeta a regra de negócio).
- Não deu para testar: estado vazio da lista de bloqueios, "—" em reserva antiga, impressão real da agenda, duplo clique/rede offline (detalhes no fim).

## 1. Formulário do espaço (Síndico, Subsíndico, ADM)

| Caso | Resultado |
|---|---|
| Cartões na ordem "Regras de reserva", "Valor de uso", "Bloqueios" (Síndico, Subsíndico, ADM, e também no cadastro de espaço novo) | PASSOU |
| Rádios e checkboxes com alvo de 44px (desktop e 375px); campos da faixa com 44px; sem rolagem horizontal em 375px | PASSOU |
| Prévia viva ("Até 10 pessoas: grátis. Acima de 10: R$ 150,00."; "Todas as reservas: R$ ..." quando limite 0) | PASSOU |
| Erro com `aria-invalid` e `aria-describedby`: pessoas vazio ("Informe quantas pessoas entram sem pagar. Use 0 se o valor vale para todos.") | PASSOU |
| Erro valor vazio e valor 0 ("Informe o valor em reais, maior que zero.") | PASSOU |
| Erro limite igual ou maior que a capacidade (50 e 60 com capacidade 50) ("O limite grátis precisa ser menor que a capacidade máxima (50 pessoas). Para ser sempre grátis, escolha a primeira opção.") | PASSOU |
| Campo de limite só aceita dígitos (letras e "-" são filtrados) | PASSOU |
| Trocar o rádio Grátis/Faixa e voltar guarda os valores digitados | PASSOU |
| Foco vai para o primeiro campo inválido ao salvar com erro (e erros dos dois campos aparecem juntos) | PASSOU |
| "Bloqueios": lista dos outros espaços; o próprio não aparece; inativo com rótulo "(inativo)" | PASSOU |
| Simetria: marcar Sala de Jogos no Salão aparece MARCADO na Sala de Jogos; desmarcar de um lado libera os dois; galeria atualiza | PASSOU |
| Aviso âmbar de reservas futuras ("Atenção: o Salão de Festas já tem reservas futuras (2). Elas continuam valendo; ...") só aparece para espaço recém-marcado que tem reservas (conta só PENDENTE/APROVADA) | PASSOU |
| Subsíndico e ADM gravam bloqueio pela tela | PASSOU |
| Cadastrar espaço novo já com faixa e bloqueio (cria o espaço, depois grava o par); desativar mantém o par; remover limpa o par | PASSOU |
| Taxa de higienização continua à parte, com texto de apoio ("Cobrada à parte..." e "A taxa de higienização não entra neste valor.") | PASSOU |
| Estado vazio da lista de bloqueios (nenhum outro espaço) | NÃO TESTADO (exigiria apagar os outros espaços) |

## 2. Galeria

| Caso | Resultado |
|---|---|
| "Valor de uso:" visível para todos os perfis ("Grátis" / "R$ 150,00 acima de 10 pessoas") | PASSOU (Síndico, Subsíndico, ADM, Conselho, Portaria, morador, inquilino) |
| "Não reservável no mesmo dia que: ..." só para Síndico, Subsíndico e ADM; ausente (0 ocorrências no HTML) para morador, inquilino, Portaria e Conselho | PASSOU |
| Selos "Confirmação automática" / "Exige aprovação" / "Em manutenção" intactos | PASSOU |
| Conselho e Portaria sem Cadastrar/Editar/Desativar/Excluir espaço | PASSOU |

## 3. Bloqueio na prática (API e tela)

| Caso | Resultado |
|---|---|
| Churrasqueira reservada num dia: Salão fica "Indisponível neste dia" (rádio desabilitado, sem motivo) e o calendário reflete ("1 espaço livre") | PASSOU |
| O inverso (Salão PENDENTE bloqueia a Churrasqueira) | PASSOU |
| Mesma unidade também é bloqueada (tela e API) | PASSOU |
| Outra unidade bloqueada (API) | PASSOU |
| Equipe em nome do morador respeita o bloqueio: Síndico, Subsíndico, ADM, Portaria e Conselho recusados pelo banco (`reserva_dia_indisponivel`); na tela o espaço aparece desabilitado também para a equipe | PASSOU |
| PENDENTE bloqueia; recusar libera; cancelar libera | PASSOU |
| Reativar reserva cancelada num dia agora bloqueado é recusado; aprovar PENDENTE já existente não dispara a checagem | PASSOU |
| Sala de Jogos (sem par) continua livre com os dois bloqueados; sem cadeia (A-B e C-B: A e C no mesmo dia passam; B é barrado) | PASSOU |
| Reservas do dia 5 (anteriores ao bloqueio) continuam válidas; novo pedido nesse dia é barrado | PASSOU |
| Nada revela o motivo: RPC `disponibilidade_reservas` devolve só `espaco_id, data, ocupado`; 0 ocorrências de "bloque", "Não reservável", `space_blocks` no HTML do morador e do inquilino; modal sem `title` explicativo; o modal da equipe também só diz "Indisponível neste dia" | PASSOU |
| Corrida na tela: dia fica bloqueado depois do modal aberto; ao enviar aparece "Este dia acabou de ficar indisponível. Escolha outro dia." e os dados recarregam | PASSOU |
| Conflito no mesmo espaço (2 pedidos simultâneos de Sala de Jogos): um passa, outro recebe 23505 (a tela trata como conflito) | PASSOU |

## 4. Valor ao reservar (morador)

| Caso | Resultado |
|---|---|
| Texto vivo: "Valor de uso: grátis." / "grátis (até 10 pessoas)." / "R$ 150,00 (acima de 10 pessoas)." | PASSOU |
| Acima da capacidade: "Este espaço comporta até 50 convidados. Reduza o número para continuar." (`aria-invalid`, sem valor); no envio o erro volta e o foco vai ao campo | PASSOU |
| Campo vazio: "Informe o número de convidados para ver o valor." | PASSOU |
| Debounce: ao digitar "10", só duas mudanças na região `aria-live="polite"` ("Calculando o valor…" e o resultado), nada por dígito | PASSOU |
| Aviso fixo da administração ("O valor é lançado pela administração na sua taxa. O Harmony só mostra o cálculo.") | PASSOU |
| 10 pessoas = grátis; 11 = R$ 150,00 (tela e API); 50 = R$ 150,00 fixo (não por pessoa) | PASSOU |
| Mensagens de sucesso: "Pedido enviado! Valor desta reserva: R$ 150,00. A administração lança o valor na sua taxa. ..."; pedido grátis "Pedido enviado! Esta reserva não tem valor de uso. ..."; confirmação imediata "Reserva confirmada! Esta reserva não tem valor de uso." Equipe: "Pedido registrado para ... Valor de uso: R$ 150,00 (acima de 10 pessoas)." | PASSOU |
| Coluna Valor na lista ("R$ 150,00" / "Grátis"); em 375px a linha "Valor" aparece em cada cartão (rótulo por `data-label`, sem rolagem horizontal) | PASSOU |
| Aviso à equipe com o valor só quando há valor ("... Requer aprovação. Valor de uso: R$ 150,00 (acima de 10 pessoas)."); sem valor, texto igual ao anterior; aviso à unidade sem valor (decisão do dono: só no app) | PASSOU |
| Sem relatório "Valores a lançar" (nenhuma ocorrência em Relatórios) | PASSOU |
| "—" na coluna Valor para reservas anteriores à regra | NÃO TESTADO (o gatilho sempre preenche o valor; não existe reserva antiga na base de teste) |

## 5. Valor gravado e imutável (API)

| Caso | Resultado |
|---|---|
| Mudar faixa (5/R$ 300) e higienização (R$ 99) do espaço NÃO altera reservas existentes (continua 150/150); a nova reserva usa a faixa nova (300/99); restaurado depois | PASSOU |
| UPDATE de `valor_uso`, `taxa_higienizacao`, `convidados_estimados`, `data`, `espaco_id` recusado (`reserva_imutavel`) para Síndico, Subsíndico e ADM; morador sem efeito | PASSOU |
| Status, motivo e avaliador continuam editáveis pela gestão | PASSOU |
| Valor adulterado no INSERT (9999, 0, 1) ignorado como morador, Portaria, Conselho e Síndico; higienização adulterada também | PASSOU |
| Pessoas 0, negativo, nulo ou acima da capacidade: `reserva_pessoas_invalidas` (morador e Síndico) | PASSOU |
| Morador não registra em nome de outra unidade (RLS) | PASSOU |
| Constraints da faixa (limite = capacidade, maior, negativo, valor 0, só um campo preenchido): 23514 | PASSOU |

## 6. Segurança por API

| Caso | Resultado |
|---|---|
| `space_blocks` leitura: só Síndico, Subsíndico e ADM veem o par; morador, inquilino, Portaria, Conselho e provisório recebem lista vazia; visitante recebe "permission denied" | PASSOU |
| Escrita direta (INSERT, UPDATE, DELETE) em `space_blocks` negada a Síndico, Subsíndico e ADM | PASSOU |
| `definir_bloqueios_espaco`: negada (42501) a morador, inquilino, Portaria, Conselho, provisório e visitante; Síndico/Subsíndico/ADM executam; recusa auto-bloqueio e ids inexistentes | PASSOU |
| Morador, inquilino, Portaria, Conselho, provisório e visitante não alteram faixa do espaço | PASSOU |
| RPC de disponibilidade: provisório recebe vazio; visitante é negado | PASSOU |
| Concorrência: 5 rodadas de pedidos simultâneos Salão x Churrasqueira no mesmo dia (moradores de unidades diferentes) = sempre uma só reserva, a outra com `reserva_dia_indisponivel`; mais 1 rodada Síndico x Portaria, também uma só | PASSOU |
| Apagar espaço limpa os pares (cascata); desativar mantém; par guardado ordenado (a < b); desmarcar pelo outro lado remove o par | PASSOU |
| Provisório não cria reserva (RLS); visitante não lê espaços nem reservas | PASSOU |
| Morador/inquilino só leem reservas da própria unidade | PASSOU |

## 7. Perfis

| Caso | Resultado |
|---|---|
| Portaria: galeria sem a linha de bloqueio; sem Cadastrar/Editar; registra em nome do morador respeitando bloqueio e valor (pedido de R$ 150,00 registrado; Churrasqueira do mesmo dia ficou desabilitada) | PASSOU |
| Conselho: galeria sem a linha de bloqueio; sem Cadastrar/Editar; coluna Valor na lista | PASSOU |
| Provisório: tela "Disponível após a validação do seu cadastro", sem acesso a reservas | PASSOU |
| Inquilino igual ao morador (valor, calendário, "Indisponível neste dia" sem motivo) | PASSOU |

## 8. Regressão

| Caso | Resultado |
|---|---|
| Aprovar pela Lista (inclusive PENDENTE de dia em que a Churrasqueira já tinha reserva) | PASSOU |
| Recusar pelo modal do dia (pede motivo; libera o outro espaço) | PASSOU |
| Aprovação por espaço: Salão exige aprovação (PENDENTE); Churrasqueira e Sala de Jogos confirmam na hora (APROVADA) | PASSOU |
| Calendário: setas movem o foco, Enter abre o modal (foco no título), Esc fecha e devolve o foco à célula; `aria-label` por dia ("20 de outubro, todos os espaços ocupados, 1 reserva pendente, 1 reserva confirmada"); grade com rótulo | PASSOU |
| Cadastro, edição, desativação, ativação e remoção de espaço | PASSOU |
| Histórico em Relatórios: "Passou a bloquear ... no espaço ...", "Deixou de bloquear ...", sem dado pessoal | PASSOU |
| 375px sem rolagem horizontal (calendário, lista, modal de reserva, formulário do espaço) | PASSOU |
| Console sem erros novos; único erro é 404 de `/favicon.ico` (já existia, sem relação) | PASSOU |
| Sem 5xx nas chamadas observadas | PASSOU |
| Impressão da agenda: a tabela tem largura mínima 1049px com a coluna Valor (948px sem ela), maior que o retrato; não consegui emular mídia de impressão para ver o resultado real | NÃO CONCLUSIVO |

## Bugs

**Bloqueia:** nenhum.
**Grave:** nenhum.

**Leve**
1. Terminologia inconsistente. O campo diz "Número de pessoas", mas as mensagens dizem "convidados" ("Informe o número de convidados...", "comporta até 50 convidados"). No formulário do espaço o campo é "Taxa de Limpeza (R$)" e na galeria é "Taxa de higienização" (e "Taxa de limpeza" no modal de reserva).
   Reproduzir: morador, calendário, dia livre, Salão, esvaziar o campo de pessoas.
2. Pessoas = 0: mostra "Informe o número de convidados para ver o valor." e o campo não recebe `aria-invalid` (com 51 recebe). O banco recusa 0 (`reserva_pessoas_invalidas`), então a validação da tela poderia dizer "mínimo 1 pessoa".
3. "Calculando o valor…" fica dentro da região `aria-live="polite"`, então um leitor de tela anuncia "Calculando..." antes de cada resultado (uma vez por pausa de digitação, não por dígito).
4. O banner de sucesso ("Pedido enviado! ...", "Reserva confirmada! ...") não tem `role="status"`/`aria-live`: um leitor de tela não o anuncia. Também o aviso âmbar de reservas futuras no formulário do espaço não tem `role`. (Não verifiquei se o banner já era assim antes desta mudança.)
5. Máscara de moeda do valor da faixa lê os dígitos como centavos: digitar "150" vira "1,50" (digitar "15000" vira "150,00"). É intencional (a prévia mostra o resultado na hora), mas pode surpreender o síndico; vale um texto de ajuda ou placeholder explícito.

**Observações (sem ação obrigatória)**
- A função `valor_reserva` responde ao provisório (devolve 150 para o Salão). Não vaza nada além do que ele já lê em `spaces` (a faixa é pública para quem tem perfil), mas, se a decisão for "provisório não vê valores", a função precisa checar `is_cadastro_provisorio()` como a de disponibilidade faz.
- `/favicon.ico` retorna 404 (pré-existente).

## Não deu para testar

- Estado vazio da lista de bloqueios (exige que exista só um espaço).
- "—" na coluna Valor para reserva anterior à regra (não existe reserva sem valor na base; o gatilho sempre preenche).
- Impressão real da agenda (sem emulação de mídia de impressão nas ferramentas).
- Duplo clique rápido, rede offline simulada e recarga no meio do envio.
- Teclado virtual cobrindo o valor em 375px (a emulação não abre teclado); conferi que o valor fica acima do botão e dentro da largura.
- Safari/iOS e leitor de tela real; as conclusões de acessibilidade vêm da leitura do DOM.

## Dados de teste

Foram criadas reservas e avisos no staging durante a bateria (API e tela) e o espaço temporário "QA Espaço Novo" (já removido). As faixas do Salão foram restauradas (10 pessoas / R$ 150,00 / higienização R$ 150,00). O seed (`node scripts/seed-staging.mjs`) recria a base ao final.
