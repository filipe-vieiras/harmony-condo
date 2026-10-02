# Especificação: anular e apagar multa

Autor: PM. Data: 2026-10-02. Status: **decidido pelo dono do produto em 2026-10-02**, pronta para o developer.
Resolve a D4 de `docs/specs/2026-10-01-ciclo-da-multa-e-exclusao-do-sindico.md` e o risco de apagar multa sem rastro.
Migração prevista: `0029`.

> Aviso: este documento **não é parecer jurídico**. O que está marcado "a confirmar com síndico / advogado" precisa dessa conversa antes de virar regra fixa.

## 1. Problema
Hoje a regra de acesso `fines_delete_admin` (migração 0023) deixa Síndico, Subsíndico e ADM **apagarem qualquer multa, em qualquer estado, sem deixar histórico**. Não há botão, mas a permissão existe no banco. Isso apaga a prova de um processo (ciência, recurso, decisão) e não deixa saber quem apagou. Ao mesmo tempo falta um caminho legítimo para corrigir multa emitida por engano (unidade errada, valor errado): hoje só dá para mexer no banco.

Decisão do dono: **anular** (com motivo, preserva o processo) para Síndico, Subsíndico e ADM; **apagar** só para o ADM, sem justificativa, mas sempre registrado.

## 2. Regra por perfil

| Perfil | Ver multa | Anular (motivo obrigatório) | Apagar |
|---|---|---|---|
| Síndico | todas | **sim** | **não** |
| Subsíndico | todas | **sim** | **não** |
| ADM | todas | **sim** | **sim** (sem justificativa) |
| Conselho | todas (leitura) | não | não |
| Portaria | não vê | não | não |
| Morador | só as da própria unidade | não | não |
| Visitante (sem login) / conta sem perfil | não | não | não |

Obs.: o ADM tem hoje as mesmas permissões do Síndico por decisão de produto. Esta regra **abre uma exceção** (só ADM apaga) por decisão expressa do dono; registrar em `docs/produto.md` (seção 9).

## 3. Estados e transições

Novo status `ANULADA` em `FineStatus` e no banco. Estado final: **não volta a ficar ativa**.

| Estado atual | Anular? | Observação |
|---|---|---|
| `PENDENTE_CIENCIA` | sim | Caso típico: emissão por engano. Morador ainda pode não ter visto. |
| `CIENCIA_REGISTRADA` | sim | Prazo de recurso corrido ou não. |
| `EM_RECURSO` | **sim** | O recurso fica **encerrado sem julgamento**: o campo `recurso_status` não vira DEFERIDO nem INDEFERIDO; o texto do recurso e os anexos ficam preservados. Mostrar "Recurso encerrado: multa anulada". Recomendação: equipe deve preferir julgar (deferir) quando o motivo for o mérito do recurso; anular é para erro. |
| `RECURSO_DEFERIDO` | **não** | Já está anulada pela decisão do recurso; o botão não aparece. |
| `RECURSO_INDEFERIDO` | sim | Multa mantida por decisão anterior, depois reconhecida como errada. O motivo deve dizer isso; a decisão do recurso e o histórico **permanecem**. A confirmar com síndico/advogado se anular multa já julgada exige ato formal. |
| `CONCLUIDA` (não é gravado hoje) | sim, se vier a existir | Idem acima. |
| `ANULADA` | não | Final. |

- Nada de reversão automática. **Reverter anulação: pergunta em aberto (P1).** Até decidir, o banco **rejeita** qualquer mudança de status a partir de `ANULADA` (para qualquer perfil, inclusive ADM; só o `service role`/manutenção direta no banco).
- Anulação **não apaga nenhum campo** da multa (valor, artigo, ciência, recurso, resposta): só acrescenta os campos abaixo.

## 4. Regras de banco (migração 0029)

Idempotente (`if not exists`, `drop ... if exists`), rodar primeiro no staging.

