# QA: nova estrutura da tela de Reservas (issue #84)

Data: 05/10/2026. Ambiente: staging (dev server local em localhost:3000), contas `@staging.test`.
Referência: `docs/design/reservas/mockup-reservas.html`. Alteração só de interface e textos, sem commit.
Viewports: celular 375x812 e desktop 1280x800. Nenhum acesso à produção.

## Resultado por grupo

| # | Grupo | Resultado |
|---|-------|-----------|
| 1 | Morador no celular (chips, resumo, rolagem, calendário, legenda) | PASSOU |
| 2 | Reservar o Salão no dia 20 sem escolher espaço no modal | PASSOU (2 leves) |
| 3 | Equipe (Síndico, Subsíndico, ADM): cartão de pedidos, abas, chips, registrar, menu Mais | PASSOU (2 leves) |
| 4 | Detalhes do espaço | PASSOU |
| 5 | Espaços cadastrados e exclusão | PASSOU |
| 6 | Formulário do espaço em 3 seções | PASSOU (bug conhecido da taxa persiste) |
| 7 | Portaria, Conselho, Inquilino, Provisório | PASSOU |
| 8 | Textos e termos | PASSOU com divergências leves |
| 9 | Acessibilidade e teclado | PASSOU (1 leve no menu Mais) |
| 10 | Regressão, console, bateria, seed | PASSOU |

## Medidas
- Morador 375px, Churrasqueira selecionada: cabeçalho do calendário a 380px e primeira linha de dias a 458px do topo
  (meta: até ~1,5 tela = 1218px). `scrollWidth` = 375 (sem rolagem horizontal). Alvos: chips, Hoje, setas, Ver regras,
  Ver em lista = 44px; dias 45x48px.
- Equipe 375px com cartão de pedidos: calendário a 618–735px. Aprovar/Recusar 150x44 e 152x44, lado a lado.
- Detalhes: miniatura 72x72.
- Contraste (WCAG AA, texto): chips 15,4; Aprovar (branco no verde) 5,36; Recusar 6,42; Aguardando 6,84;
  Confirmada 7,23; Livre 5,64; Bloqueado: X 9,45; "Precisa de aprovação" 6,36; "Cadastrar espaço" 5,25.
  Dias passados 2,63 (dia indisponível; mesmo cinza do mockup, ver leve L5).
- Cabeçalhos de seção do formulário: "Dados do espaço" 56px; as outras duas 77px (com resumo).

## Casos

### 1. Morador no celular: PASSOU
- Abre em Calendário (visão salva por aparelho). Chips (radiogroup "Espaço"): Churrasqueira selecionada (primeiro ativo),
  Sala de Jogos, Salão de Festas; Quadra Poliesportiva com "Em manutenção", `disabled`, fora da ordem de tabulação.
- Resumo de uma linha com "Churrasqueira · até 20 pessoas", selo e "Ver regras e valores".
- Calendário só do espaço escolhido; células com aria-label ("livre", "ocupado", "sua reserva confirmada").
  Legenda com ícone + texto: Livre, Ocupado, Aguardando, Confirmada, Hoje. Esqueleto cinza enquanto a RPC carrega.
- "Minhas reservas" (até 3, as próximas) e "Ver em lista". Vazio (candidato1): "Você ainda não tem reservas. Escolha um espaço e um dia no calendário."

### 2. Reservar o Salão no dia 20: PASSOU
- Modal: título "Salão de Festas · terça-feira, 20 de outubro", foco no título, sem lista de espaços, aviso único
  "A equipe vai analisar seu pedido.", número de pessoas com valor ao vivo: 1 e 10 = "grátis (até 10 pessoas)",
  11 e 50 = "R$ 150,00", 51 = erro de capacidade, vazio = pedido para informar. Termo "Li e aceito as regras de uso do Salão de Festas." com "Ver regras" (expande inline).
  Botão "Pedir reserva" (Salão) e "Reservar agora" (Churrasqueira, aviso "Sua reserva fica confirmada na hora.").
