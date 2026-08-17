-- Imagem de perfil do usuário (data URI redimensionado no cliente).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;
