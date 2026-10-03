# QA: Tipo do veículo (issue #43)

Data: 2026-10-03. Ambiente: staging (app local em localhost:3000, base `yusmuzifhhlowuqtcnid`), código ainda sem commit, migração 0030 já aplicada. Contas `@staging.test`. Desktop 1280x800 e celular 375x812.

## Resumo
- Casos: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 e 11 PASSARAM. Nenhum bug que bloqueie ou seja grave.
- 4 observações leves (L1 a L4), todas de acabamento.
- Não testado: ver seção final.

## Casos

| # | Caso | Resultado |
|---|------|-----------|
| 1 | Cadastro sem tipo marcado, erro, foco, setas/Tab, salvar, 375px | PASSOU |
| 2 | Lista: coluna Tipo, chips, combinação com busca, vazio, impressão | PASSOU |
| 3 | Faixa "Outro" só para a equipe, fecha e não volta, "Ver veículos Outro" | PASSOU |
| 4 | Edição do tipo pela equipe, mensagem, foco, Esc, histórico | PASSOU (com L2 e L3) |
| 5 | Edição pelo morador e regras no banco | PASSOU |
| 6 | Portaria: selo ao lado da placa, sem editar | PASSOU |
| 7 | Inquilino e Conselho | PASSOU (relato abaixo) |
| 8 | Autocadastro público, painel, validação, legado | PASSOU |
| 9 | Excel: colunas "Vínculo" e "Tipo de veículo" | PASSOU |
| 10 | Relatórios: Carros + Motos + Outros = total | PASSOU |
| 11 | Regressão e acessibilidade | PASSOU (com L1 e L4) |

### 1. Cadastro (Síndico, Morador, Portaria)
- Formulário abre com os três rádios Carro/Moto/Outro sem nenhum marcado (checked = false nos três), com texto de apoio "Escolha uma opção. Use "Outro" se não for carro nem moto.".
- Enviar sem escolher: aparece "Escolha o tipo do veículo." e o foco vai para o primeiro rádio (`veiculo-tipo-carro`). Repetido com Síndico (desktop), Morador (375px) e Portaria (375px, cadastro de visitante).
- Seta direita move a seleção de Carro para Moto; Tab sai do grupo para o campo seguinte (Marca). O erro some depois de escolher.
- Salvar: "Veículo ... cadastrado com sucesso." e a linha aparece na lista com o selo (ícone + texto) do tipo escolhido.
- 375px: cada opção mede 91x62 px (acima de 44), chips e botão "Editar tipo" têm 44 px de altura, `scrollWidth` = 375 (sem rolagem horizontal), inclusive com o erro aberto.

### 2. Lista
- Colunas: Placa, Tipo, Veículo/Modelo, Cor, Unidade, Vaga, Morador responsável, Ações.
- Chips Todos | Carro | Moto | Outro (N), com `aria-pressed`, 44 px. Filtro Moto + busca "STG3" combinam (1 linha). Filtro Outro mostra só Outro.
- Vazio com filtro de tipo: "Nenhum veículo deste tipo encontrado."; busca sem resultado no filtro Todos: "Nenhum veículo encontrado correspondente à pesquisa.".
- Impressão (conferido no CSS/DOM, `@media print { .no-print { display:none } }`): chips, faixa, busca e coluna Ações têm `no-print`; a coluna Tipo não, então sai impressa.

### 3. Faixa "N veículos estão como Outro..."
- Aparece para Síndico, Subsíndico e ADM quando há veículo Outro. Não aparece para Morador, Inquilino, Portaria nem Conselho.
- "Ver veículos Outro" ativa o filtro Outro (1 linha). Fechar grava `harmony:faixa-tipo-outro-fechada` no localStorage e, após recarregar, a faixa não volta. Some sozinha quando não há mais Outro.

### 4. Edição pela equipe
- Botão "Editar tipo" (texto visível também em 375px), com `aria-label` "Editar tipo do veículo PLACA". Modal com `aria-labelledby`, tipo atual já marcado.
- Salvar: "Tipo do veículo atualizado."; foco volta ao botão que abriu o modal. Esc fecha sem salvar e devolve o foco ao botão.
- Relatórios > Trilha de Auditoria: "Alterou o tipo de um veículo da unidade 102 (Bloco A) de Carro para Moto." (frase legível, sem placa).

### 5. Morador
- Morador vê "Editar tipo" apenas nos veículos da própria unidade (a lista dele só traz a própria unidade) e salva com sucesso (persistiu após recarregar).
- Pela API autenticada como `morador@staging.test` (login com a conta de teste, fora do navegador, via script):
  - Tipo CARRO/MOTO no próprio veículo: 1 linha atualizada.
  - Placa, vaga, marca, modelo, unit_id e status: recusado (42501 "Morador só pode alterar o tipo do veículo da própria unidade."). Tipo + placa juntos: recusado.
  - BICICLETA, "carro" minúsculo e vazio: recusado (23514, constraint `vehicles_tipo_veiculo_check`). Nulo: recusado (23502).
  - Veículo de OUTRA unidade, tipo ou placa: 0 linhas, estado intacto.
  - ADM com tipo inválido: recusado pela constraint. Insert como morador com tipo TRATOR: recusado; sem tipo informado o banco usa OUTRO (padrão); Portaria insere visitante com MOTO e é recusada com tipo inválido.
  - Portaria e Conselho atualizando tipo: 0 linhas.

### 6. Portaria
- Busca de placa (celular): cada resultado mostra a placa e, ao lado, o selo com ícone e texto (Moto/Carro/Outro), fonte 12 px negrito, texto escuro sobre fundo claro (contraste alto). Sem botão de editar. Em /veiculos: sem faixa e sem "Editar tipo".

