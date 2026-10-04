# Reservas: calendário, defesa de conflito no banco e aprovação configurável por espaço

Data: 2026-10-04 · Autor: PM · Status: decisões do dono incorporadas (04/10/2026), pronta para implementar · Sem dados reais (repositório público).

## 0. Decisões do dono (04/10/2026)

1. **Um espaço não pode ter mais de uma reserva no mesmo dia** (um pedido por espaço por dia, PENDENTE ou APROVADA). **Dois espaços diferentes podem ser reservados no mesmo dia.**
2. **Sem antecedência mínima**: só se bloqueia dia passado (a "regra de 48h" é só texto e continua assim). A aprovação pela equipe (Síndico, Subsíndico ou ADM) é o padrão, mas passa a ser uma **configuração por espaço**: "Exige aprovação da equipe". Se exige, o pedido nasce PENDENTE (como hoje); se não exige, a reserva nasce APROVADA, **decidido pelo banco, nunca pelo navegador do morador**. Padrão para espaços existentes: exige aprovação (comportamento atual).
3. **Uma única issue** com tudo, entregue nesta ordem: (a) defesa de conflito no banco, (b) função de disponibilidade, (c) configuração por espaço, (d) interface de calendário. Primeiro banco e testes, depois interface.

## 1. Problema (e o que existe hoje)

**Quem sofre.** O morador, no celular, que quer saber "tem o salão livre no dia 20?". Hoje não consegue saber. O síndico/ADM sofre do outro lado: recebe pedidos para dias já tomados e recusa à mão; e toda reserva, mesmo de um espaço sem risco, exige que alguém aprove.

**O que existe (conferido no código):**
- `src/app/reservas/page.tsx`: cartões dos espaços (cadastro/edição de espaço só pela equipe, com descrição, horário, regras, ativo), botão "Agendar Este Espaço" (formulário com data, início, término, convidados, termo) e tabela "Cronograma e Histórico".
- Morador só lê as reservas da PRÓPRIA unidade (política `reservations_read`, migração 0028). Equipe (Síndico, Subsíndico, ADM, Conselho, Portaria) lê todas. Espaços são lidos por qualquer perfil validado; escritos só por `is_admin()` (0013, 0028).
- Criar: a política `reservations_insert` (0028) só deixa o morador criar **status PENDENTE** na própria unidade; Portaria e Conselho registram PENDENTE em nome de morador; admin cria qualquer status. Aprovar/recusar/apagar: só admin (0023). A decisão hoje é feita no cliente (`requestReservation` e `judgeReservation` em `AppContext.tsx`), que também insere as notificações.
- **O teste de conflito roda só no navegador** (`requestReservation`): bloqueia se já existe reserva APROVADA ou PENDENTE do mesmo espaço no mesmo dia. Como o morador não enxerga reservas de outras unidades, **esse teste é cego para ele**: dois moradores podem pedir o mesmo dia. Não há restrição no banco.
- A tela só impede data anterior a hoje (data local do navegador).
- Hoje o morador descobre dia livre por tentativa e erro, ou perguntando ao síndico/portaria (suposição, validar).

**Se nada for feito:** idas e vindas (pedido, recusa, novo pedido), mais mensagens ao síndico, risco de duas aprovações no mesmo dia, e trabalho de aprovação em espaços que o condomínio não quer controlar.

**Achado importante:** o calendário só entrega valor se o morador enxergar disponibilidade, o que exige dado novo e uma defesa no banco. Sem isso o calendário seria um enfeite que mente.

## 2. Escopo em 4 blocos (ordem de entrega)

### Bloco A. Defesa de conflito no banco (P1)
- Regra: no máximo **uma reserva por espaço por data** com status PENDENTE ou APROVADA. RECUSADA e CANCELADA **liberam o dia**. Espaços diferentes no mesmo dia: permitido.
- Implementação a cargo do developer (índice único parcial sobre `espaco_id, data` onde status em PENDENTE/APROVADA é o caminho mais simples e à prova de corrida). Também vale para aprovar/reativar: mudar uma reserva RECUSADA/CANCELADA para PENDENTE/APROVADA precisa respeitar a regra.
- **Antes de criar a restrição**, rodar consulta de conflitos existentes (staging e produção); se houver, a equipe resolve (recusar/cancelar um) antes. A migração não pode falhar no meio nem apagar dados.
- Reservas de espaço apagado (`espaco_id` nulo, 0014) não entram na regra.
- O erro do banco é traduzido na tela para "Este dia acabou de ser reservado. Escolha outro dia." e os dados recarregam.
- Obs.: a rejeição revela 1 bit ("já ocupado") em caso de corrida; aceitável, é o que o calendário já mostra.

