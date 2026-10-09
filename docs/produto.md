# Harmony — contexto de produto

Memória viva do produto. Quem decide algo relevante atualiza este arquivo (o agente
`product-manager` propõe o trecho; o dono do produto aprova). Última revisão: 2026-10-09.

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

**Entregue entre 02/10 e 08/10/2026** (fontes: `docs/qa/`, `docs/specs/`):
- **Perfil Zelador e hierarquia entre perfis** de gestão (um perfil não age sobre igual ou superior; auditoria no servidor) · **transferir cargo** (Síndico, Subsíndico etc.).
- **Reservas:** calendário, bloqueio entre espaços e valor por faixa · **anulação de multa**.
- **Veículos:** tipo e edição pelo morador, e lista nova de veículos (cartão com folha de detalhes).
- **Documento (RG/CPF) do titular** legível só pela gestão e pelo próprio morador.
- **Livro de reclamações:** construído e em produção, mas **desligado** (modo DESLIGADO). Só liga quando o dono decidir (ver Pendências).
- **Endurecimento no banco (lote 0044–0047, 08/10):** ver Decisões.

## Ambientes e forma de trabalho
Produção (dados reais, só o `main`) e staging (testes). Trabalho no branch `develop`,
prévia da Vercel liga no banco de staging, merge no `main` só com ok explícito do dono.
Migrações rodam primeiro em staging. Bateria de QA em `scripts/qa/`. O fluxo completo
de entrega, com as regras de produção (uma migração por vez, uma vez cada; banco antes
do código), está em `docs/processo-de-entrega.md`.

**Quadro de tarefas (GitHub Project "Harmony"):** colunas Todo → In Progress → **Teste** → Done. Decidido em 02/10/2026: nenhuma tarefa vai para Done sem passar pela coluna Teste, onde o agente `qa` (`.claude/agents/qa.md`) executa o roteiro no staging e grava o relatório em `docs/qa/`. Só com o QA aprovado (e o dono ciente) o cartão vai para Done.

