# PRD: Transferir cargo (Síndico, Subsíndico, Conselho e Porteiro)

Data: 04/10/2026 · Autor: PM · Status: para o designer e o developer, validação no **staging** (sem produção agora).
Substitui a recomendação anterior da decisão D6 em `docs/specs/2026-10-01-ciclo-da-multa-e-exclusao-do-sindico.md`
("bloquear e trocar manualmente"). Contesto essa recomendação a pedido do dono: a troca de mandato não pode depender de
ninguém mexer no banco.

Legenda: **DECIDIDO** = decisão do dono. **PROPOSTA** = recomendação do PM, o dono ainda não decidiu.
Repositório público: nenhum dado real neste documento.

## 1. Problema e quem usa

Hoje não existe como passar um cargo de uma pessoa para outra. O que dá para fazer:
- excluir a conta da equipe (`src/app/api/usuarios/excluir`) e convidar a nova pessoa do zero (`api/convites/enviar`),
  perdendo o histórico de ações da conta antiga e deixando a pessoa sem o vínculo com a unidade; ou
- pedir ao dono para trocar no banco. Isso não escala e é o ponto mais perigoso do sistema (o perfil manda em tudo).

Para o Síndico, a exclusão ainda é perigosa: pode deixar o condomínio sem Síndico, e as regras de acesso do banco
(`is_admin()`) dependem de existir quem exerça o cargo.

Quando acontece (todos previsíveis): **fim de mandato** do Síndico/Subsíndico, **troca de porteiro** (turnos e
rotatividade da empresa), **conselho renovado** em assembleia. Quem faz: ADM (administradora) e Síndico. Quem recebe:
um morador já cadastrado ou uma pessoa nova.

Se nada for feito: troca de mandato passa pelo dono, ou alguém exclui e perde histórico, ou, pior, o login do
Síndico antigo continua valendo depois de acabar o mandato.

## 2. Objetivos e não-objetivos

Objetivos
1. Passar Síndico, Subsíndico, Conselho ou Porteiro de uma pessoa para outra, pelo app, em uma operação segura.
2. Nunca ficar sem Síndico por engano; nunca ter dois Síndicos nem dois Subsíndicos.
3. Impossível usar a função para escalar privilégio (virar ADM, dar cargo a si mesmo, dar cargo a provisório).
4. Todo ato fica no histórico de ações, de forma auditável.
5. Funcionar no celular (375px) e no desktop, sem treinamento.

Não-objetivos: ver seção 11.

## 3. Decisões do dono (04/10/2026) — DECIDIDO

1. Quem transfere: **ADM e Síndico**. O Subsíndico não.
2. Cargos transferíveis: **Síndico, Subsíndico, Conselho e Porteiro**.
3. Destino: usuário **já cadastrado** ou **novo usuário** (convite já com o cargo).
4. A tela "Usuários e Convites de Acesso" fica mais complexa: **o designer desenha junto**.
5. O time segue o processo até **validação no staging** para o dono testar. Sem produção agora.

## 4. Regras por perfil

Linguagem: "origem" é quem tem o cargo hoje; "destino" é quem passa a ter.

| Perfil de quem executa | Síndico | Subsíndico | Conselho | Porteiro | ADM |
|---|---|---|---|---|---|
| **ADM** | transfere o do titular atual | transfere | transfere | transfere | **nunca** (fora desta tela) |
| **Síndico** | só o **próprio** (é a origem) | transfere | transfere | transfere | nunca |
| **Subsíndico** | não | não | não | não | não |
| **Conselho, Portaria, Morador, provisório, visitante** | não (a tela nem aparece; a rota recusa com 403) | | | | |

Quem pode ser destino (já cadastrado): conta ativa, **validada**, com perfil MORADOR, SUBSINDICO, CONSELHO ou PORTARIA
(PROPOSTA, justificativa em 5.4). Nunca: ADM, provisório (autocadastro aguardando validação), conta sem acesso,
a própria origem, nem o próprio executor quando isso lhe daria cargo (ver 8).

## 5. O que "transferir" significa, com precisão

