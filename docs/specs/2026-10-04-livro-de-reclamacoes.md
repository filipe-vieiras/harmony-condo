# PRD: Livro de reclamações (livro aberto para área comum e serviços, privado para temas sensíveis)

Autor: PM. Data: 2026-10-04. Status: **PROPOSTA, aguardando o dono** (nada decidido). Substitui a versão anterior da spec (desenho 100% privado, preservado em "Alternativas consideradas").
Migração prevista: `0032` (a última existente é a 0031). Sem dados reais neste documento (repositório público).

> Não é parecer jurídico. O que está em "a confirmar com advogado" precisa de advogado e do regimento. Tudo marcado **PROPOSTA** é recomendação minha, não decisão.

## 0. Premissas e decisões pendentes
- **Informado pelo dono:** hoje o livro do condomínio é **aberto** (todos comentam e veem quem comentou). Fato relatado, ainda não conferido com o regimento.
- **Q1 (EM ABERTO, decisão do dono):** o regimento diz que o livro é aberto? O que síndico e conselho aceitam como público com nome? A seção 9 explica o efeito de cada resposta.
- **Q2 (EM ABERTO, decisão do dono):** quem modera (oculta comentários e reclamações)? PROPOSTA: Síndico, Subsíndico e ADM.
- P-a. Livro = canal formal e rastreável para registrar reclamação ou ocorrência. Não é o livro de ocorrências da portaria.
- P-b. O Harmony **não envia WhatsApp** hoje; o aviso é o sino do portal. Não prometer mais.
- P-c. Um condomínio só (decisão vigente: sem multi-condomínio). Categorias são lista no código, ajustável por instalação.
- P-d. Cada unidade tem um morador com conta; mais de um morador por unidade é a etapa 2 já registrada em `docs/produto.md`.
- P-e. Síndico, Subsíndico e ADM têm as mesmas permissões.

## 1. Contexto e problema
**Quem sofre**
- **Morador:** reclama no grupo (exposição, vira briga) ou no privado, e não sabe se foi lido. Idoso e leigo desistem.
- **Síndico:** reclamação some no meio do grupo, responde de memória, não prova que respondeu.
- **Administradora:** recebe reclamação de cobrança e serviço por canais soltos, sem protocolo.
- **Conselho:** não enxerga volume nem tempo de resposta.

**Hoje:** o livro físico aberto, mais WhatsApp, ligação e bilhete. **Suposição, a validar** com o síndico.

**Se nada for feito:** continua disperso, sem protocolo nem rastro. **O risco real é o oposto:** um livro digital sem resposta é pior que o grupo.

**Por que aberto só em parte (PROPOSTA):** para área comum e serviços (elevador quebrado, limpeza), ver quem reclamou e o que a gestão respondeu **ajuda**: evita 10 reclamações iguais e mostra que a gestão age. Para vizinho, funcionário, cobrança e saúde, nome público vira acusação, exposição e dado pessoal. Por isso a **categoria define a visibilidade** e o morador não escolhe.

## 2. Objetivos e não-objetivos
**Objetivos (PROPOSTA)**
1. Morador validado registra uma reclamação em menos de 1 minuto no celular, com protocolo.
2. Temas de interesse coletivo ficam visíveis a moradores validados, com nome, e podem receber comentários; temas sensíveis ficam privados.
3. A equipe responde com rastro (quem, quando).
4. Moderação que **oculta, nunca apaga**, com quem e por quê visíveis ao Conselho.
5. Nascer desligado, sem risco para o que já está em produção.

**Não-objetivos:** anonimato · anexos e fotos · edição ou apagar pelo autor · multa gerada da reclamação · WhatsApp ou e-mail automático · SLA automático e escalonamento · votação "eu também" · chat de várias mensagens privado · integração com administradora · multi-condomínio · relatórios avançados.

