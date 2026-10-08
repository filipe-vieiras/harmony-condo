# Revisão de segurança: perfil de Zelador (fase 1, issue #82)

Data: 06/10/2026 · Escopo: migração 0041, rotas de API, `roles.ts`, `cargos.ts`, `acessoRemovido.ts`, `interdicao.ts`,
Sidebar/AppShell, seed e bateria do Zelador · Ambiente de teste: somente staging (contas `@staging.test`).
Produção não foi tocada. Este arquivo é local e sem commit; não cite a auditoria geral anterior em nada que vá ao repositório público.

## Resultado

**Não há falha Crítica nem Alta introduzida pelo perfil de Zelador.** O núcleo (RLS por perfil, singleton, conta desativada,
interdição só por função, reserva só status/parecer, trava de unidade) segurou em todos os testes por API com o token de cada
perfil. Há achados Médios e Baixos de endurecimento, listados abaixo. A issue #68 (hierarquia do Subsíndico) segue aberta e
continua sendo a maior exposição do sistema, por razão que independe do Zelador.

| Severidade | Quantidade |
|---|---|
| Crítica | 0 |
| Alta | 0 (a #68, já conhecida e aberta, é Alta e não está contada aqui) |
| Média | 3 |
| Baixa | 4 |
| Informativa | 4 |

Legenda: **[T]** confirmado por teste no staging · **[C]** suspeita lida no código · **[N]** não testado.

## O que foi verificado e segurou [T]

- Leitura por perfil (Zelador, Subsíndico, Conselho, Portaria, Morador, provisório, conta sem perfil, anônimo) em todas as 20 tabelas
  do schema `public`: o Zelador não lê auditoria, multas, convites, transferências de cargo, autocadastros, documentos do titular
  nem perfis de terceiros. Em `units` ele lê nome, telefone, e-mail e dependentes, sem documento (nenhuma chave de documento no JSON).
- Escrita do Zelador: não altera perfil (nem o próprio papel), não cria perfil, convite, transferência, multa, unidade, link ou
  documento, não edita nem apaga espaço, não apaga reserva, não edita aviso de outro nem veículo.
- Funções de cargo (`transferir_cargo`, `iniciar_`, `cancelar_`, `aceitar_`, `encerrar_sessoes_usuario`, `reativar_acesso_zelador`,
  `_trocar_cargo`, `_avisar_usuario`): EXECUTE só do service role; chamadas com token de usuário voltam 403.
- `interditar_espaco`: Zelador, Subsíndico (e gestão) podem; Conselho, Portaria, Morador, provisório e anônimo recebem 403. Altera só
  ativo e motivo, audita com autor, motivo acima de 140 é recusado, quebras de linha e tabulação viram espaço, reabrir limpa o motivo.
  Escrita direta em `spaces.ativo` e `spaces.motivo_interdicao` é barrada pelo gatilho, inclusive para a gestão. Novo pedido em espaço
  interditado é recusado pelo banco para todos os perfis.
- Reserva: o Zelador não consegue alterar valor, taxa, convidados, data, horário, espaço, unidade, nome nem id; só status
  (APROVADA, RECUSADA, CANCELADA) e parecer. Não apaga.
- Conta desativada (ex-Zelador): com o token antigo ainda válido, toda leitura volta vazia, toda escrita é negada e as funções
  respondem sem permissão; o Auth derruba a sessão (token e refresh invalidados), o login com a senha certa é recusado e a
  recuperação de senha também. O perfil pendente do convidado nasce desativado e não lê nada antes do aceite.
- Singleton: 5 rodadas de 2 transferências simultâneas do cargo (uma vencedora, a outra recebe pendência existente) e 5 rodadas de 2
  convites simultâneos com o cargo vago (um criado, o outro recusado pelo índice único); nunca houve dois Zeladores ativos.
- Trava de unidade: ligar conta Zelador a unidade (REST pela gestão, atualização de perfil, promover Morador com unidade) é barrado
  pelo banco; Morador existente não vira Zelador por transferência nem por convite (código `cargo_invalido` e `email_com_conta`).
- Reativar: só Síndico e ADM (Subsíndico, Conselho e o próprio Zelador recebem 403), só com o cargo vago, idempotente sob duas
  chamadas simultâneas; o ban do Auth sai e o login volta a funcionar.
- `tem_perfil_operacao()`: SECURITY DEFINER com `search_path` fixo, usada em uma única policy (atualização de reservas) e em
  `interdicoes_atuais`; não aparece em tabela sensível e não gera recursão.
- Renderização do motivo: sempre como texto (React), nenhum `dangerouslySetInnerHTML`/`innerHTML` no código; o link do anexo do
  mural só vira link com http(s).

## Achados

### Z-01 · Média · Parecer da reserva sem integridade nem auditoria no servidor [T]
**Onde:** `reservations_zelador_so_decide` (0041) e a auditoria feita no navegador.
**Evidência:** o Zelador, por API direta, grava `avaliado_por` e `data_avaliacao` com o valor que quiser (inclusive o nome de outro
perfil ou o marcador de aprovação automática) e `motivo_recusa` com texto longo sem limite. A tela do morador mostra "Confirmada por
{avaliado_por}". Aprovar, recusar ou cancelar por API direta não gera linha de auditoria nem aviso ao morador (isso é feito pelo cliente).
**Impacto:** quem decidiu a reserva pode ser falsificado; a exigência do PRD de "mesma auditoria" não é garantida pelo banco.
**Correção:** no gatilho, quando o papel é Zelador, sobrescrever `avaliado_por` com `nome (ZELADOR)` do perfil e `data_avaliacao` com
`now()` a cada mudança de status, limitar `motivo_recusa` a um tamanho razoável (ex.: 300) e gravar a linha em `audit_logs`
dentro do próprio gatilho (SECURITY DEFINER). **Esforço:** P a M.
**QA confirma:** PATCH direto como Zelador com `avaliado_por` de outro nome termina com o nome do Zelador; mudar status por API
direta deixa uma linha de auditoria; `motivo_recusa` acima do limite é recusado.

### Z-02 · Média · Zelador publica texto livre para todos além do que o PRD prevê [T]
**Onde:** `notices_insert_zelador` e `notifications_insert` (ramo AVISO do Zelador).
**Evidência:** o Zelador cria aviso da categoria URGENTE, com anexo apontando para qualquer endereço https (aparece como link no
mural) e sem limite de tamanho; e grava notificação AVISO para todos os moradores com título e mensagem livres, sem aviso nenhum
publicado (o PRD diz "formas fixas, nada de aviso livre para todos"). A notificação RESERVA também aceita texto livre para
qualquer unidade.
**Impacto:** perfil externo e de alta rotatividade vira canal de phishing/boato para o condomínio inteiro.
**Correção:** policy do Zelador só com categorias COMUNICADO e MANUTENCAO, `anexo_url` nulo, limites de tamanho de título e
conteúdo; remover o ramo AVISO livre da policy e gerar o sino por gatilho em `notices` (texto fixo "Novo comunicado: {título}");
restringir a notificação RESERVA à unidade de uma reserva que o Zelador acabou de decidir. **Esforço:** M.
**QA confirma:** como Zelador, POST de aviso URGENTE, com anexo ou gigante falha; POST de notificação AVISO avulsa falha; publicar
aviso normal continua gerando o sino.

### Z-03 · Média · Texto livre em `audit_logs` chega ao CSV de auditoria sem neutralização (pré-existente) [T]
**Onde:** `audit_logs_insert_proprio` e `exportarAuditoriaCSV` em `relatorios/page.tsx`.
**Evidência:** qualquer perfil com conta, inclusive Morador e Zelador, grava linha própria com `acao` livre; o CSV exportado por
Síndico/Conselho não prefixa células que começam com `=`, `+`, `-`, `@`.
**Impacto:** injeção de fórmula na planilha de quem exporta a auditoria; o Zelador acrescenta mais um perfil externo ao risco.
**Correção:** prefixar com apóstrofo as células que começam com esses caracteres (e tab/CR) no export; opcionalmente fixar `modulo`
e limitar o tamanho de `acao` na policy. **Esforço:** P. **QA confirma:** auditoria com `acao` começando em `=` sai no CSV como texto.

### Z-04 · Baixa · Convite do Zelador pela fila já cria a conta ativa antes do aceite [T]
**Onde:** `api/convites/enviar` (insere o perfil ZELADOR ativo e validado ao gerar o link).
**Evidência:** pelo caminho da transferência o perfil do convidado nasce desativado e só ativa no aceite (testado); pela fila de
convites, usada quando o cargo está vago, o perfil já nasce Zelador ativo. Não há login sem o link, mas quem tiver o link vira Zelador.
**Correção:** criar desativado no `enviar` para ZELADOR e ativar no aceite (mesmo caminho do aceite de cargo). **Esforço:** M.

### Z-05 · Baixa · Motivo da interdição aceita caracteres Unicode de direção e largura zero [T]
**Onde:** `interditar_espaco` (`[[:cntrl:]]` só cobre caracteres de controle).
**Evidência:** override de direção (U+202E) e espaço de largura zero (U+200B) são gravados e aparecem para todos os moradores.
**Correção:** remover U+200B a U+200F, U+202A a U+202E, U+2066 a U+2069 e U+FEFF na função (e no `normalizarMotivo` da tela). **Esforço:** P.

### Z-06 · Baixa · LGPD: o Zelador lê mais do que a operação precisa [T para a leitura, C para a tela]
**Evidência:** `units` inteiro vai ao Zelador: telefone e e-mail do proprietário que não mora na unidade, observações, animais,
vínculo de conta e status de convite, sem janela de tempo. A tela "Moradores & Unidades" oferece "Imprimir Relação" ao Zelador, uma
saída em massa em papel/PDF sem registro. Nada disso contém documento.
**Correção:** esconder a impressão para o Zelador; expor ao Zelador só os campos necessários por função/visão mínima em vez de
`units`; termo de ciência e confidencialidade no primeiro acesso; registrar quem consulta em massa se houver necessidade. Base
legal e proporcionalidade: a confirmar com advogado. **Esforço:** M.

### Z-07 · Baixa · Excluir o Zelador com transferência pendente deixa conta órfã [T]
**Onde:** `api/usuarios/excluir`.
**Evidência:** cancela a transferência e apaga o convite, mas o perfil provisório do convidado e o usuário do Auth ficam, e o
e-mail fica "queimado" (reinvitar volta `email_com_conta`).
**Correção:** reaproveitar a função de cancelamento (que já informa a conta a apagar) ou apagar a conta do convite na própria rota. **Esforço:** P.

### Informativas
- **Z-08 [T]:** reserva cancelada pode ser reaprovada em espaço interditado (a interdição só barra novo pedido, como decidido); não
  há alerta à gestão quando o Zelador interdita. `interditar_espaco` com espaço inexistente responde HTTP 500 (código P0002 do
  Postgres) em vez de 404.
- **Z-09 [T]:** `tem_perfil_operacao`, `get_user_role`, `is_admin` e `tem_perfil` têm EXECUTE para o anônimo (devolvem falso/nulo, sem
  vazamento); revogar de `anon` é endurecimento opcional.
- **Z-10 [T]:** `GET /api/autocadastro/meu` devolve bloco e número de todas as unidades a qualquer conta logada, mesmo sem perfil
  (pré-existente; sem dado pessoal). Exigir perfil ativo na rota.
- **Z-11 [C]:** a trava de rotas do Zelador é só no cliente (`rotaPermitida`); o dado continua protegido pelo banco.

## Hierarquia (#68): situação atual

Continua aberta no staging. A nova checagem do Zelador funcionou (Subsíndico não designa Zelador pelo convite), mas a classe de
falha da #68 permanece: ações de gestão sobre contas de nível superior ainda não verificam o nível do alvo, e esse caminho pode ser
usado para contornar qualquer regra de hierarquia, inclusive a do Zelador. Correção em termos gerais: nas rotas de convite,
redefinição de senha e exclusão, comparar o nível de quem pede com o do alvo e do cargo, e proibir o Subsíndico de agir sobre
Síndico, ADM e de criar perfis de nível igual ou superior; deixar o link de convite fora do alcance de quem não deve usá-lo.
Detalhe técnico: na resposta ao dono, não neste arquivo.

## O que não foi testado

Produção (proibido); interface no navegador (o QA cobre) e o escape do motivo em tempo de execução (verificado só por leitura de
código); envio real de e-mail; carga e limite de requisições; o caminho do ADM por cookie (login do ADM falhou durante a janela
de testes paralelos com o QA, mas usa o mesmo código do Síndico); aprovação de autocadastro contra conta Zelador; corrida entre
aceite e reativação.

## Issues sugeridas (não criadas)

1. Zelador: integridade e auditoria no servidor do parecer da reserva (Z-01) · Média · P a M
2. Zelador: restringir avisos e notificações livres (Z-02) · Média · M
3. Export CSV de auditoria: neutralizar fórmulas (Z-03) · Média · P
4. Convite do Zelador pela fila nascer desativado (Z-04) · Baixa · M
5. Motivo da interdição: filtrar Unicode de direção/largura zero (Z-05) · Baixa · P
6. LGPD do Zelador: visão mínima de moradores, sem impressão, termo de ciência (Z-06) · Baixa · M
7. Excluir usuário: limpar conta órfã do convite (Z-07) · Baixa · P
8. Endurecimentos informativos (Z-08 a Z-11) · Informativa · P
