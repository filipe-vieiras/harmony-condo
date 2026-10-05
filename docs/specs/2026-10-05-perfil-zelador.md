# PRD: Perfil de Zelador (mesmas permissões do Subsíndico) com contato automático no condomínio

Data: 05/10/2026 · Autor: PM · Status: **aguardando decisão do dono sobre as permissões (seção 3)**; sem produção agora.
Repositório público: nenhum dado real neste documento.
Legenda: **DECIDIDO** = decisão do dono. **PROPOSTA** = recomendação do PM, o dono ainda não decidiu.

## 0. Recomendação em 5 linhas

1. **Isto já existe em parte:** o **cadastro de contato do Zelador** já existe (tabela `zelador`, sem login), com cartão no Início
   e em Links e Documentos, editado à mão por Síndico/Subsíndico/ADM. O que **não existe** é o **perfil (login) de Zelador**.
   O que o dono pede é, na prática, ligar os dois: a pessoa ganha acesso e o cartão se preenche sozinho.
2. **Crie o perfil, mas não como espelho exato do Subsíndico (opção A).** Recomendo a **opção B**: Subsíndico **menos** o que é sensível
   (RG/CPF, multas, relatórios e histórico, usuários e convites, exportações). A decisão é do dono; se ele mantiver a A, a seção 6
   a detalha por inteiro.
3. **Cargo único** (como o Subsíndico), designado por Síndico e ADM, e **entra na transferência de cargo**.
4. **Contato automático em duas fases:** fase 1 perfil e permissões; fase 2 cartão alimentado pelo perfil, com **telefone de contato
   do condomínio próprio e opcional** (nunca o telefone pessoal por padrão) e estado vazio que **mantém o cadastro manual de hoje**.
5. Quem pagaria o custo da opção A é o morador: um perfil operacional, de rotatividade alta, leria CPF de todos e emitiria multa.

## 1. Problema e quem usa

**Quem sofre:** o **morador** (muitos, leigos, no celular, vindos de um link no WhatsApp) que precisa de algo do dia a dia
(vazamento, lâmpada, chave da área comum, entrega) e **não sabe a quem pedir**. Também sofrem a **Portaria**, o Conselho e a própria
gestão, que viram "central de telefone" do zelador.

**Como acha o zelador hoje (conferido no código):** só se o Síndico, Subsíndico ou ADM tiver digitado o nome, o telefone e o horário
na tela **Links e Documentos** (botão de editar no cartão "Zeladoria"). O cartão aparece então no **Início** (coluna de acessos
rápidos, só se houver nome) e em **Links e Documentos**. Se ninguém preencheu, o morador vê "Zelador" e "A administração ainda não
informou o horário". O dado é um registro único, **separado de qualquer conta**: se o zelador muda, alguém precisa lembrar de
reeditar. Não há login do zelador, então ele não vê reservas pendentes, não publica no mural e não registra nada no sistema.

**Se nada for feito:** o contato fica desatualizado a cada troca de zelador e o zelador segue sem ferramenta própria.

**Não sei (suposição a validar com o síndico):** quantos zeladores o condomínio tem, se são funcionários diretos ou de empresa, e se
usam o telefone pessoal para o trabalho.

## 2. O que existe hoje (conferido)

