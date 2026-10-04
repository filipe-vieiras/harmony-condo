# Medição da fase 1: autocadastro, unidades e veículos

Data: 2026-10-04. Autor: agente de dados. Status: proposta, aguardando o dono.
Nada aqui foi executado: as consultas são para a sessão principal ou o dono rodar, com autorização.
Sem dados reais, sem chaves, sem IDs de projeto.

## 0. Recomendação em cinco linhas

1. Comece só com o banco: as consultas da seção 2 respondem 80% do que o dono quer saber, a custo zero.
2. **Nenhuma ferramenta de analytics de terceiros na fase 1.** O volume é minúsculo (centenas de eventos) e o que falta
   (funil da tela, erros, celular, origem do clique) cabe em 5 eventos gravados no próprio banco, sem cookie, sem banner.
3. Coloque um parâmetro no link do WhatsApp (`?c=lote1`) para saber de qual envio veio cada abertura.
4. Rode as consultas toda segunda-feira e cole o resultado numa planilha: o banco guarda o estado, não o histórico.
5. Antes de divulgar o link para 100+ pessoas: o formulário público coleta nome, e-mail, telefone, RG/CPF e placa e
   **não encontrei aviso de privacidade nele** (busca em `src/`). Isso pesa mais que qualquer métrica (seção 6).

## 1. Decisões que os números apoiam

| # | Decisão | Métrica que decide | Regra provisória (suposição) |
|---|---|---|---|
| D1 | Reenviar o link ou lembrar por bloco no WhatsApp? | M1 cobertura por bloco, 7 e 14 dias após cada envio | Bloco com menos de 40% de cobertura após 7 dias recebe lembrete |
| D2 | O formulário está difícil? | M2 funil, M10 erros por campo (evento) | Enviados / abertos abaixo de 50% no celular: simplificar antes de reenviar |
| D3 | O síndico é o gargalo? | M3 tempo de validação, fila parada | Mediana acima de 24 h ou algum envio parado há mais de 72 h: validar em lote, avisar o ADM ou pedir ajuda ao subsíndico |
| D4 | A Portaria já pode confiar na base de placas? | M1, M6 unidades cobertas com veículo, M8 placas fora do padrão | Só com cobertura de unidades acima de 80% e placas fora do padrão em zero. Antes disso, a busca de placa é "ajuda", não prova (um "não achei" não significa "não é morador") |
| D5 | Quando liberar a fase 2 (multas, reservas)? | M1, M3, M7 | Cobertura acima de 70%, fila vazia ou com menos de 5% dos envios, e o síndico validando sozinho por 2 semanas seguidas |

Sem decisão ligada, a métrica não entra no painel.

## 2. O que o banco já responde

### 2.1 Fatos do código que mudam como ler os números

- O link público é `/cadastro` (`src/app/cadastro/page.tsx`); `/autocadastro` é a fila do síndico.
- Ao enviar, a conta nasce na hora com `profiles.cadastro_validado = false` (provisória) e uma linha em `autocadastros`
  com status `AGUARDANDO`. Veículos informados ficam no JSON `autocadastros.veiculos`; **só viram linha em `vehicles` quando o
  síndico valida**. Portanto a Portaria só enxerga placa de quem foi validado.
- **Recusar apaga a conta** (`profiles` e usuário de login). A linha de `autocadastros` fica, com `user_id` nulo.
  Por isso o funil se lê de `autocadastros`, nunca de `profiles`.
- Uma unidade tem um único titular com login (`units.usuario_id`). Segundo envio para a mesma unidade trava na validação.
- Placa duplicada na validação é ignorada (aviso na tela do síndico, **sem registro no banco**). A consulta Q8c estima isso.
- `vehicles.tipo_veiculo` tem padrão `OUTRO`. Veículos criados antes de 02/10/2026 (migração 0030) são `OUTRO` por padrão,
  não por escolha. O corte da consulta Q5 é aproximado (suposição).
