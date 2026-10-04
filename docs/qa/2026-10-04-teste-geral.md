# QA: Teste geral de regressão, todos os perfis (staging)

Data: 2026-10-04 · Ambiente: staging (app local em localhost:3000, projeto de staging) · Contas `@staging.test` · Sem dados reais.
Código testado: working tree do `develop` com HEAD local `483eb99` (o pedido citava `c18b099`; o repositório local não tem esse commit, então confirme se o `main` de produção é o mesmo código). Migrações até 0034 aplicadas.
Desktop 1280x800 (todos os perfis) e celular 375x812 (Morador e Portaria). Dev server (modo desenvolvimento): tempos e CSP não representam produção.

## Resultado geral
- **0 bugs que bloqueiam, 0 graves, 19 leves** (lista na seção 5), mais observações de UX (seção 6).
- Segurança por API: **nenhuma falha**. Nenhuma escalada de papel, nenhuma leitura ou escrita indevida em `units`, `profiles`, `vehicles`, `fines`, `reservations`, `spaces`, `notices`, `audit_logs`, `notifications`, `autocadastros`, `pending_invites`, `documents`, `zelador`, `portal_administradora`. Chave de serviço não aparece no navegador.
- Bateria `node scripts/qa/bateria.mjs`: **411 checks, TUDO OK** (igual ao esperado). Seed `node scripts/seed-staging.mjs` rodado ao final: staging recriado e limpo.
- Casos executados por mim: cerca de 330 (matriz de acesso 7 perfis + provisório + visitante, RLS/RPC por API, fluxos de tela, validações, mobile), fora os 411 da bateria.

## 1. Matriz de acesso (esperado = roles.ts, Sidebar.tsx e regras do banco; observado = tela e URL direta)

Legenda: V = vê e usa; L = só leitura; X = bloqueado (tela "Área restrita"/"Acesso restrito"/"Disponível após a validação"); — = não existe para o perfil. Em todas as células o **observado igual ao esperado**.

| Tela | Síndico | Subsíndico | ADM | Conselho | Portaria | Morador / Inquilino | Provisório | Visitante (sem login) |
|---|---|---|---|---|---|---|---|---|
| Início | V (cartões e aprovação de reservas) | V | V | L (auditoria) | V (busca de placa, sem multas) | V só da unidade | V (só "Meu cadastro") | redireciona ao login |
| Mural | V (publica/exclui com confirmação) | V | V | L | L | L | L | login |
| Unidades/Moradores | V (CRUD, exportar Excel) | V | V | L (imprimir, sem Excel, sem Nova Unidade) | L (imprimir) | "Lista de Unidades" (diretório: bloco, número, responsável, situação) | diretório | login |
| Veículos | V (cadastro, edição, faixa "Outro") | V | V | L (sem Cadastrar, sem Editar, sem faixa "Outro") | V cadastra, não edita | V cadastra e edita a própria unidade (visitante não edita) | X | login |
| Multas | V (emite, anula, julga) | V (anula, julga; sem Apagar) | V (anula e **apaga**) | L | X (tela de sigilo; URL de multa real = "não encontrada") | V só as da própria unidade (ciência, recurso) | X | login |
| Reservas | V (aprova/recusa, espaços) | V | V | L + "Solicitar" em nome de morador, sem aprovar | L + "Solicitar" em nome de morador, sem aprovar | V só as da própria unidade; vê só "Indisponível" nas de outros | X | login |
| Links/Documentos | V (CRUD) | V | V | L | L | L | L | login |
| Relatórios/Auditoria | V | V | V | V (leitura, exporta CSV) | X | X | X | login |
| Usuários/Convites | V | V | V | X | X | X | X | login |
| Autocadastro | V | V | V | X | X | X | X | login (`/cadastro` é público) |
| Rotas `/api/*` administrativas | OK | OK | OK | negado | negado | negado | negado | 307 para `/login` |
| `/cadastro`, `/login`, `/definir-senha` | redireciona ao Início se logado | idem | idem | idem | idem | idem | idem | V |

Matriz do banco (leitura, linhas visíveis no seed; escrita proibida devolve 403/0 linhas):

