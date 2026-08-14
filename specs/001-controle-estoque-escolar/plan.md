# Implementation Plan: Sistema de Controle de Estoque Escolar

**Branch**: `001-controle-estoque-escolar` | **Date**: 2026-08-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-controle-estoque-escolar/spec.md`

## Summary

Aplicação web full-stack para controle de estoque escolar (Merenda e Materiais), com controle
individual por escola (multi-tenant lógico), RBAC, movimentações rastreáveis e imutáveis, controle de
lote/validade com FEFO para alimentos, dashboard, relatórios (PDF/CSV/XLSX), inventário e auditoria
independente.

**Abordagem técnica**: monólito Next.js (App Router) em TypeScript, com backend via Route Handlers e
Server Actions, PostgreSQL + Prisma, autenticação por sessão (cookie HttpOnly), RBAC aplicado no
servidor por middleware/política reutilizável, e um **serviço de domínio centralizado de movimentação**
que é o único caminho para alterar saldo — sempre dentro de transação PostgreSQL, com bloqueio de saldo
negativo e travamento de linha para consistência concorrente. Estrutura de código modular por domínio.
Prioriza um MVP funcional completo (histórias P1) antes das secundárias.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 20 LTS

**Primary Dependencies**: Next.js 15 (App Router, React 19), Prisma 6 (PostgreSQL), Tailwind CSS 3 +
shadcn/ui (Radix), Zod, React Hook Form, TanStack Table (tabela server-side), autenticação por sessão
(iron-session / cookie assinado HttpOnly) com `argon2` para hash de senha, `@tanstack/react-query` para
data-fetching no cliente quando necessário.

**Storage**: PostgreSQL 16 (via Docker Compose no dev). Prisma Migrate para migrations e seed.

**Testing**: Vitest (unit — regras de domínio: FEFO, saldo não-negativo, RBAC), Testcontainers/DB de
teste + supertest-like para integração de Route Handlers e do serviço de movimentação; Playwright
(opcional, pós-MVP) para E2E dos fluxos críticos.

**Target Platform**: Navegadores modernos (desktop, tablet, celular); servidor Linux (container Docker).

**Project Type**: Web application full-stack (single Next.js app; frontend + backend no mesmo projeto).

**Performance Goals**: Paginação/ordenação/filtragem no servidor; listas retornam a 1ª página em < 1s
para catálogos de até ~50k itens/escola; dashboard via consultas agregadas (índices apropriados); nunca
carregar milhares de registros no cliente.

**Constraints**: Saldo nunca negativo (garantia transacional); movimentação e auditoria imutáveis;
toda query com escopo de escola do usuário; cookies Secure+HttpOnly+SameSite; segredos só via env;
interface em pt-BR; acessibilidade alvo WCAG 2.1 AA nos fluxos principais.

**Scale/Scope**: 1 a N escolas; dezenas a centenas de usuários; ~15 domínios; ~18 entidades; 7 módulos
funcionais (Usuários, Merenda, Materiais, Movimentações, Relatórios, Dashboard, Auditoria).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Avaliação contra os 7 princípios da constituição (v1.0.0):

| Princípio | Como o plano atende | Status |
|-----------|---------------------|--------|
| I. Simplicidade e Usabilidade | UI pt-BR com shadcn/ui, responsiva, ordenação alfabética padrão, estados vazios/carregamento, mensagens claras | ✅ PASS |
| II. Rastreabilidade e Auditoria | `StockMovement` imutável (saldo anterior/posterior, usuário, data/hora, tipo) + `AuditLog` independente; sem UPDATE/DELETE de histórico | ✅ PASS |
| III. Segurança, RBAC e LGPD | Sessão com cookie HttpOnly, senha em argon2, autorização no backend por política reutilizável, escopo de escola em toda query, minimização de dados pessoais | ✅ PASS |
| IV. Integridade dos Dados de Estoque | Serviço de movimentação único, transações PostgreSQL, `SELECT ... FOR UPDATE`, bloqueio de saldo negativo, código único e imutável pós-movimentação | ✅ PASS |
| V. Arquitetura Multi-Escola | `School` + `UserSchool`; todo item/saldo/movimentação com `schoolId`; catálogo por escola; transferência apenas interna | ✅ PASS |
| VI. Lote e Validade da Merenda | `FoodBatch` (produto+número+validade), FEFO no serviço de saída, alertas de vencimento configuráveis | ✅ PASS |
| VII. Qualidade, Tipagem e Testes | TypeScript estrito, Zod nas fronteiras, testes unit+integração das regras críticas, ESLint+Prettier | ✅ PASS |

**Resultado**: Nenhuma violação. Sem entradas em Complexity Tracking. Prosseguir para Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/001-controle-estoque-escolar/
├── plan.md              # Este arquivo (/speckit-plan)
├── research.md          # Phase 0 (/speckit-plan)
├── data-model.md        # Phase 1 (/speckit-plan)
├── quickstart.md        # Phase 1 (/speckit-plan)
├── contracts/           # Phase 1 (/speckit-plan)
│   └── api.md           # Contratos de endpoints (REST + Server Actions)
└── tasks.md             # Phase 2 (/speckit-tasks — NÃO criado aqui)
```

