# Especificação: ciclo de vida da multa e quem pode excluir o Síndico

Issue: #20 (decisão, esforço M, prioridade média). Autor: PM. Data: 2026-10-01.
Status: **proposta para decisão do dono do produto.** A seção 5 separa o que o developer pode
fazer agora do que espera decisão.

> Aviso: este documento **não é parecer jurídico**. Tudo marcado "a confirmar com advogado /
> síndico / administradora" precisa dessa conversa antes de virar regra fixa. Nenhum artigo
> de lei foi citado de propósito.

---

## 1. Situação atual (conferida no código)

### 1.1 Multa
Arquivos: `src/types/index.ts` (`FineStatus`), `src/context/AppContext.tsx` (`addFine`,
`confirmFineScience`, `submitFineAppeal`, `judgeFineAppeal`), `src/app/multas/` e
`supabase/migrations/0018`, `0023`, `0024`.

Estados e quem os produz hoje:

| Status | Quem grava | Como |
|---|---|---|
| `PENDENTE_CIENCIA` | Síndico/Subsíndico/ADM | Ao emitir (data limite de recurso digitada na emissão) |
| `CIENCIA_REGISTRADA` | **Morador** da unidade | Botão "Confirmar ciência" (grava data e nome) |
| `EM_RECURSO` | **Morador** | Só aparece o formulário se status = `CIENCIA_REGISTRADA` |
| `RECURSO_DEFERIDO` (anulada) | Síndico/Subsíndico/ADM | Julgamento com justificativa obrigatória |
| `RECURSO_INDEFERIDO` (mantida) | Síndico/Subsíndico/ADM | Idem |
| `CONCLUIDA` | **Ninguém.** Nunca é gravado | Existe só como rótulo ("Concluída / Paga") no filtro e no selo |

Fatos que importam:
1. **O prazo de recurso não é aplicado em lugar nenhum.** `prazo_recurso_data` é só texto na
   tela. O formulário de recurso continua aparecendo depois da data, e o gatilho do banco
   (`0024_fines_morador_update_guard`) não confere a data. Um morador pode recorrer meses depois.
2. **Nada acontece sozinho.** Não há rotina agendada. Multa sem ciência fica
   `PENDENTE_CIENCIA` para sempre; multa com ciência e sem recurso fica
   `CIENCIA_REGISTRADA` para sempre.
3. **Não existe passo de pagamento nem de cobrança.** Quem emite os boletos é a
   administradora (decisão em `docs/produto.md`); o Harmony não sabe se a multa foi cobrada.
4. **Não existe "anular por erro".** Se o síndico emitiu para a unidade errada, só dá para
   mexer direto no banco (a regra de acesso permite `DELETE` em `fines` por qualquer admin,
   mas não há botão).
5. **Julgar recurso:** qualquer perfil de equipe (Síndico, Subsíndico, ADM) vê o painel de
   julgamento (`isAdmin`), embora o aviso de "recurso novo" só vá ao perfil `SINDICO`. O
   síndico pode julgar recurso da **própria unidade** (conflito de interesse já listado como
   pendência em `docs/produto.md`).
6. A decisão do recurso não tem trava no banco: a regra `fines_update_staff` deixa a equipe
   alterar qualquer coluna depois de julgado. A tela só esconde o painel.
7. Advertência (`tipo = ADVERTENCIA`) segue o mesmo fluxo, mas não tem valor a cobrar.

### 1.2 Exclusão e rebaixamento do Síndico
- **Não existe tela nem API para mudar o perfil de alguém** (rebaixar/promover). Trocar o
  perfil de uma pessoa hoje = excluir o acesso e convidar de novo.
- `src/app/api/usuarios/excluir/route.ts`: qualquer `SINDICO`, `SUBSINDICO` ou `ADM` pode
  excluir **qualquer** conta, **inclusive a do Síndico**. A única trava é não excluir a si
  mesmo. A tela (`usuarios/page.tsx`) mostra a lixeira em todos os usuários menos o próprio.
- **Caminho escondido:** `src/app/api/unidades/excluir/route.ts` apaga a conta (`profiles` +
  Auth) ligada à unidade **sem olhar o perfil dela**. Como o síndico já pode ter a própria
  unidade (caso real A-101, ver `docs/produto.md`), **excluir a unidade do síndico apaga a
  conta do Síndico**, e isso vale até para o próprio síndico (se trancar para fora) e para
  Subsíndico/ADM. O diálogo de confirmação da unidade não avisa disso.
