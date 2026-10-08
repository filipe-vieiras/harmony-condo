# Estudo: integrar o Harmony à API do Superlógica Condomínios

Data: 2026-10-07. Autor: agente `developer` (modo estudo; nenhum código, migração, commit ou chamada autenticada).
Complementa `docs/pesquisas/2026-10-04-integracao-financeiro.md` (não repete a comparação de PSPs) e corrige a parte que ela deixou "a confirmar".

**Fato confirmado (atualização de 2026-10-07):** o dono confirmou com a administradora (Garden) que ela usa o Superlógica. **Continua a confirmar:** o que a API permite na prática para o nosso caso (acesso à API no plano da Garden, quem libera na administradora, permissão restrita, custo). Está na lista de perguntas da seção 8.

**Como li a documentação.** A página https://apicondominios.superlogica.com/ é um site de documentação Postman que só mostra conteúdo com JavaScript. A ferramenta de leitura devolveu só o título. O mesmo site publica a coleção em JSON de acesso público (a própria página a carrega, sem login), e foi essa coleção que analisei: texto de introdução, 140 endpoints, parâmetros e exemplos de resposta. Cada afirmação cita o caminho do endpoint como aparece na documentação (ex.: "Receitas > Listar as cobranças de uma unidade"). Os exemplos da documentação trazem tokens e CPFs de demonstração: não copiei nenhum.

---

## 1. Recomendação (primeiro)

1. **Agora: Cenário A (atalho para o portal do Superlógica / Área do condômino).** Horas de trabalho, zero dado financeiro nosso, zero dependência técnica. É a issue #21.
2. **Próximo, só depois de a Garden responder às perguntas da seção 7: Cenário B (consulta somente leitura de boletos em aberto e 2ª via da PRÓPRIA unidade).** A API tem os endpoints para isso. O risco real não é técnico, é de **permissão do token**: ele herda tudo que o usuário da administradora que o criou pode ver (introdução da doc), e a Garden atende vários condomínios.
3. **Cenário C (lançar a taxa de reserva na cobrança do Superlógica): só com demanda concreta e depois do B rodando.** Escreve no financeiro de verdade (gera boleto para o morador). É o que mais pode dar errado.

**O que NÃO fazer:**
- Não pedir nem aceitar um token de um usuário administrador "completo" da Garden. Ele enxerga todos os condomínios da carteira (a confirmar) e dados como CPF, RG, nascimento e dados de cartão (seção 4).
- Não espelhar a base do Superlógica no Supabase (CPF, endereço, histórico de todos). Guardar só o mínimo.
- Não chamar a API pelo navegador, nem colocar token em variável `NEXT_PUBLIC_*`, em log ou no repositório (que é público).
- Não afirmar "pago" ou "em aberto" sem mostrar a data da última consulta (a lição da planilha descartada, `docs/produto.md`).
- Não começar pelo C, nem por qualquer escrita, antes de ter um condomínio de teste.
- Não mostrar situação financeira na lista de unidades (regra já existente em `docs/produto.md`).

---

## 2. Autenticação e credenciais

Fonte: introdução da coleção ("O que é necessário para consumi-la?" e "Formatos básicos").

| Ponto | O que a documentação diz | Status |
|---|---|---|
| Como se obtém | Dentro do ERP: **Todos os usuários (canto superior direito) > API (Integração com outros sistemas) > Aplicativos > Novo App Token**. Gera um `app_token` e um `access_token`. | Documentado |
| Por condomínio ou por administradora | A doc não diz. O token é do **usuário** que o criou ("o token vai herdar os acessos do usuário que criou o token"). Quase todos os endpoints recebem `idCondominio` como parâmetro, então um mesmo token alcança todos os condomínios a que aquele usuário tem acesso. Na prática, **o escopo é o do usuário, tipicamente por licença da administradora**. | Documentado em parte; escopo exato **a confirmar** |
| Quem libera | Quem tem acesso ao ERP com permissão de criar app token: na administradora (Garden), não o síndico (a confirmar se o síndico tem acesso ao ERP). | A confirmar |
| Formato da chamada | `https://api.superlogica.net/v2/condor/CONTROLLER/ACTION`, cabeçalhos `app_token` e `access_token`, `Content-Type` JSON ou `x-www-form-urlencoded`. | Documentado |
| Detalhes que mordem | Datas em **MM/DD/AAAA** (formato americano); nomes de parâmetro **sensíveis a maiúsculas e minúsculas**; paginação por `itensPorPagina` e `pagina`. | Documentado |
| Validade do token | Um resultado de busca que cita a central de ajuda do Superlógica diz que o token **expira em 1 ano**. Não consegui abrir o artigo (a central de ajuda bloqueia leitura automática com verificação anti-robô). | A confirmar; se for verdade, precisa de rotina de renovação e alerta antes de vencer |
| Rate limit | **A documentação não menciona limite de uso.** | A confirmar com a Garden/Superlógica; até lá, projetar com cache e poucas chamadas |
| Sandbox | Não há sandbox público. A doc oferece **teste grátis** ("Experimente grátis" em superlogica.com/condominios) no plano **Enterprise I ou acima**: um ERP de teste nosso, com nossos próprios dados inventados. | Documentado. Útil para a prova de conceito sem tocar na Garden |
| Custo/contrato | A doc não fala em preço da API. Um endpoint ("2ª via por CPF ou CNPJ") é **"somente para planos Enterprise I e acima"**, o que sugere que recursos variam por plano. | A confirmar: se o plano da Garden inclui API e se há custo extra |
| Exemplos na doc que **não** devemos imitar | Um exemplo (Despesas > Listar imposto) põe os tokens na **URL**. Tokens em URL vão para logs e históricos. Usar sempre os cabeçalhos. | Boa prática nossa |