- Datas em UTC no banco; as consultas convertem para `America/Sao_Paulo`.
- Tudo abaixo devolve **contagens**. Nenhuma consulta devolve nome, e-mail, telefone ou placa.

### 2.2 Métricas

| Id | Métrica | Numerador | Denominador | Janela |
|---|---|---|---|---|
| M1 | Cobertura de unidades | Unidades com `usuario_id` cuja conta tem `cadastro_validado = true` | Total de `units` | Estado atual, e por bloco; fotografar toda segunda |
| M2 | Funil do autocadastro (banco) | Envios por status (AGUARDANDO, VALIDADO, RECUSADO) | Envios totais | Por dia e acumulado desde a abertura do link |
| M3 | Tempo até validar | Mediana e P90 de `validado_em - criado_em` | Envios VALIDADO | Últimos 30 dias; mais a idade da fila atual |
| M4 | Veículos por unidade | Distribuição 0, 1, 2, 3 ou mais | Unidades cobertas | Estado atual |
| M5 | Tipo do veículo | Carro, Moto, Outro; "Outro por padrão" separado | Veículos | Estado atual |
| M6 | Unidades cobertas com veículo | Unidades cobertas com 1 veículo ou mais | Unidades cobertas | Estado atual (ver limite abaixo) |
| M7 | Fila parada | Envios AGUARDANDO com mais de 24 h e mais de 72 h | Envios AGUARDANDO | Agora |
| M8 | Qualidade da placa | Veículos com placa fora de `ABC1234` / `ABC1D23` | Veículos | Estado atual |
| M9 | Contas x convites | Convites enviados cuja conta já entrou ao menos uma vez | Convites enviados | Estado atual |
| M10 | Uso por perfil | Contas com último acesso em 7 dias e em 30 dias | Contas do perfil | Estado atual (só o último acesso) |

Limite de M6: o banco não distingue "unidade sem veículo" de "unidade que ainda não cadastrou". Leia M6 como piso. Se o
dono quiser a distinção, a solução é um campo "esta unidade não tem veículo" no formulário (decisão de produto, não agora).

### 2.3 Consultas de leitura (rodar no SQL Editor do staging primeiro; produção só com autorização)

```sql
-- Q1. Cobertura de unidades (M1), total e por bloco
with cob as (
  select u.id, u.bloco,
         exists (select 1 from public.profiles p
                 where p.id = u.usuario_id and p.cadastro_validado) as coberta,
         exists (select 1 from public.autocadastros a
                 where a.unit_id = u.id and a.status = 'AGUARDANDO') as aguardando
  from public.units u
)
select coalesce(bloco, 'TOTAL') as bloco,
       count(*)                                                    as unidades,
       count(*) filter (where coberta)                             as cobertas,
       count(*) filter (where not coberta and aguardando)          as so_aguardando,
       count(*) filter (where not coberta and not aguardando)      as sem_nada,
       round(100.0 * count(*) filter (where coberta) / nullif(count(*), 0), 1) as pct_coberta
from cob
group by rollup (bloco)
order by bloco nulls last;
```

```sql
-- Q2a. Funil do autocadastro (M2): totais por status
select status, count(*) as envios,
       count(distinct unit_id) as unidades,
       min(criado_em at time zone 'America/Sao_Paulo') as primeiro,
       max(criado_em at time zone 'America/Sao_Paulo') as ultimo
from public.autocadastros
group by status
order by status;

-- Q2b. Envios por dia (para ver o efeito de cada mensagem no WhatsApp)
select (criado_em at time zone 'America/Sao_Paulo')::date as dia,
       count(*) as envios,
       count(*) filter (where status = 'VALIDADO')  as validados,
       count(*) filter (where status = 'RECUSADO')  as recusados,
       count(*) filter (where status = 'AGUARDANDO') as aguardando
from public.autocadastros
group by 1 order by 1;

-- Q2c. Unidades com 2 ou mais envios em aberto (conflito de titular) e contas provisórias sem envio
select 'unidades_com_2_aguardando' as item, count(*) as total
from (select unit_id from public.autocadastros where status = 'AGUARDANDO'
      group by unit_id having count(*) > 1) x
union all
select 'contas_provisorias_sem_envio_aguardando', count(*)
from public.profiles p
where p.cadastro_validado = false
  and not exists (select 1 from public.autocadastros a
                  where a.user_id = p.id and a.status = 'AGUARDANDO');
```