- Banco: `profiles` não aceita escrita pelo navegador (`0027`); exclusões passam pelas APIs
  com chave de serviço, então **a regra mora só no código das APIs**; não há regra de banco
  impedindo. Existe índice que permite no máximo **um Síndico** e **um Subsíndico** ativos
  (`profiles_singleton_sindico`, `profiles_singleton_subsindico`).
- Consequência do índice: **para trocar o síndico (fim de mandato, eleição) hoje é preciso
  excluir o Síndico atual** e só então convidar o novo. Ou seja, a regra de exclusão e o
  procedimento de troca de síndico são a mesma decisão.
- Permissões de equipe: Síndico, Subsíndico e ADM têm permissões iguais por decisão de
  produto (`src/lib/roles.ts`); a diferença existe só para a trilha de auditoria.

---

## 2. Proposta recomendada: ciclo da multa

### 2.1 Princípios
1. **Dois eixos separados**, para não misturar defesa com dinheiro:
   (a) *situação do processo* (ciência, recurso, decisão) e (b) *cobrança* (lançada no boleto?).
2. **O Harmony não confirma pagamento.** Quem recebe é a administradora. O máximo honesto que
   o Harmony sabe é "encaminhada para cobrança em tal data". Pagamento só se a administradora
   um dia liberar API (ver `docs/produto.md`).
3. **Prazo vencido é calculado, não gravado por rotina.** Sem cron, sem estado novo que possa
   ficar errado: a tela e o banco comparam a data de hoje (fuso America/Sao_Paulo, o prazo vale
   até o fim do dia) com `prazo_recurso_data`.
4. **Nada é excluído.** Erro de emissão vira `ANULADA` com motivo, nunca `DELETE`.
5. **Todo passo grava no histórico** (já é assim para ciência, recurso e julgamento).

### 2.2 Diagrama de estados (texto)

```
            emite (Síndico / Subsíndico / ADM)
                        |
                        v
              +--------------------+
              |  PENDENTE_CIENCIA  |----(equipe) "anular por erro" ----> ANULADA (fim)
              +--------------------+
                        |
         morador confirma ciência
        (ou equipe registra ciência por outro meio, com observação)  [decisão D2]
                        v
              +--------------------+
              | CIENCIA_REGISTRADA |----(equipe) "anular por erro" ----> ANULADA (fim)
              +--------------------+
                 |                |
 morador recorre |                | data do prazo passa (derivado)
 até o fim do dia|                v
 do prazo        |      "PRAZO ENCERRADO" (tela) = multa MANTIDA sem recurso
                 v                |
        +---------------+         |
        |  EM_RECURSO   |         |
        +---------------+         |
          |            |          |
    deferido      indeferido      |
          v            v          |
 RECURSO_DEFERIDO  RECURSO_INDEFERIDO
   (anulada, fim)   (mantida) ----+
                        |
                        v
                  MANTIDA (a cobrar)           <- advertência sem valor vai direto a CONCLUIDA
                        |
   equipe/ADM marca "Encaminhada para cobrança em MM/AAAA"
                        v
                   CONCLUIDA  (= encerrada no Harmony; não significa "paga")
```

Mudança de dados mínima: um status novo `ANULADA`; `CONCLUIDA` passa a ser gravado; duas
colunas novas em `fines`: `cobranca_lancada_em` (data) e `anulada_motivo` (texto) com quem e
quando (ou reaproveitar o histórico de ações). "Prazo encerrado" e "Mantida" **não** são status
gravados: são exibição derivada (`CIENCIA_REGISTRADA` + hoje > prazo, ou `RECURSO_INDEFERIDO`).

### 2.3 Quem faz cada transição

| Transição | Quem | Observação |
|---|---|---|
| Emitir | Síndico, Subsíndico, ADM | Como hoje |
| `PENDENTE_CIENCIA` → `CIENCIA_REGISTRADA` | Morador da unidade (ou equipe, por outro meio, com observação) | Ciência por equipe: decisão D2 |
| Interpor recurso | Morador da unidade | **Só até o fim do dia do prazo** (decisão D1) |
| Julgar (deferir/indeferir) | Síndico ou Subsíndico; ADM só consulta | Decisão D5; julgador **impedido** se a multa for da sua própria unidade |
| Anular por erro | Síndico ou Subsíndico, motivo obrigatório | Decisão D4 |
| Encaminhar para cobrança → `CONCLUIDA` | Síndico, Subsíndico ou ADM | Só multa mantida; botão "Encaminhei para a administradora" com data |
| Prazo encerrar | Ninguém (calculado) | Sem rotina |