### Bloco B. Função de disponibilidade
- Função no banco (RPC) `disponibilidade_reservas(inicio date, fim date)` que devolve **somente** `espaco_id`, `data` e `ocupado` (PENDENTE ou APROVADA contam como ocupado). Sem nome, bloco, unidade, horário, status, id da reserva, convidados, motivo.
- `security definer` com `search_path` fixo; `revoke` de `public` e `anon`; `grant` só a `authenticated`. Exige perfil válido (`tem_perfil()`) e **recusa provisório**. Janela limitada (ex.: ~1 mês para trás, ~12 meses à frente) para não virar extração em massa. Reaproveita o padrão de `diretorio_unidades()` (0028).
- Não afrouxar a política `reservations_read` (vazaria nome/unidade).

### Bloco C. Configuração por espaço: "Exige aprovação da equipe"
- **Campo novo em `spaces`**: booleano `exige_aprovacao`, `not null`, padrão **verdadeiro**. Os espaços existentes ficam verdadeiros (comportamento atual preservado).
- **Quem edita:** só equipe com permissão de gerir espaços (Síndico, Subsíndico, ADM, via `is_admin()`, como o resto do cadastro). Morador, Portaria, Conselho e provisório não alteram. Aparece como interruptor no cadastro/edição do espaço, com texto: "Exige aprovação da equipe. Desligado: a reserva é confirmada na hora, se o dia estiver livre."
- **Status inicial definido no banco:** gatilho `BEFORE INSERT` em `reservations` que, para perfis que não são admin, **ignora o status enviado** e grava: PENDENTE se o espaço exige aprovação, APROVADA se não exige. O navegador não decide. Admin continua podendo criar qualquer status. Em auto-aprovação, preencher também `data_avaliacao` e o campo de avaliador com um marcador do sistema (ex.: "Aprovação automática"), nunca com o nome do morador.
- **Ponto técnico para o developer:** a política `reservations_insert` (0028) hoje exige `status = 'PENDENTE'` para não admin, e a verificação roda depois do gatilho `BEFORE`. A política precisa ser ajustada para aceitar o status que o gatilho definir (PENDENTE ou APROVADA, conforme o espaço), mantendo "só na própria unidade" e sem permitir que o morador escolha. Conferir no teste que enviar `status: 'APROVADA'` em espaço que exige aprovação resulta em PENDENTE (ou é rejeitado), nunca APROVADA.
- **Mudar a configuração depois:** vale só para reservas novas. Pedidos PENDENTE existentes continuam pendentes (a equipe decide), reservas já APROVADAS não mudam. Sem recálculo retroativo.
- **Portaria e Conselho** registram em nome de morador: seguem a mesma regra do espaço (espaço sem aprovação gera APROVADA também nesse caminho; é o banco que decide). Conselho continua sem aprovar manualmente.
- **Espaço inativo** (`ativo = false`) continua sem aceitar pedidos (conferir se o banco também barra; se só a tela barra, incluir no gatilho).

