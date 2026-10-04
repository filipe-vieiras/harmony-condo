# QA: morador remove veículo da própria unidade + multa sem valor negativo (issue #51)

Data: 04/10/2026. Ambiente: staging (app local em localhost:3000, migrações 0035 e 0036 já aplicadas). Alterações no diretório de trabalho sem commit. Contas `@staging.test`.
Desktop 1280x800 e 375x812; largura 1024 a 1246 só na tabela de veículos. Nenhum código foi alterado.

## Resumo
- Todos os casos do roteiro **PASSARAM**, com 3 observações leves e 1 lacuna informativa já conhecida (decidida pelo dono).
- Nenhum bug que bloqueie ou seja grave.

## Resultados por caso

### 1. Tela Veículos para o morador (1280 e 375px) — PASSOU
- 1280px: "Editar veículo" (129x44) e "Remover" (98x44) com texto, lado a lado, 44px de altura. Coluna Ações dentro do cartão (botões terminam em 1229 e o cartão em 1241). Sem rolagem horizontal (scrollWidth 928 = clientWidth 928; página 1274 < 1280).
- 375px: botões lado a lado (129x44 e 98x44), cabendo na tela, sem rolagem horizontal da página (375 = 375).
- Botões só nos veículos ATIVO da própria unidade. O veículo VISITANTE da própria unidade aparece **sem nenhum botão** (a célula Ações some no celular). Veículo de outra unidade não aparece para o morador (a lista já vem filtrada), então não há botão nele.
- Coluna Cor saiu; a cor aparece como segunda linha sob o modelo (ex.: "Volkswagen Gol / Prata").

### 2. Remover — PASSOU
- Diálogo "Remover este veículo?" com texto "Fiat Argo da unidade A-101 deixa de aparecer na garagem e na busca da portaria. Você pode cadastrá-lo de novo depois." Sem placa. Botões "Voltar" e "Remover veículo" de 44px. Cabe a 375px.
- Foco inicial em "Voltar". Esc cancela, não remove e o foco volta ao botão da linha. "Voltar" também cancela e devolve o foco (0 chamadas DELETE).
- "Remover veículo" remove: aparece "Veículo removido.", a linha some e o foco vai ao cartão de feedback (role status). Funciona também a 375px e por teclado (Tab + Enter).
- Duplo clique em "Remover veículo": 1 só chamada DELETE (medida), 1 só remoção.
- Estado vazio (inquilino, depois de remover os dois veículos): "Sua unidade não tem veículos cadastrados." com botão "Cadastrar veículo" de 44px, que abre o modal.
- Erro simulado de rede (fetch rejeitado): "Não foi possível remover o veículo. Verifique a conexão e tente de novo." com foco no cartão (role alert); o veículo continua na lista.
- Erro simulado de linha já apagada (apaguei a linha pelo banco com a lista aberta): mesma mensagem, veículo continua na lista até recarregar (ver observação O1).
- Cadastrar de novo o veículo removido (mesma placa, digitada "stg 5e05" em minúsculas e com espaço): normalizou para STG5E05 e salvou ("Veículo cadastrado."); a placa ficou livre.

### 3. Histórico (Relatórios como síndico) — PASSOU
- Trilha de Auditoria mostra "Removeu um veículo da unidade 101 (Bloco A)." / "unidade 102 (Bloco A)." com o perfil de quem removeu (Morador Proprietário, Morador Inquilino, Síndico, etc.) e data/hora. Sem placa na frase.
- "Detalhes técnicos" mostra só o `vehicleId` (não mostra placa). O UUID só aparece depois de abrir "Detalhes técnicos" (ver O3).
- Por API confirmei a linha gravada pelo gatilho: perfil correto (MORADOR, SINDICO, SUBSINDICO, ADM, PORTARIA), módulo UNIDADES, detalhes `{tipo, status, vehicleId}`, nenhuma placa.
- Remoção pela chave de serviço (sem usuário logado) não gera linha de auditoria (esperado pela migração 0036).

