-- M9 billing: a downgrade to a cheaper paid plan / cycle is booked for the renewal (BIL-05, 02 §5 "downgrade at period end").
ALTER TABLE "Subscription" ADD COLUMN "nextPlanId" UUID;
ALTER TABLE "Subscription" ADD COLUMN "nextBillingCycle" "BillingCycle";

-- sched-payment-reconcile (05-integrations §4.2) scans pending checkouts / links by age
CREATE INDEX "BillingPayment_status_createdAt_idx" ON "BillingPayment"("status", "createdAt");
CREATE INDEX "OrderPayment_status_expiresAt_idx" ON "OrderPayment"("status", "expiresAt");
CREATE INDEX "CreditPackPurchase_status_createdAt_idx" ON "CreditPackPurchase"("status", "createdAt");
-- store refund notifications locate a Google Play purchase by its order id
CREATE INDEX "CreditPackPurchase_storeOrderId_idx" ON "CreditPackPurchase"("storeOrderId");
-- dunning / expiry jobs
CREATE INDEX "Invoice_subscriptionId_status_idx" ON "Invoice"("subscriptionId", "status");
