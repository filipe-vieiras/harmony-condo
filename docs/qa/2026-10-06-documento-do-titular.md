# QA: documento do titular em tabela própria (issue #67, migração 0040)

Data: 06/10/2026. Ambiente: staging, app local (`npm run dev`), contas `@staging.test`.
Escopo: documento (RG/CPF) do titular fora do conteúdo compartilhado das unidades; leitura só
para a gestão (Síndico, Subsíndico, ADM) e para o próprio morador.

## Resultado por grupo

| Grupo | Resultado |
|---|---|
| 1. Gestão (Síndico, Subsíndico, ADM) | PASSOU |
| 2. Fluxo do autocadastro | PASSOU |
| 3. Portaria, Portaria2, Conselho, Conselho2 | PASSOU |
| 4. Morador, inquilino, provisório, candidatos, visitante, conta sem perfil | PASSOU |
| 5. Dados e migração (somente leitura) | PASSOU |
| 6. Regressão | PASSOU (com ressalvas leves abaixo) |

## O que foi conferido

1. Gestão: a edição da unidade mostra o documento; salvar e recarregar mantém; limpar o campo apaga;
   salvar outros campos não perde o documento; unidade nova com moradores grava com id; remover
   morador remove o documento dele; a exportação da planilha (Síndico, Subsíndico e ADM) traz o
   documento e abre sem erro; excluir a unidade remove o documento junto.
2. Autocadastro: o documento do envio chega à tabela nova e não ao JSON de unidades; aparece para a
   gestão; a recusa não deixa documento solto; placa, perfil validado e demais dados seguem corretos.
3. Telas e API de Portaria, Portaria2, Conselho e Conselho2 (inclusive o titular de unidade, com
   documento cadastrado na própria unidade): responsável, telefone e e-mail aparecem; nenhum
   RG/CPF no HTML nem no texto; leitura de units, da tabela de documentos, do diretório de unidades
   e do autocadastro sem documento; escrita direta e a função de gravação recusadas.
4. Morador e inquilino leem só o documento da própria unidade (API); a tela do morador não exibe
   documento. Provisório, candidatos, visitante e conta sem perfil não leem nenhum. Telas de
   Usuários e Lista de Unidades sem quebra.
5. Nenhuma unidade com a chave do documento no JSON; todo morador com id; contagem de documentos
   na tabela conferiu com o seed (2) depois de rodar o seed.
6. Vínculo de unidade a conta existente (com documento), diretório do provisório, veículos,
   reservas, autocadastro e usuários abrem sem 5xx; 375px sem rolagem horizontal nas telas
   testadas (moradores com modal, veículos, reservas, autocadastro, usuários).
   `node scripts/qa/bateria.mjs`: 823 checks, TUDO OK. `node scripts/seed-staging.mjs` rodado ao final.

## Bugs

- Bloqueia: nenhum.
- Grave: nenhum.
- Leve: nenhum atribuível à mudança.

## Observações (não são falhas da correção)

- O documento enviado no formulário público continua guardado também na tabela de envios do
  autocadastro depois de validar ou recusar. Só a gestão e o dono do envio leem essa tabela, então
  não reabre a exposição para Portaria e Conselho. Vale decidir se esse segundo registro deve ser
  limpo após a decisão (retenção, LGPD).
- A tela de edição não tem campo de documento para dependentes (só para o titular); a coluna da
  planilha para dependentes sai vazia. Comportamento anterior à mudança.

## Não testado

- Abrir a planilha no Excel de verdade: o conteúdo foi lido do arquivo gerado pelo navegador (aba e
  células), não aberto no aplicativo.
- Recusa com documento já migrado em unidade antiga (só o caminho normal foi exercido).
- Celular real (WebKit); a verificação de 375px foi por emulação do painel.
- Produção, por regra.

## Dados de teste

Os dados criados durante o teste foram ajustados pelo seed (`node scripts/seed-staging.mjs`),
rodado ao final.