### 2.4 O que acontece com o prazo vencido (recomendação)
- **Com ciência registrada e sem recurso:** a multa é considerada **mantida**. O morador vê
  "Prazo para recurso encerrado em DD/MM/AAAA"; o botão de recurso some. O síndico vê a multa
  num filtro "Prazo encerrado, falta encaminhar para cobrança".
- **Sem ciência e prazo passado:** a multa **não** é tratada como aceita (risco de dizer que o
  morador "perdeu o prazo" de algo que nunca viu). O síndico vê "Prazo passou sem ciência" e
  decide: registrar ciência por outro meio (carta, protocolo) ou reabrir/estender o prazo.
- **Reabrir/estender o prazo:** o síndico pode definir nova data, com motivo registrado. Isso
  protege o morador contra data digitada errada.

### 2.5 Quando é "concluída/paga"
Recomendo **parar de chamar de "Paga"** e de prometer o que o Harmony não sabe. `CONCLUIDA`
passa a significar: *o processo acabou e a multa foi encaminhada para cobrança pela
administradora* (ou advertência sem valor, após o prazo). Rótulo na tela: **"Encerrada"** (e
"Encaminhada para cobrança em MM/AAAA" como detalhe). Se a administradora liberar API no
futuro, entra um terceiro rótulo "Paga" lido do sistema dela; até lá, nunca.
- A linha "como a multa é cobrada" (no boleto do mês seguinte, boleto à parte, desconto de
  alguma taxa) é prática da administradora e do regimento: **a confirmar com a administradora
  e o síndico.** A tela não deve afirmar isso.
- LGPD: situação de cobrança só para a unidade e para a equipe, como já é para multas
  (`fines_read_morador`, `fines_read_staff`); Conselho continua só leitura.

---

## 3. Proposta recomendada: exclusão do Síndico

**Regra:** o Síndico **não pode ser excluído por ninguém pelo app**, nem por Subsíndico, nem
por ADM, nem por ele mesmo. Vale para os dois caminhos: `api/usuarios/excluir` e o efeito
colateral de `api/unidades/excluir`. A trava fica **no servidor** (API), não só escondendo o
botão, e a lixeira some da linha do Síndico na tela de Usuários.

Regras acompanhantes (recomendadas):
- **Exclusão de unidade nunca apaga conta de equipe** (Síndico, Subsíndico, ADM): só desliga a
  conta da unidade. Vale como correção de defeito, independente da decisão.
- Subsíndico e ADM **podem** excluir um ao outro e os demais perfis (como hoje). O Síndico
  pode excluir qualquer outro perfil de equipe. Só o Síndico é protegido.
- **Rebaixar/mudar perfil:** continua sem tela. Quem precisa trocar de cargo é tratado como
  "troca de síndico" (abaixo). Não construir tela de "alterar perfil" agora.
- **Troca de síndico (fim de mandato):** por enquanto, procedimento **manual feito pelo dono do
  produto**, a pedido formal (ata/comprovante de eleição, a confirmar com o síndico e a
  administradora), registrado no histórico. O app expõe um botão de "Transferir cargo de
  Síndico" só quando houver demanda real (spec futura; exigiria confirmar com a senha do
  síndico atual e avisar o ADM).
- Por que bloquear: o Síndico é o único com índice único e é quem recebe o aviso de recurso;
  um Subsíndico ou uma conta da administradora poderia, por engano ou má-fé, tirar o acesso
  dele no meio de um processo de multa. A própria issue já recomenda bloquear.

---

## 4. Decisões que só o dono do produto pode tomar

Cada uma tem recomendação padrão. Se o dono não responder, vale a recomendação.

**D1. Prazo vencido bloqueia o recurso?**
- Recomendação: **sim**, o formulário some e o banco recusa recurso depois do fim do dia do
  prazo; o síndico pode estender o prazo com motivo (2.4).
- Consequência se sim: acaba a bagunça de recurso eterno; mas, se a data digitada na emissão
  estiver errada ou a contagem legal for outra, o morador perde o direito por erro do app.
  Por isso a extensão pelo síndico é parte da recomendação.
- Consequência se não: recurso fora de prazo continua possível; o síndico decide caso a caso
  e o prazo é só "enfeite".
- A confirmar com advogado/síndico: se o regimento ou a convenção define prazo fixo e como
  ele conta.