### 4. Perfis — PASSOU
- Inquilino (A102): vê Editar e Remover nos veículos da própria unidade e remove com a mesma confirmação.
- Síndico, Subsíndico e ADM: veem Editar e Remover em todos os veículos, inclusive VISITANTE e de outras unidades; mesma confirmação e remoção funcionando (testado com os três perfis).
- **Portaria**: vê todos os veículos, **vê "Cadastrar Veículo"**, e **não vê "Editar" nem "Remover"**.
- **Conselho**: vê todos os veículos, **não vê "Cadastrar Veículo"**, nem "Editar", nem "Remover".
- Morador provisório (autocadastro, `cadastro_validado = false`): tela "Disponível após a validação do seu cadastro", sem lista nem botões. Por API também: lê 0 veículos e apaga 0 linhas, mesmo vinculado a uma unidade com veículo (o controle com `cadastro_validado = true` lê normalmente).

### 5. Segurança por API — PASSOU, com lacuna informativa conhecida
Executado com login real de cada conta de teste, sobre veículos de teste criados e removidos pelo script:

| Quem | O que tenta apagar | Resultado |
|---|---|---|
| Morador | veículo ATIVO da própria unidade | 1 linha (ok) |
| Morador | veículo de outra unidade | 0 linhas, veículo continua |
| Inquilino | próprio / de outra unidade | 1 linha / 0 linhas |
| Conselho | qualquer | 0 linhas |
| Sem login | qualquer | 0 linhas |
| Síndico, Subsíndico, ADM | qualquer | 1 linha cada |
| Morador | **VISITANTE da própria unidade** | **1 linha: o banco permite** |
| Portaria | ATIVO e VISITANTE | **1 linha: o banco permite** |

Lacunas informativas (decididas pelo dono, sem mudança): a tela esconde "Remover" no VISITANTE para o morador, mas o banco ainda deixa o morador apagar visitante da própria unidade (policy `vehicles_delete` por `unit_id`). A Portaria não vê o botão, mas o banco deixa a Portaria apagar. Observação para o dono: o critério 3 da issue (apagar VISITANTE por API devolve 0 linhas/403) **não se cumpre** hoje no banco; só vale na tela.

### 6. Multa (Síndico, Subsíndico, ADM) — PASSOU
- Multa Financeira com -50: "O valor da multa não pode ser negativo." abaixo do campo, `role="alert"`, `aria-invalid`, `aria-describedby`, foco no campo. Testado como Síndico, Subsíndico e ADM.
- Valor 0 e valor vazio: "Informe o valor da multa."
- A mensagem some ao digitar no campo (digitei um dígito e ela sumiu).
- Valor 350,50 emite: "Notificação NOT-2026/001 emitida com sucesso." e aparece na lista como "Multa: R$ 350,50", status Pendente de Ciência.
- Morador da unidade registrou a ciência ("Ciência registrada com sucesso."); Síndico anulou com motivo ("Multa anulada. O motivo ficou registrado.", valor anulado exibido); ADM apagou ("Multa apagada.").
- Advertência: campo valor desabilitado em 0.00, emitiu sem valor (NOT-2026/002).
- Por API, inserção com valor -50 recusada com `23514` (`fines_valor_nao_negativo`) para Síndico, Subsíndico, ADM e chave de serviço. Também recusados -0,01 e UPDATE para -5 (chave de serviço). Aceitos: 0,01, advertência com 0 e (por API) multa financeira com 0. Esse último é esperado: o piso do banco é `>= 0` e só a tela exige maior que zero.