| Tabela | anon | Síndico/Sub/ADM | Conselho | Portaria | Morador | Provisório |
|---|---|---|---|---|---|---|
| units | 0 | todas | todas | todas | só a própria | 0 (diretório vem por RPC) |
| profiles | 0 | todos | só o próprio | só o próprio | só o próprio | só o próprio |
| vehicles | 0 | todos | todos | todos | só a própria unidade | 0 |
| fines | 0 | todas | todas | **0** | só a própria unidade | 0 |
| reservations | 0 | todas | todas | todas | só a própria unidade | 0 |
| audit_logs | 0 | leitura | leitura | 0 | 0 | 0 |
| notifications | 0 | todas | 0 | 0 | só as da unidade | 0 |
| autocadastros / pending_invites | 0 | todos | 0 | 0 | 0 | só o próprio cadastro / 0 |
| RPC `diretorio_unidades`, `disponibilidade_reservas` | negado | 200 | 200 | 200 | 200 (só espaço, dia, ocupado) | 200 (vazio) |

Escrita testada por API com o token de cada perfil (58 casos): criar unidade, aviso, espaço, documento, multa, convite, autocadastro, perfil com papel SINDICO, alterar o próprio papel, alterar perfil de outro, forjar `audit_logs` e `notifications`, aprovar reserva, reservar em nome de outra unidade, editar veículo de outra unidade ou de visitante, zerar valor e deferir o próprio recurso (morador), apagar multa (Conselho, Portaria, Síndico, Subsíndico e Morador não apagam). **Todos negados como esperado.**

## 2. PASSOU/FALHOU por perfil e módulo

| Módulo | Síndico | Subsíndico | ADM | Conselho | Portaria | Morador | Inquilino | Provisório | Visitante |
|---|---|---|---|---|---|---|---|---|---|
| Menu e rotas (URL direta) | PASSOU | PASSOU | PASSOU | PASSOU | PASSOU | PASSOU | PASSOU | PASSOU | PASSOU |
| Início/contadores | PASSOU | PASSOU | não repetido (mesmas regras) | PASSOU | PASSOU | PASSOU (leve L12) | PASSOU | PASSOU | n/a |
| Unidades e moradores | PASSOU (L2, L18) | idem | — | PASSOU (leitura) | PASSOU (leitura) | PASSOU (diretório) | PASSOU | PASSOU | n/a |
| Veículos | PASSOU | — | — | PASSOU | PASSOU | PASSOU (L3, L14) | PASSOU | bloqueado OK | n/a |
| Multas | PASSOU (L1) | PASSOU | PASSOU (apagou) | PASSOU (leitura) | PASSOU (bloqueio) | PASSOU (L5) | PASSOU | bloqueado OK | n/a |
| Reservas | PASSOU (API; UI coberta no QA anterior) | — | — | PASSOU | PASSOU | PASSOU | PASSOU | bloqueado OK | n/a |
| Mural/Links | PASSOU (L11) | — | — | PASSOU | PASSOU | PASSOU | PASSOU | PASSOU | n/a |
| Relatórios/Auditoria | PASSOU | PASSOU | — | PASSOU | bloqueado OK | bloqueado OK | bloqueado OK | bloqueado OK | n/a |
| Usuários/Convites | PASSOU (L8, L9) | — | — | bloqueado OK | bloqueado OK | bloqueado OK | bloqueado OK | bloqueado OK | n/a |
| Autocadastro (painel) | PASSOU (L10, L15) | — | — | bloqueado OK | bloqueado OK | bloqueado OK | bloqueado OK | bloqueado OK | n/a |
| Autocadastro público | n/a | n/a | n/a | n/a | n/a | n/a | n/a | PASSOU | PASSOU |
| Notificações (sino) | PASSOU (L6) | PASSOU | — | PASSOU | PASSOU | PASSOU | PASSOU | n/a | n/a |
| Segurança por API | PASSOU | PASSOU | PASSOU | PASSOU | PASSOU | PASSOU | PASSOU | PASSOU | PASSOU |
| Celular 375px (sem rolagem horizontal) | — | — | — | — | PASSOU | PASSOU | — | — | login PASSOU |

"—" = não percorrido neste perfil (ver seção 7).

## 3. Casos executados com detalhe

