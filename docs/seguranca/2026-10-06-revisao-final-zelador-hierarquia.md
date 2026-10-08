# Revisão de segurança FINAL: perfil de Zelador (#82) e hierarquia entre perfis de gestão (#68)

Data: 06/10/2026 · Escopo: migrações 0041 e 0042, rotas de API (resetar-senha, excluir, convites/enviar, transferir-cargo e
subrotas, reativar-zelador, unidades/excluir, autocadastro), `hierarquia.ts`, `alvoEfetivo.ts`, `textoLivre.ts`, `csv.ts`,
`auditoriaServidor.ts` · Ambiente de teste: somente staging (app local, contas `@staging.test`). Produção não foi tocada.
Este arquivo é local e sem commit. Sem segredos, sem dados pessoais. Os passos de exploração dos achados M-1 a M-3 ficam fora
deste arquivo de propósito (estão só na resposta ao dono).

Legenda: **[T]** confirmado por teste no staging · **[C]** lido no código · **[N]** não testado.

## Veredito (atualizado após o reteste das correções, 06/10/2026, rodada 2)

**Pode subir 0041 + 0042.** Não há falha Crítica nem Alta, nem antes nem depois do reteste. As correções de **M-1, M-2, M-3 e B-1
seguraram quando tentei quebrá-las** (staging, por API, com o token e o cookie de cada perfil). Sobraram 1 Baixa nova (B-5, resíduo do
M-1: senha já conhecida antes da promoção) e 3 Informativas novas (I-9 a I-11). Nenhuma impede a publicação.

Condições (as de antes que continuam valendo):

1. **Antes de aplicar (obrigatório, só leitura, feita pelo dono):** conferir em produção se existe `units.moradores` com nome em
   branco e `pending_invites` com nome em branco e **e-mail repetido** (a 0042 reprova a restrição de nome em branco e, se houver
   e-mail repetido na fila, avisa e NÃO cria o índice único: depois de limpar, rode a migração de novo). Unidade com morador antigo sem
   nome continua editável (o gatilho só confere morador novo ou alterado).
2. **Aplicar a migração e publicar o código na mesma janela:** a 0042 remove `pending_invites.link_acesso` (o código antigo quebra) e o
   código novo precisa de `convite_links` e da função `email_em_uso`.
3. Atualizar o Next para 16.3.6 antes da publicação (B-2). Não explorável hoje (o app não usa `next/og`).

| Severidade | Qtd | Achados |
|---|---|---|
| Crítica | 0 | |
| Alta | 0 | |
| Média | 0 abertas | M-1, M-2, M-3: **corrigidas e retestadas** (ver "Reteste") |
| Baixa | 4 abertas | B-2, B-3, B-4, B-5 (B-1 corrigida) |
| Informativa | 11 | I-1 a I-11 |

Legenda: **[T]** confirmado por teste no staging · **[C]** lido no código · **[N]** não testado.

## Reteste das correções (06/10/2026, rodada 2) [T]

Ambiente: staging local, contas `@staging.test`; produção não foi tocada. Os passos de ataque não estão neste arquivo (repositório público).

### M-1, M-2, M-3 e B-1 · CORRIGIDAS (primeira rodada: Médias e Baixa; reteste acima)
- **M-1** (Média): link de redefinição gerado por Subsíndico continuava valendo depois que a conta subia de cargo. Corrigida com
  `_invalidar_acesso_anterior` em `_trocar_cargo` e em `ativar_convite_zelador`. Retestada [T].
- **M-2** (Média): exclusão de unidade contornava a proteção da conta pendente. Corrigida no gatilho `units_sem_zelador` e nas rotas
  `unidades/excluir` e `autocadastro/decidir`. Retestada [T].
- **M-3** (Média): convite duplicado invalidava o link da conta existente ainda não confirmada. Corrigida com `email_em_uso` na rota,
  índice único `lower(email)` e checagem do Auth. Retestada [T].
- **B-1** (Baixa): gatilho de nome de morador travava dado legítimo e tinha lacunas. Corrigida com `nome_em_branco` única, tipo `array` e
  `nome` texto. Retestada [T].

