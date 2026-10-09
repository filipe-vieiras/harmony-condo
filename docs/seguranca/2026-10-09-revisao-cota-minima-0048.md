# Revisão de segurança pedida: migração 0048 (cota mínima e valor em percentual)

Data: 2026-10-09 · Autor: developer · Status: **parecer recebido e correções feitas na própria 0048 (ainda NÃO aplicada em staging nem produção); reteste pendente** · Arquivo: `supabase/migrations/0048_cota_minima_e_valor_percentual.sql` · Repositório público: nenhum dado real aqui.

## O que a migração faz (resumo)

1. `condominio_config`: tabela de linha única (`id = 1`) com a **cota mínima** (R$ 1,00 a R$ 100.000,00). RLS ligada; `revoke all` de `public, anon, authenticated`; `grant select` a `authenticated` com policy `is_admin()`. Nenhum `insert/update/delete` direto para ninguém.
2. `definir_cota_minima(numeric)`: única porta de escrita. `security definer`, `search_path = public`, exige `is_admin()`, recusa nulo, NaN, ±infinito, zero, negativo, acima do teto e mais de 2 casas (`cota_invalida`, 22023; sem permissão: `sem_permissao`, 42501). Grava a cota e a linha de `audit_logs` **na mesma transação**, **sem valores** (o Conselho lê o histórico). `for update` na linha única contra gravações simultâneas.
3. `spaces`: colunas `valor_tipo` (`FIXO`/`PERCENTUAL`, padrão `FIXO`) e `faixa_percentual`. `spaces_faixa_check` recriada: fixo e percentual nunca juntos; percentual > 0 e <= 100; limite < capacidade. Gatilho `spaces_validar_cota` recusa percentual sem cota cadastrada (`cota_nao_cadastrada`).
4. Cálculo: `calcular_valor_reserva` (interna, revogada de todos) é a conta única; `valor_reserva` (prévia) e `reservations_calcular_valor` (gatilho 12) a usam. `valor_percentual` = `round(cota x % / 100, 2)`, meio para cima, **nunca menos de R$ 0,01**. Percentual cobrado sem cota: `reserva_cota_indefinida` (nunca grava 0).
5. `valores_espacos_percentual()`: devolve só `(espaco_id, R$ cheio)` dos espaços em percentual, para a vitrine do morador, **sem a cota**.
6. `reservas_valor_base`: cota e percentual usados em cada reserva, **tabela à parte**, legível só por `is_admin()`, sem escrita para ninguém logado. Existe para `reservations` (lida por morador, Portaria e Conselho) **não** carregar a cota.

## Decisão: o valor é congelado no pedido

`reservations.valor_uso` é gravado pelo gatilho no `INSERT` (momento do pedido, não da aprovação) e fica imutável (gatilho 05 da 0039, sem mudança). Mudar a cota ou o percentual do espaço vale **só para pedidos novos**; reservas já feitas, aprovadas ou pendentes, mantêm o valor. `reservas_valor_base` guarda a base usada, para conferência.

## Pontos para o agente de segurança revisar

1. **Quem escreve a cota (decidido: Síndico, Subsíndico e ADM, mantido):** `is_admin()` = Síndico, Subsíndico e ADM (regra do projeto: os três têm o mesmo poder). O pedido do dono diz "síndico e administrador (só eles)"; **confirmei a interpretação como o grupo de gestão**. Se o Subsíndico deve ficar de fora: trocar `is_admin()` em `definir_cota_minima` e na policy, e `ADMIN_ROLES` em `Sidebar.tsx`/`configuracoes/page.tsx`. Confirmar.
2. **RLS e privilégios** de `condominio_config` e `reservas_valor_base`: conferir que nenhum perfil (inclusive `anon`) tem `insert/update/delete`, e que as policies `is_admin()` são as únicas. O Supabase concede privilégios por padrão a `anon/authenticated` em tabelas novas; a migração revoga de forma explícita.
3. **`security definer` + `search_path = public`** em `definir_cota_minima`, `calcular_valor_reserva`, `valor_reserva`, `valores_espacos_percentual`, `spaces_validar_cota`, `reservations_calcular_valor`. Conferir `revoke`/`grant`: `calcular_valor_reserva`, `valor_percentual` e os gatilhos revogados de todos; `valor_reserva`, `valores_espacos_percentual` e `definir_cota_minima` só para `authenticated`.
4. **Inferência da cota pelo morador (risco aceito, a confirmar):** o morador nunca vê a cota nem o percentual **na tela** (a cota "não é exibida na tela"; ela NÃO é inacessível), mas pela API ele lê `spaces.faixa_percentual` (a coluna está na linha do espaço, legível a quem lê espaços) e `valor_reserva`/`valores_espacos_percentual` (R$). Com os dois, `cota = R$ x 100 / %`. Fechar de vez exigiria mover o percentual para uma tabela só da gestão e servir o R$ por função (mudança maior). A spec do PM (seção 5) já tratava como aceitável ("dado do condomínio, não de uma unidade"). **Decisão do dono: risco aceito.**
5. **Auditoria na mesma transação**: `definir_cota_minima` insere em `audit_logs` como `security definer`, contornando a policy de insert do usuário. Conferir que o texto ("Cadastrou/Alterou a cota mínima do condomínio") e o `usuario_role` vêm do `profiles` (não do cliente) e que `detalhes` é sempre `{}`.
6. **`spaces_faixa_check` recriada** (`drop` + `add`): janela curta sem a constraint dentro da transação da migração. Linhas existentes continuam válidas (verificado: dados de `spaces` e `reservations` idênticos antes e depois).
7. **FK adiada** de `reservas_valor_base.reserva_id` (`deferrable initially deferred`): o gatilho BEFORE INSERT grava a base antes de a reserva existir. Conferir que não abre brecha (a tabela não tem escrita para ninguém logado; só o gatilho `security definer` insere; `on delete cascade`).
8. **Teto e casas decimais** (R$ 100.000,00; percentual até 100, 2 casas) são **suposições** a confirmar com o dono.
9. **A função `reservations_avisar_confirmacao_automatica` (0039) não foi redefinida:** a frase do valor ao síndico serve para percentual (mostra o R$ gravado). Se for desejado "(5% da cota)" no aviso, redefinir a versão final.
10. **Cota nunca apagada:** não há `delete`/`update` direto e a função recusa nulo; o service role (seed, manutenção) pode, por ser dono.

