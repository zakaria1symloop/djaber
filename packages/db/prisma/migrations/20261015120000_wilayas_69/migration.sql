-- Algeria has 69 wilayas: the 11 new wilayas 59–69 (Council of Ministers 2025-11-16, loi n° 26-06 du 4 avril 2026,
-- JO n° 25 du 5 avril 2026, amending loi n° 84-09). Codes, names and commune lists: see assumptions-log (fix/wilayas-69).
-- Data-only and idempotent: existing databases were seeded with 58 wilayas; a fresh database gets the same result from
-- the seed (`seeds/data/wilayas.json` + `communes.json`). Commune ids do not change, only their `wilayaId`.

-- 1. The 11 wilayas.
INSERT INTO "Wilaya" ("id", "code", "nameFr", "nameAr") VALUES
  (59, '59', 'Aflou', 'آفلو'),
  (60, '60', 'Barika', 'بريكة'),
  (61, '61', 'El Kantara', 'القنطرة'),
  (62, '62', 'Bir El Ater', 'بئر العاتر'),
  (63, '63', 'El Aricha', 'العريشة'),
  (64, '64', 'Ksar Chellala', 'قصر الشلالة'),
  (65, '65', 'Aïn Oussera', 'عين وسارة'),
  (66, '66', 'Messaad', 'مسعد'),
  (67, '67', 'Ksar El Boukhari', 'قصر البخاري'),
  (68, '68', 'Bou Saâda', 'بوسعادة'),
  (69, '69', 'El Abiodh Sidi Cheikh', 'الأبيض سيدي الشيخ')
ON CONFLICT ("id") DO NOTHING;

-- 2. The communes that moved (only while still under their parent wilaya).
UPDATE "Commune" SET "wilayaId" = 59 WHERE "wilayaId" = 3  AND "id" IN (64, 66, 67, 69, 71, 73, 74, 80, 81, 82, 83, 87);
UPDATE "Commune" SET "wilayaId" = 60 WHERE "wilayaId" = 5  AND "id" IN (121, 122, 125, 133, 149, 157, 166, 175);
UPDATE "Commune" SET "wilayaId" = 61 WHERE "wilayaId" = 7  AND "id" IN (231, 236, 239, 245, 246);
UPDATE "Commune" SET "wilayaId" = 62 WHERE "wilayaId" = 12 AND "id" IN (369, 378, 381, 385);
UPDATE "Commune" SET "wilayaId" = 63 WHERE "wilayaId" = 13 AND "id" IN (410, 414, 417, 436);
UPDATE "Commune" SET "wilayaId" = 64 WHERE "wilayaId" = 14 AND "id" IN (450, 458, 459, 471, 474, 486);
UPDATE "Commune" SET "wilayaId" = 65 WHERE "wilayaId" = 17 AND "id" IN (613, 615, 617, 619, 620, 628, 630, 632, 635, 643);
UPDATE "Commune" SET "wilayaId" = 66 WHERE "wilayaId" = 17 AND "id" IN (616, 623, 629, 631, 636, 639, 640, 641);
UPDATE "Commune" SET "wilayaId" = 67 WHERE "wilayaId" = 26 AND "id" IN (899, 900, 902, 908, 909, 912, 914, 915, 916, 917, 925, 927, 929, 934, 938, 942, 943, 944, 947, 951, 958);
UPDATE "Commune" SET "wilayaId" = 68 WHERE "wilayaId" = 28 AND "id" IN (996, 997, 999, 1001, 1003, 1005, 1006, 1010, 1011, 1012, 1015, 1019, 1020, 1021, 1022, 1030, 1031, 1032, 1034, 1036, 1037, 1039, 1041);
UPDATE "Commune" SET "wilayaId" = 69 WHERE "wilayaId" = 32 AND "id" IN (1136, 1137, 1140, 1143, 1145, 1146, 1148);

-- 3. Fee grid: every workspace gets a row for each new wilaya, copied from its row of the parent wilaya
--    (same prices, active flag and source; a workspace without the parent row is left to "Compléter les manquantes").
INSERT INTO "DeliveryFeeRule" ("workspaceId", "wilayaId", "homePrice", "stopdeskPrice", "returnPrice", "freeAbove", "isActive", "source", "updatedAt")
SELECT r."workspaceId", n."id", r."homePrice", r."stopdeskPrice", r."returnPrice", r."freeAbove", r."isActive", r."source", CURRENT_TIMESTAMP
FROM (VALUES (59, 3), (60, 5), (61, 7), (62, 12), (63, 13), (64, 14), (65, 17), (66, 17), (67, 26), (68, 28), (69, 32)) AS n("id", "parentId")
JOIN "DeliveryFeeRule" r ON r."wilayaId" = n."parentId"
ON CONFLICT ("workspaceId", "wilayaId") DO NOTHING;

-- 4. Addresses that point at a moved commune follow it (the API rejects a commune outside its wilaya).
UPDATE "ClientAddress" a SET "wilayaId" = c."wilayaId"
FROM "Commune" c
WHERE a."communeId" = c."id" AND c."wilayaId" BETWEEN 59 AND 69 AND a."wilayaId" <> c."wilayaId";

-- 5. Open orders not handed to a courier yet follow too; shipped and closed orders keep their historical wilaya.
UPDATE "Order" o SET "wilayaId" = c."wilayaId", "version" = o."version" + 1, "updatedAt" = CURRENT_TIMESTAMP
FROM "Commune" c
WHERE o."communeId" = c."id" AND c."wilayaId" BETWEEN 59 AND 69 AND o."wilayaId" <> c."wilayaId"
  AND o."status" IN ('new', 'confirmed', 'preparing') AND o."deliveryStatus" = 'not_sent';