```sql
-- Q3a. Tempo entre envio e decisão (M3), em horas, últimos 30 dias
select status,
       count(*) as envios,
       round((percentile_cont(0.5) within group (order by extract(epoch from (validado_em - criado_em)) / 3600))::numeric, 1) as mediana_h,
       round((percentile_cont(0.9) within group (order by extract(epoch from (validado_em - criado_em)) / 3600))::numeric, 1) as p90_h
from public.autocadastros
where status in ('VALIDADO', 'RECUSADO')
  and validado_em is not null
  and criado_em >= now() - interval '30 days'
group by status;

-- Q3b. Fila parada agora (M7)
select count(*)                                                    as aguardando,
       count(*) filter (where criado_em < now() - interval '24 hours') as mais_de_24h,
       count(*) filter (where criado_em < now() - interval '72 hours') as mais_de_72h,
       round(max(extract(epoch from (now() - criado_em)) / 3600)::numeric, 1) as mais_antigo_h
from public.autocadastros
where status = 'AGUARDANDO';
```

```sql
-- Q4. Veículos por unidade coberta (M4 e M6) + veículos ainda só no envio (não aparecem para a Portaria)
with cobertas as (
  select u.id from public.units u
  join public.profiles p on p.id = u.usuario_id and p.cadastro_validado
),
qtd as (
  select c.id, count(v.id) as n
  from cobertas c left join public.vehicles v on v.unit_id = c.id
  group by c.id
)
select case when n >= 3 then '3 ou mais' else n::text end as veiculos_na_unidade,
       count(*) as unidades
from qtd group by 1 order by 1;

select 'veiculos_sem_unit_id' as item, count(*) as total from public.vehicles where unit_id is null
union all
select 'veiculos_em_envios_aguardando', coalesce(sum(jsonb_array_length(veiculos)), 0)
from public.autocadastros where status = 'AGUARDANDO';
```

```sql
-- Q5. Tipo do veículo (M5). Troque o corte se a migração 0030 entrou em outra data em produção.
select tipo_veiculo,
       count(*) as veiculos,
       count(*) filter (where created_at <  timestamptz '2026-10-02 00:00-03') as criados_antes_do_corte,
       count(*) filter (where created_at >= timestamptz '2026-10-02 00:00-03') as criados_depois_do_corte,
       round(100.0 * count(*) / sum(count(*)) over (), 1) as pct
from public.vehicles
group by tipo_veiculo order by tipo_veiculo;

-- "Outro" que o morador escolheu ou deixou no padrão depois do corte (leitura: se alto, o formulário não induz a escolha)
select count(*) as outro_depois_do_corte
from public.vehicles
where tipo_veiculo = 'OUTRO' and created_at >= timestamptz '2026-10-02 00:00-03';
```

```sql
-- Q6. Unidades cobertas sem veículo, por bloco (M6)
select u.bloco, count(*) as cobertas_sem_veiculo
from public.units u
join public.profiles p on p.id = u.usuario_id and p.cadastro_validado
where not exists (select 1 from public.vehicles v where v.unit_id = u.id)
group by u.bloco order by u.bloco;
```

