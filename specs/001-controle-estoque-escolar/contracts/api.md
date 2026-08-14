# Phase 1 — API Contracts: Sistema de Controle de Estoque Escolar

Contratos dos endpoints backend (Next.js Route Handlers sob `src/app/api`) e Server Actions. Regras
transversais a **todos** os endpoints (exceto login):

- **Autenticação**: exigem sessão válida (cookie HttpOnly). Sem sessão → `401`.
- **Autorização**: verificada no servidor pela política `can(user, permission, {schoolId})`. Sem
  permissão → `403`. Nunca depender do frontend.
- **Escopo de escola**: toda leitura/escrita é filtrada pelas escolas do usuário (`withSchoolScope`);
  Administrador tem acesso global. Acesso a escola fora do vínculo → `403`.
- **Validação**: corpo/query validados com Zod → `422` em erro de validação, com detalhes por campo.
- **Formato de erro** (padrão):
  ```json
  { "error": { "code": "FORBIDDEN", "message": "texto pt-BR", "details": {} } }
  ```
- **Listagens**: parâmetros comuns `page` (1..), `pageSize` (default 20, max 100), `sort`
  (ex.: `name:asc`), `q` (busca), filtros específicos. Resposta:
  ```json
  { "data": [ ... ], "page": 1, "pageSize": 20, "total": 137, "totalPages": 7 }
  ```
  Ordenação **default `name:asc`** onde aplicável. Paginação/filtros/ordenação executados no banco.
- **Auditoria**: mutações críticas gravam `AuditLog` automaticamente.

Códigos de status: `200` ok, `201` criado, `204` sem conteúdo, `400` requisição inválida, `401` não
autenticado, `403` sem permissão, `404` não encontrado, `409` conflito (ex.: código duplicado, saldo
insuficiente), `422` validação.

---

## Auth

### POST /api/auth/login
- Body: `{ email, password }`
- 200: define cookie de sessão; `{ user: { id, name, roles[], schools[] } }`. Grava `AuditLog(LOGIN)`.
- 401: credenciais inválidas.

### POST /api/auth/logout
- 204: encerra sessão.

### GET /api/auth/me
- 200: `{ user, permissions[], schools[] }` — usado pela sidebar dinâmica (apenas reflete permissões).

---

## Administração — Escolas, Usuários, Permissões

### Escolas  (perm: `school.manage`, normalmente ADMIN)
- `GET /api/schools` — lista (paginada).
- `POST /api/schools` — `{ name, code, address? }` → 201. `AuditLog(SCHOOL_CREATE)`.
- `PATCH /api/schools/{id}` — edição/`active`.

### Usuários  (perm: `user.manage`)
- `GET /api/users` — lista (filtra por escola do solicitante; ADMIN vê todos).
- `POST /api/users` — `{ name, email, password, roleIds[], schoolIds[] }` → 201.
  `AuditLog(USER_CREATE)`.
- `PATCH /api/users/{id}` — editar dados/papéis/escolas/`active` (inativar em vez de excluir).
  `AuditLog(USER_UPDATE)`.
- Regra: não permite `DELETE` de usuário com histórico (usar `active=false`).

### Papéis e Permissões  (perm: `permission.manage`)
- `GET /api/roles` / `GET /api/permissions`.
- `PATCH /api/roles/{id}/permissions` — `{ permissionIds[] }`. `AuditLog(PERMISSION_CHANGE)`.
  Perfis `isSystem` têm proteção contra remoção.

---

## Cadastros base  (perm: `catalog.manage` conforme módulo)

- `GET|POST|PATCH /api/categories` — `{ name, module }` (único por escola+módulo).
- `GET|POST|PATCH /api/units` — `{ name, abbreviation }`.
- `GET|POST|PATCH /api/suppliers` — `{ name, document?, contact? }`.
- `GET|POST|PATCH /api/storage-locations` — `{ code, warehouse, shelf, rack, position?, description? }`.
- `GET|PATCH /api/config` — parâmetros por escola (ex.: `{ nearExpiryDays: 30 }`).