### B-5 · Baixa · Senha que o atacante já conhecia antes da promoção continua valendo (resíduo do M-1) [T]
**Onde:** `_trocar_cargo` invalida links e sessões, mas não troca a credencial. **Evidência:** uma senha definida por um perfil de nível
menor (redefinição legítima de Subsíndico sobre conta de nível menor) continua entrando na conta depois que a conta vira Conselho (testei
com Conselho; o mecanismo é o mesmo para Síndico, a regra de promoção não muda). **Cenário:** Subsíndico mal-intencionado redefine a senha
de uma conta de nível menor, a pessoa não percebe ou aceita o "perdi o acesso" e a conta é promovida depois. Exige uma redefinição de
senha que fica na auditoria e que o dono da conta percebe (a senha dele para de funcionar), por isso Baixa. **Correção sugerida:** ao
promover conta existente para Síndico ou Subsíndico, mostrar na tela de transferência um aviso "esta conta teve a senha redefinida por
[cargo] em [data]" (a partir de `audit_logs`) e/ou sugerir que o Síndico gere um link de redefinição para a pessoa logo após; opcional:
trocar a senha por um valor aleatório no banco na promoção e entregar o link ao Síndico. **Esforço:** P a M. **QA confirma:** promover
conta cuja senha foi redefinida por Subsíndico: o aviso aparece (ou a senha antiga deixa de entrar).

### B-2 · Baixa · Dependências com avisos (npm audit)
Next 16.3.5 tem aviso crítico de RCE em `next/og` ImageResponse (corrigido na 16.3.6); o app não usa `next/og` (busca no código: nenhuma
ocorrência), então não é explorável hoje. `sharp` e `source-map-js` com avisos altos (DoS, build). Atualizar Next para 16.3.6 e rodar `npm audit fix`. **Esforço:** P.
Nenhum segredo encontrado em arquivos versionados desta rodada; `.env*` ignorados pelo git.

### B-3 · Baixa · `is_admin()`, `can_manage_reservations()`, `is_cadastro_provisorio()` e `get_my_unit_id()` ignoram `desativado_em` [C, tabela de funções]
Hoje só o Zelador é desativado (e Zelador não é admin), então nada é explorável. Se um dia a desativação valer para Síndico/Subsíndico/ADM,
essas funções os tratariam como ativos. Incluir `and desativado_em is null`. **Esforço:** P.

### B-4 · Baixa · Texto livre sem limite de tamanho nem de frequência [T/C]
Qualquer conta com perfil insere notificação para Síndico/Subsíndico/ADM/Zelador (`perfil_alvo`) e linha de auditoria própria com texto
livre sem teto de tamanho; o Zelador pode publicar avisos em sequência e cada um gera um sino para todos (sem limite de frequência).
Links de notificação são sempre internos (CHECK `notifications_link_interno`). **Correção:** teto de tamanho nos CHECK e limite diário de avisos do Zelador. **Esforço:** P.

### Informativas
- **I-1:** `GRANT` amplo a `anon` e `authenticated` em várias tabelas (inclusive TRUNCATE, TRIGGER, REFERENCES); a RLS protege leitura e escrita,
  o PostgREST não expõe TRUNCATE. Revogar o que o app não usa (hardening). Tabelas novas (`convite_links`, `unit_documentos`, `cargo_transferencias`,
  `space_blocks`) já nascem só com SELECT.
- **I-2:** funções de gatilho e utilitárias (`nivel_cargo`, `pode_agir_sobre`, `get_user_role`, ...) têm EXECUTE para anon; só devolvem booleano/papel do chamador. Revogar é opcional.
- **I-3:** redefinir a senha de uma conta não encerra as sessões já abertas dela (relevante para M-1). Considerar encerrar ao concluir a redefinição.
- **I-4:** UPDATE em `pending_invites` (e-mail, unidade, nome) por Síndico/Subsíndico não gera auditoria; só INSERT e DELETE.
- **I-5:** `avaliado_por` de reserva decidida por gestão (não Zelador) é o que o navegador manda; o Zelador já é forçado pelo banco.
- **I-6:** `convite_links` guarda o token do convite em claro até o convite ser apagado. Apagar a linha quando o convite for aceito ou expirar.
- **I-7:** `autocadastro/decidir` grava o e-mail do morador em `audit_logs.detalhes` (rota anterior a esta entrega); a regra "sem e-mail na auditoria" vale para o código novo.
- **I-9:** a classe "nome em branco" do banco (U+2065, ponto de código não atribuído, está na faixa `U+205F-U+206F`) é um pouco mais larga que
  a do formulário público (`textoVazio`: categorias Cc/Cf/espaço mais uma lista). Um titular com nome só de U+2065 passa no formulário
  público, mas o gatilho recusa a validação do autocadastro com "Erro ao atualizar a unidade" genérico [T]; a administração pode recusar o
  cadastro. Sem ganho para quem envia. Alinhar as duas listas ou mostrar mensagem específica. **Esforço:** P.
