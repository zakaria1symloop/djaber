-- M8 analytics & reports: indexes for the day buckets of `computeDays` (DailyStat rollup + live today).
-- DailyStat and ReportSchedule already exist (m0_init).

-- CreateIndex
CREATE INDEX "Conversation_workspaceId_createdAt_idx" ON "Conversation"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_workspaceId_sentAt_idx" ON "Message"("workspaceId", "sentAt");

-- CreateIndex
CREATE INDEX "Order_workspaceId_orderedAt_idx" ON "Order"("workspaceId", "orderedAt");

-- CreateIndex
CREATE INDEX "Order_workspaceId_confirmedAt_idx" ON "Order"("workspaceId", "confirmedAt");

-- CreateIndex
CREATE INDEX "Order_workspaceId_shippedAt_idx" ON "Order"("workspaceId", "shippedAt");

-- CreateIndex
CREATE INDEX "Order_workspaceId_deliveredAt_idx" ON "Order"("workspaceId", "deliveredAt");

-- CreateIndex
CREATE INDEX "Order_workspaceId_cancelledAt_idx" ON "Order"("workspaceId", "cancelledAt");

-- CreateIndex
CREATE INDEX "Order_conversationId_idx" ON "Order"("conversationId");

-- CreateIndex
CREATE INDEX "OrderStatusHistory_field_to_at_idx" ON "OrderStatusHistory"("field", "to", "at");

-- CreateIndex
CREATE INDEX "Shipment_workspaceId_createdAt_idx" ON "Shipment"("workspaceId", "createdAt");
