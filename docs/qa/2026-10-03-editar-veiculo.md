# QA: Morador edita placa, marca, modelo, cor e tipo do veículo (issue #46)

Data: 2026-10-03. Ambiente: staging (app local em localhost:3000, base `yusmuzifhhlowuqtcnid`), código ainda sem commit, migração 0031 já aplicada. Contas `@staging.test`. Desktop 1280x800 e celular 375x812. Regra final do dono: placa única no condomínio ("Esta placa já está cadastrada."), sem aviso, selo ou notificação de placa repetida.

## Resumo
- 8 casos PASSARAM, 2 PASSARAM COM RESSALVAS (casos 1 e 10), 1 não testado por completo (caso 7).
- **2 bugs**: B1 (cadastro de visitante pela Portaria não funciona, bloqueia) e B2 (hífen na placa consome um caractere do limite, leve/média).
- Por API: 60 verificações, todas conforme o esperado (a única "falha" do script foi a tentativa de criar um veículo antigo fora do padrão, que o próprio gatilho recusa; ver caso 7).
- O seed da base mostra 6 veículos (5 ATIVOS + 1 VISITANTE), não 7.

## Casos

| # | Caso | Resultado |
|---|------|-----------|
| 1 | Morador no celular: botão, modal, edição, persistência, foco | PASSOU (com B2) |
| 2 | Validação, erro de rede, Esc, Cancelar, "Salvando...", 44px | PASSOU |
| 3 | Placa duplicada (morador e equipe, cadastro e edição) | PASSOU |
| 4 | Cadastro novo pelo morador, campos adulterados | PASSOU |
| 5 | Segurança por API | PASSOU |
| 6 | Equipe edita tudo; apartamento e bloco fora da edição | PASSOU |
| 7 | Veículo antigo com placa fora do padrão | NÃO TESTADO (ver abaixo) |
| 8 | Histórico em Relatórios | PASSOU |
| 9 | Faixa "Outro", botão, filtro, foco, Portaria e Conselho | PASSOU |
| 10 | Regressão | PASSOU COM RESSALVA (B1) |

### 1. Morador (375px)
- Veículos da unidade 101 têm "Editar veículo" com texto visível, 44 px de altura e 129 px de largura; o veículo do visitante não tem botão. `scrollWidth` = 375 (sem rolagem horizontal).
- Modal "Editar veículo", subtítulo "Unidade A-101", campos: Placa, Tipo (Carro/Moto/Outro, 62 px cada), Marca, Modelo, Cor. Não há vaga, status, proprietário, telefone, apartamento nem bloco. Linha de apoio: "O veículo fica na sua unidade. Vaga e situação são definidas pelo síndico."
- Digitando `qat1b23` em minúsculas a placa vira `QAT1B23`; marca, modelo, cor e tipo alterados. Salvar: "Veículo atualizado." (role status), modal fecha, o cartão de feedback recebe o foco, a lista mostra o novo valor e ele persiste após recarregar.
- **B2** (ver abaixo): digitar ou colar placa com hífen.

### 2. Validação
- Placa "AB12" + Tab: "Placa inválida. Use o formato ABC1234 ou ABC1D23." no blur, com `aria-invalid="true"`, `aria-describedby="veiculo-placa-apoio veiculo-placa-erro"` e `role="alert"`.
- Enviar com marca só com espaços e modelo vazio: "Informe a marca do veículo." e "Informe o modelo do veículo."; foco no primeiro campo inválido (placa); o modal não fecha; `aria-invalid` e `aria-describedby` nos campos.
- Tipo obrigatório: no cadastro novo os três rádios começam sem marcação e o envio mostra "Escolha o tipo do veículo." (testado como Síndico).
- Falha de rede simulada (fetch rejeitado): faixa vermelha dentro do modal "Não foi possível salvar. Verifique a conexão e tente de novo.", modal aberto e dados mantidos.
- Durante o salvamento: botão "Salvando..." (`aria-busy`, desabilitado), Cancelar e X desabilitados, Esc não fecha. Depois: Esc e Cancelar fecham o modal sem salvar.
- Alvos: botões Cancelar, Salvar e X com 44 px; campos `min-h-11`.