---

## Catálogo de Itens  (merenda e materiais)

### GET /api/items
- Query: `module` (FOOD|SCHOOL_MATERIAL), `q`, `categoryId`, `storageLocationId`,
  `characteristic` (`key:value`), `schoolId?` (ADMIN), `active?`, paginação/ordenação.
- 200: lista paginada; default `name:asc`. Restrito à escola do usuário.
- Perm: `item.view` (+ `moduleScope` para MERENDEIRA/ASSISTENTE_ALUNO).

### POST /api/items
- Perm: `item.create` (módulo permitido).
- Body: `{ module, name, description?, categoryId, unitOfMeasureId, storageLocationId?, brand?,
  minStock?, characteristics?: [{key, value}] }`
- 201: item com `code` gerado (`MER-/MAT-`). `AuditLog(ITEM_CREATE)`.
- 409: violação de unicidade.

### PATCH /api/items/{id}
- Perm: `item.update`. Atualiza dados/características/`active`.
- Regra: **rejeita alteração de `code`** se já houver movimentação → `409`. `AuditLog(ITEM_UPDATE)`.

### GET /api/items/{id}
- 200: item + características + saldo (`Stock`) + (se FOOD) lotes.

---

## Lotes (Merenda)  — perm módulo FOOD

- `GET /api/food-batches?itemId=` — lotes com saldo, ordenados por `expiryDate ASC` (FEFO).
- Criação de lote ocorre via **entrada** (movimentação), não por endpoint direto de saldo.
- `GET /api/food-batches/alerts` — retorna `nearExpiry[]`, `expired[]` conforme `nearExpiryDays`.

---

## Movimentações  (ÚNICO caminho para alterar saldo)

### POST /api/movements
- Perm: depende do `type` e do módulo (ex.: `movement.create`, MERENDEIRA só FOOD, ASSISTENTE só
  SCHOOL_MATERIAL).
- Body (cabeçalho + linhas):
  ```json
  {
    "module": "FOOD",
    "type": "SAIDA",
    "justification": "obrigatória p/ PERDA|AVARIA|PRODUTO_VENCIDO|AJUSTE",
    "notes": "",
    "referenceDocument": "NF 123",
    "distributionTarget": "TURMA",          // opcional (materiais)
    "distributionTargetLabel": "5º A",
    "items": [
      { "itemId": "...", "quantity": 10,
        "foodBatchId": "...",               // opcional; se ausente em SAIDA FOOD, servidor aplica FEFO
        "batchInput": {                     // usado em ENTRADA de FOOD
          "batchNumber": "L123", "expiryDate": "2026-09-30",
          "manufactureDate": "2026-06-01", "supplierId": "...", "receivedAt": "2026-08-14" }
      }
    ]
  }
  ```
- **Comportamento**:
  - Executa em **transação PostgreSQL** com `SELECT ... FOR UPDATE` no(s) `Stock`/`FoodBatch`.
  - Calcula e grava `previousBalance`/`newBalance` por linha; **bloqueia saldo negativo** → `409`
    `{ code: "INSUFFICIENT_STOCK" }`.
  - `ENTRADA` de FOOD cria/soma `FoodBatch` por (item, número, validade).
  - `SAIDA/CONSUMO/PREPARO_MERENDA` de FOOD consome via **FEFO** (menor `expiryDate` primeiro); se um
    lote não cobre, sugere/consome o próximo.
  - `AJUSTE`: efetiva na hora, define `reviewStatus=PENDENTE_REVISAO`, cria `ReviewNotification` e
    `AuditLog(ADJUSTMENT)`.
  - `TRANSFERENCIA_INTERNA`: muda apenas `storageLocationId`, mesma escola (não cross-school).
- 201: `{ movement: { number, ... }, lines: [...] }`. `AuditLog(MOVEMENT)`.

### GET /api/movements
- Query: `module`, `type`, `itemId`, `userId`, `from`, `to`, `schoolId?` (ADMIN), paginação.
- 200: histórico paginado (imutável). Ordenação default `createdAt:desc`.

