# Processo de entrega do Harmony

Como uma mudança vai da ideia até a produção. Escrito em 08/10/2026, a partir do lote de migrações 0044 a 0047 (aplicado em staging e produção nesse dia) e dos scripts em `scripts/`. Repositório público: nada aqui contém dado real, senha ou segredo (credenciais ficam em `.env.staging.local`, fora do git).

## Fluxo

| # | Etapa | Responsável | Saída |
|---|---|---|---|
| 1 | Especificar | `product-manager` | spec em `docs/specs/` com critérios de aceite testáveis |
| 2 | Implementar no `develop` | `developer` | código e migração no `develop`, **sem commit** |
| 3 | Migração no staging | `developer` | `./scripts/aplicar-staging.sh supabase/migrations/NNNN_nome.sql --duas-vezes`, conferida por SELECT |
| 4 | Revisão de segurança | `seguranca` | parecer, **obrigatória** se toca RLS, dado pessoal ou rotas `api/` |
| 5 | QA | `qa` | `node scripts/qa/bateria.mjs` e **depois** `node scripts/seed-staging.mjs`; relatório em `docs/qa/` |
| 6 | Commit e PR `develop` → `main` | sessão principal | PR aberto, sem mesclar |
| 7 | Produção | dono (terminal dele) | ver abaixo |

Notas:
- **Etapa 3:** `--duas-vezes` prova que a migração é idempotente. O SELECT confere o efeito real (função, constraint, policy), não só a ausência de erro.
- **Etapa 5:** a bateria só passa com o staging **recém-semeado**. Ela e outros scripts de `scripts/qa/` trocam senhas e criam dados; por isso rode o seed **depois**, para deixar o staging limpo para a próxima rodada (e antes dela, se algo rodou no meio). Sem isso, aparece "Invalid login credentials" que não é bug do app.
- Nenhuma tarefa vai para Done sem passar pela coluna Teste do quadro (decisão de 02/10).

## Produção

Só o dono executa, em `./scripts/producao.sh` (usa `PROD_DB_*`, recusa usuário que não seja o de produção, exige backup de até 60 min e que se digite o nome do arquivo).

1. `./scripts/producao.sh checar`: só leitura. Mostra o que já está aplicado e os dados que as migrações validam (ex.: links fora de http(s), reservas com fim <= início). Resultado inesperado: parar.
2. `./scripts/producao.sh backup`: dump completo em `backups/` (fora do git).
3. `./scripts/producao.sh aplicar supabase/migrations/NNNN_nome.sql`: **uma migração por vez, na ordem, UMA vez cada.**
4. Só então mesclar o PR no `main`. **Banco antes do código**: o código novo nunca pode rodar contra um banco que ainda não tem a migração.
5. `checar` de novo para confirmar que tudo aparece como aplicado.

**Nunca repetir uma migração em produção.** Em 08/10, a 0044 reaplicada depois da 0046 desfez a 0046 (a função `livro_definir_modo` voltou à versão antiga). Foi percebido ao acompanhar o terminal (o `checar` da época não distinguia as duas versões) e corrigido reaplicando a 0046; o `checar` ganhou então a linha da trava `for update`, que confirma a versão certa. Por isso:
- Migração deve ser **idempotente e nunca depender da ordem de reaplicação**. Quando redefine uma função já alterada por migração anterior, a nova deve ser a versão completa e final; migrações antigas não devem ser reexecutadas "por garantia".
- Se `checar` mostra uma migração como não aplicada, aplicar **só aquela**, depois ler o `checar` de novo. Em dúvida, perguntar antes.
- O `checar` precisa ganhar um item para cada migração nova (hoje cobre 0040 a 0047).

## Regras gerais
- **Não usar `--delete-branch` ao mesclar.** O `develop` é permanente.
- A **Vercel liga a prévia do `develop` ao banco de staging**; só o `main` fala com produção.
- **Quem autoriza o quê:** escrita em produção (backup é leitura, `aplicar` é escrita) e merge no `main` **só com ok explícito do dono, por lote**. Ok de um lote não vale para o seguinte. Agentes não tocam em produção; o `aplicar-staging.sh` só aceita o projeto de staging.
- Commit, push e merge são da sessão principal, nunca do `developer`.

## Checklist de release (copiar para o PR)
```
[ ] Spec com critérios de aceite em docs/specs/
[ ] Migração(ões) idempotentes; aplicadas no staging com --duas-vezes e conferidas por SELECT
[ ] Revisão de segurança feita (se toca RLS, dados pessoais ou rotas)
[ ] bateria.mjs verde; seed-staging.mjs rodado depois; relatório em docs/qa/
[ ] checar atualizado para as migrações novas; PR develop -> main aberto
[ ] Ok explícito do dono para este lote (produção e merge)
[ ] producao.sh checar -> backup -> aplicar (uma por vez, na ordem, uma vez cada)
[ ] PR mesclado, SEM --delete-branch
[ ] producao.sh checar de novo: tudo aplicado, contagens esperadas
[ ] docs/produto.md atualizado; QA/aviso ao dono sobre o que mudou para o usuário
```

## O que ainda não está automatizado
- **Nada impede aplicar a mesma migração duas vezes em produção.** Não há tabela de controle de migrações aplicadas; a proteção é a disciplina e o `checar`, que é escrito à mão por migração.
- `checar` não é executado antes do merge de forma automática: nenhum teste do CI bloqueia merge com banco defasado.
- A ordem seed → bateria → seed é manual; a bateria não detecta sozinha se o staging está "sujo".
- Staging e produção podem divergir sem alerta (não há comparação de esquema).
- Backup não é testado por restauração e não há rotina agendada; é manual, antes de cada lote.
- Revisão de segurança e QA dependem de alguém lembrar de chamá-las; não há gatilho por tipo de arquivo alterado.
- Reversão (rollback) não existe como script: o caminho é restaurar o backup ou escrever migração corretiva.
