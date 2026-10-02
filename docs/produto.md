# Harmony — contexto de produto

Memória viva do produto. Quem decide algo relevante atualiza este arquivo (o agente
`product-manager` propõe o trecho; o dono do produto aprova). Última revisão: 2026-10-01.

## O que é
Portal web de gestão condominial. Hoje atende **um condomínio** (Harmony Residence). A
intenção do dono é virar um **produto para vários condomínios**, mas isso foi adiado de
propósito (ver Decisões). Em produção desde fim de setembro/2026; o primeiro síndico real
foi cadastrado em 01/10/2026.

## Quem usa
| Perfil | Quem é | Como usa |
|---|---|---|
| **MORADOR** | Muitos, leigos, alguns idosos | Celular, chegam por um link no WhatsApp. Multas (ciência/recurso), reservas, mural, veículos |
| **SÍNDICO / SUBSÍNDICO** | Poucos, com poder (cada um é único) | Computador e celular. Validam cadastros, emitem multas, aprovam reservas |
| **ADM (administradora)** | Várias contas possíveis, mesmas permissões do síndico | A administradora que cuida do condomínio. Parceira, não concorrente |
| **PORTARIA** | Operação rápida no balcão | Busca de placa, veículos, registrar pedidos de reserva |
| **CONSELHO** | Leitura e auditoria | Relatórios, multas, histórico |

Morador que se cadastra pelo link fica **provisório** (só mural, lista de unidades e o
próprio cadastro) até o síndico validar.

## O que já existe
Mural de avisos · unidades e moradores · veículos · multas com **ciência formal e recurso
online** · reservas de espaços com aprovação · links e documentos · relatórios e histórico
de ações · usuários e convites (links de acesso) · **autocadastro por link aberto** com
validação do síndico · exportação de moradores e veículos para Excel · menu lateral
animado no celular.

## Ambientes e forma de trabalho
Produção (dados reais, só o `main`) e staging (testes). Trabalho no branch `develop`,
prévia da Vercel liga no banco de staging, merge no `main` só com ok explícito do dono.
Migrações rodam primeiro em staging. Bateria de QA em `scripts/qa/`.

**Quadro de tarefas (GitHub Project "Harmony"):** colunas Todo → In Progress → **Teste** → Done. Decidido em 02/10/2026: nenhuma tarefa vai para Done sem passar pela coluna Teste, onde o agente `qa` (`.claude/agents/qa.md`) executa o roteiro no staging e grava o relatório em `docs/qa/`. Só com o QA aprovado (e o dono ciente) o cartão vai para Done.

## Decisões tomadas (e por quê)
- **Nome do produto (02/10/2026): "Harmony".** O dono decidiu que o produto se chama apenas Harmony (antes aparecia como "Harmony Residence"). Vale para interface, e-mails, relatórios impressos, documentos e conversas da equipe. Ajustar os textos existentes é trabalho a planejar; o nome do condomínio (Harmony Residence) continua sendo o do cliente, não o do produto.
- **Marca (02/10/2026):** o logotipo e o lótus atuais são a marca do **condomínio** (Harmony Residence), não do produto. O produto Harmony ainda não tem marca própria. Decisão do dono: criar a identidade do produto (símbolo, logotipo, uso) ANTES de desenhar o style tile e o redesenho visual; a marca do condomínio passa a ser usada como co-marca (ex.: "Condomínio Harmony Residence" no topo), não como a marca do sistema.
- **Nome e identidade visual adiados (02/10/2026):** o dono quer vender para outros condomínios no futuro, mas decidiu deixar o naming e o redesenho de layout para mais adiante. Até lá o produto segue chamado "Harmony" e nada de redesenho é implementado. Material pronto para retomar: docs/design/2026-10-02-analise-de-similares.md (direção A confirmada, aproveitar fotos reais das áreas comuns) e docs/design/marca/ (4 conceitos de símbolo para "Harmony"). Alerta: existe a "Harmony Condomínios" (administradora brasileira) e outros produtos com o nome; checar INPI e domínio antes de investir em marca. Caminhos de nome levantados: Pátio, Prumo, Zelo, Elo, Vizi, Convivo (todos a confirmar).
- **Vários condomínios: adiado.** Quando houver o 2º cliente, instalação separada por
  condomínio ("caminho A", horas de trabalho, isolamento total). Reescrever para
  multi-tenant ("caminho B": 16 tabelas e ~45 regras de acesso) só com demanda concreta,
  por exemplo uma administradora querendo um login para vários condomínios.
- **Pagamento do condomínio: não cobrar por enquanto.** Quem emite os boletos é a
  administradora. Ordem: (1) botão de atalho para o portal da administradora; (2) mostrar
  cobrança e 2ª via lendo do sistema dela, se ela liberar API (Superlógica tem API
  pública, com tokens gerados pela própria administradora). **Planilha mensal descartada**:
  dado velho mostra "em aberto" para quem já pagou. Cuidado LGPD: situação de pagamento só
  para a própria unidade e para o síndico, nunca na lista de unidades.
