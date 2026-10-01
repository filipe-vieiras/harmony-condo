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

## Decisões tomadas (e por quê)
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
Reenviar da fila em Usuários & Convites um convite com erro ainda pode esbarrar em "already
registered" (a tela de unidades já resolve o caso) · autocadastro de uma segunda unidade com o
mesmo e-mail: formulário público não pode ligar a conta existente; futuro "Adicionar outra
unidade" para morador logado · síndico julgando recurso de multa da própria unidade (risco de
conflito de interesse, sem tratamento) ·
Versão da exportação "sem dados sensíveis" (para mandar no grupo) · prazo de expiração dos
links de acesso no Supabase (decisão de segurança × conforto) · senha 123456 da conta de
administradora em produção deve ser trocada por uma forte.

## Agentes de apoio (`.claude/agents/`)
- `product-manager`: decide o que construir e em que ordem, escreve especificações em `docs/specs/`.
- `designer`: revisa telas, fluxos, microcopy e acessibilidade; recomenda, não implementa.
- `developer`: implementa e verifica no staging; não faz commit, push, merge nem toca em produção.
Todos começam sem memória: este arquivo é o contexto deles.