## 3. Usuários: o que cada perfil vê e faz (PROPOSTA)
| Perfil | Públicas (área comum, serviços) | Privadas (vizinho, funcionário, cobrança, saúde) | Moderação |
|---|---|---|---|
| Morador validado | vê todas, com nome; cria; comenta (até 500 caracteres, sem editar); denuncia | vê só as próprias; cria | não |
| Morador provisório | nada (menu some, banco recusa) | nada | não |
| Síndico, Subsíndico, ADM | veem todas; respondem; encerram | veem todas, com autor e unidade; respondem; encerram | **ocultam** reclamação ou comentário, com motivo (Q2) |
| Conselho | só leitura, inclusive ocultas, com quem ocultou e o motivo | só leitura (nome do autor: ver Q1) | não |
| Portaria | **sem acesso** (a confirmar) | sem acesso | não |
| Visitante / conta sem perfil | nada | nada | não |

Portaria sem acesso: são funcionários, muitas vezes terceirizados, e o tema pode ser sobre eles ou vizinhos (mesmo critério LGPD de multas). A confirmar com o dono.

## 4. Requisitos funcionais
**Registro**
- RF1. Morador validado cria reclamação com: categoria (lista fechada), descrição (20 a 1500 caracteres), local (texto curto, opcional).
- RF2. Categorias e visibilidade (**PROPOSTA**): PÚBLICAS = Área comum (limpeza, conservação, equipamentos), Serviços (elevador, portaria, manutenção como serviço, sem citar pessoa). PRIVADAS = Vizinho ou convivência, Funcionário, Cobrança ou taxa, Saúde ou segurança pessoal, Outro (nasce privada na dúvida).
- RF3. A visibilidade vem da categoria e é gravada pelo banco; o morador não escolhe nem vê um botão "tornar público".
- RF4. Categoria **imutável** depois de enviada (nem pela equipe). Se errou, abre nova e a equipe oculta a antiga com motivo.
- RF5. Unidade e autor vêm da conta, não editáveis. Protocolo gerado pelo banco.
- RF6. Texto de orientação antes da descrição: "Conte fatos: o que, quando, onde. Não cite nomes de pessoas." Nas públicas, aviso extra: "Esta reclamação será visível com seu nome para moradores validados."
- RF7. Limite de abuso: 5 reclamações por morador em 24 horas (valor sugerido).

**Resposta e estados**
- RF8. Equipe responde (texto 10 a 1500 caracteres) e encerra. Resposta guarda nome e papel de quem respondeu, copiados no momento.
- RF9. Prazo de 5 dias úteis (**suposição**) só como **selo interno** "sem resposta há mais de 5 dias úteis" na lista da equipe. Ao morador, texto neutro: "Recebemos sua reclamação. Vamos analisar e responder." Sem promessa de prazo.

**Comentários (só nas públicas)**
- RF10. Morador validado e equipe comentam em reclamação pública não oculta e não encerrada. Até 500 caracteres. **Sem edição, sem exclusão pelo autor.**
- RF11. Comentário mostra nome e unidade do autor (PROPOSTA; ver Q1).
- RF12. Reclamação privada não aceita comentário (banco recusa).

**Denúncia e moderação**
- RF13. Botão **Denunciar** em reclamação e comentário públicos, para morador validado; motivo de lista fechada (ofensa, cita nome de pessoa, dado pessoal, fora do tema) mais texto opcional curto. Uma denúncia por pessoa por item.
- RF14. A equipe vê fila de denúncias; **oculta** com motivo obrigatório ou **mantém** (descarta a denúncia).
- RF15. Ocultar nunca apaga: o conteúdo fica no banco. Moradores veem "Oculta pela moderação"; Conselho e equipe veem o conteúdo, quem ocultou, quando e o motivo.
- RF16. Equipe pode reexibir (grava quem e quando). Quem oculta a própria crítica ou algo sobre si: ver risco R3 e mitigação.
- RF17. Nenhum perfil apaga reclamação ou comentário (nem ADM).

**Acesso e liberação**
- RF18. Portaria, provisório, visitante e conta sem perfil sem acesso. Conselho só leitura.
- RF19. A feature nasce **desligada** por um interruptor (ver dependências).

