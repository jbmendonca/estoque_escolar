# Phase 0 — Research: Sistema de Controle de Estoque Escolar

Todas as escolhas de tecnologia foram fornecidas pelo usuário; não há itens `NEEDS CLARIFICATION`
pendentes. Este documento consolida as decisões e os padrões adotados, com justificativa e alternativas
consideradas, especialmente onde impactam integridade, segurança e desempenho.

## 1. Framework full-stack — Next.js (App Router)

- **Decisão**: Next.js 15 (App Router, React 19), backend via Route Handlers + Server Actions no mesmo
  projeto.
- **Rationale**: tipos TypeScript compartilhados entre UI e domínio; um só deploy; SSR para telas
  responsivas rápidas; Server Actions simplificam formulários com React Hook Form + Zod.
- **Alternativas**: backend separado (NestJS/Express) + SPA — rejeitado por overhead operacional
  desnecessário ao MVP; Remix — viável, mas o usuário especificou Next.js.

## 2. ORM e banco — Prisma + PostgreSQL

- **Decisão**: Prisma 6 sobre PostgreSQL 16; Prisma Migrate para migrations e `prisma db seed`.
- **Rationale**: modelagem tipada, migrations versionadas, suporte a transações interativas
  (`prisma.$transaction(async (tx) => ...)`) necessárias ao serviço de movimentação.
- **Concorrência / saldo**: usar transação com **row lock** no registro de `Stock` (e `FoodBatch`)
  via `SELECT ... FOR UPDATE` (Prisma `$queryRaw` dentro da transação) antes de recalcular saldo, para
  serializar operações concorrentes sobre o mesmo saldo e impedir saldo negativo.
- **Alternativas**: Drizzle — bom, mas Prisma foi especificado; nível de isolamento SERIALIZABLE global
  — rejeitado por custo; preferimos lock pontual por linha.

## 3. Autenticação por sessão

- **Decisão**: sessão server-side com cookie **HttpOnly + Secure + SameSite=Lax**, assinado (iron-session
  ou equivalente). Senha com **argon2id**.
- **Rationale**: atende ao pedido de "sessão segura" e aos princípios de segurança da constituição;
  argon2id é padrão atual recomendado para hashing de senha.
- **Alternativas**: JWT em localStorage — rejeitado (exposição a XSS, difícil revogação); NextAuth —
  possível, mas sessão própria dá controle fino de RBAC e escopo de escola.

## 4. RBAC + escopo multi-escola

- **Decisão**: modelo `Role`–`Permission` (N:N) e `User`–`Role`; vínculo `UserSchool` define as escolas
  do usuário. Autorização centralizada numa **política reutilizável** (`can(user, permission, {schoolId})`)
  aplicada no servidor em cada Route Handler/Server Action, mais um helper `withSchoolScope` que injeta o
  filtro de escola em toda query.
- **Rationale**: cumpre "negar por padrão", verificação no backend e isolamento por escola (Princípios
  III e V). Sidebar apenas reflete as permissões — nunca é a fonte de autorização.
- **Perfis-semente**: ADMINISTRADOR (global), GESTOR_ESCOLAR, SECRETARIO, COORDENADOR, MERENDEIRA
  (só FOOD), ASSISTENTE_ALUNO (só SCHOOL_MATERIAL). Merendeira/Assistente restritos por `module` do item.
- **Alternativas**: RBAC hardcoded por enum de papel — rejeitado por não permitir configurar permissões
  (requisito do Administrador). Optou-se por permissões persistidas e configuráveis.

## 5. Características variáveis extensíveis

- **Decisão**: tabela `ItemCharacteristic` (itemId, key, value) — modelo par atributo/valor (EAV leve).
  Índice em (itemId) e em (key, value) para busca por característica.
- **Rationale**: permite múltiplos atributos (Marca, Cor, Gramatura...) sem alterar o schema por tipo,
  conforme FR-006. Simples de consultar e validar.
- **Alternativas**: coluna JSONB em `Item` — viável e mais compacta, mas dificulta busca/índice por par
  específico exigida por FR-011; EAV explícito escolhido pela clareza de consulta e integridade.

## 6. Modelo unificado de Item com indicação de módulo

- **Decisão**: uma tabela `Item` com enum `module` (`FOOD` | `SCHOOL_MATERIAL`), compartilhando
  atributos comuns (código, nome, categoria, unidade, prateleira, estoque mínimo, situação, escola).
  Lotes (`FoodBatch`) existem **apenas** para itens `FOOD`. Materiais controlam saldo direto em `Stock`.
- **Rationale**: evita duplicação de estrutura (pedido explícito), mantendo a especialização de merenda
  (lote/validade) isolada.
- **Alternativas**: duas tabelas separadas (FoodItem/MaterialItem) — rejeitado por duplicar atributos e
  o serviço de movimentação.

## 7. Saldo: Stock por item (e por lote na merenda)

- **Decisão**: `Stock` mantém o saldo atual por item/escola (materiais) e, para merenda, o saldo é a
  soma dos `FoodBatch` (saldo por lote) — o serviço de movimentação atualiza o lote e reflete o total.
