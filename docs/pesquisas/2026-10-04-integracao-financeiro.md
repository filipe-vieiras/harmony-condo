# Pesquisa técnica: integração para uma feature financeira no Harmony

Data: 2026-10-04. Autor: agente `developer` (modo pesquisa; nenhum código, migração ou dado real tocado).
Regra do documento: fato externo leva fonte; preço e opinião de blog = "a confirmar"; esforço P/M/G = suposição.
Não é parecer jurídico nem contábil: tudo marcado "a confirmar com advogado/contador" precisa dessa validação.

## 1. Recomendação (primeiro)

**Próxima fase: Opção 2, mas só depois de uma resposta do dono sobre qual sistema a administradora usa.**
Enquanto isso, entregar a Opção 1 (atalho para o portal da administradora, issue #21), que não depende de nada.

Motivo: a decisão em `docs/produto.md` é "não cobrar dinheiro de terceiros por enquanto" e "a administradora emite os boletos". Cobrança própria (Opção 3) cria o Harmony como intermediário de dinheiro de moradores (regulação, KYC do condomínio, conciliação, suporte a inadimplência) e é o oposto do que o dono decidiu. A leitura via API da administradora (se ela liberar) entrega o valor visível ao morador (2ª via e situação) sem mover dinheiro.

Achado importante: a Superlógica tem API pública que cobre "2ª via", "Receitas", "Despesas", "Prestação de contas" e "CRM de Cobrança", com `app_token` + `access_token` gerados dentro do ERP pela própria administradora ([API Condomínios](https://apicondominios.superlogica.com/); a criação do token pela administradora vem de resultado de busca (URL base api.superlogica.net/v2/condor), a confirmar na doc oficial). Não consegui ler os detalhes dos endpoints (a página carrega por script e o PDF é binário): **detalhes de endpoint, escopo do token (se dá para limitar a só leitura) e custo ficam "a confirmar" na prova de conceito**.

## 2. Tabela comparativa (máx. 8)

Legenda: Esf. = esforço (suposição). Dep. = risco de dependência.

| # | Candidato | Camada | API/doc | Auth | Webhook | Sandbox | Custo | Serve a 1 / vários | Esf. | Dep. |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **Superlógica Condomínios (API Condomínios)** | A | Sim, pública: [apicondominios.superlogica.com](https://apicondominios.superlogica.com/); seções incluem Unidades, Receitas, Despesas, 2ª via, Prestação de contas, CRM de Cobrança | `app_token` + `access_token`, criados no ERP pela administradora (Todos os usuários > API > Aplicações) | Não confirmado | Não confirmado | A confirmar (contrato da administradora) | 1: sim, se a administradora usa e libera. Vários: um token por administradora/condomínio | M | Alto: depende da administradora e do plano dela |
| 2 | **uCondo** | A | Não achei API pública aberta para terceiros; só menção a integração bancária via API/CNAB ([uCondo](https://www.ucondo.com.br/institucional)). Contatar suporte | A confirmar | A confirmar | A confirmar | A confirmar | A confirmar | Desconhecido | Alto |
| 3 | **CondoConta Open API** | A/B | Existe página pública ([api-open.condoconta.com.br](https://api-open.condoconta.com.br/)) com tópicos de auth, endpoints de cobrança/boleto, elegibilidade e preços; não consegui ler o conteúdo | A confirmar | A confirmar | A confirmar | A confirmar | A confirmar | Desconhecido | Alto (só serve se a administradora usa a CondoConta) |
| 4 | **Asaas** | B | Sim: [docs.asaas.com](https://docs.asaas.com/docs/visao-geral). Boleto, Pix, cartão, split, subcontas | `apiKey` por conta; subconta recebe `apiKey` (mostrada uma vez) e `walletId` ([subcontas](https://docs.asaas.com/docs/criacao-de-subcontas)) | Sim. Header `asaas-access-token`; entrega "at least once" (duplicados), fila pausa após 15 falhas e descarta eventos após 14 dias ([webhooks](https://docs.asaas.com/docs/sobre-os-webhooks)) | Sim, independente da produção; até 20 subcontas/dia ([sandbox](https://docs.asaas.com/docs/testando-no-sandbox)) | Pix/boleto: R$ 0,99 promocional por 3 meses, padrão R$ 1,99 por cobrança recebida; cartão 1,99% + R$ 0,49 à vista ([preços](https://www.asaas.com/precos-e-taxas)). A confirmar | 1: sim (conta do condomínio). Vários: subcontas por condomínio; subconta nova tem fase de avaliação (até 10 subcontas, R$ 2.000 em cobranças cada, até 60 dias) | M a G | Médio: troca de PSP é trabalhosa por causa do histórico de cobranças |
| 5 | **Efí (ex-Gerencianet)** | B | Sim: [dev.efipay.com.br](https://dev.efipay.com.br/en/docs/api-pix/cobrancas-imediatas/) | OAuth2 + certificado; Pix exige mTLS no webhook ([credenciais](https://dev.efipay.com.br/en/docs/api-pix/credenciais/), [webhooks](https://dev.efipay.com.br/en/docs/api-pix/webhooks/)) | Sim | Sim (Pix: valores de R$ 0,01 a R$ 10,00 confirmam e disparam webhook; acima disso ficam ativos) | A confirmar | Mais voltado a conta própria; marketplace a confirmar | M a G | Médio. mTLS é mais atrito na Vercel (a confirmar se dá para terminar mTLS lá) |
| 6 | **Pagar.me** | B | Sim: [docs.pagar.me](https://docs.pagar.me/docs/webhooks). 40+ eventos, recebedores (marketplace), reenvio manual de webhooks | A confirmar nesta pesquisa | Sim, com retentativa | A confirmar | A confirmar | Marketplace com recebedores: serve a vários | M a G | Médio |
| 7 | **Conta Azul** | C | Sim, OAuth2 ([developers.contaazul.com](https://developers.contaazul.com/guide)); 600 chamadas/min por conta; **sem webhook nativo (usa polling)**; sem sandbox dedicado, mas conta de desenvolvimento de 30 dias ([FAQ](https://developers.contaazul.com/faq)) | OAuth2 Authorization Code | Não | Conta dev de 30 dias | Custo do plano para API: a confirmar | É ERP de empresa, não de condomínio: encaixe fraco | G | Médio. Condomínio costuma ter contabilidade em outro lugar |
| 8 | **Open Finance Brasil** | C | Sim, padrão do Banco Central ([desenvolvedor](https://openfinancebrasil.atlassian.net/wiki/spaces/OF/pages/37945515)). Iniciação de Pix exige credenciamento como TPP, certificação FAPI/mTLS e notificação ao BC ([Celcoin](https://celcoin.com.br/articles/como-usar-apis-open-finance/), fonte secundária) | FAPI, mTLS, consentimento | Padronizado | Sim (ambiente de certificação) | Via intermediário (a confirmar) | Serve a vários, mas por intermediário | G | Alto (regulatório); **não vale agora** |

Não avaliados por limite de escopo: Stripe Brasil, Mercado Pago, Iugu, Cora, Banco Inter, Omie, Condomínio21, Neocondo, Habitta, Vivver, ComunidadeFeliz. A busca não trouxe documentação pública deles nesta rodada; ficam como pendência se a Opção 3 avançar.

## 3. Arquitetura recomendada (simples e segura)

Princípios (valem para as Opções 2 e 3):
- **O Harmony nunca guarda número de cartão.** Cartão, se existir, é checkout hospedado do PSP. Boleto e Pix são só código de barras/QR devolvidos pela API.
- **Segredos só no servidor.** Tokens da administradora (`app_token`, `access_token`) e `apiKey`/token de webhook do PSP ficam em variáveis de ambiente do servidor (Vercel), nunca em `NEXT_PUBLIC_*`, nunca em log, nunca na resposta, nunca no navegador. Se a administradora gerar tokens por condomínio, guardar cifrados e usar só em `src/app/api/`.
- **Navegador nunca chama o terceiro.** O morador chama uma rota nossa (`src/app/api/financeiro/...`); a rota valida a sessão, resolve a `unit_id` do usuário pelo banco (nunca por campo de texto) e só então chama o terceiro com a service role/token. O navegador recebe apenas o necessário (valor, vencimento, status, linha digitável/URL do boleto).
- **Cache local, não espelho completo.** Opção 2: tabela `cobrancas_cache` (unit_id, competência, valor, vencimento, status, id externo, última sincronização). Guardar o mínimo; sem CPF, sem histórico de outras unidades.
- **RLS:** morador lê só linhas da própria `unit_id`; Síndico/Subsíndico/ADM leem as da unidade que gerenciam; **Portaria e Conselho (a decidir pelo dono) não leem**; ninguém escreve pelo cliente (só a rota de servidor/webhook). Revisar `GRANT` (Supabase dá ALL a anon/authenticated por padrão). Bloquear morador provisório. Nunca expor situação de pagamento na lista de unidades (já é regra do `docs/produto.md`).
- **Webhooks (só Opção 3 ou se a administradora oferecer):** rota `POST /api/webhooks/<provedor>`; validar o segredo/assinatura (Asaas: header `asaas-access-token`, comparado em tempo constante); tabela `webhook_eventos` com `id_evento` único para **idempotência** (o provedor entrega "at least once"); responder 200 rápido e processar com segurança; reconciliar periodicamente via API porque a fila do provedor pode pausar. Sem usuário logado: a rota usa service role, mas só escreve nas tabelas financeiras.
- **Auditoria:** registro imutável (só INSERT) de quem consultou/gerou 2ª via/mudou status, com ator e unidade; sem valores além do necessário.
- **LGPD:** situação financeira é dado pessoal sensível ao contexto (não é "sensível" pelo art. 5º, mas expõe inadimplência). Mapear base legal (execução de contrato/legítimo interesse: a confirmar com advogado), minimização, prazo de retenção, e DPA com cada terceiro (administradora e PSP). Onde ficam os dados do terceiro (região) é "a confirmar".
- **Falha segura:** se a API da administradora cair, a tela mostra "não foi possível consultar agora" com o atalho do portal (Opção 1). O Harmony nunca afirma "pago" ou "em aberto" sem a data da última sincronização visível (a lição da planilha descartada).

## 4. Três opções de escopo

| | Opção 1: atalho para a 2ª via | Opção 2: consulta via API da administradora | Opção 3: cobrança própria com PSP |
|---|---|---|---|
| O que é | Botão/link para o portal da administradora (issue #21) | Morador vê boletos/2ª via e situação da própria unidade; síndico vê panorama | Harmony emite boleto/Pix, concilia, cobra multas/reservas |
| Prós | Horas de trabalho; zero risco; zero dado financeiro nosso | Valor real ao morador; sem mover dinheiro; fonte da verdade continua na administradora | Controle total; serve a futuros clientes sem administradora |
| Contras | Morador sai do app | Depende de a administradora usar um sistema com API e liberar token; escopo de leitura incerto | Maior esforço, suporte e responsabilidade |
| Riscos | Baixo | Dependência do terceiro; dado desatualizado; LGPD de situação financeira; token com mais permissão que o necessário | **Dinheiro de terceiros: regulatório (a confirmar com advogado/contador)**; KYC do condomínio; conciliação; chargeback; contradiz decisão atual |
| Esforço (suposição) | P (horas) | M (1 a 2 semanas após confirmar a API) | G (semanas; mais jurídico/contábil) |
| Depende de | Nada | Resposta do dono (pergunta 1) e autorização da administradora | Respostas 2 e 3 do dono |

**Recomendação: Opção 1 agora; Opção 2 como próxima fase, condicionada à resposta da administradora. Opção 3 só com demanda concreta.**

Notas sobre a Opção 3 (para quando chegar a hora; nada concluído juridicamente):
- Recebedor: o condomínio (CNPJ próprio) deve ser o titular da conta de recebimento; subconta/marketplace por condomínio no PSP. No Asaas só pessoa jurídica cria subconta e a subconta passa por avaliação inicial ([subcontas](https://docs.asaas.com/docs/criacao-de-subcontas)). Quem assina o cadastro (síndico, administradora) e se o Harmony pode operar subcontas de terceiros: **a confirmar com advogado/contador**.
- Split no Asaas exige que cada recebedor tenha conta Asaas e é calculado sobre o valor líquido ([split](https://docs.asaas.com/docs/split-de-pagamentos)); se o Harmony cobrar comissão, isso muda o enquadramento regulatório: **a confirmar**.
- Já existe a administradora emitindo boletos; cobrar em paralelo gera conflito de fonte da verdade e de conciliação.

## 5. O que preciso do dono (máx. 3 perguntas)

1. **Qual sistema a administradora usa** (Superlógica, uCondo, CondoConta, outro) e ela aceita gerar um token de API só de leitura para o Harmony?
2. **Se um dia o Harmony cobrar, quem seria o recebedor** (conta do condomínio com CNPJ próprio, ou da administradora)?
3. **O objetivo é consultar (mostrar boleto e situação) ou cobrar (emitir e receber)?** Hoje a decisão registrada é só consultar.

## 6. Prova de conceito barata e segura (sem dado real)

Objetivo: provar que conseguimos ler 2ª via/situação por unidade com um token limitado, sem tocar em morador real.
1. Conversar com a administradora (pergunta 1) e pedir um **ambiente de teste ou um condomínio fictício** com 2 unidades e 3 boletos inventados. Sem isso, **parar**: não usar dados reais.
2. Gerar um token só de leitura (se o sistema permitir) e guardar só em `.env.local` (staging) e nunca no repositório (repositório é público).
3. Script isolado em `scripts/` (fora do app), que chama 1 endpoint de consulta de 2ª via e imprime só campos não sensíveis; confirmar autenticação, formato, paginação, latência, limites e mensagens de erro.
4. Se a Opção 3 for explorada em paralelo: criar conta **sandbox** do Asaas (independente da produção, [sandbox](https://docs.asaas.com/docs/testando-no-sandbox)), criar 1 cobrança de teste e configurar 1 webhook com `asaas-access-token`; verificar duplicidade (mandar o mesmo evento 2 vezes) para provar idempotência.
5. Registrar no fim: endpoints usados, escopo mínimo do token, custo, SLA, o que falta. Só então escrever a especificação em `docs/specs/` e a migração (RLS primeiro), no staging.
6. Critério de parada: administradora sem API, token amplo demais sem opção de restrição, ou contrato que proíba o repasse de dados ao morador.

## Fontes
- https://apicondominios.superlogica.com/ (seções da API; autenticação por tokens gerada na administradora vem de resultado de busca, detalhes a confirmar)
- https://docs.asaas.com/docs/sobre-os-webhooks · https://docs.asaas.com/docs/criacao-de-subcontas · https://docs.asaas.com/docs/split-de-pagamentos · https://docs.asaas.com/docs/testando-no-sandbox · https://www.asaas.com/precos-e-taxas
- https://dev.efipay.com.br/en/docs/api-pix/webhooks/ · https://dev.efipay.com.br/en/docs/api-pix/credenciais/
- https://docs.pagar.me/docs/webhooks
- https://developers.contaazul.com/guide · https://developers.contaazul.com/faq
- https://openfinancebrasil.atlassian.net/wiki/spaces/OF/pages/37945515 · https://celcoin.com.br/articles/como-usar-apis-open-finance/ (secundária)
- https://api-open.condoconta.com.br/ · https://www.ucondo.com.br/institucional