### 7. Inquilino e Conselho (relato)
- Inquilino (unidade 102): vê só os veículos da própria unidade e vê "Editar tipo" nesses veículos; pela API consegue mudar o tipo do próprio (1 linha). Não vê a faixa. (Na prática o inquilino tem o papel Morador.)
- Conselho: vê todos os veículos com o selo de tipo, sem faixa, sem "Editar tipo"; atualização por API = 0 linhas. Em Relatórios vê a contagem por tipo (2 + 3 + 1 = 6).
- Observação L5 (já existia, fora desta tarefa): Conselho vê o botão "Cadastrar Veículo", mas o banco recusa o insert (42501).
- A conta `dono@staging.test` não existe como login (senha 123456 recusada); só aparece como proprietário na planilha. Não testada.

### 8. Autocadastro público (/cadastro, deslogado, 375px)
- Cada veículo traz o seletor sem marcação. Enviar sem tipo: foco no primeiro rádio; com só o veículo 1 marcado, aparece "Escolha o tipo do veículo 2." e o foco vai ao rádio do veículo 2.
- Ids únicos por veículo (`ac-v-tipo-0-carro`, `ac-v-tipo-1-moto`...), sem duplicados; `name` diferente por veículo.
- Servidor (curl direto): tipo BICICLETA, "carro", nulo e ausente = 400 "Escolha o tipo do veículo 1.".
- Painel provisório: "QAA1A11 · Moto · Biz" e "QAA2B22 · Carro · Onix". "Corrigir" mantém os tipos marcados e salvar atualiza (Moto para Outro).
- Painel do síndico (/autocadastro): mostra "PLACA · Moto · Biz". Simulei envio antigo removendo o tipo do segundo veículo pelo banco: aparece "QAA2B22 · Tipo não informado · Onix".
- Validar: 1º veículo nasce MOTO (tipo escolhido), 2º (sem tipo) nasce OUTRO. Conferido em `vehicles`.

### 9. Excel
- Exportado pelo botão "Exportar Excel" em /moradores, como ADM (o Síndico tem a mesma permissão e os mesmos dados). Arquivo de 5166 bytes, tipo xlsx; lido por dentro (zip, `workbook.xml`, planilhas e textos): abas "Moradores" e "Veículos", sem erro de estrutura.
- Aba Veículos: Bloco, Apto, Placa, Marca, Modelo, Cor, Vaga, Responsável, Telefone, **Vínculo**, **Tipo de veículo**, Situação. Valores: Vínculo = Morador; Tipo de veículo = Carro/Moto/Outro conforme a base. A aba Moradores também usa "Vínculo" (Titular/Dependente...).
- Limite: não abri o arquivo no Excel/Numbers de fato; a verificação foi pelo conteúdo do arquivo.

### 10. Relatórios (ADM)
- 5 veículos ativos: Carros 1, Motos 3, Outros 1 (soma 5). Conselho, com 6: 2 + 3 + 1.

### 11. Regressão e acessibilidade
- Rede: nenhuma resposta 5xx; as chamadas a `/api/autocadastro/*` (GET/POST/PATCH publico, meu, decidir) deram 200.
- Console: nenhum erro novo atribuível ao recurso. O buffer do navegador traz 2 pares "406 / Perfil não encontrado (PGRST116)", que não consegui ligar a nenhum passo meu (podem ser de uma sessão anterior a este teste, da aba reaproveitada após o seed); não reproduzi. Vale uma olhada do developer (L4).
- Foco visível nos rádios (`peer-focus-visible`: borda e anel), seleção marcada por cor, ícone de check e estado do rádio (não só cor); selo sempre com texto.
- Selo "Moto": 12 px, bold, cor escura sobre fundo claro (contraste bom).

## Observações (todas leves)
- **L1.** O erro "Escolha o tipo do veículo." fica ligado ao grupo por `aria-describedby`, mas nenhum rádio nem o fieldset recebe `aria-invalid`. Passos: abrir Cadastrar Veículo, enviar sem tipo, inspecionar. Impacto: leitor de tela não anuncia "inválido".
- **L2.** Com o filtro "Outro" ativo, ao salvar a edição de um veículo Outro para outro tipo a linha sai da lista filtrada, o botão deixa de existir e o foco cai no `body` (perde a posição para quem usa teclado). Passos: síndico, "Ver veículos Outro", Editar tipo, trocar para Moto, Salvar.
- **L3.** No modal "Tipo do veículo" o botão X de fechar mede 28 px de altura (abaixo dos 44 px pedidos para alvos de toque); Cancelar/Salvar têm 38 px. Confira em 375px.
- **L4.** Itens de console citados em 11.
- **L5.** Conselho vê "Cadastrar Veículo" mas o banco recusa (pré-existente).

## Não testado
- Abrir o .xlsx no Excel/Numbers (só leitura do conteúdo do arquivo).
- Impressão real (diálogo/PDF): conferido apenas pelo CSS e DOM.
- `dono@staging.test` (sem login válido) e Morador provisório bloqueado, Visitante deslogado atualizando veículo (a policy restritiva não foi exercitada neste roteiro além do envio público).
- Os chamados de API foram feitos por script Node autenticando com as contas de teste (não pelo token do navegador). Resultado equivalente para RLS e gatilhos.
- Contraste medido só no selo da Portaria; demais contrastes não calculados.

## Dados de teste deixados no staging
Veículos `QAT1A11`, `QAT2B22`, `QAA1A11`, `QAA2B22`; usuário/unidade B101 do autocadastro `qa-auto@staging.test` (validado); tipos de `STG1A01`, `STG2B02` e `STG3C03` alterados; linhas de auditoria. Rode `node scripts/seed-staging.mjs` para recriar a base.
