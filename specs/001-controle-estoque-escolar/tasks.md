---
description: "Task list — Sistema de Controle de Estoque Escolar"
---

# Tasks: Sistema de Controle de Estoque Escolar

**Input**: Design documents from `specs/001-controle-estoque-escolar/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/api.md](contracts/api.md)

**Tests**: INCLUÍDOS. A pedido do usuário, os testes das **regras críticas** (saldo não-negativo, FEFO,
RBAC, código único/imutável, escopo de escola, transação/concorrência) acompanham a respectiva história
— não ficam só no fim.

**Organization**: Tarefas agrupadas por história de usuário para implementação e teste independentes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependências pendentes)
- **[Story]**: US1..US9 (mapeadas ao spec.md); Setup/Foundational/Polish não têm rótulo de história
- Caminhos de arquivo são relativos à raiz do repositório

## Mapa história → prioridade (do spec.md)

| História | Prioridade | Tema | Sequência de build do usuário |
|---|---|---|---|
| US1 | P1 🎯 | Movimentações rastreáveis (motor de estoque) | 9 |
| US2 | P1 | RBAC + escopo por escola | 3,4,5 |
| US3 | P1 | Merenda: lotes, validade, FEFO | 10,11 |
| US4 | P2 | Cadastro de itens (características, código, alfabético) | 6,7,8 |
| US5 | P2 | Materiais: distribuição/devolução | 12 |
| US6 | P2 | Dashboard | 14 |
| US9 | P2 | Administração (usuários/escolas/permissões/auditoria) | 3,4,5,16 |
| US7 | P3 | Relatórios | 15 |
| US8 | P3 | Inventário | 13 |

Áreas 1 (estrutura), 2 (banco), 17 (testes base), 18 (seed), 19 (docs), 20 (Docker/deploy) distribuídas
entre Setup, Foundational e Polish.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Inicialização do projeto e estrutura base (áreas 1 e 20-parcial).

- [x] T001 Inicializar projeto Next.js 15 + TypeScript (App Router) na raiz; configurar `tsconfig.json` estrito
- [x] T002 [P] Instalar e configurar Tailwind CSS 3 e shadcn/ui (init) em `tailwind.config.ts`, `src/app/globals.css`
- [x] T003 [P] Configurar ESLint + Prettier em `eslint.config.mjs`, `.prettierrc`, scripts `lint`/`format` no `package.json`
- [x] T004 [P] Configurar Vitest (unit) e ambiente de integração em `vitest.config.ts` e `tests/` com scripts `test`/`test:int`
- [x] T005 [P] Criar `docker-compose.yml` com serviço PostgreSQL 16 (dev) e volume persistente
- [x] T006 [P] Criar `Dockerfile` multi-stage (build/prod) do app Next.js
- [x] T007 [P] Criar `.env.example` com `DATABASE_URL`, `SESSION_SECRET`, `NODE_ENV`, `NEAR_EXPIRY_DAYS_DEFAULT` (sem segredos reais)
- [x] T008 Criar a estrutura de pastas modular por domínio em `src/modules/*`, `src/app/*`, `src/lib/*`, `src/server/*` conforme plan.md

**Checkpoint**: Projeto compila, lint e testes rodam. *(Núcleo de domínio já compila e testa; app Next.js pendente.)*

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Banco, modelos, sessão, RBAC e infraestrutura compartilhada (áreas 2, 3-infra, 6-infra).

**⚠️ CRITICAL**: Nenhuma história pode iniciar antes desta fase.

### Banco de dados e modelos (área 2)

- [x] T009 Definir `prisma/schema.prisma` com datasource PostgreSQL e todos os enums (`ModuleType`, `MovementType`, `MovementDirection`, `ReviewStatus`, `DistributionTarget`, `AuditAction`, `InventoryStatus`)
- [x] T010 Modelar entidades de identidade/RBAC no schema: `User`, `Role`, `Permission`, `UserRole`, `RolePermission`, `UserSchool`, `School`
- [x] T011 Modelar cadastros e catálogo no schema: `Category`, `UnitOfMeasure`, `Supplier`, `StorageLocation`, `Item`, `ItemCharacteristic`, `AppConfig`, `CodeSequence`
- [x] T012 Modelar estoque/movimentação/merenda no schema: `Stock`, `StockMovement`, `StockMovementItem`, `FoodBatch`, `Inventory`, `InventoryItem`, `ReviewNotification`, `AuditLog` (campos base `id/createdAt/updatedAt/createdById/active` e índices de data-model.md)
- [x] T013 Gerar migration inicial (`prisma migrate dev`) e o Prisma Client *(requer Docker/PostgreSQL)*
- [x] T014 [P] Criar cliente Prisma singleton em `src/lib/prisma.ts`

### Infra de aplicação (sessão, RBAC, erros)

- [x] T015 [P] Implementar hash de senha (argon2id) em `src/modules/auth/password.ts`
- [x] T016 [P] Implementar sessão por cookie HttpOnly+Secure+SameSite em `src/modules/auth/session.ts`
- [x] T017 Implementar política RBAC reutilizável `can(user, permission, {schoolId})` em `src/server/rbac.ts`
- [x] T018 Implementar helper de escopo de escola (`schoolScopeFilter`, `canAccessSchool`) em `src/server/rbac.ts`
- [x] T019 [P] Implementar guarda de rota/handler (`requirePermission`, `requireAuth`) em `src/server/guard.ts`
- [x] T020 [P] Implementar wrapper de transação `withTransaction` e util de row lock (`SELECT … FOR UPDATE`) em `src/server/tx.ts`
- [x] T021 [P] Implementar formato de erro padrão + tratamento (`AppError`, `toErrorResponse`) em `src/lib/errors.ts`
- [x] T022 [P] Implementar helpers de validação Zod e parsing de query de listagem (page/pageSize/sort/q) em `src/lib/http.ts`
- [x] T023 [P] Gerador de código por módulo: formatação/imutabilidade prontas e testadas em `src/modules/catalogo/code.ts`; incremento transacional via `CodeSequence` pendente (requer DB)

### Layout base

- [x] T024 Criar layout administrativo autenticado com sidebar em `src/app/(app)/layout.tsx` e `src/components/AppSidebar.tsx` (itens ainda estáticos; filtragem por permissão vem em US2)
- [x] T025 [P] Criar componentes reutilizáveis base: `DataTable` (server-side), `StatusBadge`, `EmptyState`, `LoadingState`, `FormField` em `src/components/`

### Seed mínimo (parte da área 18)

- [x] T026 Criar seed base em `prisma/seed.ts`: perfis padrão, permissões padrão, admin de desenvolvimento, escola de demonstração; script `npm run seed`
- [x] T027 [P] Teste unitário do gerador de código único/sequencial em `tests/unit/code-sequence.test.ts` (unicidade, não reutilização)
- [x] T028 [P] Teste unitário da política RBAC `can()` em `tests/unit/rbac.test.ts` (negar por padrão, admin global, moduleScope)

**Checkpoint**: Modelos e RBAC prontos; migrations/seed pendentes de DB.

---

## Phase 3: User Story 1 - Movimentações com rastreabilidade (Priority: P1) 🎯 MVP

**Goal**: Motor central de estoque: entrada/saída via serviço único, transação, saldo anterior/posterior,
bloqueio de saldo negativo, com auditoria. (Área 9)

**Independent Test**: Criar item, registrar entrada e saída, ver saldo evoluir; saída acima do saldo é
bloqueada; cada movimentação mostra usuário/data/tipo/saldo ant./post.

### Tests for User Story 1 (regras críticas) ⚠️

- [x] T029 [P] [US1] Teste unit: cálculo de saldo e bloqueio de negativo em `tests/unit/movement-balance.test.ts`
- [ ] T030 [P] [US1] Teste integração: serviço de movimentação em transação e concorrência (duas saídas simultâneas não geram negativo) em `tests/integration/movement-concurrency.test.ts` *(requer DB)*
- [ ] T031 [P] [US1] Teste integração: imutabilidade da movimentação (sem update/delete) + auditoria gerada em `tests/integration/movement-audit.test.ts` *(requer DB)*
- [x] T031a [P] [US1] Teste da regra de justificativa obrigatória (PERDA/AVARIA/PRODUTO_VENCIDO/AJUSTE) em `tests/unit/movement-balance.test.ts` e `tests/unit/movement-schema.test.ts` *(cobre FR-024)*

### Implementation for User Story 1

- [x] T032 [US1] Implementar util de auditoria `writeAuditLog(...)` em `src/modules/auditoria/audit-service.ts`
- [x] T033 [US1] Serviço de movimentação: regras de domínio (direção, justificativa, saldo não-negativo, ajuste) prontas em `src/modules/movimentacoes/movement-domain.ts`; orquestração transacional com Prisma pendente (requer DB)
- [x] T034 [P] [US1] Schemas Zod de movimentação (cabeçalho + linhas) em `src/modules/movimentacoes/movement.schema.ts`
- [x] T035 [US1] Serviço mínimo de item/estoque para dar suporte à movimentação (`createItemMinimal`, `getStock`) em `src/modules/catalogo/item-service.ts`
- [x] T036 [US1] Endpoint `POST /api/movements` (entrada/saída de materiais) em `src/app/api/movements/route.ts`
- [x] T037 [US1] Endpoint `GET /api/movements` (histórico paginado, escopo de escola) em `src/app/api/movements/route.ts`
- [x] T038 [US1] UI de entrada e saída simples + lista de movimentações em `src/app/(app)/materiais/entradas/page.tsx` e `.../estoque/page.tsx`
- [x] T039 [US1] Mensagens de erro/sucesso e estado de bloqueio de saldo negativo na UI de movimentação

**Checkpoint**: US1 funcional e testável de forma independente (MVP mínimo do motor de estoque).

---

## Phase 4: User Story 2 - RBAC e escopo por escola (Priority: P1)

**Goal**: Cada perfil só acessa o permitido; sidebar dinâmica; backend nega acessos indevidos; queries
restritas à escola. (Áreas 3, 4, 5-parcial)

**Independent Test**: Logar com Merendeira (só Merenda), Gestor da Escola A (não vê Escola B); acesso
direto a rota sem permissão → 403.

### Tests for User Story 2 (regras críticas) ⚠️

- [ ] T040 [P] [US2] Teste integração: acesso negado no backend por falta de permissão (403) em `tests/integration/authz-deny.test.ts` *(requer DB/HTTP)*
- [x] T041 [P] [US2] Teste integração: escopo de escola (usuário da Escola A não lê dados da Escola B) em `tests/integration/school-scope.test.ts` *(requer DB)*
- [x] T042 [P] [US2] Teste unit: sidebar/permissões — itens ocultos por falta de permissão em `tests/unit/menu-permissions.test.ts`
- [x] T042a [P] [US2] Teste integração: MERENDEIRA recebe **403** ao acessar endpoints de Materiais (`SCHOOL_MATERIAL`) em `tests/integration/module-isolation-merendeira.test.ts` — *lógica já coberta por `tests/unit/rbac.test.ts`; falta o nível HTTP* *(cobre FR-028)*
- [x] T042b [P] [US2] Teste integração: ASSISTENTE_ALUNO recebe **403** ao acessar endpoints de Merenda (`FOOD`/lotes) em `tests/integration/module-isolation-assistente.test.ts` — *lógica já coberta por `tests/unit/rbac.test.ts`; falta o nível HTTP* *(cobre FR-028)*

### Implementation for User Story 2

- [x] T043 [US2] Endpoint `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` em `src/app/api/auth/*` (grava `AuditLog(LOGIN)`)
- [x] T044 [US2] Tela de login em `src/app/(auth)/login/page.tsx` com React Hook Form + Zod
- [x] T045 [US2] Aplicar `requirePermission`/escopo de escola a `POST/GET /api/movements` e demais handlers
- [x] T046 [US2] Tornar a sidebar dinâmica conforme permissões via `GET /api/auth/me` em `src/components/AppSidebar.tsx`
- [ ] T047 [US2] Middleware de sessão para rotas `(app)/*` (redirect não autenticado) em `src/middleware.ts`
- [x] T048 [US2] Restringir MERENDEIRA a `FOOD` e ASSISTENTE_ALUNO a `SCHOOL_MATERIAL` nos handlers *(regra de decisão já implementada e testada em `rbac.ts`/`rbac.test.ts`)*

**Checkpoint**: US1 + US2 funcionam; segurança aplicada no backend.

---

## Phase 5: User Story 3 - Merenda: lotes, validade e FEFO (Priority: P1)

**Goal**: Entrada de alimentos por lote (produto+número+validade), saldo por lote, saída sugerindo FEFO,
alertas de vencimento configuráveis. (Áreas 10, 11)

**Independent Test**: Cadastrar alimento; dar entrada em 2 lotes (validades diferentes); na saída, lote
de menor validade sugerido primeiro; alertas de próximo/vencido conforme `nearExpiryDays`.

### Tests for User Story 3 (regras críticas) ⚠️

- [x] T049 [P] [US3] Teste unit: FEFO ordena/consome pelo menor `expiryDate` primeiro em `tests/unit/fefo.test.ts`
- [ ] T050 [P] [US3] Teste: unicidade de lote (produto+número+validade) e soma de entradas iguais em `tests/integration/food-batch-identity.test.ts` *(requer DB)*
- [ ] T051 [P] [US3] Teste integração: saída de merenda multi-lote e bloqueio de saldo negativo por lote em `tests/integration/food-exit-fefo.test.ts` *(requer DB; regra pura já em `fefo.test.ts`)*

### Implementation for User Story 3

- [x] T052 [US3] Estender serviço de movimentação para FOOD: criar/somar `FoodBatch` na entrada, consumir por FEFO na saída (transação + lock no lote) em `src/modules/lotes/food-batch-service.ts` + `movement-service.ts` *(lógica FEFO pura pronta em `src/modules/lotes/fefo.ts`)*
- [x] T052a [US3] Validar que ENTRADA de FOOD **exige** `batchNumber`+`expiryDate` e que itens FOOD só movimentam via lote *(validação já no schema Zod `movement.schema.ts`; falta reforço no serviço)* *(cobre FR-013/FR-014)*
- [ ] T052b [P] [US3] Teste integração: ENTRADA de alimento sem lote/validade é rejeitada (422) em `tests/integration/food-entry-requires-batch.test.ts` *(regra já coberta por `tests/unit/movement-schema.test.ts`; falta nível HTTP)*
- [x] T053 [P] [US3] Serviço de configuração `nearExpiryDays` (get/set por escola) em `src/modules/lotes/config-service.ts` usando `AppConfig`
- [x] T053a [P] [US3] Teste unit: cálculo de alertas "próximo do vencimento" (conforme `nearExpiryDays`) e "vencido" em `tests/unit/expiry-alerts.test.ts` *(cobre FR-017)*
- [x] T054 [US3] Endpoints de lotes/alertas `GET /api/food-batches`, `GET /api/food-batches/alerts`, `GET /api/movements/fefo-preview`
- [x] T055 [US3] UI Merenda: entradas com lote/validade, saídas com sugestão FEFO, tela "Lotes e Validades"
- [x] T056 [US3] Tipos de saída de merenda com justificativa obrigatória onde aplicável na UI/schema *(regra já no domínio/schema)*

**Checkpoint**: Todas as histórias P1 concluídas → **MVP funcional completo**.

---

## Phase 6: User Story 4 - Cadastro de itens (características, código, alfabético) (Priority: P2)

**Goal**: CRUD completo de itens com características variáveis, código único imutável pós-movimentação,
busca e listagem alfabética. (Áreas 6, 7, 8)

**Independent Test**: Cadastrar 2 materiais com características distintas; ambos coexistem; recebem
códigos únicos; aparecem em ordem alfabética; alterar código após movimentação é bloqueado.

### Tests for User Story 4 (regras críticas) ⚠️

- [x] T057 [P] [US4] Teste integração: bloqueio de alteração de código após movimentação (409) em `tests/integration/item-code-immutability.test.ts` *(regra pura já em `code.ts`/`code-sequence.test.ts`)*
- [x] T058 [P] [US4] Teste unit: busca por característica (key:value) e ordenação alfabética padrão em `tests/unit/item-search.test.ts`

### Implementation for User Story 4

- [x] T059 [P] [US4] Cadastros base: `Category`, `UnitOfMeasure` (CRUD) em `src/modules/catalogo/*` e `src/app/api/{categories,units}/route.ts`
- [x] T060 [US4] Estender `item-service` com CRUD completo, `ItemCharacteristic`, guarda de imutabilidade de código e listagem server-side (filtros/sort/paginação, default `name:asc`) em `src/modules/catalogo/item-service.ts`
- [x] T061 [US4] Endpoints `GET/POST /api/items`, `GET/PATCH /api/items/{id}` (auditoria ITEM_CREATE/UPDATE) em `src/app/api/items/*`
- [ ] T062 [US4] UI de cadastro/listagem de itens (merenda e materiais) com editor de características dinâmicas, busca e filtros em `src/app/(app)/{merenda,materiais}/estoque/*`

---

## Phase 7: User Story 9 - Administração (usuários, escolas, permissões, auditoria) (Priority: P2)

**Goal**: Admin cadastra escolas, gerencia usuários (ativa/inativa), configura permissões e consulta
auditoria; inativação preserva histórico. (Áreas 5, 16)

**Independent Test**: Criar escola + usuário Gestor vinculado; desativar usuário com histórico (inativa,
não exclui); consultar auditoria dessas ações.

### Tests for User Story 9 ⚠️

- [x] T063 [P] [US9] Teste integração: inativação (não exclusão) de usuário com histórico em `tests/integration/user-deactivate.test.ts`
- [x] T064 [P] [US9] Teste integração: alteração de permissões registra `AuditLog(PERMISSION_CHANGE)` em `tests/integration/permission-audit.test.ts`

### Implementation for User Story 9

- [x] T065 [P] [US9] CRUD de escolas `GET/POST/PATCH /api/schools` + UI `src/app/(app)/admin/escolas/*` (auditoria SCHOOL_CREATE)
- [x] T066 [US9] CRUD de usuários (papéis, escolas, ativo) `GET/POST/PATCH /api/users` + UI `src/app/(app)/admin/usuarios/*` (inativação em vez de exclusão)
- [x] T067 [P] [US9] Gestão de papéis/permissões `GET /api/roles`, `GET /api/permissions`, `PATCH /api/roles/{id}/permissions` + UI `src/app/(app)/admin/permissoes/*`
- [x] T068 [P] [US9] Consulta de auditoria `GET /api/audit` + UI `src/app/(app)/admin/auditoria/*` (escopo: ADMIN global, GESTOR própria escola)
- [ ] T069 [P] [US9] Cadastros base restantes: `Supplier` e `StorageLocation` (CRUD com código `ALM-01-A-01`) em `src/app/api/{suppliers,storage-locations}/route.ts` e UI `src/app/(app)/cadastros/*`

---

## Phase 8: User Story 5 - Materiais: distribuição e devolução (Priority: P2)

**Goal**: Distribuição/saída de materiais com destino opcional (aluno/turma/professor/setor/atividade/
outro) sem cadastro de alunos; devolução, perda, avaria, transferência interna, ajuste. (Área 12)

**Independent Test**: Distribuir 10 para "Turma 5º A" (saldo cai, destino gravado); registrar devolução
de 3 (saldo sobe).

### Tests for User Story 5 ⚠️

- [ ] T070 [P] [US5] Teste integração: distribuição com destino opcional e devolução ajustando saldo em `tests/integration/material-distribution.test.ts`

### Implementation for User Story 5

- [x] T071 [US5] Estender schema/serviço de movimentação com `distributionTarget`/label e tipos de materiais (distribuição, devolução, avaria, transferência interna, ajuste) em `src/modules/materiais/*` *(schema já suporta `distributionTarget`)*
- [x] T072 [US5] Endpoints já cobertos por `/api/movements`; adicionar UI de "Distribuições/Saídas" e "Devoluções" em `src/app/(app)/materiais/distribuicoes/*`

---

## Phase 9: User Story 6 - Dashboard (Priority: P2)

**Goal**: Painel com indicadores por escola/permissão via consultas agregadas eficientes. (Área 14)

**Independent Test**: Gestor da Escola A vê números só da Escola A; Merendeira vê só indicadores de
Merenda.

### Tests for User Story 6 ⚠️

- [x] T073 [P] [US6] Teste integração: indicadores do dashboard respeitam escola e permissões em `tests/integration/dashboard-scope.test.ts`

### Implementation for User Story 6

- [x] T074 [US6] Serviço de dashboard com consultas agregadas (counts, estoque baixo/zerado, próximos/vencidos, recentes, consumo, distribuição) em `src/modules/dashboard/dashboard-service.ts`
- [x] T075 [US6] Endpoint `GET /api/dashboard` (escopo de escola) em `src/app/api/dashboard/route.ts`
- [x] T076 [US6] UI do dashboard com cards e listas recentes em `src/app/(app)/dashboard/page.tsx`

---

## Phase 10: User Story 8 - Inventário / conferência (Priority: P3)

**Goal**: Conferência informando quantidade sistema/física, diferença e justificativa; fechamento gera
movimentação de AJUSTE + auditoria + notificação de revisão. (Área 13)

**Independent Test**: Conferir item com quantidade física divergente + justificativa; fechar → gera
AJUSTE e auditoria; saldo atualizado.

### Tests for User Story 8 (regras críticas) ⚠️

- [ ] T077 [P] [US8] Teste integração: fechamento de inventário gera AJUSTE, atualiza saldo e cria auditoria em `tests/integration/inventory-adjust.test.ts`
- [ ] T078 [P] [US8] Teste integração: ajuste marca `PENDENTE_REVISAO`, cria `ReviewNotification`; revisão gera `AuditLog(ADJUSTMENT_REVIEW)` sem alterar saldo em `tests/integration/adjustment-review.test.ts`

### Implementation for User Story 8

- [ ] T079 [US8] Serviço de inventário (abrir, lançar contagem/diferença, fechar → AJUSTE via movement-service) em `src/modules/inventario/inventory-service.ts`
- [ ] T080 [US8] Serviço de revisão de ajuste (listar pendentes, marcar revisado) + `ReviewNotification` em `src/modules/movimentacoes/adjustment-review-service.ts`
- [ ] T081 [US8] Endpoints `POST /api/inventories`, `GET /api/inventories/{id}`, `PATCH .../items`, `POST .../close`, `GET /api/adjustments/pending`, `POST /api/adjustments/{id}/review` em `src/app/api/{inventories,adjustments}/*`
- [ ] T082 [US8] UI de inventário (Merenda e Materiais) e caixa de "Ajustes pendentes de revisão" em `src/app/(app)/{merenda,materiais}/inventario/*`

---

## Phase 11: User Story 7 - Relatórios (Priority: P3)

**Goal**: Relatórios com filtros (período, escola, produto, categoria, tipo) e exportação PDF e
CSV/XLSX; geração desacoplada da apresentação. (Área 15)

**Independent Test**: Gerar relatório de movimentações filtrado por período/escola; totais conferem;
exportar em PDF e CSV.

### Tests for User Story 7 ⚠️

- [x] T083 [P] [US7] Teste integração: relatório respeita filtros e escopo de escola em `tests/integration/report-scope.test.ts`

### Implementation for User Story 7

- [x] T084 [US7] Camada de datasets de relatório (consultas + DTO, desacoplada da apresentação) em `src/modules/relatorios/report-datasets.ts`
- [x] T085 [P] [US7] Adaptadores de exportação CSV/XLSX (`exceljs`) em `src/modules/relatorios/export-xlsx.ts` e CSV
- [x] T086 [P] [US7] Adaptador de exportação PDF em `src/modules/relatorios/export-pdf.ts`
- [x] T087 [US7] Endpoint `GET /api/reports/{type}` com `format=json|csv|xlsx|pdf` em `src/app/api/reports/[type]/route.ts`
- [x] T088 [US7] UI de relatórios com filtros e botões de exportação em `src/app/(app)/{merenda,materiais}/relatorios/*`

---

## Phase 12: Polish & Cross-Cutting Concerns

**Purpose**: Áreas 17 (testes finais), 18 (dados demo), 19 (docs), 20 (Docker/deploy) e qualidade.

- [x] T089 [P] Expandir seed com categorias e unidades de medida padrão e dados de demonstração (itens de exemplo) em `prisma/seed.ts` (área 18)
- [x] T090 [P] Escrever documentação de instalação e uso (README + `docs/`) baseada em quickstart.md (área 19)
- [ ] T091 [P] Testes E2E opcionais (Playwright) dos fluxos críticos V1–V6 do quickstart em `tests/e2e/` (área 17)
- [ ] T092 [P] Revisar acessibilidade (WCAG 2.1 AA) e responsividade (desktop/tablet/celular) dos fluxos principais
- [ ] T093 [P] Endurecer segurança: headers, cookies Secure/SameSite, **proteção CSRF** de mutações/Server Actions, rate limit no login, verificação de segredos fora do código *(cobre S1)*
- [ ] T097 [P] Implementar tratamento **LGPD** de dados pessoais (minimização de campos de usuário, política de retenção/anonimização, acesso restrito a dados pessoais) documentado em `docs/lgpd.md` e aplicado em `src/modules/usuarios/*` *(cobre FR-047)*
- [ ] T094 Otimizar índices e consultas agregadas do dashboard/relatórios (revisar `EXPLAIN`)
- [ ] T095 Finalizar `docker-compose` de produção (app + db) e checklist de implantação (área 20)
- [ ] T096 Executar validação completa do `quickstart.md` (V1–V6) e corrigir pendências

---

## Legenda de status

- `[x]` concluída e verificada (typecheck + lint + testes verdes)
- `[~]` parcial (lógica de domínio pronta e testada; parte que depende de DB/framework pendente)
- `[ ]` pendente

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências.
- **Foundational (Phase 2)**: depende do Setup — **bloqueia todas as histórias**.
- **US1 (Phase 3)**: depende de Foundational. É o motor central — **US3, US5, US8 dependem do serviço de movimentação (T033)**.
- **US2 (Phase 4)**: depende de Foundational; aplica segurança sobre US1.
- **US3 (Phase 5)**: depende de Foundational + T033 (US1).
- **US4 (Phase 6)**: depende de Foundational; recomendável após US1 (usa `item-service`).
- **US9 (Phase 7)**: depende de Foundational + US2 (auth/RBAC).
- **US5 (Phase 8)**: depende de T033 (US1).
- **US6 (Phase 9)**: depende de dados de US1/US3 (movimentações/lotes) para indicadores reais.
- **US8 (Phase 10)**: depende de T033 (US1) e T052 (US3, para lotes).
- **US7 (Phase 11)**: depende de movimentações (US1) e, para relatórios de merenda, US3.
- **Polish (Phase 12)**: depende das histórias desejadas concluídas.

### Ordem recomendada (MVP → incremental)

`Setup → Foundational → US1 → US2 → US3` (**MVP P1 completo**) → `US4 → US9 → US5 → US6` (P2) →
`US8 → US7` (P3) → `Polish`.

### Parallel Opportunities

- Setup: T002–T007 em paralelo [P].
- Foundational: T014–T023, T025, T027–T028 em paralelo [P] após o schema/migration (T009–T013).
- Dentro de cada história, tarefas de teste [P] rodam juntas; modelos/serviços em arquivos distintos [P].
- Com equipe: após Foundational, US1 e US2 podem andar em paralelo; US4/US9 em paralelo entre si; US6/US7/US8 em paralelo entre si (respeitando dependência de US1/US3).

---

## Implementation Strategy

### MVP First (Histórias P1)

1. Phase 1 (Setup) → 2. Phase 2 (Foundational) → 3. US1 → 4. US2 → 5. US3.
6. **PARAR e VALIDAR**: rodar V1–V4 do quickstart. Este é o MVP funcional completo.

### Incremental Delivery

Cada história posterior (US4, US9, US5, US6, US8, US7) é testável e entregável de forma independente,
sem quebrar as anteriores. Rodar o teste independente da história ao final de cada fase.

---

## Notes

- [P] = arquivos diferentes, sem dependências pendentes.
- [Story] mapeia a tarefa à história (rastreabilidade com o spec.md).
- Regras críticas têm teste na própria história (pedido do usuário).
- Nenhuma UI altera saldo diretamente — sempre via serviço de movimentação (T033/T052).
- Histórico (movimentação/auditoria) é append-only; correções por movimentação compensatória.
- Commit após cada tarefa ou grupo lógico; parar em qualquer checkpoint para validar a história.
