-- Novos valores de auditoria: falha de login e edição de escola.
-- (PostgreSQL 12+ permite ADD VALUE dentro da transação da migração desde que
--  o valor não seja usado na mesma transação — o que não ocorre aqui.)
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'LOGIN_FAILED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SCHOOL_UPDATE';

-- Índices para colunas de chave estrangeira usadas em filtro/junção. O
-- PostgreSQL não os cria automaticamente; sem eles as telas de painel e as
-- investigações de auditoria fazem varredura sequencial.
CREATE INDEX IF NOT EXISTS "Stock_schoolId_idx" ON "Stock"("schoolId");
CREATE INDEX IF NOT EXISTS "StockMovement_userId_idx" ON "StockMovement"("userId");
CREATE INDEX IF NOT EXISTS "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX IF NOT EXISTS "AuditLog_resource_resourceId_idx" ON "AuditLog"("resource", "resourceId");
CREATE INDEX IF NOT EXISTS "Item_categoryId_idx" ON "Item"("categoryId");