### POST /api/movements/{id}/cancel
- Perm: `movement.cancel`. Cria movimentação **compensatória** (não apaga a original).
  `AuditLog(CANCELLATION)`.

### GET /api/movements/fefo-preview
- Query: `itemId`, `quantity`. Retorna a sugestão de lotes (FEFO) sem efetivar — usado pela UI de saída.

---

## Inventário

- `POST /api/inventories` — `{ module, description? }` → cria conferência (status ABERTO).
- `GET /api/inventories/{id}` — cabeçalho + linhas com `systemQuantity`.
- `PATCH /api/inventories/{id}/items` — `[{ itemId, foodBatchId?, countedQuantity, justification? }]`
  (justificativa obrigatória quando `difference ≠ 0`).
- `POST /api/inventories/{id}/close` — Perm: `inventory.close`. Para cada diferença, gera
  `StockMovement(AJUSTE)` (efetiva + `ReviewNotification`) e `AuditLog(ADJUSTMENT)`; fecha o inventário.

---

## Ajustes / Revisão

- `GET /api/adjustments/pending` — Perm: `adjustment.review` (GESTOR/ADMIN). Lista ajustes
  `PENDENTE_REVISAO` da(s) escola(s) do usuário.
- `POST /api/adjustments/{movementId}/review` — marca `REVISADO`. `AuditLog(ADJUSTMENT_REVIEW)`. Não
  altera saldo.

---

## Dashboard

### GET /api/dashboard
- Query: `schoolId?` (ADMIN), `period?` (ex.: `30d`).
- 200: indicadores por **consultas agregadas** e restritos à escola/permissões:
  ```json
  {
    "itemsCount": { "food": 0, "material": 0 },
    "lowStock": 0, "outOfStock": 0,
    "nearExpiry": 0, "expired": 0,
    "recentEntries": [ ... ], "recentExits": [ ... ],
    "movementsInPeriod": 0,
    "foodConsumption": 0, "materialDistribution": 0
  }
  ```

---

## Relatórios

### GET /api/reports/{type}
- `type` ∈ posição, inventario, entradas, saidas, movimentacoes, consumo, perdas, vencidos,
  proximos-vencimento, abaixo-minimo, distribuicao, por-usuario, por-escola, por-periodo.
- Query: `from`, `to`, `schoolId?`, `itemId?`, `categoryId?`, `movementType?`, `format`
  (`json`|`csv`|`xlsx`|`pdf`).
- 200: dataset (json) **ou** arquivo (csv/xlsx/pdf) via adaptador de exportação; geração desacoplada da
  apresentação. Restrito ao escopo de escola.

---

## Auditoria

### GET /api/audit
- Perm: `audit.view` (ADMIN; GESTOR limitado à sua escola).
- Query: `action`, `resource`, `userId`, `from`, `to`, `schoolId?`, paginação.
- 200: registros imutáveis com `before`/`after` quando aplicável.

---

## Mapa permissão → endpoint (resumo)

| Permissão | Endpoints principais | Perfis típicos |
|-----------|----------------------|----------------|
| `item.view` / `item.create` / `item.update` | /api/items* | SECRETARIO, COORDENADOR (view), MERENDEIRA/ASSISTENTE (view do seu módulo) |
| `movement.create` | POST /api/movements | SECRETARIO, MERENDEIRA (FOOD), ASSISTENTE (MATERIAL), COORDENADOR (se permissão concedida) |
| `movement.cancel` | /movements/{id}/cancel | GESTOR, ADMIN |
| `adjustment.review` | /adjustments/* | GESTOR, ADMIN |
| `inventory.close` | /inventories/{id}/close | SECRETARIO/GESTOR conforme config |
| `report.view` | /api/reports/* | todos conforme escopo |
| `audit.view` | /api/audit | ADMIN, GESTOR (própria escola) |
| `user.manage`, `school.manage`, `permission.manage` | administração | ADMIN |
