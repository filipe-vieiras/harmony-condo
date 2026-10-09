# Área de Configurações (v1: cota mínima do condomínio)

Data: 2026-10-09 · Autor: PM · Status: **pedido do dono em 09/10/2026; pronta para o developer junto da Fase 2 de reservas** · Repositório público: nenhum dado real aqui.

Nasce da decisão do dono (09/10/2026): "uma área de configurações com acesso somente do síndico, subsíndico e ADM... no futuro algumas outras coisas vão precisar entrar ali". Consumidor imediato: `docs/specs/2026-10-09-reservas-valor-pago-e-percentual.md` (percentual da cota nos espaços). Legenda: **FATO** = conferido; **RECOMENDO**; **SUPOSIÇÃO**.

## 1. Objetivo

Dar à gestão **um lugar único e seguro** para valores do condomínio que o sistema usa em cálculos. Na v1 há **um só campo**: a **cota mínima do condomínio (R$)**, base do valor em percentual dos espaços de reserva.

**Problema:** o síndico hoje reedita cada valor fixo de cada espaço a cada reajuste; e o sistema não tem onde guardar um número do condomínio sem pôr em tabela de unidade. **Sem a feature:** reajuste manual e valores defasados.

## 2. Quem acessa

| Perfil | Vê a área | Edita |
|---|---|---|
| **Síndico** | Sim | Sim |
| **Subsíndico** | Sim | Sim |
| **ADM** | Sim | Sim |
| Conselho | **Não** | Não |
| Portaria | **Não** | Não |
| Zelador | **Não** | Não |
| Morador | **Não** | Não |
| Provisório | **Não** | Não |

Em "Não": o **item some do menu** (conforto) e **o acesso direto pela URL e pela API é negado** (segurança de verdade, no banco, não só na tela). Quem entra na rota sem permissão é redirecionado ao início, sem tela de erro técnica. FATO: o menu já filtra por `ADMIN_ROLES` (`src/components/layout/Sidebar.tsx`), mas o menu não protege dado; a proteção é a RLS.

**Hierarquia entre perfis de gestão (`docs/produto.md`, 05/10):** **não se aplica.** A regra vale para ações sobre outra conta (redefinir senha, convidar). Configurar o condomínio não age sobre ninguém; Síndico, Subsíndico e ADM têm o mesmo poder. Se no futuro uma configuração for sensível a ponto de ser só do Síndico (ex.: transferir cargo), ela entra com regra própria e spec própria.

## 3. O que entra na v1

**Só "Cota mínima do condomínio (R$)".**
- Um campo de valor em reais (formato pt-BR), valor atual preenchido, botão "Salvar".
- Texto de ajuda: "Valor de referência usado para calcular os espaços cobrados em percentual. Vale só para novas reservas; as reservas já feitas não mudam."
- Ao salvar: confirmação simples ("Alterar a cota mínima para R$ X? Vale para novas reservas.").
- Estado "ainda não cadastrada": aviso "Cadastre a cota para poder usar valores em percentual nos espaços."
- Mostra "Atualizado por [nome] em [data]" (usa `atualizado_por`/`atualizado_em`).
- **Valor aceito:** maior que 0 e até R$ 100.000,00 (SUPOSIÇÃO, a confirmar com o dono); **não pode ser apagada** depois de cadastrada, só alterada (evita reserva sem base).
- Dados e regras do banco: seção 4 e 8 da spec de reservas (tabela `condominio_config` de linha única, função `definir_cota_minima`, migração 0048).

## 4. O que fica de fora da v1

- Qualquer outra configuração (ver seção 5: nenhuma é pedida hoje).
- Cota por unidade, mais de uma cota, histórico de cotas por vigência.
- Importar a cota do Superlógica.
- Configurações por perfil ou preferências pessoais (isso é "meu perfil", não "do condomínio").
- Nome do condomínio, logo, textos legais, modo do Livro de reclamações (o interruptor do Livro já tem seu lugar; **não mover** sem decisão).
- Lembrete de reajuste anual no sino (futuro).

## 5. Como crescer (padrão para novas configurações)

Regra para qualquer item novo:
1. **Tem que ser valor do condomínio inteiro** (não de unidade nem de pessoa) e usado pelo sistema em alguma regra. Preferência pessoal não entra.
2. **Uma coluna tipada em `condominio_config`** (linha única), com `check` de faixa no banco, adicionada por migração aditiva; **sem tabela chave-valor genérica** (validação no banco, RLS única, testável).
3. **Mesma proteção:** só `is_admin()` lê; só função `security definer` grava; auditoria pelo servidor **sem valores**. Se o item precisar de outro público, **não** relaxe a tabela: crie uma função de leitura que devolve só aquele item.
4. **Cada item novo ganha spec curta e o critério "o que muda se estiver em branco"** (como a cota: o banco recusa, nunca assume 0).
5. **Quando passar de ~5 itens ou ganhar vários grupos**, a tela vira seções com títulos (Reservas, Financeiro...); até lá, uma página simples com um cartão por configuração.
6. Item sensível ao ponto de dever ser só do Síndico exige regra própria de perfil (não herdar `is_admin()` por padrão).

