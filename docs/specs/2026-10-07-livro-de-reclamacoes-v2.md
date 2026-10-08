# PRD v2: Livro de reclamações como fórum aberto do condomínio

Autor: PM. Data: 2026-10-07. Status: **desenho DECIDIDO pelo dono (6 decisões, seção 0); detalhes abaixo são PROPOSTA do PM, a confirmar nas seções 16 e 17.**
Substitui `docs/specs/2026-10-04-livro-de-reclamacoes.md` (v1, "desenho C refinado"), que fica preservada só para histórico.
Migração: a próxima livre no momento de construir (hoje seria a **0043**; a última existente é a 0042). Repositório público: nenhum dado real aqui.

> Não é parecer jurídico. O que está em "a confirmar com advogado" precisa de advogado e do regimento. **DECIDIDO** = decisão do dono. **PROPOSTA** = recomendação minha. **SUPOSIÇÃO** = não conferi.

## 0. Decisões do dono (fatos, 2026-10-07)

1. "O livro é aberto. Todos veem tudo."
2. "Zelador, porteiro e adm não escrevem no livro. Só Síndico, Subsíndico, Morador e Conselho."
3. "O Síndico e o ADM têm o poder de apagar qualquer mensagem, ficando descrito que foi apagado no log."
4. "Quando Síndico, Subsíndico, Morador e Conselho é citado em uma mensagem, um aviso aparece nas notificações."
5. "A ideia é como se fosse um fórum onde moradores podem citar a unidade/nome dos outros moradores."
6. "Não existe prazo para resposta no livro."

**Efeito sobre as perguntas da v1:** **Q1 fechada** (livro aberto, com nome). **Q2 fechada** (quem modera: Síndico e ADM apagam; Subsíndico e Conselho não moderam). A conversa com advogado continua necessária (seção 7.9).

## 1. Problema, usuários e o que mudou

**Quem sofre**
- **Morador:** reclama no grupo do WhatsApp (some, vira briga) ou no privado (não sabe se foi lido). Hoje o livro físico é aberto (**fato relatado pelo dono, não conferido com o regimento**).
- **Síndico:** a reclamação some no grupo e ele responde de memória.
- **Conselho:** não enxerga o que os moradores reclamam.
- **Administradora:** recebe queixa por canais soltos. **No v2 ela lê e apaga, mas não escreve nem é citada**: a queixa sobre cobrança chega ao ADM só se o Síndico repassar.

**Hoje (SUPOSIÇÃO, validar com o síndico):** livro físico aberto, grupo de WhatsApp, ligação, bilhete.

**Se nada for feito:** discussão dispersa, sem rastro. **Risco do v2 (o oposto):** um fórum aberto, sem prazo e sem denúncia pode virar palco de briga e de acusação a vizinho, e o condomínio responde pelo ambiente. Seções 7 e 13.

**O que mudou da v1 para a v2**

| Tema | v1 (04/10, abandonada) | v2 (decidida) |
|---|---|---|
| Visibilidade | por categoria: públicas e privadas | **tudo aberto**, sem categoria |
| Quem escreve | morador validado; equipe responde | **só Síndico, Subsíndico, Morador, Conselho**; Zelador, Portaria e ADM só leem (ADM e Síndico apagam) |
| Resposta da gestão | estados (aberta, respondida, encerrada), protocolo | **sem estados, sem protocolo, sem prazo**: é conversa |
| Moderação | denúncia, fila, **ocultar** (nunca apagar), Conselho vê tudo | **Síndico e ADM apagam**, com registro; sem denúncia nem fila |
| Citação | não existia | **cita unidade ou pessoa; o citado recebe aviso no sino** |
| Prazo | selo interno de 5 dias úteis | **nenhum** |
| Esforço | G | **M** (cortou categorias, estados, denúncia, fila; entrou citação e registro de remoções) |

## 2. Matriz de perfis (PROPOSTA onde marcado)

Premissa de leitura: **"todos veem tudo" = quem tem login, perfil e conta ativa e validada**. Confirmo isso para Zelador, Portaria e ADM. Provisório, visitante e conta sem perfil **não leem** (recomendação, justificativa em 2.1; decisão a confirmar, D1).

| Perfil | LER | POSTAR tópico | RESPONDER | APAGAR qualquer | APAGAR a própria | SER CITADO | RECEBE AVISO | Lê o registro de remoções |
|---|---|---|---|---|---|---|---|---|
| Síndico | sim | sim | sim | **sim** | sim | sim (por pessoa e por cargo) | citação; resumo diário; "avisar a gestão" | sim, com o texto |
| Subsíndico | sim | sim | sim | **não** | sim | sim | citação | sim, com o texto |
| ADM | sim | **não** | **não** | **sim** | n/a | **não** | resumo diário; "avisar a gestão" | sim, com o texto |
| Conselho | sim | sim | sim | **não** | sim | sim | citação | sim, com o texto |
| Morador proprietário (validado, com conta ligada à unidade) | sim | sim | sim | não | sim | sim (pela unidade) | citação; resposta ao seu tópico; remoção da sua mensagem | só das próprias mensagens |
| Morador inquilino (idem) | sim | sim | sim | não | sim | sim (pela unidade) | idem | idem |
| Zelador (ativo) | sim | **não** | **não** | não | n/a | **não** | nenhum | não |
| Portaria | sim | **não** | **não** | não | n/a | **não** | nenhum | não |
| Provisório (Morador sem validação) | **não** | não | não | não | n/a | não | nenhum | não |
| Visitante (sem login) | **não** | não | não | não | n/a | não | n/a | não |
| Conta sem perfil ou desativada (ex.: ex-Zelador) | **não** | não | não | não | n/a | não | nenhum | não |