**Notificações (sino, sem WhatsApp)**
- RF20. Nova reclamação: aviso à equipe. Resposta: aviso ao autor. Nova denúncia: aviso à equipe. Comentário em reclamação pública: aviso ao autor da reclamação.
- RF21. Textos neutros, sem categoria sensível nem trecho: "Nova reclamação, protocolo X", "Sua reclamação X foi respondida". Link interno `/reclamacoes/ID`.

**Histórico**
- RF22. `audit_logs` por gatilho: aberta, em análise, respondida, encerrada, comentada, denunciada, ocultada, reexibida. Grava protocolo, categoria, unidade, quem e quando; **não grava texto livre**.

## 5. Fluxo e estados
Estados: `ABERTA` > `EM_ANALISE` (opcional) > `RESPONDIDA` > `ENCERRADA` (final). `ABERTA` pode ir direto a `RESPONDIDA`. Sem voltar; discordou, abre nova citando o protocolo.
**Estado extra, independente do fluxo:** `OCULTA_PELA_MODERACAO` (marca separada, com `oculta_por`, `oculta_em`, `motivo_ocultacao`). Uma reclamação oculta mantém seu estado de fluxo por baixo e pode ser reexibida.

Fluxo morador: Livro > Nova reclamação > categoria (a tela diz se será pública ou privada) > descrição > enviar > protocolo.
Fluxo equipe: sino > lista (mais antiga sem resposta primeiro) > analisar > responder > encerrar. Denúncia: fila > ocultar com motivo ou manter.
Público: lista de públicas com nome, resposta da gestão e comentários.

## 6. Regras de moderação e denúncia (PROPOSTA)
- Quem modera: Síndico, Subsíndico, ADM (**Q2**). Conselho observa, não modera.
- Moderar = ocultar ou reexibir. Motivo obrigatório (lista fechada mais texto curto). Registro imutável de quem e quando.
- Conselho vê todas as ocultações: é o contrapeso a R3.
- Denúncia não oculta sozinha (sem ocultação automática por número de denúncias, para não permitir derrubar crítica legítima em grupo).
- Texto orientador na tela: "Ocultar não apaga. O Conselho vê quem ocultou e por quê."
- Sugestão de política escrita (a validar com síndico e advogado): o que justifica ocultar (ofensa, nome de pessoa, dado pessoal, fora do tema); crítica dura à gestão **não** é motivo.

## 7. Regras de acesso no banco (migração 0032, idempotente, staging primeiro)
Padrões a reaproveitar: `is_admin()`, `get_user_role()`, `tem_perfil()`, `is_cadastro_provisorio()`, `get_my_unit_id()`, `_drop_policies_cmd`, gatilhos `security definer` com `set search_path = public`. Tabelas (nomes provisórios): `reclamacoes`, `reclamacao_comentarios`, `reclamacao_denuncias`. RLS ligada, `revoke all` de `anon`.

| Operação | Quem | Condição |
|---|---|---|
| SELECT reclamação | Síndico, Subsíndico, ADM, Conselho | todas, inclusive ocultas |
| SELECT reclamação | Morador validado | as próprias (qualquer categoria) **ou** públicas **não ocultas**; ocultas de terceiros: só um marcador "oculta" sem conteúdo |
| INSERT reclamação | Morador validado | `autor_id = auth.uid()`, unidade da conta, status `ABERTA`, sem resposta; visibilidade derivada da categoria pelo gatilho |
| UPDATE reclamação | `is_admin()` | só via gatilho: status, resposta, ocultação; autor nunca |
| DELETE | ninguém | sem política |
| SELECT/INSERT comentário | Morador validado, equipe | só em reclamação pública, não oculta, não encerrada; `autor_id = auth.uid()`; 500 caracteres |
| UPDATE/DELETE comentário | só `is_admin()` para ocultar (via gatilho) | texto imutável; ninguém apaga |
| INSERT denúncia | Morador validado | em item público de outra pessoa; uma por pessoa por item |
| SELECT denúncia | equipe, Conselho | moradores não leem denúncias |
| Portaria, anônimo, sem perfil, provisório | | sem política |

