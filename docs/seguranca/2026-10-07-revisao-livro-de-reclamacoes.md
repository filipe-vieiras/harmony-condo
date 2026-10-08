# Revisão de segurança: Livro de reclamações v1 (migração 0043)

Data: 2026-10-07. Autor: especialista em segurança. Ambiente de teste: staging (contas `*@staging.test`). Produção não foi tocada (análise estática do que sobe para lá).
Escopo: `supabase/migrations/0043_livro_de_reclamacoes.sql`, `src/lib/livro.ts`, `src/lib/supabase/livro.ts`, `src/lib/textoLivre.ts`, `src/context/LivroContext.tsx`, `src/app/livro/`, `src/components/livro/`, scripts `scripts/qa/livro*.mjs`, `scripts/seed-staging.mjs`, e o QA (L1 a L9). Tag de evidência: [T] testado no staging, [C] lido no código/catálogo, [N] não testado.

## Veredito

**Não há falha crítica nem alta.** Média: 2. Baixa: 7. Informativas: 6.

- **Pode subir a 0043 e o código do livro DESLIGADO para produção? Sim**, com uma ressalva operacional: os scripts `scripts/qa/livro*.mjs` não têm trava contra `QA_ALVO=producao` (B-5); basta não rodá-los em produção e, de preferência, o developer acrescentar a trava antes do merge. Com o interruptor em DESLIGADO o banco nega leitura e escrita a todos (inclusive Síndico), confirmado [T] em RPC e REST.
- **Pode ABRIR (EQUIPE ou ABERTO) para dados reais?** EQUIPE só depois de corrigir M-2 (hoje um Conselheiro testando "citar" avisa moradores reais que ainda não podem entrar). ABERTO só depois de M-1, M-3 (trava no banco), #55 aprovado e a conversa com o advogado (seção "Condições para abrir").

## O que foi revisado e provado

Catálogo do staging conferido contra o arquivo da migração: bate (policies, grants, funções, gatilhos).