### Source Code (repository root)

Monólito Next.js (App Router) com organização **modular por domínio**. O código de cada domínio fica em
`src/modules/<dominio>` (regras de negócio, serviços, schemas Zod, repositórios), e as rotas/telas em
`src/app`. A UI compartilhada em `src/components/ui` (shadcn).

```text
.
├── docker-compose.yml                # PostgreSQL (dev) + app
├── Dockerfile
├── .env.example
├── prisma/
│   ├── schema.prisma                 # Todas as entidades (18)
│   ├── migrations/
│   └── seed.ts                       # Perfis, permissões, admin dev, escola demo, categorias, UMs
├── src/
│   ├── app/                          # App Router (UI + backend)
│   │   ├── (auth)/login/             # Tela de login
│   │   ├── (app)/                    # Layout administrativo autenticado (sidebar dinâmica)
│   │   │   ├── dashboard/
│   │   │   ├── merenda/{estoque,entradas,saidas,lotes,inventario,relatorios}/
│   │   │   ├── materiais/{estoque,entradas,distribuicoes,inventario,relatorios}/
│   │   │   ├── cadastros/{categorias,unidades,prateleiras,fornecedores}/
│   │   │   └── admin/{escolas,usuarios,permissoes,auditoria}/
│   │   └── api/                      # Route Handlers (REST) por domínio
│   │       ├── auth/ movimentacoes/ itens/ lotes/ inventario/ relatorios/ dashboard/ ...
│   ├── modules/                      # DOMÍNIOS (lógica de negócio isolada da UI)
│   │   ├── auth/                     # sessão, hash, guardas
│   │   ├── usuarios/  escolas/  permissoes/     # RBAC + multi-escola
│   │   ├── catalogo/                 # Item, ItemCharacteristic, Category, UnitOfMeasure
│   │   ├── merenda/  materiais/      # regras específicas por módulo (FOOD / SCHOOL_MATERIAL)
│   │   ├── estoque/                  # Stock (saldo) + consultas
│   │   ├── movimentacoes/            # SERVIÇO CENTRAL de movimentação (único que altera saldo)
│   │   ├── lotes/                    # FoodBatch + FEFO
│   │   ├── fornecedores/  prateleiras/
│   │   ├── inventario/               # conferência → gera movimentação de ajuste
│   │   ├── relatorios/               # geração separada da apresentação (PDF/CSV/XLSX)
│   │   ├── auditoria/                # AuditLog independente
│   │   └── dashboard/                # consultas agregadas
│   ├── components/                   # componentes reutilizáveis (DataTable, StatusBadge, forms...)
│   │   └── ui/                       # shadcn/ui
│   ├── lib/                          # prisma client, session, rbac policy, zod helpers, errors
│   └── server/                       # authz middleware, withSchoolScope, withTransaction
└── tests/
    ├── unit/                         # FEFO, saldo não-negativo, geração de código, policy RBAC
    └── integration/                  # serviço de movimentação (transação/concorrência), rotas
```

**Structure Decision**: Aplicação web full-stack em **um único projeto Next.js** (App Router). Backend
implementado com Route Handlers (`src/app/api`) e Server Actions, chamando a camada de domínio em
`src/modules/*`. A UI nunca altera saldo diretamente: toda mutação de estoque passa pelo serviço em
`src/modules/movimentacoes`. Escolhido monólito (em vez de backend+frontend separados) por simplicidade
operacional, coesão de tipos TypeScript ponta-a-ponta e adequação ao MVP, mantendo separação lógica por
domínio para evolução futura.

## Complexity Tracking

> Sem violações constitucionais. Nenhuma justificativa de complexidade necessária.