Gatilhos: antes de inserir (protocolo, autor, unidade, visibilidade pela categoria, tamanhos, limite de 5 em 24 horas); antes de atualizar (só campos permitidos, **categoria e visibilidade imutáveis**, transições válidas, `ENCERRADA` final, `oculta_*` preenchidos com `auth.uid()`, motivo obrigatório); comentário só em pública; auditoria sem texto livre. Nenhuma rota usa chave de serviço para responder ou moderar: roda como o usuário logado. Cuidado: o Morador não pode obter, nem por contagem ou busca, o conteúdo oculto ou o autor de reclamação privada de outra unidade (usar visão ou função com colunas limitadas, nunca `select *` direto).

**Testes obrigatórios no staging (`scripts/qa/`, contas reais de cada perfil, por API e por tela)**
1. **Como outro morador (outra unidade):** não lê reclamação privada de A (nem por id direto, nem por contagem); lê pública de A com nome; não atualiza nada de A; não comenta em privada; não vê conteúdo de oculta.
2. Autor A tenta alterar a própria reclamação (texto, categoria, status, visibilidade, resposta): recusado. Tenta trocar a categoria para mudar a visibilidade: recusado.
3. Criar com `unit_id`, `autor_id`, visibilidade, status ou resposta falsos: recusado ou sobrescrito.
4. Comentário: 501 caracteres recusado; edição e exclusão recusadas para o autor; comentário em reclamação oculta, encerrada ou privada recusado.
5. **Portaria:** lista vazia, `insert`, `update` e comentário recusados, sem menu, URL direta mostra "sem acesso".
6. **Conselho:** lê tudo, inclusive ocultas e quem ocultou; qualquer escrita (criar, comentar, denunciar, ocultar) recusada.
7. **Visitante sem login e conta sem perfil:** nada lê nem escreve.
8. **Provisório:** `select`, `insert`, comentário e denúncia recusados; menu oculto; URL direta bloqueada.
9. Morador tenta ocultar ou reexibir: recusado. Síndico, Subsíndico e ADM ocultam com motivo (sem motivo, recusado); `delete` recusado para os três.
10. Valores falsos de `oculta_por`/`respondida_por` enviados pelo cliente: ignorados.
11. Denúncia duplicada recusada; morador não lê denúncias.
12. Sexta reclamação em 24 horas recusada com mensagem em português.
13. Notificações: B não recebe aviso de A; Conselho e Portaria não recebem avisos de resposta; texto sem categoria nem trecho.
14. Com o interruptor desligado: menu, páginas e atalhos ausentes (esconder tela, **não** é segurança; a segurança é o RLS).
15. `audit_logs` sem texto livre; ninguém edita nem apaga pelo app. Migração roda duas vezes no staging sem erro.

## 8. Notificações
Reaproveitar `notifications`. Ver RF20 e RF21. Sem canal fora do portal. Quem espera WhatsApp não será avisado fora do portal (expectativa a comunicar na tela).

## 9. Métricas de sucesso (metas = suposição)
| Métrica | Meta inicial (suposição) | Como medir |
|---|---|---|
| Adoção: moradores validados com 1 reclamação ou comentário em 30 dias | 15% | consulta abaixo |
| Cobertura de resposta: reclamações respondidas em até 5 dias úteis | 80% | idem |
| Reclamações sem resposta há mais de 5 dias úteis | menos de 10% | idem |
| Taxa de ocultação (ocultas ÷ públicas) | menos de 5%, acima disso revisar política | idem |
| Denúncias mantidas ÷ denúncias | acompanhar (muitas mantidas = denúncia por birra) | idem |
| Migração do WhatsApp: redução de reclamações no grupo | qualitativo, perguntar ao síndico | conversa |

Consulta que o agente `dados` poderia especificar (rascunho, sem ferramenta de terceiros; só contagens agregadas, sem texto nem nome):
```sql
select categoria, visibilidade, status,
       count(*) total,
       count(*) filter (where oculta) ocultas,
       count(*) filter (where respondida_em is not null
         and respondida_em <= criada_em + interval '7 days') respondidas_em_7d_corridos
from reclamacoes
where criada_em >= now() - interval '30 days'
group by 1,2,3;
```
(7 dias corridos aproxima 5 dias úteis; o cálculo exato de dias úteis fica para o `dados`.) Dados de moradores não vão para ferramenta de terceiros sem decisão do dono.

