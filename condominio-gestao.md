# Plano de Implementação: Sistema de Gestão Condominial (Harmony Condo)

## Overview
O **Harmony Condo** é uma plataforma web para gestão integrada e comunicação condominial. O sistema centraliza a rotina operacional e jurídica do condomínio, oferecendo controle de acesso baseado em papéis (Síndico, Portaria, Conselho Fiscal e Moradores), cadastro de unidades e veículos, mural institucional de avisos, sistema confidencial de infrações e multas (com fluxo de ciência e recurso), agenda para reserva de espaços comuns e repositório de links e documentos oficiais.

---

## Project Type
**WEB** (Next.js 14+ / React, TypeScript, Tailwind CSS, Banco Relacional / Supabase / Prisma).

---

## Success Criteria
1. **Gestão de Acessos e Perfis (RBAC):**
   - Autenticação segura segregando 4 perfis: Síndico (Admin), Portaria (Operação rápida), Conselho Fiscal (Auditoria/Leitura) e Morador (Privativo de sua unidade).
2. **Cadastro & Veículos:**
   - Cadastro completo de unidades (bloco, apartamento, proprietário/inquilino, contatos).
   - Busca instantânea por placa ou modelo de veículo pela Portaria.
3. **Mural de Avisos & Links:**
   - Publicação de comunicados com categorização (Urgente, Manutenção, Reunião) e repositório de documentos (Regimento, Atas, Convenção, Contatos de Emergência).
4. **Fluxo de Multas e Notificações (Confidencialidade LGPD):**
   - Notificações visíveis no painel interno do morador com contador de avisos não lidos.
   - Registro de advertência/multa pelo Síndico com anexo de imagens/evidências.
   - Visibilidade restrita ao Morador infrator e à administração.
   - Registro formal de ciência / leitura do morador.
   - Módulo de interposição de recurso online dentro do prazo estipulado.
5. **Reserva de Espaços Comuns:**
   - Calendário interativo para espaços (Salão de Festas, Churrasqueira, Quadra).
   - Validação de conflito de datas e limite de reservas ativas por unidade.
   - Fluxo com status (`PENDENTE`, `APROVADA`, `RECUSADA`): exigência de validação e aprovação do Síndico antes da confirmação final, com termo de regras e limpeza.

---

## Tech Stack
- **Framework Front-end & Backend:** Next.js (App Router, Server Actions, TypeScript) para alta performance e SEO interno.
- **Estilização & UI:** Tailwind CSS + Radix UI / Lucide Icons (Design limpo, sem clichês, responsivo para celulares e desktops).
- **Banco de Dados & ORM:** PostgreSQL / SQLite (desenvolvimento local ágil) com Prisma ORM ou Supabase Client para garantir Row-Level Security (RLS) e integridade relacional.
- **Armazenamento de Arquivos/Imagens:** Storage para anexos de infrações/multas e atas em PDF.
- **Validação & Segurança:** Zod para validação rigorosa de schemas e sanitização de inputs.

---

## File Structure

```
condominio-app/
├── prisma/
│   └── schema.prisma               # Modelagem de dados (Unidades, Moradores, Veículos, Multas, Reservas, Avisos)
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── recuperar-senha/page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx          # Shell com navegação adaptativa por perfil
│   │   │   ├── page.tsx            # Visão geral / Dashboard
│   │   │   ├── mural/page.tsx      # Avisos e comunicados
│   │   │   ├── moradores/page.tsx  # Cadastro e lista de moradores/unidades
│   │   │   ├── veiculos/page.tsx   # Busca rápida e cadastro de veículos
│   │   │   ├── multas/
│   │   │   │   ├── page.tsx        # Lista de multas (filtrada por perfil)
│   │   │   │   └── [id]/page.tsx   # Detalhe da multa, fotos, ciência e recurso
│   │   │   ├── reservas/page.tsx   # Calendário e solicitação de espaços
│   │   │   ├── links/page.tsx      # Documentos oficiais e telefones úteis
│   │   │   └── relatorios/page.tsx # Painel de auditoria (Conselho Fiscal / Síndico)
│   │   ├── api/                    # Endpoints / Server Actions
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/                     # Botões, modais, badges, inputs
│   │   ├── layout/                 # Sidebar, Header, PerfilBadge
│   │   ├── multas/                 # UploadEvidencia, TimelineRecurso, FormularioCiencia
│   │   ├── reservas/               # CalendarioReservas, ModalNovaReserva
│   │   └── veiculos/               # TabelaVeiculos, BuscaPlaca
│   ├── lib/
│   │   ├── auth.ts                 # Sessão e controle de permissões
│   │   ├── db.ts                   # Instância do Prisma / DB client
│   │   └── utils.ts
│   └── types/                      # Definições TypeScript
├── tests/
│   ├── unit/                       # Testes de regras de negócio (conflito de reservas, prazos de recurso)
│   └── e2e/                        # Testes de fluxos de login e permissões
├── package.json
└── tailwind.config.ts
```

---

## Task Breakdown

### Fase 1: Fundação & Modelagem de Dados (P0)
- **Task 1.1: Setup do Projeto e Arquitetura Base**
  - **Agent:** `frontend-specialist` | **Skill:** `frontend-architecture`
  - **INPUT:** Especificação do projeto e stack Next.js + TypeScript + Tailwind.
  - **OUTPUT:** Projeto Next.js configurado com design system e layout responsivo.
  - **VERIFY:** `npm run build` executa sem erros; layout base renderiza no navegador.