### 3. Placa duplicada
- Morador, edição para `stg2b02` (minúscula, outra unidade): "Esta placa já está cadastrada." no campo (aria-invalid, role alert), na faixa do modal, foco na placa, cor digitada mantida. Voltar à própria placa e salvar funciona.
- Morador, cadastro novo com `stg4d04` (outra unidade): mesma mensagem, dados mantidos; depois com placa nova cria normalmente.
- Equipe (Síndico), edição para `abc1d23` quando ABC1D23 existe: mesma mensagem e comportamento; Síndico, cadastro novo com `abc1d23`: idem, mantendo marca, modelo, apartamento e proprietário digitados.
- Por API: Síndico, Subsíndico e ADM recebem 23505 ao duplicar; mesma placa no próprio veículo é aceita.
- Nenhum texto com "repetid" em Veículos, Relatórios ou Portaria; nenhuma notificação "Placa repetida" no banco (0 linhas).

### 4. Cadastro novo pelo morador
- Veículo criado na unidade A-101, vaga "—", status ATIVO. Por API, com `vaga='HACK'`, `status='VISITANTE'`, `bloco='B'`, `unidade='999'`: o banco grava vaga vazia, ATIVO, bloco A e unidade 101 (ignora). Com `unit_id` de outra unidade: recusado por RLS (42501).

### 5. Segurança por API (conta de teste, script Node)
- Morador, próprio veículo: marca/modelo/cor/tipo/placa (minúscula normaliza para maiúscula) OK. Placas inválidas (`ABC`, `ABC-1234`, `AB1C234`, `1234ABC`, `ABCD123`, `ABC12345`, vazia, só espaços, com espaço, com acento): recusadas (23514 com a mensagem em português).
- Vaga, status, proprietário, telefone, unidade, bloco, unit_id, id e created_at: recusados (42501), inclusive junto com campo permitido.
- Veículo de outra unidade (marca, placa ou tipo): 0 linhas. Inquilino (102) editando veículo da 101: 0 linhas. Veículo VISITANTE: recusado (42501 "Morador não pode alterar veículo de visitante."). Morador não apaga veículo de outra unidade (0 linhas) e só enxerga os da própria unidade.
- Portaria e Conselho: 0 linhas ao editar. Conselho não consegue inserir (42501). Visitante sem login: 0 linhas ao editar e não lê veículos.
- Equipe (Síndico, Subsíndico, ADM): editam vaga, status, proprietário, telefone, cor e placa de qualquer veículo, inclusive o de visitante; placa inválida e duplicada recusadas.
- Portaria cadastra visitante por API: placa normalizada, VISITANTE e vaga preservados.

### 6. Equipe
- No modal de edição do Síndico (unidade A-102): Placa, Tipo, Marca, Modelo, Cor, Vaga de garagem, Status, Proprietário / Motorista, Telefone de contato; **sem** Apartamento nem Bloco, e sem a linha de apoio do morador. Subsíndico e ADM: mesma regra de tela (mesmo `isAdmin`) e edição completa confirmada por API.
- Cadastro novo da equipe mostra também Apartamento e Bloco; enviar vazio mostra os seis erros em português e foca a placa.

### 7. Veículo antigo com placa fora do padrão: NÃO TESTADO
- Não consegui criar o veículo: o gatilho valida também o INSERT (mesmo com service role), e não há acesso direto ao SQL (sem `psql`/`pg`) para desligá-lo. Por isso não foi possível confirmar na tela o aviso âmbar "Esta placa está fora do padrão..." nem a correção de cor/modelo sem tocar na placa.
- Só leitura do código: a tela só cobra a placa se ela mudou, e o gatilho `vehicles_placa_normalizar` retorna cedo quando `placa` não muda (UPDATE). Falta a prova em dados reais (sugestão: criar o caso com SQL no staging).

