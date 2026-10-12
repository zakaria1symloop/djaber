-- AlterTable
ALTER TABLE "SaleItem" ADD COLUMN     "catalogPrice" INTEGER;

-- CreateIndex
CREATE INDEX "Purchase_workspaceId_supplierId_idx" ON "Purchase"("workspaceId", "supplierId");

-- CreateIndex
CREATE INDEX "RecommendationEvent_conversationId_kind_at_idx" ON "RecommendationEvent"("conversationId", "kind", "at");

-- CreateIndex
CREATE INDEX "Sale_workspaceId_clientId_idx" ON "Sale"("workspaceId", "clientId");

-- CreateIndex
CREATE INDEX "StockRecommendation_workspaceId_ruleKey_idx" ON "StockRecommendation"("workspaceId", "ruleKey");