```sql
-- Q8a. Placas fora do padrão (M8). Devolve só id e unidade, NUNCA a placa.
select v.id, v.bloco, v.unidade, v.created_at
from public.vehicles v
where v.placa !~ '^[A-Z]{3}[0-9]{4}$'
  and v.placa !~ '^[A-Z]{3}[0-9][A-Z][0-9]{2}$'
order by v.created_at;

-- Q8b. Contagem simples
select count(*) filter (where placa !~ '^[A-Z]{3}[0-9]{4}$' and placa !~ '^[A-Z]{3}[0-9][A-Z][0-9]{2}$') as fora_do_padrao,
       count(*) as total
from public.vehicles;

-- Q8c. Placas de envios VALIDADOS que não viraram veículo da própria unidade (duplicada ou erro). Só contagem.
select count(*) as placas_nao_cadastradas
from public.autocadastros a
cross join lateral jsonb_array_elements(a.veiculos) as v
where a.status = 'VALIDADO'
  and not exists (select 1 from public.vehicles x
                  where x.placa = v->>'placa' and x.unit_id = a.unit_id);
```

```sql
-- Q9. Convites x contas (M9). Exige acesso ao schema auth (SQL Editor com perfil de dono/service role).
select pi.status as status_convite_fila, pi.role, count(*) as convites
from public.pending_invites pi group by 1, 2 order by 1, 2;

select u.status_convite as status_na_unidade, count(*) as unidades
from public.units u group by 1 order by 1;

-- "Aceitou" = a conta entrou ao menos uma vez
select count(*) filter (where au.last_sign_in_at is not null) as convites_aceitos,
       count(*) as convites_enviados
from public.units u
join auth.users au on au.id = u.usuario_id
where u.status_convite in ('ENVIADO', 'ATIVO');
```

```sql
-- Q10. Uso por perfil (M10). Mesmo requisito de acesso a auth.users.
select p.role,
       count(*) as contas,
       count(*) filter (where au.last_sign_in_at >= now() - interval '7 days')  as ativas_7d,
       count(*) filter (where au.last_sign_in_at >= now() - interval '30 days') as ativas_30d,
       count(*) filter (where au.last_sign_in_at is null) as nunca_entraram,
       count(*) filter (where not p.cadastro_validado) as provisorias
from public.profiles p
join auth.users au on au.id = p.id
group by p.role order by p.role;

-- Atividade do síndico/ADM por semana (retenção da equipe), a partir do histórico de ações
select date_trunc('week', created_at at time zone 'America/Sao_Paulo')::date as semana,
       usuario_role, count(distinct usuario_id) as pessoas, count(*) as acoes
from public.audit_logs
where usuario_role in ('SINDICO', 'SUBSINDICO', 'ADM')
group by 1, 2 order by 1, 2;
```

Observação: `last_sign_in_at` guarda só o último acesso, sem histórico. Retenção semanal real de morador exige série:
fotografar Q10 toda segunda (planilha) até haver evento de login.

### 2.4 O que o banco NÃO responde

- Quantas pessoas **receberam** o link no WhatsApp, quantas **clicaram** e **de onde** (não há registro de abertura).
- **Abandono** do formulário (abriu e não enviou) e **tempo de preenchimento**.
- **Dispositivo** (celular x computador, navegador) e tamanho de tela.
- **Erros de tela e validação** que o morador viu (senha fraca, placa inválida, e-mail já usado). Envios recusados com 400, 409
  ou 429 não deixam rastro no banco; só nos logs de execução da Vercel (retenção a confirmar).
- Quem **abriu** a tela de Veículos depois de logado e desistiu.
- Retenção semanal de moradores (só último acesso).

## 3. Vale instalar ferramenta na fase 1? Não

### Comparação para este caso (centenas a poucos milhares de eventos por mês)

