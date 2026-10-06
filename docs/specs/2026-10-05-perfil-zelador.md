# PRD: Perfil de Zelador (operacional, sem dados sensíveis) com contato automático no condomínio

Data: 05/10/2026, reescrito em 06/10/2026 com as decisões do dono · Autor: PM · Status: **regra decidida; Zelador externo e motivo da interdição decididos em 06/10/2026; 1 pergunta aberta (seção 13)**; sem produção agora.
Repositório público: nenhum dado real neste documento.
Legenda: **DECIDIDO** = decisão do dono. **PROPOSTA** = recomendação do PM, a confirmar.

## 0. Resumo

1. **DECIDIDO (06/10/2026):** o Zelador é um perfil **operacional**. Substitui as opções A, B e C do PRD de 05/10.
2. **Cargo único** ("somente um Zelador"), designado por **Síndico e ADM**, e **entra na transferência de cargo**.
3. **Sem dados sensíveis:** nada de RG/CPF, multas, situação financeira, relatórios e auditoria, usuários e convites, exportações,
   validação de autocadastro e transferência de cargo.
4. **Pode:** aprovar/recusar reservas, **cancelar reservas (inclusive já aprovadas)**, **registrar reservas em nome de morador**, ver **nome, telefone e
   e-mail** de moradores e dependentes, **interditar espaço** (bloqueia só **novos** pedidos; nada existente é cancelado), e as demais
   funcionalidades operacionais da seção 4 (lista conservadora **aprovada** pelo dono, com a inclusão de cancelar reserva).
5. Os dados do Zelador aparecem **automaticamente** como contato do Zelador (fase 2).
6. **DECIDIDO (06/10/2026): o Zelador é sempre um FUNCIONÁRIO EXTERNO.** Não mora no condomínio e **não tem unidade** (profile sem unidade ligada). Convite com o cargo, sem
   autocadastro e sem validação de morador (seção 3.1). **Quem sai do cargo tem o acesso REMOVIDO** (conta desativada, histórico preservado), nunca vira Morador/provisório (seção 3.1.3).
7. **DECIDIDO (06/10/2026): a interdição pode ter um MOTIVO opcional**, que o morador vê como "Em manutenção: {motivo}" (seção 4.2).
8. **Dependência dura:** hoje o RG/CPF do titular está dentro de `units.moradores` (JSON legível por quem lê `units`). **O Zelador só pode
   ler `units` depois que a #67 separar o documento em tabela própria.** A #67 vai primeiro (fase 0).

## 1. Problema e quem usa

**Quem sofre:** o **morador** (muitos, leigos, no celular, vindos de um link no WhatsApp) que precisa de algo do dia a dia
(vazamento, lâmpada, chave da área comum) e não sabe a quem pedir; e o **Síndico**, que faz sozinho o que o zelador poderia fazer
(confirmar reserva, bloquear espaço com problema, registrar pedido de quem não usa o app).

**Hoje (conferido no código):** o contato do Zelador é um **cadastro manual sem login** (tabela `zelador`, singleton, cartão no Início
e em Links e Documentos), editado à mão pela gestão e desatualizado a cada troca. O zelador não tem acesso ao sistema.

**Se nada for feito:** contato desatualizado, e o síndico segue como gargalo operacional.

**A validar com o síndico (não sei):** se o zelador é funcionário direto ou de empresa, e se usa celular próprio para o trabalho.

## 2. O que existe hoje (conferido)

| Item | Situação |
|---|---|
| Papel `ZELADOR` | **Não existe.** `Role` e `profiles_role_check` (0022) têm SINDICO, SUBSINDICO, ADM, PORTARIA, CONSELHO, MORADOR |
| Cadastro de contato (tabela `zelador`, 0001) | existe, singleton `id = 1`; leitura `zelador_read` por `tem_perfil()` (0028); escrita `zelador_update_admin` por `is_admin()` |
| `is_admin()` (0022) | `role in ('SINDICO','SUBSINDICO','ADM')`; usada em quase todas as policies (0023). **Não será alterada.** |
| `tem_perfil()` (0028) | existe linha em `profiles` para `auth.uid()` |
| `units_read` (0025) | `get_user_role()` em SINDICO, SUBSINDICO, ADM, PORTARIA, CONSELHO, ou `usuario_id = auth.uid()`. O RG/CPF do titular vive dentro de `units.moradores` (JSON) |
| `spaces` | tem `ativo boolean` (0007); escrita `spaces_write_staff` por `is_admin()` (0013); trigger de auditoria só de `exige_aprovacao` (0034) |
| Reservas | `reservations_update_admin`/`_delete_admin` por `is_admin()` (0023); insert `reservations_insert` (0034); gatilho de conflito checa `spaces.ativo` (0032) |
| Singleton | índices `profiles_singleton_sindico` e `_subsindico`; sem Zelador |
| Transferência de cargo (0037) | cargos `SINDICO`, `SUBSINDICO`, `CONSELHO`, `PORTARIA` no `check` de `cargo_transferencias`, em `transferir_cargo`, `_cargo_rotulo`, `_trocar_cargo`; `cargo_transferencias_select` por `is_admin()` |
| `Sidebar.tsx` | lista `roles` por item; `ADMIN_ROLES` usado para Início, Mural, Moradores, Veículos, Multas, Reservas, Links, Relatórios, Usuários, Autocadastro |
| `roles.ts` | `ADMIN_ROLES`, `SINGLETON_ROLES`, `ROLE_LABELS`, `ROLE_LABELS_CURTO` sem Zelador |
| Rotas | `api/convites/enviar`, `api/usuarios/excluir`, `api/usuarios/resetar-senha`, `api/usuarios/transferir-cargo` precisam conhecer o papel |