Notas:
- **Proprietário e inquilino têm a mesma permissão** (ambos são `MORADOR`). O que muda é só quem recebe o aviso da unidade (7.5): a conta ligada à unidade, hoje uma por unidade. **Proprietário que não mora e não tem conta nunca é avisado.** Dependente sem conta não é citável.
- **Subsíndico e Conselho não apagam nem a mensagem de terceiros**; só leem o registro (contrapeso, 5.4).
- **ADM não é citável** (empresa parceira, não pessoa do condomínio) e **não escreve**: não responde a queixa sobre ela. Consequência a aceitar: reclamação sobre cobrança ou serviço da administradora fica sem a voz dela; o Síndico repassa fora do app.
- **Zelador e Portaria leem.** Efeito colateral a aceitar: funcionários podem ler críticas sobre eles e sobre colegas. Cabe ao texto de orientação (7.3) pedir fatos e não pessoas. Reverter só com fato novo (a v1 os deixava de fora; esta decisão do dono a contesta).
- Policy do banco: **nunca `tem_perfil_operacao()`** (inclui Zelador); **nunca `is_admin()` para apagar** (inclui Subsíndico). Usar lista explícita: escrever = `get_user_role() in ('SINDICO','SUBSINDICO','CONSELHO','MORADOR')` e não provisório; apagar = `get_user_role() in ('SINDICO','ADM')`. `get_user_role()` já trata conta desativada como sem perfil; `is_cadastro_provisorio()` e `is_admin()` ainda ignoram `desativado_em` (B-3 da revisão de segurança), por isso não basear o acesso do livro só nelas.

### 2.1 Por que o provisório não lê (PROPOSTA, D1)
O cadastro é por **link aberto** (WhatsApp): qualquer pessoa com o link vira provisório. Ler o livro mostraria nome, unidade e opinião de vizinhos a quem ninguém validou. Hoje um Morador sequer lê as outras unidades (`units_read`): **o livro será o primeiro lugar em que moradores se veem entre si**, por decisão do dono. Que seja só depois da validação do síndico. Custo: o provisório não vê o livro por dias; aceitável.

## 3. Modelo da conversa (PROPOSTA)

**Recomendo: tópicos com respostas planas em um só nível** (um "feed" de tópicos; abrir o tópico mostra as respostas em ordem cronológica). Sem fio aninhado. Motivo: fio aninhado é difícil no celular de 375px e exige moderação mais complexa; mensagem plana com citação cobre "fórum" para um condomínio.

| Item | Regra |
|---|---|
| Estrutura | uma tabela de mensagens; `pai_id` vazio = tópico; resposta aponta para o tópico. **Resposta a resposta não existe** (o banco recusa); quem quer falar com alguém usa a citação |
| Título | **sem título**; o tópico é um texto, a lista mostra as 3 primeiras linhas com "Ver mais" |
| Tamanho | tópico **10 a 1000 caracteres**; resposta **1 a 500** (valores sugeridos, SUPOSIÇÃO). Contador visível. Máximo de 8 quebras de linha seguidas viram 2 |
| Limite por tópico | **200 respostas**; depois, "Este tópico chegou ao limite. Abra um novo." |
| Ordem do feed | tópicos por **atividade mais recente** (a última resposta sobe o tópico); respostas **mais antigas primeiro** |
| Paginação | 20 tópicos por página, "Ver mais" (cursor por data e id, não por posição); respostas: 30 por vez, "Ver mais respostas" |
| O que aparece | autor (nome), **unidade** (ex.: "A-101") ou rótulo do cargo ("Síndico", "Subsíndico", "Conselho") quando for gestão, horário relativo e absoluto no `title`, número de respostas |
| Selo de cargo | Síndico, Subsíndico e Conselho mostram o selo ao lado do nome; é a "voz oficial". **A confirmar com advogado:** peso de uma resposta do Síndico no app |
| O que o autor vê | as próprias mensagens marcadas "Você"; se removida: "Sua mensagem foi removida pela gestão" (ou "Você removeu esta mensagem") e o texto original por **90 dias** (D4). Sem "visto por", sem contagem de leituras |
| Nome e unidade | **fotografia gravada no momento da mensagem** (o morador não consegue ler `profiles` dos outros). Mudou de unidade: a mensagem antiga mantém a unidade antiga |
| Edição | **Não na v1.** Apagar e escrever de novo. Motivo: editar depois de respostas e citações permite mudar o sentido e gerar avisos novos (spam). Reavaliar com uso real |
| Exclusão pelo autor | **Sim** (remoção lógica, mesmo mecanismo da seção 5, registrada "removida pelo autor"). Motivo: erro de digitação e direito do titular (LGPD) sem depender da gestão; **não contraria a decisão 3**, que dá poder à gestão e não o tira do autor (D2) |
| Texto | **texto puro**: sem HTML, sem markdown, **sem link clicável** (anti-phishing). Emojis liberados |
| Anexos, fotos, reações, enquete, "resolvido", mutar, seguir tópico | **fora** |

Cabeçalho fixo na tela de escrever (nunca escondido): "Este espaço é aberto. Todos os moradores veem o que você escreve, com seu nome e unidade. Fale de fatos. Não publique dados de pessoas (telefone, CPF, saúde, dívidas)."

## 4. Citações (PROPOSTA)