| Item | Onde | Situação |
|---|---|---|
| Perfil/papel `ZELADOR` | `src/types`, `roles.ts`, `profiles_role_check` (0022), seed, bateria | **Não existe.** Papéis: SINDICO, SUBSINDICO, ADM, PORTARIA, CONSELHO, MORADOR |
| Cadastro de contato do Zelador | tabela `zelador` (migração 0001, singleton `id = 1`); `fetchZelador`/`updateZeladorDB` em `db.ts`; `zelador` e `updateZelador` no `AppContext` | **Já existe** (nome, telefone, horário, observações), **sem login** |
| Leitura do cadastro | policy `zelador_read` (0028): `tem_perfil()` (qualquer conta com perfil, inclusive provisório) | já legível por todos os perfis |
| Escrita do cadastro | `zelador_update_admin`: `is_admin()` | Síndico, Subsíndico, ADM; a tela só mostra o lápis para `isSindico` (a conferir se inclui os três) |
| Cartão "Zeladoria" no Início | `src/app/page.tsx` | existe, só aparece com nome preenchido, link `tel:` |
| Cartão no Links e Documentos | `src/app/links/page.tsx` | existe, com estado vazio e modal de edição |
| `is_admin()` | 0022 | `role in ('SINDICO','SUBSINDICO','ADM')`; usado em quase todas as policies (0023 uniformizou) |
| `tem_perfil()` | 0028 | existe uma linha em `profiles` para `auth.uid()` |
| Singleton | índices `profiles_singleton_sindico`, `profiles_singleton_subsindico` | ADM de fora de propósito; Zelador não existe |
| Transferência de cargo | 0037, `api/usuarios/transferir-cargo`, `cargo_transferencias` | cargos `SINDICO`, `SUBSINDICO`, `CONSELHO`, `PORTARIA` (check na tabela e nas funções) |
| Rotas de convite e exclusão | `api/convites/enviar` (`ADMIN_ROLES`, `SINGLETON_ROLES`), `api/usuarios/excluir` (recusa Síndico) | precisam conhecer o novo papel |
| Rótulos | `ROLE_LABELS`, `ROLE_LABELS_CURTO` (`roles.ts`), `STAFF_ROLES` em `usuarios/page.tsx` | sem Zelador |
| Mock | `mockData.ts` cita "Zelador Sr. Antonio" | texto de exemplo, não é dado real do sistema |

## 3. O que "mesmas características do Subsíndico" significa NO CÓDIGO

Hoje **Síndico, Subsíndico e ADM são idênticos**: `ADMIN_ROLES = ['SINDICO','SUBSINDICO','ADM']` no código e `is_admin()` no banco.
Acrescentar `ZELADOR` a essa lista (opção A) daria a ele, de uma vez:

- **Todas as telas de gestão** da barra lateral: Início, Mural, Moradores e Unidades, Veículos, **Multas**, Reservas, Links e
  Documentos, **Relatórios**, **Usuários e Convites**, **Autocadastro**.