| Opção | Custo no volume | Esforço | LGPD e cookies | Peso no celular | Veredito |
|---|---|---|---|---|---|
| PostHog Cloud UE (Frankfurt) | Grátis: 1 milhão de eventos/mês [1][2] (a confirmar na página oficial) | Médio: SDK, config para não usar cookie, DPA | Por padrão grava cookie e localStorage; exige consentimento. Com `persistence: 'memory'` ou cookieless perde identificação e funil por pessoa [3] | SDK grande | Melhor candidato **se** houver ferramenta |
| PostHog self-host | Servidor próprio (custo de infra e manutenção, a confirmar) | Alto para um produto de uma pessoa | Dados ficam sob controle do dono | Igual | Exagero |
| GA4 | Grátis | Baixo | Cookies de terceiro, dados nos EUA, banner obrigatório, usuário idoso no WhatsApp vai ver banner; histórico de questionamentos na UE (a confirmar) | Médio | Não |
| Amplitude | Grátis até 2 milhões de eventos e 10 mil usuários rastreados/mês [4] (varia por fonte, a confirmar) | Médio | Cookie por padrão, região UE disponível (a confirmar) | Médio | Não: feito para produto grande |
| Mixpanel | Grátis até 1 milhão de eventos/mês, residência de dados UE no plano gratuito [4] (a confirmar) | Médio | Cookie/localStorage por padrão | Médio | Não |
| Plausible (cloud, UE) | A partir de US$ 9/mês para 10 mil pageviews, teste de 30 dias [5][6] (a confirmar; funis em plano superior, a confirmar) | Baixo: 1 script, 1 linha de config | Sem cookie, sem identificador persistente, hospedado na UE [5]: dispensa banner | Script bem leve [5] | Boa alternativa se o dono quiser painel pronto |
| Umami (cloud ou self-host) | Cloud grátis até 100 mil eventos/mês, 3 sites, 6 meses de retenção [7] (a confirmar); self-host grátis | Baixo a médio | Sem cookie por padrão; região e DPA do cloud a confirmar | Leve | Alternativa barata à Plausible |

Fontes: [1] https://userpilot.com/blog/posthog-features/ · [2] https://dev.to/beton/posthog-pricing-teardown-2026-57oo ·
[3] https://www.probo.com/blog/2026-05-27-posthog-cookie-banner-gdpr-ccpa-compliance · [4] https://openpanel.dev/articles/mixpanel-pricing e
https://amplitude.com/pricing · [5] https://plausible.io/ · [6] https://seline.com/blog/plausible-analytics-pricing ·
[7] https://freetier.co/directory/products/umami. Quase tudo é blog ou página resumida: **confirmar nas páginas oficiais antes de contratar**.
A página de preços do PostHog não carregou completa na minha consulta.

### Recomendação: nenhuma por enquanto; 5 eventos no próprio banco

Por quê:
- O custo não decide (todas cabem no grátis); o que decide é **risco e esforço**. Terceiro com cookie traz banner, DPA e
  transferência internacional para 100 moradores leigos, para responder 3 perguntas.
- As três perguntas que o banco não responde (abandono, erro por campo, celular) são todas do **formulário público**, uma tela
  só. Cinco eventos enviados à rota própria respondem tudo.
- O que eu cortaria: replay de sessão, autocapture, mapa de calor, identificação de usuário, qualquer propriedade de texto.

**Critério para mudar de ideia** (qualquer um): (a) a fase 2 abre e o dono quer funil por várias telas e caminhos de navegação;
(b) manter o painel de eventos custar mais de 1 dia de dev por mês; (c) mais de um condomínio. Aí: PostHog Cloud UE com
`cookieless_mode` / `persistence: 'memory'`, autocapture e replay desligados, DPA assinado; ou Plausible, se bastar contagem de
páginas e metas. Decidir de novo com preço oficial e o aviso de privacidade atualizado.

## 4. Tracking plan (próprio, sem terceiro, zero dado pessoal)

