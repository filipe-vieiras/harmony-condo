# QA: Perfil de Zelador, fase 1 (#82)

Data: 06/10/2026 · Ambiente: staging (app local) · Base: PRD `docs/specs/2026-10-05-perfil-zelador.md`, migração 0041.
Telas testadas em desktop (1280x800) e celular (375px; Chromium emulado e WebKit para as telas do Zelador).
Fora do escopo desta rodada: cartão "Contato do Zelador" (fase 2) e a revisão de segurança por API (outra frente).

## Resultado por grupo

| Grupo | Resultado |
|---|---|
| 1. Zelador logado: menu, redirecionamentos, Início, Moradores, Veículos, Mural, Links | PASSOU |
| 2. Reservas pelo Zelador e interdição de espaço | PASSOU (3 observações leves) |
| 3. Gestão designando o Zelador (Síndico/ADM), convite, aceite, troca, reativação | PASSOU |
| 4. Outros perfis sem poderes novos | PASSOU |
| 5. Hierarquia e escalada pela interface | PASSOU |
| 6. Regressão, console, 375px, bateria, WebKit | PASSOU |

Bateria `node scripts/qa/bateria.mjs`: 1047 checks, TUDO OK. Seed rodado uma vez ao final; o staging está recriado.

## O que foi verificado

1. **Zelador logado.** Menu só com Visão Geral, Mural, Moradores & Unidades, Veículos & Garagem, Reserva de Espaços e Links & Documentos. `/usuarios`, `/multas`, `/relatorios` e `/autocadastro` voltam ao Início sem tela de erro. Início operacional (reservas aguardando, espaços interditados com motivo, avisos). Moradores & Unidades mostra nome, telefone, e-mail e dependentes, sem RG/CPF (texto e HTML), sem editar/excluir. Veículos: lista e cadastro de visitante funcionam; sem editar/excluir. Mural: lê e publica, sem opção de fixar, sem editar/apagar avisos. Links: somente leitura. Sem erro de console e sem resposta 4xx/5xx nas 6 telas e nas 4 rotas bloqueadas (medido em WebKit); nenhuma tela quebra por falta de unidade.
2. **Reservas.** Aprovar, recusar (com justificativa), cancelar reserva confirmada (motivo obrigatório; o morador recebe a notificação) e registrar reserva em nome de morador funcionam. Sem Editar/Cadastrar/Excluir espaço, sem valor, faixa, bloqueios nem aprovação. Interdição pelo diálogo, com e sem reservas futuras: contador de 140 (acima de 140 o envio é barrado com mensagem), link "Ver reservas futuras deste espaço" abre a lista com "Cancelar reserva", editar motivo, reabrir (motivo limpo). O morador vê "Em manutenção: {motivo}" ou só "Em manutenção"; a equipe vê "Interditado por {nome} em {data}" e a contagem de futuras. HTML no motivo aparece como texto puro. Reservas existentes não mudam ao interditar; novo pedido em espaço interditado é recusado pelo banco para Morador, Zelador e Síndico, e o espaço fica desabilitado no formulário.
3. **Designação.** Síndico e ADM veem o cartão Zelador; assistente de 3 passos com destino só "Pessoa nova", passo 2 com o texto fixo e "Remover o acesso desta pessoa" marcada e travada, botão "Confirmar novo Zelador" sem digitar TRANSFERIR. Convite com link; aceite pelo link (Continuar, definir senha, "Seu novo cargo já está ativo"). Segundo Zelador recusado (opção "já ocupado" desabilitada). A troca remove o acesso do anterior: o login mostra "Seu acesso a este condomínio foi encerrado. Fale com a administração." Selo "Zelador" e "Acesso removido" na lista. "Reativar acesso" aparece só com o cargo vago, para Síndico/ADM, é auditado e devolve o login. Subsíndico, Conselho, Portaria e Morador não veem a seção de cargos nem as ações.
4. **Outros perfis.** Subsíndico (cadastro, edição e exclusão de espaço, interditar/reabrir), Conselho, Portaria, Morador, Inquilino, provisório e visitante sem login seguem como antes. O formulário do espaço não tem mais o interruptor "Espaço disponível"; um espaço inativo aparece como "Em manutenção".
5. **Escalada.** O Zelador recebe 403 em redefinir senha, convidar, transferir cargo, excluir usuário, validar cadastro, excluir unidade e reativar acesso; não altera o próprio papel nem o de outros; o papel dele no banco não mudou. Subsíndico, Conselho, Portaria e Morador recebem 403 em "reativar Zelador".
6. **Regressão.** Transferência de cargo dos outros cargos (assistente de Conselho com as duas opções de destino), convites, redefinição de senha, login e logout, 375px sem rolagem horizontal nas 6 telas do Zelador. `node scripts/qa/webkit-mobile.mjs`: TUDO OK.

## Bugs e observações

Nenhum bug que bloqueie ou grave.

**Leves**
- **L1. Texto do diálogo de interdição diferente do PRD (seção 4.1).** Com reservas futuras, o diálogo diz "Novos pedidos ficam bloqueados. As N reservas futuras continuam valendo: cancele-as manualmente se precisar." e não traz "Nenhuma reserva foi cancelada. Daqui para frente ninguém consegue fazer novos pedidos...", nem a contagem separada em pendentes e aprovadas. O PRD deixa o texto final ao designer; confirmar se o texto atual é o aprovado.
- **L2. Concordância.** O diálogo diz "Interditar o Churrasqueira?", "Reabrir o Churrasqueira?" e "do Sala de Jogos" (artigo fixo "o"). Sugestão: "Interditar {nome}?" ou usar o artigo certo.
- **L3. Rótulo inconsistente.** Na lista "Bloqueios entre espaços" do formulário do espaço, espaços interditados aparecem como "(inativo)", enquanto o resto da tela diz "Em manutenção".
- **L4. Observação.** O Zelador não edita nem apaga nem os avisos que ele mesmo publicou (o PRD diz "só os próprios; não edita nem exclui os de outros"). Confirmar a intenção.

## O que não deu para testar
- Cartão "Contato do Zelador" (fase 2, fora do pedido).
- Aviso "O cargo de Zelador está vago" no Início do Síndico/ADM e a notificação "O acesso de {nome} como Zelador foi removido" ao Síndico/ADM: não conferidos.
- Mensagem exibida na tela quando o espaço é interditado por outra pessoa enquanto o formulário de reserva já está aberto (o banco recusa; a mensagem na tela não foi vista).
- Derrubada em tempo real de uma sessão já aberta do ex-Zelador (só o login novo recusado foi verificado).
- Diálogo de interdição medido em WebKit: o script não achou o botão com a lista recolhida; as telas foram medidas, o diálogo só em Chromium emulado (sem estouro).
- Alguns erros 400/403 de rede apareceram no console durante as trocas de conta (logins e saídas) no início da rodada e não foram atribuídos a uma tela; uma nova medição completa das telas do Zelador, em WebKit, não registrou nenhum.

## Observações de ambiente
- Uma primeira execução da bateria caiu porque outro agente rodou o seed ao mesmo tempo; repetida sem concorrência, passou (1047).
- Dados criados nesta rodada ficam no staging; o seed final recriou a base. A senha do aceite de convite exige 8 caracteres (a conta `novo.zelador@staging.test` foi criada e apagada durante o teste).