| Área | Resultado |
|---|---|
| RLS ligada nas 7 tabelas do livro | Sim [T] (`relrowsecurity` = verdadeiro em todas) |
| `anon` | Nenhum privilégio de tabela; nenhuma função executável (RPC e REST negam, 42501/PGRST202) [T] |
| `authenticated` | Sem INSERT/UPDATE/DELETE em nenhuma tabela (`has_table_privilege` falso) [T]; só SELECT por coluna em 3 tabelas |
| Colunas internas | `autor_id`, `alvo_usuario_id`, `alvo_unit_id`, `texto_original`, `removido_por_id` ilegíveis; filtro e `order` por `autor_id` também negados; `select *` negado [T] |
| `livro_config`, `livro_segredo`, `livro_sinalizacoes`, `livro_ciencia` | 42501 para Morador, Síndico, ADM e anônimo [T] |
| Funções `SECURITY DEFINER` | 27 funções, todas com `search_path=public`, sem SQL dinâmico (`EXECUTE`/`format` inexistentes) [C]. Apoio e gatilhos sem EXECUTE para `anon`/`authenticated`; só 11 RPCs e 3 auxiliares de policy liberadas a `authenticated` [T] |
| Nenhuma policy ou função do livro usa `tem_perfil_operacao()` nem `is_admin()` | Confirmado [C]: listas de perfil escritas à mão |
| Interruptor no banco | Leitura (policies e RPCs), escrita (`livro_publicar`, `livro_dar_ciencia`, `livro_sinalizar`) e remoção de outros dependem de `livro_config.modo` lido a cada chamada [T, nos três modos para Morador, Conselho, Síndico, ADM, Zelador] |
| Quem muda o interruptor | Só Síndico e ADM (`get_user_role()`, que ignora conta desativada); Morador, Conselho, Subsíndico, Zelador, Portaria e provisório recebem 42501 [T]. Histórico: linha em `audit_logs` com de/para [C, e QA] |
| Registro de remoções | Só Síndico, Subsíndico, ADM, Conselho; Morador recebe 0 linhas; `texto_original` só por RPC [T]. Imutável: UPDATE/DELETE com sessão de usuário caem na exceção do gatilho [C] |
| Retenção de 90 dias | Texto vencido: a leitura já o esconde, e a leitura do registro (ou qualquer remoção) o apaga de verdade [T]. Ver B-3 |
| Mudança de perfil (L9) | Ex-Conselho virado Portaria: remove a própria, não remove de outros, não lê o registro, não publica [T]. Conta desativada: não lê o registro [T]. Não vira brecha: `autor_id` é imutável por usuário e o ramo "próprio" só toca a mensagem da própria conta (ver I-1) |
| Exclusão de conta | Pelo mesmo caminho do app (desvincular unidade, apagar `profiles`, apagar usuário de autenticação): mensagens e registros passam a "Ex-morador", sem unidade, e o feed segue [T]. Ver B-4 |
| Citações | Lista estruturada com código opaco (hash com sal secreto guardado em tabela sem acesso); ADM, Zelador, Portaria, provisório, unidade sem conta e o próprio chamador não aparecem [T]. Os códigos são iguais para todos os chamadores (estáveis), mas sem o sal não dá para derivá-los [C] |
| Vínculo conta↔unidade por citação | **Não encontrei vazamento.** O chamador vê "Unidade X" e "Cargo Nome" como entradas separadas e sem ligação; o único par que se infere (por ausência na própria lista) é o do próprio chamador. Mensagens de Síndico, Subsíndico e Conselho não mostram unidade (a unidade só é gravada para Morador) [C+T] |
| XSS e conteúdo | Texto sempre como nó de texto (`whitespace-pre-wrap`); sem `dangerouslySetInnerHTML`, sem link clicável, sem markdown [C]. HTML, `<script>` e `javascript:` ficam guardados como texto puro [T]. Setas de direção (U+202A a U+202E, U+2066 a U+2069), ZWSP/ZWJ/ZWNJ, FEFF são removidos [T]. NUL é recusado (erro técnico mapeado para texto em português) [T]. SQL injection: o texto vai como parâmetro; sem concatenação [C+T] |
| ReDoS | Não encontrei. As regexes de CPF/CNPJ/e-mail só rodam em texto de até 1000 caracteres (a checagem de tamanho vem antes); medidas em 6000 caracteres hostis ficaram abaixo de 1 ms por chamada no servidor [T] |
| Auditoria sem texto livre | `_livro_auditar` grava só códigos, id da mensagem, tipo e motivo [C+T] |
| Realtime/storage/rotas | Nenhuma tabela do livro na publicação do Realtime [T]; não há bucket nem rota `src/app/api` do livro [C] |
| Hierarquia, relatórios, seed | Livro não altera `roles.ts` além de liberar `/livro` ao Zelador (leitura, o banco decide). Módulo `LIVRO` em Relatórios mostra só os códigos. Seed e `limparQA()` deixam o interruptor DESLIGADO [C+T] |
| Segredos | Nada de chave, JWT ou senha real nos arquivos novos (`livro*.mjs`, docs, migração, `src/`); as senhas de teste são as já conhecidas dos scripts. `.env*` ignorado pelo git [C] |

## Achados

### M-1 · Média · "Avisar a gestão" sem limite: qualquer Morador lota o sino do Síndico e da ADM [T]
- **Onde:** `livro_sinalizar` e `livro_sin_avisos` (0043, linhas ~314 a 331 e ~683 a 695). Não há limite por pessoa nem por hora; `_livro_avisar` é chamada sem `p_equiv`, então não há agrupamento.
- **Evidência:** Morador sinalizou 8 mensagens distintas em sequência (1,7 s): 8 de 8 aceitas; Síndico e ADM receberam 8 avisos cada.
- **Cenário:** Morador mal-intencionado (ou uma conta comprometida) percorre a lista e sinaliza cada mensagem uma vez. Cada mensagem gera um aviso para cada Síndico e ADM. O sino da gestão passa a ser inútil (e os avisos reais de multa, reserva e cadastro somem no meio).
- **Impacto:** disponibilidade do sino da gestão; sem vazamento. Limitado ao número de mensagens existentes (uma sinalização útil por mensagem), mas esse número cresce com o uso.
- **Correção:** em `livro_sinalizar`, limite por pessoa (por exemplo 5 por hora e 15 por dia, contando `livro_sinalizacoes.criada_em`, mesmo molde do `livro_publicar`, erro `limite_sinalizacao`) e, para a gestão, juntar em um só aviso "Há mensagens sinalizadas no Livro" enquanto houver um não lido (passar `p_equiv` com os dois textos, como já se faz na citação). Migração nova `0044` (não editar a 0043 se já subiu).
- **Esforço:** P.
- **QA confirma:** Morador sinaliza 6 mensagens em sequência: a 6ª devolve o erro de limite; o Síndico tem no máximo 1 aviso não lido de sinalização.