### Desenho
- Tabela nova `eventos_produto` (migração do `developer`): `id`, `criado_em`, `evento` (lista fechada), `sessao` (UUID aleatório
  gerado a cada abertura da página e mantido só em memória; não grava em cookie nem localStorage), `canal` e `campanha` (do
  parâmetro do link, validados por regex `^[a-z0-9-]{1,20}$`), `dispositivo` (`celular`, `computador`, `tablet`, derivado
  no servidor do navegador, sem guardar o texto do User-Agent), `props` (JSON só com chaves permitidas), `pid` (opcional, ver abaixo).
- Escrita: só por rota de servidor com validação de lista fechada de eventos e de chaves, limite por IP (o hash que já existe
  para o autocadastro serve) e corpo máximo pequeno. A rota é pública, então não confie no que vem do navegador.
  Leitura: só ADM e Síndico (RLS). Sem IP, sem User-Agent cru, sem URL completa.
- `pid` (só em eventos de morador logado, se um dia entrarem): HMAC do `user_id` com segredo do servidor. Pseudonimizado, ainda é
  dado pessoal pela LGPD: não sai do banco.

### Eventos (fase 1)

| Evento | Quando dispara | Propriedades permitidas | Perfil | Tela | Pergunta |
|---|---|---|---|---|---|
| `formulario_aberto` | Página `/cadastro` carrega | `estado` (aberto, fechado), canal, campanha, dispositivo | Visitante | `/cadastro` | Quantos abriram, de qual envio, em que aparelho? |
| `formulario_iniciado` | Primeira digitação em qualquer campo (uma vez por sessão) | dispositivo | Visitante | `/cadastro` | Quantos abrem e desistem sem tentar? |
| `campo_com_erro_exibido` | Mensagem de erro aparece sob um campo | `campo` (lista: unidade, nome, email, telefone, documento, senha, placa, modelo, tipo_veiculo), `codigo` (lista: obrigatorio, formato, curto, duplicado) | Visitante | `/cadastro` | Qual campo trava o morador? |
| `formulario_enviado` | Resposta de sucesso do envio | `tipo_ocupacao` (proprietario, inquilino), `qtd_veiculos` (0 a 5), `qtd_dependentes` (0 a 5) | Visitante | `/cadastro` | Quantos concluem, e com quantos veículos? |
| `envio_recusado_exibido` | Resposta de erro do envio | `motivo` (lista: fechado, limite, email_ja_cadastrado, unidade_invalida, validacao, erro_servidor) | Visitante | `/cadastro` | Por que tentativas falham? (409 = gente que já se cadastrou tentando de novo) |

Nunca em evento: placa, marca, modelo, cor, nome, e-mail, telefone, RG/CPF, bloco ou número da unidade, texto digitado,
mensagem de erro livre, motivo de recusa, IP, User-Agent completo.
Eventos que já existem no banco e **não** devem ser duplicados: login, veículo cadastrado, tipo corrigido (`audit_logs`),
validação e recusa (`autocadastros`).

### Regras de LGPD, consentimento e retenção
- Sem cookie e sem armazenamento no aparelho: não há banner de cookies. Se algum dia entrar ferramenta de terceiro, o padrão é
  **recusar** o não essencial e carregar o script só depois do aceite.
- Retenção: 90 dias para eventos brutos; depois apagar (rotina agendada ou manual) e manter só a tabela semanal em planilha.
- Onde fica: no mesmo banco do Harmony (região do projeto: a confirmar com o dono, sem registrar o ID aqui). Acesso: Síndico e ADM.
- Apagar um morador: eventos de formulário não têm identidade (sessão aleatória), então nada a apagar; eventos com `pid` se
  apagam com `delete ... where pid = hmac(user_id)`; entra no mesmo roteiro de exclusão da conta.
- Base legal e aviso: ver seção 6.

### Passos para o `developer`
1. Migração `eventos_produto` com RLS (insert só service role; select só Síndico/ADM), `check` na lista de eventos e índice
   por `criado_em` e `evento`. Rodar primeiro no staging.
