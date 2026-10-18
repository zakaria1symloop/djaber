-- 04 §12 "one open item per product" (2026-10-18): every change used to add a pending ModerationItem, so one product
-- appeared several times in the admin queue with outdated snapshots. Data-only and idempotent: the pending product items
-- that are not the product's current item (Product.moderationItemId) are dropped — never decided, so no appeal hangs on them.
DELETE FROM "ModerationItem" m
WHERE m."type" = 'product'
  AND m."status" = 'pending'
  AND NOT EXISTS (SELECT 1 FROM "Product" p WHERE p."moderationItemId" = m."id");