- **Identidade visual:** testamos limão, sálvia, menta, tangerina e lavanda; o dono
  **preferiu manter a paleta azul** (#0B2545 / #00A8E8) e **ficar com as fontes novas**
  (Bricolage Grotesque nos títulos, Plus Jakarta Sans no texto). Um novo Início do morador
  (cartão de "próxima ação" + abas embaixo no celular) foi implementado e **revertido a
  pedido**, sem detalhar o motivo: perguntar o que não agradou antes de tentar de novo.
- **Segurança:** cadastro público do Supabase desligado; acesso exige perfil; links de
  convite e redefinição apontam para o app e só gastam o token no toque em "Continuar"
  (robôs do WhatsApp gastavam o link); senha mínima de 8 caracteres.
- **Um e-mail é uma conta; unidades se ligam a contas existentes (2026-10-01).** Caso real: o
  síndico cadastrou a própria unidade (A-101) e o sistema tentou criar um segundo usuário.
  Agora, ao cadastrar ou editar uma unidade, e no "Enviar convite" do card, e-mail que já tem
  conta **não vira convite**: o síndico confirma (vendo nome e perfil) e a unidade é ligada à
  conta. Contas da equipe (Síndico, Subsíndico, ADM) podem ter várias unidades; **Morador com
  mais de uma unidade fica para a etapa 2** (o sistema assume uma unidade por morador; migração,
  regras de acesso e seletor de unidade), condicionada a quantos proprietários da planilha têm
  2 ou mais unidades. Especificação: `docs/specs/2026-10-01-vincular-unidade-a-conta-existente.md`.
- **Revisão de design no celular (2026-10-01):** 12 achados implementados em 3 lotes (sino, reservas do
  síndico, ciência da multa, formatos pt-BR; Autocadastro em cartões, alvos de toque de 44px, formulários,
  estados vazios; Início do morador só reordenado, carregamento, menu e login). O visual rejeitado
  (cartão de próxima ação + abas embaixo) **não** foi recriado. Pendente: logo com fundo transparente ou
  versão horizontal, a fornecer pelo dono (o arquivo atual é um quadrado opaco com texto pequeno).
- **Limpeza da base pelo painel (botão "digite DELETE"): adiado**, por risco em produção.
  Se voltar: só Síndico, exportação obrigatória antes, registro que não pode ser apagado.

## Concorrentes (resumo, fontes são blogs: confirmar antes de decidir)
Superlógica, wCond, uCondo, MyCond, TownSq, Condomob. Diferenciais recorrentes: **WhatsApp
com IA**, assembleia e votação online, encomendas, controle de acesso, conta digital. O
fluxo de multa com ciência formal e recurso online não apareceu nos que li: possível
diferencial, **a validar com um síndico**.

## Hipóteses em aberto
- O canal (aviso por WhatsApp de vencimento, multa, reserva) pode importar mais que o
  módulo de pagamento. Não validado.
- Qual sistema a administradora usa (Superlógica, uCondo, outro)? Define a integração.
- O que o dono não gostou no Início novo do morador?

## Pendências conhecidas
Texto da ciência da multa (barra no celular) **aprovado pelo dono em 2026-10-01**: "Ao confirmar, você declara
que recebeu esta notificação. O prazo para recurso vai até DD/MM/AAAA." Sem número de dias, porque o app só guarda
a data limite; não mudar sem revisão jurídica ·
· **upload de foto de evidência da multa** (hoje o campo
pede URL): estimado em 3 a 5 dias de trabalho mais uma conversa de LGPD antes (bucket privado,
policies, migração, rota com validação, retenção e quem vê) · **excluir sem confirmação**: comunicado
do Mural e "Cancelar convite" na fila de Usuários apagam direto, avaliar um diálogo ·
Reenviar da fila em Usuários & Convites um convite com erro ainda pode esbarrar em "already
registered" (a tela de unidades já resolve o caso) · autocadastro de uma segunda unidade com o
mesmo e-mail: formulário público não pode ligar a conta existente; futuro "Adicionar outra
unidade" para morador logado · síndico julgando recurso de multa da própria unidade (risco de
conflito de interesse, sem tratamento) ·
Versão da exportação "sem dados sensíveis" (para mandar no grupo) · prazo de expiração dos
links de acesso no Supabase (decisão de segurança × conforto)
(Senhas de produção conferidas pelo dono em 02/10/2026: só existem a conta ADM e a do Síndico, ambas dele e sem a senha de teste; issue #14 encerrada.)

## Agentes de apoio (`.claude/agents/`)
- `product-manager`: decide o que construir e em que ordem, escreve especificações em `docs/specs/`.
- `designer`: revisa telas, fluxos, microcopy e acessibilidade; recomenda, não implementa.
- `developer`: implementa e verifica no staging; não faz commit, push, merge nem toca em produção.
Todos começam sem memória: este arquivo é o contexto deles.
