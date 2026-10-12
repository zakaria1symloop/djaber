-- M6 — Delivery & couriers.
-- Shipment.lastEventAt: last courier / manual event (creation until the first one) — drives "Sans mouvement" (> 5 d)
-- and the `stale` rule (30 d) without scanning ShipmentEvent (04 §22, DLV-04).
ALTER TABLE "Shipment" ADD COLUMN "lastEventAt" TIMESTAMP(3);
CREATE INDEX "Shipment_workspaceId_lastEventAt_idx" ON "Shipment"("workspaceId", "lastEventAt");

UPDATE "Shipment" s
SET "lastEventAt" = COALESCE((SELECT max(e."at") FROM "ShipmentEvent" e WHERE e."shipmentId" = s."id"), s."createdAt");

-- CourierAccount.lastTestError: error code of the last failed connection test (DLV-03 test states).
ALTER TABLE "CourierAccount" ADD COLUMN "lastTestError" TEXT;