Uma conta tem **um perfil só** (`profiles.role`). Transferir o cargo R de A (origem) para B (destino) é uma única
operação atômica: **B passa a ter R e A deixa de ter R**. Nada de estado em que o cargo exista em dois ou em ninguém.
Os vínculos de A e de B com unidades (`units.usuario_id`) **não mudam**.

### 5.1 Quem PERDE o cargo (i) — PROPOSTA
Padrão seguro: **a pessoa não é excluída; vira Morador.**
- Se tem unidade ligada: vira **Morador validado** da própria unidade (o caso comum: ex-síndico continua morando).
- Se não tem unidade ligada (ex.: porteiro de empresa): vira **provisório** (o estado de menor acesso que já existe:
  só mural, lista de unidades e o próprio cadastro) e entra num aviso para a equipe ("sem cargo e sem unidade: excluir
  acesso?"). A exclusão continua sendo uma ação **separada e consciente** na tela, nunca embutida na transferência.
- Justificativa: rebaixar preserva histórico, autoria de multas e avisos e é reversível; excluir não é. Não "sair da
  unidade" nem "deixar o acesso" por conta própria da função.

### 5.2 Singletons e não-singletons (ii) — PROPOSTA
- **Síndico e Subsíndico (únicos):** a transferência é **uma transação no banco** que troca os dois lados. Sem
  estado visível sem Síndico. Detalhe técnico: os índices únicos parciais (`profiles_singleton_sindico`,
  `profiles_singleton_subsindico`) são checados linha a linha; a função deve ordenar os UPDATEs dentro da transação
  (origem sai, destino entra), com `SELECT ... FOR UPDATE` nas duas contas, para não violar o índice no meio.
- **Caso especial "troca":** se o destino do Síndico é o atual Subsíndico, a vaga de Subsíndico fica livre dentro da
  mesma transação. Padrão: o Síndico antigo **vira Subsíndico** (a dupla se inverte), o que mantém a regra "sempre um
  Síndico e um Subsíndico". É a **pergunta 2** ao dono (seção 12). A tela mostra o resultado antes de confirmar.
- **Conselho e Porteiro (vários):** "transferir" significa **trocar uma pessoa por outra** (1 para 1): a pessoa X
  sai, a pessoa Y entra. **Adicionar** mais um conselheiro ou porteiro **já existe** (Novo convite), e **remover** é
  rebaixar/excluir, que também já existe. Não criamos "adicionar/remover" dentro de Transferir: uma ação, um sentido.

### 5.3 Síndico transferindo o próprio cargo (iii) — PROPOSTA
- Ao confirmar, o Síndico **perde os poderes na hora** (a próxima requisição dele já é de Morador, sem novo login).
- **Confirmação forte:** (a) tela de resumo com "Você deixa de ser Síndico. [Nome do destino] passa a ser Síndico.
  Você vira [Morador/Subsíndico]"; (b) digitar o **nome do destino** (barreira contra clique distraído, boa no celular);
  (c) **reautenticação por senha** na rota do servidor para Síndico e Subsíndico como cargo transferido (o ato mais
  caro de errar). Para Conselho e Porteiro basta o resumo e um botão de confirmar.
- **ADM nunca deixa o condomínio sem Síndico por engano:** a função só aceita transferência com destino válido;
  não existe "remover o Síndico" nem "deixar vago". Se o condomínio já estiver sem Síndico, o caminho é o convite
  normal (que já tem a trava de singleton).
- ADM e Síndico podem cancelar antes de confirmar e **não há desfazer** (não-objetivo), por isso a confirmação forte.

### 5.4 Destino já cadastrado (iv) — PROPOSTA
- Pode ser MORADOR validado, SUBSINDICO, CONSELHO ou PORTARIA. Um morador é o caso típico (síndico eleito entre
  moradores); um conselheiro virar Síndico também é comum; um porteiro virar Síndico não faz sentido operacionalmente
  mas o dono permitiu transferir entre os quatro cargos: a regra de segurança é a lista de quem **não** pode
  (ADM, provisório, a própria origem).
- **Conta de equipe não acumula cargos.** O perfil é um só. O destino que já tinha outro cargo **perde o antigo** ao
  receber o novo (ex.: Conselho vira Síndico: a vaga de conselheiro fica livre). O resumo da confirmação mostra
  "Você deixa de ser X" quando houver, para quem executa saber. Conselho ou Porteiro que recebe cargo mais alto não
  mantém o anterior.
- Destino precisa estar com e-mail confirmado e conta ativa.

### 5.5 Destino novo (v) — PROPOSTA
- Cria-se um **convite com o cargo** e o **link seguro já existente** (`montarLinkAcesso`, token só é gasto no
  toque em "Continuar"). Fluxo na tela: "Para uma pessoa nova" pede nome e e-mail.
- **O cargo só vale quando a pessoa aceitar (cargo pendente), e o titular atual continua até lá.** Motivo: se o
  convite fosse aplicado na hora, o Síndico perderia os poderes para alguém que talvez nunca abra o link. Isso é a
  principal exposição do desenho.
- Achado no código: hoje `api/convites/enviar` **cria o profile já com o cargo no envio do link**, antes de a pessoa
  aceitar. Para o cargo pendente isso precisa mudar: o profile do destino novo nasce **sem poder** (Morador/provisório
  e sem unidade) e a transferência fica registrada numa **solicitação** (`PENDENTE`) ligada ao convite. Ao definir a
  senha (primeiro acesso), a rota do servidor executa a mesma função atômica do 5.2. A decisão de como guardar é do
  developer; o comportamento é o descrito aqui.
- Regras: no máximo **uma transferência pendente por cargo único**; ADM/Síndico podem **cancelar** a pendente a
  qualquer momento; expira em **14 dias** (valor a confirmar, depende do prazo do link no Supabase, pendência já
  conhecida) e vira "Expirada"; reenviar o link gera novo. Na tela a pendência aparece junto da fila de convites:
  "Aguardando [nome] aceitar o cargo de Síndico. Você segue como Síndico até lá."
- Conferência no aceite: o e-mail da conta que aceitou tem de ser o do convite e o cargo ainda precisa ser
  válido (origem ainda titular). Senão a solicitação falha com mensagem e avisa quem pediu.

### 5.6 Exclusão do Síndico (vi) — PROPOSTA
- A regra "**ninguém exclui o Síndico pelo app**" continua (trava de servidor do bloco 5.1 da spec de 01/10:
  "O Síndico não pode ser excluído por aqui."). **A transferência substitui a exclusão.** Hoje a rota
  `api/usuarios/excluir` ainda **não tem** essa trava no código: ela entra junto (ou antes), é pré-requisito.
- Depois de rebaixado, o ex-Síndico é um Morador/provisório comum e a equipe pode removê-lo pelo fluxo normal.
- Mesma lógica para o ADM: continua sem poder ser excluído ou alterado por esta tela.

### 5.7 Notificações e histórico (vii) — PROPOSTA
- **Histórico de ações** (módulo SISTEMA, visível a quem já vê a trilha): "[Quem executou] transferiu o cargo de
  [Cargo] de [Origem] para [Destino]" com `detalhes`: cargo, ids das contas, cargos anterior/novo de cada lado,
  tipo de destino (existente/novo), resultado (concluída, pendente, cancelada, expirada) e data/hora. **Sem e-mail,
  telefone nem outros dados pessoais** além do nome já exibido na trilha.
- A gravação tem de ser feita **dentro da mesma transação** da troca, no servidor/banco. Achado: `audit_logs` tem
  policy de INSERT para qualquer autenticado (migração 0004), então um registro vindo do navegador não é confiável;
  para esta função o log não pode depender do cliente.
- **Avisos no app:** para o destino ("Você agora é Síndico"), para a origem ("Seu cargo foi transferido") e para a
  equipe (Síndico, Subsíndico, ADM). Sem WhatsApp neste escopo. A tabela de notificações hoje é direcionada por
  unidade; o developer verifica se precisa direcionar por usuário.

## 6. Segurança (viii)

1. **Só por rota de servidor com validação**, nova (ex.: `api/usuarios/transferir-cargo`), chamando uma **função no
   banco** (`SECURITY DEFINER`, com `EXECUTE` só para o service role, nada de `authenticated`). `profiles` continua
   **somente leitura para o cliente** (migração 0027): nada de UPDATE direto.
2. A rota **relê o perfil do executor no banco** a cada chamada. Nunca confia em `user_metadata`/JWT para o cargo,
   nem no que o cliente manda (cargo, origem e destino são validados no servidor).
3. **Atômica:** uma transação, `FOR UPDATE` nas duas contas em ordem fixa (evita impasse), índices únicos
   preservados, rollback total em qualquer falha. Idempotente: repetir a chamada não troca de novo.
4. **Matriz de escalada, todas devem retornar 403/400 com mensagem em português:**
   - ADM ou Síndico **não criam outro ADM** por esta via; ADM não é origem nem destino.
   - Ninguém recebe cargo mais alto para si mesmo: destino = executor é recusado (exceto a regra de Síndico transferindo
     o **próprio** cargo, onde ele é a origem, nunca o destino).
   - Subsíndico, Conselho, Portaria, Morador, provisório e visitante: 403.
   - Síndico não pode ser origem de cargo de **outro** Síndico nem transferir "como" ADM.
   - Destino provisório, sem validação, ADM ou inexistente: recusado.
   - Cargo fora dos quatro: recusado. Transferir cargo que a origem não tem: recusado.
   - Dois pedidos simultâneos para o mesmo cargo: um vence, o outro falha sem corromper (nunca 2 Síndicos).
5. **Sessão:** depois da troca, a origem perde o poder na **próxima requisição sem precisar sair e entrar**
   (as rotas e a RLS leem `profiles` a cada chamada) e a interface atualiza o cargo no próximo carregamento.
6. **RLS:** `is_admin()` e `tem_perfil()` continuam lendo `profiles`; nada a afrouxar. Testar que o ex-Síndico, agora
   Morador, não lê nem escreve mais nada reservado à equipe (multas, usuários, auditoria).
7. Bateria em `scripts/qa/` com um caso por linha da matriz acima, mais o convite com cargo pendente.

## 7. Escopo (o que entra)

- Ação "Transferir cargo" na tela Usuários e Convites, visível só para ADM e Síndico, a partir da linha de cada
  pessoa com cargo transferível (e do próprio Síndico).
- Fluxo em passos (desenho do designer): escolher destino (**"Alguém já cadastrado"** com busca por nome/unidade, ou
  **"Pessoa nova"** com nome e e-mail) → resumo do antes e depois → confirmação forte → resultado.
- Pendência visível para destino novo, com cancelar e reenviar link.
- Rota de servidor, função atômica no banco, histórico, avisos, trava na exclusão do Síndico.
- Rótulos e textos em português; nomes dos cargos de `ROLE_LABELS`.

## 8. Critérios de aceite (testáveis; celular 375px e desktop)

1. Como **ADM**, transfiro Síndico, Subsíndico, Conselho e Porteiro para um morador validado: o destino passa a ter o
   cargo; a origem vira Morador (com unidade) ou provisório (sem unidade); sem recarregar a página do destino, a
   próxima ação dele já respeita o novo cargo.
2. Como **Síndico**, transfiro Subsíndico, Conselho e Porteiro, e o meu próprio cargo. Ao confirmar o meu, perco o
   acesso de equipe na hora (tela de Usuários deixa de abrir; rotas de equipe respondem 403).
3. **Subsíndico, Conselho, Portaria, Morador, provisório**: não veem a ação; pela API, 403.
4. **Nunca fica sem Síndico** e **nunca 2 Síndicos/2 Subsíndicos**: teste com duas chamadas simultâneas e com falha
   no meio (forçar erro) que mostra rollback sem mudar nada.
5. Troca Síndico ↔ Subsíndico: resultado conforme a resposta da pergunta 2; sempre um de cada.
6. Destino novo: convite com link seguro gerado; **antes do aceite o titular continua** e a tela mostra a pendência;
   após o aceite (primeiro acesso) a troca acontece; cancelar e expirar não alteram nenhum cargo; e-mail diferente do
   convite é recusado.
7. Destino inválido (ADM, provisório, a própria origem, o próprio executor) é recusado com mensagem clara; tentativa
   de criar outro ADM por esta via falha.
8. Síndico/Subsíndico como cargo: pede **nome do destino digitado + senha**; senha errada não troca nada.
9. Histórico: cada troca (e cancelamento/expiração) aparece com quem, cargo, de quem, para quem, quando, **sem e-mail
   nem telefone**. Origem, destino e equipe recebem aviso.
10. Excluir o Síndico pelo app continua recusado ("O Síndico não pode ser excluído por aqui."); o ex-Síndico rebaixado
    pode ser excluído pela equipe.
11. Layout: em 375px tudo cabe sem rolagem horizontal, alvos de toque de 44px, passos em tela cheia (sem diálogo
    apertado), foco e teclado em desktop, rótulos acessíveis. Estados de carregando, erro e vazio definidos.
12. Bateria `scripts/qa/` cobre a matriz de segurança (seção 6.4) por perfil; QA no staging aprova antes do dono testar;
    nada vai a produção sem ok explícito do dono.

## 9. Forma mais barata de validar antes de construir
Fazer o designer desenhar os passos e mostrar ao dono (e, se possível, a um síndico real) antes do código; e rodar a
função do banco no staging com a bateria de segurança antes de ligar a tela.

## 10. Riscos
- **Troca de poder por engano ou por convite interceptado** (link no WhatsApp para destino novo): mitigado por
  cargo pendente, conferência do e-mail, expiração e cancelamento; risco residual aceito.
- **Perda de acesso do Síndico** por falha no meio: transação atômica e testes de rollback.
- **Custo de suporte:** tela mais complexa. Mitigação: poucos passos e resumo "antes e depois".
- **Responsabilidade legal:** quem exerce o cargo vem de assembleia; o app registra a troca, não prova a ata.
  Avaliar com síndico real se a trilha precisa de campo "motivo" (não incluído).
- **Rebaixar a Morador sem unidade** pode deixar contas esquecidas: aviso de "excluir acesso?" mitiga.
- **LGPD:** log e avisos sem dados pessoais desnecessários.
- Dependência do prazo de expiração dos links do Supabase (pendência já registrada).

## 11. O que fica de fora
- Transferir ou alterar **ADM** por esta tela (e criar ADM por esta via).
- **Vários condomínios** (decisão de produto mantida).
- **Agendar** transferência para data futura.
- **Desfazer** (corrige-se com nova transferência).
- Campo de motivo ou anexo de ata; WhatsApp; troca de cargo em lote.
- Excluir acesso embutido na transferência (continua ação separada).

## 12. Perguntas em aberto ao dono (máximo 2)
1. **Quem perde Conselho ou Porteiro e não mora no condomínio** (porteiro de empresa): o padrão proposto é virar
   provisório (menor acesso) e a equipe decide depois excluir. Prefere que a tela ofereça, no mesmo passo, a opção
   "excluir também o acesso desta pessoa" (marcada por padrão para Porteiro)?
2. **Síndico passa o cargo para o atual Subsíndico:** o Síndico antigo **vira Subsíndico** (troca, proposta) ou
   **vira Morador** e a vaga de Subsíndico fica livre?

## 13. Trecho proposto para `docs/produto.md` (só após aprovação do dono)
> **Transferir cargo (04/10/2026).** Substitui a ideia de "bloquear e trocar manualmente" (D6). ADM e Síndico
> transferem Síndico, Subsíndico, Conselho e Porteiro para usuário existente ou novo (convite com cargo). A troca é
> atômica e feita por rota de servidor; ninguém exclui o Síndico pelo app. Quem perde o cargo vira Morador (ou
> provisório, sem unidade). Destino novo só assume ao aceitar o convite. Especificação:
> `docs/specs/2026-10-04-transferir-cargo.md`.