### 3.1 Início por perfil
- Síndico/Subsíndico: Unidades 6, Veículos 6→7, Notificações e recursos em análise corretos após os testes de multa, Reservas 5 com 1 aguardando e card de aprovação com Aprovar/Recusar.
- Conselho: mesmos números, sem card de aprovação. Portaria: busca de placa funciona ("stg2b" devolve unidade, morador, telefone, placa); **nenhum dado de multa**. Morador/Inquilino: só a própria unidade; faixa "Você tem 2 multas aguardando ciência" correta. Sem estouro no celular (scrollWidth = 375 em todas as telas medidas).

### 3.2 Unidades e moradores (Síndico)
- Número duplicado (101-A): barrado, mas a mensagem aparece atrás do modal (L2).
- Unidade A-105 com e-mail de conta existente (Subsíndico): modal "Este e-mail já tem conta: Subsíndico Teste (Subsíndico). Vincular...?", vinculou sem criar convite. **PASSOU.**
- Excluir A-105: diálogo explica que conta da equipe só sai da unidade; depois da exclusão a conta do Subsíndico seguiu existindo. **PASSOU.**
- Editar unidade com novo e-mail: cria convite pendente. Remover dependente: pede confirmação. Exportar Excel: baixou .xlsx (5,7 KB) sem erro; contém telefone, e-mail e CPF/RG (versão "sem dados sensíveis" segue como pendência conhecida). Botão de exportar só aparece para os três perfis administrativos.

### 3.3 Veículos
- Portaria: cadastro com placa vazia ("Placa inválida"), sem tipo ("Escolha o tipo do veículo."), placa duplicada em minúsculas (`stg1a01`, "Esta placa já está cadastrada."), `qa-z9x 88` normalizada para `QAZ9X88`, salvou como Outro. **PASSOU.** Portaria não vê "Editar" (banco: 0 linhas).
- Morador: cadastra e edita só veículos da própria unidade (visitante sem botão). Edição: placa curta barrada, placa de outra unidade barrada, mudança de cor e tipo salva e gera linha de auditoria legível sem placa ("Alterou um veículo da unidade 101 (Bloco A): cor e tipo."). Modal de edição do morador não mostra vaga, status nem telefone. **PASSOU.**
- Conselho: sem Cadastrar, sem Editar, sem faixa "Outro" (só o filtro "Outro (1)"). **PASSOU.**
- Por API: morador não cria em outra unidade, não edita a de outra, não altera `status` (mensagem do banco clara), Conselho e Inquilino sem permissão de criar. Observação: morador **consegue apagar** o próprio veículo (por API; a tela não oferece o botão).

### 3.4 Multas (fluxo completo)
Síndico emitiu 3 notificações (2 multas, 1 advertência); Morador (celular) registrou ciência (texto aprovado "Ao confirmar, você declara...") e recurso; Subsíndico negou o recurso (diálogo de confirmação, Esc cancela e foco volta), anulou a advertência com motivo (mínimo 10 caracteres, contador 0/10, "curto" barrado); ADM apagou a multa NOT-2026/001 com diálogo "Apagar esta multa de vez?" e Voltar devolve o foco ao botão. Subsíndico não vê "Apagar"; ADM vê "Anular" e "Apagar". Inquilino vê a advertência anulada com o motivo e "A multa foi anulada antes de o morador registrar a ciência." (ciência visível). Conselho lê, sem botões. Portaria: tela de sigilo e, em URL de multa real, "Notificação não encontrada". Relatórios: indicadores batem (ciência 33%, recursos julgados 0/1, quadro com "Anulada" riscada), trilha em frases legíveis, sem placa e sem UUID visível.
Falhas: **L1** (valor 0 e negativo), **L5** (recurso de 3 caracteres; só espaços bloqueia sem mensagem), **L12** (rótulos).

### 3.5 Reservas (regressão rápida, a tela foi coberta em profundidade no QA de hoje)
Por API com tokens: pedido no Salão vira PENDENTE; Churrasqueira confirma na hora (APROVADA); mesmo dia no mesmo espaço devolve 409 (23505), inclusive em outro horário; espaço em manutenção e data passada barrados pelo banco; Portaria registra PENDENTE em nome de morador; Síndico cria já APROVADA; morador não auto-aprova nem apaga. Privacidade: morador e inquilino só leem as reservas da própria unidade; a RPC devolve apenas `espaco_id`, `data`, `ocupado`. No celular, calendário abaixo dos cartões de espaço, sem rolagem horizontal. Falha leve **L7**.