### Bloco D. Interface: abas Lista/Calendário e modal do dia
Conforme o layout do designer.
- Cartões dos espaços no topo, como hoje (mostram também um selo "Confirmação automática" quando não exige aprovação; revisar texto com o designer).
- Abaixo, abas **Lista | Calendário** (controle segmentado, alvo mínimo 44px). **Calendário padrão para morador, Lista para equipe.** Não persistir a escolha.
- Calendário **mensal**, semana começa no domingo, navegação de mês, botão "Hoje". Sem visão semanal/diária. Filtro de espaço em chips.
- **Cada dia:** número; marcadores por espaço (ícone/letra + cor) com estado livre/ocupado, nunca só por cor (forma e texto). Dia com todos os espaços ocupados = "cheio". Dia passado esmaecido e sem ação. Hoje destacado. **Sem desabilitar dias por antecedência** (não há antecedência mínima).
- **Clique no dia abre o modal:** data por extenso; lista dos espaços com "Livre"/"Indisponível"; ao escolher um espaço livre, o formulário atual com **data preenchida e fixa**. Equipe vê os campos "em nome de morador". Fechar com X, Esc e toque fora; foco volta ao dia.
- **Texto do formulário depende do espaço:** exige aprovação: "Seu pedido ainda precisa da aprovação da equipe." Não exige: "Sua reserva será confirmada na hora."
- **Horários:** mantém um por espaço por dia, sem grade de horários. Início/término continuam informativos.
- **O que cada perfil vê das reservas de outros:** Morador: só "Indisponível" por espaço e dia (rótulo neutro, sem revelar "pendente"); nunca nome, unidade, bloco, convidados, motivo de recusa, aprovador. Provisório: bloqueado (`AguardandoValidacao`), sem calendário. Equipe (Síndico, Subsíndico, ADM): vê tudo e aprova/recusa no modal (fluxo existente). Portaria e Conselho: veem tudo (já leem tudo), sem aprovar; Portaria registra em nome de morador. Pendente de outro = ocupado; recusada/cancelada = livre.
- **Fuso:** "hoje" e "dia passado" em America/Sao_Paulo (não UTC, não relógio do aparelho). Corrigir também o corte hoje feito com data local do navegador.
- Após qualquer criação ou decisão, calendário e lista recarregam.

## 3. Fica de fora (e por quê)
Antecedência mínima (decidido: não); mais de uma reserva por espaço no dia / turnos por horário (decidido: não); configuração por espaço além de "exige aprovação" (limite de convidados, taxa, horários, dias da semana); arrastar e soltar; recorrência; sincronizar com Google/Apple Calendar; lista de espera; reserva de vários dias; cobrança de uso; visão semanal/diária; mostrar quem reservou ao morador; calendário na impressão da agenda (a "Imprimir Agenda" continua a tabela); interruptor global de módulos (já adiado).

## 4. Notificações (impacto)
Hoje as notificações são inseridas pelo navegador e a mensagem fala em "aguarda aprovação". Mudanças:
- **Espaço que exige aprovação:** igual a hoje. Equipe recebe "Nova Solicitação de Reserva ... Requer aprovação"; ao decidir, o morador recebe aprovada/recusada.
- **Reserva auto-aprovada:** a equipe (Síndico) recebe notificação **informativa** ("Reserva confirmada automaticamente: [espaço] em [data], Unidade X"), sem texto de "requer aprovação" e sem ação pendente. O morador (a unidade) recebe **"Reserva confirmada!"**, não "solicitação enviada". Mensagem de retorno na tela também muda ("Reserva confirmada" em vez de "aguarda aprovação").
- O texto deve ser escolhido pelo **status que o banco devolveu**, nunca pelo que o navegador acha que é o status (o navegador lê a linha criada e decide a mensagem).
- Reserva auto-aprovada entra na auditoria como "Reserva confirmada automaticamente".
- Sem WhatsApp/e-mail novos; sem notificação extra para recusa por conflito (o morador recebe o erro na tela).

## 5. Dados e segurança

**Migrações (mínimo, nesta ordem):** (1) coluna `exige_aprovacao` + gatilho de status inicial + ajuste da política de insert; (2) defesa de conflito (precedida de checagem de dados existentes); (3) RPC de disponibilidade. Rodar no staging primeiro; produção só com aprovação do dono, depois de checar conflitos.