- **Dados pessoais dos moradores:** telefone, e-mail, responsável, dependentes e **RG/CPF do titular** (gravado no JSON de `units`;
  a issue #67 vai restringi-lo à gestão, e o Zelador entraria exatamente nesse grupo).
- **Multas:** ver todas, emitir, julgar recurso, **anular** (apagar continua só do ADM, regra de 02/10); ver o histórico de ações.
- **Reservas:** aprovar, recusar, cancelar, bloquear datas.
- **Unidades:** criar, editar, excluir; ligar conta a unidade; validar ou recusar autocadastros.
- **Usuários e convites:** convidar para cargos, redefinir senha de outras contas, excluir conta (a hierarquia da #68 limita isso:
  ninguém convida acima do próprio nível; mas o Zelador seria nível "gestão").
- **Mural, documentos, espaços, notificações e exportações para Excel** (moradores e veículos).
- **Não herdaria:** transferir cargo (só ADM e Síndico; o Subsíndico também não) e apagar multa (só ADM).

### 3.1 Contestação (a pedido do papel do PM; a decisão é do dono)

Argumentos contra o espelho exato:

1. **LGPD, necessidade e minimização.** O zelador é função **operacional**, muitas vezes empregado de empresa terceirizada, com
   rotatividade. Dar a ele CPF/RG de todos, e-mail e telefone dos moradores, multas e relatórios é o mesmo risco que a auditoria
   de 05/10 já classificou como **Alto** para Portaria e Conselho (A1) e que o dono decidiu **fechar** (RG/CPF só gestão, #67).
   Incluir o Zelador em `is_admin()` **reabre a porta** por outro perfil.
2. **Poder excessivo e hierarquia (#68, A2).** A auditoria mostra que a concentração de poder entre perfis de gestão já é um risco:
   um perfil de gestão pode agir sobre outro. Quanto mais gente em `is_admin()`, maior a superfície, e a regra "a #68 não age sobre
   nível igual ou superior" fica confusa se o Zelador é "igual ao Subsíndico". Um cargo operacional deveria ficar **abaixo** de
   Subsíndico na hierarquia, não ao lado.
3. **Multas.** A regra de produto é que **só o ADM apaga multa**, justamente para proteger o morador contra decisão apressada.
   Emitir e anular multa (poder sobre o dinheiro e a reputação do vizinho) por quem cuida da manutenção é conflito de interesse
   e risco de desentendimento (o zelador convive com os moradores todos os dias).
4. **Custo de uma conta a mais com poder total:** uma conta de zelador comprometida (celular compartilhado, senha anotada) vale
   o mesmo que a do Síndico, e as senhas de teste temporárias (`123456`, em staging) mostram como isso é frágil.
5. **O benefício real do dono** (zelador aparece como contato e usa o sistema para o dia a dia) **não exige** ver CPF nem emitir multa.

A favor do espelho exato (A): é a **mudança mais barata** (um valor a mais em `ADMIN_ROLES` e em `is_admin()`/`profiles_role_check`),
e é o que o dono pediu. O custo escondido: **qualquer corte futuro exigirá separar `is_admin()` em níveis**, o que é caro depois
que os dados já foram expostos.

### 3.2 Opções (UMA recomendação)

| | **A: espelho do Subsíndico** (pedido original) | **B: Subsíndico menos o sensível** (recomendada) | **C: operacional** |
|---|---|---|---|
| Telas | todas do Subsíndico | Início, Mural, Moradores e Unidades (sem RG/CPF), Veículos, Reservas, Links e Documentos | Início, Mural, Veículos, Reservas, Links e Documentos |
| Multas | vê, emite, anula | **nada** (some do menu e da API) | nada |
| Relatórios e histórico de ações | vê | **nada** | nada |
| Usuários, convites, autocadastro, redefinir senha, excluir conta | sim (limitado pela #68) | **nada** | nada |
| RG/CPF do titular | vê | **não** | não |
| Telefone/e-mail dos moradores | vê | vê (já vale para Portaria e Conselho; a decisão de 05/10 mantém) | só unidade e responsável (sem contato) |
| Reservas | aprova, recusa, cancela | aprova, recusa, cancela, bloqueia datas | aprova, recusa |
| Mural | publica, edita, exclui | publica, edita, exclui | publica avisos operacionais |
| Veículos | todos | todos | todos |
| Exportar Excel | sim | **não** | não |
| Editar o próprio contato do Zelador | sim | sim | sim |
| Custo | P (um valor a mais) | **M** (nova função de permissão + revisar policies de `is_admin()`) | M (idem, mais cortes) |
| Risco LGPD/poder | **alto** | médio-baixo | baixo |

**Recomendação: opção B.** Fica o mais perto possível do que o dono quer ("como o Subsíndico") e corta só o que expõe o morador
ou dá poder sobre ele: **RG/CPF, multas, relatórios e histórico, usuários e convites, autocadastro, exportações**. A diferença para
a C é pequena (unidades com telefone e bloqueio de datas) e dá ao zelador o que ele realmente usa no dia a dia. **Se o dono mantiver
a A, este PRD segue válido e a seção 6 especifica o espelho exato** (com os riscos registrados e uma nota para revisitar em 90 dias).

## 4. Cargo único ou vários zeladores (turnos)?

**Recomendo cargo único**, como Síndico e Subsíndico: o pedido diz "o Zelador", o cartão mostra uma pessoa, e a troca passa pela
**transferência de cargo** (que já garante atomicidade). Turnos reais (dois zeladores) é **pergunta ao dono** (seção 14); se
precisar, o cargo deixa de ser singleton, como Conselho e Portaria, e o cartão passa a listar mais de um (decisão de produto, não
técnica). Premissa deste PRD: **um zelador ativo por vez**.

## 5. Como o Zelador é criado

1. **Convite com o cargo:** em Usuários e Convites, o Síndico ou o ADM cria um convite com perfil Zelador (`api/convites/enviar` já
   tem a trava de singleton por `SINGLETON_ROLES`; `ZELADOR` entra nela). O **Subsíndico não designa** Zelador (a #68: ninguém
   convida para cargo acima do seu; o Zelador é **abaixo** dele, mas manter a designação com Síndico e ADM evita que um cargo
   operacional seja criado sem o Síndico saber). **PROPOSTA**; se o dono quiser que o Subsíndico também designe, é uma linha na
   regra, sem custo.
2. **Novo Usuário da Equipe:** `ZELADOR` aparece na lista de perfis da tela, com o texto de ajuda "Um Zelador por vez".
3. **Transferência de cargo:** `ZELADOR` entra entre os cargos transferíveis (acrescentar ao `check` de `cargo_transferencias`
   e às funções da 0037). Quem transfere: **Síndico e ADM** (como os demais). Quem perde o cargo vira Morador (ou provisório, sem
   unidade), conforme a regra já decidida em 04/10. **O zelador, em geral, não tem unidade:** com a regra atual ele viraria
   provisório, o que é correto (menor acesso) e a equipe decide depois se exclui.
4. **Perfil mutuamente exclusivo** (um perfil por conta): o Zelador não acumula Morador. Se o zelador também mora no condomínio,
   ele **mantém a unidade ligada** (as contas de equipe podem ter unidade), mas o perfil é só um.

## 6. Matriz perfil × tela × ação

Por tela, o que cada perfil faz. **Opção A** (espelho do Subsíndico) está na coluna "Zelador A"; **B** (recomendada) em "Zelador B".
Legenda: S = sim, N = não, L = só leitura, P = só a própria unidade, R = só RG/CPF mascarado ou ausente.

| Tela / ação | Síndico | Subsíndico | ADM | Zelador A | Zelador B | Conselho | Portaria | Morador | Provisório |
|---|---|---|---|---|---|---|---|---|---|
| Início, cartões e "Contato do Zelador" | S | S | S | S | S | S | S | S | S (só mural e lista) |
| Mural: ler | S | S | S | S | S | S | S | S | S |
| Mural: publicar/editar/excluir | S | S | S | S | S | N | N | N | N |
| Moradores e unidades: ver | S | S | S | S (com RG/CPF) | S (**sem** RG/CPF) | S (sem RG/CPF) | S (sem RG/CPF) | L (lista) | L (lista) |
| Moradores e unidades: criar/editar/excluir | S | S | S | S | N (só ver) | N | N | N | N |
| Veículos: ver/registrar/editar | S | S | S | S | S | L | S | P | N |
| **Multas: ver/emitir/julgar/anular** | S | S | S | **S** | **N** | L | N | P | N |
| Multa: apagar | N | N | S | N | N | N | N | N | N |
| Reservas: ver | S | S | S | S | S | L | S | P | N |
| Reservas: aprovar/recusar/cancelar | S | S | S | S | S | N | pedir | pedir | N |
| Links e Documentos: ver | S | S | S | S | S | S | S | S | N |
| Links e Documentos: editar contato do Zelador | S | S | S | S | S (**só o próprio**) | N | N | N | N |
| Relatórios e histórico | S | S | S | S | **N** | L | N | N | N |
| Usuários e convites: ver | S | S | S | S | **N** | N | N | N | N |
| Convidar/excluir/redefinir senha | S (#68) | S (#68) | S (#68) | S (#68) | **N** | N | N | N | N |
| Autocadastro: validar/recusar | S | S | S | S | **N** | N | N | N | N |
| Exportar Excel | S | S | S | S | **N** | N | N | N | N |
| Transferir cargo | S | N | S | N | N | N | N | N | N |
| Notificações: receber | S | S | S | S | S | S | S | S | S |

Observação sobre hoje: o Subsíndico **vê** a tela Usuários e Convites mas **não** a seção de transferência de cargo (decisão de 04/10).

## 7. O cartão "Contato do Zelador"

### 7.1 Onde aparece (PROPOSTA)
- **Início de todos os perfis com acesso** (inclusive Portaria e provisório): já existe como "Zeladoria"; passa a "Zelador" com os
  dados do perfil. No **celular**, aparece perto do topo para o morador (hoje está no fim da coluna).
- **Links e Documentos**, no mesmo cartão que já existe, agora com o texto "preenchido pelo perfil do Zelador".
- **Portaria:** nenhuma tela nova; a Portaria já vê o Início e o cartão.
- Rótulo do bloco: "Contatos do condomínio" (hoje há zelador e administradora separados; Administradora segue no seu cartão).

### 7.2 Quais dados (PROPOSTA)
| Dado | Mostra? | Observação |
|---|---|---|
| Nome | sim | do perfil |
| **Telefone de contato do condomínio** | sim, **se o próprio zelador preencheu** | campo **próprio e opcional**, nunca o telefone pessoal por padrão |
| Botão **WhatsApp** | sim, se houver telefone | link `https://wa.me/55DDDNÚMERO` só com dígitos; nenhuma mensagem pré-escrita com dado do morador |
| Horário de atendimento | sim, opcional | texto livre curto, como hoje |
| Foto | **não** nesta versão | exigiria bucket e consentimento próprio; avaliar depois |
| E-mail | **não**, a menos que o dono queira | o e-mail de login é identificador de conta, não contato |
| Observações | opcional | como hoje (ex.: "fora do horário, ligue para a portaria") |

### 7.3 De onde vêm (automático, sem digitar duas vezes)
- **Fonte única:** o perfil do Zelador ativo. Nome vem da conta; telefone de contato e horário vêm de dois campos novos do perfil
  dele (editados **por ele mesmo** em "Meu cadastro" ou por Síndico/ADM, por rota de servidor, já que `profiles` é só leitura para o
  navegador desde a 0027).
- **Como o morador lê:** uma **função/visão de leitura mínima** (`contato_zelador()`, `SECURITY DEFINER`, só devolve nome, telefone
  de contato e horário) ou a tabela `zelador` existente mantida em sincronia pela mesma rota. **O morador nunca lê a linha de
  `profiles` do zelador** (e-mail, role, datas ficam fora). A decisão técnica é do developer; o comportamento é este.
- Não há segundo formulário: o modal "Dados do Zelador Atual" em Links fica como **fallback** (7.4).

### 7.4 Estado vazio e transição (PROPOSTA)
- **Sem Zelador com perfil** → continua valendo o **cadastro manual de hoje** (nada some, nenhum cartão quebra). Os cartões
  mostram o que o Síndico digitou, como agora; se estiver vazio, o texto atual ("Zelador ainda não cadastrado" para a gestão e
  "A administração ainda não informou" para os demais; reavaliar redação com o designer).
- **Com Zelador com perfil** → o cartão passa a mostrar os dados do perfil; o botão de editar manual some e dá lugar a "Os dados
  vêm do perfil do Zelador" (a gestão pode, ainda, editar os campos de contato dele por rota de servidor).
- **Zelador com perfil mas sem telefone de contato** → mostra só nome e horário (se houver) e a frase "Contato pela administração".
- **Sai do cargo (transferência ou exclusão)** → o contato **some automaticamente** (ou volta ao cadastro manual, se houver) no
  mesmo instante, sem ação de ninguém. O cartão nunca mostra uma pessoa que já saiu.

### 7.5 Privacidade e LGPD (PROPOSTA)
- O telefone pessoal do zelador **não** é exposto a todos os moradores por padrão. Campo **"telefone de contato do condomínio"**
  separado, **opcional**, preenchido só pelo próprio zelador (ou por gestão **com ciência dele**). Se vazio, o morador não vê
  telefone.
- **Ciência e concordância:** na primeira vez que o zelador entra, ele vê a frase "Seu nome, telefone de contato e horário
  aparecem para todos os moradores. Você pode deixar o telefone em branco." e confirma. Isso é aviso de produto; a **base legal
  (execução de contrato de trabalho/prestação de serviço ou consentimento) fica "a confirmar com advogado"**, sobretudo se o
  zelador for de empresa terceirizada, caso em que o dado também pode ser do empregador.
- Sem foto, sem e-mail, sem endereço, sem CPF no cartão. O morador só vê o que o cartão mostra.
- **Link de WhatsApp (`wa.me`)** só com o número, sem texto pré-preenchido com nome ou unidade do morador (nada sobre o morador vai
  para terceiros) e com `rel="noopener noreferrer"`. O morador sabe que está abrindo o WhatsApp dele.
- **Retenção:** quando o cargo sai, o telefone de contato deixa de ser exibido; o campo pode ser apagado junto com a conta pela
  gestão (a mesma rotina de exclusão).

## 8. Impacto técnico (para o developer; sem código neste PRD)

Banco
- `profiles_role_check` e `pending_invites_role_check`: acrescentar `'ZELADOR'` (padrão da 0022).
- Singleton: `profiles_singleton_zelador` (índice único parcial em `role = 'ZELADOR'`), se cargo único.
- `is_admin()`: **opção A** acrescenta `'ZELADOR'`. **Opção B/C** **não** mexe em `is_admin()`; cria uma função nova
  (ex.: `is_gestao_operacional()`: Síndico, Subsíndico, ADM, Zelador) e troca nas policies de **mural, reservas, veículos,
  espaços, documentos e `zelador`** só o que o Zelador precisa. Policies que listam perfis na mão (0023: vehicles, fines etc.)
  precisam ser revistas, uma a uma.
- `tem_perfil()`: continua igual (qualquer linha em `profiles`); o Zelador herda o acesso básico.
- `get_user_role()` e funções que listam papéis (`can_manage_reservations`, 0023 e 0034): incluir o Zelador onde a opção escolhida
  o permite.
- Transferência de cargo (0037): `cargo_transferencias_cargo_check`, `_cargo_rotulo`, `_trocar_cargo`, validação de destino e
  perfil de quem perde o cargo; índices de pendência `cargo_transf_pendente_cargo_unico` passam a cobrir `ZELADOR`.
- RLS e notificações: nenhum aviso novo obrigatório; o Zelador recebe os avisos de equipe que a opção escolhida permitir (reservas
  pendentes, mural). Decidir se ele vê "reserva pendente" (opção B/C: sim).
- **Contato:** dois campos no perfil (`telefone_contato`, `horario_atendimento`) mais a função de leitura mínima 7.3; ou
  sincronizar a tabela `zelador`. **Não** dar `select` em `profiles` ao morador.
- Seed (`scripts/seed-staging.mjs`): conta de teste de Zelador, mais `zelador2` para o teste de transferência.

Código
- `Role`, `ROLE_LABELS`, `ROLE_LABELS_CURTO`, `ADMIN_ROLES` (só na A), `SINGLETON_ROLES`, `STAFF_ROLES` em `usuarios/page.tsx`,
  `Sidebar.tsx` (a lista de `roles` por item de menu), `isAdmin()` e as telas que usam `isSindico` ou `isAdmin` para esconder ações.
- Rotas: `api/convites/enviar` (papéis aceitos, hierarquia da #68, trava de singleton), `api/usuarios/excluir` (Zelador pode
  ser excluído pela gestão; manter a trava do Síndico), `api/usuarios/resetar-senha` (hierarquia #68), `api/usuarios/transferir-cargo`
  (novo cargo).
- Cartões em `page.tsx` e `links/page.tsx`: ler o contato novo, mantendo o fallback manual.

Bateria (`scripts/qa/`)
- Casos por perfil (seção 10), mais o do contato automático e o da saída do cargo.

## 9. Segurança e hierarquia (#68)

- O Zelador fica **abaixo** de Síndico, Subsíndico e ADM na hierarquia: eles podem redefinir a senha dele e excluí-lo, ele **nunca**
  age sobre eles (e, na opção B/C, sobre ninguém).
- Convidar ou designar Zelador exige ser Síndico ou ADM; o servidor valida pelo perfil lido do banco, não pelo navegador.
- Escalada: Zelador não pode virar Subsíndico/Síndico/ADM por nenhuma rota; quem recebe cargo acima perde o de Zelador (um perfil só).
- O **telefone de contato** que o próprio zelador edita só altera o próprio registro (verificado no servidor).
- Ações sensíveis (designar, remover, transferir) entram no histórico **gravado pelo servidor**, como já decidido na #68.

## 10. Critérios de aceite (testáveis; celular 375px e desktop)

Perfil e permissões (fase 1)
1. Como **Síndico** e como **ADM**, crio um convite com perfil Zelador; com um segundo Zelador ativo, o sistema recusa com
   "Já existe um usuário ativo com o perfil ZELADOR" (mensagem em português revisada). Como **Subsíndico**, não consigo designar.
2. Como **Zelador** (opção escolhida pelo dono):
   - **B/C:** não vejo Multas, Relatórios, Usuários, Autocadastro nem exportações no menu; a API responde 403; RG/CPF **não** vem
     em consulta direta a `units`; vejo e uso Mural, Reservas (aprovar/recusar), Veículos, Links e Documentos.
   - **A:** vejo tudo o que o Subsíndico vê, e nada além dele.
3. **Subsíndico, Conselho, Portaria, Morador, provisório e visitante** têm o mesmo comportamento de antes (sem regressão); o novo
   papel não aparece nem funciona para eles.
4. **Escalada:** Zelador não consegue, por API direta, trocar o próprio perfil, convidar, redefinir senha, excluir conta,
   transferir cargo ou apagar multa; recebe 403/400 com mensagem em português.
5. **Hierarquia (#68):** Subsíndico e ADM redefinem a senha do Zelador; o Zelador não redefine a de ninguém.
6. **Transferência:** Síndico e ADM transferem o cargo de Zelador para um morador ou para pessoa nova (cargo pendente até aceitar);
   o Zelador anterior vira Morador (ou provisório, sem unidade) e perde as permissões na **próxima requisição**.
7. Visual: o novo perfil tem selo e rótulo ("Zelador") na tela Usuários e no cabeçalho, legíveis em 375px, alvos de toque de 44px.

Contato automático (fase 2)
8. Ao criar o Zelador e ele preencher nome, telefone de contato e horário, **o cartão aparece no Início e em Links e Documentos
   de todos os perfis sem ação extra**; um morador vê só nome, telefone de contato, botão WhatsApp e horário.
9. Telefone vazio: o cartão mostra nome e horário, sem botão de ligar nem WhatsApp. Sem Zelador com perfil: vale o cadastro manual
   (e, se vazio, o estado vazio atual).
10. O botão WhatsApp abre `wa.me` só com dígitos e sem texto; o telefone com máscara/ramal não gera link quebrado.
11. Saída do cargo (transferência ou exclusão): o cartão deixa de mostrar o zelador anterior **sem recarregar o banco à mão**.
12. **Privacidade:** consulta direta do morador à API não devolve e-mail, perfil ou outros campos do zelador; só os do cartão.
    O aviso de ciência aparece no primeiro acesso do Zelador.
13. Layout: o cartão cabe em 375px sem rolagem horizontal, sem texto cortado; alvos de toque de 44px; contraste conferido.

Bateria
14. `scripts/qa/` cobre: papel por perfil (Zelador, Subsíndico, Conselho, Portaria, Morador, provisório, visitante), escalada de
    papel, hierarquia, singleton, transferência e saída, e a privacidade do contato. QA no staging aprova antes do dono testar.

## 11. Riscos

- **Poder excessivo se a opção A for mantida** (seção 3.1): CPF e multas expostos a um perfil operacional de alta rotatividade.
  Mitigação: registrar o risco, revisitar em 90 dias, e a #67 (RG/CPF) passa a considerar o Zelador.
- **Custo de suporte:** mais um papel nas telas de equipe (selos, filtros). Mitigação: reaproveitar o padrão do Subsíndico.
- **Custo de implementação B/C:** separar `is_admin()` mexe em várias policies (risco de regressão). Mitigação: bateria por perfil
  antes e depois, em staging.
- **LGPD do telefone:** base legal indefinida (a confirmar com advogado), possibilidade de o zelador ser de empresa terceirizada.
- **Dados duplicados:** durante a transição, cadastro manual e perfil coexistem. Mitigação: o perfil sempre vence; o manual é só
  fallback e some quando houver Zelador.
- **Zelador sem unidade vira "provisório" ao sair:** conta esquecida; o aviso da transferência já cobre.

## 12. Fases

**Fase 1: perfil e permissões** (esforço M com B; P com A)
- Papel `ZELADOR` no banco e no código, convite, Novo Usuário, selo e rótulo, permissões da opção escolhida, singleton,
  transferência de cargo, exclusão, hierarquia, seed e bateria.

**Fase 2: cartão de contato automático** (esforço P)
- Dois campos do perfil e função de leitura mínima; cartão do Início e de Links alimentado pelo perfil; telefone de contato próprio e
  opcional; aviso de ciência; WhatsApp; estado vazio com fallback manual; some quando o cargo sai.

Esforço total: **G** (as duas fases juntas com B/C).

## 13. O que fica de fora

- Vários zeladores simultâneos (turnos) (decisão do dono, seção 14).
- Foto do zelador, e-mail no cartão, avaliação do zelador, chat ou chamado de manutenção.
- Ordens de serviço e controle de ocorrências ("Livro de Reclamações" tem outra spec).
- Perfis novos além do Zelador (ex.: Faxineira, Jardineiro).
- Vários condomínios.
- Dar ao Zelador poder de apagar multa (continua só do ADM).
- Integração com WhatsApp além do link `wa.me` (nenhum envio automático).

## 14. Perguntas em aberto ao dono (máximo 2)

1. **Permissões do Zelador:** A (espelho exato do Subsíndico, como pediu), **B (recomendada: Subsíndico menos RG/CPF, multas,
   relatórios, usuários, convites e exportações)** ou C (só operacional)? Se mantiver A, o PRD segue com a seção 6 como está e o
   risco fica registrado.
2. **Um zelador ou vários (turnos)?** O PRD assume **um por vez**, com troca pela transferência de cargo. Se houver dois, o cartão
   lista os dois e o cargo deixa de ser singleton.

(Premissa declarada, sem pergunta: o telefone do cartão é um campo próprio do condomínio, opcional e preenchido pelo próprio
zelador; a base legal fica a confirmar com advogado.)

## 15. Trecho proposto para `docs/produto.md` (só após aprovação do dono)

> **Perfil de Zelador (05/10/2026).** O contato do Zelador já existe como cadastro manual (sem login). O dono pediu um perfil de
> Zelador com as características do Subsíndico e contato automático para todos. Recomendação do PM: opção B (Subsíndico menos
> RG/CPF, multas, relatórios, usuários e exportações), cargo único designado por Síndico e ADM, telefone de contato próprio e
> opcional (LGPD). Fase 1 perfil e permissões; fase 2 cartão de contato. Especificação: `docs/specs/2026-10-05-perfil-zelador.md`.