**D2. De onde conta o prazo e o que fazer sem ciência?**
- Recomendação: **manter a data digitada na emissão** (já existe) com um valor padrão
  vindo do regimento, e permitir que a equipe **registre ciência por outro meio** (carta,
  protocolo) com observação obrigatória, quando o morador não abre o portal.
- Consequência: sem isso, multa de quem nunca entra no sistema fica parada para sempre e não
  gera efeito; com isso, cria-se um passo manual que precisa ser juridicamente válido.
- A confirmar com advogado/síndico: se a notificação por meio eletrônico basta, o que vale
  como comprovação de ciência e se a contagem começa na ciência ou na emissão. O texto atual
  da ciência (aprovado em 2026-10-01) **não muda** sem revisão jurídica.

**D3. O que significa "Concluída"?**
- Recomendação: **"Encerrada: encaminhada para cobrança"** (marcação manual com data); o
  Harmony **não** diz "paga".
- Consequência: honesto e barato, mas o síndico não vê no Harmony se o morador quitou; segue
  consultando a administradora. Se o dono quiser "paga", é preciso a integração com a
  administradora (hipótese em aberto em `docs/produto.md`) ou marcação manual, que envelhece
  e mostra "em aberto" para quem já pagou (mesmo motivo da planilha mensal ter sido descartada).

**D4. Permitir anular multa emitida por engano?**
- **Decidido em 2026-10-02: ver `docs/specs/2026-10-02-anular-e-apagar-multa.md`.**
- Recomendação: **sim**, estado `ANULADA`, motivo obrigatório, por Síndico/Subsíndico, nunca
  excluir, morador é avisado. Substitui a possibilidade de apagar a multa no banco.
- Consequência se não: erro de emissão só se resolve mexendo no banco (risco e dependência do
  desenvolvedor) ou "deferindo" um recurso que nunca existiu, o que suja o histórico.
- A confirmar com advogado/síndico: se anular uma notificação já enviada exige algum ato formal.

**D5. Quem julga o recurso?**
- Recomendação: **Síndico ou Subsíndico**; ADM só consulta e prepara. Se a multa for da
  unidade do próprio julgador, o outro (Síndico ↔ Subsíndico) julga; sem o outro cadastrado, o
  sistema avisa e registra o conflito.