### 3.6 Mural, Links, Relatórios
Mural: publicar com HTML e `<script>` no texto aparece como texto (escapado); excluir pede confirmação. Links: documento com URL `javascript:alert(1)` foi aceito, React bloqueia o clique (L11); excluir pede confirmação. Relatórios: abas Indicadores e Trilha; filtro por módulo existe; "Exportar CSV" e "Imprimir" presentes; impressão só conferida no CSS (ver seção 7).

### 3.7 Autocadastro e convites
- Formulário público (desktop): tipo do veículo obrigatório ("Escolha o tipo do veículo 1."), senha curta, senhas diferentes, falta do consentimento: todos com mensagem em português.
- API pública (17 casos): unidade inexistente, tipo inválido, e-mail inválido, e-mail já existente (mensagem genérica, não revela a conta), placa inválida, mais de 10 moradores, mais de 5 veículos, nome de 200 mil caracteres (truncado em 120), HTML no nome (guardado como texto, exibido escapado), 5 envios por minuto por IP e depois 429, formulário fechado (GET devolve `aberto:false` e lista vazia; POST 400 com aviso). **PASSOU.** Duas pessoas na mesma unidade, ou uma unidade já validada, geram status "Conflito" no painel (comportamento esperado).
- Provisório: login imediato, menu só com Início, Mural, Unidades, Links; Veículos, Multas e Reservas mostram "Disponível após a validação do seu cadastro" com link "Ver meu cadastro"; via API lê só o próprio perfil e cadastro, não cria veículo nem reserva e não se auto-valida (403).
- Validação pelo Síndico: validou o provisório; placa duplicada (STG1A01 já existia na A-101) foi ignorada com aviso "Veículo(s) não cadastrado(s) por já existir(em) ou erro: STG1A01."; perfil passou a `cadastro_validado=true` na unidade 103; auditoria "Validou o autocadastro de ...". Recusa: exige motivo (botão Recusar desabilitado sem texto), removeu a conta e registrou na auditoria. **PASSOU.**
- Convites: criar convite da equipe, perfis Síndico e Subsíndico marcados "já ocupado", link gerado aponta para `/definir-senha?token_hash=...&type=invite` (página do app), "Remover da fila" pede confirmação. Link de definir senha: comportamento do token (robôs, reuso) coberto pela bateria; a tela em si não foi percorrida (seção 7).

### 3.8 Segurança
- Cabeçalhos: CSP com `frame-ancestors 'none'`, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy; sem X-Powered-By. No dev a CSP libera `unsafe-inline` e `unsafe-eval` em scripts (confira a de produção).
- Bundles: 25 arquivos JS/CSS (6,5 MB) varridos; a chave de serviço, o nome da variável e a senha do banco **não aparecem**. As 4 ocorrências da palavra `service_role` são texto da biblioteca do Supabase. A chave pública tem `role: anon`.
- Todas as rotas `/api/*` protegidas sem sessão respondem 307 para `/login` (L20); sessão corrompida no cookie leva ao login.

### 3.9 Experiência transversal
- Logout pelo menu "Sair do Sistema" leva ao login; voltar do navegador não mostra conteúdo protegido. Recarregar nas telas testadas manteve a sessão e a tela.
- Console: sem erros inesperados; os únicos `console.error` foram dos meus testes de placa duplicada (409 esperado). Rede: nenhum 5xx; os 4xx foram os esperados (409 de duplicidade, 403 de RLS).
- Foco: Tab percorre cabeçalho, 7 itens do menu e depois a página, com contorno visível em links e botões (sem "pular para o conteúdo", L16).
- Contraste (cálculo por script, selos e textos de apoio): selos de status, Visitante, Outro, Aguardando/Confirmada passam 4,5:1; **subtítulos de página dão 4,43:1** (L19).
- Carregamento (dev, Turbopack): dados do Início prontos em cerca de 2,7 s após a navegação.