## 3. Regra decidida (DECIDIDO, 06/10/2026)

**Pode:**
1. Confirmar reservas (**aprovar/recusar pendentes**) e **cancelar reservas, inclusive já aprovadas** (decisão de 06/10/2026).
2. **Realizar (registrar) reservas em nome de morador.**
3. Ver **nome, telefone e e-mail** dos moradores e dos dependentes.
4. **Interditar um espaço:** bloqueia **somente novos pedidos**; reativar volta a aceitá-los. **Não cancela nada** (seção 4.1).
5. Outras funcionalidades que ajudem o síndico na operação (seção 4; lista conservadora aprovada).

**Não pode (lista do dono):** RG/CPF e qualquer documento; multas; situação financeira; relatórios e auditoria; usuários e convites;
exportações; validação de autocadastro; transferência de cargo.

### 3.1 Zelador externo, sem unidade (DECIDIDO, 06/10/2026)

**1. Como é convidado.** Convite com o cargo `ZELADOR`, **sem bloco, unidade ou `unit_id`**, só por **Síndico e ADM** (a tela de convite esconde bloco/unidade para esse cargo).
Se já há Zelador ativo, o convite vira **transferência para pessoa nova** (seção 5.6). **Não há autocadastro** de Zelador (o formulário público só cria Morador provisório) e ele **não passa pela
validação de morador**: o perfil nasce `ZELADOR` com `cadastro_validado = true` no aceite do convite (`definir-senha`). Regras no banco, não só na tela:
- `profiles`: um perfil `ZELADOR` **nunca tem unidade ligada**. Gatilho em `units` recusa gravar `usuario_id` de uma conta `ZELADOR` ("O Zelador é funcionário externo e não pode ser ligado a uma unidade"); vale
  também para "vincular unidade a conta existente" (`vinculoUnidade.ts`) e para o convite de morador.
- Conta **já existente** com unidade não vira Zelador (nem por convite nem por transferência). Mudar de morador para Zelador exige conta nova.

**2. Login e sessão sem unidade.** Login, `definir-senha`, o perfil carregado no `AppContext` e o papel relido do banco funcionam como hoje; o que muda é que **nada pode depender de ter unidade** para o Zelador.
Mapa do que precisa ser conferido (o developer corrige o que quebrar; a bateria cobre o Zelador **sem unidade**):

| Onde | Dependência de unidade hoje | Para o Zelador |
|---|---|---|
| `get_my_unit_id()` (0018) e policies de `fines` (0018), `vehicles` (0020, 0023, 0030), 0028 (uma policy em `unit_id`), 0040 (documento do titular) | devolve `null` sem unidade; `unit_id = null` nunca é verdadeiro | **Não quebra, mas nega**: onde o Zelador pode agir (`vehicles` ver/inserir, `reservations`), a policy ganha o ramo `tem_perfil_operacao()` (seção 5); `fines` e documento seguem sem ele |
| `AppContext.tsx` `minhaUnidade` (≈1410-1417, filtro do sino) | `undefined` | Avisos com unidade-alvo não chegam a ele (correto); avisos por perfil `ZELADOR` e gerais chegam. Conferir que `undefined === undefined` não casa aviso sem alvo de unidade por engano |
| `multas/page.tsx`, `multas/[id]/page.tsx` | `minhaUnidade?.id` para Morador | Zelador não entra (menu oculto e redirecionamento); sem erro de tela |
| `veiculos/page.tsx` (≈280-285: `ehEquipe`, `isMorador && minhaUnidade`) | Morador vê só da unidade | Zelador **precisa** ser tratado como operação (vê todos, cadastra veículo e visitante escolhendo a unidade); hoje cairia no ramo de morador e ficaria sem nada |
| `reservas/page.tsx` e formulário | unidade do solicitante para Morador | Zelador registra **em nome de morador escolhendo a unidade**; nunca assume a própria |
| `moradores/page.tsx`, `usuarios/page.tsx` | coluna/vínculo de unidade | Zelador aparece em Usuários como "Zelador (funcionário externo)", sem unidade; não aparece em "ligar conta" |
| `lib/roles.ts` `isProvisorio` (MORADOR + `cadastroValidado === false`) | provisório = Morador sem validação | Zelador **nunca** é provisório (papel `ZELADOR`, validado) |
| `Início` (`page.tsx`) | cartões de morador por unidade | Início operacional próprio (seção 4); sem cartão "minha unidade" |
| `api/usuarios/excluir` | desvincula `units` da conta | sem unidade, não toca em `units`; segue válido |
| `api/convites/enviar` | usa `invite.unit_id`, `bloco`, `unidade` | aceitar `null` nos três para `ZELADOR` |