**Como o autor cita.** Botão **"Citar"** no editor, que abre uma folha de busca (no celular) e insere um **chip** abaixo do texto, não dentro dele. Não vou parsear o `@` do texto: no teclado do celular o `@` é frágil e o texto livre não pode mandar aviso sem validação. O banco recebe uma **lista estruturada** de citados, não "adivinha" pelo texto. **Digitar um nome no texto não gera aviso** (e a tela diz isso). `@` inline fica para a fase 2.

**O que se pode citar (lista que o banco devolve, só o necessário)**
- **Unidades** (bloco e número) que tenham **conta ativa e validada** ligada. O morador só vê "Bloco A, 101", **sem o nome de quem mora lá**. Assim a citação não vira lista de moradores.
- **Síndico, Subsíndico e membros do Conselho**, por nome e cargo (SUPOSIÇÃO: os nomes do cargo já são públicos no condomínio; confirmar).
- **Não citáveis:** ADM, Zelador, Portaria, dependente sem conta, unidade sem conta, provisório. Confirma a decisão 4 (a lista dela só tem Síndico, Subsíndico, Morador e Conselho). **D6.**

**O que acontece ao citar uma unidade:** o aviso vai à **conta ligada à unidade** (hoje uma por unidade; proprietário ou inquilino, quem tiver conta). Não vai a dependentes sem conta nem a proprietário ausente. Se a conta é do Síndico, que mora na unidade, ele recebe **um só** aviso por mensagem, mesmo citado por cargo e unidade.

**Limites e spam**
- No máximo **5 citados por mensagem** (SUPOSIÇÃO). Sem "citar todos", sem "citar o bloco", sem "citar o Conselho todo" (amplifica aviso).
- **Um aviso por pessoa por mensagem**; e **agrupamento**: se já há aviso de citação **não lido** desta pessoa **no mesmo tópico**, o novo não cria outro (o chip aparece, o sino não repete).
- Limite de frequência de quem escreve (7.7). Autor não avisa a si mesmo.
- Citação em mensagem **removida** some da tela e **não gera aviso novo**; avisos já enviados ficam.

**Texto do aviso no sino (fixo, sem trecho, sem nome do autor):** "Você foi citado no Livro" ou "Sua unidade foi citada no Livro", com link interno `/livro/ID`. Usa o sino atual (`notifications`, aviso por `usuario_id_alvo`, como `transferir_cargo`).

**Mudanças depois de citado**
- **Saiu do cargo, mudou de unidade ou foi desativado:** o aviso é decidido **no momento de publicar**, com quem é titular naquele instante. Nada é reenviado depois. O chip mostra a fotografia ("Unidade A-101", "Síndico Fulana"); não aponta para quem entra depois.
- Aviso antigo cujo destinatário perdeu a conta: some, porque quem não tem perfil não lê o sino (`notifications_read`).
- Cargo transferido: a citação por cargo continua apontando o **nome fotografado**; não há "reapontar".

## 5. Apagar (PROPOSTA)

**Recomendo remoção lógica com registro, não apagar de verdade.** Apagar de verdade no mesmo instante em que o Síndico critica-se a si mesmo não deixa rastro de nada, e a decisão 3 pede registro.

**Como funciona**
1. Síndico e ADM chamam uma **função do banco** `livro_remover(mensagem, motivo)`; não existe `UPDATE` nem `DELETE` direto para ninguém. O papel é relido do banco.
2. **Motivo obrigatório, de lista fechada** (ofensa; dado pessoal; fora do assunto; repetida; outro). **Sem texto livre**, para respeitar "auditoria sem texto livre".
3. A mensagem na tabela principal passa a ter o texto **vazio** e `removida_em`. Todos veem "**Mensagem removida pela gestão**" (ou "pelo autor"). **Os moradores não veem quem removeu nem o motivo.**
4. O **texto original** vai para uma tabela de registro de remoções, com data de expiração em **90 dias** (SUPOSIÇÃO; **a confirmar com advogado**). Passado o prazo, o texto é apagado de verdade (rotina de limpeza no banco; **a confirmar se o Supabase do projeto tem agendador**; sem ele, a política de leitura já esconde o texto vencido e a limpeza roda a cada remoção).
5. **Um registro imutável** (ninguém edita nem apaga pelo app): quem removeu, papel, quando, motivo (código), tipo (tópico ou resposta), autor, unidade do autor, e **dois marcadores calculados pelo banco, sem ler o texto: "o autor era quem removeu" e "a mensagem citava quem removeu"**. Mais uma linha em `audit_logs` (sem texto livre) para aparecer nos Relatórios.
6. Remover um tópico **não** remove as respostas (ficam sob "Mensagem removida"); a gestão remove uma a uma. "Remover tópico e respostas" fica para a fase 2.

**Quem vê o registro e o texto original (D4):** Síndico, Subsíndico, ADM e **Conselho**, mais o **autor** (só a própria). Portaria, Zelador, morador comum: não.

**Como evitar que Síndico/ADM apaguem críticas a si sem rastro** (contrapeso, sem criar fila de aprovação):
1. O registro mostra o texto por 90 dias ao **Conselho e ao Subsíndico**, que não moderam e podem ver tudo que foi tirado.
2. O marcador "citava quem removeu" aparece destacado para eles.
3. O **autor é avisado** no sino: "Sua mensagem foi removida pela gestão" (D5) e vê o próprio texto; pode levar ao Conselho.
4. Contagem mensal de remoções por perfil no registro (agregada), para o Conselho notar padrão.
5. Registro e `audit_logs` não são editáveis.
Residual: se Síndico e Conselho se protegem, não há freio; é uma limitação de governança, não técnica.

## 6. Notificações (PROPOSTA)