**Testes de segurança e de regra (obrigatórios, no staging, antes da interface):**
1. **Outro morador não vê nome/unidade:** a RPC devolve só espaço+data+ocupado (inspecionar o JSON na rede); a consulta direta à tabela de outro morador continua mostrando só a própria unidade; nenhum nome/unidade em HTML, `title` ou rótulo acessível.
2. **Morador não força APROVADA:** inserir via API (sessão de morador) com `status: 'APROVADA'` em espaço que exige aprovação resulta em PENDENTE ou é rejeitado; nunca APROVADA. Também não consegue mudar o status depois (update é só admin).
3. **Morador não edita a configuração do espaço:** update de `exige_aprovacao` por morador, Portaria, Conselho e provisório é negado; só Síndico/Subsíndico/ADM.
4. **Corrida:** dois pedidos simultâneos para o mesmo espaço e dia (inclusive de moradores diferentes) geram **uma só reserva**; o segundo recebe erro claro.
5. **Espaço sem aprovação gera APROVADA:** morador cria e a linha sai APROVADA, com marcador de aprovação automática; a equipe é notificada como informativo e o morador como confirmada.
6. **Espaço com aprovação gera PENDENTE** (comportamento atual preservado, inclusive para os espaços existentes após a migração).
7. **Conflito entre espaços:** dois espaços diferentes no mesmo dia: ambos aceitos. Mesmo espaço, mesmo dia, PENDENTE ou APROVADA existente: rejeitado. Após RECUSAR ou CANCELAR a existente: novo pedido aceito.
8. **Provisório:** RPC negada e criação negada; tela mostra "aguardando validação".
9. **Visitante (sem login):** RPC negada; criação negada.
10. **Portaria e Conselho:** leem tudo pelo caminho existente; registram em nome de morador (resultado segue a regra do espaço); **Conselho não aprova nem recusa**; Portaria não edita espaço.
11. **Dia passado** rejeitado também no banco (fuso America/Sao_Paulo), não só na tela.
12. **Checagem de dados existentes** executada e conflitos tratados antes da restrição; migração testada em cópia/staging.

**LGPD:** moradores veem só ocupado/livre; calendário não é compartilhável por link; sem nome nem unidade em texto, `title` ou rótulo acessível; marcador de aprovação automática não identifica pessoa.

## 6. Riscos
- **Aprovação automática desprotege o espaço:** equipe que ligar "sem aprovação" em salão de festas perde o filtro. Mitigação: padrão é exigir aprovação; texto claro no interruptor; a equipe é notificada de toda reserva confirmada e pode cancelar (a política de apagar/atualizar continua admin).
- **Falha de segurança sutil na política de insert:** afrouxar `status = 'PENDENTE'` sem o gatilho mandar no status abriria "morador cria já APROVADA". Mitigação: teste 2 é bloqueante.
- **Dados antigos:** conflitos já existentes podem impedir a restrição; checar antes.
- **Duas fontes da verdade:** calendário (RPC) e lista (tabela) divergirem. Ambos recarregam após qualquer mudança.
- **Desempenho no celular:** buscar só o mês visível (+ margem), grade simples sem biblioteca pesada. Meta: abrir em 1 s em 4G (suposição, medir).
- **Expectativa do morador:** "Indisponível" pode voltar a "Livre" se o pedido de outro for recusado; dizer no formulário. Em espaço com aprovação, "livre" não é "reservado para mim".
- **Mensagem errada ao morador** (dizer "aguarda aprovação" quando já foi confirmada): decidir texto pelo status devolvido pelo banco.
- **Suporte:** abas e modal novos para público leigo. Rótulos curtos e legenda de 3 itens (Livre, Indisponível, Hoje).
- **Fuso** na virada do dia.
- **Escopo grande para uma issue:** 4 blocos. Mitigação: ordem de entrega fixa e commits por bloco; o bloco A sozinho já corrige a falha de conflito.

## 7. Dependência
Reservas ainda **não foram liberadas ao morador** na fase 1. A interface só gera valor ao morador depois dessa liberação; tudo pode ser construído e testado no staging antes. O bloco A (conflito no banco) é **P1 antes de liberar reservas** e vale independentemente.

## 8. Critérios de aceite (testáveis)

