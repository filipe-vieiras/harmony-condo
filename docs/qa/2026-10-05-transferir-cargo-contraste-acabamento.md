# QA: Transferir cargo (#53), contraste (#31) e acabamento do tipo do veículo (#45)

Data: 05/10/2026. Ambiente: staging (app local em localhost:3000, base de teste). Código no diretório de trabalho, sem commit.
Contas `@staging.test`. Navegador em 1280x800 e 375x812. Nenhum dado real.

## Resumo

| Grupo | Resultado |
|---|---|
| A1 Visibilidade | PASSOU (1 falha leve: botão "Cancelar transferência" aparece para o Subsíndico) |
| A2 Assistente de 3 passos | PASSOU com observações leves (nome só pelo primeiro nome confunde; foco após erro) |
| A3 Transferência para conta existente | PASSOU |
| A4 Síndico que perdeu o cargo | PASSOU (observação leve de texto) |
| A5 Destino novo (convite, pendência, aceite, cancelar) | PASSOU |
| A6 Erros dentro do assistente | PASSOU (observações leves de foco e de artigo na mensagem) |
| A7 Segurança por API | PASSOU (bateria: 604 checks, TUDO OK) |
| A8 Regressão da tela Usuários | PASSOU |
| B Contraste (#31) | PASSOU para texto; FALHOU para componentes de interface (bordas de campos e alguns ícones) |
| C Acabamento do veículo (#45) | PASSOU |
| Bateria `node scripts/qa/bateria.mjs` | 604 checks, TUDO OK |
| Seed `node scripts/seed-staging.mjs` | rodado ao final (base recriada) |

Bugs: 0 bloqueia, 0 grave, 7 leves (seção "Bugs").

## A. Transferir cargo (#53)

### A1 Visibilidade: PASSOU
- ADM e Síndico: seção "Cargos" com 4 cartões (Síndico, Subsíndico, Conselho, Portaria); ADM não ganha cartão. No celular a seção começa recolhida (`aria-expanded=false`, botão de 44px) e a página não rola na horizontal.
- Subsíndico, Conselho, Portaria, Morador e provisório: sem a seção. Conselho, Portaria, Morador e provisório caem em "Área Restrita" na URL `/usuarios`; o Subsíndico abre a tela (como antes) sem a seção Cargos. A API recusa os quatro (403, bateria).
- Linha do Síndico sem lixeira e com a dica "Para sair do cargo, transfira-o."; excluir o Síndico pela API retorna 403 "O Síndico não pode ser excluído por aqui." (bateria, para ADM e Subsíndico).
- FALHOU (leve): ver bug 1.

### A2 Assistente: PASSOU
- Passo 1: busca por nome, e-mail e sem acento; lista só de quem pode receber (exclui provisório, ADM, conta pendente, executor e a origem); vazio com "Nenhum resultado para “zzzz”..." e botão "Convidar nova pessoa" que leva ao campo Nome com foco; erros: "Escreva o nome completo.", "Esse e-mail parece incompleto...", "Esse e-mail já tem conta. Use “Usuário já cadastrado” e escolha X." com botão-link "Escolher X" de 44px que volta e marca a pessoa; para conta pendente: "X não pode receber esse cargo agora."; convite já na fila: "Já existe um convite para este e-mail. Cancele-o na fila ou escolha outro e-mail." Campo com `aria-invalid` e `aria-describedby`, foco no primeiro erro.
- Passo 2: texto do que acontece com quem sai; aviso âmbar (`role=note`) quando o destino já tem cargo; troca Síndico e Subsíndico ("Os dois trocam de lugar").
- Passo 3: resumo; "Digite TRANSFERIR" só para Síndico e Subsíndico; aceita "transferír" com espaços e caixa diferente, recusa "transf" ou vazio com mensagem e foco no campo. Conselho e Portaria sem a palavra e com foco inicial em "Voltar". O botão confirmar usa `aria-disabled` (nunca desabilitado mudo, o clique explica o motivo).
- Indicador "Passo N de 3" e barra; foco no título a cada passo; Esc e X fecham; Voltar funciona; após fechar o foco vai para o cabeçalho do cartão do cargo; alvos de 44px (botões e linhas de rádio, 56px nas pessoas). Celular: folha de baixo (colada embaixo, cantos 16px, largura 375px), botão principal em cima, campo TRANSFERIR com fonte de 16px.
- Duplo e triplo clique no confirmar: uma só transferência (conferido no banco).

### A3 Conta já cadastrada: PASSOU
- ADM transferiu Síndico (para o Subsíndico, a troca), Subsíndico, Conselho e Portaria; Síndico transferiu Subsíndico, Conselho, Portaria e o próprio cargo. Mensagens: "Pronto. X agora é Y. Z passa a ser Morador."
- Quem sai sem unidade virou provisório; com unidade, Morador validado (banco e bateria). A troca Síndico e Subsíndico deixou um de cada.
- Histórico em Relatórios: "Transferiu o cargo de Portaria de A para B." sem e-mail nem telefone. Avisos no banco: "Você agora é Conselho" (novo titular) e "Você passou o cargo de Conselho" (antigo); bateria confirma que só o alvo lê.

### A4 Síndico que perdeu o cargo: PASSOU
- Ao confirmar, o Síndico caiu no Início com a faixa "Você passou o cargo de Síndico para X. Agora seu acesso é de Morador." (com botão fechar de 44px), sem logout. `/usuarios` redireciona para o Início; `/multas` mostra a tela de Morador/provisório; `/relatorios` mostra "Área Restrita" comum. Sem dados de equipe. Bateria: 403 nas rotas de equipe, RLS sem multas, convites ou histórico, na mesma sessão.
- Leve: ver bug 5.

### A5 Destino novo: PASSOU
- Convite com cargo (Conselho) mostra painel com link, "Copiar" e "Enviar por WhatsApp" ("Cada link vale uma vez só...").
- Cartão "Transferência pendente: De X. Para Y. Aguardando aceitar o convite." com "Copiar link" e "Cancelar transferência"; confirmação destrutiva ("Cancelar a transferência para Y?", foco em "Voltar"); cancelada, o cartão volta a oferecer "Transferir cargo" e a pessoa sai da fila.
- Fila mostra "Portaria (ao aceitar)". O titular segue no cargo até o aceite e vê a faixa "Você tem uma transferência de cargo pendente para Y."
- Aceite real pelo link (Continuar, senha, aceite): cargo ativo, antigo titular virou Morador, tela mostra "Senha criada com sucesso! Seu novo cargo já está ativo. Entre com a senha que você acabou de criar." Verificado duas vezes (Conselho e Portaria). Uma pendência por cargo único (bateria e tela: "Já há uma transferência de Portaria aguardando X aceitar. Cancele-a antes de iniciar outra.").
- Observação: a senha mínima do app é de 8 caracteres (os testes usaram uma senha própria para a conta nova, não `123456`).

### A6 Erros dentro do assistente: PASSOU (assistente não fecha)
- Rede (fetch derrubado): "Não deu para concluir. Nada foi alterado. Confira a internet e tente de novo." + "Tentar de novo".
- Conflito (cargo mudou por fora): "O cargo mudou enquanto você preenchia: agora o Portaria é Candidato Um. Nada foi alterado. Comece de novo." + "Recomeçar" (relê os dados e fecha o assistente).
- Destino inválido: "X não pode mais receber o cargo. Escolha outra pessoa." e volta ao passo 1 com foco no título. Simulado deixando a conta não validada; **não testei com a conta realmente apagada**.
- Pendência existente (criada por outra sessão): mensagem acima + "Ver convite" (fecha e foca o cartão).
- Sem permissão (Síndico rebaixado por outra sessão): "Você não tem permissão para transferir cargos."; o assistente continua aberto.
- Leves: bugs 3 e 4.

### A7 Segurança por API: PASSOU
Rodei `node scripts/qa/bateria.mjs` (inclui `scripts/qa/transferir-cargo.mjs`): **604 checks, TUDO OK**. Cobre: funções do banco não chamáveis por authenticated nem anon; rotas transferir, cancelar e aceitar recusando Subsíndico, Conselho, Portaria, Morador, provisório, conta sem perfil e visitante; escaladas (criar ADM, destino ADM, provisório, própria origem, executor, cargo inválido, origem desatualizada, UUID inválido); `profiles` somente leitura para ADM e Síndico; três transferências simultâneas geram uma só; falha forçada desfaz tudo; nunca dois Síndicos ou Subsíndicos; avisos só para o alvo; histórico sem e-mail nem telefone.

### A8 Regressão da tela Usuários: PASSOU
Novo Usuário da Equipe (Síndico e Subsíndico "já ocupado" e desabilitados, sem perder ADM, Portaria e Conselho), convite entra na fila, gerar link, copiar link, cancelar convite com confirmação ("Cancelar o convite de X?"), redefinir senha (gera link), confirmação de excluir acesso (a exclusão em si foi coberta pela bateria). Celular 375px sem rolagem horizontal; alvos de 44px. Console: só os 409 e 403 provocados de propósito nos testes de erro.

## B. Contraste (#31)

Método: script no navegador por estilo computado (cor do texto, fundo composto pelas camadas ancestrais com transparência e opacidade; gradiente avaliado pelo pior ponto de cor), limite de 4,5:1 (3:1 para texto grande, a partir de 24px ou 18,66px em negrito, e para ícones). Telas: como Síndico, Início, Mural, Moradores & Unidades, Veículos, Multas, Reservas, Links, Relatórios, Usuários, Autocadastro e a barra lateral; como Morador, as 7 telas do menu dele; também `/cadastro` (público) e `/login`. Celular: Início e menu aberto como Morador.

Texto: **nenhum texto habilitado abaixo do mínimo**, exceto o item 1 abaixo.
- Aprovar (Início e Reservas): branco sobre #007a55, **5,36:1**. Recusar: 6,42:1.
- "Em Manutenção / Inativo": branco sobre #bb4d00, **5,03:1**. Contador vermelho do menu: **4,77:1**. "Pendente" 6,36:1; "Aprovada" 6,70:1.
- Banner do Início (gradiente escuro): passa pelo pior ponto do gradiente. `/login` e `/cadastro` passam.

Ainda abaixo do mínimo (relatar):
1. `/usuarios`, subtítulo "Cadastre a equipe..." (`text-slate-500` sobre #f4f7fb): **4,43:1** (mínimo 4,5). Leve.
2. Bordas dos campos de busca e filtros (Veículos, Moradores, Multas, Mural, Autocadastro: busca, selects, link do formulário, planilha): **1,15 a 1,23:1** (mínimo de 3:1 para componente de interface). Leve.
3. Botões só de ícone "Editar dados do zelador" e "Editar Portal da Administradora" (Links): ícone com `opacity-60`, **2,31:1**. Leve.
4. Ícones decorativos de cabeçalho em ciano #00a8e8 (2,5 a 2,7:1), âmbar em Moradores (2,13:1) e verde no vazio de Multas (2,47:1): acompanham texto, ficam isentos se decorativos (`aria-hidden`), mas estão abaixo de 3:1.
5. Controles desabilitados (isentos pela norma, mas pouco legíveis): "Indisponível no Momento" 4,35:1, "Validar selecionados (0)" 2,09:1, "Recusar (0)" 2,23:1, seta "Mês anterior" 1,49:1.

Não medi: estado hover e foco (o script não aciona `:hover`; pelas classes, o hover do Aprovar escurece para `emerald-800`, o que só aumenta o contraste), texto dentro de imagens, Subsíndico, Conselho e Portaria, e as telas em celular como Síndico.

## C. Acabamento do tipo do veículo (#45): PASSOU
- Cadastro, edição (Morador) e autocadastro público (`/cadastro`): enviar sem tipo deixa o grupo com `role=radiogroup`, `aria-required=true`, `aria-invalid=true` e `aria-describedby` apontando o erro ("Escolha o tipo do veículo." e, no público, "Escolha o tipo do veículo 1."); foco no primeiro campo com erro (placa quando vazia; senão o primeiro rádio do tipo).
- Com filtro "Carro" ativo, trocar o tipo para Moto move o foco para o cartão de feedback (`role=status`, "Veículo atualizado.").
- Modal: X, Cancelar e Salvar com 44px. Autocadastro: opções com 62px.
- Conselho não vê "Cadastrar Veículo" (Morador vê).
- Console sem 406 nem "Perfil não encontrado". Login normal funciona; conta com sessão e sem perfil (criada só no Auth) gera apenas um `console.warn` "Perfil não encontrado para a sessão atual." e o app fica em "Carregando..." (igual ao comportamento anterior, bug 6).

## Bugs (todos leves)

1. **Subsíndico vê "Cancelar transferência" na fila de convites.** Passos: seed padrão; entrar como `subsindico@staging.test`; abrir Usuários; na fila há "Cancelar transferência"; clicar, confirmar. Resultado: "Você não tem permissão para cancelar esta transferência." (a API recusa certo). Esperado: botão escondido para quem não é ADM nem Síndico (PRD: Subsíndico não vê a ação). Arquivo: `src/app/usuarios/page.tsx` (linha do botão na fila, `i.transferenciaId`).
2. **Só o primeiro nome nos textos do assistente e dos cartões.** Com nomes do seed: "Conselho ficará só com o acesso básico", "Conselho hoje é Conselho", "Candidato hoje é Portaria" (havia dois "Candidato"), "De Morador. Para Novo Conselheiro.", resumo do celular "Cargos: Síndico Conselho, Subsíndico Candidato". Em condomínio real, dois moradores com o mesmo primeiro nome tornam a confirmação ambígua. Sugestão: nome completo nos passos 2 e 3 e nos cartões.
3. **Foco cai no `body` depois de erro do servidor no passo 3 de Conselho e Portaria.** Passos: ADM, cartão Conselho ou Portaria, até o passo 3 (foco inicial em "Voltar"); mude o cargo por outra sessão; confirmar. Durante o envio "Voltar" fica `disabled` e perde o foco; ao voltar o erro o foco continua no `body`, fora do diálogo. Esperado: levar o foco ao aviso de erro ou ao botão principal.
4. **Artigo errado na mensagem de conflito:** "agora o Portaria é Candidato Um" (o cargo é feminino, e em Conselho e Portaria há várias pessoas, a mensagem cita só uma). Texto do servidor de `origem_desatualizada`.
5. **Ex-Síndico sem unidade vira provisório e o Início diz "Seu cadastro está aguardando a validação do síndico... Não encontramos o seu envio. Fale com o síndico do condomínio."** abaixo da faixa que explica a transferência. Texto confuso para quem acabou de ser Síndico. Sugestão: para quem perdeu o cargo, mostrar só a faixa e orientar a ligar uma unidade.
6. **(já existia)** Sessão sem perfil fica em "Carregando..." para sempre, sem como sair. Passos: criar usuário só no Auth, entrar. Não é regressão da troca para `maybeSingle`.
7. **Ruído no console:** recusas esperadas (409 de conflito, pendência e destino inválido; 403 de permissão) aparecem como "Failed to load resource" em vermelho. Só incômodo para quem depura.

Observações sem severidade: o PRD (itens 5.3 e 8.8) pede, para Síndico e Subsíndico, nome do destino digitado e senha; a entrega pede só a palavra TRANSFERIR (confirmar com o PM/dono se é decisão). O PRD prevê expiração em 14 dias e "reenviar link"; a migração 0037 não tem expiração (estados PENDENTE, CONCLUIDA, CANCELADA, FALHOU) nem reenvio; não testei porque não existem. A conta provisória da pendência ("Novo Porteiro", "Cargo pendente") aparece em "Equipe com acesso ativo" e entra na contagem.

## O que não deu para testar
- Capturas de tela do painel ficaram pequenas e ilegíveis; verifiquei tudo pelo DOM, estilo computado e banco.
- Destino com conta realmente apagada durante o assistente (simulei com conta não validada).
- Aviso no sino da interface (verifiquei só no banco e por RLS); leitor de tela de verdade e Tab/Shift+Tab completo no diálogo (verifiquei foco inicial, Esc, X e Voltar).
- Dois navegadores reais ao mesmo tempo (simulei a outra sessão por alterações no banco).
- Contraste: hover e foco, Subsíndico, Conselho e Portaria, e as telas em celular como Síndico.
- Expiração de 14 dias e reenvio de link (não implementados).

## Estado do staging
Dados de teste criados e alterados durante os testes (transferências, convites `qa.*`, veículo editado, senha de contas novas). Ao final rodei `node scripts/seed-staging.mjs`, que recriou a base (12 usuários, 6 unidades, 7 veículos, 3 espaços, 5 reservas, 1 aviso e a transferência pendente de Portaria Dois para novo.porteiro).