- Sem aceitar o termo: erro "É obrigatório aceitar o regulamento e normas de uso do espaço." (role=alert).
- Sucesso: faixa com valor, modal fecha e o foco volta ao dia (aria-label "sua reserva aguardando aprovação").
- Duplo clique com 30–40ms de intervalo: uma só reserva (1 POST, 201). Sala de Jogos idem.
- Dia ocupado (Salão 12/10): modal "Este espaço está ocupado neste dia." + "Trocar espaço" (volta ao chip, foco no chip selecionado) + "Fechar".
- Dia bloqueado pela Churrasqueira (Salão 17/10 e 21/10) aparece como "ocupado", sem motivo, para morador, inquilino e candidato.
  Resposta da RPC `disponibilidade_reservas` traz só `espaco_id`, `data`, `ocupado`. `space_blocks` volta `[]` para o inquilino. A tabela `reservations` do inquilino traz só as 2 reservas dele. Nenhuma ocorrência de "Não reservável", "Bloqueado por" ou "motivo" no HTML.
- Conflito simulado (RPC forçada a `[]` para a tela achar o dia livre): mesmo espaço = "Esse espaço acabou de ser reservado para este dia. Escolha outro espaço ou outro dia."; dia bloqueado = "Este dia acabou de ficar indisponível. Escolha outro dia."

### 3. Equipe: PASSOU
- Síndico, Subsíndico e ADM: cartão âmbar "N pedido(s) aguardando sua decisão" no topo (abaixo do título e botões), uma linha por pedido
  (apto, bloco, espaço, data, pessoas, valor), Aprovar/Recusar 44px; rótulos de acessibilidade com o detalhe do pedido.
- Aprovar funcionou (calendário atualizou para "confirmada"). Recusar abre diálogo com justificativa obrigatória (botão desabilitado vazio); recusa gravada e o dia ficou livre. O cartão some ao zerar.
- Abas "Calendário | Lista" (role=tab, setas funcionam); chips só no Calendário; Lista mostra "Histórico de reservas".
- "Todos": etiquetas no desktop (dia 21 com Sala e Churrasqueira), no celular só o marcador do dia. Chip filtra; para a gestão, o dia bloqueado aparece como "Bloqueado: Churrasqueira".
  Clicar num dia em "Todos" abre "Registrar reserva" com seletor de espaços (ocupados/em manutenção desabilitados).
- "Registrar reserva" em nome de morador: Churrasqueira/Sala = "Reserva confirmada para ...", Salão = "Pedido registrado para ... Aguardando aprovação. Valor de uso: R$ 150,00 (acima de 10 pessoas)." ou grátis com 8 pessoas.
- Menu "Mais": Cadastrar espaço e Imprimir agenda. Teclado: ArrowDown/Up, Home, End, Esc devolvem o foco ao botão.
- Não foi possível gerar mais de 3 reservas num dia (4 espaços, 1 inativo, Salão e Churrasqueira se bloqueiam), então o "+N" não foi exercitado.

### 4. Detalhes do espaço: PASSOU
- Fechado por padrão (aria-expanded=false, aria-controls). Aberto: miniatura 72x72, horário, valor, taxa de higienização, aprovação, regras.
- "Não reservável no mesmo dia que: Churrasqueira." aparece só para Síndico, Subsíndico e ADM. Ausente no HTML de morador, inquilino, candidato e Conselho. Portaria só verificado no HTML da tela (sem a linha).

### 5. Espaços cadastrados: PASSOU
- Recolhível (cabeçalho 59px, aria-expanded/aria-controls). Desktop: tabela. Celular: cartões rotulados.
  Botões "Editar" e "Desativar/Ativar" com texto e aria-label por espaço, 44px. Sem "Excluir" na lista.
- Desativar a Sala de Jogos: chip passa a "Em manutenção" e vai para o fim; reativar volta. Mensagens corretas.
- "Excluir espaço" só no rodapé do formulário, em vermelho. Confirmação "Excluir o Salão de Festas? As reservas já feitas continuam no histórico."
  Foco em "Voltar"; Esc fecha só o diálogo e o formulário continua aberto. Não excluí nenhum espaço.

### 6. Formulário do espaço: PASSOU
- "Dados do espaço" aberta, "Pedidos e valor" e "Bloqueios entre espaços" fechadas, com resumo no cabeçalho
  ("Exige aprovação · Valor: grátis até 10 pessoas", "Não reservável no mesmo dia que Churrasqueira"; criação: "...Valor: grátis", "Nenhum"). aria-expanded e aria-controls corretos.
