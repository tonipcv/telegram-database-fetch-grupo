-- Torna updatedAt não nulo
ALTER TABLE "Message" ALTER COLUMN "updatedAt" SET NOT NULL;

-- Adiciona o default
ALTER TABLE "Message" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP; 