1. **Status:** incluir `ANULADA` na restrição de valores de `fines.status` (se for `check`/enum, ajustar; conferir como está criado na 0018).
2. **Novos campos em `fines`:** `anulada_motivo text`, `anulada_por uuid` (referência ao perfil/usuário), `anulada_por_nome text`, `anulada_por_papel text`, `anulada_em timestamptz`. Os nomes e papel são copiados no momento da anulação (sobrevivem à exclusão da conta).
3. **Garantia no banco (gatilho `before update`, novo, ou extensão de um gatilho próprio; não alterar a lógica do guard de morador `0024` além do necessário):**
   - Se `new.status = 'ANULADA'` e `old.status <> 'ANULADA'`:
     - o papel (`get_user_role()`) deve ser `SINDICO`, `SUBSINDICO` ou `ADM`; senão `raise exception` (errcode `42501`);
     - `anulada_motivo` não pode ser nulo nem vazio **depois de `trim`**; mínimo de **10 caracteres** (valor sugerido, ajustável; a validar com o dono) e máximo de 1000; senão erro com mensagem em português;
     - `anulada_em` e `anulada_por`/`_nome`/`_papel` são **preenchidos pelo próprio gatilho** com `now()` e dados de `auth.uid()` (o cliente não escolhe), ignorando o que vier do cliente.
   - Se `old.status = 'ANULADA'`: qualquer mudança de `status` ou dos campos `anulada_*` é rejeitada.
   - Se `new.status <> 'ANULADA'` e algum campo `anulada_*` estiver preenchido: rejeitar (não existe anulação "sem estado").
   - Vale para Síndico e Subsíndico (**obrigatório**, motivo) **e também para o ADM** ao anular. O ADM não é isento da justificativa da **anulação**; só da do **apagar**.
   - O service role (APIs com chave de serviço) não passa por `auth.uid()`; **nenhuma rota de API deve anular com a chave de serviço**. A anulação roda como o usuário logado, para a regra valer.
4. **Apagar:** `drop policy fines_delete_admin` e recriar com a mesma regra de nome (ou nome novo) usando **somente ADM**: `public.get_user_role() = 'ADM'`. Síndico, Subsíndico, Conselho, Portaria e Morador sem política de `DELETE`. Conferir que nenhuma outra política (criada à mão no painel) permita `DELETE` em `fines`; a 0023 usa remoção dinâmica para isso, repetir o padrão.
5. **Histórico de apagar garantido no banco:** gatilho `before delete` em `fines` que **insere em `audit_logs`** (função `security definer`, `set search_path = public`), pois um registro feito só pelo navegador pode ser pulado chamando a API direto. Como `audit_logs` só aceita INSERT do próprio usuário (0028), o gatilho precisa gravar com os dados do `auth.uid()`. Se o INSERT falhar, a exclusão **falha junto** (a mesma transação).
6. **Anular também registra em `audit_logs`** por gatilho `after update` (quando status vira `ANULADA`), pelo mesmo motivo.
7. **Sem `UPDATE` pelo morador:** o guard `0024` já impede o morador de mudar status para algo fora de `CIENCIA_REGISTRADA`/`EM_RECURSO`; acrescentar `anulada_*` à lista de colunas proibidas para o morador.
8. Rodar `scripts/qa/` com perfis reais (ver seção 9).

## 5. Histórico de ações (auditoria)

Tela de Relatórios já mostra a trilha; acrescentar frases legíveis em `src/lib/audit*.ts` (`MULTAS`).

| Ação | Quem vê | Conteúdo gravado | Frase sugerida |
|---|---|---|---|
| Anular | Síndico, Subsíndico, ADM, Conselho | protocolo, unidade, bloco, status anterior, motivo, quem anulou (nome, papel, id), data/hora | "Multa de protocolo X (unidade A-101) anulada por Fulano (Síndico). Motivo: ..." |
| Apagar | idem | protocolo, unidade/bloco, **tipo e valor**, status em que estava, quem apagou (nome, papel, id), data/hora. **Sem motivo** | "Multa de protocolo X (unidade A-101, advertência/multa de R$ N, estava em tal estado) apagada por Fulano (ADM)." |

- **Apagar sem justificativa, mas sempre com registro.** O registro de apagar **não** guarda: nome do morador, descrição da infração, texto de recurso, anexos, e-mail ou telefone. Só o necessário para saber **quem apagou e qual multa foi** (protocolo, unidade, tipo, valor, status).
- O histórico **não pode ser apagado nem editado** por ninguém pelo app (já é assim: sem UPDATE/DELETE em `audit_logs`). Conferir que isso continua verdadeiro.
- Prazo de guarda do histórico: **a confirmar com síndico/advogado** (P3).

## 6. O que o morador vê (texto)

Multa anulada **continua visível** para o morador da unidade, marcada como anulada, em ordem normal da lista, sem botões de ação (sem recurso, sem ciência).

