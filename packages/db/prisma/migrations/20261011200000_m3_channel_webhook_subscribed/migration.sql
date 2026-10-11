-- M3: Channel.webhookSubscribed (05-integrations §1.5: PAGE_WEBHOOK_SUBSCRIBE_FAILED ⇒ false, retried by sched-channel-webhook-retry)
ALTER TABLE "Channel" ADD COLUMN "webhookSubscribed" BOOLEAN NOT NULL DEFAULT true;

-- M3: inbox list, tab "Toutes" (keyset on lastMessageAt, id)
CREATE INDEX IF NOT EXISTS "Conversation_inbox_all_idx" ON "Conversation" ("workspaceId", "lastMessageAt" DESC, "id" DESC) WHERE "deletedAt" IS NULL;
