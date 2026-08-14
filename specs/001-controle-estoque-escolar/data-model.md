# Phase 1 — Data Model: Sistema de Controle de Estoque Escolar

Modelo lógico para Prisma/PostgreSQL. Convenções aplicadas a **todas** as tabelas relevantes:

- `id` (cuid/uuid, PK)
- `createdAt` (timestamptz, default now)
- `updatedAt` (timestamptz, @updatedAt)
- `createdById` (FK → User) quando faz sentido registrar autoria
- `active` (boolean) para controle ativo/inativo quando aplicável (inativação em vez de exclusão)

Isolamento multi-escola: entidades operacionais carregam `schoolId` e são sempre filtradas pelo escopo
do usuário. Registros históricos (`StockMovement*`, `AuditLog`) são **append-only** (sem UPDATE/DELETE).

## Enums

```text
ModuleType        = FOOD | SCHOOL_MATERIAL
MovementType      = ENTRADA | SAIDA | CONSUMO | PREPARO_MERENDA | DISTRIBUICAO | DEVOLUCAO
                  | PERDA | AVARIA | PRODUTO_VENCIDO | TRANSFERENCIA_INTERNA | AJUSTE
MovementDirection = IN | OUT            # derivado do tipo (entrada/devolução = IN; demais = OUT; ajuste = IN/OUT)
ReviewStatus      = NAO_APLICAVEL | PENDENTE_REVISAO | REVISADO
DistributionTarget= ALUNO | TURMA | PROFESSOR | SETOR | ATIVIDADE | OUTRO
AuditAction       = LOGIN | USER_CREATE | USER_UPDATE | ITEM_CREATE | ITEM_UPDATE | MOVEMENT
                  | ADJUSTMENT | ADJUSTMENT_REVIEW | CANCELLATION | PERMISSION_CHANGE | SCHOOL_CREATE
InventoryStatus   = ABERTO | EM_CONTAGEM | FECHADO | CANCELADO
```

## Entidades

### 1. School (Escola)
Unidade responsável por um estoque.
- `id`, `name`, `code` (único), `address?`, `active`, `createdAt`, `updatedAt`, `createdById?`
- Relações: 1—N `UserSchool`, `Item`, `Stock`, `StockMovement`, `Inventory`, `Supplier`, `StorageLocation`.

### 2. User (Usuário)
- `id`, `name`, `email` (único), `passwordHash`, `active`, `createdAt`, `updatedAt`, `createdById?`
- Relações: N—N `Role` (via `UserRole`); 1—N `UserSchool`; autor de vários registros.
- Regra: inativar (não excluir) usuários com histórico. Dados pessoais mínimos (LGPD).

### 3. Role (Perfil)
- `id`, `name` (único: ADMINISTRADOR, GESTOR_ESCOLAR, SECRETARIO, COORDENADOR, MERENDEIRA,
  ASSISTENTE_ALUNO), `description?`, `isSystem` (bool, protege perfis padrão), `active`, timestamps.
- Relações: N—N `Permission` (via `RolePermission`); N—N `User` (via `UserRole`).

### 4. Permission (Permissão)
- `id`, `key` (único, ex.: `item.create`, `movement.create`, `report.view`, `user.manage`,
  `audit.view`, `adjustment.review`), `description?`, `moduleScope?` (`FOOD`/`SCHOOL_MATERIAL`/null).
- Relações: N—N `Role`.
- Regra: autorização "negar por padrão"; Administrador recebe acesso global.

### 5. UserRole  *(junção)*
- `userId` + `roleId` (PK composta), `createdAt`.

### 6. RolePermission  *(junção)*
- `roleId` + `permissionId` (PK composta), `createdAt`.

### 7. UserSchool (Vínculo usuário↔escola)
- `id`, `userId`, `schoolId`, `active`, `createdAt`. Único (userId, schoolId).
- Regra: define quais escolas o usuário acessa; Administrador ignora o vínculo (acesso global).

### 8. Category (Categoria)
- `id`, `schoolId`, `name`, `module` (`ModuleType`), `active`, timestamps, `createdById?`.
- Único (schoolId, module, name).

### 9. UnitOfMeasure (Unidade de Medida)
- `id`, `schoolId?` (ou global), `name` (ex.: "Quilograma"), `abbreviation` (ex.: "kg"), `active`,
  timestamps. Único (schoolId, abbreviation).