- **I-10:** um JWT de acesso emitido antes da promoção (validade de 1 hora no staging) continua aceito pelo PostgREST depois que a sessão é
  apagada (o PostgREST não consulta `auth.sessions`; o Auth e as rotas do app recusam: 403). Com o papel novo, o JWT antigo passa a ter
  os poderes do cargo novo até expirar [T]. Só importa para quem já tinha a sessão da conta antes da promoção (ver B-5). Se quiser fechar:
  encurtar a validade do JWT no painel do Auth (por exemplo 15 a 30 minutos).
- **I-11:** corrida entre `convites/enviar` e `transferir-cargo` (pessoa NOVA) para o MESMO e-mail: o Auth devolve o mesmo usuário às duas
  rotas e a rota de transferência, ao ser recusada ("convite_existente"), apaga o usuário do Auth que a fila acabou de usar; o convite da
  fila volta para ERRO (reenvio funciona) em 6 de 8 tentativas, e em 2 deu certo. Sem perda de dados nem tomada de conta; exige duas ações
  de Síndico/Subsíndico no mesmo segundo com o mesmo e-mail [T]. Correção: chamar `email_em_uso` e checar a fila antes de `generateLink`
  em `transferir-cargo`, e só `deleteUser` se o usuário foi criado por aquela chamada. **Esforço:** P.
- **I-8:** convite preso em ENVIADO sem link (queda entre a reserva do convite e a geração do link) não pode ser reenviado pela tela; só cancelar e refazer.

## LGPD (a confirmar com advogado)
- O Zelador (funcionário externo) lê nome, telefone e e-mail de todos os moradores e dependentes e os veículos, sem janela de tempo, sem
  documento. Bases e proporcionalidade a confirmar; sugerido termo de confidencialidade no primeiro acesso.
- Documento do titular fica em `unit_documentos`, visível só à gestão e ao próprio morador (Portaria, Conselho e Zelador: 0 linhas).
- Conta de ex-Zelador fica no banco desativada (histórico preservado): definir prazo de retenção e apagamento.
- Auditoria nova sem e-mail, telefone ou link. Aviso de privacidade: não revisado nesta rodada.

## Bateria do QA (scripts/qa/bateria.mjs, staging, depois do reteste) [T]
1211 verificações, 0 falhas ("TUDO OK"), incluindo as seções de hierarquia ([68]), do Zelador e a de M-1. Depois dela e dos meus testes
rodei `node scripts/seed-staging.mjs` para refazer a base.

## O que não foi testado
Produção (proibido); interface no navegador (o QA cobre) e o download real do CSV; envio de e-mail e o valor configurado de validade do OTP no
Auth; limite de requisições (só leitura do código); aceite de autocadastro contra conta de Zelador; corrida entre aceite e reativação;
política de CSP/HSTS (sem alterações nesta entrega; HSTS não está em `next.config.ts`, conferir na plataforma).
Reteste (rodada 2): edição de unidade com morador **antigo sem nome** (não dá para criar no staging, o gatilho vale também para service role; só leitura do código);
o valor real de validade do OTP e do JWT em produção; interface no navegador (o fluxo de aceite foi exercitado por API, a tela já faz `signOut` e redireciona para o login [C]);
produção (proibido).

## Issues sugeridas (não criadas)
(M-1, M-2, M-3 e B-1 já corrigidas e retestadas; não precisam de issue.)
1. Aviso de senha redefinida por outro perfil ao promover conta existente (B-5) · Baixa · P a M
2. Alinhar a classe de "nome em branco" do formulário público com a do banco (I-9) · Informativa · P
3. `transferir-cargo` (pessoa nova): checar `email_em_uso` e só apagar usuário criado por ela (I-11) · Informativa · P
4. Encurtar a validade do JWT no painel do Auth (I-10) · Informativa · P
5. Atualizar Next para 16.3.6 e dependências (B-2) · Baixa · P
6. Funções de papel respeitando `desativado_em` (B-3) · Baixa · P
7. Tetos de tamanho e frequência para texto livre (B-4) · Baixa · P
8. Endurecimentos informativos I-1 a I-8 · Informativa · P a M