### M-2 · Média · Em EQUIPE, moradores reais recebem aviso de citação de um livro que ainda não podem abrir [T]
- **Onde:** `_livro_citaveis_todos` (lista todo Morador com conta, independente do modo) e `livro_cit_avisos`/`livro_rem_avisos`/`livro_msg_avisos` (avisam por perfil, não por "pode ler agora").
- **Evidência:** modo EQUIPE; Conselho publicou citando a "Unidade A-101"; o Morador dono dela recebeu "Sua unidade foi citada no Livro", com link para `/livro/<id>`, e nesse modo o banco o impede de ler (`podeLer` falso, tópico nulo).
- **Cenário:** o rollout planejado (EQUIPE por 1 a 2 semanas com dados reais) faz a equipe testar o "Citar" e dispara avisos a moradores sem acesso: confusão, perguntas ao Síndico, e revela que existe um livro e que a unidade foi citada. Também vale para "Sua mensagem foi removida" se o perfil do autor mudar de modo.
- **Correção:** em `_livro_avisar`, só avisar quem poderia ler no modo atual (reaproveitar a mesma regra de `livro_papel`, por exemplo `exists (select 1 from livro_config c where c.id = 1 and (c.modo = 'ABERTO' or (c.modo = 'EQUIPE' and p.role in ('SINDICO','SUBSINDICO','ADM','CONSELHO'))))`). Opcional: em EQUIPE, `livro_citaveis` devolver só equipe.
- **Esforço:** P.
- **QA confirma:** modo EQUIPE, Conselho cita unidade de Morador: Morador tem 0 avisos; ao passar para ABERTO, citações novas avisam normalmente.

### M-3 · Média (governança) · Nada no banco impede abrir o livro sem os pré-requisitos (#55, advogado) [C]
- **Onde:** `livro_definir_modo` (0043, ~701 a 717): Síndico ou ADM mudam para ABERTO com um toque; a administradora (empresa externa) também.
- **Cenário:** o painel está visível a Síndico e ADM mesmo DESLIGADO. Um clique expõe nome e unidade de todos os moradores validados a todos (inclui Zelador e Portaria) sem aviso de privacidade aprovado. O dono definiu #55 como pré-requisito duro, e hoje isso é só convenção.
- **Correção:** coluna `livro_config.liberado_para_abrir boolean default false`, só alterável por migração (ou service role) depois que #55 e as regras estiverem aprovados; `livro_definir_modo('ABERTO')` falha com `abertura_nao_liberada` enquanto for falso. EQUIPE continua livre. A tela mostra a explicação.
- **Esforço:** P.
- **QA confirma:** com a trava, Síndico e ADM recebem erro ao escolher Aberto; EQUIPE e DESLIGADO seguem.

### B-1 · Baixa · Filtro de dado pessoal cobre só CPF/CNPJ/e-mail "bem formados" [T]
Aceitos no staging: telefone com máscara "(11) 91234-5678", RG, placa de veículo, CPF com espaços entre os blocos, CPF/CNPJ/e-mail com caracteres de largura total ("１２３…", "＠"), "fulano [at] dominio". Recusados: CPF/CNPJ/e-mail normais e 11 dígitos seguidos (que também pega telefone sem máscara).
O texto de ajuda e as regras prometem "telefone" como proibido, e a spec (7.2) só exige CPF/CNPJ/e-mail, então não é desvio da spec: é limite conhecido do filtro (acelerador, não barreira).
**Correção:** normalizar antes de testar (largura total para ASCII com `translate`/`normalize(texto, NFKC)`, remover espaços, pontos e hífens entre dígitos) e acrescentar telefone brasileiro (`\(?\d{2}\)?\s?9?\d{4}-?\d{4}`) como recusa, aceitando falso positivo. Deixar claro na tela que o filtro não pega tudo. Esforço P.

