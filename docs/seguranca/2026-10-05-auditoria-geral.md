# Auditoria geral de segurança do Harmony

Data: 2026-10-05. Autor: agente `seguranca`. Escopo: o sistema inteiro (banco e RLS, rotas de API, autenticação e sessão, segredos e repositório público, navegador, dependências, lógica de negócio, LGPD).

> **Este documento é público (o repositório é público).** Por isso: não há valores de segredos, IDs de projeto nem passo a passo de exploração. Para os achados **Altos** ainda não corrigidos, aparecem só a classe da falha, a camada e a correção em termos gerais; o detalhe técnico foi entregue ao dono fora do repositório. Quando uma correção for feita, o achado pode ser detalhado aqui.

## 1. Conclusão

- **Falha crítica confirmada: não.** Um visitante anônimo (só com a chave pública do Supabase) não lê nem altera nenhum dado, não cria conta fora do formulário de autocadastro e não alcança funções de gestão. Nenhum segredo real foi achado no código, no histórico do git nem no pacote do navegador.
- Há **2 achados Altos**: dados de documento (RG/CPF) legíveis por perfis que não precisam deles, e concentração de poder entre perfis de gestão (um perfil de gestão assume a conta de outro sem deixar rastro confiável).
- Há 9 Médios, 9 Baixos e vários itens Informativos (inclui os pontos que estão bem feitos).

Contagem: **Crítica 0 · Alta 2 · Média 9 · Baixa 9 · Informativa 8.**

Legenda de evidência: **[T]** confirmado por teste no staging; **[C]** suspeita lida no código (não executada); **[N]** não testado.

## 2. O que foi coberto e como

