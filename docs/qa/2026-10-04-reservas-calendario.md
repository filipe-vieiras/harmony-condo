# QA: Reservas com calendário, conflito no banco e aprovação por espaço (issue #49)

Data: 2026-10-04 · Ambiente: staging (app local em localhost:3000) · Contas `@staging.test` · Sem dados reais.
Migrações 0032, 0033 e 0034 já aplicadas. Desktop 1280x800 e celular 375x812.

## Resultado geral
Nenhum bug que bloqueia ou grave. 2 observações leves e 3 itens não testados de ponta a ponta. Todos os testes de segurança e de regra por API passaram.

## 1. Estrutura
| Caso | Resultado |
|---|---|
| Selos "Exige aprovação" (Clock) e "Confirmação automática" (CheckCircle2) nos cartões, visíveis a todos os perfis | PASSOU |
| Botões Lista/Calendário com `aria-pressed`, 44px de altura | PASSOU |
| Morador abre em Calendário, equipe (Síndico, Subsíndico, Portaria, Conselho) em Lista | PASSOU |
| Escolha lembrada ao recarregar (localStorage `reservas-visao`) | PASSOU |
| Lista só com as reservas da própria unidade, título "Minhas solicitações" para o morador | PASSOU |
| Lista "idêntica à anterior" | PASSOU parcial (colunas e botões conferidos, sem comparação visual com a versão antiga) |
| Impressão mostra só a Lista | NÃO TESTADO na impressão real; conferido no código: calendário e barra de abas com `no-print`, Lista com `print:block` mesmo com o calendário na tela |

## 2. Calendário (morador)
| Caso | Resultado |
|---|---|
| Mês, setas (anterior desabilitada no mês atual), botão "Hoje" (volta ao mês atual) | PASSOU |
| Dia passado desabilitado (`aria-disabled`), hoje com rótulo "hoje" | PASSOU |
| Marcas "N livres", "Cheio", "Aguardando", "Confirmada", legenda com ícone e texto | PASSOU |
| Células de 44px ou mais, sem rolagem horizontal em 375px (scrollWidth 375) | PASSOU |
| Esqueleto ao carregar (RPC atrasada 2,5s: zero células, `aria-busy`, nunca "tudo livre") | PASSOU |
| Teclado: setas, Home/End (início/fim da semana), PageUp/PageDown (mês), Enter abre o modal, Esc devolve o foco ao dia | PASSOU |
| `aria-label` dos dias ("13 de outubro, 1 espaço livre", "sua reserva confirmada") e `aria-live` ao mudar de mês ("Novembro de 2026.") | PASSOU |
| Em 375px a célula mostra só número e ícone/ponto (o texto "2 livres" fica oculto; a legenda explica) | PASSOU (decisão de layout) |

## 3. Privacidade (crítico)
| Caso | Resultado |
|---|---|
| Resposta da RPC como morador: só `espaco_id`, `data`, `ocupado` | PASSOU |
| `reservations` como morador e inquilino: só a própria unidade (A-101 e A-102) | PASSOU |
| HTML da tela do inquilino não contém nome, unidade nem e-mail de outra unidade (calendário, modal, `title`) | PASSOU |
| Reserva alheia pendente e confirmada aparecem iguais: espaço "Ocupado neste dia", contagem de livres igual | PASSOU |
| Dia só com reserva da própria unidade exibe "Aguardando"/"Confirmada" (é a reserva do próprio usuário) | PASSOU |

## 4. Reservar pelo modal do dia
| Caso | Resultado |
|---|---|
| Modal "Reservar espaço" com data por extenso; cartões rádio com Livre / Ocupado neste dia / Em manutenção | PASSOU |
| Espaço que exige aprovação: "Precisa de aprovação", botão "Solicitar reserva", sucesso "Pedido enviado!..." | PASSOU |
| Espaço automático: "Confirmação imediata", botão "Reservar agora", sucesso "Reserva confirmada! Churrasqueira, dia 22/10/2026." e dia passa a "Confirmada" | PASSOU |
| Duplo clique real: 1 só POST e 1 reserva | PASSOU |
| Bottom sheet no celular (encosta embaixo, cantos superiores arredondados, botões de 44px), X/Esc/fundo fecham, foco volta ao dia, foco preso no modal (30 Tabs) | PASSOU |
| Termo de aceite obrigatório | PASSOU |

## 5. Conflito
| Caso | Resultado |
|---|---|
| Reserva concorrente criada por script com o modal aberto: mensagem "Esse espaço acabou de ser reservado para este dia. Escolha outro espaço ou outro dia.", convidados e termo mantidos, calendário atualizou | PASSOU |
| Dois espaços no mesmo dia (Salão e Churrasqueira) | PASSOU |
| Recusada e cancelada liberam o dia; reativar recusada para PENDENTE em dia ocupado é barrado pelo banco (23505) | PASSOU |

## 6. Equipe (Síndico, Subsíndico, ADM)
| Caso | Resultado |
|---|---|
| Modal "Neste dia": espaço, horário, status, Apto/Bloco/Nome; Aprovar e Recusar só nas pendentes | PASSOU |
| Recusar exige justificativa (botão desabilitado vazio); com motivo o dia é liberado e o morador recebe "Reserva Não Aprovada" com o motivo | PASSOU |
| Registrar em nome de morador: Salão -> "Pedido registrado... Aguardando aprovação"; Churrasqueira -> "Reserva confirmada para..., Apto 102" | PASSOU |
| Formulário do espaço: cartão "Regras de reserva", checkbox "Exige aprovação da equipe" marcado por padrão, aviso ao desmarcar | PASSOU |
| Alterar a configuração muda o selo e vale só para reservas novas (3 pedidos pendentes do Salão continuaram "Aguardando") | PASSOU |
| Histórico: "Confirmada automaticamente em 04/10/2026", sem Aprovar/Recusar | PASSOU |
| Aviso informativo à equipe (notificação ao Síndico "Reserva confirmada automaticamente ... Este espaço não exige aprovação", sem "requer aprovação") e "Reserva confirmada!" à unidade do morador | PASSOU |
| Subsíndico vê Cadastrar/Editar/Excluir e Aprovar/Recusar (ADM por API) | PASSOU (ADM só por API) |