## 4. Observações de UX
1. O erro de "unidade duplicada" fica atrás do modal (L2); no celular o usuário não vê nada.
2. No Início do Morador, "Veículos ativos no pátio" conta os da unidade (inclusive visitante) e "Minhas multas" conta anuladas ("1 / Nenhuma pendente").
3. Tela de multa de **advertência anulada** diz "Multa anulada" e mostra o aviso sobre boleto, que não se aplica.
4. O selo do menu em Autocadastro (10) e os cartões da página (0 aguardando, 4 conflito) contam coisas diferentes e confundem.
5. Em Reservas, no celular o calendário fica depois de todos os cartões de espaço (rolar duas telas).
6. Lista de Unidades do morador mostra "QA Pub — Aguardando validação" ao lado de uma unidade já confirmada de outra pessoa (L10).
7. Botão do menu móvel sem `aria-expanded`; Tab passa por todo o menu antes do conteúdo.

## 5. Bugs (todos leves; nenhum bloqueia nem é grave)

| # | Sev. | Perfil / tela | Descrição e passos |
|---|---|---|---|
| L1 | leve | Síndico, Subsíndico, ADM · Multas | Emitir "Multa Financeira" aceita **valor 0** (UI: campo `type=number` sem `min`; vira NOT-2026/001 com R$ 0,00 e o Relatório a rotula "Advertência") e o banco aceita **valor negativo** (inserção por API com -50 deu 201). Passos: Emitir Notificação, tipo Multa, valor 0, salvar. Sugestão: `min=0.01` na UI e `CHECK (valor >= 0)` por tipo no banco. |
| L2 | leve | Síndico · Moradores | Cadastrar unidade com número já existente: a mensagem "Já existe uma unidade cadastrada com o número 101 no Bloco A." aparece na página **atrás do modal**; o modal fica aberto sem feedback. |
| L3 | leve | Morador, desktop 1280 · Veículos | Coluna AÇÕES cortada: tabela 978 px dentro de 928 px com rolagem interna escondida; o botão "Editar veículo" aparece truncado ("Edit / veíc"). |
| L4 | leve | Todos · 404 | Rota inexistente logado mostra a página padrão do Next (fundo preto, "This page could not be found.", em inglês, sem marca nem link de volta). Não existem `not-found.tsx`, `error.tsx` nem `loading.tsx`. |
| L5 | leve | Morador · recurso de multa | Recurso aceita texto de 3 caracteres ("abc") e foi registrado; texto só de espaços é bloqueado **sem mensagem**. |
| L6 | leve | Síndico/Subsíndico/ADM · sino | O sino acumula notificações endereçadas a moradores ("Sua reserva do Churrasqueira para 17/11/2026 está confirmada", "Notificação Disciplinar NOT-... unidade 101"): 14 "novas" no Síndico. Confirmar se é intencional; hoje é ruído e texto em segunda pessoa para a pessoa errada. Notificação de aviso excluído continua no sino. |
| L7 | leve | API · Reservas | O banco aceita reserva com horário final antes do inicial (18:00 a 09:00), convidados acima da capacidade (500 para 20) e horário fora do funcionamento do espaço. Só a tela valida. |
| L8 | leve | Síndico · Usuários | Convite da equipe com e-mail que já tem conta é aceito na fila e falha só ao gerar o link ("Erro ao gerar"); o motivo é um tooltip em inglês ("A user with this email address has already been registered"). Pendência já conhecida. |
| L9 | leve | Síndico · Usuários | O título "Equipe com acesso ativo (16)" lista moradores; e uma conta nova da equipe aparece como "ativa" assim que o link é gerado, antes de a pessoa definir a senha. Nome de 120 caracteres sem espaço estica a tabela (rolagem interna). |
| L10 | leve | Morador · Lista de Unidades | O formulário público permite a qualquer pessoa pôr um nome, "Aguardando validação", em **qualquer unidade**, inclusive já validada; esse nome aparece para todos os moradores até o síndico recusar. Limitado a 5 envios/min/IP. Considere mostrar pendentes só à equipe ou bloquear unidade com conta ativa. |
| L11 | leve | Síndico · Links | Campo de URL aceita `javascript:alert(1)`; o React neutraliza o clique (href vira erro) mas o item é salvo e fica quebrado. Validar `http(s)`. |
| L12 | leve | Morador/Síndico · textos | Advertência anulada é chamada "Multa anulada" e exibe "Anular não cancela boleto"; Início do morador conta anuladas em "Minhas multas". |
| L13 | leve | Síndico · Multas | Duplo clique veloz em "Formalizar Notificação" dispara **2 POST**; o segundo falha com 409 (protocolo repetido) e só o primeiro aparece como sucesso. A proteção real é a unicidade do protocolo, não a trava da tela. |
| L14 | leve | Morador · Veículos | Placa duplicada mostra a mesma mensagem duas vezes (no modal e na página). |
| L15 | leve | Síndico · Autocadastro | Selo do menu (10) diferente dos cartões (Aguardando 0, Conflito 4): contagens não batem. |
| L16 | leve | Todos · acessibilidade | Sem link "pular para o conteúdo" (7 Tabs de menu antes da página) e botão do menu móvel sem `aria-expanded`. |
| L17 | leve | Conselho, Síndico · Relatórios | "Exportar CSV" da auditoria grava o JSON bruto de `detalhes` (inclui `fineId`) e não neutraliza células que começam com `=`, `+`, `-`, `@`. Conferido no código, não executado no navegador. |
| L18 | leve | Síndico · Moradores | A ordem das unidades muda: a unidade nova ou editada vai para o topo e as demais ficam ordenadas. |
| L19 | leve | Todos · contraste | Subtítulo de página (cinza sobre branco) em 4,43:1, abaixo de 4,5:1. |
| L20 | leve | API sem login | Rotas `/api/*` protegidas devolvem 307 para `/login`; um cliente de API espera 401 em JSON. |