### 10. Supplier (Fornecedor)
- `id`, `schoolId`, `name`, `document?` (CNPJ), `contact?`, `active`, timestamps, `createdById?`.

### 11. StorageLocation (Prateleira/Localização)
- `id`, `schoolId`, `code` (ex.: `ALM-01-A-01`, único por escola), `warehouse` (depósito/almoxarifado),
  `shelf` (estante), `rack` (prateleira), `position?`, `description?`, `active`, timestamps.

### 12. Item (Produto/Material) — tabela unificada
Atributos comuns aos dois módulos, diferenciados por `module`.
- `id`, `schoolId`, `code` (único global, `MER-000001`/`MAT-000001`, **imutável após movimentação**),
  `module` (`ModuleType`), `name`, `description?`, `categoryId`, `unitOfMeasureId`,
  `storageLocationId?`, `brand?`, `minStock` (default 0), `active`, `createdAt`, `updatedAt`,
  `createdById`.
- Relações: 1—N `ItemCharacteristic`; 1—1/1—N `Stock`; 1—N `FoodBatch` (só `FOOD`);
  N em `StockMovementItem`, `InventoryItem`.
- Regras: catálogo **por escola** (item pertence a exatamente uma escola); listas ordenadas por `name`
  ASC por padrão; busca por nome/código/categoria/prateleira/característica/escola.
- Índices: (schoolId, module, name), (schoolId, code) único, (categoryId), (storageLocationId).

### 13. ItemCharacteristic (Característica variável)
- `id`, `itemId`, `key` (ex.: "Marca"), `value` (ex.: "Faber-Castell"), `createdAt`.
- Único (itemId, key). Índice (key, value) para busca por característica.
- Regra: permite N atributos por item sem alterar schema (EAV leve).

### 14. FoodBatch (Lote de alimento) — apenas `FOOD`
- `id`, `schoolId`, `itemId`, `batchNumber`, `manufactureDate?`, `expiryDate`, `supplierId?`,
  `quantity` (saldo atual do lote, ≥ 0), `active`, `createdAt`, `updatedAt`, `createdById`.
- **Unicidade**: (itemId, batchNumber, expiryDate) — entradas com mesmo número e mesma validade somam;
  validade diferente = novo lote (decisão de clarificação).
- Índices: (itemId, expiryDate ASC) para FEFO; (schoolId, expiryDate).
- Regra: `quantity` nunca negativa; consumo FEFO por `expiryDate` ASC.

### 15. Stock (Saldo por item/escola)
- `id`, `schoolId`, `itemId` (único), `quantity` (≥ 0), `updatedAt`.
- Para `FOOD`: `quantity` = soma dos `FoodBatch` (mantido consistente pelo serviço).
- Para `SCHOOL_MATERIAL`: saldo direto.
- Ponto de **row lock** (`FOR UPDATE`) nas movimentações; garante ausência de saldo negativo.

### 16. StockMovement (Movimentação — cabeçalho, imutável)
- `id`, `number` (sequencial único, ex.: `MOV-000123`), `schoolId`, `module`, `type` (`MovementType`),
  `direction` (`MovementDirection`), `reason?`/`justification?` (obrigatória p/ PERDA, AVARIA,
  PRODUTO_VENCIDO, AJUSTE), `notes?`, `referenceDocument?`, `distributionTarget?`
  (`DistributionTarget`), `distributionTargetLabel?`, `reviewStatus` (`ReviewStatus`, default
  NAO_APLICAVEL; PENDENTE_REVISAO para AJUSTE), `userId` (responsável), `createdAt`.
- Relações: 1—N `StockMovementItem`; opcional `inventoryId` (quando gerada por inventário).
- **Append-only**: sem update/delete. Cancelamento = nova movimentação compensatória.

### 17. StockMovementItem (Movimentação — linha, imutável)
- `id`, `movementId`, `itemId`, `foodBatchId?` (quando `FOOD`), `quantity` (> 0),
  `previousBalance`, `newBalance`, `createdAt`.
- Regra: `newBalance = previousBalance ± quantity` conforme direção; `newBalance ≥ 0` sempre.
- Índices: (itemId, createdAt), (movementId).

### 18. Inventory (Conferência de estoque — cabeçalho)
- `id`, `schoolId`, `module`, `status` (`InventoryStatus`), `description?`, `startedById`,
  `closedById?`, `createdAt`, `updatedAt`, `closedAt?`.