Correção ao estudo anterior: ele dizia "detalhes de endpoint a confirmar" e que o escopo do token poderia ser só leitura. **A doc não oferece token "só leitura"**: o limite vem das permissões do usuário do ERP que o cria. A forma de conseguir leitura restrita é a Garden criar um **usuário dedicado** (ex.: "Harmony") com permissão só de consultar e, se o Superlógica permitir, só do Harmony Residence. Se não der para restringir, isso é critério de parada.

---

## 3. O que a API expõe e interessa ao Harmony

Base: `https://api.superlogica.net/v2/condor/`. Os nomes entre parênteses são o caminho na documentação. Respostas vêm em JSON com nomes em minúsculas e **valores em texto** (ex.: `"vl_total_recb": "75.00"`; datas como `"03/05/2016 00:00:00"`).

### 3.1 Segunda via e linha digitável
- **Gerar link de 2ª via** (2a via > "Gerar link para download de 2a via de boleto"): `GET cobranca/gerarlinksegundavia`. Parâmetros: `ID_CONDOMINIO_COND`, `ID_RECEBIMENTO_RECB` (id da cobrança), `DT_VENCIMENTO_RECB`, `DT_ATUALIZACAO_VENCIMENTO` (nova data, para boleto vencido atualizado). A resposta de exemplo da doc está vazia; **o formato do retorno (link direto? JSON?) fica a confirmar**. Observação da doc: a disponibilidade depende de configurações da Área do condômino ("Dias para indisponibilizar 2ª via", "Disponibilizar 2ª via após quantos dias da geração"), então boleto muito antigo ou recém-gerado pode não ter link.
- **2ª via por e-mail** (2a via > "2a via por CPF ou CNPJ"): `GET http://SUALICENCA.superlogica.net/condor/atual/publico/emailcobrancasemaberto?cpf=...`. Endpoint **público** (sem token, no domínio da licença), só planos Enterprise I+, que **envia por e-mail uma mensagem por cobrança pendente** para o e-mail cadastrado. Não devolve dados ao Harmony. Serve como "me mande a 2ª via por e-mail", sem o Harmony tocar em dado financeiro. Atenção: usa `http` na doc e recebe CPF na URL; se usarmos, só pelo servidor e a confirmar se existe `https`.
- **Linha digitável / código de barras / Pix:** nos exemplos de resposta de cobrança **não encontrei campo de linha digitável nem de Pix**. A forma de entregar o boleto parece ser o link da 2ª via. **A confirmar** com o Superlógica se algum campo ou endpoint traz a linha digitável.