## 10. Riscos e mitigações
- **R1 LGPD:** nome do autor exposto a vizinhos nas públicas; dado pessoal de terceiros em texto livre. Mitigação: só área comum e serviços públicos; aviso antes de enviar; orientação "sem nome de pessoa"; denúncia e ocultação; privadas só autor e equipe; histórico sem texto livre; sem anexos. **A confirmar com advogado:** base legal e aviso de privacidade, prazo de guarda, direito de exclusão (hoje não há exclusão; ocultar não é apagar).
- **R2 Difamação:** morador acusa pessoa em tema público. Mitigação: categoria pública é sobre coisas, não pessoas; "Funcionário" e "Vizinho" são privadas; denunciar; ocultar com motivo; responsabilidade do autor identificado. **A confirmar com advogado:** responsabilidade do condomínio por conteúdo publicado e dever de moderar.
- **R3 Síndico moderando a própria crítica:** quem oculta pode ser o criticado. Mitigação: motivo obrigatório, Conselho vê tudo e quem ocultou, registro imutável, ocultar nunca apaga, política escrita do que é motivo válido. Residual: Conselho precisa olhar de fato. Alternativa a avaliar em Q2: ocultação de itens sobre a gestão só com ciência do Conselho.
- **R4 Suporte:** morador erra a categoria (e não pode mudar): mensagem fixa "se errou, envie outra"; pede editar ou apagar: explicar na tela. Custo de moderação cai na equipe.
- **R5 Expectativa de resposta:** a maior ameaça. Mitigação: selo interno, texto neutro ao morador, e **só lançar quando síndico/ADM se comprometer** a olhar a lista (validação manual).
- **R6 Clima:** livro aberto pode virar palco. Mitigação: comentários curtos, sem edição, denúncia, comentar só em públicas, equipe responde por último; fase de validação mede isso.
- **R7 Conflito de interesse na resposta** (reclamação sobre a gestão): mesmo problema da pendência "síndico julgando recurso da própria unidade". Ver Q1.

## 11. Dependências
- **Interruptor de módulos** (hoje **adiado**): a feature nasce desligada e depende dele para ser escondida. Não achei no código mecanismo de feature desligada (o menu em `src/components/layout/Sidebar.tsx` filtra só por perfil). Sem o interruptor, não liberar; o RLS vale mesmo desligado (tabelas vazias).
- **Aviso de privacidade** atualizado (LGPD) antes de liberar, incluindo que reclamações públicas mostram nome.
- Reuso: `notifications`, `audit_logs` e Relatórios, `DialogProvider` (nunca `window.confirm`), padrões de RLS, `scripts/qa/`, lista e detalhe como em `src/app/multas/`.
- Ordem sugerida: mural liberado antes; livro depois de multas estável (o livro é porta de entrada, não substitui o processo disciplinar); não depende de multas se o dono inverter.

## 12. Fases
**Fase 0: validação manual, 2 semanas, sem código.**
1. Síndico lista, sem nomes, as reclamações dos últimos 60 dias por categoria e canal.
2. Formulário externo simples com as mesmas categorias; respondido manualmente; comentários públicos simulados na própria resposta do síndico no grupo.
3. Medir: volume por semana, % sobre temas sensíveis, quantas ficam sem resposta, se o síndico consegue responder em 5 dias úteis, se o nome público gerou conflito. **Critério para construir (suposição):** pelo menos 1 reclamação por semana **e** compromisso de resposta. Sem o segundo, não construir.
4. Resolver Q1 e Q2 e a conversa com advogado antes da Fase 1.

**Fase 1: MVP (esforço G).** Migração 0032 (3 tabelas, gatilhos, RLS), telas de morador e equipe, comentários, denúncia, ocultação, auditoria, notificações, interruptor, bateria QA. Sem anexos.

**Fase 2: depois.** Anexos (bucket privado, LGPD), reabrir, registrar em nome do morador, relatórios para o Conselho, "eu também", reavaliar Portaria.

