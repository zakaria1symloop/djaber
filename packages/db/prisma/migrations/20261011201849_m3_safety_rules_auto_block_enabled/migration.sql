-- M3 (04 §13): the auto-block rule is OFF by default. `Workspace.safetyRules` gets an explicit `autoBlockEnabled`;
-- `autoBlockAfterUncollected` stays the threshold (>= 1, default 3).

-- AlterTable
ALTER TABLE "Workspace" ALTER COLUMN "safetyRules" SET DEFAULT '{"riskAfterReturns":2,"autoBlockEnabled":false,"autoBlockAfterUncollected":3,"handoffOnRisk":true}';

-- Existing rows: the key is added as false when absent (a value already present is kept)
UPDATE "Workspace"
SET "safetyRules" = jsonb_build_object('autoBlockEnabled', false) || "safetyRules"
WHERE NOT ("safetyRules" ? 'autoBlockEnabled');

-- A threshold below 1 (0 was used for "off" before the flag existed) goes back to the default threshold
UPDATE "Workspace"
SET "safetyRules" = jsonb_set("safetyRules", '{autoBlockAfterUncollected}', '3'::jsonb)
WHERE jsonb_typeof("safetyRules" -> 'autoBlockAfterUncollected') IS DISTINCT FROM 'number'
   OR ("safetyRules" ->> 'autoBlockAfterUncollected')::numeric < 1;