Reaproveitar `notifications` e o sino atual (aviso por usuário já existe: `usuario_id_alvo`, filtro do sino em `AppContext`). **Textos fixos, sem trecho da mensagem e sem nome do autor.** Somente **gatilhos/funções `security definer`** criam esses avisos; o navegador **não** insere (a policy `notifications_insert` exige `usuario_id_alvo is null`, e deve continuar assim). O tipo `notifications_tipo_check` aceita AVISO, MULTA, RESERVA, GERAL: usar GERAL ou ampliar o check.

| Evento | Quem recebe | Texto | Regra |
|---|---|---|---|
| Citado (pessoa) | o citado | "Você foi citado no Livro" | decisão 4 |
| Unidade citada | conta ligada à unidade | "Sua unidade foi citada no Livro" | decisão 4 |
| Mensagem removida | o autor (se não removeu ele mesmo) | "Sua mensagem foi removida pela gestão" | D5 |
| Resposta ao seu tópico | autor do tópico (exceto se já foi citado ou respondeu ele) | "Há novas respostas no seu tópico" | D5, agrupado: um enquanto não lido |
| Novidade no livro | Síndico e ADM | "Há novas mensagens no Livro" | D5, **no máximo 1 por dia** enquanto não lido. É o que traz a gestão ao livro sem prazo |
| "Avisar a gestão" | Síndico e ADM | "Uma mensagem foi sinalizada à gestão" | D3, uma por mensagem por dia, sem identificar quem sinalizou |

Sem WhatsApp nem e-mail (o Harmony não envia). A tela diz: "Os avisos aparecem no sino do portal."

## 7. Segurança e LGPD

### 7.1 O que é o dado
Nome e unidade de moradores, opinião e **texto livre sobre terceiros** (vizinhos, funcionários, dívida, saúde, crianças). O livro é aberto a algumas centenas de pessoas (SUPOSIÇÃO; confirmar o número de moradores).

### 7.2 Dado de terceiros em texto livre
Pode conter dado pessoal e **dado sensível** (saúde) e de menores. **Mitigações:** aviso fixo no editor (seção 3); o banco **recusa mensagem com padrão de CPF/CNPJ ou e-mail** ("Retire dados pessoais"; SUPOSIÇÃO, aceita falso positivo); sem anexos; remoção pelo autor (direito do titular) e pela gestão; texto removido expira. **Exposição de inadimplente** é risco jurídico clássico em condomínio: **a confirmar com advogado** e dizer nas regras.

### 7.3 Difamação e ofensa, sem denúncia nem ocultação (avaliação)
A decisão do dono não tem denúncia. Significa que **o Síndico e o ADM são o único freio, e só agem se olharem**; uma ofensa fica visível até lá. Quem é citado é avisado e **não tem botão**: vai pedir ao síndico por fora.
**Recomendo o mínimo viável, sem denúncia, sem fila, sem estado e sem ocultar:**
1. **Resumo diário** à gestão (seção 6): traz o Síndico e o ADM ao livro.
2. **"Avisar a gestão"** (D3): botão discreto em cada mensagem de outro, que **só envia um aviso** ao Síndico e ao ADM com o link. Não oculta, não conta, não identifica quem sinalizou, **uma por mensagem por pessoa**. Custo baixo (uma função e uma notificação). **Não contraria o dono**: não é denúncia nem moderação; se ele não quiser, ficamos sem e a alternativa é só o resumo diário.
3. **Regras de uso curtas** na tela do Livro e uma **ciência única** no primeiro uso ("Li as regras"; guarda data e versão; reduz o risco do condomínio). SUPOSIÇÃO: vale o atrito.
O texto das regras e a política do que justifica apagar (ofensa, dado pessoal, fora do assunto; **crítica dura à gestão não é motivo**) saem **antes** do lançamento, com síndico e advogado.

### 7.4 Spam e frequência
Limites no banco (SUPOSIÇÃO, ajustar): **10 mensagens por hora e 40 por dia por pessoa**; recusa texto idêntico em 1 minuto; 5 citados por mensagem; **no máximo 15 avisos de citação por pessoa por dia** como remetente. Mensagem de erro em português. Cuidado: a revisão de segurança já apontou texto livre sem limite (B-4); o livro **nasce com limite**, não espera a #72.

### 7.5 XSS, HTML, invisíveis e direção
Texto puro, **renderizado como texto** (React escapa; proibido `dangerouslySetInnerHTML`). Remover caracteres invisíveis e de direção no cliente (`limparTextoLivre`, `src/lib/textoLivre.ts`) **e** no banco (`limpar_texto_livre`, 0042: o banco é quem vale). Recusar mensagem só de espaço ou invisíveis (`textoVazio` no cliente; no banco, `nome_em_branco` cobre a classe). Limitar combinações de acentos em cadeia (texto "zalgo") e quebras seguidas. Sem links clicáveis.

### 7.6 Quem pode o quê no banco (RLS, resumo)
- **Ler:** perfil ativo, validado, não provisório (inclui Zelador e Portaria). Sem `anon`.
- **Escrever:** só pela **função** de publicar, que exige Síndico, Subsíndico, Morador ou Conselho, validado e ativo; gera autor, nome, unidade e cargo no servidor; ignora o que o navegador mandar. Sem `INSERT` direto na tabela.
- **Apagar:** função `livro_remover`, só Síndico e ADM (e o próprio autor, no caso "própria"). **`DELETE` e `UPDATE` direto: ninguém**, nem Síndico.
- **Avisos:** só gatilho ou função `security definer`; navegador sem `INSERT`.
- **Citáveis:** função que devolve só bloco, número, cargo e nome de cargo; moradores não leem `units` nem `profiles` dos outros.
- **Registro de remoções:** só os perfis da seção 5; texto vencido fora do alcance.
- Auditoria sem texto livre; `revoke all` de `anon`; funções com `search_path` fixo.