## 7. Portaria e Conselho
| Caso | Resultado |
|---|---|
| Veem todas as reservas, sem Aprovar/Recusar, sem Cadastrar/Editar/Desativar/Excluir espaço | PASSOU |
| Portaria registra em nome do morador conforme a regra do espaço (Churrasqueira confirmada, Salão aguardando) | PASSOU |
| Conselho e Portaria não aprovam por API (0 linhas) | PASSOU |

## 8. Segurança por API (scripts Node com login das contas de teste)
Todos PASSARAM:
- Morador envia `status: 'APROVADA'` no Salão (exige aprovação): grava PENDENTE, `avaliado_por` nulo. Portaria idem.
- Morador pede PENDENTE na Churrasqueira: grava APROVADA com "Aprovação automática" e data de avaliação. Conselho idem.
- Morador não atualiza status para APROVADA (0 linhas); morador, inquilino, Portaria e Conselho não alteram `exige_aprovacao` (0 linhas); Síndico, Subsíndico e ADM alteram (e a auditoria registra).
- Dia passado: `reserva_dia_passado`. Espaço inativo: `reserva_espaco_indisponivel`. Reserva em nome de outra unidade: barrada pela política.
- 5 pedidos simultâneos (morador e inquilino): 1 reserva criada e 4 erros 23505.
- RPC: morador, inquilino, Portaria e Conselho recebem dados; recusa janela passada (-40 dias), fim acima de 366 dias, intervalo acima de 186 dias, fim anterior ao início e nulos (`periodo_invalido`/`periodo_fora_da_janela`); visitante sem login: `permission denied`.
- Conta sem perfil: RPC vazia, não cria nem lê reservas e não lê espaços. Cadastro provisório (`cadastro_validado=false`): RPC vazia, criação negada (`reservations_block_provisorio`), leitura vazia.
- ADM lança APROVADA diretamente (permitido).

## 9. Erros e estados
| Caso | Resultado |
|---|---|
| Erro de carregamento do calendário (RPC simulada com 500): mensagem e botão "Tentar de novo" (44px) que recarrega | PASSOU |
| Erro de rede ao enviar (simulado): "Não foi possível enviar agora. Seus dados continuam aqui, tente de novo.", modal aberto | PASSOU |
| Espaço inativo na tela: rádio desabilitado "Em manutenção" | PASSOU |
| Mensagem "Esse dia já passou..." | NÃO TESTADO na tela: o dia passado fica desabilitado e a única forma é virar a meia-noite com o modal aberto; o banco devolve `reserva_dia_passado` (testado por API) |

## 10. Regressão
| Caso | Resultado |
|---|---|
| Aprovar pela Lista (reflete no calendário e na lista) | PASSOU |
| Cadastrar, editar, desativar e excluir espaço (com confirmação) | PASSOU |
| Notificações da equipe e do morador criadas, sem placa; texto do morador sem nome | PASSOU (ver observação 2) |
| Histórico em Relatórios: "Passou a exigir aprovação...", "Aprovada", "Removeu espaço comum" | PASSOU |
| Console sem erros novos inesperados | PASSOU (só 409 provocados e a falha simulada; os erros de veículo e perfil são de sessões anteriores) |
| Sem 5xx reais (as respostas 500 foram simuladas por mim no navegador) | PASSOU |

## Bugs e observações (todos leves)
1. **Leve. Duplo clique sintético manda 2 POSTs.** Dois `click()` na mesma passada de execução do navegador enviam duas requisições ao banco; a segunda recebe 409 e o banco mantém uma só reserva (o usuário viu só o sucesso). O duplo clique real (mouse) enviou 1 POST. Sugestão: travar o botão por referência (ref) no início do envio.
2. **Leve. Texto da notificação ao morador:** "Sua reserva do Churrasqueira para 26/10/2026 está confirmada" (concordância: "da Churrasqueira"). Texto vem da migração 0034 (`'Sua reserva do ' || espaco_nome`).
3. **Leve. Relatórios:** o indicador "Reservas aprovadas... Aprovadas pela administração" passa a contar também as confirmadas automaticamente.
4. **Leve (consistência).** A escolha Lista/Calendário fica no mesmo `localStorage` do navegador, sem separar por usuário: quem entra depois no mesmo navegador herda a visão do anterior (o PRD dizia "não persistir"; a issue pede lembrar, então só registro).

## O que não foi testado
- Impressão real da agenda (conferido por código e CSS).
- Mensagem "Esse dia já passou..." na tela e virada de dia em America/Sao_Paulo (banco testado por API).
- Leitor de tela de verdade (conferi `aria-label`, `aria-live`, `role=dialog`, `aria-modal`).
- Comparação visual da Lista com a versão antiga; o ADM só foi testado por API.
- Capturas de tela legíveis: o painel do navegador renderizou pequeno; conferi pelo DOM.

## Dados deixados no staging
Reservas de teste em 20, 22, 24, 26, 28 e 29/10 e 7 e 3/11, notificações e trilha de auditoria. O seed (`node scripts/seed-staging.mjs`) pode recriar a base.