- Faixa com limite 60 (capacidade 50), valor vazio e nome vazio com a seção fechada: a seção ABRE, o foco vai ao campo (`aria-invalid`) e a mensagem aparece.
- Salvar sem mexer manteve aprovação, faixa 10/R$ 150,00, bloqueio com Churrasqueira e taxa R$ 150,00.
- Interruptor "Espaço disponível para reservas" no topo funciona (desligou e religou a Sala de Jogos).
- BUG CONHECIDO ainda acontece (ver L1): apagar "Taxa de Higienização" vira 0 e salva como "Isento".

### 7. Perfis: PASSOU
- Conselho e Portaria: sem cartão de pedidos, sem Aprovar/Recusar, sem Cadastrar espaço, sem "Espaços cadastrados"; "Mais" só com Imprimir agenda.
  Ambos veem "Ocupado" no Salão (sem "Bloqueado: ..."); Detalhes sem a linha de bloqueio.
- Portaria registrou pedido do Salão em nome de morador (8 pessoas, grátis, "Aguardando aprovação"). No dia 17 o modal desabilita Churrasqueira e Salão ("Ocupado") e libera só a Sala.
- Inquilino: igual ao morador (só as 2 reservas dele, sem motivo de bloqueio). Provisório: "Disponível após a validação do seu cadastro". Visitante: redireciona para /login.

### 8. Textos: PASSOU com divergências
- Ausentes na tela: "Agendar Este Espaço", "Cheio", "Solicitar Reserva", "Taxa de Limpeza", "convidados", "Inativo", "Regras Principais".
- Presentes: "Precisa de aprovação", "Confirma na hora", "Histórico de reservas" (equipe), "Minhas reservas" (morador), vazio do morador conforme pedido.

### 9. Acessibilidade e teclado: PASSOU
- Chips: setas, Home, End; o inativo é pulado e a navegação dá a volta.
- Calendário: setas, Home/End (início/fim da semana), PageUp/PageDown (mês), Enter abre o modal, Esc devolve o foco ao dia.
- Acordeões são `button` com aria-expanded/aria-controls. Modal: aria-modal, aria-labelledby, foco no título, Esc fecha (sintético; Tab preso verificado só por evento sintético).
- Valor e aviso do modal em `aria-live="polite"`. Foco visível confirmado com Tab real (anel ao redor do campo).
- 375px sem rolagem horizontal em morador, inquilino, candidato e equipe (Calendário e Lista).

### 10. Regressão: PASSOU
- Conflitos e mensagens (acima), valor gravado (R$ 150,00 / grátis), aprovação por espaço (Salão pede aprovação, Churrasqueira e Sala não), RPC com esqueleto.
- Impressão: não gerei a impressão real. Pelo DOM e CSS `@media print`: cabeçalho `print-only`, tabela de histórico em `hidden print:block`;
  cartão de pedidos, abas, chips, resumo/Detalhes, calendário, botões e "Espaços cadastrados" têm `no-print`. Regras de impressão da tabela `tabela-agenda` presentes.
- Console: nenhum erro, exceto o 409 do duplo clique sintético (L3) e o aviso de LCP do logo. Sem 5xx.
- Bateria `node scripts/qa/bateria.mjs`: "TUDO OK" na 1ª rodada. Rodei uma 2ª vez só para contar (739 linhas com ✓/"checks", incluindo linhas de resumo; não conferi o rodapé dela). Seed `node scripts/seed-staging.mjs` rodado ao final: a base está limpa de novo.

## Bugs

Nenhum bloqueante nem grave.