- Relações: 1—N `InventoryItem`; ajustes de fechamento geram `StockMovement` (AJUSTE).

### 19. InventoryItem (Linha de conferência)
- `id`, `inventoryId`, `itemId`, `foodBatchId?`, `systemQuantity`, `countedQuantity`,
  `difference` (derivado), `justification?` (obrigatória quando difference ≠ 0), `adjusted` (bool),
  `movementItemId?` (liga ao ajuste gerado), `createdAt`.

### 20. AuditLog (Auditoria — independente, imutável)
- `id`, `userId?`, `schoolId?`, `action` (`AuditAction`), `resource` (ex.: "Item"), `resourceId?`,
  `before` (JSONB?), `after` (JSONB?), `ip?`, `createdAt`.
- **Append-only**. Cobre também ações administrativas sem saldo (login, permissões, escolas).

### 21. ReviewNotification (Notificação de revisão de ajuste)
- `id`, `schoolId`, `movementId` (o ajuste), `assignedToRole` (GESTOR_ESCOLAR) ou `assignedToUserId?`,
  `status` (PENDENTE | REVISADO), `reviewedById?`, `reviewedAt?`, `createdAt`.
- Regra: criada ao efetivar um AJUSTE; marcar como REVISADO gera `AuditLog(ADJUSTMENT_REVIEW)`; não
  altera saldo.

### 22. CodeSequence (Contador de códigos) *(infra)*
- `id`, `schoolId`, `module` (`ModuleType`) ou `scope` (`ITEM_MER`/`ITEM_MAT`/`MOVEMENT`), `nextValue`.
- Incrementado dentro da transação de criação para gerar códigos únicos e não reutilizáveis.

### 23. AppConfig (Configuração) *(por escola)*
- `id`, `schoolId`, `key` (ex.: `nearExpiryDays`), `value`, `updatedAt`, `updatedById?`.
- Guarda o parâmetro configurável de "próximo do vencimento" (default 30 dias) e afins.

## Relacionamentos (resumo)

```text
School 1—N UserSchool N—1 User
User N—N Role N—N Permission           (UserRole, RolePermission)
School 1—N Category | UnitOfMeasure | Supplier | StorageLocation | Item | Stock | StockMovement | Inventory | AppConfig
Item 1—N ItemCharacteristic
Item 1—N FoodBatch                      (apenas module=FOOD)
Item 1—1 Stock
StockMovement 1—N StockMovementItem N—1 Item (e opcional FoodBatch)
Inventory 1—N InventoryItem
StockMovement 1—1 ReviewNotification    (apenas type=AJUSTE)
```

## Regras de negócio (invariantes) mapeadas às FRs

| Invariante | FR | Onde é garantido |
|-----------|-----|------------------|
| Saldo nunca negativo (item e lote) | FR-023, SC-002 | Serviço de movimentação, transação + `FOR UPDATE` |
| Movimentação registra saldo ant./post., usuário, data/hora | FR-022, SC-001 | `StockMovementItem` |
| Movimentação/auditoria imutáveis | FR-026, FR-043, SC-011 | Sem update/delete; compensação por nova mov. |
| Código único, imutável pós-movimentação | FR-007/008/009 | `CodeSequence` + guarda na atualização de `Item` |
| Catálogo por escola | FR-002a | `schoolId` obrigatório em `Item`, sem compartilhamento |
| Lote = produto+número+validade | FR-015a | Unicidade em `FoodBatch` |
| FEFO na saída de FOOD | FR-016, SC-004 | Ordenação por `expiryDate` no serviço |
| Justificativa em perda/avaria/vencido/ajuste | FR-024 | Validação Zod + serviço |
| Ajuste efetiva + revisão posterior | FR-024a, SC-012 | `reviewStatus` + `ReviewNotification` |
| Transferência apenas interna | FR-021a | `type=TRANSFERENCIA_INTERNA` não muda `schoolId` |
| Escopo de escola em toda query | FR-029/FR-030/FR-034/FR-038 | `withSchoolScope` + policy no backend |
| Ordenação alfabética padrão | FR-010 | Query default `ORDER BY name ASC` |
| Inventário gera ajuste + auditoria | FR-039/FR-040 | `Inventory`→`StockMovement(AJUSTE)`→`AuditLog` |