## Decisões tomadas (e por quê)
- **Reservas: "paga em toda reserva" e percentual da cota única (09/10/2026, decidido pelo dono).** O espaço passa a ter três regras de valor: grátis para qualquer número de pessoas, **paga em toda reserva** (independente do número de pessoas) e grátis até N pessoas com valor acima disso. "Paga em toda reserva" usa o modelo já existente (`faixa_gratis_ate = 0`), **sem migração** (Fase 1). Depois (Fase 2, migração 0048) o valor do espaço pode ser **Fixo (R$)** ou **Percentual da cota**, calculado no banco, arredondado ao centavo e **congelado na reserva**. A cota é **única do condomínio** (o dono: "existe uma cota mínima"), não por unidade; cota por unidade e leitura do Superlógica ficam adiados. Espaço percentual só pode ser salvo se a cota estiver cadastrada; reservas feitas mantêm o valor gravado. Pendência: o morador pode ver a cota? (recomendação: não; vê só o R$). Specs: `docs/specs/2026-10-09-reservas-valor-pago-e-percentual.md`.
- **Reservas: cobrança por fora (09/10/2026, decidido pelo dono).** A reserva é feita pela plataforma e o **síndico cobra por fora**. O Dona Wanda calcula, mostra e registra o valor; não recebe pagamento nem confirma reserva por pagamento. **Mantém** a decisão "Pagamento do condomínio: não cobrar por enquanto" abaixo. Isso também troca a premissa anterior de que a administradora lançaria o valor na taxa do morador: o texto da tela diz que o síndico cobra. Relatório "valores a lançar" vira melhoria opcional, não pré-requisito.
- **Área de Configurações, só para a gestão (09/10/2026, decidido pelo dono).** Nova área **"Configurações"** (menu e rota `/configuracoes`), acessível **só a Síndico, Subsíndico e ADM**; Conselho, Portaria, Zelador, Morador e Provisório não veem nem acessam (negação no banco, não só no menu). A v1 tem **um campo: a cota mínima do condomínio (R$)**, base do percentual dos espaços de reserva. Dado em tabela de configuração de linha única; alteração registrada no histórico pelo servidor, sem valores. A hierarquia entre perfis de gestão não se aplica (não age sobre conta de outra pessoa). Cresce item a item, com spec curta para cada um. Spec: `docs/specs/2026-10-09-area-de-configuracoes.md`.
- **Nome do produto (08/10/2026): "Dona Wanda".** O dono comprou os domínios **donawanda.com.br** e **donawanda.com** e decidiu que o produto se chama **Dona Wanda**. O primeiro cliente continua sendo o **Condomínio Harmony Residence**, que é o cliente, não o produto. Isso **substitui** as duas decisões de nome abaixo (02/10), que ficam como histórico. Vale para a equipe toda (agentes incluídos): em interface, e-mails, relatórios, documentos e conversas o produto é "Dona Wanda"; "Harmony" só aparece como nome do condomínio cliente. Nomes de código (repositório `harmony-condo`, projetos Supabase e Vercel) não mudam por enquanto. Pendências: plano técnico do domínio (hospedagem, redirecionamento, Supabase Auth, e-mail), ajuste dos textos voltados ao usuário, **checar o nome no INPI** (classe de software) antes de investir em marca, e a identidade visual segue adiada.
- ~~**Nome do produto (02/10/2026): "Harmony".**~~ *(superado em 08/10/2026 por "Dona Wanda".)* O dono decidiu que o produto se chama apenas Harmony (antes aparecia como "Harmony Residence"). Vale para interface, e-mails, relatórios impressos, documentos e conversas da equipe. Ajustar os textos existentes é trabalho a planejar; o nome do condomínio (Harmony Residence) continua sendo o do cliente, não o do produto.
- **Marca (02/10/2026):** o logotipo e o lótus atuais são a marca do **condomínio** (Harmony Residence), não do produto. O produto Harmony ainda não tem marca própria. Decisão do dono: criar a identidade do produto (símbolo, logotipo, uso) ANTES de desenhar o style tile e o redesenho visual; a marca do condomínio passa a ser usada como co-marca (ex.: "Condomínio Harmony Residence" no topo), não como a marca do sistema.
- **Nome e identidade visual adiados (02/10/2026):** o dono quer vender para outros condomínios no futuro, mas decidiu deixar o naming e o redesenho de layout para mais adiante. Até lá o produto segue chamado "Harmony" e nada de redesenho é implementado. Material pronto para retomar: docs/design/2026-10-02-analise-de-similares.md (direção A confirmada, aproveitar fotos reais das áreas comuns) e docs/design/marca/ (4 conceitos de símbolo para "Harmony"). Alerta: existe a "Harmony Condomínios" (administradora brasileira) e outros produtos com o nome; checar INPI e domínio antes de investir em marca. Caminhos de nome levantados: Pátio, Prumo, Zelo, Elo, Vizi, Convivo (todos a confirmar).
- **O que a Portaria e o Conselho leem (05/10/2026):** continuam lendo, das unidades, o telefone, o e-mail e o responsável. Perdem o acesso ao **RG/CPF** do titular, que passa a ser legível só pela gestão e pelo próprio morador (issue #67; a decisão substitui a #57).
- **Hierarquia entre perfis de gestão (05/10/2026):** um perfil de gestão não age sobre outro de nível igual ou superior em redefinição de senha, e ninguém convida para um cargo acima do seu (ex.: o Subsíndico não convida um ADM). As ações sensíveis (redefinir senha, convidar, excluir) são registradas no histórico pelo servidor, não pelo navegador (issue #68).
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
- **A administradora usa Superlógica (07/10/2026).** A Garden usa o Superlógica Condomínios, confirmado pelo dono em 07/10. Passa a ser fato, não hipótese; a integração segue a ordem já decidida (atalho para o portal primeiro, leitura por API só se a administradora liberar). Spec: `docs/specs/2026-10-07-integracao-superlogica.md`.
- **Prazo do recurso da multa (08/10/2026, decidido pelo dono).** O morador pode recorrer até o **fim do dia** de `prazo_recurso_data`, no horário de Brasília (America/Sao_Paulo). A regra é aplicada **no banco**, não só na tela. O recurso exige pelo menos 10 caracteres úteis (L5). Ciência e recurso só podem ser registrados **uma vez** pelo morador e depois ficam imutáveis para ele (data e nome saem do servidor); a gestão mantém o que já podia. Migração 0047.
- **Livro de reclamações, modo Aberto sem trava externa (08/10/2026, migração 0044).** Síndico e ADM podem ligar o modo Aberto sem uma "liberação" externa; saiu a trava `liberado_para_abrir` (a coluna fica sem efeito). As regras de uso continuam: o morador aceita a ciência antes de entrar. Com a 0046, mudar o modo avisa a gestão no sino e o teto de respostas conta só as não removidas (200 por tópico, 20 por autor). **Continua desligado e ainda depende do dono**: aviso de privacidade (#55), conversa com advogado e uma semana em modo Equipe (rollout em duas etapas da v2). Spec: `docs/specs/2026-10-07-livro-de-reclamacoes-v2.md`.
- **Lote 0044–0047 aplicado em staging e produção (08/10/2026).** 0044 (livro sem trava), 0045 (nome de cadastro pendente só para a gestão no diretório, #56), 0046 (ajustes do modo Aberto), 0047 (recurso da multa, links só http(s) em documentos e portal da administradora, nome reservado "Aguardando validação" barrado, horário de reserva com fim depois do início). Incidente: a 0044 foi reaplicada depois da 0046 e desfez a 0046 (a função `livro_definir_modo` voltou à versão antiga); corrigido reaplicando a 0046 e confirmado pelo `checar`, que passou a verificar a versão da função. O livro estava desligado, sem impacto. Regra nova: **uma migração por vez, uma vez cada, em produção** (`docs/processo-de-entrega.md`).
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
- Quando o dono quer ligar o Livro: quem escreve o aviso de privacidade (#55), quando falar com o advogado e quando começa a semana em modo Equipe? Sem datas nas fontes.
- A Garden vai liberar o link do portal e um usuário de API de consulta? (a integração Superlógica depende disso; a spec trata como a confirmar).
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