- Selo na lista: **"Anulada"**.
- Detalhe, bloco de destaque: "**Esta multa foi anulada em DD/MM/AAAA.** Você não precisa fazer nada e ela não será cobrada." (confirmar com o síndico/administradora que não há cobrança; ver risco R3).
- Motivo: mostrar ao morador o **motivo** informado? Proposta: **sim, mostrar** ("Motivo: ..."), por transparência; mas o motivo é texto livre digitado pela equipe e pode conter dado de terceiros. Por isso o campo de motivo na tela traz o aviso: "O morador da unidade vai ler este texto. Não coloque dados de outras pessoas." (P4 para confirmar o dono).
- Se estava `EM_RECURSO`: acrescentar "O recurso que você enviou foi encerrado porque a multa foi anulada."
- Não mostrar **quem** anulou ao morador, só "o condomínio" (nome e papel ficam no histórico da equipe). Confirmar com o dono (P5).
- Notificação ao morador: **fora desta entrega** (ver seção 10); vale só o selo na lista.

## 7. Telas e confirmações (equipe)

Usar `DialogProvider` (o mesmo padrão de `mural/page.tsx`, `usuarios/page.tsx`), nunca `window.confirm`/`alert`.

**Anular** (Síndico, Subsíndico, ADM): botão "Anular multa" no detalhe, visível só nos estados da seção 3 e só para esses três perfis.
- Diálogo com campo de texto **Motivo da anulação** (obrigatório, contador, limite 1000). Botão "Anular multa" desabilitado até o motivo ser válido; o mesmo limite é conferido no servidor/banco.
- Texto: "Anular multa protocolo X? A multa continua visível para o morador, marcada como anulada, e **não poderá ser reativada**. O motivo fica no histórico."
- Sucesso: aviso "Multa anulada." e a lista atualiza. Erro do banco mostra a mensagem em português.

**Apagar** (**só ADM**): botão "Apagar multa", com estilo de ação perigosa, **separado do Anular** e só para ADM. Para os outros perfis, o botão **não aparece**.
- Diálogo de confirmação (variante perigosa), texto claro de que é definitivo: "**Apagar definitivamente a multa protocolo X (unidade A-101)?** Isso remove a multa, a ciência, o recurso e os anexos para sempre, **e não dá para desfazer**. O morador deixa de ver essa multa. O histórico guarda que você apagou. Para manter a multa visível como cancelada, use 'Anular multa'."
- Botão do diálogo: "Apagar definitivamente"; cancelar é o foco inicial.
- Sem campo de justificativa (decisão do dono).
- A confirmação é só tela; a regra real é a do banco (seção 4).

## 8. Critérios de aceite (testáveis)

Rodar no **staging**, por API/RLS, com contas reais de cada perfil (em `scripts/qa/`), e na tela.

Anular:
1. Como Síndico: anular multa `PENDENTE_CIENCIA` **com motivo** funciona; fica `ANULADA` com `anulada_motivo`, `anulada_por*` e `anulada_em` preenchidos pelo servidor; linha em `audit_logs`.
2. Como Síndico e como Subsíndico, via API direta (sem tela), `update status='ANULADA'` **sem motivo**, com motivo só de espaços ou curto demais: recusado, a multa não muda, mensagem em português.
3. Como ADM: anular **sem motivo** é recusado; com motivo funciona.
4. Mandar valores falsos em `anulada_por`/`anulada_em` pelo cliente: são ignorados e substituídos.
5. Como Morador (dono da multa): `update status='ANULADA'` recusado; como Morador de **outra** unidade: nem vê a multa.
6. Como Conselho e como Portaria: anular recusado. Como **visitante** (sem login) e como conta **sem perfil**: leitura e escrita recusadas.
7. Anular multa `RECURSO_DEFERIDO`: botão não aparece e a API recusa. Multa `ANULADA`: não pode ser alterada por ninguém (inclusive ADM); mudar o status de volta é recusado.
8. Multa `EM_RECURSO` anulada: `recurso_texto` e anexos continuam; `recurso_status` não muda; morador vê "recurso encerrado".
9. Morador da unidade vê a multa anulada com selo "Anulada", o texto da seção 6 e sem botões de ciência/recurso.

Apagar:
10. Como ADM: apagar uma multa funciona; some da lista do morador e da equipe; existe linha nova em `audit_logs` com protocolo, unidade, tipo, valor, status, nome/papel/id de quem apagou, e **sem** nome do morador nem texto de recurso.
11. Como Síndico e como Subsíndico, via API direta, `delete` em `fines`: **0 linhas apagadas/recusado**; a multa continua. A tela não mostra o botão.
12. Como Conselho, Portaria, Morador (dono e outra unidade), visitante e conta sem perfil: `delete` recusado.
13. Se a gravação no histórico falhar (simular), a multa **não** é apagada.
14. Ninguém consegue editar ou apagar linhas de `audit_logs` pelo app.
15. Na tela, o diálogo de apagar aparece (via `DialogProvider`) com o texto da seção 7 e **só apaga ao confirmar**; cancelar não apaga.
16. A lista em Relatórios mostra as duas ações em frase legível, sem ids visíveis fora dos "Detalhes técnicos".
17. `scripts/qa/` ganha esses casos; migração rodada duas vezes seguidas no staging sem erro.