Fora do produto (ferramentas): o `seed-staging.mjs` imprime "7 veículos" mas cria 6.

## 6. Observações de segurança e privacidade (sem bug confirmado)
- Portaria e Conselho leem, por RLS, telefone, e-mail e lista de dependentes de **todas** as unidades (a tela da Portaria mostra e-mail e dependentes). Se o JSON de `moradores` tiver CPF/RG preenchido, também estaria acessível a eles; **não testado com CPF** porque o seed não tem. Vale uma decisão de produto/LGPD.
- Morador consegue apagar o próprio veículo por API (a tela não oferece); confirme se a regra é intencional.
- Cadastros de veículo feitos pela Portaria ou equipe não geram linha de auditoria (só alterações de tipo/dados do morador).
- Mensagem "Esta placa já está cadastrada" confirma ao morador que a placa existe em outra unidade (aceitável, mas é um vazamento mínimo).

## 7. O que não deu para testar
- **Impressão real** (PDF) de Relatórios, Multas e Usuários: o navegador do painel não emula mídia de impressão; só conferi o CSS (`@media print`, `.no-print` no cabeçalho, menu e botões). `/usuarios` não tem `.no-print` nas ações e o botão "Imprimir / Gerar PDF" do menu imprime qualquer tela.
- **Celular 375px** para Síndico, Subsíndico, ADM, Conselho e Inquilino (o pedido era Morador e Portaria); o formulário `/cadastro` em 375 só foi aberto no login, não preenchido.
- **ADM** na interface: só o fluxo de apagar multa; o restante foi coberto por API e pela equivalência de regras com Síndico.
- **Tela `/definir-senha`** com um link real (o token não pode ser impresso aqui) e envio real de e-mail; o link de acesso foi validado só pelo formato e pela bateria.
- **Sessão expirando com a página aberta** (testei cookie corrompido ao navegar, não o vencimento durante o uso) e erro de rede simulado.
- **Produção:** HSTS e a CSP real (testei o dev server).
- **Navegação 100% por teclado** nos formulários longos (cadastrar veículo, emitir multa) e leitor de tela.
- Aprovar e recusar reserva pela interface: coberto no QA `2026-10-04-reservas-calendario.md`; nesta rodada só por API.
- Excluir/Reenviar convite com erro "already registered" no ciclo completo (pendência conhecida).

## 8. Estado do staging ao final
Rodei a bateria (apaga o seed) e em seguida `node scripts/seed-staging.mjs`: staging recriado (7 usuários, 6 unidades, 3 espaços, 5 reservas, 1 aviso). Dados que criei durante o teste (provisório, autocadastros, multas, convites) foram apagados pela bateria e pelo seed.