### 7. Regressão — PASSOU
- Morador cadastra veículo (tipo Carro, marca, modelo, cor): ok. Placa duplicada (digitada "stg-1a01"): normaliza para STG1A01 e mostra "Esta placa já está cadastrada." mantendo o modal aberto.
- Morador edita (cor "Prata" para "Prata Metálico"): "Veículo atualizado." e a auditoria registra "Alterou um veículo da unidade 101 (Bloco A): cor."
- Faixa "Outro" aparece só para a equipe (síndico viu "1 veículo está como 'Outro'..." com botão "Ver veículos 'Outro'"); morador vê o filtro "Outro (0)" sem a faixa.
- Filtros Carro, Moto, Outro e Todos, e busca (por "gol" e por texto sem resultado, com "Nenhum veículo encontrado correspondente à pesquisa."): corretos.
- Exportação: a tela de Veículos só tem "Imprimir Relação" (não testei a impressão). A exportação de Relatórios é CSV (não Excel) e gerou o arquivo (4.742 bytes) sem erro.
- Console: só erros esperados das falhas que eu mesmo simulei (fetch derrubado, placa duplicada 409). Nenhum erro novo. Nenhum 5xx nas requisições que a janela guardou. O log do servidor tem mensagens de outras sessões e de dados ausentes no staging (tabelas de config vazias), sem relação com esta mudança.
- **Largura 1024 a 1246px (tabela de veículos, visão equipe)**: o cartão da tabela ainda rola na horizontal. A tabela mede 909px de largura: a 1246px sobra 15px (894 de área), a 1130px sobram 131px (778), a 1024px sobram 237px (672). A 1280px não rola (928 de área). Confirma o que o developer informou.

## Observações e achados (nenhum bloqueia)
- **O1 (leve)**: se o veículo já foi apagado por outra pessoa e a lista está desatualizada, a mensagem de erro fala em "Verifique a conexão", e a linha só some ao recarregar. Não há atualização em tempo real da lista. Dica: tratar "0 linhas" como "já foi removido" e atualizar a lista.
- **O2 (leve)**: se a unidade só tem veículo VISITANTE (sem veículos do morador), a lista não fica vazia e o morador não vê o estado vazio com "Cadastrar veículo" (só o botão do topo). Comportamento coerente com o filtro atual; relato para decisão de design.
- **O3 (leve, existente)**: a trilha de auditoria mostra o `vehicleId` (UUID) dentro de "Detalhes técnicos" (recolhido). O critério 5 diz "sem UUID visível"; está oculto por padrão, igual aos outros eventos.
- **O4 (leve, provavelmente anterior à mudança)**: com a janela entre ~1024 e ~1130px, no perfil de equipe a **página** ganha rolagem horizontal (28px a 1100px, 58px a 1024px). Quem estoura é o cabeçalho com os botões "Imprimir Relação" e "Cadastrar Veículo", não a tabela. Não consegui comparar com a versão anterior (não altero código).
- **Lacunas de segurança informativas** (item 5): Portaria e morador (VISITANTE da própria unidade) conseguem apagar por API.

## Não testado
- Impressão ("Imprimir Relação") e geração do PDF.
- Captura visual do diálogo a 1280px (confirmado pelo DOM, medidas de 44px). A 375px conferi por captura.
- Morador remover veículo de outra unidade pela tela (a tela não mostra veículo de outra unidade; coberto por API).
- Rodar a migração duas vezes (já aplicada pelo developer; só li o código, que usa `if not exists`, `create or replace` e `drop trigger if exists`).
- Rodar a bateria completa (não pedido).

## Dados de teste e limpeza
- Veículos de teste (placas QA*) e multas de teste (descrição "QA") foram removidos. O usuário temporário `qa-prov@staging.test` foi apagado.
- A base do staging ficou **diferente do seed**: foram removidos Fiat Argo (recadastrado e removido de novo), Honda CG 160, Honda Civic, Caloi Elétrica (inquilino) e Gol com cor editada ("Prata Metálico"). Restam STG1A01 e STG6F06. Rode `node scripts/seed-staging.mjs` para recriar a base.
- Os eventos de auditoria desta sessão ficam registrados no staging (inclusive linhas da conta "Manutenção direta no banco").