### 3.2 Cobranças (boletos) e situação por unidade
- **Listar cobranças de uma unidade** (Receitas > "Listar as cobranças de uma unidade"): `GET cobranca/index`. Parâmetros: `idCondominio`, `UNIDADES[0]` (id da unidade), `status` (`liquidadas`, `canceladas`, `pendentes`, `protestadas`, `remetidascartorio`, `indisponiveisonline`, `validos`), `dtInicio`, `dtFim`, `itensPorPagina`, `pagina`, `apenasColunasPrincipais=1`, `comContatosDaUnidade`. Campos úteis: `id_recebimento_recb` (id da cobrança), `st_documento_recb`, `dt_vencimento_recb`, `dt_competencia_recb`, `vl_emitido_recb`, `vl_total_recb` (com encargos), `fl_status_recb`, `dt_liquidacao_recb`/`dt_recebimento_recb`, `st_unidade_uni`, `st_bloco_uni`, `id_unidade_uni`, `id_reserva_res`. O significado de cada valor de `fl_status_recb` **não está explicado na doc** (aparecem `0` e `4` nos exemplos): usar o parâmetro `status` em vez de interpretar o número, ou **confirmar**.
- **Detalhe de um boleto** (Receitas > "Informações de um boleto específico"): `GET cobranca/index?idCondominio=&id=&comDadosDasApropriacoes=1&comDadosDasContasEReceitas=1`. Traz as parcelas internas (`receita_apropriacao`: conta, descrição, valor) e datas.
- **Listar cobranças por período** (Receitas > "Listar cobranças por período"): mesmo `cobranca/index`, sem filtro de unidade. Com `comDadosDasUnidades` e `exibirDadosDoContato` devolve dados pessoais do contato (nome, CPF, endereço, telefone, e-mail, dados bancários). **Não usar essas opções.**

### 3.3 Inadimplência
- **Por unidade** (Receitas > Acordos > "Listar inadimplência de uma unidade"): `GET inadimplencia?id=&idCondominio=&status=todos|inadimplente|adimplente&comValoresAtualizados=true`. Traz cobranças vencidas com valor atualizado e (na amostra) também os contatos da unidade.
- **Por período** (Receitas > "Listar inadimplência por período"): `GET inadimplencia/index?posicaoEm=&idCondominio=&apenasResumoInad=...`. O parâmetro `apenasResumoInad` sugere uma visão resumida, **a confirmar**. É uso do síndico/administração, nunca do morador.
- A unidade também tem `fl_statusfin_uni` (status financeiro) na listagem de unidades: o sentido dos valores **não está explicado**.

### 3.4 Histórico de pagamentos
- Não há endpoint "histórico do morador". Obtém-se com `cobranca/index?status=liquidadas` por unidade e período (campos `dt_liquidacao_recb`, `dt_recebimento_recb`, `vl_total_recb`). Existe também **CRM de Cobrança** (listar históricos e agendamentos em `historicocobranca/index`): é registro interno de cobrança da administradora. **Não interessa ao Harmony e é sensível.**

### 3.5 Extrato e prestação de contas
- **Prestação de contas** (Prestação de contas > "Listar relatórios", "Gerar relatório em HTML"): `GET relatorios` e `GET relatorios?id=015A&getId=1`; a resposta de exemplo traz só `id_impressao`, ou seja, **gera um relatório na fila de impressão da administradora**, não um JSON de saldos. Sai como documento (HTML/PDF a confirmar).
- **Relatórios** (Relatórios > "W011A - Demonstrativo de receitas e despesas anual" = `balancetes/index`, W025A/W046A previsão orçamentária) e **Documentos** (Documentos e Arquivos > "Listar os documentos de um condomínio" = `impressoes/index` com `publicadoApenasPara=condominos`, e "Download arquivo" com `id` e `hash`). Caminho mais seguro para o morador: **listar apenas documentos já publicados para condôminos** e baixá-los pelo servidor.
- **Contas bancárias** (Condomínios > Contas bancárias > "Obter saldo", "Listar movimentações"): saldo e movimentos do condomínio. Dado do condomínio, não do morador; só gestão, e só se o dono quiser.

### 3.6 Unidades, moradores e proprietários
- **Listar unidades** (Unidades > "Listar unidades de um condomínio"): `GET unidades/index?idCondominio=&itensPorPagina=&pagina=`. Chave: `id_unidade_uni`; identificação: `st_bloco_uni` + `st_unidade_uni`; proprietário: `id_proprietario`, `nome_proprietario`, `email_proprietario`, `telefone_proprietario`, `celular_proprietario`; `vl_credito_uni`, `fl_statusfin_uni`, `fl_unidade_vazia_uni`. Dentro de `contatos` vêm **muito mais dados** (ver seção 4).
- **Responsáveis legais** (Responsáveis Legais > "Listar os responsáveis legais", `sindicos`) e **condôminos** (Solicitações > "Listar condôminos", `responsaveis/index`): quem é síndico, subsíndico, conselheiro. Não precisamos: o Harmony tem seus próprios perfis.
- A API **escreve** unidades e contatos (Unidades > "Cadastrar", "Editar", "Excluir"). **Nunca** usar: o cadastro mestre é da administradora.

