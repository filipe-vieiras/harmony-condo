# Especificação: confirmar antes de excluir (Mural e "Cancelar convite")

Issue: #22 (design, esforço P, prioridade alta). Autor: PM. Data: 2026-10-01.
Status: pronta para o developer. **Não depende de decisão do dono.**

## Problema
O síndico, no computador ou no celular, toca na lixeira do aviso do Mural ou no ícone de
cancelar convite na fila de Usuários e o item some na hora, sem volta. O toque errado é
fácil: no celular o botão tem 44px e fica colado em outros controles. Aviso apagado não
volta (e pode ter sido lido por centenas de moradores como "fixado"); convite cancelado
obriga a cadastrar de novo. Se nada for feito, o primeiro toque errado em produção vira
ligação de suporte.

## Situação atual (conferida no código)
O `DialogProvider` (`src/components/ui/DialogProvider.tsx`) já existe: `confirm({ title,
message, confirmLabel, destructive })` devolve `true/false`, com foco preso, Esc e botão
vermelho para ação destrutiva. Quase todas as exclusões já o usam. Mapa completo:

| Ação | Onde | Confirma hoje? |
|---|---|---|
| Excluir aviso do Mural | `src/app/mural/page.tsx` (~l.206, chama `deleteNotice` direto) | **Não** |
| Cancelar convite / Remover da fila | `src/app/usuarios/page.tsx` (~l.480, chama `cancelPendingInvite` direto) | **Não** |
| Excluir acesso de usuário | `usuarios/page.tsx` `handleDeleteUser` | Sim |
| Excluir unidade | `moradores/page.tsx` `handleDeleteUnit` | Sim |
| Remover morador adicional pelo card | `moradores/page.tsx` | Sim |
| Remover veículo | `veiculos/page.tsx` | Sim |
| Remover espaço | `reservas/page.tsx` | Sim |
| Recusar reserva | `reservas/page.tsx` e `page.tsx` (Início) | Sim (com motivo) |
| Excluir contato / documento | `links/page.tsx` `handleDelete` | Sim |
| Recusar autocadastro | `autocadastro/page.tsx` | Sim (com motivo) |
| Julgar recurso | `multas/[id]/page.tsx` | Sim |
| Remover morador/veículo **dentro de formulário** (antes de salvar) | `moradores/page.tsx` modal, `AutocadastroForm.tsx` | Não, e **não precisa**: nada é gravado até "Salvar" |

Resumo: só **duas** ações destrutivas persistidas estão sem confirmação. As demais já têm.

Dois defeitos vizinhos, no mesmo código, que o developer deve corrigir junto (pequenos):
1. `deleteNotice` (`AppContext.tsx` ~l.684) e `cancelPendingInvite` (~l.886) tiram o item da
   tela **mesmo se o banco recusar** (`deleteNoticeDB`/`deletePendingInviteDB` só fazem
   `console.error`). Resultado: o aviso "some", mas volta ao recarregar. Só remover da tela
   se o banco confirmou, e mostrar erro se falhar.
2. Nenhuma das duas ações grava registro no histórico (auditoria), ao contrário de excluir
   acesso. Registrar "Excluiu o aviso do Mural" (só o título, sem o corpo do texto) e
   "Cancelou o convite de acesso" (sem e-mail no registro; só o nome).

## Escopo (o que entra)
1. Diálogo de confirmação no excluir do Mural.
2. Diálogo de confirmação no Cancelar convite / Remover da fila.
3. Os dois defeitos acima.
4. Melhorar o texto das confirmações de **Excluir unidade** e **Excluir acesso**, que hoje
   dizem só "Essa ação não pode ser desfeita" e não contam o efeito real (ver textos abaixo).

## Textos dos diálogos (usar exatamente, português claro)
Usar sempre `destructive: true`. O botão de confirmação diz a ação, nunca "OK" ou "Sim".

**Excluir aviso do Mural**
- Título: `Excluir o aviso "{título}"?` (título cortado em ~60 caracteres com "…")
- Mensagem: `Ele deixa de aparecer para todos os moradores e não dá para recuperar.`
- Botão: `Excluir aviso`

**Cancelar convite** (status PENDENTE ou outro que não seja ENVIADO)
- Título: `Cancelar o convite de {nome}?`
- Mensagem: `A pessoa sai da fila e não recebe o link de acesso. Você pode cadastrar o convite de novo depois.`
- Botão: `Cancelar convite`
- Atenção ao rótulo: o botão neutro do diálogo já se chama "Cancelar". Dois "Cancelar" lado a
  lado confundem. Por isso o botão vermelho é `Cancelar convite` e o neutro deve ser
  `Voltar`. **Ajuste no `DialogProvider`:** nova opção opcional `cancelLabel` (padrão
  "Cancelar"); neste diálogo usar `cancelLabel: 'Voltar'`. Os outros diálogos não mudam.