## Verificação feita (sem staging)

Não havia acesso ao staging nesta sessão (sem `.env.staging.local`; `aplicar-staging.sh` ainda aponta para o `psql` do macOS). Verifiquei num **PostgreSQL 16 local**: `baseline.sql` + migrações 0028 a 0047 + 0048, com `auth.uid()` simulado por perfil. Resultado:

- 0048 aplicada **duas vezes** sem erro (idempotente); dados de `spaces` e `reservations` idênticos antes e depois (hash).
- Morador, Conselho e Portaria: leitura de `condominio_config` e `reservas_valor_base` = 0 linhas; `definir_cota_minima` = `sem_permissao`; `update` direto = `permission denied`. `anon`: negado em tabela e funções.
- Síndico e ADM definem a cota; recusados (versão original): nulo, 0, negativo, NaN, Infinity, 100000,01, 10,123.
- Percentual sem cota: espaço recusado (`cota_nao_cadastrada`). Com cota R$ 1.200 e 5%: reserva grava `valor_uso = 60,00` mesmo com `valor_uso = 1` enviado pelo cliente; 7,5% acima de 10 pessoas: 0 com 10 e 90 com 11; fixo e grátis como antes.
- Congelamento: cota 1.200 para 2.000 e percentual 5 para 10 não alteram a reserva antiga (60,00); `update` do `valor_uso` = `reserva_imutavel`; reserva nova usa 200,00.
- Constraints do espaço recusam: fixo e percentual juntos, 0%, 100,01%, limite >= capacidade, percentual com tipo FIXO.
- Arredondamento: 1.234,56 x 5% = 61,73; 1,10 x 5% = 0,06; 0,01 x 0,01% = 0,01.
- `audit_logs`: 2 linhas (cadastrou, alterou), `detalhes = {}`, visíveis ao Conselho sem valores.
- **Não testado:** RLS real do Supabase (PostgREST/JWT), a tela contra o staging, `next dev` com dados.

## Como aplicar no staging

```
./scripts/aplicar-staging.sh supabase/migrations/0048_cota_minima_e_valor_percentual.sql --duas-vezes
```
Conferir por SELECT: `condominio_config` com 1 linha (`cota_minima` nula); `definir_cota_minima` existe; `valor_reserva` contém `calcular_valor_reserva`; 1 policy em `condominio_config`; nenhum grant de escrita a `authenticated/anon`. Depois: `node scripts/qa/bateria.mjs`, e **por último** `node scripts/seed-staging.mjs`. `./scripts/producao.sh checar` já traz os itens da 0048.

## Parecer de segurança e decisões do dono (09/10/2026)

Como a 0048 ainda não foi aplicada em lugar nenhum, as correções foram feitas **na própria 0048** (sem 0049).

**Decisões do dono**
- Síndico, Subsíndico e ADM editam a cota (`is_admin()`), como já estava.
- Piso da cota passa a ser **R$ 1,00** (antes R$ 0,01); teto continua R$ 100.000,00; percentual do espaço continua 0,01 a 100. Aplicado em `definir_cota_minima`, no `check` de `condominio_config`, em `src/lib/cotaMinima.ts`, na tela `/configuracoes`, na bateria `scripts/qa/valor-espaco.mjs` e nos textos de spec/design. O mínimo de R$ 0,01 do **valor calculado** de uma reserva em percentual (`valor_percentual`) não mudou: é piso do cálculo, não da cota.
- A cota **"não é exibida na tela"** do morador. Não dizemos mais "não é exposta": pela API é possível **inferi-la** (`spaces.faixa_percentual`, legível por quem lê espaços, mais o R$ final de `valor_reserva`/`valores_espacos_percentual`: cota = R$ x 100 / %). **Risco aceito pelo dono.** Migração, specs e design foram corrigidos para esse texto.

**Correção do parecer: `spaces_faixa_check`, ramo FIXO**
- Falha: em `numeric`, `NaN` é maior que qualquer número, então `faixa_valor > 0` aceitava `'NaN'` e o valor cobrado virava NaN; também não havia teto.
- Agora o ramo FIXO exige `faixa_valor <> 'NaN' and faixa_valor <= 100000`.
- Segurança com dados da fase 1: antes de recriar a constraint, a migração conta espaços FIXO com `faixa_valor` NaN ou acima de R$ 100.000,00 e, se houver algum, **para com mensagem clara** (nada é alterado). Continua idempotente (`drop constraint if exists` + `add`). Não foi possível consultar o staging nem a produção nesta sessão; **antes de aplicar, conferir**: `select id, faixa_valor from spaces where faixa_valor = 'NaN' or faixa_valor > 100000;` deve voltar vazio.

**Pendências registradas (não implementadas, ficam para depois)**
1. **Histórico de valores** (cota e percentual do espaço ao longo do tempo): hoje só a auditoria sem valores e `reservas_valor_base` por reserva.
2. **Mudança em `is_admin()`**: não alterada nesta entrega; avaliar depois (ver ponto 1 acima, se o Subsíndico deixar de editar a cota).
