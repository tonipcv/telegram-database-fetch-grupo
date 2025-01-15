-- Adiciona messageId se não existir
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "messageId" TEXT;

-- Adiciona updatedAt se não existir
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3);

-- Preenche updatedAt com createdAt para registros existentes
UPDATE "Message" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;

-- Torna updatedAt não nulo
ALTER TABLE "Message" ALTER COLUMN "updatedAt" SET NOT NULL;

-- Adiciona o default
ALTER TABLE "Message" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP; 