**Remover da fila** (status ERRO)
- Título: `Remover {nome} da fila?`
- Mensagem: `O convite deu erro e não foi enviado. Ele sai da lista; você pode cadastrar de novo.`
- Botão: `Remover da fila`; neutro `Voltar`.

**Excluir unidade** (melhoria de texto; já confirma)
- Mensagem nova: `Os moradores cadastrados nela saem da lista. Se a unidade tiver uma conta de acesso vinculada, essa conta também é excluída. Não dá para desfazer.`
- Atenção: confirmar no código se é verdade para a unidade em questão (a API
  `api/unidades/excluir` apaga a conta ligada). Ver risco no spec do Síndico (#20).

**Excluir acesso** (melhoria de texto; já confirma)
- Mensagem nova: `{nome} não consegue mais entrar no sistema. Se ela estiver ligada a uma unidade, a unidade fica sem acesso, mas continua cadastrada. Não dá para desfazer.`

## Critérios de aceite (testáveis)
Desktop e celular (iPhone 375px, Android 360px; usar o staging):
1. Logado como Síndico, no Mural, tocar na lixeira de um aviso abre o diálogo com o título
   do aviso. **Nada some** enquanto o diálogo está aberto.
2. `Cancelar`/Esc/toque fora do diálogo: aviso permanece, nenhum registro novo no histórico.
3. `Excluir aviso`: aviso some da lista; ao recarregar a página continua sumido; aparece uma
   linha no histórico de ações sem o texto do aviso.
4. Simular falha (conta sem permissão de excluir, ou rede desligada): o aviso **continua**
   na lista e aparece mensagem de erro em português ("Não foi possível excluir. Tente de novo.").
5. Em Usuários, convite com status PENDENTE: ícone de lixeira abre o diálogo "Cancelar o
   convite de {nome}?". Convite com status ERRO abre "Remover {nome} da fila?".
6. Os dois botões do diálogo ficam visíveis sem rolar a tela em 375x667 e têm toque de pelo menos 44px. Manter o arranjo atual do `DialogProvider` (não redesenhar).
7. Foco: ao abrir, o foco vai ao botão de confirmar (padrão atual); ao fechar sem confirmar,
   o foco volta à lixeira que abriu (já feito por `useModalFocus`; só verificar).
8. Leitor de tela: o diálogo é anunciado como `alertdialog` com o título (já garantido).
9. Duplo toque rápido em `Excluir aviso` não dispara duas exclusões nem erro.
10. Morador, Portaria e Conselho continuam sem ver as lixeiras (comportamento atual).
11. O convite com status ENVIADO continua sem botão de cancelar (comportamento atual).
12. Um toque na lixeira de um aviso e depois em outro: só um diálogo aberto por vez (já é assim).
13. As confirmações existentes (veículo, espaço, contato, documento, morador do card,
    unidade, acesso) continuam funcionando; Excluir unidade e Excluir acesso mostram o texto novo.
14. `npm run build` e lint passam; bateria `scripts/qa/` sem regressão (se algum teste clicava
    na lixeira do Mural sem confirmar, atualizar para clicar também em "Excluir aviso").

## O que fica de fora
- **Desfazer (toast "aviso excluído, desfazer")** em vez de diálogo: melhor para o usuário,
  mas exige exclusão adiada ou lixeira no banco. Custo maior; reavaliar se aparecer queixa.
- **Lixeira/arquivo de avisos** (soft delete) e "arquivar em vez de excluir".
- Exigir digitar o nome ("digite EXCLUIR"): exagero para aviso e convite. Reservado para a
  limpeza da base, já adiada em `docs/produto.md`.
- Confirmação ao remover item **dentro de formulário** ainda não salvo.
- Exclusão de multas (não existe botão na tela; ver spec do ciclo da multa).
- Mudar permissões de quem pode excluir (isso é o spec #20).

## Riscos
- Baixo. Mudança de interface e mensagens. Único cuidado: o novo `cancelLabel` no
  `DialogProvider` é compartilhado por todas as telas; manter o padrão "Cancelar" onde não
  for informado.
- LGPD: o registro de auditoria dos dois eventos não deve guardar e-mail, telefone nem o
  corpo do aviso.

## Como validar barato
Abrir a prévia no celular, apagar um aviso de teste e cancelar um convite de teste no
staging. Cinco minutos, sem precisar do síndico real.