**3. O que acontece quando ele sai do cargo (REGRA RECOMENDADA: acesso removido, conta desativada, sem exclusão).**
A regra de 04/10 (vira Morador, ou provisório sem unidade) **não serve** a um funcionário externo: ele ficaria como "provisório" e veria o diretório de unidades (#75) e o autocadastro, sem ter
nada a ver com o condomínio. Para o Zelador a regra é **uma só**:

> Ao sair do cargo, o **acesso é removido na mesma hora**: a conta é **desativada** (não excluída), a sessão cai e ele não entra mais. O histórico de ações dele fica preservado.

- **Banco:** coluna nova `profiles.desativado_em timestamptz`. `tem_perfil()` e `get_user_role()` passam a tratar conta com `desativado_em` preenchido como **sem perfil** (nenhuma policy, inclusive `units_read` e o diretório, devolve linha). O índice
  singleton `profiles_singleton_zelador` ignora desativados (`where role = 'ZELADOR' and desativado_em is null`). O papel não vira Morador: nunca existe estado "Zelador que virou provisório".
- **`_trocar_cargo` (0037):** novo ramo: se `p_cargo = 'ZELADOR'`, quem sai **não** passa por `update ... role = 'MORADOR', cadastro_validado = v_tem_unidade`; recebe `desativado_em = now()` (papel e histórico intactos) e quem entra recebe `ZELADOR`, `cadastro_validado = true`, `desativado_em = null`. `transferir_cargo`: aceita `ZELADOR` só com executor Síndico/ADM e
  **só para pessoa nova** (rejeita destino existente com `cargo_invalido`); `_cargo_rotulo` ganha "Zelador"; `v_poderes` ganha o texto operacional; `cargo_transferencias_cargo_check` e o índice de pendência única incluem `ZELADOR`. O retorno traz `origemAcessoRemovido = true` (no lugar de `origemProvisorio`) e a auditoria grava "acesso removido" sem e-mail nem telefone.
- **`iniciar_transferencia_cargo`:** para `ZELADOR` o perfil do convidado nasce **desativado** (`desativado_em` preenchido, sem unidade), não como "Morador provisório"; o aceite o ativa. Assim, nem durante o convite existe conta sem poder vendo o diretório.
- **Rota de servidor (`api/usuarios/transferir-cargo`):** depois da função, aplica **ban no Auth** (`updateUserById` com `ban_duration`) e encerra as sessões. O banco já barra sozinho na próxima requisição; o ban é cinto e suspensório. Falha no ban **não** desfaz a transferência e é registrada.
- **Aviso à pessoa que sai:** o sino dela não será lido (acesso removido); a notificação vai a **Síndico e ADM**: "O acesso de {nome} como Zelador foi removido." A pessoa vê, ao tentar entrar: "Seu acesso a este condomínio foi encerrado. Fale com a administração."
- **Assistente (Transferir cargo), passo 2:** para o Zelador **não há escolha de "o que ele vira"**. Mostra texto fixo e calmo: "**O acesso de {nome} será removido.** Ele deixa de entrar no sistema. O histórico de ações dele continua guardado." A opção explícita "**Remover o acesso desta pessoa**" aparece **marcada e travada** para o Zelador (informativa; a regra não tem variante), com o destino sendo "Pessoa nova" (sem "Usuário já cadastrado"). A confirmação segue a de Portaria/Conselho (sem digitar TRANSFERIR). Texto final: designer.
- **Sem cadastro duplicado:** o ex-Zelador some do diretório e das listas operacionais; em **Usuários** aparece como "Acesso removido" e pode ser **excluído** (rota atual, LGPD) ou, se a gestão precisar, **reativado**; reativar só é permitido se o cargo estiver vago.
- **Histórico preservado:** `audit_logs` guarda nome e papel de quem agiu no momento (já é assim); desativar não apaga nem reescreve. Excluir a conta depois segue a regra atual de exclusão.
- **Se o cargo ficar vago** (acesso removido sem novo Zelador, ou nunca houve): Síndico e ADM veem no Início operacional o aviso "O cargo de Zelador está vago. Convide uma pessoa."; o cartão de contato (seção 6) **some** para os moradores, a não ser que exista o cadastro manual de hoje preenchido, que volta a valer como fallback.

## 4. Matriz perfil × tela × ação do Zelador

**D** = decidido pelo dono · **P** = proposta conservadora do PM, **aprovada pelo dono em 06/10/2026** (sem outras mudanças além de cancelar reserva) · **N** = não pode.

| Tela / ação | Zelador | Origem |
|---|---|---|
| Início operacional (reservas pendentes, interdições, contato) | vê | P |
| Reservas e calendário de **todos** os espaços: ver | S | P (D implícito) |
| Reservas: aprovar / recusar pendentes | S | **D** |
| Reservas: registrar em nome de morador | S | **D** |
| Reservas: **cancelar** (pendente ou já aprovada), com a **mesma auditoria e a mesma notificação ao morador** das demais perfis | **S** | **D** (06/10) |
| Reservas: excluir definitivamente (apagar registro) | N | P (cancelar não é apagar; fica com a gestão) |
| Espaços: interditar / reativar (só o campo `ativo`; bloqueia só novos pedidos) | S | **D** |
| Espaços: cadastrar, excluir, mudar valor, faixa de pessoas, exigência de aprovação, bloqueios de data | **N** | P (da gestão) |
| Moradores e Unidades: ver unidade, nome, telefone, e-mail, **dependentes** | S, **sem documento** | **D** |
| Moradores e Unidades: criar, editar, excluir, ligar conta | N | P |
| Veículos: ver; cadastrar veículo e visitante | S | P |
| Veículos: editar/excluir de morador | N | P |
| Mural: ler | S | P |
| Mural: publicar avisos | S (só os próprios; não edita nem exclui os de outros) | P |
| Links e Documentos: ler | S | P |
| Links e Documentos: editar o **próprio** contato (telefone de contato, horário) | S | P (fase 2) |
| Notificações operacionais (reserva pendente) | recebe | P |
| RG/CPF e qualquer documento | **N** | **D** |
| Multas e situação financeira | **N** | **D** |
| Relatórios, histórico de ações, auditoria | **N** | **D** |
| Usuários, convites, redefinir senha, excluir conta | **N** | **D** |
| Exportações (Excel) | **N** | **D** |
| Autocadastro (validar/recusar) | **N** | **D** |
| Transferir cargo (qualquer) | **N** | **D** |

### 4.1 Interdição de espaço: semântica (DECIDIDO, 06/10/2026)

- **Interditar bloqueia somente NOVAS reservas.** Novos pedidos ficam indisponíveis para **todos** os perfis (morador, Portaria, Zelador, gestão).
- **Reservas futuras já existentes (pendentes ou aprovadas) NÃO são canceladas nem alteradas.** Se houver problema com elas, **Síndico, Subsíndico,
  ADM ou Zelador as cancelam manualmente**, uma a uma, pela tela de Reservas.
- **Reativar** volta a aceitar novos pedidos; não mexe em nada existente.
- **Função `interditar_espaco(id, ativo, motivo)`** (`SECURITY DEFINER`): altera **apenas** `spaces.ativo` e `spaces.motivo_interdicao`, relê o perfil no banco, grava auditoria. **Não**
  toca em `reservations` nem em notificações.
- **Quem barra é o banco:** a validação/gatilho de novas reservas (conflito, 0032) já recusa espaço com `ativo = false`. Isso vale para qualquer
  perfil e qualquer rota, inclusive consulta direta; a tela só espelha. Atualizações de reservas **existentes** (aprovar, recusar, cancelar) seguem
  permitidas num espaço interditado.
- **Tela ao interditar com reservas futuras:** confirmação em texto calmo, sem alarme. Mostra a **contagem** de reservas futuras do espaço
  (pendentes e aprovadas, separadas) e o texto: "Nenhuma reserva foi cancelada. Daqui para frente ninguém consegue fazer novos pedidos
  para este espaço. As reservas que já existem continuam valendo; se alguma precisar ser cancelada, faça isso pela tela de Reservas." Com o atalho
  **"Ver reservas futuras deste espaço"** (abre Reservas filtrada pelo espaço, de hoje em diante). Sem reservas futuras, a mensagem é só a primeira frase.
  Texto final e posição: designer. Mesma contagem e atalho ficam visíveis enquanto o espaço estiver interditado e houver reservas futuras.
- **O que o morador vê:** o espaço aparece com o selo **"Em manutenção"** (com o motivo, quando houver: **"Em manutenção: {motivo}"**, seção 4.2) e o botão de reservar desativado.
  Reservas dele já feitas nesse espaço continuam aparecendo normalmente.
- **Notificações:** a interdição **não gera notificação automática** ao morador nem à gestão sobre reservas futuras. O **cancelamento manual**
  notifica o morador **como hoje** (mesmo texto e canal). A gestão vê o estado do espaço e a contagem na tela e no Início operacional.
- **Auditoria:** a interdição e a reativação são gravadas no servidor (quem, espaço, quando, novo estado), sem dado pessoal.

### 4.2 Motivo da interdição (DECIDIDO, 06/10/2026)

- **Campo opcional** no diálogo de interdição, **uma linha, até 140 caracteres** (contador visível). Sem motivo, o morador vê só "Em manutenção", como já está decidido.
- **Gravação:** pela própria `interditar_espaco(id, ativo, motivo)`, em coluna nova **`spaces.motivo_interdicao text`** (`check (char_length(motivo_interdicao) <= 140)`). A função faz `btrim`, troca quebras de linha e caracteres de controle por espaço, recusa texto acima de 140 e
  **só grava motivo quando `ativo = false`**; ao **reativar, a coluna é limpa** (`null`). Interditar de novo com outro texto atualiza o motivo (a gestão ou o Zelador corrigem sem reativar).
- **Quem escreve:** só **Síndico, Subsíndico, ADM e Zelador**. A função relê o perfil do banco e responde 403 para Portaria, Conselho, Morador, provisório e visitante. **Ninguém escreve por `UPDATE` direto** em `spaces` (Zelador continua sem `UPDATE` na tabela); `spaces_write_staff` segue só para a gestão.
- **Quem lê:** quem já lê `spaces` (todos os perfis com conta) vê a coluna. O morador **lê o motivo, mas não escreve**.
- **Como o morador vê:** "Em manutenção: {motivo}", sempre como **texto puro** (nunca HTML, link ou formatação; escapado na tela). Sem motivo: "Em manutenção".
- **Texto de apoio abaixo do campo (para quem escreve):** "Escreva só o que o morador precisa saber, sem nomes de pessoas. Este texto aparece para todos os moradores." (final: designer). Exemplo de placeholder: "Reforma da piscina até 20/10".
- **Auditoria (servidor):** interdição, reativação e **mudança de motivo** gravadas com quem fez, espaço, novo estado e o motivo (texto público, sem dado pessoal). Por isso há sempre **quem escreveu**.
- **Riscos e mitigação:**
  - *Texto livre e público:* limite de 140, uma linha, sem formatação, texto de apoio pedindo "sem nomes", e a gestão pode ler, editar ou apagar o motivo a qualquer momento.
  - *LGPD:* o campo pode receber dado pessoal por descuido (ex.: nome de morador). Mitigação: texto de apoio, auditoria com autoria, limpeza ao reativar (não fica motivo velho guardado) e o motivo **não entra em exportação nem em relatório de terceiros**. Sem detecção automática de nome (custo maior que o ganho).
  - *Moderação e tom:* só 4 perfis de confiança escrevem; o Zelador tem rotatividade alta, mas a autoria na auditoria e o poder da gestão de corrigir cobrem. Sem fila de aprovação.
  - *Motivo velho enganando:* limpar ao reativar e mostrar o motivo só enquanto o espaço está interditado.

Os demais perfis **não mudam** (Síndico, Subsíndico, ADM como hoje; Conselho, Portaria, Morador, provisório, visitante sem regressão).

## 5. Regras de banco (sem virar `is_admin()`)

1. **`is_admin()` não é alterada.** Nenhuma policy atual de multas, `audit_logs`, `profiles` de terceiros, autocadastros, `pending_invites`,
   `cargo_transferencias`, notificações de gestão ou documentos passa a aceitar o Zelador.
2. **Função de nível próprio**, ex.: `tem_perfil_operacao()` (ou `is_gestao_ou_zelador()`): Síndico, Subsíndico, ADM **ou** Zelador, lida de
   `profiles` a cada chamada. Usada **só onde a seção 4 permite**, policy por policy, listadas no PR:
   - `reservations`: ver todas; atualizar status (aprovar, recusar, **cancelar**, inclusive aprovadas); inserir em nome de morador. Sem `delete`
     (cancelar é mudança de status, não apagar). O cancelamento pelo Zelador passa pelo **mesmo caminho** (e mesma auditoria e notificação ao morador) do cancelamento da gestão.
   - `spaces`: **só leitura** para o Zelador. A interdição vai por **função `SECURITY DEFINER` (ex.: `interditar_espaco(id, ativo, motivo)`)** que
     altera **apenas** `spaces.ativo` e `spaces.motivo_interdicao` (seção 4.2), relê o perfil no banco e grava a auditoria no servidor; **não** mexe em reservas (seção 4.1). **Não** abrir `UPDATE` na tabela, porque a
     RLS é por linha e daria acesso a valor, faixa e aprovação.
   - `units`: leitura (nome, telefone, e-mail, responsável, dependentes). **Pré-requisito: #67 concluída**, com o documento em tabela
     própria e `units.moradores` sem RG/CPF. Antes disso, **o Zelador não entra em `units_read`.**
   - `vehicles`: ver e inserir (veículo e visitante).
   - `notices`: ler e inserir só com `autor` dele (sem update/delete de outros).
   - `documents`/links: leitura.
   - `zelador` (contato): atualizar só o próprio (fase 2).
3. **Nunca recebem a nova função:** `fines`, `audit_logs`, `profiles` de terceiros, `autocadastros`, `pending_invites`,
   `cargo_transferencias`, tabela do documento da #67, exportações, `notifications` de gestão.
4. **`profiles_role_check` e `pending_invites_role_check`:** acrescentar `'ZELADOR'`. **`get_user_role()`** devolve o novo valor sem
   mudar o resto.
5. **Singleton:** índice único parcial `profiles_singleton_zelador` em `profiles (role) where role = 'ZELADOR'` (como Síndico/Subsíndico).
6. **Transferência de cargo (0037):** `ZELADOR` entra em `cargo_transferencias_cargo_check`, em `transferir_cargo`, `_cargo_rotulo`,
   `_trocar_cargo` e nos índices de pendência de cargo único. **Quem transfere o Zelador: Síndico e ADM** (o Subsíndico não, como nos demais).
   **O Zelador não transfere nada**: continua fora de `transferir_cargo` como executor. **Regra própria para o Zelador (funcionário externo):** quem sai do cargo
   **não vira Morador nem provisório**; o acesso é removido (seção 3.1.3). O Zelador **não é destino válido** de uma conta que já existe como Morador (ele não tem unidade) e
   **nenhum outro cargo pode ser dado a uma conta Zelador**: o Zelador só entra por **convite de pessoa nova**.
7. **Hierarquia (#68):** o Zelador fica **abaixo** do Subsíndico. **Só Síndico e ADM designam** o Zelador (convite ou transferência para pessoa nova);
   Subsíndico não. Síndico, Subsíndico e ADM podem redefinir a senha dele e excluí-lo; ele não age sobre ninguém. Validado no servidor
   pelo perfil lido do banco.
8. A recusa de **nova** reserva em espaço inativo é feita **no banco** (gatilho/validação existente, 0032), para todos os perfis. Auditoria de designação, remoção, transferência e **interdição** gravada **no servidor**, sem e-mail nem telefone nos detalhes.

## 6. Cartão "Contato do Zelador" (fase 2)

- **Onde:** Início de todos os perfis com acesso (já existe como "Zeladoria") e Links e Documentos. No celular, perto do topo para o morador.
- **Dados:** nome (do perfil); **telefone de contato do condomínio** (campo próprio e **opcional**, nunca o telefone pessoal por padrão);
  horário (opcional); botão **WhatsApp** (`wa.me` só com dígitos, **sem texto pré-escrito** e sem dado do morador, `rel="noopener noreferrer"`).
  Sem foto, sem e-mail de login.
- **Fonte única:** o perfil do Zelador ativo. Campos novos `telefone_contato` e `horario_atendimento`, editados pelo próprio Zelador (rota
  de servidor, só o próprio registro) ou pela gestão **com ciência dele**.
- **O morador nunca lê a linha de `profiles` do Zelador.** Leitura por função mínima (ex.: `contato_zelador()`, `SECURITY DEFINER`, devolve
  só nome, telefone de contato e horário) ou pela tabela `zelador` mantida em sincronia por rota de servidor. A escolha técnica é do developer.
- **Estado vazio:** sem Zelador com perfil, vale o cadastro manual de hoje (nada quebra); com perfil e sem telefone, mostra nome, horário e
  "Contato pela administração". Com perfil, o botão manual dá lugar a "Os dados vêm do perfil do Zelador".
- **Sai do cargo** (transferência, desativação ou exclusão): o contato **some sozinho** na mesma hora; nunca mostra quem já saiu. **Cargo vago:** `contato_zelador()` devolve vazio e o cartão não aparece (vale o cadastro manual de hoje, se estiver preenchido); a gestão vê o aviso de cargo vago (seção 3.1.3). O telefone de contato é do **cargo**, não da pessoa: some junto com o acesso.
- **LGPD:** aviso de ciência no primeiro acesso ("Seu nome, telefone de contato e horário aparecem para todos os moradores. Você pode
  deixar o telefone em branco."). Base legal a confirmar com advogado, sobretudo se o zelador for de empresa terceirizada.

## 7. Fases

- **Fase 0 (pré-requisito): #67.** Documento do titular em tabela própria, `units.moradores` sem RG/CPF. A #67 vai **primeiro**; o developer
  começa por ela. Sem isso, nada do Zelador em `units`.
- **Fase 1: perfil e permissões** (M). Papel no banco e no código, convite por Síndico/ADM, selo e rótulo, `tem_perfil_operacao()` só nas
  policies da seção 5, `interditar_espaco`, singleton, transferência de cargo, exclusão, hierarquia, seed (conta de teste e `zelador2`), bateria.
- **Fase 2: cartão de contato automático** (P). Seção 6.

Esforço total: **G**. Prioridade: **alta** (a #67 já é alta e bloqueia).

## 8. Segurança e hierarquia

- Escalada: o Zelador não troca o próprio perfil, não convida, não redefine senha, não exclui, não transfere cargo, não lê RG/CPF nem multa
  por nenhuma rota; recebe 403/400 em português. Ninguém vira Zelador sem passar por Síndico ou ADM.
- O papel é sempre relido do banco a cada requisição; nunca do JWT ou do que o navegador envia.
- Ao sair do cargo, perde o acesso na próxima requisição, sem novo login: conta desativada no banco (`desativado_em`) e ban no Auth (seção 3.1.3). Ninguém sem unidade vira "provisório" por sair do cargo de Zelador.
- Conta `ZELADOR` nunca é ligada a unidade (gatilho no banco); o motivo da interdição só é gravado por `interditar_espaco` com o perfil relido do banco.

## 9. Testes obrigatórios (bateria `scripts/qa/`, por perfil)

Perfis: **Zelador, Subsíndico, Conselho, Portaria, Morador, provisório, visitante** (e Síndico/ADM no caminho permitido).
- **Zelador consegue:** ler e aprovar/recusar reservas; **cancelar reserva (pendente e já aprovada), com auditoria e notificação ao morador iguais às da gestão**; registrar reserva em nome de morador; interditar e reativar espaço; ler nome, telefone,
  e-mail e dependentes; cadastrar veículo e visitante; ler e publicar aviso.
- **Escalada, Zelador NÃO consegue** (consulta direta ao banco e à API): ler RG/CPF (nem em `units`, nem na tabela do documento); ler ou emitir
  multa; ler relatórios e `audit_logs`; ler usuários, convites, autocadastros; chamar `transferir_cargo` e as funções de cargo; redefinir
  senha, convidar, excluir conta; alterar valor, faixa de pessoas, bloqueios de data, exigência de aprovação ou cadastro do espaço; cadastrar ou excluir espaço; apagar (excluir) reserva; **virar outro perfil**.
- **Interdição:** `interditar_espaco` altera só `spaces.ativo`; **nenhuma reserva existente (pendente ou aprovada) muda de status, data ou valor** e nenhuma notificação é criada; **novo pedido em espaço interditado é recusado pelo banco** para Morador, Portaria, Zelador, Síndico, Subsíndico e ADM (API e consulta direta); com o espaço reativado, o mesmo pedido passa; aprovar/recusar/cancelar reserva existente em espaço interditado continua funcionando; o morador vê "Em manutenção" (e o motivo, quando houver); a tela mostra a contagem correta de reservas futuras e o atalho filtra por esse espaço.
- **Motivo da interdição:** Zelador, Síndico, Subsíndico e ADM gravam motivo (até 140; 141 é recusado; quebras de linha viram espaço); **Morador, Portaria, Conselho, provisório e visitante recebem 403** ao chamar a função; o **morador lê** o motivo (`select` em `spaces`) e **não consegue escrever** (`UPDATE` direto em `spaces.motivo_interdicao` falha); o **Zelador não consegue editar nenhum outro campo** de `spaces` (valor, faixa, aprovação, bloqueios, nome) nem por `UPDATE` direto nem por parâmetro da função; reativar **limpa** o motivo; texto com HTML aparece escapado como texto; a auditoria registra quem escreveu.
- **Zelador externo:** convite sem unidade funciona; conta `ZELADOR` **não pode ser ligada a unidade** (gatilho, inclusive por "vincular unidade a conta existente"); Zelador sem unidade acessa Início, Reservas, Moradores/Unidades, Veículos, Mural e Links sem erro (telas da seção 3.1.2); conta existente (Morador com unidade) **não** vira Zelador.
- **Saída do cargo:** na transferência, o ex-Zelador fica **desativado** (`tem_perfil()` falso; consulta direta a `units`, `reservations` e ao diretório devolve vazio; login e sessão ativa recusados na próxima requisição); **não** vira Morador nem provisório; histórico (`audit_logs`) permanece; a trava de um Zelador ativo por vez vale só para não desativados; cargo vago esconde o cartão.
- **Singleton:** segundo Zelador recusado; transferência de Zelador por Síndico e ADM funciona (só para pessoa nova); por Subsíndico e Zelador, 403.
- **Regressão:** Subsíndico, Conselho, Portaria, Morador, provisório e visitante com o mesmo comportamento de antes.
- **Contato (fase 2):** morador não lê e-mail nem perfil do Zelador; contato some ao sair do cargo.

## 10. Critérios de aceite (celular 375px e desktop)

1. Síndico e ADM designam o Zelador; segundo Zelador é recusado ("Já existe um usuário ativo com o perfil ZELADOR"); Subsíndico não designa.
2. Menu do Zelador mostra só o permitido (Início, Reservas, Moradores e Unidades, Veículos, Mural, Links e Documentos). Multas, Relatórios,
   Usuários e Autocadastro não aparecem, e a API responde 403.
3. Zelador aprova, recusa, **cancela** (inclusive reserva já aprovada, com auditoria e aviso ao morador como nas demais perfis) e **registra reserva em nome de
   morador**; interdita e reativa espaço. **Interdição não altera nenhuma reserva existente**; novos pedidos são recusados pelo banco para todos os perfis;
   a tela informa "nenhuma reserva foi cancelada", mostra a contagem de reservas futuras e o atalho "Ver reservas futuras deste espaço"; o morador vê
   "Em manutenção: {motivo}" (ou só "Em manutenção" sem motivo); reativar volta a aceitar novos pedidos e limpa o motivo. Zelador **não** muda valor, faixa, bloqueios, aprovação nem cadastra/exclui espaço.
4. Zelador vê nome, telefone, e-mail e dependentes; **não** há RG/CPF em tela, API, consulta direta nem exportação.
5. Transferência de cargo funciona com Zelador (só para pessoa nova): **quem sai tem o acesso removido** na próxima requisição (conta desativada, não excluída, histórico preservado), **não vira Morador nem provisório** e não vê o diretório de unidades; o assistente mostra "O acesso de {nome} será removido" com "Remover o acesso desta pessoa" marcada e travada.
5a. Zelador é convidado sem unidade, sem autocadastro e sem validação de morador; não pode ser ligado a unidade; todas as telas da seção 3.1.2 funcionam para ele sem unidade.
5b. Interdição com **motivo opcional** (até 140, uma linha, texto de apoio visível): só gestão e Zelador gravam (a função valida o perfil); morador lê "Em manutenção: {motivo}" e não escreve; reativar limpa; auditoria registra quem escreveu.
6. Hierarquia da #68 respeitada; sem escalada de papel.
7. Fase 2: cartão para todos sem digitar duas vezes; estados vazios definidos; WhatsApp só com dígitos; some quando o cargo sai.
8. Alvos de toque de 44px, sem rolagem horizontal em 375px; bateria verde; QA no staging antes do dono testar.

## 11. Riscos

- **LGPD:** nome, telefone e e-mail de moradores e dependentes para um perfil de **rotatividade alta** (necessidade e minimização). Mitigação:
  sem documento, sem exportação, sem busca em massa fora da tela; auditoria; remoção imediata ao sair do cargo. Base legal do contato do
  Zelador a confirmar com advogado.
- **Regressão de policies:** nova função de nível próprio em várias tabelas. Mitigação: bateria por perfil antes e depois, no staging, e
  `is_admin()` intocada.
- **Dependência da #67:** sem ela, o Zelador não pode ler unidades (vazaria RG/CPF). Mitigação: fase 0 obrigatória.
- **Rotatividade:** conta de quem saiu continuaria com acesso. Mitigação: remoção do acesso automática na transferência (seção 3.1.3), sem depender de lembrar de excluir.
- **Ex-Zelador como "provisório" vendo o diretório (#75):** evitado, porque ele nunca vira provisório (conta desativada, `tem_perfil()` falso).
- **Motivo da interdição (texto livre público):** LGPD e tom; mitigação na seção 4.2 (limite, uma linha, sem formatação, texto de apoio, autoria na auditoria, gestão edita, limpa ao reativar).
- **Interdição com reservas futuras:** nada é cancelado nem avisado automaticamente; o risco é a reserva existente ficar esquecida e o morador chegar ao espaço
  em manutenção. Mitigação: contagem e atalho na tela da interdição, no Início operacional e na lista de espaços; cancelamento manual notifica o morador.
- **Zelador cancela reserva aprovada** (poder ampliado em 06/10): auditoria igual à da gestão e aviso ao morador; rotatividade alta do cargo, então só o perfil
  relido do banco vale.
- **Duplicidade** entre cadastro manual e perfil: o perfil sempre vence; o manual é só fallback.

## 12. O que fica de fora

Cancelamento automático de reservas ao interditar; notificação automática ao morador na interdição; Zelador morador do condomínio ou com unidade; reaproveitar conta de Morador como Zelador; excluir automaticamente a conta do ex-Zelador; motivo da interdição com formatação, link, vários idiomas ou moderação prévia; vários zeladores (decidido: só um); foto, e-mail no cartão, chamados e ordens de serviço; outros perfis novos; multas, financeiro,
relatórios, usuários, exportações e transferência de cargo para o Zelador; vários condomínios; integração com WhatsApp além do link `wa.me`.

## 13. Pergunta em aberto ao dono (máximo 1)

Fechadas em 06/10/2026: lista de funcionalidades; interdição só bloqueia novos pedidos; **Zelador é funcionário externo sem unidade**; **motivo opcional da interdição**.

1. **Quando o ex-Zelador é um funcionário que você quer manter por perto (ex.: férias ou troca de turno), a gestão pode "reativar" a mesma conta se o cargo estiver vago?**
   Recomendo **sim** (só Síndico/ADM, cargo vago, ação auditada), em vez de convidar de novo. Sem resposta, **entra assim**.

## 14. Trecho proposto para `docs/produto.md` (só após aprovação do dono)

> **Perfil de Zelador (06/10/2026).** Cargo único, designado por Síndico e ADM, entra na transferência de cargo. Perfil operacional **sem dados
> sensíveis**: não vê RG/CPF, multas, finanças, relatórios, usuários, exportações nem autocadastro; pode aprovar/recusar/cancelar e registrar reservas,
> cancelar reservas, ver nome/telefone/e-mail de moradores e dependentes e interditar espaço (a interdição bloqueia só novos pedidos e não cancela reservas existentes). Depende da #67 (documento em tabela própria). **O Zelador é funcionário externo, sem unidade; ao sair do cargo o acesso é removido (conta desativada, histórico preservado), nunca vira Morador/provisório.** A interdição de espaço tem motivo opcional (até 140 caracteres) que o morador vê como "Em manutenção: {motivo}". Fase 2: o contato do
> Zelador aparece automaticamente para todos. Especificação: `docs/specs/2026-10-05-perfil-zelador.md`.