2. Rota `POST /api/eventos` pública (liberar no middleware como a `/api/autocadastro/publico`), com lista fechada, limite por IP
   e corpo máximo. Descartar o que não estiver na lista (não gravar "o que veio").
3. No `/cadastro`: gerar `sessao` em memória; ler `?c=` e `?o=` do link; disparar os 5 eventos com `navigator.sendBeacon` ou
   `fetch` com `keepalive`, sem bloquear a tela e engolindo falhas (nunca quebrar o formulário por causa de métrica).
4. Pagar atenção a desempenho no celular: sem biblioteca, menos de 1 KB de código.
5. Texto do aviso de privacidade (seção 6) antes de divulgar.

### Passos de verificação para o `qa`
1. Abrir `/cadastro` em celular e computador: aparece uma linha `formulario_aberto` com o dispositivo certo.
2. Não existe cookie nem item no localStorage criado pelo evento (ferramentas do navegador).
3. Provocar cada erro de campo: o evento grava `campo` e `codigo`, **sem o valor digitado**.
4. Enviar com dados de teste (e-mail fictício): `props` não contém nome, e-mail, telefone, placa, unidade nem texto livre.
   Inspecionar a linha crua no banco, não só a tela.
5. Mandar corpo com evento ou chave fora da lista, e 200 requisições seguidas: descartado/limitado, sem erro visível ao morador.
6. Derrubar a rota de eventos: o formulário ainda envia o cadastro normalmente.
7. Confirmar que Morador, Portaria e Conselho não leem `eventos_produto`.

## 5. Painel mínimo (6 cartões, nenhum a mais)

Formato: planilha atualizada toda segunda com as consultas Q1 a Q10; sem página nova até haver rotina. Dono do painel:
o dono do produto. Quem roda: sessão principal, com autorização.

| Cartão | Pergunta | Ação que dispara | Meta provisória (suposição) |
|---|---|---|---|
| 1. Cobertura por bloco (Q1) | Quem ainda não entrou? | Lembrete por WhatsApp aos blocos abaixo de 40% após 7 dias | 60% em 30 dias do 1º envio; 80% em 60 dias |
| 2. Funil: abertos, iniciados, enviados (eventos) e validados (Q2) | Onde as pessoas caem? | Cair entre aberto e iniciado: texto/botão da página; entre iniciado e enviado: simplificar campos | Enviados / abertos acima de 50% no celular |
| 3. Fila e tempo de validação (Q3) | O síndico está dando conta? | Fila com 72 h ou mais: validar em lote ou pedir ajuda | Mediana abaixo de 24 h; nada acima de 72 h |
| 4. Unidades cobertas com veículo e veículos por unidade (Q4, Q6) | A base de placas serve à Portaria? | Pedir cadastro de veículo aos blocos com muita unidade sem veículo | 70% das unidades cobertas com 1 veículo ou mais (a unidade sem carro é desconhecida) |
| 5. Qualidade: placa fora do padrão e "Outro" (Q5, Q8) | Há sujeira para corrigir? | Síndico corrige as unidades listadas; revisar tela se "Outro" novo for alto | Placa fora do padrão: 0 novas; "Outro" criado depois do corte abaixo de 20% |
| 6. Erros por campo e motivo de recusa (eventos) | O que trava? | Ajustar a mensagem do campo campeão; se `email_ja_cadastrado` for alto, orientar "Esqueci a senha" no próprio formulário | Nenhum campo responde por mais de 30% dos erros |

Cortei de propósito: gráfico de uso por perfil e de convites (Q9, Q10). Rodar quando houver dúvida pontual, não no painel.
Todas as metas acima são suposições do agente de dados sem base histórica; recalibrar após as 2 primeiras semanas reais.

## 6. Riscos e LGPD

