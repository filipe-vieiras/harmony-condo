# QA: anular e apagar multa (commit 9cfec21, migração 0029)

Data: 2026-10-02. Ambiente: staging (app local em localhost:3000, que ja estava rodando e aponta para o staging). Contas `*@staging.test`.
Spec: `docs/specs/2026-10-02-anular-e-apagar-multa.md`.

## Resumo por caso

| # | Caso | Resultado |
|---|------|-----------|
| 1 | Sindico: ve "Anular multa", nao ve "Apagar"; motivo vazio/espacos/9 chars -> erro, foco volta, contador; motivo valido -> faixa, selo "Anulada", valor riscado, filtro "Anulada", botoes somem | PASSOU |
| 2 | Subsindico: mesmo fluxo, sem "Apagar" | PASSOU |
| 3 | ADM: Anular + secao "Apagar multa"; Esc/Voltar cancelam; foco inicial em "Voltar"; Enter nao apaga; "Apagar definitivamente" apaga, volta a /multas com "Multa apagada."; some da lista; ADM anula so com motivo | PASSOU |
| 4 | Morador dono ve "Multa anulada" com cargo (nunca o nome) e motivo, sem botoes e sem barra fixa; outro morador nao ve a multa (lista e URL direta); Conselho e Portaria sem Anular/Apagar (Portaria nem ve a multa); visitante na URL direta vai para /login | PASSOU |
| 5 | Anular com ciencia registrada e anular em recurso; sem "Anular" em multa ja anulada | PASSOU (ver obs. 2) |
| 6 | Quebrar: duplo clique, Esc durante "Anulando...", recarregar com dialogo aberto, rede fora, 501 caracteres, URL de multa apagada | PASSOU (ver obs. 1) |
| 7 | Relatorios: frases legiveis; "Multas Emitidas" exclui anuladas | PASSOU (ver obs. 4) |
| 8 | Impressao "MULTA ANULADA em DATA" | PASSOU parcial: conferido no DOM e no CSS (`.print-only` vira `display:block` no `@media print`); nao abri a previa de impressao do navegador |
| 9 | Celular 375px | PASSOU |
| 10 | Console e rede | PASSOU com ressalva (ver obs. 5); nenhum 5xx visto |

## Evidencias principais
- Erro de motivo: "Escreva pelo menos 10 caracteres para explicar o motivo." para vazio, so espacos e 9 caracteres; foco volta ao campo; contador "0/10" e "9/10".
- 501 caracteres (colado por script, pois o campo trava em 500): "O motivo da anulacao pode ter no maximo 500 caracteres." e nada e anulado. Obs.: spec diz 1000, tela e banco usam 500.
- Rede fora (fetch rejeitado): dialogo continua aberto, texto mantido, "Nao foi possivel anular a multa. Seu texto foi mantido; tente de novo."
- Duplo clique real (2 cliques com intervalo): 1 unico PATCH. Esc enquanto "Anulando...": ignorado (botoes desabilitados), anulacao conclui normalmente.
- Recarregar com dialogo aberto: dialogo fecha, multa continua intacta.
- URL de multa apagada: "Notificacao nao encontrada ... Voltar para Notificacoes" (sem tela quebrada). Mesmo texto para morador de outra unidade e para Portaria.
- Morador dono: "Esta multa foi anulada pelo sindico (ou: pela administracao) em DD/MM/AAAA e nao precisa ser paga. Motivo informado: ..." Sem nome de quem anulou.
- Multa em recurso anulada: texto do recurso preservado, rotulo "Encerrado: multa anulada" e "Recurso encerrado: multa anulada.", botoes de julgar somem.
- Auditoria: "Multa NOT-... (unidade X, bloco Y) anulada. Motivo: ..." e "Multa NOT-... (unidade X, bloco Y, advertencia | multa de R$ N, estava aguardando ciencia) apagada." O responsavel aparece na coluna propria; ids so em "Detalhes tecnicos".
- Celular 375px: sem rolagem horizontal; "Anular multa" 343x44 (largura total); secao "Apagar" no fim da pagina (309x44); botoes do dialogo 293x44; foco inicial do dialogo de apagar em "Voltar".
- Conselho: ve as multas e o Relatorio, sem Anular/Apagar.

## Observacoes e bugs (nenhum bloqueia)

1. (leve) Dois cliques sincronos no "Anular multa" (script, no mesmo tick) enviam 2 PATCH antes do botao desabilitar. Com duplo clique real so sai 1. O banco manteve uma unica anulacao e um unico registro de auditoria. Risco pratico baixo; vale proteger com ref/flag no handler.
2. (leve/duvida de produto) Em multa anulada o bloco "Ciencia formal do morador" deixa de ser exibido na tela de detalhe (codigo: `{!anulada && ...}`). Nao confirmei se o dado continua no banco. A spec (criterio 8) so exige recurso preservado; "ciencia permanece no historico" no resumo da tarefa merece decisao do PM.
3. (leve) Texto do dialogo "Anular esta multa?" difere da spec: nao cita o protocolo nem diz que "nao podera ser reativada" (so a confirmacao antes de anular, do fluxo de recurso, diz isso). Botao "Anular multa" nao fica desabilitado ate o motivo ser valido (valida ao clicar, mostrando o erro). O comportamento atende ao roteiro, mas diverge da spec.
4. (leve) KPI "Multas Emitidas": o valor em R$ exclui anuladas (OK), mas "N ocorrencias formalizadas" e "Ciencia digital X de N" continuam contando as anuladas. Confirmar se e a intencao.
5. (leve) Foco nao volta ao botao "Apagar multa..." ao fechar o dialogo com Esc (foco cai no body). Acessibilidade.
6. (ressalva) O console acumulou muitas mensagens `Perfil nao encontrado ... PGRST116` com HTTP 406 durante as trocas de usuario (logout/login), mas as cargas normais de /multas e /relatorios tiveram todas as chamadas ao Supabase em 200. Nao isolei a causa; provavelmente ligada ao logout, nao a esta funcionalidade. Os erros `anularFineDB` do console foram provocados por mim (501 caracteres e rede simulada).
7. (obs.) ADM continua vendo "Apagar multa" em multa ja anulada (coerente com a spec: ADM apaga qualquer uma).