### 8. Histórico (Relatórios > Trilha de Auditoria)
- Frases legíveis e sem placa: "Alterou um veículo da unidade 101 (Bloco A): placa.", "...: cor.", "...: placa, marca, modelo, cor e tipo.", "...: placa, cor, vaga, situação, proprietário e telefone.". Troca só do tipo mantém a frase da 0030 ("Alterou o tipo de um veículo da unidade 102 (Bloco A) de Outro para Carro.").
- Detalhes técnicos mostram o de-para (`alteracoes`, com placa antiga e nova); proprietário e telefone aparecem só em `camposAlteradosSemValor`.

### 9. Lista
- Faixa (só Síndico): `1 veículo está como "Outro". Se for carro ou moto, toque em "Editar veículo" e corrija o tipo.` com o link "Ver veículos "Outro"". Não aparece para Portaria, Conselho nem Morador. Filtros Todos/Carro/Moto/Outro (n) com `aria-pressed`.
- Com o filtro "Outro" ativo, editar o tipo para Carro: a linha some ("Nenhum veículo deste tipo encontrado."), a faixa some e o foco vai para o cartão de feedback ("Veículo atualizado.").
- Botão "Editar veículo" da lista sempre com texto, 44 px.
- Portaria e Conselho: 0 botões de editar e 0 de remover; Portaria vê o selo do tipo na lista e na busca da página inicial (ex.: STG3C03 com selo "Moto").

### 10. Regressão
- Autocadastro público por API: placa inválida recusada (400 "Placa inválida: "qa". Use o formato..."); veículo sem tipo recusado (400 "Escolha o tipo do veículo 1."). Envio com uma placa que já existe e uma nova: aceito; na validação pelo Síndico a placa existente é ignorada e a mensagem informa "Veículo(s) não cadastrado(s) por já existir(em) ou erro: STG3C03."; o veículo novo é criado com o tipo informado (Moto), vaga "A definir" e ATIVO. Dados de teste removidos. A interface pública `/cadastro` não foi reexecutada na tela.
- Exportação Excel (Moradores): aba "Veículos" com as colunas "Vínculo" (Morador/Visitante) e "Tipo de veículo" (Carro/Moto) e as placas atuais.
- Console e rede: sem 5xx. Erros no console são os esperados dos testes (409 de placa duplicada, falhas de rede simuladas), mais dois "Perfil não encontrado" (406) na troca de usuário (login/logout) que parecem anteriores a esta mudança.
- **Cadastro de visitante pela Portaria: FALHOU (B1).**

## Bugs

### B1. Portaria (e Conselho) não consegue cadastrar veículo: o formulário não mostra os campos obrigatórios (bloqueia)
Severidade: **bloqueia** (regressão: antes dessa mudança a Portaria cadastrava visitante pela tela).
Passos: entrar como `portaria@staging.test` > Veículos & Garagem > "Cadastrar Veículo". O formulário mostra só Placa, Tipo, Marca, Modelo e Cor. Preencha tudo, escolha o tipo e clique "Salvar veículo".
Esperado: formulário com Apartamento, Bloco, Vaga, Status e Proprietário/Motorista (como antes) e cadastro do visitante.
Obtido: nada acontece (sem mensagem, sem erro na tela, modal continua aberto, foco vai para o tipo).
Causa provável (`src/app/veiculos/page.tsx`): os campos de vaga, status, apartamento, bloco, proprietário e telefone ficam dentro de `{ehEquipe && ...}` (`isAdmin`, que não inclui Portaria), mas a validação usa `novoDaEquipe = !editando && role !== 'MORADOR'`, que é verdadeiro para a Portaria. Resultado: exige "Informe o apartamento." e "Informe o proprietário ou motorista." em campos que não existem, e o `focus()` em `veiculo-apto` não encontra elemento. O mesmo vale para o Conselho, que vê o botão "Cadastrar Veículo" (o banco recusa o INSERT do Conselho, 42501). O banco aceita o cadastro da Portaria por API; o problema é só da tela.

### B2. Hífen na placa consome um caractere do limite (leve/média)
Passos: em Editar/Cadastrar veículo, digitar `abc-1234` ou colar `ABC-1D23` no campo Placa.
Esperado: placa normalizada `ABC1234` / `ABC1D23` (a linha de teste pedia essa normalização).
Obtido: `ABC123` / `ABC1D2`; a placa fica inválida e o usuário vê "Placa inválida...".
Causa provável: `maxLength={TAMANHO_PLACA}` (7) no `<input>` corta o texto cru antes de `normalizarPlacaDigitada` remover o hífen. Sugestão: tirar o `maxLength` do atributo (a função já corta em 7) ou usar um limite maior (ex.: 10). Contorno: digitar sem hífen.