## 13. Critérios de aceite (celular 375px, staging)
1. Morador validado abre o Livro pelo menu e envia em até 4 toques após escolher a categoria; alvos de 44px; sem rolagem horizontal.
2. Ao escolher a categoria, a tela diz "Pública, com seu nome" ou "Privada, só a gestão vê" **antes** do envio; orientação "fatos, sem nomes" visível sem rolar.
3. Depois de enviar: protocolo e texto neutro de resposta (sem prazo prometido); aparece em "Minhas reclamações" com estado em português ("Recebida", "Em análise", "Respondida", "Encerrada").
4. Lista de públicas mostra nome, resposta da gestão e comentários; privadas de outros nunca aparecem; contagem não vaza.
5. Comentário: contador de caracteres até 500; sem botão de editar nem apagar; não existe campo em privada.
6. Denunciar abre diálogo do `DialogProvider` com motivo; segunda denúncia do mesmo item mostra "Você já denunciou".
7. Equipe: lista com a mais antiga sem resposta primeiro, selo de atraso, filtros por estado e categoria; fila de denúncias; ocultar exige motivo; botão desabilitado até ser válido.
8. Oculta: morador vê "Oculta pela moderação"; Conselho vê conteúdo, quem ocultou e motivo.
9. Conselho não vê nenhum botão de ação. Portaria, provisório, visitante: sem menu, URL direta mostra "sem acesso".
10. Aviso no sino abre direto a reclamação; texto neutro.
11. Estado vazio e erro com mensagem em português e próxima ação.
12. Com interruptor desligado, nada aparece. Todos os testes da seção 7 passam. Nenhum dado real no repositório.

## 14. Perguntas em aberto (decisões do dono, EM ABERTO)
- **Q1.** O regimento diz que o livro é aberto? O que síndico e conselho aceitam público com nome? Muda: lista de categorias públicas, se o nome aparece, e se existe a opção do morador. Resposta "só privado" leva ao desenho privado (Alternativas).
- **Q2.** Quem modera? PROPOSTA: Síndico, Subsíndico e ADM, com Conselho vendo tudo. Alternativa: moderação só pelo Conselho, ou ocultação do que é sobre a gestão com ciência do Conselho.

**A confirmar com advogado:** (1) base legal e aviso de privacidade para exibir nome a vizinhos; (2) responsabilidade do condomínio sobre conteúdo publicado e dever de moderar; (3) prazo de guarda e pedido de exclusão (LGPD) com ocultação sem apagar; (4) se convenção ou regimento exige canal formal, prazo de resposta ou ata; (5) valor do livro digital frente ao livro físico exigido, se for o caso.

## 15. Alternativas consideradas
- **Desenho privado (spec anterior):** só autor e equipe leem; Portaria fora; categorias fechadas; sem comentários nem moderação (sem conteúdo público a moderar). Mais seguro e mais simples; perde o efeito de transparência e foge do costume do condomínio (livro aberto). **É o plano de recuo se Q1 disser "só privado".**
- **A, livro simples:** lista única sem categoria. Barato, mas sem categoria não dá para separar o sensível.
- **B, categorias e prazo esperado:** base do desenho atual, sem lado público.
- **C original, integrado a multas:** reclamação vira multa com um clique. Cortado: acopla com multas ainda não liberadas e reclamação não é prova.

## 16. Trecho proposto para `docs/produto.md` (só após aprovação do dono)
- **Livro de reclamações (proposto 2026-10-04, NÃO decidido):** livro aberto e com nome para moradores validados só em área comum e serviços; vizinho, funcionário, cobrança e saúde privados; a categoria define a visibilidade (imutável); comentários só nas públicas (500 caracteres, sem edição); denúncia e moderação que oculta e nunca apaga, visível ao Conselho; Portaria sem acesso (a confirmar); provisório bloqueado; nasce desligado (depende do interruptor de módulos). Validar manualmente por 2 semanas antes de construir. Em aberto: Q1 (regimento e o que aceitam público com nome) e Q2 (quem modera). Spec: `docs/specs/2026-10-04-livro-de-reclamacoes.md`.