### 3.7 Comunicados
- Só **cria** (Comunicados > "Criar novo comunicado": `POST comunicados/`, campos `ST_TITULO_COM`, `ST_TEXTO_COM` em HTML, `ID_CONDOMINIO_COND`, `FL_DESTINATARIO_COM` com valores 1 a 4 para unidades/responsáveis legais/todos) e "Disparar comunicados pendentes". **Não há endpoint para listar comunicados.** Não aparece caminho de leitura para trazer o mural da administradora ao Harmony. A "mão dupla" do mural não é viável pela API pública (a confirmar se existe outro endpoint não documentado). Também seria risco: o Harmony publicando em nome do condomínio pela conta da administradora.

### 3.8 Reservas de áreas comuns (existe)
- **Listar áreas** (Reservas > "Listar áreas comuns": `reservas/areas?idCondominio=`) e **reservas** (`reservas/areasreservas?idCondominio=&idArea&status`). Campos da área: `id_area_are`, `st_nome_are`, `st_regras_are`, `vl_valor_rec` (valor da reserva), `fl_cobranca_are` (a área gera cobrança), `fl_bloquearinad_are` (bloqueia inadimplente), `fl_confirma_reserva_are`, `fl_confirmareservaauto_are`, `nm_antecedencia_are`, `nm_disponibilizardias_are`, `nm_diasvencimentocobranca_are`, `id_contabanco_are`, dias da semana permitidos. Campos da reserva: `id_reserva_res`, `id_area_are`, `id_unidade_uni`, `dt_reserva_res`, `fl_status_res`, `nm_fila_res` (fila de espera), `st_motivocancelamento_res` (ex.: "Inadimplente"), **`id_recebimento_recb`** e **`id_receita_rec`** (a cobrança gerada), `vl_admvalorreserva_res`, `st_reservadopor_res`.
- **Reservar** (`POST reservas/`): `ID_CONDOMINIO_COND`, `ID_UNIDADE_UNI`, `ID_AREA_ARE`, `DT_RESERVA_RES`, `FL_NAO_NOTIFICAR_CONDOMINO`, `FL_RESERVA_JA_CONFIRMADA`, **`VL_ADMVALORRESERVA_RES`** ("valor a ser cobrado pela administradora pela reserva; por padrão usa o valor registrado na área"). **Cancelar** (`PUT reservas/cancelar`, exige `ST_MOTIVOCANCELAMENTO_RES`) e **confirmar** (`PUT reservas/reserva`, `FL_STATUS_RES=1`).
- **Como o valor viraria lançamento (a confirmar na prática):** há dois caminhos possíveis. (a) Reservar pelo endpoint do Superlógica com `VL_ADMVALORRESERVA_RES`; a área configurada com `fl_cobranca_are=1` e a conta/receita certas faria o Superlógica gerar a cobrança, e o vínculo ficaria em `id_recebimento_recb`/`id_receita_rec`. (b) Criar uma **cobrança avulsa** (item 3.9). Caminho (a) significa **duplicar a reserva nos dois sistemas**: o Harmony tem regras próprias (faixa de pessoas, higienização, aprovação, bloqueio entre espaços, migrações 0034 a 0039) que o Superlógica não tem, e a taxa do Harmony é calculada no banco (`valor_uso`, `taxa_higienizacao`, migração 0039). O Superlógica vira um segundo dono da reserva. **Preferir (b)**, ou nenhum dos dois, e deixar a reserva só no Harmony.
- Importante: a doc mostra que o Superlógica **cancela reserva de inadimplente** e pode bloquear (`fl_bloquearinad_are`). O Harmony hoje não sabe disso. Fica como pergunta (seção 7).

### 3.9 Taxas extras e lançamentos avulsos
- **Cadastrar nova cobrança** (Receitas > "Cadastrar nova cobrança": `POST cobranca/`). Obrigatórios: `ID_CONDOMINIO_COND`, `ID_UNIDADE_UNI`, `DT_VENCIMENTO_RECB`, `RECEITA_APROPRIACAO[0][ST_CONTA_CONT]` (conta/categoria, ex. de receita), `RECEITA_APROPRIACAO[0][VL_VALOR_REC]`, `VALOR_TOTAL`, `ID_CONTABANCO_CB`. Opcionais: parcelas, juros/multa/desconto próprios (`ALTERAR_ENCARGOS`), `ID_FORMAPAGAMENTO_RECB`, `DT_COMPETENCIA`. Resposta: `status`, `msg`, `unidade`, `bloco`, **`id_cobranca`**. Também existem editar, liquidar, estornar, invalidar e excluir cobrança.
- **Riscos:** cria débito real para um morador real, gera boleto e pode pesar na inadimplência. **Não há campo de idempotência** na doc (reenviar a mesma chamada, por timeout, pode duplicar a cobrança). Mitigação: gravar no Harmony o `id_cobranca` e um estado "enviando" antes, e **conferir antes de reenviar**. Exige também que a Garden diga qual conta (`ST_CONTA_CONT`) e conta bancária usar.