- **Ambiente de teste:** só o staging, com as contas `@staging.test` e o app local apontando para o staging. Produção não foi acessada (análise estática do código e das migrações até a 0037). O branch `main` local está atrás do GitHub (não há rede para buscar); a auditoria usou o `develop` no commit do PR #53, que contém o código das migrações 0001 a 0037. Se o merge do PR #54 acrescentou algo depois, **não foi visto**.
- **Banco (staging):** consulta direta ao catálogo (`pg_class`, `pg_policies`, `pg_proc` com `has_function_privilege`, grants, triggers, publicações do Realtime, default ACLs) e testes por API com a chave anônima e o token de cada perfil (anônimo, Morador, Inquilino, Provisório, Portaria, Conselho, Subsíndico, ADM, Síndico).
- **Rotas de API:** as 11 rotas em `src/app/api`, lidas por inteiro e exercitadas por HTTP (sem sessão, perfil errado, método errado, corpo com `text/plain`, rajada de 10 requisições).
- **Auth:** configuração pública do Supabase (`/auth/v1/settings`), cadastro aberto, OTP, troca de senha, vida do JWT, exclusão e rebaixamento com sessão ativa, logout global, validade de link usado.
- **Segredos:** `git log --all -p` inteiro (4,6 MB de diffs, todos os branches e objetos inalcançáveis), `.gitignore`, build de produção local varrido (arquivos estáticos do navegador).
- **Navegador:** busca por `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `localStorage`, exportações; cabeçalhos do build de produção rodando em outra porta.
- **Dependências:** `npm audit`, `npm outdated`, boletins do Next.js e do Supabase.

## 3. Achados

### Altos

#### A1. Número de documento (RG/CPF) legível por Portaria e Conselho — Alta — [T]
- **Onde:** camada do banco (política de leitura da tabela `units`, que entrega a linha inteira, incluindo o campo JSON `moradores`, onde o autocadastro validado grava o RG/CPF do titular).
- **Evidência:** com um valor fictício gravado no staging, as contas de Portaria e de Conselho receberam o campo por consulta direta à API. Síndico, Subsíndico e ADM (esperado) também. A tela da Portaria não exibe o campo; o acesso é pela API com o token da própria sessão.
- **Cenário:** uma conta de Portaria (equipe terceirizada, rotatividade) ou de Conselho (morador voluntário) comprometida ou mal-intencionada extrai todos os documentos do condomínio em uma chamada.
- **Impacto:** exposição em massa de dado pessoal identificador (CPF) a quem não precisa dele (LGPD, princípio da necessidade). O dono decidiu manter telefone, e-mail e dependentes para esses perfis; **RG/CPF não estava na decisão**.
- **Correção recomendada (geral):** tirar o documento do JSON legível por esses perfis. Opção simples: mover o RG/CPF para uma tabela própria com política restrita a Síndico, Subsíndico e ADM (e ao próprio morador), e a Portaria e o Conselho lerem `units` por uma visão/função que não traga esse campo. Migrar os dados existentes. Alternativa mínima: não gravar o RG/CPF no JSON compartilhado e deixá-lo só em `autocadastros` (já restrita à gestão).
- **Esforço:** M (migração com mudança de modelo e ajuste das telas de Moradores e do autocadastro).
- **Como o QA confirma:** com um RG/CPF fictício em uma unidade, as contas de Portaria e Conselho consultam `units` pela API e **não** recebem o campo; Síndico, Subsíndico, ADM e o dono da unidade ainda o veem; exportação para Excel da gestão continua trazendo o campo.

#### A2. Concentração de poder entre perfis de gestão — Alta — [T]
- **Onde:** camada de rotas do servidor e da lógica de perfis (redefinição de senha, convites, transferência de cargo, trilha de auditoria).
- **Evidência:** o modelo "Subsíndico e ADM têm as mesmas permissões do Síndico" foi estendido além do que a decisão cobre. Um perfil de gestão consegue assumir a identidade de outro perfil de gestão, inclusive a do Síndico, e criar contas de perfil mais alto do que o seu. Além disso, a auditoria dessas ações é gravada pelo navegador depois da resposta do servidor, então uma chamada direta à rota não deixa registro.
- **Cenário:** uma conta de ADM (administradora externa, pode haver várias) ou de Subsíndico comprometida, ou de alguém que deixou a função, vira o Síndico sem que o Síndico ou o Conselho vejam rastro; também contorna a regra "só o ADM apaga multa".
- **Impacto:** perda de não repúdio sobre o cargo mais alto; ações de multa, cadastro e cargos atribuídas a outra pessoa.
- **Correção recomendada (geral):** (1) a rota de redefinição de senha não pode atingir contas de nível igual ou superior ao do executor (Síndico só por ele mesmo ou por fluxo próprio) e deve gravar a auditoria no servidor, na mesma operação; (2) convites e criação de contas ADM/Síndico só por quem tem esse poder (restringir por perfil do convidante, no servidor e no banco); (3) mover para o servidor, de forma que o navegador não possa omitir, o registro de auditoria de todas as ações sensíveis (exclusão de usuário/unidade, redefinição de senha, convites); (4) avisar o Síndico por notificação quando alguém gerar um link de redefinição para a conta dele.
- **Esforço:** M.
- **Como o QA confirma:** Subsíndico e ADM chamam as rotas diretamente contra a conta do Síndico e recebem recusa; convite com perfil acima do executor é recusado também por consulta direta ao banco; toda ação sensível aparece na auditoria mesmo quando chamada fora da interface, e o texto da trilha não depende do navegador.

### Médios

#### M1. Qualquer usuário com perfil escreve livremente em auditoria e notificações — Média — [T]
- **Onde:** políticas de INSERT de `audit_logs` e `notifications`; exportação CSV de `src/app/relatorios/page.tsx`.
- **Evidência:** qualquer morador com perfil insere linhas de auditoria no próprio nome com texto de ação livre e de tamanho sem limite (testado com 200 KB), e notificações para Síndico, Subsíndico e ADM com título e mensagem livres. Não há limite de taxa. O CSV da auditoria não neutraliza células que começam com `=`, `+`, `-`, `@` (já anotado pelo QA como L17), e o texto livre da ação é gravado assim. Os campos são exibidos como texto (sem XSS); o risco é na planilha e na confiança da trilha.
- **Cenário:** morador mal-intencionado polui o histórico com ações falsas (no próprio nome, mas com texto que parece de gestão), enche o banco e o sino da gestão, e planta fórmula que roda quando a gestão abre a exportação no Excel.
- **Impacto:** integridade e utilidade da auditoria, abuso de armazenamento, ataque à estação da gestão.
- **Correção (geral):** o histórico só pode ser gravado pelo servidor (revogar INSERT para `authenticated` em `audit_logs` e gravar por rota ou por gatilho no banco); notificações para a gestão só por função com limite de taxa e de tamanho (check de tamanho no banco). No CSV, prefixar com apóstrofo as células que comecem com `=`, `+`, `-`, `@`, tab ou CR e escapar aspas no nome do usuário.
- **Esforço:** M. **QA:** morador não consegue inserir em `audit_logs` por API; texto de 200 KB é recusado; célula com fórmula no CSV abre como texto.

#### M2. A multa aceita voltar atrás e mudar a ciência — Média — [T]
- **Onde:** gatilho `fines_guard_morador_update` (migração 0024).
- **Evidência:** o morador da unidade pode, depois do prazo, reabrir um recurso já indeferido (volta para "em recurso/em análise"), e reescrever o nome e a data da ciência registrada. O gatilho confere campos, mas não a sequência de estados nem o prazo. O julgamento em si e o valor continuam protegidos.
- **Cenário:** morador desfaz um indeferimento ou "ajusta" a data da ciência para escapar da cobrança. A ciência formal é a prova jurídica do módulo.
- **Correção:** máquina de estados no gatilho (só PENDENTE_CIENCIA para CIENCIA_REGISTRADA, só CIENCIA_REGISTRADA para EM_RECURSO e dentro do prazo, nada depois de decidida); `ciencia_data` e `ciencia_usuario_nome` preenchidos pelo banco (`now()` e o nome do perfil), nunca aceitos do cliente. **Esforço:** P/M. **QA:** tentativas fora de ordem e fora do prazo recusadas por API; ciência registra data e nome do banco.

#### M3. Autocadastro público: e-mail não verificado e acesso imediato ao diretório de moradores — Média — [T]
- **Onde:** `src/app/api/autocadastro/publico/route.ts` e a função `diretorio_unidades`.
- **Evidência:** a conta nasce com e-mail marcado como confirmado sem verificação. A conta provisória já lê o diretório (nomes dos responsáveis e quais unidades estão sem cadastro), antes de qualquer validação. O limite de 5 por hora conta só envios aceitos; a resposta distingue e-mail já existente (409) de novo (200), o que permite verificar se um e-mail tem conta. No Auth, o login por link de e-mail responde de forma diferente para e-mail desconhecido (recusa) e conhecido (envia), outra pista de existência de conta ([T] só o lado desconhecido; o outro lado enviaria e-mail real).
- **Cenário:** estranho na internet cria conta provisória em minutos e obtém a lista de nomes e a lista de unidades vazias; ou registra o e-mail de um morador antes dele. A validação do Síndico segura o acesso a dados da unidade, não a esse diretório.
- **Impacto:** LGPD (nomes) e risco físico (mapa de unidades vagas). Parte é decisão do dono (nomes pendentes ficam); o restante (nomes validados e vagas para quem ainda não foi validado) não estava explícito.
- **Correção:** diretório sem nomes e sem a situação "sem cadastro" para provisório (só bloco/número, ou nada); verificar o e-mail (link de confirmação) antes de dar acesso, ou desligar a confirmação automática; CAPTCHA (Turnstile) no formulário; limitar também as tentativas que falham. **Esforço:** M. **QA:** conta provisória não recebe nomes nem vagas; e-mail só confirma após o link.

#### M4. Política de senha fraca no servidor e sem proteção contra tentativa em massa — Média — [T] no staging, [N] em produção
- **Onde:** configuração do Supabase Auth e telas de senha.
- **Evidência:** o mínimo de 8 caracteres existe só nas telas e na rota do autocadastro; o servidor do Auth aceita 6 e não exige complexidade. Quem chama a API direto troca a própria senha para 8 dígitos simples. Dez tentativas de login seguidas com senha errada não foram limitadas (o limite padrão do Supabase por IP não foi alcançado). Não há bloqueio por conta, CAPTCHA nem checagem de senha vazada. O painel de produção não foi consultado.
- **Correção:** no painel do Supabase (Auth): mínimo 8 a 10, exigir letras e números, ligar a proteção de senhas vazadas (depende do plano) e CAPTCHA no login e no cadastro; confirmar o limite de taxa e o tempo de sessão (no plano Pro). **Esforço:** P. **QA:** troca para senha de 6 dígitos por API é recusada.

#### M5. Next.js 16.3.5 com boletins de segurança — Média — [T] (npm audit) / não alcançável hoje
- **Onde:** `package.json` (`next` 16.3.5; o `npm audit` classifica 1 crítica e 5 altas, estas últimas só em ferramentas de lint).
- **Evidência:** o boletim de setembro de 2026 corrige 7 falhas na versão 16.3.8 ([nextjs.org/blog/september-2026-security-release](https://nextjs.org/blog/september-2026-security-release)); a crítica de ImageResponse está em [GHSA-vcvr-r3jv-pc5j](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j) (faixa afetada 16.2.0 a 16.3.5; o painel do GitHub indica correção na 16.3.6). O sistema não usa `next/og`, `images.remotePatterns`, ISR/SSG de páginas com dados, `use cache`, nem rotas de imagem de metadados, então nenhuma delas é alcançável. O servidor de desenvolvimento (porta 3000) expõe um endpoint de diagnóstico que um site malicioso aberto no mesmo navegador do desenvolvedor pode consultar (baixa gravidade, só `next dev`).
- **Correção:** `npm install next@16.3.8 eslint-config-next@16.3.8`, rodar o build e o QA, e publicar. Atualizar também `@supabase/supabase-js` (2.117.2) e `lucide-react`. **Esforço:** P. **QA:** `npm audit --omit=dev` sem críticas; fluxos de login e convite passam.

#### M6. Permissões padrão do Supabase muito amplas — Média — [T]
- **Onde:** GRANTs no schema `public` e privilégios padrão para objetos futuros.
- **Evidência:** `anon` e `authenticated` têm todos os privilégios (inclusive TRUNCATE) na maioria das tabelas; hoje só a RLS segura. Os privilégios padrão do schema continuam concedendo tudo a `anon` e `authenticated` em tabelas, funções e sequências **futuras** (a migração 0037 teve de revogar à mão). O TRUNCATE não é alcançável pela API (a API não expõe esse comando), então hoje não há exploração, mas uma tabela nova sem RLS ou uma função nova sem REVOKE nasce aberta.
- **Correção:** migração que revoga de `anon` todos os privilégios nas tabelas do app e de `authenticated` o que não é usado (TRUNCATE, TRIGGER, REFERENCES, e DML onde a RLS já é a única barreira), e `ALTER DEFAULT PRIVILEGES ... REVOKE ... FROM anon, authenticated` para tabelas, funções e sequências. Rodar primeiro no staging com a bateria de QA. **Esforço:** M. **QA:** consulta de `information_schema.role_table_grants` sem privilégios excedentes para `anon`; bateria de perfis continua verde.

#### M7. Dado pessoal real e credenciais de teste no repositório público — Média — [T] (busca no repositório)
- **Onde:** `docs/specs/2026-10-01-vincular-unidade-a-conta-existente.md` (um e-mail pessoal de uma pessoa real, na descrição de um caso, também no histórico do git); `scripts/qa/lib.mjs` (senha fixa de contas de teste, com modo que aponta para produção).
- **Evidência:** o e-mail pessoal aparece nos critérios de aceite do documento. A senha do QA está em texto no script versionado, e o mesmo script, com `QA_ALVO=producao`, cria e apaga contas em produção.
- **Cenário:** coleta do e-mail por varredura de repositórios públicos (spam, engenharia social contra o Síndico); se uma rodada de QA em produção for interrompida, ficam contas com senha pública.
- **Correção:** trocar o e-mail do documento por um fictício e, se o dono quiser removê-lo do histórico, reescrever o histórico (exige force-push e avisar quem tem cópia); a senha do QA vir de variável de ambiente; o modo produção do script exigir confirmação e gerar senha aleatória por execução. **Esforço:** P. **QA:** busca no repositório sem e-mails pessoais e sem senha literal.

#### M8. LGPD: aviso ausente e retenção sem prazo — Média — [C]
- **Onde:** `/cadastro`, tabela `autocadastros`, `audit_logs`.
- **Evidência:** o formulário público coleta nome, e-mail, telefone, RG/CPF e placas, e o único consentimento é para exibir o nome na lista de unidades; não há aviso de privacidade (finalidade, base legal, quem acessa, prazo, canal do titular). Cadastros recusados e validados mantêm RG/CPF, e-mail e telefone para sempre em `autocadastros`; a trilha guarda e-mail e motivo digitados. Excluir uma conta não remove os dados que ficaram no JSON da unidade nem os do formulário. Base legal e prazos: **a confirmar com advogado**.
- **Correção:** página de aviso de privacidade ligada ao formulário e ao rodapé; apagar `rg_cpf` e dados do envio ao validar (já copiados para a unidade) e em até N dias após recusa; trilha sem e-mail (só ids); rotina de exclusão que limpe o morador em todas as tabelas. **Esforço:** M (a parte jurídica é a longa). **QA:** envio recusado perde RG/CPF no prazo; o aviso aparece antes do envio.

#### M9. Links de convite e redefinição: guardados em claro e de validade desconhecida — Média — [T] parcial, [N] expiração
- **Onde:** coluna `link_acesso` de `pending_invites`; configuração de expiração do Auth.
- **Evidência:** o link de acesso fica gravado em texto e é legível por todos os perfis de gestão, mesmo os que não o geraram, até a conclusão. O link é de uso único (testado: a segunda tentativa falha) e gerar novo anula o anterior. O prazo de expiração em produção não foi verificado (já está nas pendências do produto).
- **Cenário:** um perfil de gestão usa o link de convite destinado a outra pessoa antes dela.
- **Correção:** mostrar o link só a quem o gerou, na hora, sem gravá-lo (ou gravar o `token_hash` e nunca o link completo); fixar a expiração (1 a 24 h) e documentar. **Esforço:** P/M. **QA:** outro perfil de gestão não lê o link; link vence no prazo definido.

### Baixos

| # | Achado | Evidência | Correção |
|---|---|---|---|
| B1 | Rotas POST aceitam corpo `text/plain` e não checam a origem (CSRF) | [T] A proteção hoje é o cookie `SameSite=Lax` | Exigir `Content-Type: application/json` e conferir `Origin`/`Sec-Fetch-Site` nas rotas de escrita |
| B2 | Cookie de sessão sem HttpOnly nem Secure, validade de 400 dias; CSP de produção com `script-src 'unsafe-inline'`; app não define HSTS | [T] cabeçalhos do build de produção local | Aceitável pelo desenho do cliente do Supabase; reforçar com CSP por nonce (custo alto) e declarar HSTS em `next.config.ts` (a Vercel costuma adicionar; produção [N]) |
| B3 | Limite do autocadastro usa o IP de `X-Forwarded-For`: forjável fora da Vercel | [T] no local (valores diferentes burlam o limite de 5) | Na Vercel o cabeçalho é sobrescrito (confirmar); preferir o IP que a plataforma entrega e contar também as falhas |
| B4 | Função de produção com gancho de teste (`p_simular_falha_apos`) e `get_user_role` sem `search_path` fixo | [C] migrações 0037 e anteriores | Remover o parâmetro depois dos testes; fixar `search_path` |
| B5 | Conselho consegue criar reserva para qualquer unidade e a Portaria apaga qualquer veículo, fora do papel descrito ("leitura e auditoria") | [T] | Decidir com o dono e ajustar as políticas |
| B6 | Links externos de documentos e do portal da administradora sem validação de protocolo (só o Mural valida `http/https`) | [C] `src/app/links/page.tsx` (o React 19 bloqueia `javascript:`) | Validar `http(s)` no cadastro e na exibição |
| B7 | Sem integração contínua, Dependabot nem varredura de segredos; avisos de `braces` só em ferramentas de desenvolvimento | [T] não há `.github`; `npm audit` | Ligar secret scanning com push protection, Dependabot e um workflow de `npm audit` e lint |
| B8 | Troca de sessão por fragmento na tela de definir senha permite entrar numa conta alheia (login CSRF) se a vítima abrir um link malicioso | [C] `src/app/definir-senha/page.tsx` | Baixo; o fluxo por `token_hash` não tem o problema: preferir só ele |
| B9 | Arquivos mortos no repositório: `src/lib/mockData.ts` (nomes e RG de exemplo) e o kit `.agents/` de terceiros | [C] | Remover o que não é usado |

### Informativos (o que está bem feito)

- **I1.** Todas as 18 tabelas do schema `public` têm RLS; não há visões. [T]
- **I2.** Anônimo: todas as leituras voltam vazias e todas as escritas são recusadas; as funções chamáveis por anônimo só devolvem o estado do próprio chamador. O cadastro público do Auth está desligado. [T]
- **I3.** Só os schemas `public` e `graphql_public` são expostos; GraphQL está desligado; nenhum bucket de storage; nenhuma tabela publicada no Realtime. [T]
- **I4.** `profiles` é somente leitura para o cliente (sem UPDATE nem INSERT, nem por coluna); tentativa de mudar o próprio perfil falha. As funções de cargo só executam pelo service role. [T]
- **I5.** Rotas de API: todas exigem sessão e perfil; sem sessão, o middleware redireciona para o login; método errado não executa; o `next` do callback é validado e não há redirecionamento aberto; erros ao morador são genéricos. [T]
- **I6.** A chave de serviço só é lida em `src/app/api`; o pacote de produção do navegador não contém essa chave, nem o texto `service_role`, nem mapas de código-fonte. [T]
- **I7.** Histórico do git (todos os branches e objetos inalcançáveis): nenhum JWT, chave de serviço, URL com senha nem token de terceiros; `.env*` nunca foi versionado. [T]
- **I8.** Sessão: JWT de 1 hora; rebaixar um perfil vale na hora (a RLS lê o papel no banco); excluir a conta derruba o token e a renovação; trocar a senha e o logout global invalidam as outras sessões; link de acesso é de uso único. A exportação para Excel grava células como texto (sem fórmula). [T]

## 4. Plano de correção (ordem sugerida)

**Em 24 horas**
1. M5: atualizar o Next para 16.3.8 (e o supabase-js); build, bateria de QA, publicar.
2. M4: no painel do Auth, subir o mínimo de senha, ligar a proteção de senhas vazadas e CAPTCHA, e conferir o prazo de expiração dos links e a lista de URLs de redirecionamento (sem curingas de domínios de terceiros). Confirmar que **nenhuma conta de produção usa a senha de teste** (já conferido em 02/10; reconferir, pois entraram contas novas).
3. M7: trocar o e-mail pessoal do documento por um fictício; tirar a senha do script de QA.

**Nesta semana**
4. A1: tirar RG/CPF do alcance de Portaria e Conselho (migração, staging primeiro).
5. A2: bloquear a redefinição de senha e a criação de contas entre perfis de gestão de nível igual ou superior; auditoria no servidor.
6. M1 e M2: histórico e notificações só pelo servidor; máquina de estados da multa; neutralizar o CSV.
7. M3: diretório para provisório sem nomes e vagas; verificação de e-mail ou CAPTCHA.

**Depois**
8. M6: revogar privilégios excedentes e padrões do Supabase.
9. M8 e M9: aviso de privacidade, retenção e links de convite sem gravar o link.
10. Baixos B1 a B9 e o CI com varredura de segredos e Dependabot.

## 5. Issues propostas (não criadas)

| Título | Severidade | Esforço |
|---|---|---|
| Tirar RG/CPF do alcance de Portaria e Conselho | Alta | M |
| Impedir que perfis de gestão assumam ou criem contas de nível igual ou superior; auditoria no servidor | Alta | M |
| Auditoria e notificações gravadas só pelo servidor, com limite de tamanho; CSV sem fórmulas | Média | M |
| Multa: máquina de estados, prazo de recurso e ciência com data e nome vindos do banco | Média | P/M |
| Autocadastro: verificar e-mail, CAPTCHA, diretório sem nomes e vagas para provisório | Média | M |
| Política de senha, senhas vazadas e CAPTCHA no Auth | Média | P |
| Atualizar Next para 16.3.8 e supabase-js | Média | P |
| Revogar privilégios excedentes e padrões do Supabase | Média | M |
| Remover dado pessoal e senha de teste do repositório | Média | P |
| LGPD: aviso de privacidade e retenção de autocadastros | Média | M |
| Link de convite: não gravar em claro e fixar a expiração | Média | P/M |
| CI: secret scanning, Dependabot e `npm audit` | Baixa | P |

## 6. O que não foi testado, e por quê

- **Produção:** nenhum teste (regra). Não foi possível confirmar a política de senha, a expiração dos links, a lista de URLs de redirecionamento, o plano e os limites do Supabase, nem se produção já tem as migrações até a 0037 idênticas ao staging. O PR #54 não foi visto (sem rede para atualizar o `main`).
- **E-mail real:** envio de redefinição e de link mágico não foi disparado (evita e-mail de verdade; só o lado "e-mail desconhecido" foi testado). Limite de e-mails e possível esgotamento da cota de envio do Supabase: [N].
- **Força bruta e carga:** limitado a rajadas de até 10; o limite real do Auth não foi atingido.
- **Navegador:** XSS verificado por leitura (sem `dangerouslySetInnerHTML`) e pelo armazenamento dos textos; não foi feita varredura dinâmica com proxy. A exportação CSV não foi executada no Excel.
- **Vercel:** variáveis de ambiente de Preview e Produção, proteção de deploys e cabeçalhos reais em produção: [N].
- **Dependências indiretas e cadeia de suprimentos do npm:** só `npm audit` e boletins públicos.