- **Task 1.2: Schema do Banco de Dados & RLS**
  - **Agent:** `database-architect` | **Skill:** `database-design`
  - **INPUT:** Entidades: Condominio, Unidade, Usuario (Perfil: SINDICO, PORTARIA, CONSELHO, MORADOR), Veiculo, Aviso, Multa, EvidenciaMulta, RecursoMulta, Espaco, Reserva, DocumentoLink.
  - **OUTPUT:** `schema.prisma` com migrações e índices essenciais (ex: índice na placa do veículo).
  - **VERIFY:** `npx prisma validate` e migração executada com sucesso.

- **Task 1.3: Autenticação e Controle de Acesso (RBAC)**
  - **Agent:** `security-auditor` | **Skill:** `clean-code`
  - **INPUT:** Credenciais e regras de autorização por rota/perfil.
  - **OUTPUT:** Middleware de autenticação que restringe áreas (Portaria não vê multas; Morador só vê sua unidade).
  - **VERIFY:** Testes de acesso a rotas proibidas retornando 403 Forbidden.

---

### Fase 2: Módulos Operacionais & Comunicação (P1)
- **Task 2.1: Gestão de Unidades e Moradores**
  - **Agent:** `frontend-specialist` | **Skill:** `frontend-design`
  - **INPUT:** Formulários de cadastro de proprietários, inquilinos e contatos de emergência.
  - **OUTPUT:** Tabela com busca, filtros por bloco/apto e formulário de edição restrito ao síndico.
  - **VERIFY:** Criação, edição e listagem de moradores funcionando com validação Zod.

- **Task 2.2: Consulta e Cadastro de Veículos (Módulo Portaria)**
  - **Agent:** `frontend-specialist` | **Skill:** `frontend-design`
  - **INPUT:** Vínculo de placa, marca, modelo, cor e vaga à unidade.
  - **OUTPUT:** Interface de consulta ultra-rápida (otimizada para digitação de placa pela portaria).
  - **VERIFY:** Busca por placa parcial/total responde instantaneamente e identifica a unidade.

- **Task 2.3: Mural de Comunicados & Repositório de Links**
  - **Agent:** `frontend-specialist` | **Skill:** `frontend-design`
  - **INPUT:** Categorias de avisos, upload de anexos de atas/convenções e links rápidos.
  - **OUTPUT:** Feed de avisos com badges visuais (Importante/Urgente) e página de documentos essenciais.
  - **VERIFY:** Síndico publica aviso com anexo; moradores visualizam ordenados por data.

---

### Fase 3: Módulo Jurídico/Disciplinar e Reservas (P2)
- **Task 3.1: Fluxo Completo de Notificações e Multas**
  - **Agent:** `backend-specialist` + `frontend-specialist` | **Skill:** `api-patterns`
  - **INPUT:** Registro de infração pelo síndico com fotos, artigos infringidos e valor.
  - **OUTPUT:** Painel do morador com notificação visual, botão de "Confirmar Ciência" com registro de timestamp/IP, e formulário de "Interpor Recurso" com anexos.
  - **VERIFY:** Morador recebe notificação; registra ciência com timestamp; síndico avalia recurso.

- **Task 3.2: Sistema de Reserva de Espaços Comuns (com Aprovação do Síndico)**
  - **Agent:** `frontend-specialist` | **Skill:** `frontend-design`
  - **INPUT:** Cadastro de espaços (regras, horários, capacidade), agenda de reservas e solicitações de moradores.
  - **OUTPUT:** Calendário visual com bloqueio em tempo real para evitar conflitos, status `PENDENTE` após solicitação do morador e painel de validação para o Síndico aprovar ou recusar com justificativa.
  - **VERIFY:** Morador solicita reserva -> status fica pendente -> síndico aprova -> morador é notificado no painel interno e a data fica bloqueada no calendário.

---

### Fase 4: Painel do Conselho Fiscal e Auditoria (P3)
- **Task 4.1: Relatórios e Acompanhamento do Conselho**
  - **Agent:** `frontend-specialist` | **Skill:** `frontend-design`
  - **INPUT:** Registros de reservas, histórico consolidado de multas/recursos e atas.
  - **OUTPUT:** Visão somente-leitura analítica para o conselho acompanhar a transparência da gestão.
  - **VERIFY:** Usuário com perfil CONSELHO acessa métricas e relatórios sem permissão de edição.

---

## Phase X: Verification Checklist

- [ ] **Auditoria de Segurança (P0):** `python .agents/skills/vulnerability-scanner/scripts/security_scan.py .`
- [ ] **Auditoria de UX & Acessibilidade (P1):** `python .agents/skills/frontend-design/scripts/ux_audit.py .`
- [ ] **Auditoria de Responsividade Mobile (P2):** Teste em viewports mobile (Portaria e Moradores no celular).
- [ ] **Validação de Build (P3):** `npm run build` passa sem avisos ou erros de tipagem.
- [ ] **Conformidade de Regras:** Sem cores proibidas (purple ban respeitado), sem layouts genéricos clichês.
