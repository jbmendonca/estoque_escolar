-- Ordenação alfabética em português brasileiro (FR-010 / Princípio I da constituição).
--
-- A imagem postgres:*-alpine usa musl libc, que ignora locales e ordena por bytes:
-- "Açúcar" acabava depois de "Aveia" e "Índice" depois de "Zebra".
-- A collation ICU pt-BR trata ç/á/é/í/ó/ú corretamente.

CREATE COLLATION IF NOT EXISTS pt_br (provider = icu, locale = 'pt-BR');

-- Colunas usadas em ordenação/busca visível ao usuário.
ALTER TABLE "Item" ALTER COLUMN "name" TYPE TEXT COLLATE pt_br;
ALTER TABLE "Category" ALTER COLUMN "name" TYPE TEXT COLLATE pt_br;
ALTER TABLE "UnitOfMeasure" ALTER COLUMN "name" TYPE TEXT COLLATE pt_br;
ALTER TABLE "Supplier" ALTER COLUMN "name" TYPE TEXT COLLATE pt_br;
ALTER TABLE "School" ALTER COLUMN "name" TYPE TEXT COLLATE pt_br;
ALTER TABLE "User" ALTER COLUMN "name" TYPE TEXT COLLATE pt_br;
