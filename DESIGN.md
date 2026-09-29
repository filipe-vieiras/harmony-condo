---
version: 1.0.0
name: Harmony Residence
description: Design system for Harmony Residence condo management web portal.
colors:
  primary: "#0E0E0C"
  primary-hover: "#2A2A26"
  secondary: "#3A3A34"
  accent: "#FF8A4C"
  accent-hover: "#F07535"
  accent-strong: "#B4501C"
  neutral-bg: "#F2EFE9"
  surface: "#FFFFFF"
  surface-hover: "#FAFAF7"
  border: "#E6E3DC"
  border-subtle: "#F4F3EF"
  text-primary: "#0E0E0C"
  text-secondary: "#57534C"
  text-muted: "#A8A39A"
  status-pending: "#2F5C96"
  status-approved: "#059669"
  status-rejected: "#DC2626"
  status-fine: "#B91C1C"
typography:
  headline-display:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: 32px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: 24px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: -0.01em
  headline-md:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.4
  body-lg:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
  body-md:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.4
  label-md:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: 13px
    fontWeight: 600
    lineHeight: 1.3
rounded:
  sm: 6px
  md: 10px
  lg: 14px
  xl: 20px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: "10px 18px"
  button-accent:
    backgroundColor: "{colors.accent}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: "10px 18px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    border: "1px solid {colors.border}"
---

# Harmony Residence - Design System

## Overview
O **Harmony Residence** expressa sofisticação, tranquilidade e transparência na vida condominial. A identidade visual nasce do logotipo oficial com a flor de lótus e gota em tons azul marinho profundo e ciano luminoso, transmitindo serenidade, rigor institucional e acolhimento comunitário.

### Regras de Uso Obrigatório do Logotipo (`src/images/logo.png` / `/images/logo.png`):
1. **Tela de Login / Autenticação:** Apresentação de destaque centralizada sobre fundo gradiente azul nobre.
2. **Header de Navegação das Páginas:** Exibição elegante e nítida no canto superior esquerdo com altura adequada (36px a 44px).
3. **Relatórios e Vias Impressas:** Presença no cabeçalho de atas, comprovantes de reserva e notificações de multa para conferir fé e autoridade institucional.

## Colors
Identidade aprovada no style tile de 29/09/2026 (direção D, tangerina). Os valores vivem em `src/app/globals.css` (`@theme`); no código, use só as classes dos tokens (`bg-primary`, `text-accent-strong`, `bg-pendente-50`…), nunca cor fixa (`bg-[#...]`).
- **Primary (`#0E0E0C`):** Tinta, um preto quente. Menu, botões principais e cabeçalhos.
- **Accent (`#FF8A4C`):** Tangerina, a cor da marca. Só como FUNDO com texto preto (cartão de próxima ação, aba ativa, botão de destaque) e em ícones. No máximo 2–3 pontos por tela.
- **Accent strong (`#B4501C`):** Tangerina escura. A única versão do destaque para TEXTO, links e anéis de foco sobre fundo claro (5,5:1).
- **Neutral Background (`#F2EFE9`):** Off-white quente. Cinzas (`slate-*`) remapeados para tons quentes.
- **Surface (`#FFFFFF`):** Cartões e formulários.
- **Status Cores:**
  - Pendente (`pendente-*`, azul-claro): aguardando ciência, validação ou aprovação. Não usar âmbar/laranja para status: confunde com a marca.
  - Aprovado/validado (`emerald-*`).
  - Recusado, multa e urgente (`red-*`).

## Typography
- **Títulos (h1/h2, `font-display`):** Bricolage Grotesque.
- **Texto:** Plus Jakarta Sans. Ambas pelo `next/font` (hospedadas no próprio site, sem pedido ao Google).

## Layout
- Grid responsivo de 12 colunas para desktop.
- Menu lateral adaptativo (Sidebar) colapsável no mobile para facilitar a operação rápida da Portaria e o acesso dos moradores.
- Cartões organizados por densidade de informação para rápida visualização.

## Elevation & Depth
- Cartões com elevação sutil (`shadow-sm` a `shadow-md`), sem sombras escuras artificiais.
- Modais e popovers com backdrop translúcido suave (`backdrop-blur-sm`).

## Shapes
- Cantos arredondados modernos e suaves (`rounded-xl` em cards, `rounded-lg` em botões e inputs).

## Do's and Don'ts
- **DO:** Manter alto contraste de leitura para todas as tabelas e formulários.
- **DO:** Usar badges coloridos claros com texto escuro para status (`bg-pendente-50 text-pendente-800`).
- **DON'T:** Usar temas roxos/violetas (proibido pelas diretrizes do projeto).
- **DON'T:** Texto branco sobre tangerina, ou texto em tangerina pura sobre fundo claro (contraste insuficiente).
- **DON'T:** Poluir visualmente o painel da portaria — a busca de placa deve ser o centro das atenções.