### 3.10 Outros pontos que a doc oferece e **não** vamos usar
Acordos e processos judiciais, retorno bancário, despesas, fornecedores, plano de contas, consumo (água/gás), tickets, ocorrências (inclusive "Imprimir carta"). São da operação da administradora. Notar: **Ocorrências/Tickets** poderiam ter sinergia com multas do Harmony, mas mexer nisso é fora de escopo e a decisão de produto é não duplicar o sistema deles.

### 3.11 Área do condômino (autenticação com e-mail e senha do morador)
A coleção documenta uma autenticação da **Área do condômino** em `https://LICENCA.superlogica.net/areadocondomino/atual/publico/auth`, com `email`, `senha` e `gerarToken=1`, que devolve um token por usuário-morador, e depois consultas como `.../cobranca` (Área do condômino > "Exemplo para autenticação", "Autenticação utilizando o token", "Exemplo de requisição após autenticado").
Isso permitiria o morador "entrar no Superlógica" pelo Harmony, mas obrigaria o Harmony a **receber a senha do morador no Superlógica**. **Não fazer**: o Harmony nunca deve manusear senha de outro sistema.

---

## 4. Webhooks/eventos versus polling

- **A documentação não descreve nenhum webhook ou evento** (pagamento confirmado, boleto emitido). Não há seção, parâmetro ou endpoint de cadastro de callback. O que existe: o endpoint "Retorno > Processar arquivo retorno" (`retorno/put`), que é para **enviar** o arquivo de retorno bancário, e "Comunicados > Disparar comunicados pendentes", que é saída para moradores. Uma ferramenta de integração de terceiros (Pluga) cita webhooks do **Superlógica Assinaturas**, produto diferente; não vale para o Condomínios.
- **Conclusão: planejar com polling**, e tratar a existência de webhook como "a confirmar" com a Garden/Superlógica.
- **Desenho de polling (sugestão):**
  - Consulta **sob demanda** quando o morador abre a tela "Meus boletos" (1 chamada por unidade, `status=pendentes` e depois `liquidadas` sob pedido), com **cache curto** (ex.: 10 a 15 minutos, "a decidir") e mostrando "atualizado há X min".
  - Sem varredura de todas as unidades por tempo (evita estourar um limite que nem conhecemos, e evita guardar a base inteira).
  - Se for necessário aviso de vencimento por WhatsApp (hipótese em aberto de `docs/produto.md`), uma rotina diária por unidade com cobrança a vencer; ainda é decisão de produto.
- **Se algum dia houver webhook**: rota própria com segredo comparado em tempo constante e tabela de eventos com id único para idempotência (mesmo padrão da pesquisa anterior).

---

## 5. Segurança e LGPD

### 5.1 O que transita
Resposta de "Listar unidades" (`contatos`) inclui por contato: nome, telefone, e-mail, endereço, CEP, **CPF, CNPJ, RG, data de nascimento**, e **campos de dados bancários e de cartão** (`st_banco_con`, `st_agencia_con`, `st_contabancaria_con`, `nm_cartao_con`, `st_cartaobandeira_con`, e na ligação com a unidade `nm_cartao_resp`, `nm_mescartaovencimento_resp`, `nm_anocartaovencimento_resp`, `nm_cartaocodseg_resp`), além de `st_senha_site_uni` na unidade. Os valores podem vir vazios, mas **os campos existem**: se vierem preenchidos, o Harmony passaria a receber dado que **nunca deveria tocar**. A listagem de cobranças por período também devolve contato com CPF e endereço quando se pede `exibirDadosDoContato`.