## 9. Riscos e a confirmar

- **R1. LGPD.** Motivo da anulação é texto livre visto pelo morador e pela equipe: aviso na tela para não incluir dado de terceiros. O registro de apagar guarda o mínimo (sem nome do morador, sem descrição). **A confirmar com advogado:** por quanto tempo guardar o histórico e se o morador pode pedir exclusão do registro.
- **R2. Prova do processo.** Apagar remove ciência, recurso e resposta: se houver disputa depois, o condomínio **perde a prova**; o histórico só prova que existiu e quem apagou. Mitigação: anular preserva tudo; apagar fica só para ADM e com confirmação forte. **A confirmar com advogado/síndico:** se é prudente manter o ADM apagando multa já ciente ou julgada, e se a administradora tem política própria de guarda.
- **R3. Cobrança.** Se a multa já foi encaminhada para a administradora, anular no Harmony **não cancela o boleto**. A tela de anulação deve lembrar: "Se esta multa já foi enviada para cobrança, avise a administradora." (D3 e o fluxo de cobrança ainda não existem; texto entra já.)
- **R4. Exceção de permissão.** A regra quebra o princípio "ADM = mesmas permissões do Síndico" (`src/lib/roles.ts`). Contas ADM são várias e compartilhadas por funcionários da administradora (e a de produção ainda usa senha fraca conhecida, pendência em `docs/produto.md`): **só ADM apaga** concentra a ação destrutiva na conta com maior risco de acesso indevido. Resolver a senha antes do lançamento do apagar. Pergunta ao dono: manter assim? (P6)
- **R5. Anulação como fuga.** Síndico pode anular multa de um recurso difícil. Mitigação: motivo obrigatório + histórico visível ao Conselho.
- **R6. Segurança.** Regra no banco, não só na tela; nada de rota de API com chave de serviço para anular/apagar. Migração primeiro no staging. Nenhum dado real de morador no repositório (público).
- **Jurídico, a confirmar com síndico/advogado:** se anular multa já notificada exige comunicação formal ao morador; se multa julgada pode ser anulada por quem a emitiu; quem tem competência para anular (síndico, conselho ou assembleia, conforme a convenção).

## 10. Fora desta entrega
- Reverter anulação (P1) e "reabrir" multa.
- Notificação/WhatsApp ao morador sobre anulação.
- Exigir justificativa para apagar, ou aprovação de um segundo perfil para apagar.
- Apagar em lote; limpar a base pelo painel.
- Bloquear apagar multa já julgada ou em recurso (decisão do dono: ADM apaga qualquer uma).
- Estados `CONCLUIDA`/cobrança, prazo de recurso (D1, D2, D3, D5 do spec antigo).
- Excluir os registros de histórico.
- Texto da ciência da multa: **não muda**.

## 11. Perguntas em aberto
- **P1.** Anulação pode ser revertida (ex.: anulada por engano)? Se sim, por quem, com motivo, e como fica o histórico. Hoje: não.
- **P2.** Mínimo de caracteres do motivo (sugerido 10) e se existem motivos padrão em lista.
- **P3.** Prazo de guarda do histórico (advogado).
- **P4.** O morador deve ler o motivo da anulação?
- **P5.** O morador deve ver quem anulou?
- **P6.** Manter "só ADM apaga" apesar do risco R4?
- **P7.** Anular multa já julgada (`RECURSO_INDEFERIDO`) precisa de ato formal? (advogado/síndico)

## 12. Trecho proposto para `docs/produto.md` (só após aprovação do dono)
- **Multa: anular e apagar (decidido 2026-10-02):** Síndico e Subsíndico só **anulam** (motivo obrigatório, garantido no banco, morador continua vendo "Anulada"); ADM anula (também com motivo) e **apaga** sem justificativa, sempre registrado em histórico (quem e qual multa, sem dado pessoal). Conselho, Portaria e Morador não anulam nem apagam. Exceção ao "ADM = mesmas permissões do Síndico". Reversão da anulação em aberto. Spec: `docs/specs/2026-10-02-anular-e-apagar-multa.md`.