## O que nao deu para testar
- Regras por API/RLS (criterios 2, 4, 5, 6, 7, 11, 12, 13, 14, 17 da spec): minha tentativa de usar o token da sessao para chamar a API REST direto foi bloqueada pela politica do ambiente e nao insisti. Fica para `node scripts/qa/bateria.mjs` (a commit diz ter ~100 checks novos); nao a rodei.
- Visitante e conta sem perfil na API; falha de gravacao do historico ao apagar (criterio 13); migracao duas vezes seguidas.
- Previa de impressao real do navegador.
- Esc/Voltar do dialogo de apagar no celular com teclado (so conferi botoes e foco).
- Notificacao ao morador (fora da entrega).

## Dados de teste deixados no staging
Multas NOT-2026/001 a 003 e 005 a 008 (anuladas) e registros de auditoria; 004 e 009 foram apagadas. O seed (`node scripts/seed-staging.mjs`) recria a base.

---

## Reteste (correcoes do developer, ainda sem commit)

Data: 2026-10-02. Ambiente: staging, app local em localhost:3000. Staging recriado pelo seed (sem multas); criei multas de teste como `sindico@staging.test`. Desktop 1280x800 e celular 375x812. Duplo clique simulado por `btn.click(); btn.click();` no mesmo tick, com contagem de requisicoes de escrita (PATCH/DELETE) por um wrapper de `fetch`.

| # | Caso | Resultado |
|---|------|-----------|
| 1 | Duplo clique | PASSOU |
| 2 | Foco ao fechar | PASSOU |
| 3 | Textos do dialogo de anular | PASSOU |
| 4 | Ciencia visivel em multa anulada | PASSOU (impressao so conferida no DOM/CSS) |
| 5 | Celular 375px | PASSOU |
| 6 | Regressao rapida | PASSOU |

### Detalhes
1. Dois cliques no mesmo tick no botao da pagina "Anular multa" e "Apagar multa...": 1 unico dialogo em cada. Dois cliques no "Anular multa" de confirmacao: 1 unico PATCH em `fines` (antes eram 2). Dois cliques em "Apagar definitivamente": 1 unico DELETE. Auditoria em Relatorios: exatamente uma linha por acao (anulacoes e apagamentos), sem duplicidade. (Atencao: numa tentativa instalei o wrapper de rede duas vezes e vi 2 DELETE; foi erro meu, refeito com um wrapper e deu 1.)
2. `document.activeElement` apos fechar volta ao botao que abriu ("Anular multa" e "Apagar multa..."): Esc real, Voltar com clique real, e abertura por clique de mouse real e por script. Tambem no celular (Esc). Obs.: apos anular com sucesso o botao some e o foco cai no body (esperado, sem botao para receber foco).
3. Titulo "Anular a multa NOT-2026/00X?"; mensagem comeca com "Depois de anulada, a multa nao pode ser reativada."; campo trava em 500 caracteres (maxlength); motivo curto ("curto") ao clicar em confirmar mostra "Escreva pelo menos 10 caracteres para explicar o motivo."
4. Multa com ciencia registrada pelo morador e depois anulada: bloco "Ciencia formal do morador" com "Ciencia Confirmada" e "Registrada em ... por ..." visivel para sindico, ADM e morador dono, somente leitura; sem ancestral `no-print` (a regra `.no-print` so esconde o que a tem), entao entra na impressao. Multa anulada sem ciencia: "Nao registrada" e "A multa foi anulada antes de o morador registrar a ciencia." (sindico, subsindico e morador). Sem "Registrar ciencia", recurso, julgamento nem barra fixa do morador.
5. 375px: sem rolagem horizontal (scrollWidth 375); dialogo 343px de largura; botoes 293x44; botao "Anular multa" da pagina 343x44; morador ve multa anulada com ciencia e sem barra fixa.
6. Anular (sindico), anular (subsindico, pelo teclado: digitar, Tab, Tab, Enter), apagar (ADM) funcionaram; filtro "Anulada" lista as anuladas; morador sem botoes. Console: nada novo ligado a funcionalidade; os 406 "Perfil nao encontrado" aparecem nas trocas de usuario (ja conhecidos). O erro "Failed to fetch RSC payload ... reading 'replace'" no console foi provocado pelo meu wrapper de fetch, nao e bug do app.

### Nao testado
- Previa de impressao real do navegador (so DOM/CSS).
- Regras por API/RLS e `scripts/qa/bateria.mjs` (como antes).
- Duplo clique real do mouse (so o simulado no mesmo tick; o real ja passava antes).

### Dados de teste deixados no staging
Multas NOT-2026/001, 005 e 006 anuladas, 004 (nova, ativa, criada no teste de celular); 002, 003 e outras apagadas. O seed recria a base.