### 5.2 Regras para o Harmony
1. **Minimização por projeção.** Na rota de servidor, ler a resposta e **copiar para o objeto de saída só campos de uma lista fixa** (id da cobrança, vencimento, valor, status, competência, id da unidade). Descartar o resto antes de qualquer log, cache ou resposta. Nunca repassar o JSON do Superlógica ao navegador. Usar `apenasColunasPrincipais=1` e não pedir `comContatosDaUnidade`, `comDadosDasUnidades`, `exibirDadosDoContato`.
2. **Credenciais.** `app_token` e `access_token` só como variáveis de ambiente do servidor (Vercel, escopo de produção, e outro par para staging), nunca em `NEXT_PUBLIC_*`, nunca no repositório (é público), nunca em log, resposta ou mensagem de erro. Se um dia houver vários condomínios, tokens por condomínio em tabela **cifrada** e lida só pela service role. Rotina de renovação (validade de 1 ano, a confirmar). Se um token vazar: revogar na tela de aplicativos do ERP (a confirmar) e trocar na Vercel. O `idCondominio` do Harmony Residence fica em variável de ambiente, **nunca vindo do navegador**.
3. **Armazenar versus consultar na hora.**
   - **Armazenar (mínimo):** o vínculo `unit_id` do Harmony para `id_unidade_uni` do Superlógica (e `id_condominio_cond`); no máximo, para cache de boleto: id da cobrança, vencimento, valor, status, data da última sincronização. Sem CPF, sem endereço, sem dados de contato do Superlógica, sem linha digitável persistida.
   - **Consultar na hora:** link de 2ª via (expira por configuração da área do condômino), situação, histórico. Não guardar o link da 2ª via.
4. **Entre moradores (o risco principal).** A rota de servidor usa token com acesso amplo, **que ignora o RLS do Supabase**. O RLS não protege esse caminho: a proteção tem que ser **código**. Regra: a rota valida a sessão, descobre a unidade **pelo banco** (`units.usuario_id` do usuário logado, ou a unidade que o perfil de gestão escolheu e tem direito de ver), pega o `id_unidade_uni` **gravado no nosso banco** e **nunca aceita `bloco`, `numero` ou `id_unidade_uni` vindos do cliente**. Depois da resposta, **conferir que cada cobrança devolvida pertence à `id_unidade_uni` esperada** antes de enviar. Perfil Portaria e Conselho: sem acesso (decisão a confirmar pelo dono, como na pesquisa anterior). Morador provisório: sem acesso.
5. **No Supabase.** Se criar tabela de vínculo ou cache: RLS ligado, `GRANT` revisado (nada de escrita pelo cliente; Supabase dá ALL por padrão), morador lê só a linha da própria `unit_id`, gestão (`is_admin()`) lê as da unidade. Nunca pôr situação financeira na lista de unidades nem no `get` geral de `units`.
6. **Auditoria.** Registrar no histórico (servidor, não navegador) quem consultou ou gerou 2ª via de qual unidade, sem valores. Para escrita (Cenário C), registrar quem lançou o quê.
7. **Falha segura.** Se a API cair, expirar ou o token for revogado: tela "não foi possível consultar agora", com o atalho do portal da administradora (Cenário A). Nunca mostrar dado velho como atual.
8. **LGPD (a confirmar com advogado).** Situação financeira individual é dado pessoal e revela inadimplência. O Harmony passa a ser **operador/controlador de mais um dado** vindo de outra empresa: precisa de base legal, de aviso ao morador, e de acordo (DPA ou cláusula) com a Garden e com o Superlógica. A Garden é a controladora desse dado; sem autorização dela, não usar. A API do Superlógica fica nos servidores deles (região a confirmar).
9. **Dados de cartão: nunca.** Se aparecer valor nos campos `nm_cartao_*`/`nm_cartaocodseg_*`, **descartar e avisar a Garden** (é problema do cadastro deles). Pode ser incidente de segurança para eles.

---

## 6. Mapeamento unidade e morador (Harmony x Superlógica)

**Situação no Harmony.** `units` tem `id` (texto), `bloco` e `numero` (textos livres, único por par), `proprietario_nome/telefone/email`, `usuario_id` (conta do morador). Não existe chave do Superlógica.

**No Superlógica.** A unidade tem `id_unidade_uni` (numérico, estável), `id_condominio_cond`, `st_bloco_uni` e `st_unidade_uni` (textos; ex.: "A", "001"), e `st_identificacao_uni` (a confirmar o que é).

**Chave de integração:** `id_unidade_uni` (e `id_condominio_cond`). Não usar nome, e-mail nem `bloco+numero` como chave de consulta.