- **Aviso de privacidade ausente no formulário público (prioridade).** `/cadastro` pede nome, e-mail, telefone, RG/CPF e placa.
  A busca por "privacidade", "LGPD" e "termos" em `src/` só achou outras telas (multas, menu, contexto). Recomendo um
  parágrafo curto e um link no formulário antes de divulgar o link: quem trata, para quê (acesso ao portal, controle de
  veículos), quem vê (síndico, ADM, portaria para placa), por quanto tempo, contato para pedir correção ou exclusão.
- **Base legal (proposta; confirmar com o jurídico do condomínio, não sou advogado):** cadastro e controle de acesso e veículos
  = execução das atividades de gestão do condomínio / legítimo interesse (LGPD art. 7, V e IX); métricas de uso agregadas e sem
  identidade = legítimo interesse. RG/CPF no formulário: avaliar se é necessário (minimização); hoje é opcional no código.
  Quem é controlador (condomínio) e quem é operador (Harmony) precisa estar definido por escrito.
- **Dado pessoal retido sem prazo:** `autocadastros` mantém nome, e-mail, telefone e RG/CPF de **recusados** para sempre, e
  `audit_logs.acao` e `detalhes` carregam nome e e-mail do morador (validação) e o motivo digitado da recusa. Recomendo prazo
  (por exemplo, apagar dados pessoais de recusados após 90 dias) e nunca exportar `audit_logs` para ferramenta externa.
- **Cookies e consentimento:** o plano proposto não usa cookie de medição. Os cookies de sessão do login são essenciais e
  dispensam consentimento (confirmar texto no aviso).
- **Região dos dados:** a do projeto do banco (a confirmar com o dono). Ferramenta de terceiro só com região UE, DPA e
  decisão explícita do dono.
- **Apagar um morador:** hoje a recusa apaga conta e perfil. Para validados falta um roteiro único: conta, perfil, vínculo na
  unidade (`units.usuario_id`), linha em `autocadastros`, nome em `units.moradores`, veículos da unidade, notificações lidas
  e eventos com `pid`. Pedir ao `developer` um roteiro documentado (não é desta fase de métricas, mas é o pedido LGPD que vai chegar primeiro).
- **Viés de leitura:** poucos dados reais ainda. Percentuais com menos de 30 unidades por bloco oscilam muito; leia contagens.
- **Ruído de teste:** contas de teste do staging não entram em produção; em produção conferir que não há conta de teste
  contando como cobertura.

### Perguntas ao dono (máximo 2)
1. Podemos pôr um parágrafo de aviso de privacidade no formulário `/cadastro` antes de divulgar o link, e quem assina como
   responsável pelos dados (o condomínio ou a administradora)?
2. Aceita eu pedir ao `developer` a tabela de eventos própria (5 eventos, sem cookie) agora, em vez de esperar, para ter o funil do
   formulário já na primeira divulgação no WhatsApp? Sem ela só teremos o lado do banco (enviados e validados).

## 7. Trecho proposto para `docs/produto.md` (não editado; só com aprovação do dono)

> **Medição da fase 1 (proposta de 2026-10-04):** a fase 1 (autocadastro, unidades e veículos) é medida primeiro com consultas
> de leitura no banco (cobertura de unidades, funil do autocadastro, tempo de validação, veículos por unidade, tipo, placas fora
> do padrão), rodadas toda segunda e registradas numa planilha. **Sem ferramenta de analytics de terceiros** nesta fase; se
> necessário, 5 eventos gravados no próprio banco, sem cookie e sem dado pessoal, só no formulário `/cadastro`. Critério para
> reavaliar: fase 2 aberta com funil entre telas, ou mais de um condomínio (candidatos: PostHog Cloud UE em modo sem cookie ou
> Plausible, preços a confirmar). Metas provisórias (suposição): 60% das unidades validadas em 30 dias, mediana de validação
> abaixo de 24 h. Pendente: aviso de privacidade no formulário público, prazo de retenção para cadastros recusados,
> roteiro de exclusão de morador. Plano: `docs/dados/2026-10-04-medicao-cadastro-unidades-e-veiculos.md`.
