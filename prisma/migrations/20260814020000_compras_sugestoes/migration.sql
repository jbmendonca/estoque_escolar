-- Módulo "Compras e Sugestões" + agrupamento canônico de categorias.
-- Ver specs/001-controle-estoque-escolar/data-model.md

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'PURCHASE_REQUEST';
ALTER TYPE "AuditAction" ADD VALUE 'PURCHASE_REVIEW';
ALTER TYPE "AuditAction" ADD VALUE 'PURCHASE_LIST';

-- CreateEnum
CREATE TYPE "CategoryGroup" AS ENUM ('ESTIVAS', 'PROTEINAS', 'HORTALICAS', 'FRUTAS', 'BEBIDAS', 'MATERIAL_ESCRITORIO', 'MATERIAL_ESCOLAR', 'LIMPEZA', 'INFORMATICA', 'ARTES', 'MATERIAL_PEDAGOGICO', 'OUTROS');

-- CreateEnum
CREATE TYPE "PurchasePriority" AS ENUM ('BAIXA', 'MEDIA', 'ALTA');

-- CreateEnum
CREATE TYPE "PurchaseRequestStatus" AS ENUM ('PENDENTE', 'APROVADA', 'REJEITADA', 'COMPRADA', 'RECEBIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "PurchaseListStatus" AS ENUM ('ABERTA', 'ENVIADA', 'CONCLUIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "PurchaseItemSource" AS ENUM ('SUGESTAO', 'SOLICITACAO', 'MANUAL');

-- AlterTable
ALTER TABLE "Category" ADD COLUMN "group" "CategoryGroup";

-- CreateTable
CREATE TABLE "PurchaseRequest" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "module" "ModuleType" NOT NULL,
    "itemId" TEXT,
    "itemDescription" TEXT,
    "categoryGroup" "CategoryGroup",
    "quantity" DECIMAL(65,30) NOT NULL,
    "justification" TEXT NOT NULL,
    "priority" "PurchasePriority" NOT NULL DEFAULT 'MEDIA',
    "status" "PurchaseRequestStatus" NOT NULL DEFAULT 'PENDENTE',
    "requestedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "purchasedById" TEXT,
    "purchasedAt" TIMESTAMP(3),
    "receivedById" TEXT,
    "receivedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "purchaseListId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRequestEvent" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "fromStatus" "PurchaseRequestStatus",
    "toStatus" "PurchaseRequestStatus" NOT NULL,
    "userId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseRequestEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseList" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "module" "ModuleType" NOT NULL,
    "title" TEXT,
    "notes" TEXT,
    "status" "PurchaseListStatus" NOT NULL DEFAULT 'ABERTA',
    "periodDays" INTEGER NOT NULL DEFAULT 30,
    "createdById" TEXT NOT NULL,
    "closedById" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseListItem" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "requestId" TEXT,
    "quantity" DECIMAL(65,30) NOT NULL,
    "currentQuantity" DECIMAL(65,30) NOT NULL,
    "minStock" DECIMAL(65,30) NOT NULL,
    "dailyAvg" DECIMAL(65,30) NOT NULL,
    "coverageDays" INTEGER,
    "priority" "PurchasePriority" NOT NULL,
    "source" "PurchaseItemSource" NOT NULL DEFAULT 'SUGESTAO',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseListItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseRequest_number_key" ON "PurchaseRequest"("number");

-- CreateIndex
CREATE INDEX "PurchaseRequest_schoolId_status_createdAt_idx" ON "PurchaseRequest"("schoolId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "PurchaseRequest_itemId_status_idx" ON "PurchaseRequest"("itemId", "status");

-- CreateIndex
CREATE INDEX "PurchaseRequestEvent_requestId_createdAt_idx" ON "PurchaseRequestEvent"("requestId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseList_number_key" ON "PurchaseList"("number");

-- CreateIndex
CREATE INDEX "PurchaseList_schoolId_status_createdAt_idx" ON "PurchaseList"("schoolId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "PurchaseListItem_listId_idx" ON "PurchaseListItem"("listId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseListItem_listId_itemId_key" ON "PurchaseListItem"("listId", "itemId");

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_purchaseListId_fkey" FOREIGN KEY ("purchaseListId") REFERENCES "PurchaseList"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequestEvent" ADD CONSTRAINT "PurchaseRequestEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "PurchaseRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseList" ADD CONSTRAINT "PurchaseList_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseListItem" ADD CONSTRAINT "PurchaseListItem_listId_fkey" FOREIGN KEY ("listId") REFERENCES "PurchaseList"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseListItem" ADD CONSTRAINT "PurchaseListItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseListItem" ADD CONSTRAINT "PurchaseListItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "PurchaseRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Ordenação em português nas colunas textuais visíveis ao usuário.
ALTER TABLE "PurchaseList" ALTER COLUMN "title" TYPE TEXT COLLATE pt_br;

-- Backfill: classifica as categorias já cadastradas nos grupos canônicos.
-- Categorias fora deste mapa ficam sem grupo e podem ser classificadas depois.
UPDATE "Category" SET "group" = 'ESTIVAS'             WHERE "group" IS NULL AND "module" = 'FOOD' AND ("name" ILIKE '%cereai%' OR "name" ILIKE '%grão%' OR "name" ILIKE '%grao%' OR "name" ILIKE '%estiva%' OR "name" ILIKE '%mercearia%');
UPDATE "Category" SET "group" = 'PROTEINAS'           WHERE "group" IS NULL AND "module" = 'FOOD' AND ("name" ILIKE '%prote%' OR "name" ILIKE '%carne%' OR "name" ILIKE '%ovo%' OR "name" ILIKE '%latic%');
UPDATE "Category" SET "group" = 'HORTALICAS'          WHERE "group" IS NULL AND "module" = 'FOOD' AND ("name" ILIKE '%hortali%' OR "name" ILIKE '%hortifr%' OR "name" ILIKE '%legume%' OR "name" ILIKE '%verdura%');
UPDATE "Category" SET "group" = 'FRUTAS'              WHERE "group" IS NULL AND "module" = 'FOOD' AND "name" ILIKE '%fruta%';
UPDATE "Category" SET "group" = 'BEBIDAS'             WHERE "group" IS NULL AND "module" = 'FOOD' AND ("name" ILIKE '%bebida%' OR "name" ILIKE '%suco%');
UPDATE "Category" SET "group" = 'OUTROS'              WHERE "group" IS NULL AND "module" = 'FOOD';

UPDATE "Category" SET "group" = 'LIMPEZA'             WHERE "group" IS NULL AND "module" = 'SCHOOL_MATERIAL' AND ("name" ILIKE '%limpeza%' OR "name" ILIKE '%higien%');
UPDATE "Category" SET "group" = 'INFORMATICA'         WHERE "group" IS NULL AND "module" = 'SCHOOL_MATERIAL' AND ("name" ILIKE '%inform%' OR "name" ILIKE '%tecnolog%');
UPDATE "Category" SET "group" = 'ARTES'               WHERE "group" IS NULL AND "module" = 'SCHOOL_MATERIAL' AND "name" ILIKE '%arte%';
UPDATE "Category" SET "group" = 'MATERIAL_PEDAGOGICO' WHERE "group" IS NULL AND "module" = 'SCHOOL_MATERIAL' AND ("name" ILIKE '%pedag%' OR "name" ILIKE '%didát%' OR "name" ILIKE '%didat%');
UPDATE "Category" SET "group" = 'MATERIAL_ESCRITORIO' WHERE "group" IS NULL AND "module" = 'SCHOOL_MATERIAL' AND ("name" ILIKE '%escrit%' OR "name" ILIKE '%papelaria%');
UPDATE "Category" SET "group" = 'MATERIAL_ESCOLAR'    WHERE "group" IS NULL AND "module" = 'SCHOOL_MATERIAL';
