-- M4 (04-ai-pipeline §5, §11, §13): idempotent reply runs, run flags and metrics.
ALTER TABLE "AiRun" ADD COLUMN "batchKey" TEXT,
ADD COLUMN "flags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "meta" JSONB;

CREATE UNIQUE INDEX "AiRun_conversationId_batchKey_key" ON "AiRun"("conversationId", "batchKey");