- Consequência: reduz decisão tomada por quem não é o responsável legal e resolve o conflito
  de interesse da pendência já listada. Contra: mexe na regra "ADM = mesmas permissões".
  Contestando em parte a decisão de produto registrada em `src/lib/roles.ts` ("mesmas
  permissões"), por motivo de responsabilidade.
- A confirmar com advogado/síndico: quem tem competência para decidir recurso (síndico,
  conselho ou assembleia) conforme a convenção do condomínio. Pode mudar a recomendação.

**D6. Exclusão do Síndico e troca de síndico** (seção 3)
- Recomendação: bloquear para todos; troca de síndico manual pelo dono por enquanto.
- Consequência se sim: elimina o risco de perder o acesso do síndico por engano; o custo é
  que a troca de mandato passa por você até haver demanda para o botão "Transferir cargo".
- Consequência se não: continua possível o Subsíndico/ADM excluir o Síndico e a unidade do
  síndico apagar sua conta.

**D7. Existe lembrete de multa parada?**
- Recomendação: **só um painel na tela de Multas** ("sem ciência há N dias", "prazo encerrado,
  falta encaminhar") e notificação interna ao síndico; **sem WhatsApp** por enquanto.
- Consequência: baixo custo; sem lembrete externo, multa de quem não entra no portal pode
  ficar esquecida. Avaliar canal (WhatsApp) junto com a hipótese em aberto sobre o canal.

---

## 5. O que fazer agora e o que espera decisão

### 5.1 Seguro implementar já (sem depender de decisão)
Aplicações de correção de defeito, só leitura ou proteção reversível:
1. **`api/unidades/excluir` não pode apagar conta de equipe** (Síndico, Subsíndico, ADM):
   só desvincula a conta da unidade. Atualizar a mensagem do diálogo da unidade (já descrita
   em `docs/specs/2026-10-01-confirmar-exclusoes.md`).
2. **Trava de servidor na `api/usuarios/excluir` impedindo excluir o Síndico** (e esconder a
   lixeira dele na tela de Usuários). É a recomendação da própria issue, protege e é
   reversível. Implementar já; o dono confirma o procedimento de troca (D6) depois. Enquanto
   isso, a troca de síndico é feita manualmente pelo dono.
3. **Exibir "Prazo encerrado em DD/MM/AAAA"** (cálculo derivado, fuso America/Sao_Paulo,
   vale até o fim do dia) na lista e no detalhe da multa, para equipe e morador. **Só
   exibição**; não bloqueia nada.
4. **Tirar "Concluída / Paga" do filtro de status e do rótulo** enquanto D3 não for decidida
   (hoje promete algo que nunca acontece). Manter o valor no tipo, só não oferecer.
5. **Filtro/indicador "Sem ciência" e "Prazo encerrado"** na tela de Multas para o síndico
   (consulta, não muda dados).
6. Testes na bateria `scripts/qa/`: Subsíndico e ADM recebem recusa ao excluir o Síndico;
   excluir a unidade do síndico não apaga a conta; Síndico não exclui a si mesmo.

Critérios de aceite do bloco 5.1:
- Como Subsíndico e como ADM, excluir o Síndico pelo app falha com mensagem em português
  ("O Síndico não pode ser excluído por aqui."), e a conta continua existindo. A tela não
  mostra a lixeira na linha do Síndico.
- Excluir a unidade do síndico (staging) mantém a conta do Síndico e só desliga a ligação.
- Multa com prazo de ontem mostra "Prazo encerrado"; com prazo de hoje ainda mostra "Prazo até hoje".
- O filtro de status não oferece mais "Concluída / Paga".

### 5.2 Depende de decisão do dono
- Bloquear recurso após o prazo no app e no banco, e "estender prazo" (D1).
- Ciência registrada pela equipe por outro meio (D2).
- Estado `CONCLUIDA` gravado, coluna `cobranca_lancada_em`, botão "Encaminhei para a
  administradora" (D3).
- Estado `ANULADA` e botão "Anular" (D4).
- Quem julga recurso e impedimento por conflito de interesse (D5).
- Painel de multas paradas e notificações (D7).
- Botão "Transferir cargo de Síndico" (D6, só com demanda).

### 5.3 O que fica de fora
- Integração de pagamento ou leitura de boletos da administradora.
- Cálculo de juros ou correção de multa.
- Rotina agendada que muda status sozinha.
- Tela de "alterar perfil" de usuário.
- Cobrança de dinheiro dentro do Harmony (decisão registrada em `docs/produto.md`).
- Trava de banco que impede alterar multa depois de julgada (ficar para depois de D4/D5, que
  definem quem pode mudar o quê).

---

## 6. Riscos
- **Jurídico (a confirmar com advogado/síndico/administradora):** prazo e contagem de recurso;
  validade da ciência por meio eletrônico; quem decide o recurso; se há exigência de
  deliberação ou quórum para aplicar multa; forma de cobrança no boleto; prazo de guarda dos
  registros. Este spec propõe mecânica, não afirma o que a lei exige.
- **Segurança/produção:** a regra do Síndico vive só no código das APIs (chave de serviço).
  Migrações novas (`ANULADA`, colunas) rodam primeiro em staging, como já é prática.
- **LGPD:** multas e situação de cobrança só para a unidade e equipe; registros de anulação e
  ciência por outro meio não devem guardar documento nem contato do morador.
- **Suporte:** mensagem clara quando o recurso é recusado por prazo ("O prazo terminou em
  DD/MM. Fale com o síndico."), senão o morador acha que o app quebrou.
- **Dependência da administradora:** se ela não colaborar com o fluxo de "encaminhei para
  cobrança", o estado `CONCLUIDA` vira marcação manual do síndico, sem confirmação.

## 7. Como validar barato antes de construir
Mostrar o diagrama 2.2 (uma página) ao síndico real e à administradora e perguntar três
coisas: (1) qual o prazo de recurso do regimento e de quando ele conta; (2) como a multa
chega ao boleto e quem avisa que foi paga; (3) quem decide o recurso. Se as respostas
contradisserem D1, D3 ou D5, ajusta-se antes de mexer no banco.

## 8. Trecho proposto para `docs/produto.md` (só após aprovação do dono)
- **Multa: ciclo e Síndico (proposto 2026-10-01):** prazo vencido calculado, não por rotina;
  `CONCLUIDA` = "encerrada/encaminhada para cobrança", nunca "paga"; erro de emissão vira
  `ANULADA`, não exclusão; Síndico não é excluído pelo app, troca de síndico manual. Spec:
  `docs/specs/2026-10-01-ciclo-da-multa-e-exclusao-do-sindico.md`.