**Como ligar (sugestão):**
1. Uma tabela de vínculo (ex.: `unit_id` do Harmony, `superlogica_id_unidade`, `superlogica_id_condominio`, quem vinculou, quando, status) com RLS fechado para morador (só a gestão escreve, e só pelo servidor).
2. **Carga inicial semi-automática, com conferência humana:** a rota de servidor lista as unidades do condomínio (`unidades/index`) usando só os campos `id_unidade_uni`, `st_bloco_uni`, `st_unidade_uni`; o Harmony propõe pares por `bloco+numero` **normalizado** (maiúsculas, sem espaços, zeros à esquerda); o **síndico confirma** cada vínculo numa tela de gestão. Cada vínculo é gravado depois da confirmação, não automaticamente.
3. **Teste de coerência:** só aceitar o vínculo se o nome do proprietário (ou o e-mail) de lá "parecer" com o daqui; mostrar a diferença ao síndico, nunca decidir sozinho. Não guardar o nome de lá.

**Riscos de divergência.**
- Formatação diferente ("101" x "0101", "Bloco A" x "A"): por isso normalização + confirmação.
- Mudança de proprietário ou inquilino no Superlógica: o Harmony não saberia. O vínculo é da **unidade**, não da pessoa: a pessoa que vê o boleto é a que o Harmony já valida como moradora daquela unidade. **Atenção a inquilino:** o boleto costuma ser do proprietário; o morador inquilino não deveria ver o financeiro do proprietário por padrão (a confirmar com a Garden/síndico quem recebe o boleto).
- Unidade renumerada, desmembrada ou unificada: o vínculo precisa ser revisto; checar na própria listagem se `id_unidade_uni` ainda existe, e **bloquear a consulta** se a conferência falhar.
- Morador com **mais de uma unidade** (etapa 2 em `docs/produto.md`): cada unidade tem seu vínculo; a tela tem que deixar explícito qual unidade está sendo vista.

**Unidade sem correspondência.** Fica **sem vínculo** e a tela mostra apenas o atalho do portal (Cenário A), sem mensagem de erro assustadora. A gestão vê uma lista "unidades sem vínculo". Nunca "chutar" a correspondência mais parecida. O inverso (unidade no Superlógica sem equivalente no Harmony) aparece só para a gestão e não é importada sozinha.

---

## 7. Três cenários de integração

| | **A. Atalho para o portal** | **B. Consulta somente leitura** | **C. Lançamento da taxa de reserva** |
|---|---|---|---|
| O que é | Botão "Boletos e 2ª via" que abre o portal do condômino (Área do condômino do Superlógica, ou o que a Garden indicar) | O Harmony mostra boletos em aberto e liquidados da própria unidade, com botão de 2ª via; opção "enviar 2ª via por e-mail" via endpoint público | Ao aprovar uma reserva com valor, o Harmony cria uma cobrança na unidade no Superlógica |
| Endpoints | Nenhum | `cobranca/index` (por unidade), `cobranca/gerarlinksegundavia`, `unidades/index` (só para vincular), opcional `emailcobrancasemaberto` | B mais `POST cobranca/` (e eventualmente `reservas/`) |
| Esforço relativo (suposição) | P: horas | M: 1 a 2 semanas após a Garden liberar token e condomínio de teste; mais a tela de vínculo (cerca de mais 2 a 3 dias) | G: semanas, mais teste de duplicidade, estorno, cancelamento de reserva que já gerou cobrança |
| O que entrega ao morador | Vai direto ao lugar onde já paga | Vê boleto e situação no app; menos perguntas ao síndico | Taxa de reserva cobrada no mesmo boleto/condomínio, sem controle manual |
| Riscos | Baixo. O portal pode pedir login separado | Médio-alto: token amplo, dado financeiro de um morador a outro (seção 5), dado velho, dados pessoais na resposta, limite de uso desconhecido, token vencendo em 1 ano | Alto: escreve dinheiro real; sem idempotência na doc; cancelar reserva exige estornar/invalidar cobrança (`cobranca/estornar` ou `/update`); conflito de "dono" da reserva; o morador discute a cobrança com a Garden |
| Depende da Garden | Só do link correto | Usuário dedicado e token; permissão de leitura; condomínio de teste; autorização para o Harmony mostrar aos moradores; plano com API | Tudo do B, mais conta/categoria de receita, conta bancária, regra de vencimento, quem trata a cobrança e quem estorna |
| Não depende do Superlógica | Sim | Não | Não |