**Banco (blocos A a C)**
1. Criar duas reservas PENDENTE/APROVADA do mesmo espaço no mesmo dia (mesmo via API, com sessão de morador) falha no banco; só uma existe. Espaços diferentes no mesmo dia: ambas passam.
2. Recusar ou cancelar a reserva existente libera o dia para novo pedido.
3. A migração de conflito roda sem erro em staging após checagem; produção só após checagem e aprovação do dono.
4. A RPC `disponibilidade_reservas` devolve apenas espaço, data e ocupado; negada a visitante e provisório; janela de datas limitada.
5. Existe o campo "Exige aprovação da equipe" por espaço, padrão ligado; espaços existentes continuam ligados e se comportam como hoje (PENDENTE).
6. Só Síndico, Subsíndico e ADM alteram o campo; morador, Portaria, Conselho e provisório recebem negação.
7. Espaço com o campo desligado: pedido de morador sai APROVADA, definido pelo banco; com o campo ligado sai PENDENTE. Enviar `status: 'APROVADA'` pelo cliente em espaço com aprovação nunca resulta em APROVADA.
8. Mudar o campo não altera reservas já criadas.
9. Dois pedidos simultâneos geram uma reserva; o outro recebe a mensagem "Este dia acabou de ser reservado".
10. Dia passado é rejeitado também pelo banco, em America/Sao_Paulo.

**Notificações**
11. Reserva auto-aprovada: equipe recebe notificação informativa (sem "requer aprovação"); a unidade do morador recebe "Reserva confirmada"; mensagem na tela confirma na hora. Reserva com aprovação: notificações iguais às de hoje.

**Interface (bloco D)**
12. Em 375px não há rolagem horizontal; dia, aba, seta de mês e botões do modal têm alvo mínimo de 44px.
13. Morador abre a aba Calendário: mês atual, hoje destacado, dias passados desabilitados, dias ocupados distintos por forma e texto; nenhum dia futuro é desabilitado por antecedência.
14. Tocar num dia abre o modal com os espaços e sua situação; escolher um espaço livre mostra o formulário com a data preenchida e fixa; o texto de status esperado ("precisa de aprovação" ou "confirmada na hora") corresponde à configuração do espaço.
15. Dia ocupado: espaço "Indisponível" e envio impossível; nenhum nome, unidade ou status em HTML ou resposta de rede.
16. Equipe (Síndico/Subsíndico/ADM) vê as reservas do dia com nome e unidade, aprova e recusa (com justificativa) no modal; Conselho e Portaria veem sem botões de decisão (Portaria registra pedido).
17. Interruptor "Exige aprovação da equipe" visível no cadastro/edição do espaço só para equipe com permissão.
18. Provisório e visitante não acessam a disponibilidade.
19. Teclado: Tab chega às abas, setas navegam entre dias, Enter abre o modal, Esc fecha e devolve o foco ao dia; foco preso no modal. Leitor de tela: cada dia anuncia "20 de outubro, segunda-feira, Salão: livre, Churrasqueira: indisponível"; abas `tablist`; modal `role=dialog` com título.
20. A aba Lista continua como hoje; impressão da agenda inalterada.

## 9. Perguntas ao dono
Nenhuma em aberto. As duas anteriores foram respondidas em 04/10/2026 (seção 0).

## 10. Issue e prioridade
- **Título:** "Reservas: calendário, defesa de conflito no banco e aprovação configurável por espaço".
- **Rótulos:** funcionalidade, prioridade: alta (a defesa de conflito é P1 antes de liberar reservas), esforço: G.
- **Estimativa** (a confirmar com o developer): bloco A+B+C com testes, 2 a 3 dias; interface, 3 a 4 dias.
- Validar antes de construir: mostrar o protótipo do designer ao síndico; perguntar quais espaços dispensariam aprovação (suposição: churrasqueira/quadra sim, salão de festas não).

## 11. Trecho proposto para `docs/produto.md` (aguarda aprovação do dono)
> **Reservas com calendário e aprovação por espaço (decidido em 2026-10-04):** um pedido por espaço por dia (PENDENTE ou APROVADA ocupam; recusada/cancelada liberam); espaços diferentes podem ser reservados no mesmo dia; sem antecedência mínima (só bloqueia dia passado). Cada espaço tem a configuração "Exige aprovação da equipe" (padrão: sim); sem aprovação, o banco já cria a reserva APROVADA. Conflito é defendido no banco (antes só no navegador e cego para o morador). Calendário mensal com abas Lista/Calendário; morador só vê "livre/indisponível" por função própria no banco, sem nome, unidade ou status. Fora: turnos por horário, recorrência, sincronização externa, lista de espera, cobrança. Depende da liberação de Reservas ao morador (fase 1).