### Leves
- L1. Apagar o campo "Taxa de Higienização" vira 0 na hora e o espaço salva como "Isento" (bug anterior, ainda presente). Passos: Síndico, Editar Salão de Festas, abrir "Pedidos e valor", apagar a taxa, Salvar; o cartão passa de R$ 150,00 para "Isento".
- L2. Gênero em "Li e aceito as regras de uso do Churrasqueira." e "...do Sala de Jogos." (nos modais de morador e de equipe). Esperado "da Churrasqueira", "da Sala de Jogos".
- L3. Duplo clique no mesmo instante (dois cliques no mesmo ciclo, sem intervalo) dispara dois POSTs; o segundo falha com 409 (`reservations_espaco_data_ocupado_key`) e sai como erro no console. Só uma reserva é criada (o banco protege). Com 30–40ms de intervalo, o botão trava e só um POST é enviado. Quase impossível por uso humano.
- L4. Menu "Mais" aberto com o mouse: Esc não fecha quando o foco está no botão "Mais". Só fecha com o foco dentro do menu (o código trata Esc apenas no menu). Passos: clicar em "Mais" com o mouse, apertar Esc; o menu continua aberto.
- L5. Dias passados do calendário têm contraste 2,63 (número cinza claro). São dias indisponíveis (isentos), mas vale subir um tom.
- L6. Depois de Aprovar/Recusar não há mensagem de sucesso nem de erro (o pedido só some, o cartão atualiza por aria-live "N pedido(s)"). Se a decisão falhar, nada avisa. O foco vai para "Mais".
- L7. Erro de validação do modal de reserva ("É obrigatório aceitar o regulamento...") leva o foco ao título do modal, não ao termo.
- L8. Terminologia: formulário do espaço usa "Exige aprovação" (resumo do cabeçalho e rótulo "Exige aprovação da equipe") enquanto o resto da tela usa "Precisa de aprovação". Status de lista e cartão "Aprovada", legenda do calendário "Confirmada".
- L9. No desktop, em "Todos", as etiquetas de dia truncam ("Salão de Fe…", "Churrasqu…", "Sala de Jog…") e não trazem o status em texto (só ícone e cor); o nome completo está só no aria-label.
- L10. O modal da equipe em "Todos" abre com o primeiro espaço livre pré-selecionado (Churrasqueira/Sala), o risco de escolher o espaço errado que a issue citou para o morador. O seletor existe por decisão, mas o pré-seleção mantém o risco para a equipe.

## Divergências do mockup
1. Título da página: "Reservar espaço" (morador) e "Reservas" (equipe); o mockup usa "Reservas" para os dois.
2. Resumo do espaço: selo "Precisa de aprovação / Confirma na hora" + "grátis até 10 pessoas" em linha; o mockup usa texto "Exige aprovação · grátis até 10 pessoas".
3. Status das reservas: "Aprovada"/"Aguardando aprovação" na lista e em "Minhas reservas"; o mockup usa "Confirmada" e "Aguardando aprovação". O botão "Cancelar pedido" do mockup em "Minhas reservas" não apareceu nos cartões do morador que vi (não testei o cancelamento).
4. "Minhas reservas" do morador tem botão "Imprimir agenda", que o mockup não tem. O mockup tem "Ver lista completa"; o app tem "Ver em lista".
5. Menu "Mais": mockup tem "Ver reservas passadas"; o app só Cadastrar espaço e Imprimir agenda.
6. Modal do morador: o mockup traz a linha "Com 8 pessoas: Grátis", campo "Horário" (seletor "18h às 23h") e link "Cancelar"; o app usa Início/Término (time) e botão "Cancelar", mais o aviso da taxa de higienização. O termo tem "Ver regras" em linha separada abaixo, não junto do texto.
7. Cartão âmbar usa Aprovar em verde (mockup em azul-marinho).
8. Etiquetas do dia no desktop: mockup "Salão · Aguardando"; o app só o nome do espaço com ícone.
9. Formulário: mockup traz Horário em dois campos (início/fim); o app mantém um campo de texto único ("10h às 22h"). Tira de resumo e seções batem com o mockup.
10. Legenda em "Todos": só Aguardando, Confirmada, Hoje (correto, sem Livre/Ocupado); mockup mostra as quatro.

## O que não deu para testar
- Impressão real (só inspeção de classes e CSS).
- "+N" em "Todos": não há dados para passar de 3 etiquetas por dia.
- Morador no desktop 1280px (só celular, por pedido) e Subsíndico no celular (só desktop; Síndico e ADM no celular).
- Foco preso com Tab real no modal (só evento sintético) e leitor de tela de verdade.
- Retorno de foco ao botão "Editar" do formulário (cliques por script não focam o botão; com mouse real só validado o Mais).
- Rede caindo no meio de uma ação.

## Dados de teste
Criei e alterei dados de teste no staging (reservas do morador, do inquilino, em nome de "Morador Teste QA…", recusa, aprovação, edições de espaço). O seed foi rodado ao final e recriou a base.
