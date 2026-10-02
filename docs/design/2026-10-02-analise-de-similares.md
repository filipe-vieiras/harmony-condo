# Análise de similares e direções visuais do Harmony (2026-10-02)

Pedido do dono: "o design está muito padrão". Restrições: paleta azul (#0B2545 / #00A8E8) e fontes atuais ficam; tangerina e o redesenho do Início do morador foram rejeitados.

## Diagnóstico (visto em staging, 1280x800 e 375px, conta de síndico)
1. **Cartões iguais**: Início = faixa azul + 4 cartões brancos idênticos (rótulo, número, legenda) + lista de atalhos igual. Nada é "o" destaque; tudo tem o mesmo peso.
2. **Cor só funcional**: azul no cabeçalho, o resto é branco/cinza; ciano aparece em ícones pequenos. Sem momento de marca fora do cabeçalho.
3. **Ícones genéricos** (lucide em quadradinho colorido) e marca de lótus quase invisível (marca-d'água no cabeçalho; logo quadrado opaco de 32px). Parece template SaaS.
4. **Voz neutra/institucional**: "Painel de controle geral: gestão administrativa...", "Portal Condominial". Informa, mas não acolhe; sem nome do prédio, sem referência ao dia/estado real.
5. **Vazios e ritmo**: estados vazios são texto cinza; espaçamento uniforme (sem respiro maior entre blocos); sem motion além de hover; sem fotografia nem textura.

## Similares e referências
| Produto | O que faz diferente (visual) | Copiar | Evitar | Fonte |
|---|---|---|---|---|
| uCondo (BR) | App com 40+ funções, assistente de IA "Móra", pitch de transparência; visual limpo mas de catálogo de funções (a confirmar: telas só vistas em loja) | Rosto/nome para o assistente; confirmação de leitura visível | Grade de dezenas de módulos | https://www.ucondo.com.br/blog/aplicativo-ucondo-como-funciona-o-sistema-ucondo-para-condominios |
| Condo Control (EUA) | Reserva de espaço com fotos dos ambientes, regras e taxa na mesma tela; encomenda com foto e QR | **Fotografia das áreas comuns na reserva**; encomenda com foto | Excesso de módulos corporativos | https://www.condocontrol.com/resident/amenity-booking/ |
| Buildium Resident Center | Portal utilitário; avaliações criticam interface e desempenho | Simplicidade de tarefas (pagar, pedir) | Visual de formulário administrativo | https://play.google.com/store/apps/details?id=com.buildium.resident.android&hl=en_US |
| AppFolio | App do morador mais polido e mais bem avaliado; modernidade vem de acabamento, não de enfeite (a confirmar nas telas) | Acabamento consistente | Copiar sem validar | https://www.buildium.com/blog/appfolio-review/ (fonte de concorrente, viés) |
| Nubank | Sistema de ilustração com transparências, profundidade e tom leve em passos burocráticos | **Ilustração própria + microcopy que desarma burocracia** | Roxo (proibido) e excesso de brincadeira em multa | https://www.behance.net/gallery/226297413/Nubank-Illustration-system |
| Monzo | Voz em 3 princípios (gentileza direta, magia cotidiana, humor leve), humor calibrado por canal, sem voz passiva | **Guia de tom por situação**: aviso/multa sério, vazio/sucesso caloroso | Humor em assunto sério | https://www.copystyleguide.com/monzo-tone-of-voice |
| Airbnb | Tela branca, fotografia como protagonista, um único acento, cantos suaves, uma fonte própria | **Foto no lugar de ícone** onde houver imagem real do prédio | Depender de fotos que o condomínio não tem | https://superdesign.dev/blog/airbnb-design-system |
| Linear | "Interface mais calma": cabeçalhos consistentes, ícones redesenhados, navegação mais escura que o conteúdo; vazios mínimos (ícone, frase, 1 ação) | Hierarquia por contraste de fundo; vazios curtos | Minimalismo frio demais para leigo/idoso | https://linear.app/now/behind-the-latest-design-refresh |
| Apple Home / widgets | Informação mínima relevante "num relance" | Resumo de estado em uma linha | (nada específico verificado: a confirmar) | https://developer.apple.com/design/human-interface-guidelines |

Leitura: os similares de condomínio são utilitários; quem tem personalidade (Nubank, Monzo, Airbnb) a constrói com **ilustração própria, voz e imagem real**, não com cor nova. Isso cabe na restrição do dono.

## Três direções

### A. "Lótus em movimento" (marca e ilustração próprias)
- **Conceito**: o lótus e a gota do logotipo viram um pequeno sistema visual (formas orgânicas) que dá assinatura ao produto.
- **Muda**: ícones de módulos redesenhados em traço único arredondado, 2 cores (azul + ciano) para 8 a 10 itens principais; 6 ilustrações simples (SVG, <3 KB cada) para vazios e sucesso; textura de ondas/pétalas sutil no cabeçalho em SVG (substitui a marca-d'água borrada); logotipo horizontal (já pendente, dono fornece). Raios mantidos. Motion: gota que "preenche" ao concluir ação (200 ms, respeita prefers-reduced-motion). Voz: sem mudança.
- **Início do morador (375px)**: igual à estrutura atual reordenada (sem repetir o redesenho rejeitado); cabeçalho com onda sutil e lótus nítido; avisos com ícone próprio; vazio "Tudo em dia" com ilustração de lótus.
- **Início do síndico (desktop)**: faixa azul com a mesma textura; 4 cartões de número com ícone próprio e o cartão que exige ação (recursos em análise) em destaque de tamanho 2x; vazios ilustrados.
- **Esforço**: M (ilustrações e ícones são o grosso; código é pouco). **Risco**: baixo técnico; médio de qualidade se ilustrar sem designer (mitigar com formas geométricas simples).

### B. "Voz do prédio" (microcopy e fotografia do condomínio)
- **Conceito**: o Harmony fala como o porteiro simpático e mostra o prédio real.
- **Muda**: guia de tom por situação (acolher em vazios e sucesso; sério e claro em multa/recurso; nunca humor em multa); saudação contextual ("Boa tarde, Maria. Seu salão está confirmado para sábado"); foto real das áreas comuns (salão, churrasqueira, piscina) nas reservas e na capa do Início (WebP otimizado, ~40 KB, carregamento preguiçoso); nome do condomínio e da unidade no cabeçalho. Sem mudar cor, fonte ou ícones.
- **Início do morador (375px)**: cabeçalho com foto da fachada em azul-marinho translúcido (contraste do texto 4,5:1 garantido pela camada), saudação com nome, linha de estado única ("Nada pendente" / "1 aviso novo"), mesmos blocos de hoje.
- **Início do síndico (desktop)**: capa fina com foto, resumo do dia em frase ("2 recursos em análise, 0 reservas esperando você") acima dos cartões.
- **Esforço**: P a M (texto + 4 a 6 fotos fornecidas pelo condomínio). **Risco**: depende de o síndico fornecer fotos e autorização de imagem (LGPD: nada de pessoas); foto pesada no celular se mal otimizada.

### C. "Hierarquia calma" (acabamento estilo Linear/AppFolio)
- **Conceito**: menos cartões iguais, mais contraste de importância e ritmo.
- **Muda**: três níveis de cartão (destaque = fundo azul-marinho ou borda ciano de 2px; padrão; discreto sem borda, só fundo); espaçamento em escala maior entre seções (32 a 40px) e menor dentro; números em Bricolage maior (36px+); sidebar um tom mais escuro que o conteúdo; transições de página e skeletons; ícones continuam lucide mas com um só estilo (sem quadradinho colorido).
- **Início do morador (375px)**: um cartão destaque azul (o que importa hoje) + lista de avisos como linhas, sem caixas; atenção: isso se aproxima do "cartão de próxima ação" rejeitado, só faça se o dono explicar o que não gostou.
- **Início do síndico (desktop)**: 1 cartão grande de "precisa de você" e 3 números pequenos ao lado; atalhos como linhas, não cartões.
- **Esforço**: M. **Risco**: médio, é o mais próximo do que foi rejeitado e mexe em todas as telas.

## Recomendação: A + a voz da B (começar por vazios e microcopy)
Tomo posição: **A como direção, com 1 fase de B embutida**. Motivos: ataca "genérico" onde nasce (ícone e marca), custa pouco, não toca na paleta, nas fontes nem no layout do Início rejeitado, e a voz é quase grátis. C fica para depois, e só após descobrir o porquê da rejeição anterior. Fotografia (B) só se o condomínio fornecer as fotos.

### Fases (cada uma vira uma issue)
1. **Marca**: logo horizontal transparente (dono fornece) + lótus SVG nítido no cabeçalho do Início, login e impressões (P).
2. **Guia de tom + microcopy** do Início, vazios e sucessos, em `docs/design/tom-de-voz.md` e nas telas (P).
3. **Estados vazios ilustrados**: 6 SVGs (mural, reservas, veículos, multas, autocadastro, busca sem resultado) com um componente `EstadoVazio` (M).
4. **Ícones próprios** dos 8 a 10 módulos do menu e dos atalhos, tokens em `globals.css` e regra no DESIGN.md (M).
5. **Textura do cabeçalho** (SVG leve) e gota de confirmação (motion discreto, com reduced-motion) (P).
6. **Destaque por tamanho** no Início do síndico: o cartão com ação pendente maior que os demais (P; só no desktop do síndico, sem tocar no morador).
7. Opcional: fotos das áreas comuns na reserva (M, depende do condomínio).
Regras de todas as fases: contraste 4,5:1, alvo de 44px, SVG inline pequeno (sem biblioteca nova), medir peso da página no celular antes e depois.

### Validar barato antes de construir
- Montar (sessão principal) um **style tile estático em HTML/Figma** com 3 telas (Início morador, Início síndico, vazio de reservas) em A, e um **teste de preferência de 5 segundos** com 5 a 8 moradores e o síndico via WhatsApp (imagem simples: "qual passa mais confiança? qual é mais amigável?"), mais 1 pergunta aberta.
- Antes disso, **perguntar ao dono o que não agradou** no Início rejeitado e o que exatamente é "padrão" (mostrar 2 ou 3 apps que ele acha bonitos).
- Em staging, fazer um piloto só da fase 3 (vazios) com um morador de confiança.
