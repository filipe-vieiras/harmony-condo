---
version: 1.0.0
name: Harmony Residence
description: Design system for Harmony Residence condo management web portal.
colors:
  primary: "#0B2545"
  primary-hover: "#134074"
  secondary: "#1D4E89"
  accent: "#00A8E8"
  accent-hover: "#0096D1"
  neutral-bg: "#F4F7FB"
  surface: "#FFFFFF"
  surface-hover: "#F8FAFC"
  border: "#E2E8F0"
  border-subtle: "#EDF2F7"
  text-primary: "#0F172A"
  text-secondary: "#475569"
  text-muted: "#94A3B8"
  status-pending: "#D97706"
  status-approved: "#059669"
  status-rejected: "#DC2626"
  status-fine: "#B91C1C"
typography:
  headline-display:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 32px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 24px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: -0.01em
  headline-md:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.4
  body-lg:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
  body-md:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.4
  label-md:
    fontFamily: "Inter, system-ui, sans-serif"
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
- **Primary (`#0B2545`):** Azul marinho meia-noite institucional, utilizado em headers, navegação principal e botões mestres.
- **Secondary (`#1D4E89`):** Tom de suporte para cartões informativos e cabeçalhos secundários.
- **Accent (`#00A8E8`):** Ciano vibrante retirado da gota do logotipo, orientando chamadas de ação (CTA) e destaques visuais.
- **Neutral Background (`#F4F7FB`):** Fundo suave e relaxante, evitando o branco ofuscante.
- **Surface (`#FFFFFF`):** Superfícies de cards e formulários com bordas sutis e sombras limpas.
- **Status Cores:**
  - `status-pending` (`#D97706`): Reservas ou avisos aguardando ação.
  - `status-approved` (`#059669`): Reservas aprovadas, ciência confirmada.
  - `status-rejected` (`#DC2626`): Reservas recusadas ou recursos indeferidos.
  - `status-fine` (`#B91C1C`): Notificações e multas disciplinares.

## Typography
A tipografia adota **Inter / system-ui**, garantindo legibilidade impecável para tabelas de moradores, placas de veículos na portaria e redação de recursos.

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
- **DO:** Usar badges coloridos claros com texto escuro para status (`bg-amber-50 text-amber-800`).
- **DON'T:** Usar temas roxos/violetas (proibido pelas diretrizes do projeto).
- **DON'T:** Poluir visualmente o painel da portaria — a busca de placa deve ser o centro das atenções.
