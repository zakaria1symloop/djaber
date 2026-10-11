
-- ---------------------------------------------------------------------------
-- PARTIAL UNIQUE indexes (cannot be expressed in Prisma; see schema comments)
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX "Membership_one_owner_per_workspace" ON "Membership" ("workspaceId") WHERE "role" = 'owner';
CREATE UNIQUE INDEX "Subscription_one_current_per_workspace" ON "Subscription" ("workspaceId") WHERE "status" IN ('trial','active','dunning');
CREATE UNIQUE INDEX "Category_live_name" ON "Category" ("workspaceId", "name") WHERE "deletedAt" IS NULL;
CREATE UNIQUE INDEX "Product_live_sku" ON "Product" ("workspaceId", "sku") WHERE "deletedAt" IS NULL;
CREATE UNIQUE INDEX "ProductVariant_live_sku" ON "ProductVariant" ("workspaceId", "sku") WHERE "deletedAt" IS NULL AND "sku" IS NOT NULL;
CREATE UNIQUE INDEX "Client_live_phone" ON "Client" ("workspaceId", "phone") WHERE "deletedAt" IS NULL AND "phone" IS NOT NULL;
CREATE UNIQUE INDEX "Shipment_one_active_per_order" ON "Shipment" ("orderId") WHERE "status" NOT IN ('cancelled','failed','returned','stale');
CREATE UNIQUE INDEX "SavedView_one_default" ON "SavedView" ("userId", "page") WHERE "isDefault";
CREATE UNIQUE INDEX "CustomerBlock_one_active" ON "CustomerBlock" ("workspaceId", "clientId") WHERE "unblockedAt" IS NULL AND "clientId" IS NOT NULL;
CREATE UNIQUE INDEX "AccountDeletionRequest_one_open" ON "AccountDeletionRequest" ("userId") WHERE "status" IN ('pending_confirmation','grace','blocked');

-- Trigram search indexes (pg_trgm) for list search
CREATE INDEX "Product_name_trgm" ON "Product" USING gin ("name" gin_trgm_ops);
CREATE INDEX "Client_name_trgm" ON "Client" USING gin ("name" gin_trgm_ops);
