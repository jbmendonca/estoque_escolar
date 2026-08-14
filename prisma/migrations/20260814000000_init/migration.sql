-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ModuleType" AS ENUM ('FOOD', 'SCHOOL_MATERIAL');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('ENTRADA', 'SAIDA', 'CONSUMO', 'PREPARO_MERENDA', 'DISTRIBUICAO', 'DEVOLUCAO', 'PERDA', 'AVARIA', 'PRODUTO_VENCIDO', 'TRANSFERENCIA_INTERNA', 'AJUSTE');

-- CreateEnum
CREATE TYPE "MovementDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('NAO_APLICAVEL', 'PENDENTE_REVISAO', 'REVISADO');

-- CreateEnum
CREATE TYPE "DistributionTarget" AS ENUM ('ALUNO', 'TURMA', 'PROFESSOR', 'SETOR', 'ATIVIDADE', 'OUTRO');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('LOGIN', 'USER_CREATE', 'USER_UPDATE', 'ITEM_CREATE', 'ITEM_UPDATE', 'MOVEMENT', 'ADJUSTMENT', 'ADJUSTMENT_REVIEW', 'CANCELLATION', 'PERMISSION_CHANGE', 'SCHOOL_CREATE');

-- CreateEnum
CREATE TYPE "InventoryStatus" AS ENUM ('ABERTO', 'EM_CONTAGEM', 'FECHADO', 'CANCELADO');

-- CreateTable
CREATE TABLE "School" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "moduleScope" "ModuleType",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "UserSchool" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSchool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "module" "ModuleType" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitOfMeasure" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT,
    "name" TEXT NOT NULL,
    "abbreviation" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnitOfMeasure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "document" TEXT,
    "contact" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorageLocation" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "warehouse" TEXT NOT NULL,
    "shelf" TEXT NOT NULL,
    "rack" TEXT NOT NULL,
    "position" TEXT,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorageLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "module" "ModuleType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT NOT NULL,
    "unitOfMeasureId" TEXT NOT NULL,
    "storageLocationId" TEXT,
    "brand" TEXT,
    "minStock" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemCharacteristic" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemCharacteristic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodBatch" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "manufactureDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "supplierId" TEXT,
    "quantity" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "FoodBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stock" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "module" "ModuleType" NOT NULL,
    "type" "MovementType" NOT NULL,
    "direction" "MovementDirection" NOT NULL,
    "justification" TEXT,
    "notes" TEXT,
    "referenceDocument" TEXT,
    "distributionTarget" "DistributionTarget",
    "distributionTargetLabel" TEXT,
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'NAO_APLICAVEL',
    "userId" TEXT NOT NULL,
    "inventoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovementItem" (
    "id" TEXT NOT NULL,
    "movementId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "foodBatchId" TEXT,
    "quantity" DECIMAL(65,30) NOT NULL,
    "previousBalance" DECIMAL(65,30) NOT NULL,
    "newBalance" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovementItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inventory" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "module" "ModuleType" NOT NULL,
    "status" "InventoryStatus" NOT NULL DEFAULT 'ABERTO',
    "description" TEXT,
    "startedById" TEXT NOT NULL,
    "closedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "Inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "foodBatchId" TEXT,
    "systemQuantity" DECIMAL(65,30) NOT NULL,
    "countedQuantity" DECIMAL(65,30) NOT NULL,
    "difference" DECIMAL(65,30) NOT NULL,
    "justification" TEXT,
    "adjusted" BOOLEAN NOT NULL DEFAULT false,
    "movementItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "schoolId" TEXT,
    "action" "AuditAction" NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewNotification" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "movementId" TEXT NOT NULL,
    "assignedToRole" TEXT,
    "assignedToUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodeSequence" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "nextValue" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CodeSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppConfig" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "AppConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "School_code_key" ON "School"("code");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

-- CreateIndex
CREATE UNIQUE INDEX "UserSchool_userId_schoolId_key" ON "UserSchool"("userId", "schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_schoolId_module_name_key" ON "Category"("schoolId", "module", "name");

-- CreateIndex
CREATE UNIQUE INDEX "UnitOfMeasure_schoolId_abbreviation_key" ON "UnitOfMeasure"("schoolId", "abbreviation");

-- CreateIndex
CREATE UNIQUE INDEX "StorageLocation_schoolId_code_key" ON "StorageLocation"("schoolId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Item_code_key" ON "Item"("code");

-- CreateIndex
CREATE INDEX "Item_schoolId_module_name_idx" ON "Item"("schoolId", "module", "name");

-- CreateIndex
CREATE INDEX "ItemCharacteristic_key_value_idx" ON "ItemCharacteristic"("key", "value");

-- CreateIndex
CREATE UNIQUE INDEX "ItemCharacteristic_itemId_key_key" ON "ItemCharacteristic"("itemId", "key");

-- CreateIndex
CREATE INDEX "FoodBatch_itemId_expiryDate_idx" ON "FoodBatch"("itemId", "expiryDate");

-- CreateIndex
CREATE INDEX "FoodBatch_schoolId_expiryDate_idx" ON "FoodBatch"("schoolId", "expiryDate");

-- CreateIndex
CREATE UNIQUE INDEX "FoodBatch_itemId_batchNumber_expiryDate_key" ON "FoodBatch"("itemId", "batchNumber", "expiryDate");

-- CreateIndex
CREATE UNIQUE INDEX "Stock_itemId_key" ON "Stock"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_number_key" ON "StockMovement"("number");

-- CreateIndex
CREATE INDEX "StockMovement_schoolId_createdAt_idx" ON "StockMovement"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_type_createdAt_idx" ON "StockMovement"("type", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovementItem_itemId_createdAt_idx" ON "StockMovementItem"("itemId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovementItem_movementId_idx" ON "StockMovementItem"("movementId");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_schoolId_createdAt_idx" ON "AuditLog"("schoolId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewNotification_movementId_key" ON "ReviewNotification"("movementId");

-- CreateIndex
CREATE UNIQUE INDEX "CodeSequence_scope_key" ON "CodeSequence"("scope");

-- CreateIndex
CREATE UNIQUE INDEX "AppConfig_schoolId_key_key" ON "AppConfig"("schoolId", "key");

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSchool" ADD CONSTRAINT "UserSchool_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSchool" ADD CONSTRAINT "UserSchool_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorageLocation" ADD CONSTRAINT "StorageLocation_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_unitOfMeasureId_fkey" FOREIGN KEY ("unitOfMeasureId") REFERENCES "UnitOfMeasure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_storageLocationId_fkey" FOREIGN KEY ("storageLocationId") REFERENCES "StorageLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemCharacteristic" ADD CONSTRAINT "ItemCharacteristic_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodBatch" ADD CONSTRAINT "FoodBatch_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodBatch" ADD CONSTRAINT "FoodBatch_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodBatch" ADD CONSTRAINT "FoodBatch_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stock" ADD CONSTRAINT "Stock_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stock" ADD CONSTRAINT "Stock_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovementItem" ADD CONSTRAINT "StockMovementItem_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "StockMovement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovementItem" ADD CONSTRAINT "StockMovementItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovementItem" ADD CONSTRAINT "StockMovementItem_foodBatchId_fkey" FOREIGN KEY ("foodBatchId") REFERENCES "FoodBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_foodBatchId_fkey" FOREIGN KEY ("foodBatchId") REFERENCES "FoodBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewNotification" ADD CONSTRAINT "ReviewNotification_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewNotification" ADD CONSTRAINT "ReviewNotification_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "StockMovement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppConfig" ADD CONSTRAINT "AppConfig_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