- **Rationale**: FEFO exige saldo por lote (Princípio VI / FR-013); materiais não precisam de lote
  (pedido). `Stock` dá o total consultável rapidamente e ponto de lock.
- **FEFO**: na saída de FOOD, ordenar lotes com saldo>0 por `expiryDate` ASC e consumir do que vence
  primeiro; sugerir ao usuário e permitir completar com o próximo lote se insuficiente.

## 8. Movimentação como serviço central e imutável

- **Decisão**: `StockMovement` (cabeçalho) + `StockMovementItem` (linhas) append-only. Enum
  `MovementType` (ENTRADA, SAIDA, DISTRIBUICAO, DEVOLUCAO, PERDA, AVARIA, PRODUTO_VENCIDO,
  TRANSFERENCIA_INTERNA, AJUSTE, CONSUMO, PREPARO_MERENDA). Cada linha grava `previousBalance` e
  `newBalance`. Número único sequencial por movimentação.
- **Rationale**: rastreabilidade e imutabilidade (Princípio II); único ponto de escrita de saldo
  (Princípio IV). Perda/avaria/vencido/ajuste exigem justificativa.
- **Ajuste (decisão de clarificação)**: efetiva na hora; marca `reviewStatus = PENDENTE_REVISAO` e cria
  `ReviewNotification` ao Gestor; Gestor marca `REVISADO` (registrado em AuditLog). Saldo não muda na
  revisão.

## 9. Geração de código único e imutável

- **Decisão**: código no padrão `MER-000001` / `MAT-000001` gerado por sequência por módulo (tabela de
  contador `CodeSequence` incrementada dentro da transação de criação) — único e não reutilizável.
  Bloqueio de alteração após existir qualquer `StockMovementItem` referente ao item.
- **Rationale**: FR-007/008/009. Sequência transacional evita colisão sob concorrência.
- **Alternativas**: usar `id` autoincrement diretamente no código — rejeitado por acoplar o formato ao
  PK e não permitir prefixo por módulo de forma limpa.

## 10. Tabela de estoque no frontend (server-side)

- **Decisão**: TanStack Table em modo controlado + endpoint paginado (`page`, `pageSize`, `sort`,
  `filters`) que aplica busca, filtros e ordenação **no PostgreSQL**; ordenação alfabética por nome
  como padrão.
- **Rationale**: pedido explícito de não carregar milhares de linhas no cliente; desempenho e escopo de
  escola aplicados no servidor.

## 11. Relatórios desacoplados da apresentação

- **Decisão**: camada `modules/relatorios` produz um **dataset** (consulta + DTO) independente do
  formato; adaptadores de exportação para CSV/XLSX (ex.: `exceljs`) e PDF (ex.: `@react-pdf/renderer` ou
  render server-side). MVP entrega ao menos CSV/XLSX; PDF preparado na arquitetura.
- **Rationale**: FR-035…FR-038; separação pedida entre geração e apresentação.

## 12. Auditoria independente

- **Decisão**: `AuditLog` (userId, action, resource, resourceId, before JSONB, after JSONB, createdAt)
  gravado por um helper chamado nos casos de uso críticos (login, CRUD de usuário/item, movimentação,
  ajuste, revisão de ajuste, cancelamento, alteração de permissões). Imutável.
- **Rationale**: Princípio II e FR-041…FR-043; separado do histórico de movimentação (que é o "livro" de
  estoque), pois auditoria cobre também ações administrativas sem saldo.

## 13. Docker e ambiente

- **Decisão**: `docker-compose.yml` sobe PostgreSQL para dev; `Dockerfile` multi-stage para produção;
  `.env.example` com todas as variáveis (sem segredos reais). Seed idempotente para dev.
- **Rationale**: pedido explícito; reprodutibilidade do ambiente.

## 14. Qualidade

- **Decisão**: TypeScript `strict`, Zod nas fronteiras (entrada de API/Server Actions), Vitest para
  unidades de regra de negócio, testes de integração para o serviço de movimentação (incl. concorrência)
  e rotas com escopo de escola, ESLint + Prettier, hooks de CI opcionais.
- **Rationale**: Princípio VII; regras críticas (saldo não-negativo, FEFO, RBAC, código único) com
  cobertura automatizada.

## Resumo de decisões (rápido)

| Tema | Decisão |
|------|---------|
| Multi-escola | `schoolId` em todo dado; `withSchoolScope`; catálogo por escola |
| Saldo | Único via serviço de movimentação, transação + row lock, nunca negativo |
| Merenda | `FoodBatch` (produto+número+validade); FEFO na saída; alertas configuráveis |
| Materiais | Sem lote; saldo direto em `Stock` |
| Características | `ItemCharacteristic` (EAV leve) |
| Código | Sequência por módulo `MER-/MAT-`, imutável pós-movimentação |
| Auth | Sessão cookie HttpOnly + argon2id |
| RBAC | `Role`/`Permission` configuráveis + política no backend |
| Ajuste | Efetiva na hora + revisão posterior (notificação ao Gestor) |
| Relatórios | Dataset desacoplado + adaptadores CSV/XLSX/PDF |
| Auditoria | `AuditLog` independente, imutável |
