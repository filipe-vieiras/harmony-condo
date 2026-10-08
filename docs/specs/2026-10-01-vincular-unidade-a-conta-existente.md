# Vincular unidade a uma conta que já existe (e-mail repetido)

Status: aprovado pelo dono do produto em 2026-10-01 · Etapa 1 de 2 · Implementação: agente `developer`

## Problema
O síndico (Carlos) já tinha conta de Síndico e cadastrou a unidade **A-101** com o próprio
e-mail como titular. O sistema tentou **criar um usuário novo** para esse e-mail, o Supabase
recusou (*"A user with this email address has already been registered"*) e o resultado foi:
- um convite de Morador com **"Erro ao gerar"** parado na fila, assustando o síndico;
- a A-101 **sem usuário vinculado** (status do convite "pendente").

A conta do Carlos não foi afetada. O problema é o ruído e a unidade não ligada à pessoa certa.
Um e-mail é uma conta; a mesma pessoa pode ter várias unidades (síndico, subsíndico, proprietário
com mais de um apartamento).

## Quem sofre e com que frequência
Síndico, Subsíndico e Administradora ao cadastrar ou editar unidades. Acontece sempre que o
titular de uma unidade já tem conta, o que é o caso de **todo síndico que mora no prédio**.

## Comportamento esperado
Ao salvar uma unidade (nova ou editada), ou ao tocar em "Enviar convite" no card da unidade,
o sistema compara o e-mail do **morador principal** (titular ou inquilino) com as contas
existentes. O e-mail é comparado sem diferenciar maiúsculas e sem espaços nas pontas.

1. **E-mail sem conta:** nada muda. Continua o fluxo atual (convite de acesso).
2. **E-mail com conta:** o sistema **não cria usuário nem convite**. Antes de salvar, mostra
   uma confirmação com o nome e o perfil da conta:
   *"Este e-mail já tem conta: Carlos Exemplo (Síndico). Vincular a unidade A-101 a ela?"*
   - **Confirmar:** salva a unidade, grava `units.usuario_id` com o id da conta e
     `status_convite = 'ATIVO'`, e avisa *"Unidade A-101 vinculada à conta de Carlos Exemplo."*
   - **Cancelar:** volta ao formulário, **sem salvar nada**.
3. **Limpeza:** se a unidade tinha convite pendente ou com erro, ele é removido ao vincular
   (some o "Erro ao gerar").
4. **Auditoria:** registrar no histórico (módulo Unidades): *"Vinculou a Unidade A-101 à conta
   de Carlos Exemplo"*.

### Quando NÃO vincula (mensagem clara em português, nada é criado)
- **Conta de Morador que já tem unidade:** *"Esta conta já está ligada à unidade X. Moradores
  com mais de uma unidade ainda não são suportados. Use outro e-mail ou deixe o e-mail em
  branco."* (é a etapa 2; vincular criaria um estado meio funcionando).
- **Conta de Morador provisória** (aguardando validação do autocadastro): *"Esta conta ainda
  aguarda validação em Autocadastro. Valide ou recuse lá primeiro."*
- **Unidade já vinculada a outra conta:** não sobrescreve em silêncio. *"Esta unidade já está
  vinculada a [nome]."*

### Contas que podem receber o vínculo
Síndico, Subsíndico e ADM (veem tudo, então a etapa 1 já resolve), e Morador **sem nenhuma
unidade**. Portaria e Conselho: permitido, mostrando o perfil na confirmação.

## Fora de escopo (e por quê)
- **Morador com 2+ unidades** (etapa 2): o sistema todo assume uma unidade por morador
  (`get_my_unit_id()`, 8 regras de acesso, 17 usos no código). Só entra quando houver um caso
  real; validar contando na planilha do condomínio os proprietários com mais de uma unidade.
- **Autocadastro de uma segunda unidade com o mesmo e-mail:** o formulário é público e sem
  login, então não pode vincular a uma conta existente. Fica o erro neutro de hoje. Futuro:
  "Adicionar outra unidade" para morador logado.
- Papéis acumulados (conselheiro que também é morador) e conflito de interesse do síndico
  julgando recurso da própria unidade: registrados como riscos, sem tratamento agora.
- Vários condomínios.

## Critérios de aceite (testáveis no staging)
1. Unidade nova com e-mail **sem conta**: cria o convite como hoje.
2. Unidade nova com e-mail de conta **Síndico, Subsíndico ou ADM**: aparece a confirmação com
   nome e perfil; confirmar grava `usuario_id`, `status_convite = ATIVO`, **zero convites**
   criados e nenhuma mensagem de erro; cancelar não cria a unidade.
3. O e-mail `" Sindico.Exemplo@Exemplo.com "` é reconhecido como o de `sindico.exemplo@exemplo.com`.
4. Conta de **Morador sem unidade**: vincula igual ao item 2.
5. Conta de **Morador com unidade**, conta **provisória** e unidade **já vinculada a outra
   conta**: cada uma mostra a sua mensagem e **não cria unidade, convite nem vínculo**.
6. Editar o e-mail do titular de uma unidade existente para o de uma conta existente, e o botão
   "Enviar convite" do card, seguem as mesmas regras.
7. Um convite com erro ou pendente da mesma unidade é removido ao vincular.
8. Existe o registro de auditoria do vínculo.
9. Só Síndico, Subsíndico e ADM conseguem vincular: Portaria, Conselho e Morador são barrados
   pelas regras de acesso (conferir na bateria).
10. Sem regressão: `npx tsc --noEmit`, `npm run build` e `node scripts/qa/bateria.mjs` passam,
    com **verificações novas** para os itens 2, 4, 5, 7 e 9. A fluxo é visto no navegador no
    staging (computador e celular de 375px), sem erros no console.

## Restrições técnicas já levantadas
- **Não precisa de migração nem mudar regras de acesso:** `units.usuario_id` não tem índice
  único (várias unidades podem apontar para a mesma conta); `units_write_admin` já permite ao
  admin gravar; `notifications_read` e `units_read` já funcionam com várias unidades.
- O cliente do admin já tem as contas em `systemUsers` (perfis); o ponto de decisão fica em
  `addUnit`, `updateUnit` e `sendInviteForUnit` (`src/context/AppContext.tsx`) e nos
  formulários de `src/app/moradores/page.tsx`, que usa `useDialog().confirm`.
- Não mudar o fluxo de convite para e-mails sem conta (`/api/convites/enviar`).

## Riscos
- **Vínculo no e-mail errado:** um erro de digitação, igual ao e-mail de outro morador, jogaria
  multas e veículos da unidade na conta errada. Por isso a confirmação mostra o **nome** e o
  perfil, e o vínculo é auditado.
- Estado meio funcionando de morador com 2 unidades: evitado pela regra de bloqueio acima.

## Fora do código (não é tarefa do developer)
Produção: apagar o convite com erro do Carlos e ligar a A-101 à conta dele. São dados reais,
então só com autorização do dono do produto.

## Decisão a registrar em `docs/produto.md` ao concluir
Um e-mail é uma conta; unidades se ligam a contas existentes depois de confirmação. Morador
com várias unidades fica para a etapa 2, condicionado ao que a planilha mostrar.