### B-2 · Baixa · Caracteres invisíveis fora da lista de limpeza ficam no texto [T]
`limpar_texto_livre` (0042) remove U+200B a U+200F, U+202A a U+202E, U+2066 a U+2069 e U+FEFF. Passam e são guardados quando misturados a texto real: U+061C (marca de direção árabe), U+2060 (word joiner), U+00AD (hífen suave), caracteres de tag (U+E0000 a U+E007F, "contrabando" de texto invisível), preenchimentos de Hangul (U+3164, U+115F, U+1160). Efeito: texto escondido legível por máquina e, no caso de U+061C, reordenação mínima de pontuação. Só-invisível é recusado (`nome_em_branco`). Sem XSS.
**Correção:** em `livro_publicar` (e idealmente `limpar_texto_livre`), remover também U+061C, U+2060 a U+2064, U+00AD, U+E0000 a U+E007F, U+3164, U+115F, U+1160, U+17B4, U+17B5, U+180B a U+180E. Esforço P. Mudar `limpar_texto_livre` afeta outros módulos: testar a bateria inteira.

### B-3 · Baixa · Texto removido vencido só é apagado fisicamente quando alguém usa o livro [T]
A limpeza (`_livro_limpar_vencidos`) roda em `livro_remover` e `livro_registro_remocoes`. Vencido o prazo de 90 dias, a leitura já esconde o texto (confirmado), mas a linha continua guardando `texto_original` no banco até a próxima remoção ou abertura do registro. Com pouco uso, o "apagado de verdade" (promessa da spec e do #55) pode atrasar semanas. Mais: depois do UPDATE a versão antiga fica em páginas mortas do Postgres até o autovacuum, e em backups (limite normal; mencionar no #55).
**Correção:** agendar a limpeza (`pg_cron` no Supabase, 1 vez por dia) ou chamar `_livro_limpar_vencidos()` também em `livro_listar_topicos` (barato, índice em `texto_expira_em`). Esforço P.

### B-4 · Baixa (LGPD) · Anonimização "Ex-morador" deixa rastros do nome [T]
Ao excluir a conta, `autor_nome`/`autor_unidade` viram "Ex-morador"/vazio nas mensagens e no registro (confirmado). Restam: (a) `livro_remocoes.removido_por_nome` e `removido_por_papel` guardam o nome da pessoa que apagou a própria mensagem (a gestão vê esse nome no registro); (b) `livro_citacoes.rotulo` guarda o nome fotografado de Síndico/Subsíndico/Conselho citado e "Unidade X" do citado; (c) `livro_remocoes.texto_original` do ex-morador segue retido até vencer; (d) o texto livre das mensagens do ex-morador permanece (pode se identificar sozinho).
**Correção:** no gatilho de `livro_remocoes` (ramo `auth.uid() is null`, FK zerada) também zerar `removido_por_nome` quando `removido_por_id` virar nulo; para `livro_citacoes`, trocar o rótulo de PESSOA por "Ex-membro" quando `alvo_usuario_id` virar nulo; descrever (c) e (d) no #55 e no procedimento de pedido do titular (a gestão remove a mensagem). Esforço P a M.

### B-5 · Baixa · Scripts de QA do livro rodam em produção se `QA_ALVO=producao` [C]
`scripts/qa/livro.mjs`, `livro-extra.mjs`, `livro-corrida.mjs`, `livro-tela.mjs`, `transferir-401.mjs` importam `lib.mjs` (que aceita `QA_ALVO=producao`) e não conferem o alvo. O que fariam em produção: ligar o interruptor, trocar a senha do Síndico/Subsíndico/Zelador titulares para a senha de QA (`titular()` em `livro.mjs`) e publicar mensagens com avisos para pessoas reais. A bateria principal aborta em produção; os avulsos não.
**Correção:** no topo de cada arquivo `livro*.mjs` e `transferir-401.mjs`: `if (ALVO !== 'staging') throw new Error('Só em staging')`. Esforço P.

### B-6 · Baixa · Tópico pode ser "entupido" e vandalizado sem limite por autor [C]
`topico_cheio` (200 respostas) conta também respostas removidas (`n_respostas` não decrementa) e não há teto por autor no tópico. Uma conta preenche 40 respostas por dia (5 dias); poucas contas da mesma família, em minutos. Serve para calar um tópico incômodo (a gestão não pode reabrir vaga).
**Correção:** teto por autor por tópico (por exemplo 20 respostas) e `n_respostas` decrescer quando a gestão remove uma resposta. Esforço P.

### B-7 · Baixa · `audit_logs` aceita entradas falsas com o próprio nome (herdado da #72) [T]
Um Morador conseguiu inserir diretamente uma linha `modulo='LIVRO'` "Alterou o modo do Livro" com o nome dele. Não consegue forjar a ação de outra pessoa (a policy exige `usuario_id`, nome e perfil próprios) nem editar ou apagar linhas (sem policy), mas pode poluir o relatório que o livro usa como "descrição da remoção". O registro principal (`livro_remocoes`) é imutável e não sofre disso.
**Correção:** já planejada na #72 (auditoria só pelo servidor: revogar INSERT de `authenticated` em `audit_logs` e mover os poucos inserts do cliente para RPC). Esforço M (fora do livro). Até lá, tratar o registro de remoções como fonte de verdade.

### B-8 · Baixa · Inferência de "unidades com conta" por qualquer Morador [T]
`livro_citaveis` devolve a lista de todas as unidades com conta ativa e validada. Hoje um Morador não lê as outras unidades (`units_read`), então isso é informação nova: mostra quais unidades **não** têm conta (provavelmente vazias ou de proprietário ausente). Conta como vazamento menor de inteligência de ocupação, aceito pela spec ("D6"), mas vale decidir de propósito. Mitigação possível: oferecer busca por texto e devolver no máximo 10 resultados por consulta, em vez da lista inteira; ou aceitar e registrar no #55. Esforço P.

### Informativas
- **I-1. Autor apaga a própria mesmo com o livro DESLIGADO ou com perfil mudado: não é risco, mantenha.** O ramo só toca mensagem com `autor_id = auth.uid()`, exige conta ativa, cria registro e auditoria como qualquer remoção, não avisa ninguém e é idempotente. É direito do titular. Detalhe: com DESLIGADO, um usuário ativo qualquer ainda distingue "mensagem inexistente" de "sem permissão" para um UUID (oráculo irrelevante: UUID v4 não se adivinha).
- **I-2. Moderação por quem é parte.** ADM (empresa) apaga críticas à própria administradora e não pode ser citada, então o marcador "citava quem removeu" nunca acende para ela. Síndico demitido em DESLIGADO deixa o Conselho sem ler o registro enquanto desligado. O contrapeso (registro com texto, aviso ao autor, auditoria) existe; a decisão é do dono. Sugestão: avisar Subsíndico e Conselho quando houver remoção pela gestão (hoje só leem se abrirem o registro).
- **I-3. Nomes de exibição.** O nome vem de `profiles.name` (digitado no autocadastro e validado pelo Síndico), com limite de 80 e sem normalização de espaços/diacríticos empilhados. Um nome tipo "Síndico Fulano" em um Morador mostra o selo de Morador (a unidade vem do servidor), mas pode confundir. Conferir os nomes na validação.
- **I-4. Ciência das regras** grava só a versão e a data, não o texto lido. Aceitável como "li as regras"; se o advogado quiser prova do texto, guardar o hash.
- **I-5. Varredura em massa.** Quem lê pode paginar `livro_mensagens` por REST sem limite de linhas (já listado como #71). Não há exportação CSV no livro (nada a injetar).
- **I-6. Concorrência/idempotência.** Revisei os advisory locks: um por autor (frequência), um por tópico pai (`for update`), um por Síndico/ADM para o resumo diário e um por mensagem para "Avisar a gestão". Não encontrei deadlock plausível; o loop sobre Síndico/ADM não tem `ORDER BY` (acrescente `order by p.id` por precaução). A bateria do QA já cobre 14 envios simultâneos, remoções paralelas e corrida de resposta na última vaga.

## Sobre as correções L1 a L9 do QA

Tentei quebrá-las:
- **L1/L2 (corridas de aviso)**: ok [C+QA]. O que sobrou é o volume (M-1), não a duplicidade.
- **L3 (citação de mensagem removida legível)**: a policy agora exige mensagem não removida [T]. Mensagem removida aparece sem citados.
- **L4 (só seletor de variação)**: ok; ver B-2 para os demais invisíveis.
- **L5, L6, L7, L8 (tela)**: sem impacto de segurança.
- **L9 (autor que mudou de perfil apaga a própria)**: ok e sem brecha, ver I-1 e a tabela acima.

## LGPD (a confirmar com advogado)

| Pergunta | Situação |
|---|---|
| Que dado pessoal cada perfil lê | Todos os perfis do modo lêem nome, unidade (só de Morador) e texto de todas as mensagens; gestão (Síndico, Subsíndico, ADM, Conselho) lê também o texto removido por 90 dias e o nome de quem removeu |
| Base legal | Legítimo interesse do condomínio (proposta da spec): **a confirmar com advogado** |
| Aviso de privacidade (#55) | **Não existe.** Precisa dizer: nome e unidade visíveis a todos os perfis, texto removido retido 90 dias, citação avisa a conta da unidade, anonimização na exclusão de conta (com os resíduos B-4), backups, avisos e texto livre de terceiros |
| Apagamento a pedido do titular | Titular com conta apaga a própria mensagem na hora; titular sem conta ou ex-morador depende da gestão (processo a escrever) |
| Retenção das mensagens | Sem prazo de guarda (fase 2, depende do advogado) |
| Dados de terceiros/sensíveis | Filtro cobre só CPF/CNPJ/e-mail (B-1); saúde, inadimplência e menores dependem de regras e moderação |
| Logs | Auditoria sem texto livre [T]; nenhum log de aplicação do livro grava texto ou nome [C] |

## Condições para ABRIR

**Para EQUIPE (teste interno com dados reais):** M-2 corrigida; M-1 corrigida (a equipe também usa "Avisar a gestão"); B-5 (trava nos scripts); migração aplicada e testada duas vezes no staging; Síndico confirma que o livro nasce DESLIGADO na produção.

**Para ABERTO (moradores):**
1. Texto do #55 aprovado e publicado; regras de uso (`REGRAS_DE_USO`) revisadas por advogado e síndico; conversa com advogado sobre os 5 pontos da seção 7.9 da spec.
2. M-1, M-2, M-3 corrigidas (M-3 é o que torna o #55 obrigatório no banco).
3. B-1, B-2 e B-4 corrigidas, ou aceitas por escrito pelo dono (são LGPD).
4. B-3 resolvida (agendador ou limpeza na leitura), para cumprir "apagado de verdade".
5. Procedimento para "pedido do titular" e "mensagem ofensiva" escrito (quem na gestão responde, em quanto tempo).
6. Pelo menos 1 semana em EQUIPE com uso real e o Conselho lendo o registro.
7. Idealmente #71 (limite de linhas por consulta) e #72 (auditoria só pelo servidor) antes de ABERTO; #15 (validade de sessão/código) por causa da conta compartilhada na família.

## O que não consegui testar e por quê

- Tela no navegador com texto hostil (só leitura de código: React escapa tudo; não subi o servidor local nesta rodada) [N].
- Comportamento da produção (regra do trabalho): só análise estática. Migração em produção, grants efetivos e o valor real de `max-rows` do PostgREST de lá [N].
- Rajada além de 10 requisições e carga (regra do trabalho); a resistência a DoS foi avaliada por leitura e medição de regex.
- Dependências (`npm audit`) e cabeçalhos do app não foram reavaliados nesta revisão (sem mudança no livro; ver revisões anteriores).
- Limpeza física de páginas mortas/backups do Postgres [N].

## Issues sugeridas (não criadas)

| Título | Severidade | Esforço |
|---|---|---|
| Livro: limite e agrupamento em "Avisar a gestão" (M-1) | Média | P |
| Livro: não avisar quem não pode ler no modo atual (M-2) | Média | P |
| Livro: trava `liberado_para_abrir` para o modo ABERTO (M-3) | Média | P |
| Livro: filtro de dado pessoal com normalização e telefone (B-1) | Baixa | P |
| Livro e textos livres: ampliar lista de invisíveis em `limpar_texto_livre` (B-2) | Baixa | P |
| Livro: apagar texto vencido por agendador ou na leitura (B-3) | Baixa | P |
| Livro: completar anonimização de conta excluída (B-4) | Baixa | P/M |
| QA: trava `ALVO === 'staging'` nos scripts `livro*.mjs` e `transferir-401.mjs` (B-5) | Baixa | P |
| Livro: teto de respostas por autor no tópico e decremento de `n_respostas` (B-6) | Baixa | P |
| Livro: lista de citáveis por busca com limite (B-8) | Baixa | P |
| Avisar Subsíndico e Conselho quando a gestão remove mensagem (I-2) | Informativa | P |

## Estado final do staging

Seed refeito (`node scripts/seed-staging.mjs`); interruptor do livro **DESLIGADO**; 0 mensagens, 0 registros, 0 auditorias do livro, 0 avisos do livro. Nenhum servidor local foi iniciado nesta revisão. Nenhuma alteração em `src/`, `supabase/` ou scripts do repositório; nada commitado.