## Observações leves (não são falhas desta entrega)
- O banco aceita marca e modelo vazios (só a tela exige). O morador pode apagar o veículo de visitante da própria unidade (botão "Remover" aparece; comportamento anterior, fora do escopo).
- A mensagem "Esta placa já está cadastrada." confirma ao morador que a placa existe em algum lugar do condomínio (inerente à regra de placa única decidida pelo dono).
- O contador "Veículos ativos no pátio" do painel conta o veículo de visitante.

## Não testado
- Caso 7 (placa antiga fora do padrão): ver acima.
- Interface pública `/cadastro` na tela (só a API).
- Retorno do foco ao botão de origem depois de Esc/salvar: os modais foram abertos por script (`click()` programático, sem foco no botão), então o foco voltou ao `body`; falta repetir com Tab/Enter reais.
- UI do Subsíndico e da ADM no navegador (coberta por API e pelo mesmo `isAdmin` do Síndico).
- Zoom/leitor de tela real; impressão.

## Dados de teste
O staging ficou com dados criados e alterados nesta rodada (veículos com placas `QAT...`, `ABC1D23` e vários veículos do seed editados). Rodar `node scripts/seed-staging.mjs` recria a base. Nenhuma credencial, e-mail real ou dado de morador real foi usado ou gravado aqui.

## Reteste (B1 e B2) — 2026-10-03

Ambiente: staging, app local em localhost:3000, correções do developer em `src/app/veiculos/page.tsx` ainda sem commit, migração 0031 aplicada. Contas `@staging.test`. Desktop 1280x800 e celular 375x812. Os formulários foram acionados por script (clique programático e `execCommand('insertText')` para simular colar); a digitação real (teclado) foi usada para os casos de hífen e espaço da placa.

| # | Caso | Resultado |
|---|------|-----------|
| 1 | B1 Portaria: modal completo, erros, cadastro, placa duplicada e inválida | PASSOU |
| 2 | B1 Conselho: sem "Cadastrar Veículo" nem "Editar veículo", lista com tipo | PASSOU |
| 3 | B1 Síndico, Subsíndico, ADM, Morador e Inquilino | PASSOU |
| 4 | B2 normalização e limite da placa; mensagens de placa inválida e duplicada | PASSOU |
| 5 | Regressão (edição do morador, histórico, faixa "Outro", filtro, console) | PASSOU |

### 1. Portaria
- "Cadastrar Veículo" abre o modal com Placa, Tipo, Marca, Modelo, Cor, Vaga de garagem, Status, Apartamento, Bloco, Proprietário / Motorista e Telefone de contato (13 rótulos), em 1280 e em 375 px (sem rolagem horizontal).
- Enviar vazio: seis erros visíveis (placa, tipo, marca, modelo, apartamento, proprietário), `aria-invalid` nos campos de texto e foco na placa. Nada silencioso.
- Visitante completo (vaga, status Visitante, apto, bloco, proprietário, telefone): "Veículo cadastrado.", modal fecha, foco no cartão de resultado, a linha aparece na lista com os dados digitados. Repetido em 375 px.
- Placa `AB12`: "Placa inválida. Use o formato ABC1234 ou ABC1D23." e foco na placa. Placa já existente: "Esta placa já está cadastrada." (no campo e na faixa do modal), foco na placa, dados mantidos. Igual em 375 px.
- Ações na linha: a Portaria vê 0 botões (nem "Editar veículo" nem "Remover"). O banco confirma o que a tela mostra para edição: a policy `vehicles_update_admin` é só para Síndico, Subsíndico e ADM. **Remover**: a policy `vehicles_delete` (0023) PERMITE o DELETE da Portaria, mas a tela não oferece o botão (a regra `podeRemover` já era assim antes desta mudança). Divergência tela x banco, sem risco novo: decisão de produto se a Portaria deve poder remover veículo.