**Candidatos futuros** (nada decidido, só o que o dono sugeriu em aberto, "outras coisas"): a perguntar quando surgirem; não construir "por precaução".

## 6. Onde aparece no menu

Item novo **"Configurações"** (ícone de engrenagem) no menu lateral, **depois de "Usuários & Convites" e "Autocadastro"** (fim da lista, área de gestão), visível só para `ADMIN_ROLES`. Rota `/configuracoes`. No celular entra no mesmo menu animado (alvo de 44px). Provisório e demais perfis: item ausente e rota negada. O texto da tela usa "Dona Wanda" onde citar o produto.

## 7. Registro no histórico de ações

Alterar a cota grava em `audit_logs` (módulo `SISTEMA`) pelo servidor, com `gravarAuditoria` (FATO: `src/lib/auditoriaServidor.ts`, como a #68): ação "Alterou a cota mínima do condomínio", executor (id, nome, perfil) e data; **sem o valor antigo nem o novo**, porque o Conselho lê o histórico (Relatórios & Auditoria) e a cota é da gestão. RECOMENDO que a gravação da auditoria e a alteração aconteçam **na mesma transação** (dentro da função do banco), para não existir alteração sem rastro; o developer decide a forma e justifica. Tentativas negadas (perfil sem permissão) não precisam de registro na v1.

## 8. Critérios de aceite (testáveis)

1. Síndico, Subsíndico e ADM veem "Configurações" no menu e abrem `/configuracoes`; Conselho, Portaria, Zelador, Morador e Provisório **não veem o item** e, ao abrir a URL, são redirecionados ao início sem erro técnico.
2. Por API (sessão de cada perfil): Síndico, Subsíndico e ADM leem e alteram a cota; os outros cinco perfis recebem negação ao ler a tabela, ao chamar a função e ao tentar `update` direto.
3. Cadastrar a cota R$ 1.200,00 mostra "Atualizado por [nome] em [data]" e o valor formatado em pt-BR ("R$ 1.200,00").
4. Valores inválidos (vazio, zero, negativo, texto, acima do teto) são recusados pelo banco, com mensagem em português na tela (também por API, sem passar pela tela).
5. Apagar a cota depois de cadastrada **não é possível** (campo não aceita vazio; a função recusa nulo).
6. Alterar a cota **não muda** reservas já feitas (soma de `valor_uso` antes e depois idêntica) e vale para as novas.
7. Alterar a cota gera exatamente **uma** linha em `audit_logs`, com executor e data, **sem valores**; essa linha aparece em Relatórios & Auditoria e não mostra a cota.
8. Sem cota cadastrada: tela mostra o aviso; salvar espaço percentual é barrado (spec de reservas, critério 14).
9. 375px: sem rolagem horizontal, alvos de 44px, teclado numérico no campo, rótulo e erros anunciados por leitor de tela.
10. `producao.sh checar` verifica a existência da tabela, da função e das policies após a 0048.

## 9. Riscos

- **Segurança (revisão obrigatória):** é a primeira tabela de configuração; a RLS e o `revoke` precisam ficar certos, porque este será o molde das próximas. Função `security definer` com `search_path` fixo e checagem de `is_admin()` dentro dela.
- **Número errado vira cobrança errada em todos os espaços percentuais.** Mitigação: teto, confirmação ao salvar, "Atualizado por" visível, reservas congelam o valor.
- **Escopo (gaveta de tudo):** a área atrai pedidos. Mitigação: regras da seção 5.
- **Suporte:** o síndico não achar a área ou não entender "cota mínima". Mitigação: texto de ajuda, aviso no cadastro do espaço percentual com link direto.
- **Acesso do ADM (administradora):** é conta de terceiro com o mesmo poder; pode alterar a cota. Aceito pelo dono ("síndico, subsíndico e ADM"); fica o registro de auditoria como rastro.
- **Migração em produção:** processo de `docs/processo-de-entrega.md` (uma por vez, banco antes do código, backup, `checar`).

## 10. Validação mais barata antes de construir

Mostrar ao síndico (via dono) um desenho simples da tela com "Cota mínima do condomínio (R$)" e perguntar: é este número que ele usa? Quem altera no reajuste? Se ele disser que a cota varia por unidade, **parar** e rever a decisão D1 da spec de reservas.