**Por onde começar:** Cenário A agora (issue #21). Em paralelo, o dono leva as perguntas abaixo. Só com as respostas, uma **prova de conceito** do B contra um **condomínio de teste** (o teste grátis do Superlógica, plano Enterprise I ou acima, com dados inventados, ou um condomínio fictício que a Garden crie), com script isolado em `scripts/` que lista cobranças e imprime só campos permitidos. Sem condomínio de teste, **parar**: não usar dado real de morador.

**Critérios de parada para o B:** (1) o plano da Garden não inclui API; (2) não dá para limitar o usuário do token a leitura e ao Harmony Residence; (3) o contrato proíbe repassar boleto ao morador; (4) a resposta de unidades/cobranças traz dado de cartão preenchido que não dá para filtrar (nós filtramos, mas a Garden precisa saber); (5) sem limite de uso confirmado e a Garden preocupada com carga.

---

## 8. Perguntas para o dono levar à Garden (linguagem simples)

1. **Qual é o plano de vocês no Superlógica Condomínios** (a API pode depender do plano)? Dá para vocês criarem um "acesso de integração" (token de API) para um sistema de fora? Isso tem custo ou precisa de contrato novo?
2. **Podem criar um usuário só para o Harmony**, que enxergue apenas o Harmony Residence e só consulte (sem alterar nada)? Se não for possível limitar ao nosso condomínio, quais outros condomínios esse acesso enxergaria?
3. **Vocês autorizam o Harmony a mostrar aos moradores** o boleto em aberto e a 2ª via da própria unidade? Algum problema legal ou de contrato?
4. **Existe um condomínio de teste** (ou podem criar um) com 2 unidades e alguns boletos inventados, para testarmos sem mexer em dado de morador?
5. **Quem recebe o boleto: o proprietário ou o inquilino?** O inquilino pode ver o boleto do apartamento?
6. **O Superlógica avisa o Harmony quando alguém paga** (um aviso automático) ou temos que ir perguntando? Tem limite de consultas por minuto/dia?
7. **A taxa de reserva de espaço (churrasqueira, salão):** hoje vocês cobram no boleto do condomínio? Como lançam (qual conta/categoria)? Preferem que o Harmony só avise vocês, ou que ele lance direto no sistema?
8. **O Superlógica de vocês bloqueia reserva de quem está inadimplente?** Querem que o Harmony faça o mesmo?
9. **Qual é o endereço do portal de 2ª via dos moradores?** (para o botão do Cenário A) E o morador usa e-mail e senha do Superlógica para entrar?
10. **A numeração de unidades no Superlógica** ("101", "A-101", "Bloco A apto 101") segue a mesma que o condomínio usa no dia a dia? Dá para nos mandar a lista de unidades (só numeração, sem nome de morador)?

---

## 9. O que ficou inacessível ou "a confirmar"

- **Central de ajuda do Superlógica** (condominios.superlogica.com/hc, artigos sobre criação de token): bloqueada por verificação anti-robô (HTTP 403). A validade de **1 ano** do token vem de um resumo de busca; **a confirmar**. Não consegui ler a política de uso, limites, planos e preços.
- **Página principal da API**: só abre com JavaScript. Li a coleção JSON pública que ela própria carrega; **não executei chamadas autenticadas** nem testei respostas reais, então **formatos reais, mensagens de erro, paginação, limites e latência não foram verificados**.
- **Não achei na documentação:** rate limit, webhooks, sandbox público, significado completo de `fl_status_recb`/`fl_statusfin_uni`, formato da resposta de `gerarlinksegundavia`, campo de linha digitável ou Pix, como revogar token, se o escopo é por condomínio.
- Que a Garden usa Superlógica está **confirmado pelo dono**; falta confirmar o plano, quem libera o token e o escopo dele.
- Os exemplos da documentação contêm tokens e CPFs de demonstração; foram ignorados e não aparecem aqui.

## Fontes
- Documentação oficial (Postman, coleção pública): https://apicondominios.superlogica.com/ — seções citadas pelo nome ao longo do texto: introdução, Unidades, Receitas, Reservas, 2a via, Comunicados, Prestação de contas, Relatórios, Documentos e Arquivos, Área do condômino, CRM de Cobrança, Ocorrências.
- Referência indireta (não consegui abrir; apenas resumo de busca): central de ajuda "Como cadastrar os aplicativos e gerar App Token e Access Token para Integração com a API da Superlógica", https://condominios.superlogica.com/hc/pt-br/articles/16951589154583
- Contexto interno: `docs/produto.md`, `docs/pesquisas/2026-10-04-integracao-financeiro.md`, `supabase/baseline.sql` (tabelas `units`, `reservations`), migrações 0034 a 0039 (reservas).