### 7.7 O que um vazamento causaria
Conta de morador roubada ou compartilhada na família: lê **todo o histórico** (nomes, unidades, opiniões, acusações). Captura de tela vai para o grupo do WhatsApp (fora do controle). Um morador mal-intencionado pode raspar o histórico por API. **Mitigações:** só leitura por validados, paginação limitada, sem exportação, sem busca global na v1, limite de linhas por consulta no painel do Supabase (**#71**), sessões e links com validade (**#15**). Residual aceito: capturas de tela.

### 7.8 Base legal e aviso de privacidade (#55)
**SUPOSIÇÃO a confirmar com advogado:** legítimo interesse do condomínio (comunicação entre condôminos), não consentimento. O texto do **#55** precisa dizer, antes de liberar: o livro é visível a moradores validados e à equipe, com nome e unidade; citar uma unidade avisa a conta dela; mensagens removidas guardam o texto por 90 dias; o autor pode apagar a sua; ao excluir a conta, as mensagens ficam **anonimizadas** ("Ex-morador", sem unidade) e a gestão pode remover. **Prazo de guarda das mensagens** (por exemplo, 12 a 24 meses): definir com o advogado **antes** do lançamento; implementar na fase 2.

### 7.9 Conversa com advogado (antes da fase 2 da construção)
1. Responsabilidade do condomínio por conteúdo de moradores e se há dever de moderar depois que a gestão é avisada.
2. Peso jurídico de uma resposta do Síndico no livro.
3. Base legal e prazos (mensagens e texto removido), exclusão no pedido do titular.
4. Exposição de inadimplentes e dado de menores e de saúde em texto livre.
5. O livro digital substitui o livro físico, se o regimento o exige.

## 8. Escopo

**MVP (entra)**
- Tópico e resposta (um nível), limites, feed por atividade, paginação.
- Citação por unidade e por cargo, aviso no sino, limites e agrupamento.
- Autor apaga a própria; Síndico e ADM apagam qualquer, com motivo fechado, registro e texto retido 90 dias.
- Registro de remoções para Síndico, Subsíndico, ADM e Conselho; entrada em `audit_logs`.
- Avisos: citação, remoção, resposta ao seu tópico, resumo diário à gestão, "Avisar a gestão" (D3).
- Regras de uso, ciência única, filtro de CPF/e-mail, limites de frequência.
- **Interruptor próprio do livro**, não o geral (seção 14).
- Bateria de segurança e QA.

**Fora do MVP:** edição; `@` inline; remover tópico com respostas; anexos; reação; busca; "resolvido"; mutar tópico; notificação por WhatsApp ou e-mail; prazo ou SLA (decidido: nenhum); denúncia com fila e ocultação (abandonada); categorias; exportação; relatórios para o Conselho; prazo automático de guarda das mensagens (depende do advogado); multi-condomínio.

**Fases**
- **Fase 0 (sem código, 1 semana):** 30 minutos com o síndico (quantas entradas o livro físico tem por mês, quem apaga hoje, quem moderaria de fato) e 30 com o advogado (7.9) e aprovar as regras de uso e o texto do #55. **Critério para construir (SUPOSIÇÃO):** o síndico se compromete a olhar o livro e há texto de regras e aviso de privacidade aprovados.
- **Fase 1 (MVP), lançamento em duas etapas (seção 14).**
- **Fase 2:** `@` inline, remoção de tópico inteiro, prazo de guarda, "resolvido", relatório de uso agregado ao Conselho.

## 9. Critérios de aceite (staging, celular 375px)

**Leitura e acesso**
1. **Dado** um Morador validado, **quando** abre o Livro, **então** vê os tópicos com nome e unidade de todos, em ordem de atividade, 20 por vez.
2. **Dado** Síndico, Subsíndico, ADM, Conselho, Zelador ou Portaria, **quando** abre o Livro, **então** lê tudo; ADM, Zelador e Portaria **não** veem editor nem botão de responder.
3. **Dado** provisório, visitante, conta sem perfil ou conta desativada, **quando** abre `/livro` ou consulta por API, **então** não vê nada ("sem acesso", 0 linhas).

**Escrever**
4. **Dado** quem pode escrever, **quando** envia tópico entre 10 e 1000 caracteres, **então** aparece no topo, com o nome e a unidade do servidor, e o contador mostra o limite.
5. **Dado** texto com menos de 10 ou mais de 1000, só espaços ou só invisíveis, com CPF ou e-mail, **quando** envia, **então** o botão fica desativado ou o banco recusa com mensagem em português.
6. **Dado** o 11º envio na mesma hora, **quando** envia, **então** é recusado com mensagem clara.
7. **Dado** um tópico com 200 respostas, **quando** alguém responde, **então** recebe "chegou ao limite".
8. **Dado** HTML, `<script>` ou caracteres de direção no texto, **quando** é exibido, **então** aparece como texto puro, sem link e sem inversão.
9. **Dado** uma resposta, **quando** tentam responder a ela, **então** o banco recusa; só se responde ao tópico.

**Citações e avisos**
10. **Dado** o Morador A cita a unidade B-202, **quando** publica, **então** a conta de B-202 recebe "Sua unidade foi citada no Livro" com link ao tópico, sem trecho nem nome.
11. **Dado** uma citação ao Síndico e à unidade em que ele mora, **quando** publica, **então** o Síndico recebe **um** aviso.
12. **Dado** 6 citados, ADM, Zelador, Portaria, unidade sem conta ou o próprio autor, **quando** publica, **então** o banco recusa ou ignora esses alvos e informa o motivo.
13. **Dado** um aviso de citação não lido no mesmo tópico, **quando** a pessoa é citada de novo nele, **então** não cria outro aviso.
14. **Dado** que digitei um nome no texto sem usar "Citar", **quando** publico, **então** ninguém recebe aviso, e a tela avisa isso.

**Apagar**
15. **Dado** Síndico ou ADM, **quando** remove com motivo da lista, **então** todos veem "Mensagem removida pela gestão", e o texto some da tela e da API.
16. **Dado** Subsíndico, Conselho, Morador, Zelador, Portaria, **quando** tentam remover mensagem de outro, **então** 403.
17. **Dado** o autor, **quando** remove a própria, **então** vê "Você removeu esta mensagem" e entra no registro como "removida pelo autor".
18. **Dado** uma remoção, **então** existe um registro imutável (quem, quando, motivo, marcadores de conflito) e uma linha em `audit_logs` sem texto livre; o autor recebe o aviso; Conselho e Subsíndico leem o texto por 90 dias; após o prazo, o texto não existe mais.
19. **Dado** o Síndico que remove mensagem que o cita, **então** o registro marca "citava quem removeu".
20. **Dado** qualquer perfil, **quando** tenta `UPDATE` ou `DELETE` direto na tabela, **então** recusado.

**Avisar a gestão (se D3 for sim)**
21. **Dado** Morador, **quando** toca em "Avisar a gestão", **então** Síndico e ADM recebem um aviso neutro uma vez por mensagem; segundo toque diz "Já avisado"; nada é ocultado.

**Interruptor**
22. **Dado** o interruptor em "Equipe", **quando** um Morador acessa, **então** não vê o menu e o banco recusa leitura e escrita.

**Estados e tela**
23. **Vazio:** "Ainda não há mensagens. Escreva a primeira." com botão (Morador, Síndico, Subsíndico, Conselho); para os demais: "Ainda não há mensagens."
24. **Carregando:** esqueleto de 3 cartões. **Erro:** mensagem em português e botão "Tentar de novo"; texto digitado **não se perde** ao falhar o envio. **Sem conexão:** aviso claro, botão de enviar bloqueado.
25. **375px:** sem rolagem horizontal; alvos de 44px; folha de "Citar" ocupa a tela, com busca; teclado não cobre o botão de enviar; textos longos quebram linha.
26. **Acessibilidade:** campo com rótulo e contador por `aria-live` educado; mensagens com leitura "Mensagem de {nome}, unidade {x}, há {tempo}"; mensagem removida anunciada como nota; foco volta ao botão de origem ao fechar a folha ou o diálogo; contraste mínimo AA; respeita "reduzir movimento"; confirmar remoção com o `DialogProvider`, nunca `window.confirm`.

## 10. Modelo de dados (alto nível, sem migração)

- **`livro_mensagens`:** id; `pai_id` (nulo = tópico; só aponta para tópico; no mesmo livro); `autor_id` (vira nulo ao excluir a conta, com anonimização de nome e unidade); fotografias `autor_nome`, `autor_unidade`, `autor_papel`; `texto` (vazio quando removida); `criada_em`; `ultima_atividade_em` e `n_respostas` (nos tópicos, mantidos por gatilho); `removida_em`, `removida_por` (GESTAO ou AUTOR). **Índices:** tópicos por `(ultima_atividade_em desc, id)`; respostas por `(pai_id, criada_em, id)`; `(autor_id, criada_em)` para o limite de frequência.
- **`livro_citacoes`:** mensagem, tipo (UNIDADE ou PESSOA), alvo interno, **rótulo fotografado**; chave única por mensagem e alvo. O id interno do alvo **não é exposto** a morador.
- **`livro_remocoes`:** mensagem, quem removeu e papel, quando, motivo (código), autor, unidade do autor, marcadores "autor era quem removeu" e "citava quem removeu", **texto original** e `texto_expira_em`. Imutável.
- **`livro_ciencia`:** pessoa, quando, versão das regras.
- **`livro_config` (uma linha):** estado do módulo (DESLIGADO, EQUIPE, ABERTO), alterado só por Síndico e ADM por função, com auditoria.
- **Gatilhos e funções:** `livro_publicar` (valida perfil, limites, texto, citações; grava mensagem e citações juntas; gera avisos); `livro_remover` (autor ou Síndico e ADM; motivo; mensagem vazia; registro; auditoria; aviso); `livro_citaveis` (devolve só o permitido); `livro_sinalizar` (D3); gatilho de `ultima_atividade_em`; gatilho de anonimização na exclusão de conta; limpeza de texto vencido.
- Todas as funções com `security definer`, `set search_path = public`, perfil relido do banco, e `revoke` do que não precisa.
- Padrões a reaproveitar: `get_user_role()`, `tem_perfil()`, `limpar_texto_livre()`, `nome_em_branco()`, avisos por `usuario_id_alvo` (0037), auditoria no servidor (0042).

## 11. Cenários para QA e segurança (bateria `scripts/qa/`, staging, contas reais)

**Por perfil, pela tela e por API/REST**
- **Síndico e ADM:** removem qualquer mensagem; sem motivo da lista, recusado; `delete` direto recusado; ADM tenta publicar, responder e citar: recusado; ADM citado: recusado.
- **Subsíndico e Conselho:** leem, publicam, respondem, removem a própria; **removem de outro: 403**; leem o registro e o texto; recebem aviso de citação.
- **Morador (proprietário e inquilino):** publica, responde, cita, remove a própria; **não** remove de outro; não lê o registro de outros nem o texto de remoção alheio; não lê `units` nem `profiles` de outros.
- **Zelador (ativo e desativado) e Portaria:** leem; **publicar, responder, citar, remover, sinalizar: recusado**; não são citáveis; **não recebem aviso do livro**; não leem o registro; Zelador desativado não lê nada.
- **Provisório, visitante, sem perfil:** 0 linhas, qualquer operação recusada.

**Por API (forjar)**
1. `POST` direto na tabela com `autor_id`, `autor_nome`, `autor_papel`, `removida_em`, `pai_id` de outro tópico: recusado ou sobrescrito.
2. Resposta a resposta; resposta a tópico removido; 201ª resposta; texto de 1001; texto vazio, só invisível; CPF e e-mail no texto; HTML e direção.
3. Citar: ADM, Zelador, Portaria, provisório, unidade sem conta, 6 alvos, alvo inexistente, o próprio: recusado ou ignorado.
4. `INSERT` direto em `notifications` com `usuario_id_alvo`: recusado; o aviso só nasce do gatilho; texto do aviso sem trecho nem nome.
5. Remover com motivo livre (fora da lista) ou texto longo: recusado; remover duas vezes: sem duplicar registro nem aviso.
6. `UPDATE` ou `DELETE` direto em mensagens, citações, remoções, ciência, config: recusado para **todos**, inclusive Síndico e ADM.
7. Ler `livro_remocoes` como morador comum, Zelador, Portaria: 0 linhas; texto depois do prazo: ausente.
8. Frequência: 11ª mensagem na hora; mensagem repetida em 1 minuto; 16 avisos de citação no dia.
9. Interruptor: nos três estados, quem lê e escreve em cada um (inclusive API).
10. Excluir conta de autor: mensagens ficam anonimizadas, sem unidade; não quebra o feed.
11. `audit_logs` com a remoção, sem texto livre; auditoria não editável.
12. Agrupamento: um só aviso por pessoa e por tópico; resumo diário à gestão no máximo uma vez por dia.
13. Migração roda duas vezes no staging sem erro; nenhuma policy nova usa `tem_perfil_operacao()` nem `is_admin()` para apagar (conferir por consulta ao catálogo).
14. Sessão ou JWT de quem foi desativado: lembrar a observação I-10 da revisão de segurança (JWT antigo vale até expirar).

## 12. Métricas de sucesso (metas = SUPOSIÇÃO)

Contagens **agregadas, sem nome nem texto**, por consulta no banco (como a da v1); **sem ranking por pessoa, sem rastrear leitura**.

| Métrica | Meta inicial (SUPOSIÇÃO) |
|---|---|
| Adoção: moradores validados que escreveram em 30 dias | 15% |
| Tópicos por semana | acompanhar; menos de 1 por semana nas 4 primeiras semanas = revisar |
| **Cobertura de resposta da gestão** (tópicos com ao menos uma resposta de Síndico, Subsíndico ou Conselho em 7 dias; **só medida interna, não é prazo e não aparece ao morador**) | 70% |
| Remoções ÷ mensagens | menos de 3%; acima, rever regras |
| Remoções por Síndico ou ADM com marcador "citava quem removeu" | **zero é a meta**; qualquer caso vai ao Conselho |
| "Avisar a gestão" ÷ mensagens | acompanhar |
| Citações por mensagem e avisos de citação por pessoa por semana | média abaixo de 2 (spam alto indica problema) |
| Qualitativo: reclamações no WhatsApp diminuíram? | perguntar ao síndico em 30 dias |

## 13. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| **Clima:** fórum aberto vira palco ou briga de vizinhos | regras no topo, ciência, limites de frequência e tamanho, sem edição, sem reações, remoção pela gestão, resumo diário; lançamento em duas etapas |
| **Livro sem resposta** (sem prazo): o morador fala e ninguém responde, e o livro vira "mural de queixa" | resumo diário à gestão; selo "voz da gestão"; métrica interna de cobertura; **sem prometer resposta** na tela (texto neutro: "Os moradores e a gestão podem responder aqui"); se a cobertura ficar abaixo da meta em 30 dias, reavaliar com o dono (decisão 6) |
| **Difamação e ofensa**, gestão como único freio | seção 7.3: resumo, "Avisar a gestão", regras, política de remoção, advogado |
| **Síndico apagando crítica a si** | seção 5.4: registro com texto para Conselho e Subsíndico, marcador de conflito, aviso ao autor |
| **Remoção "como censura"** gera conflito | política escrita: o que justifica; crítica dura à gestão não é motivo |
| **LGPD:** dado de terceiros, de menor, de saúde, de dívida; sem prazo de guarda | filtro de CPF e e-mail, regras, remoção, texto vencido apagado, #55, advogado, prazo de guarda antes da fase 2 |
| **Perfis que leem e não escrevem** (Zelador, Portaria, ADM) | explicitado; Zelador e Portaria leem críticas a eles; ADM sem voz |
| **Spam de avisos** | limites, agrupamento, 5 citados, um aviso por pessoa por mensagem |
| **Suporte:** "quem apagou?", "por que não consigo editar?" | textos fixos; só o autor vê o motivo; regra de edição na ajuda curta |
| **Conta compartilhada na família** | residual aceito; avisar nas regras |
| **Dependência de #55 e #72** | #55 é pré-requisito; o livro cria suas funções com os padrões da #72 e herda quando ela sair |

## 14. Interruptor de módulos (adiado) e rollout

O interruptor geral continua **adiado e inexistente** (o menu em `Sidebar.tsx` filtra só por perfil). **Esconder tela não é segurança**; o banco tem de recusar.

**Recomendo não depender do interruptor geral. Fazer um mínimo do livro:** a linha `livro_config` com estado **DESLIGADO, EQUIPE ou ABERTO**, lida pela função de leitura e de escrita (o RLS e as funções consultam o estado) e alterada por Síndico e ADM, com auditoria. A alternativa mais barata, uma constante de ambiente, esconde o menu mas **não** fecha a API, então **não a recomendo** sozinha.

**Rollout em duas etapas**
1. **EQUIPE** (1 a 2 semanas): só Síndico, Subsíndico, ADM e Conselho entram. Lêem as regras, testam, publicam tópicos reais e testam remoção e registro.
2. **ABERTO:** Morador validado, Zelador e Portaria passam a ler (e Morador a escrever). Aviso no Mural e uma mensagem curta no grupo do WhatsApp, com as regras.
Voltar a EQUIPE ou DESLIGADO é um toque (sem apagar dados).

## 15. Esforço e prioridade

**Esforço relativo: M** (a v1 era G). A maior parte do custo é segurança e bateria (citação, remoção, avisos, interruptor), não tela.

**Prioridade frente às pendências (recomendação)**
1. **Antes de tudo (já "Agora" no backlog):** **#69, #70, #71** (segurança, esforço P cada; #71 também limita linhas por consulta e cruza #15) e **#15** (validade do código; resposta rápida do dono). Livro aberto aumenta o que um login roubado revela.
2. **#55 (aviso de privacidade):** **pré-requisito duro**; sem texto aprovado, não abrir o livro.
3. **#20 (multa):** decisão com o síndico segue na frente de liberar multas; **o livro não depende de multa** (a v1 sugeria ordem; o v2 não acopla). Se o síndico pedir o livro antes da multa, vale.
4. **Integração Superlógica (#90):** independente (depende de autorização da administradora); pode andar em paralelo. Os dois não se tocam: o livro **não lê** cobrança nem boleto.
5. **#72** (auditoria e notificações só pelo servidor, com limites): o livro implementa o padrão por conta própria; ordem ideal #72 antes, não obrigatória.
6. **Livro:** depois de 1 e 2 e, na prática, antes de mais nada de "funcionalidade nova". **Eu cortaria** (da fila do livro): `@` inline, remoção de tópico inteiro, reações, e **adiaria** o filtro de CPF/e-mail se o cronograma apertar (não adiar o limite de frequência nem o registro de remoções).

## 16. Decisões em aberto (máximo 6, cada uma com recomendação)

- **D1. Quem lê.** Recomendo: validados (inclui Zelador, Portaria e ADM); **provisório, visitante, sem perfil e desativado não leem**. Motivo: link de cadastro aberto (2.1). Contesta nada; completa a decisão 1.
- **D2. Autor apaga a própria; ninguém edita.** Recomendo **sim e sim**: LGPD e erro de digitação, sem abrir edição que muda o sentido depois das respostas.
- **D3. "Avisar a gestão".** Recomendo **incluir** (botão que só avisa, sem ocultar, sem fila, sem contar quem sinalizou). Se o dono preferir ficar sem, cai só o resumo diário e o risco da seção 7.3 sobe.
- **D4. Texto das mensagens removidas.** Recomendo guardar **90 dias**, lido por Síndico, Subsíndico, ADM, Conselho e o próprio autor, e apagar depois. Prazo **a confirmar com advogado**. É o contrapeso ao poder de apagar.
- **D5. Avisos além da citação.** Recomendo: (a) ao autor quando removem a mensagem; (b) ao autor do tópico quando respondem, agrupado; (c) resumo diário à gestão. A decisão 4 só fala da citação; estes três a **estendem**, não a contrariam.
- **D6. Quem é citável e como.** Recomendo: ADM, Zelador e Portaria **não**; moradores são citados **pela unidade** (sem lista de nomes); Síndico, Subsíndico e Conselho por nome; unidade avisa **só a conta ligada**; no máximo 5 por mensagem.

## 17. Perguntas ao dono (máximo 2)

1. **O Conselho e o Subsíndico podem ler, por 90 dias, o texto das mensagens que o Síndico e o ADM removeram?** Recomendo que sim: é o único contrapeso ao poder de apagar. Sem isso, ninguém além de quem apagou sabe o que foi apagado. Muda a seção 5 e a política de leitura.
2. **Aceita o botão "Avisar a gestão" (só avisa o Síndico e o ADM, não oculta nada)?** Recomendo que sim. Sem ele, quem é citado numa acusação não tem como pedir revisão dentro do portal. Muda a seção 7.3 e as métricas.

## 18. Trecho proposto para `docs/produto.md` (só após aprovação do dono)

> **Livro de reclamações v2 (2026-10-07): desenho decidido.** O livro é **aberto**: todos os perfis com conta validada leem tudo, com nome e unidade (provisório, visitante e conta desativada não leem; a confirmar). **Escrevem** só Síndico, Subsíndico, Morador e Conselho; **Zelador, Portaria e ADM só leem**. **Síndico e ADM apagam qualquer mensagem**, com registro (quem, quando, motivo). Quem é **citado** (Síndico, Subsíndico, Morador, Conselho) recebe aviso no sino. É um **fórum** em que moradores citam a unidade ou o nome de outros. **Sem prazo para resposta.** Abandonados: categorias privadas, denúncia, ocultação e prazo de 5 dias úteis (v1 de 2026-10-04). Em aberto: D1 a D6. Spec: `docs/specs/2026-10-07-livro-de-reclamacoes-v2.md`.