### 2. Conselho
- Desktop e 375 px: sem "Cadastrar Veículo", 0 botões nas linhas, sem faixa "Outro", lista completa com o tipo de cada veículo; filtros Todos/Moto/Outro funcionam (aria-pressed, contagens corretas).

### 3. Demais perfis
- **Síndico (desktop e 375 px), Subsíndico (desktop), ADM (375 px)**: cadastro com todos os campos (13 rótulos, apto e bloco obrigatórios), "Veículo cadastrado."; edição com 11 rótulos (Placa, Tipo, Marca, Modelo, Cor, Vaga, Status, Proprietário, Telefone; **sem** Apartamento e Bloco), subtítulo "Unidade X-NNN", edição de placa, cor, vaga, status e proprietário salva e reflete na lista; mudar "Outro" para Carro (Subsíndico) funciona. Enviar vazio mostra 6 erros e foca a placa.
- **Morador (desktop e 375 px)**: modal só com Placa, Tipo, Marca, Modelo e Cor, mais a linha "O veículo fica na sua unidade..."; enviar vazio mostra 4 erros e foca a placa; cadastro cria na unidade A-101 com vaga "—"; edita placa, modelo, cor e tipo dos veículos da unidade; não tem botão "Editar veículo" no veículo de visitante; placa duplicada na edição é recusada com a mensagem correta.
- **Inquilino (375 px)**: vê só os veículos da unidade 102; cadastra e edita (placa, tipo, cor) com o mesmo formulário do morador. Desktop do inquilino não repetido (mesmo componente do morador).
- Nenhum perfil recebeu erro silencioso nem erro de campo que não existe na tela.

### 4. B2 (placa)
- Digitação real: `abc-1234` vira `ABC1234`; `ab c1d23` vira `ABC1D23`. Colagem simulada: `abc-1234`, `ABC-1D23`, `abc 1234`, `ab c1d23` viram `ABC1234`, `ABC1D23`, `ABC1234`, `ABC1D23`; `abc-1234-99` e `  a-b-c 1 2 3 4 5 6` cortam em 7 alfanuméricos (`ABC1234`). Sem atributo `maxlength` no campo (a normalização corta em 7).
- Em 375 px (Morador) `mob-1d23` digitado vira `MOB1D23` e salva. Placa curta (`MO9Z9`) dá "Placa inválida. Use o formato ABC1234 ou ABC1D23." com foco na placa; duplicada dá "Esta placa já está cadastrada.".

### 5. Regressão
- Morador edita placa, cor e tipo: persiste e a lista atualiza. Faixa "Outro" aparece só para Síndico e Subsíndico (não para Morador, Portaria nem Conselho); o Morador vê o filtro "Outro (0)".
- Relatórios > Trilha de Auditoria: frases como "Alterou um veículo da unidade 101 (Bloco A): placa, cor e tipo.", "...: cor e vaga.", "...: placa, cor, vaga, situação e proprietário."; nenhuma placa na frase. Edição em que a placa é digitada com hífen mas fica igual não registra "placa" como alterada.
- Console: sem erros novos. Os 409 (placa duplicada) são os testes de duplicidade; o buffer ainda guarda erros de compilação e de rede de rodadas anteriores. Sem 5xx.

### Bugs novos
Nenhum.

### Não testado
- Caso 7 (veículo antigo com placa fora do padrão) segue sem prova em dados reais.
- Retorno do foco ao botão de origem com Tab/Enter reais; Esc e "Salvando..." não foram repetidos nesta rodada (já cobertos na primeira).
- Inquilino no desktop; Subsíndico e ADM no outro tamanho de tela; leitor de tela; impressão.
- Os 7 veículos do seed: a Portaria, o Conselho e o Síndico viram 6 linhas do seed (+ criados nesta rodada), como na primeira rodada (o seed tem 6 veículos).

### Dados de teste
O staging ficou com veículos criados e editados (placas `QRT...`, `SDC...`, `SDM...`, `ADM...`, `SUB...`, `MOB...`, `INQ...`, `ABC1D23` e veículos do seed alterados). `node scripts/seed-staging.mjs` recria a base.
