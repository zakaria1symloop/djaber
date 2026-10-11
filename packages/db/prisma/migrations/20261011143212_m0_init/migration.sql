-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- uuid_generate_v7(): time-ordered UUIDs (schema assumption 1). Pure SQL, needs pgcrypto only.
CREATE OR REPLACE FUNCTION uuid_generate_v7() RETURNS uuid AS $$
DECLARE
  unix_ts_ms bytea;
  uuid_bytes bytea;
BEGIN
  unix_ts_ms = substring(int8send(floor(extract(epoch from clock_timestamp()) * 1000)::bigint) from 3);
  uuid_bytes = unix_ts_ms || gen_random_bytes(10);
  uuid_bytes = set_byte(uuid_bytes, 6, (b'0111' || get_byte(uuid_bytes, 6)::bit(4))::bit(8)::int);
  uuid_bytes = set_byte(uuid_bytes, 8, (b'10' || get_byte(uuid_bytes, 8)::bit(6))::bit(8)::int);
  RETURN encode(uuid_bytes, 'hex')::uuid;
END
$$ LANGUAGE plpgsql VOLATILE;

-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('fr', 'ar', 'en');

-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('none', 'read', 'support', 'moderator', 'finance', 'super_admin');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'blocked', 'deletion_scheduled');

-- CreateEnum
CREATE TYPE "DevicePlatform" AS ENUM ('android', 'ios', 'web');

-- CreateEnum
CREATE TYPE "EmailTokenKind" AS ENUM ('verify', 'reset', 'change_email');

-- CreateEnum
CREATE TYPE "WorkspaceStatus" AS ENUM ('active', 'suspended', 'deletion_scheduled');

-- CreateEnum
CREATE TYPE "SuspendReason" AS ENUM ('fraud', 'unpaid', 'content', 'owner_request', 'other');

-- CreateEnum
CREATE TYPE "TrustLevel" AS ENUM ('new', 'standard', 'trusted', 'watch');

-- CreateEnum
CREATE TYPE "StockMode" AS ENUM ('simple', 'advanced');

-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('owner', 'admin', 'operator');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('trial', 'active', 'dunning', 'expired', 'cancelled');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('monthly', 'yearly', 'none');

-- CreateEnum
CREATE TYPE "BillingProvider" AS ENUM ('none', 'chargily', 'manual');

-- CreateEnum
CREATE TYPE "DunningStage" AS ENUM ('d_minus_7', 'd0', 'd_plus_3', 'expired');

-- CreateEnum
CREATE TYPE "InvoiceKind" AS ENUM ('subscription', 'credit_pack', 'manual');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('upcoming', 'unpaid', 'paid', 'void', 'refunded');

-- CreateEnum
CREATE TYPE "PaymentMethodBilling" AS ENUM ('cib', 'edahabia', 'manual_transfer', 'manual_ccp', 'manual_cash', 'google_play', 'app_store');

-- CreateEnum
CREATE TYPE "BillingPaymentStatus" AS ENUM ('pending', 'paid', 'failed', 'expired', 'refunded');

-- CreateEnum
CREATE TYPE "BillingPaymentProvider" AS ENUM ('chargily', 'manual', 'google_play', 'app_store');

-- CreateEnum
CREATE TYPE "CreditBucket" AS ENUM ('plan', 'pack');

-- CreateEnum
CREATE TYPE "CreditAction" AS ENUM ('text_reply', 'image_recognition', 'voice_transcription', 'reserve', 'release', 'renewal', 'pack_purchase', 'grant', 'store_refund', 'adjustment');

-- CreateEnum
CREATE TYPE "CreditKind" AS ENUM ('reserved', 'debit', 'release', 'credit');

-- CreateEnum
CREATE TYPE "PurchaseChannel" AS ENUM ('web', 'google_play', 'app_store');

-- CreateEnum
CREATE TYPE "PackPurchaseStatus" AS ENUM ('pending', 'validated', 'credited', 'refunded', 'failed', 'invalid');

-- CreateEnum
CREATE TYPE "PromoKind" AS ENUM ('percent_discount', 'fixed_discount', 'credits', 'trial_extension');

-- CreateEnum
CREATE TYPE "PromoTarget" AS ENUM ('new_workspaces', 'existing', 'all', 'workspace');

-- CreateEnum
CREATE TYPE "ChannelPlatform" AS ENUM ('facebook', 'instagram');

-- CreateEnum
CREATE TYPE "ChannelStatus" AS ENUM ('active', 'paused', 'pending_review', 'needs_reconnect', 'disabled', 'disconnected');

-- CreateEnum
CREATE TYPE "PausedReason" AS ENUM ('manual', 'plan', 'moderation');

-- CreateEnum
CREATE TYPE "ChannelEventKind" AS ENUM ('connected', 'reconnected', 'disconnected', 'disabled', 'enabled', 'token_checked', 'webhook_resubscribed', 'info_synced', 'history_synced', 'approved', 'agent_attached', 'agent_detached', 'released_by_admin');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('user', 'ai', 'system', 'courier', 'api', 'admin', 'api_key');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('active', 'needs_human', 'resolved', 'archived');

-- CreateEnum
CREATE TYPE "AiIntent" AS ENUM ('sale', 'info', 'tracking', 'complaint', 'greeting', 'other');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('in', 'out');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('text', 'image', 'audio', 'video', 'file', 'location', 'sticker', 'postback', 'product_cards', 'system');

-- CreateEnum
CREATE TYPE "MessageAuthor" AS ENUM ('customer', 'ai', 'human', 'system');

-- CreateEnum
CREATE TYPE "TranscriptStatus" AS ENUM ('pending', 'done', 'failed', 'too_long');

-- CreateEnum
CREATE TYPE "CustomerReaction" AS ENUM ('like', 'dislike');

-- CreateEnum
CREATE TYPE "MessageDeliveryStatus" AS ENUM ('pending', 'sent', 'failed', 'skipped_window');

-- CreateEnum
CREATE TYPE "InboundProvider" AS ENUM ('meta', 'chargily', 'courier', 'google', 'google_play', 'app_store');

-- CreateEnum
CREATE TYPE "AiProviderKey" AS ENUM ('openai', 'anthropic', 'google', 'groq');

-- CreateEnum
CREATE TYPE "AiCapability" AS ENUM ('text', 'vision', 'transcription', 'embeddings');

-- CreateEnum
CREATE TYPE "Personality" AS ENUM ('professional', 'friendly', 'casual', 'technical');

-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('draft', 'active', 'paused');

-- CreateEnum
CREATE TYPE "AgentVersionSource" AS ENUM ('manual', 'wizard', 'insight', 'preset_update', 'restore', 'generation');

-- CreateEnum
CREATE TYPE "PresetStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "PresetBadge" AS ENUM ('recommended', 'popular', 'beta');

-- CreateEnum
CREATE TYPE "InsightType" AS ENUM ('unclear', 'unknown_topic', 'handoff', 'error');

-- CreateEnum
CREATE TYPE "InsightStatus" AS ENUM ('pending', 'resolved', 'dismissed');

-- CreateEnum
CREATE TYPE "InsightResolution" AS ENUM ('instruction', 'faq', 'product', 'ignored_30d');

-- CreateEnum
CREATE TYPE "AiRunKind" AS ENUM ('reply', 'test', 'vision', 'transcription', 'page_analysis', 'agent_generation', 'caption', 'faq_extraction', 'test_scenario');

-- CreateEnum
CREATE TYPE "AiRunStatus" AS ENUM ('running', 'ok', 'unclear', 'unknown', 'handoff', 'error');

-- CreateEnum
CREATE TYPE "TestScenarioKey" AS ENUM ('darija_price', 'arabizi_delivery', 'photo', 'voice', 'off_catalog', 'anger', 'qty_limit', 'refund');

-- CreateEnum
CREATE TYPE "TestRunStatus" AS ENUM ('pass', 'fail', 'error');

-- CreateEnum
CREATE TYPE "FaqSource" AS ENUM ('manual', 'page_extraction', 'ai_suggested', 'file_import');

-- CreateEnum
CREATE TYPE "AgentTone" AS ENUM ('warm', 'professional', 'casual', 'premium');

-- CreateEnum
CREATE TYPE "Formality" AS ENUM ('follow_customer', 'tu', 'vous');

-- CreateEnum
CREATE TYPE "EmojiLevel" AS ENUM ('none', 'moderate', 'many');

-- CreateEnum
CREATE TYPE "CatalogScope" AS ENUM ('all', 'categories');

-- CreateEnum
CREATE TYPE "OutOfStockBehavior" AS ENUM ('say_unavailable', 'suggest_alternative');

-- CreateEnum
CREATE TYPE "RiskyClientBehavior" AS ENUM ('take_and_flag', 'handoff');

-- CreateEnum
CREATE TYPE "RecapMode" AS ENUM ('always', 'when_unsure');

-- CreateEnum
CREATE TYPE "ModerationStatusProduct" AS ENUM ('not_required', 'pending', 'approved', 'rejected', 'appealed');

-- CreateEnum
CREATE TYPE "ImageModerationFlag" AS ENUM ('logo', 'inappropriate');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('marketing', 'shipping', 'packaging', 'customs', 'storage', 'other');

-- CreateEnum
CREATE TYPE "RecommendationType" AS ENUM ('cross_sell', 'up_sell');

-- CreateEnum
CREATE TYPE "RecommendationSource" AS ENUM ('manual', 'rules');

-- CreateEnum
CREATE TYPE "RecommendationEventKind" AS ENUM ('impression', 'conversion');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('in', 'out', 'adjustment_in', 'adjustment_out', 'inventory', 'return');

-- CreateEnum
CREATE TYPE "MovementReason" AS ENUM ('order_delivered', 'order_created', 'order_cancelled', 'order_returned', 'sale', 'sale_cancelled', 'purchase', 'purchase_cancelled', 'breakage', 'loss', 'initial', 'inventory', 'correction', 'archive', 'import', 'other');

-- CreateEnum
CREATE TYPE "MovementRefType" AS ENUM ('order', 'sale', 'purchase', 'inventory', 'import', 'manual', 'variant');

-- CreateEnum
CREATE TYPE "InventoryScope" AS ENUM ('all', 'category', 'alerts_only');

-- CreateEnum
CREATE TYPE "InventoryStatus" AS ENUM ('draft', 'counting', 'validated', 'cancelled');

-- CreateEnum
CREATE TYPE "StockRecoType" AS ENUM ('restock', 'stockout_imminent', 'promote', 'price', 'supplier', 'agent');

-- CreateEnum
CREATE TYPE "Priority3" AS ENUM ('high', 'medium', 'low');

-- CreateEnum
CREATE TYPE "StockRecoStatus" AS ENUM ('active', 'applied', 'dismissed', 'snoozed', 'expired');

-- CreateEnum
CREATE TYPE "ClientSource" AS ENUM ('manual', 'ai', 'import', 'api');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('normal', 'high');

-- CreateEnum
CREATE TYPE "OrderSource" AS ENUM ('ai', 'manual', 'mobile', 'api', 'import');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('new', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled', 'returned');

-- CreateEnum
CREATE TYPE "ConfirmationStatus" AS ENUM ('pending', 'no_answer', 'confirmed', 'rejected', 'wrong_number', 'callback');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('unpaid', 'partial', 'paid', 'pending_link', 'refunded');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('cash', 'card', 'transfer', 'ccp', 'other');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('not_sent', 'pending', 'sent', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned');

-- CreateEnum
CREATE TYPE "CancelReason" AS ENUM ('unreachable', 'changed_mind', 'fake', 'unavailable', 'duplicate', 'other');

-- CreateEnum
CREATE TYPE "CallResult" AS ENUM ('picked_up', 'no_answer', 'busy', 'voicemail', 'rejected', 'wrong_number', 'callback');

-- CreateEnum
CREATE TYPE "PaymentSourceType" AS ENUM ('order', 'sale', 'purchase');

-- CreateEnum
CREATE TYPE "OnlinePaymentStatus" AS ENUM ('pending', 'paid', 'failed', 'expired', 'refunded', 'mismatch');

-- CreateEnum
CREATE TYPE "CourierProvider" AS ENUM ('zrexpress', 'ecotrack', 'yalidine');

-- CreateEnum
CREATE TYPE "ShipmentProvider" AS ENUM ('manual', 'zrexpress', 'ecotrack', 'yalidine');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('pending', 'sent', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned', 'cancelled', 'stale');

-- CreateEnum
CREATE TYPE "FailureReason" AS ENUM ('address', 'unreachable', 'refused', 'damaged', 'other');

-- CreateEnum
CREATE TYPE "ShipmentEventSource" AS ENUM ('webhook', 'poll', 'manual', 'system');

-- CreateEnum
CREATE TYPE "FeeSource" AS ENUM ('default', 'custom');

-- CreateEnum
CREATE TYPE "SheetsStatus" AS ENUM ('active', 'error', 'disconnected');

-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('draft', 'pending', 'partial', 'received', 'cancelled');

-- CreateEnum
CREATE TYPE "GdsPaymentStatus" AS ENUM ('unpaid', 'partial', 'paid');

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('draft', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "CashType" AS ENUM ('income', 'expense');

-- CreateEnum
CREATE TYPE "CashCategory" AS ENUM ('sale', 'order', 'purchase', 'rent', 'salary', 'utilities', 'marketing', 'shipping', 'deposit', 'withdrawal', 'correction', 'refund', 'other');

-- CreateEnum
CREATE TYPE "CashMethod" AS ENUM ('cash', 'ccp', 'card', 'transfer', 'other');

-- CreateEnum
CREATE TYPE "CashSourceType" AS ENUM ('order', 'sale', 'purchase', 'payment_entry', 'closing');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('order_ai_created', 'conversation_handoff', 'conversation_needs_human_message', 'conversation_handoff_unattended', 'agent_insight', 'ai_error', 'stock_low', 'stock_out', 'shipment_created', 'shipment_out_for_delivery', 'shipment_delivered', 'shipment_failed', 'shipment_returned', 'payment_received', 'payment_failed', 'channel_needs_reconnect', 'channel_paused_by_plan', 'credits_80', 'credits_exhausted', 'quota_80', 'quota_100', 'subscription_expiring', 'subscription_expired', 'member_invited', 'member_joined', 'account_verify_reminder', 'workspace_deleted', 'sheets_error', 'webhook_disabled', 'job_finished', 'order_callback_due', 'order_status_changed', 'order_assigned', 'conversation_assigned', 'channel_approved', 'product_approved', 'product_rejected', 'product_changes_requested', 'moderation_appeal_result', 'report_resolved', 'customer_auto_blocked', 'support_reply', 'credits_pack_purchased', 'credits_negative', 'invoice_unpaid', 'workspace_suspended', 'workspace_reactivated', 'workspace_deletion_scheduled', 'account_deletion_confirmed', 'member_role_changed', 'agent_preset_update_available', 'app_update_required', 'app_update_recommended', 'legal_reacceptance_required', 'platform_announcement', 'job_failed');

-- CreateEnum
CREATE TYPE "UploadKind" AS ENUM ('avatar', 'logo', 'reply', 'label', 'export', 'report', 'ticket_attachment', 'appeal_attachment', 'payment_proof', 'cash_proof', 'category_image', 'faq_file', 'inventory_sheet');

-- CreateEnum
CREATE TYPE "ApiKeyEnvironment" AS ENUM ('live', 'test');

-- CreateEnum
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('pending', 'success', 'failed', 'exhausted');

-- CreateEnum
CREATE TYPE "JobKind" AS ENUM ('import', 'analysis', 'generation', 'bulk_send', 'bulk_status', 'bulk_products', 'backfill', 'export', 'report_export', 'recommendations', 'labels', 'sync_history', 'tracking_refresh', 'inventory', 'agent_test_scenarios', 'audit_export', 'data_export', 'faq_extraction', 'translate');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('queued', 'running', 'done', 'partial', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "SavedViewPage" AS ENUM ('orders', 'products', 'clients', 'inbox', 'delivery', 'movements', 'agents', 'channels', 'notifications', 'purchases', 'sales', 'cash');

-- CreateEnum
CREATE TYPE "ListDensity" AS ENUM ('compact', 'comfortable');

-- CreateEnum
CREATE TYPE "ModerationItemType" AS ENUM ('product', 'product_image', 'agent_prompt', 'category');

-- CreateEnum
CREATE TYPE "ModerationItemStatus" AS ENUM ('pending', 'auto_approved', 'approved', 'rejected', 'changes_requested', 'appealed', 'appeal_rejected');

-- CreateEnum
CREATE TYPE "ModerationPriority" AS ENUM ('normal', 'urgent');

-- CreateEnum
CREATE TYPE "ModerationDecision" AS ENUM ('counterfeit', 'prohibited', 'inappropriate_image', 'misleading', 'missing_info', 'other');

-- CreateEnum
CREATE TYPE "ModerationSource" AS ENUM ('create', 'update', 'import', 'page_extraction', 'duplicate', 'restore');

-- CreateEnum
CREATE TYPE "AppealDecision" AS ENUM ('upheld', 'overturned');

-- CreateEnum
CREATE TYPE "ModerationRuleKind" AS ENUM ('blocked_word', 'protected_brand', 'prohibited_category', 'sensitive_category', 'price_reference');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('conversation', 'customer', 'merchant', 'ai_message', 'product');

-- CreateEnum
CREATE TYPE "ReporterKind" AS ENUM ('merchant_user', 'end_customer', 'system');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('harassment', 'fraud', 'spam', 'inappropriate_content', 'ai_incorrect', 'other');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('open', 'reviewing', 'actioned', 'dismissed');

-- CreateEnum
CREATE TYPE "ReportDecision" AS ENUM ('block_confirmed', 'platform_blacklist', 'reported_to_meta', 'dismissed', 'more_info');

-- CreateEnum
CREATE TYPE "BlockReason" AS ENUM ('harassment', 'fraud', 'spam', 'inappropriate', 'uncollected', 'other');

-- CreateEnum
CREATE TYPE "BlockSource" AS ENUM ('manual', 'auto_rule', 'platform');

-- CreateEnum
CREATE TYPE "TicketCategory" AS ENUM ('meta_connection', 'credits', 'billing', 'delivery', 'integrations', 'agent', 'stock', 'mobile', 'security', 'other');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('low', 'normal', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "TicketChannel" AS ENUM ('web', 'mobile', 'email', 'chat');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('open', 'pending_customer', 'resolved', 'closed');

-- CreateEnum
CREATE TYPE "TicketAuthorKind" AS ENUM ('user', 'support', 'system');

-- CreateEnum
CREATE TYPE "DeletionSource" AS ENUM ('app', 'public_page', 'admin');

-- CreateEnum
CREATE TYPE "DeletionStatus" AS ENUM ('pending_confirmation', 'grace', 'blocked', 'anonymised', 'cancelled');

-- CreateEnum
CREATE TYPE "DataDeletionStatus" AS ENUM ('pending', 'done', 'not_found');

-- CreateEnum
CREATE TYPE "AppPlatform" AS ENUM ('android', 'ios');

-- CreateEnum
CREATE TYPE "StoreStatus" AS ENUM ('published', 'in_review', 'rejected', 'rollout');

-- CreateEnum
CREATE TYPE "LegalDocKey" AS ENUM ('terms', 'privacy', 'account_deletion', 'content_rules');

-- CreateEnum
CREATE TYPE "MetaPermissionStatus" AS ENUM ('not_requested', 'in_review', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "ProviderStatus" AS ENUM ('ok', 'warning', 'error', 'disabled');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('open', 'identified', 'monitoring', 'resolved');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('minor', 'major', 'critical');

-- CreateEnum
CREATE TYPE "CmsType" AS ENUM ('announcement', 'legal', 'help', 'email', 'plan_text', 'system_message_default', 'page');

-- CreateEnum
CREATE TYPE "CmsStatus" AS ENUM ('draft', 'scheduled', 'published', 'archived');

-- CreateEnum
CREATE TYPE "CmsLocaleStatus" AS ENUM ('missing', 'draft', 'published');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "locale" "Locale" NOT NULL DEFAULT 'fr',
    "avatarUrl" TEXT,
    "emailVerifiedAt" TIMESTAMP(3),
    "totpSecret" BYTEA,
    "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "recoveryCodes" JSONB,
    "platformRole" "PlatformRole" NOT NULL DEFAULT 'none',
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "blockedAt" TIMESTAMP(3),
    "blockReason" TEXT,
    "ownedWorkspaceId" UUID,
    "prefs" JSONB NOT NULL DEFAULT '{}',
    "lastLoginAt" TIMESTAMP(3),
    "lastSeenPlatform" "DevicePlatform",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "userId" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "userAgent" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailToken" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "userId" UUID NOT NULL,
    "kind" "EmailTokenKind" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "payload" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "senderWilayaId" INTEGER,
    "locale" "Locale" NOT NULL DEFAULT 'fr',
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Algiers',
    "stockMode" "StockMode" NOT NULL DEFAULT 'simple',
    "onboardingStep" INTEGER NOT NULL DEFAULT 0,
    "freeDeliveryThreshold" INTEGER,
    "autoPauseOnManualReply" BOOLEAN NOT NULL DEFAULT true,
    "handoffReminderMin" INTEGER NOT NULL DEFAULT 30,
    "onlinePaymentEnabled" BOOLEAN NOT NULL DEFAULT false,
    "autoSendToCourier" BOOLEAN NOT NULL DEFAULT false,
    "defaultCourierAccountId" UUID,
    "targetMarginPct" INTEGER NOT NULL DEFAULT 35,
    "systemMessages" JSONB NOT NULL DEFAULT '{}',
    "status" "WorkspaceStatus" NOT NULL DEFAULT 'active',
    "suspendedAt" TIMESTAMP(3),
    "suspendReason" "SuspendReason",
    "suspendNote" TEXT,
    "deletionScheduledAt" TIMESTAMP(3),
    "trustLevel" "TrustLevel" NOT NULL DEFAULT 'new',
    "trustSetById" UUID,
    "safetyRules" JSONB NOT NULL DEFAULT '{"riskAfterReturns":2,"autoBlockAfterUncollected":3,"handoffOnRisk":true}',
    "blockedWords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "billingInfo" JSONB,
    "assistedOnboarding" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspaceId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "MemberRole" NOT NULL,
    "readOnly" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspaceId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "invitedById" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "lastSentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceToken" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "userId" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "platform" "DevicePlatform" NOT NULL,
    "appVersion" TEXT,
    "deviceName" TEXT,
    "locale" "Locale",
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspaceId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "actorKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "responseCode" INTEGER NOT NULL,
    "responseBody" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformInvitation" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "email" TEXT NOT NULL,
    "platformRole" "PlatformRole" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "invitedById" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalAcceptance" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "userId" UUID NOT NULL,
    "legalDocumentId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "client" "DevicePlatform" NOT NULL,

    CONSTRAINT "LegalAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "slug" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "description" JSONB NOT NULL,
    "priceMonthly" INTEGER NOT NULL,
    "priceYearly" INTEGER NOT NULL,
    "trialDays" INTEGER NOT NULL DEFAULT 14,
    "maxPages" INTEGER NOT NULL,
    "maxAgents" INTEGER NOT NULL,
    "maxProducts" INTEGER NOT NULL,
    "maxConversationsPerMonth" INTEGER NOT NULL,
    "maxMembers" INTEGER NOT NULL,
    "maxApiKeys" INTEGER NOT NULL DEFAULT 0,
    "maxWebhooks" INTEGER NOT NULL DEFAULT 0,
    "syncHistoryDays" INTEGER NOT NULL DEFAULT 30,
    "monthlyCredits" INTEGER NOT NULL,
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "providerPriceIds" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanVersion" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "planId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changedById" UUID NOT NULL,
    "impactCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspaceId" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "planVersion" INTEGER NOT NULL DEFAULT 1,
    "status" "SubscriptionStatus" NOT NULL,
    "billingCycle" "BillingCycle" NOT NULL,
    "provider" "BillingProvider" NOT NULL DEFAULT 'none',
    "appliedPrice" INTEGER NOT NULL DEFAULT 0,
    "discountPct" INTEGER,
    "promoRedemptionId" UUID,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "trialEndsAt" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "dunningStage" "DunningStage",
    "providerSubscriptionId" TEXT,
    "providerCustomerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspaceId" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "kind" "InvoiceKind" NOT NULL,
    "subscriptionId" UUID,
    "creditPackPurchaseId" UUID,
    "amount" INTEGER NOT NULL,
    "status" "InvoiceStatus" NOT NULL,
    "method" "PaymentMethodBilling",
    "dueAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "pdfUrl" TEXT,
    "lines" JSONB NOT NULL,
    "billingInfo" JSONB,
    "dunningStage" "DunningStage",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingPayment" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspaceId" UUID NOT NULL,
    "invoiceId" UUID,
    "subscriptionId" UUID,
    "amount" INTEGER NOT NULL,
    "status" "BillingPaymentStatus" NOT NULL,
    "provider" "BillingPaymentProvider" NOT NULL,
    "providerCheckoutId" TEXT NOT NULL,
    "reference" TEXT,
    "proofUploadId" UUID,
    "recordedById" UUID,
    "paidAt" TIMESTAMP(3),
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditLedger" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspaceId" UUID NOT NULL,
    "periodStart" TIMESTAMP(3),
    "bucket" "CreditBucket" NOT NULL DEFAULT 'plan',
    "action" "CreditAction" NOT NULL,
    "kind" "CreditKind" NOT NULL,
    "credits" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "aiRunId" UUID,
    "conversationId" UUID,
    "agentId" UUID,
    "channelId" UUID,
    "creditPackPurchaseId" UUID,
    "grantedById" UUID,
    "reason" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditPack" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "slug" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "credits" INTEGER NOT NULL,
    "priceWebDzd" INTEGER NOT NULL,
    "googleProductId" TEXT,
    "appleProductId" TEXT,
    "storeTier" TEXT,
    "storePriceLabel" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "visibleWeb" BOOLEAN NOT NULL DEFAULT true,
    "visibleMobile" BOOLEAN NOT NULL DEFAULT true,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditPack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditPackPurchase" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspaceId" UUID NOT NULL,
    "creditPackId" UUID NOT NULL,
    "channel" "PurchaseChannel" NOT NULL,
    "status" "PackPurchaseStatus" NOT NULL DEFAULT 'pending',
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'DZD',
    "providerCheckoutId" TEXT,
    "storeTransactionId" TEXT,
    "storeOrderId" TEXT,
    "receipt" JSONB,
    "purchasedById" UUID NOT NULL,
    "validatedAt" TIMESTAMP(3),
    "creditedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "refundSource" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditPackPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromoCode" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "code" TEXT NOT NULL,
    "kind" "PromoKind" NOT NULL,
    "value" INTEGER NOT NULL,
    "periods" INTEGER,
    "planSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "target" "PromoTarget" NOT NULL DEFAULT 'all',
    "targetWorkspaceId" UUID,
    "maxUses" INTEGER,
    "perWorkspaceLimit" INTEGER NOT NULL DEFAULT 1,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" UUID NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromoRedemption" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "promoCodeId" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "ledgerEntryId" UUID,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromoRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Channel" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspaceId" UUID NOT NULL,
    "platform" "ChannelPlatform" NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "followersCount" INTEGER,
    "accessToken" BYTEA,
    "tokenExpiresAt" TIMESTAMP(3),
    "status" "ChannelStatus" NOT NULL DEFAULT 'active',
    "pausedReason" "PausedReason",
    "parentChannelId" UUID,
    "connectedById" UUID NOT NULL,
    "icebreaker" TEXT,
    "grantedScopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastSyncAt" TIMESTAMP(3),
    "lastInfoSyncAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "lastTokenCheckAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelEvent" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspaceId" UUID NOT NULL,
    "channelId" UUID NOT NULL,
    "kind" "ChannelEventKind" NOT NULL,
    "description" TEXT,
    "actorType" "ActorType" NOT NULL,
    "actorId" UUID,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspaceId" UUID NOT NULL,
    "channelId" UUID NOT NULL,
    "externalSenderId" TEXT NOT NULL,
    "clientId" UUID,
    "agentId" UUID,
    "assigneeId" UUID,
    "status" "ConversationStatus" NOT NULL DEFAULT 'active',
    "aiPaused" BOOLEAN NOT NULL DEFAULT false,
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "lastMessageAt" TIMESTAMP(3),
    "lastCustomerMessageAt" TIMESTAMP(3),
    "lastMessagePreview" TEXT,
    "lastAiIntent" "AiIntent",
    "firstInboundAt" TIMESTAMP(3),
    "context" JSONB NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspaceId" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "externalId" TEXT,
    "direction" "MessageDirection" NOT NULL,
    "type" "MessageType" NOT NULL DEFAULT 'text',
    "author" "MessageAuthor" NOT NULL,
    "authorUserId" UUID,
    "text" TEXT,
    "attachments" JSONB,
    "transcript" TEXT,
    "transcriptStatus" "TranscriptStatus",
    "payload" JSONB,
    "customerReaction" "CustomerReaction",
    "containsBlockedWord" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveryStatus" "MessageDeliveryStatus" NOT NULL DEFAULT 'sent',
    "error" TEXT,
    "aiRunId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationNote" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspaceId" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuickReply" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspaceId" UUID NOT NULL,
    "title" VARCHAR(80) NOT NULL,
    "body" VARCHAR(1000) NOT NULL,
    "shortcut" VARCHAR(30),
    "locale" "Locale" NOT NULL DEFAULT 'fr',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuickReply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboundEvent" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "provider" "InboundProvider" NOT NULL,
    "externalId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "InboundEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiProvider" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "key" "AiProviderKey" NOT NULL,
    "displayName" TEXT NOT NULL,
    "apiKey" BYTEA,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "lastTestedAt" TIMESTAMP(3),
    "lastTestOk" BOOLEAN,
    "keyAddedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiModel" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "providerId" UUID NOT NULL,
    "modelId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "capabilities" "AiCapability"[],
    "supportsTools" BOOLEAN NOT NULL DEFAULT true,
    "inputPricePerM" DECIMAL(10,4) NOT NULL,
    "outputPricePerM" DECIMAL(10,4) NOT NULL,
    "contextTokens" INTEGER,
    "timeoutSec" INTEGER NOT NULL DEFAULT 20,
    "failoverThresholdPct" INTEGER NOT NULL DEFAULT 2,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isFallbackText" BOOLEAN NOT NULL DEFAULT false,
    "isFallbackVision" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiRoute" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "capability" "AiCapability" NOT NULL,
    "primaryModelId" UUID NOT NULL,
    "fallbackModelId" UUID,
    "creditCost" INTEGER NOT NULL,
    "timeoutSec" INTEGER NOT NULL DEFAULT 20,
    "errorThresholdPct" INTEGER NOT NULL DEFAULT 2,
    "failoverActive" BOOLEAN NOT NULL DEFAULT false,
    "failoverSince" TIMESTAMP(3),
    "updatedById" UUID NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditPricing" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "version" INTEGER NOT NULL,
    "usdToDzd" DECIMAL(10,2) NOT NULL,
    "creditPriceDzd" DECIMAL(10,2) NOT NULL,
    "costs" JSONB NOT NULL,
    "avgTokensPerMessage" INTEGER,
    "targetMarginPct" INTEGER,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "createdById" UUID NOT NULL,
    "announcementCmsEntryId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditPricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentPreset" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "key" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "tagline" JSONB,
    "description" JSONB,
    "badge" "PresetBadge",
    "sectors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "PresetStatus" NOT NULL DEFAULT 'draft',
    "currentVersion" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentPreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentPresetVersion" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "presetId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "PresetStatus" NOT NULL DEFAULT 'draft',
    "locales" JSONB NOT NULL,
    "config" JSONB NOT NULL,
    "changelog" TEXT,
    "testResults" JSONB,
    "publishedAt" TIMESTAMP(3),
    "publishedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentPresetVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspaceId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "personality" "Personality" NOT NULL DEFAULT 'friendly',
    "customInstructions" TEXT NOT NULL DEFAULT '',
    "productCardTemplate" TEXT,
    "closingInstructions" TEXT,
    "humanHandoffRules" TEXT,
    "modelId" UUID NOT NULL,
    "temperature" DECIMAL(3,2) NOT NULL DEFAULT 0.6,
    "maxTokens" INTEGER NOT NULL DEFAULT 1200,
    "sellAllProducts" BOOLEAN NOT NULL DEFAULT true,
    "imageRecognition" BOOLEAN NOT NULL DEFAULT true,
    "voiceTranscription" BOOLEAN NOT NULL DEFAULT true,
    "responseDelaySec" INTEGER NOT NULL DEFAULT 3,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "pausedReason" "PausedReason",
    "status" "AgentStatus" NOT NULL DEFAULT 'draft',
    "presetId" UUID,
    "presetVersion" INTEGER,
    "currentVersion" INTEGER NOT NULL DEFAULT 0,
    "lastActiveAt" TIMESTAMP(3),
    "scheduledActivateAt" TIMESTAMP(3),
    "wizardStep" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "displayName" TEXT,
    "avatarUploadId" UUID,
    "avatarMode" TEXT,
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "defaultLanguage" TEXT,
    "tone" "AgentTone",
    "formality" "Formality",
    "emojiLevel" "EmojiLevel",
    "catalogScope" "CatalogScope" NOT NULL DEFAULT 'all',
    "scopeCategoryIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "outOfStockBehavior" "OutOfStockBehavior" NOT NULL DEFAULT 'suggest_alternative',
    "showMissingVariants" BOOLEAN NOT NULL DEFAULT true,
    "policies" JSONB,
    "capabilities" JSONB,
    "orderFields" JSONB,
    "maxQtyPerOrder" INTEGER,
    "maxAmountPerOrder" INTEGER,
    "riskyClientBehavior" "RiskyClientBehavior",
    "recapMode" "RecapMode",
    "handoffRules" JSONB,
    "handoffKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "businessHours" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentVersion" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspaceId" UUID NOT NULL,
    "agentId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "note" TEXT,
    "createdById" UUID NOT NULL,
    "source" "AgentVersionSource" NOT NULL DEFAULT 'manual',
    "restoredFromVersion" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentChannel" (
    "agentId" UUID NOT NULL,
    "channelId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentChannel_pkey" PRIMARY KEY ("agentId","channelId")
);

-- CreateTable
CREATE TABLE "AgentProduct" (
    "agentId" UUID NOT NULL,
    "productId" UUID NOT NULL,

    CONSTRAINT "AgentProduct_pkey" PRIMARY KEY ("agentId","productId")
);

-- CreateTable
CREATE TABLE "AgentInsight" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspaceId" UUID NOT NULL,
    "agentId" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "messageId" UUID,
    "aiRunId" UUID,
    "type" "InsightType" NOT NULL,
    "customerMessage" TEXT NOT NULL,
    "aiResponse" TEXT,
    "detail" TEXT,
    "topicKey" TEXT,
    "status" "InsightStatus" NOT NULL DEFAULT 'pending',
    "resolution" "InsightResolution",
    "resolvedById" UUID,
    "resolvedAt" TIMESTAMP(3),
    "snoozedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiRun" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspaceId" UUID NOT NULL,
    "agentId" UUID,
    "conversationId" UUID,
    "kind" "AiRunKind" NOT NULL,
    "modelId" UUID NOT NULL,
    "providerId" UUID NOT NULL,
    "usedFallback" BOOLEAN NOT NULL DEFAULT false,
    "status" "AiRunStatus" NOT NULL DEFAULT 'running',
    "intent" "AiIntent",
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "latencyMs" INTEGER,
    "confidence" DECIMAL(3,2),
    "creditsCharged" INTEGER NOT NULL DEFAULT 0,
    "toolCallCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "AiRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiToolCall" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "aiRunId" UUID NOT NULL,
    "callId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "args" JSONB NOT NULL,
    "result" JSONB,
    "executedAt" TIMESTAMP(3),

    CONSTRAINT "AiToolCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentTestRun" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspaceId" UUID NOT NULL,
    "agentId" UUID NOT NULL,
    "agentVersion" INTEGER NOT NULL,
    "scenarioKey" "TestScenarioKey" NOT NULL,
    "status" "TestRunStatus" NOT NULL,
    "summary" TEXT,
    "aiRunId" UUID,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentTestRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentTestLink" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspaceId" UUID NOT NULL,
    "agentId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdById" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentTestLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentFaq" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspaceId" UUID NOT NULL,
    "agentId" UUID NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "source" "FaqSource" NOT NULL DEFAULT 'manual',
    "askedCount" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentFaq_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspaceId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#888888',
    "parentId" UUID,
    "imageUploadId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspaceId" UUID,
    "name" TEXT NOT NULL,
    "abbreviation" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "containsQty" INTEGER,
    "baseUnitId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspaceId" UUID NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" UUID,
    "unitId" UUID,
    "trackStock" BOOLEAN NOT NULL DEFAULT true,
    "price" INTEGER NOT NULL,
    "oldPrice" INTEGER,
    "costPrice" INTEGER,
    "stock" INTEGER,
    "minStock" INTEGER NOT NULL DEFAULT 0,
    "weightGrams" INTEGER,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hasVariants" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "moderationStatus" "ModerationStatusProduct" NOT NULL DEFAULT 'not_required',
    "moderationItemId" UUID,
    "approvedSnapshot" JSONB,
    "contentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdById" UUID,
    "lastInventoryAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "productId" UUID NOT NULL,
    "storageKey" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "aiCaption" TEXT,
    "altText" TEXT,
    "moderationFlag" "ImageModerationFlag",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspaceId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "price" INTEGER NOT NULL,
    "costPrice" INTEGER,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "minStock" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductExpense" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspaceId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "description" TEXT,
    "amount" INTEGER NOT NULL,
    "isPerUnit" BOOLEAN NOT NULL DEFAULT false,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recommendation" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspaceId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "recommendedId" UUID NOT NULL,
    "type" "RecommendationType" NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 50,
    "reason" TEXT,
    "source" "RecommendationSource" NOT NULL DEFAULT 'manual',
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "revenue" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendationEvent" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "recommendationId" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "kind" "RecommendationEventKind" NOT NULL,
    "orderId" UUID,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspaceId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "variantId" UUID,
    "type" "MovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "quantityBefore" INTEGER NOT NULL,
    "quantityAfter" INTEGER NOT NULL,
    "reason" "MovementReason",
    "note" TEXT,
    "refType" "MovementRefType",
    "refId" UUID,
    "actorId" UUID,
    "reversedByMovementId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryCount" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspaceId" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "scope" "InventoryScope" NOT NULL,
    "categoryId" UUID,
    "status" "InventoryStatus" NOT NULL DEFAULT 'draft',
    "blockCounterSales" BOOLEAN NOT NULL DEFAULT false,
    "startedById" UUID NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validatedById" UUID,
    "validatedAt" TIMESTAMP(3),
    "lineCount" INTEGER NOT NULL DEFAULT 0,
    "discrepancyCount" INTEGER NOT NULL DEFAULT 0,
    "discrepancyValue" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryCount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryCountLine" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "inventoryCountId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "variantId" UUID,
    "expectedQty" INTEGER NOT NULL,
    "countedQty" INTEGER,
    "difference" INTEGER NOT NULL DEFAULT 0,
    "differencePct" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "movementId" UUID,

    CONSTRAINT "InventoryCountLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockRecommendation" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspaceId" UUID NOT NULL,
    "type" "StockRecoType" NOT NULL,
    "priority" "Priority3" NOT NULL,
    "status" "StockRecoStatus" NOT NULL DEFAULT 'active',
    "productId" UUID,
    "variantId" UUID,
    "supplierId" UUID,
    "agentId" UUID,
    "title" JSONB NOT NULL,
    "body" JSONB NOT NULL,
    "suggestedAction" JSONB NOT NULL,
    "ruleKey" TEXT NOT NULL,
    "estimatedValue" INTEGER,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "jobId" UUID,
    "snoozedUntil" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "appliedRefType" TEXT,
    "appliedRefId" UUID,
    "dismissedAt" TIMESTAMP(3),
    "dismissedById" UUID,

    CONSTRAINT "StockRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockRecommendationMute" (
    "workspaceId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "type" "StockRecoType" NOT NULL,

    CONSTRAINT "StockRecommendationMute_pkey" PRIMARY KEY ("workspaceId","productId","type")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspaceId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "phone2" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source" "ClientSource" NOT NULL DEFAULT 'manual',
    "isPlaceholder" BOOLEAN NOT NULL DEFAULT false,
    "orderCount" INTEGER NOT NULL DEFAULT 0,
    "totalSpent" INTEGER NOT NULL DEFAULT 0,
    "lastOrderAt" TIMESTAMP(3),
    "returnCount" INTEGER NOT NULL DEFAULT 0,
    "cancelCount" INTEGER NOT NULL DEFAULT 0,
    "uncollectedCount" INTEGER NOT NULL DEFAULT 0,
    "riskLevel" "RiskLevel" NOT NULL DEFAULT 'normal',
    "riskSetManually" BOOLEAN NOT NULL DEFAULT false,
    "mergedIntoId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientAddress" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "clientId" UUID NOT NULL,
    "wilayaId" INTEGER NOT NULL,
    "communeId" INTEGER,
    "communeText" TEXT,
    "address" TEXT,
    "isStopdesk" BOOLEAN NOT NULL DEFAULT false,
    "stopdeskId" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientIdentity" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "clientId" UUID NOT NULL,
    "channelId" UUID NOT NULL,
    "externalSenderId" TEXT NOT NULL,
    "displayName" TEXT,
    "avatarUrl" TEXT,

    CONSTRAINT "ClientIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspaceId" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "clientId" UUID NOT NULL,
    "conversationId" UUID,
    "channelId" UUID,
    "source" "OrderSource" NOT NULL,
    "agentId" UUID,
    "createdById" UUID,
    "apiKeyId" UUID,
    "importJobId" UUID,
    "assigneeId" UUID,
    "status" "OrderStatus" NOT NULL DEFAULT 'new',
    "confirmationStatus" "ConfirmationStatus" NOT NULL DEFAULT 'pending',
    "callbackAt" TIMESTAMP(3),
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'unpaid',
    "deliveryStatus" "DeliveryStatus" NOT NULL DEFAULT 'not_sent',
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'cash',
    "clientName" TEXT NOT NULL,
    "clientPhone" TEXT NOT NULL,
    "clientPhone2" TEXT,
    "wilayaId" INTEGER,
    "communeId" INTEGER,
    "communeText" TEXT,
    "address" TEXT,
    "isStopdesk" BOOLEAN NOT NULL DEFAULT false,
    "stopdeskId" TEXT,
    "subtotal" INTEGER NOT NULL,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "tax" INTEGER NOT NULL DEFAULT 0,
    "deliveryFee" INTEGER NOT NULL DEFAULT 0,
    "courierCost" INTEGER,
    "returnFee" INTEGER,
    "total" INTEGER NOT NULL,
    "amountPaid" INTEGER NOT NULL DEFAULT 0,
    "callAttempts" INTEGER NOT NULL DEFAULT 0,
    "riskLevel" "RiskLevel" NOT NULL DEFAULT 'normal',
    "notes" TEXT,
    "labelPrintedAt" TIMESTAMP(3),
    "orderedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" "CancelReason",
    "cancelNote" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "orderId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "variantId" UUID,
    "productName" TEXT NOT NULL,
    "variantName" TEXT,
    "sku" TEXT,
    "unitPrice" INTEGER NOT NULL,
    "costPrice" INTEGER,
    "quantity" INTEGER NOT NULL,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderStatusHistory" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "orderId" UUID NOT NULL,
    "field" TEXT NOT NULL,
    "from" TEXT,
    "to" TEXT NOT NULL,
    "actorType" "ActorType" NOT NULL,
    "actorId" UUID,
    "reason" TEXT,
    "effectiveAt" TIMESTAMP(3),
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderCall" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "orderId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "result" "CallResult" NOT NULL,
    "callbackAt" TIMESTAMP(3),
    "notes" TEXT,
    "calledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderNote" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "orderId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentEntry" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspaceId" UUID NOT NULL,
    "sourceType" "PaymentSourceType" NOT NULL,
    "sourceId" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" UUID NOT NULL,
    "cashTransactionId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderPayment" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspaceId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'chargily',
    "amount" INTEGER NOT NULL,
    "status" "OnlinePaymentStatus" NOT NULL DEFAULT 'pending',
    "checkoutUrl" TEXT,
    "providerRef" TEXT,
    "expiresAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "refundReason" TEXT,
    "refundedAt" TIMESTAMP(3),
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wilaya" (
    "id" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "nameFr" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,

    CONSTRAINT "Wilaya_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commune" (
    "id" INTEGER NOT NULL,
    "wilayaId" INTEGER NOT NULL,
    "nameFr" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "postalCode" TEXT,

    CONSTRAINT "Commune_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourierCommuneMap" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "provider" "CourierProvider" NOT NULL,
    "communeId" INTEGER NOT NULL,
    "externalCode" TEXT NOT NULL,
    "stopdeskIds" JSONB,

    CONSTRAINT "CourierCommuneMap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourierStopdesk" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "provider" "CourierProvider" NOT NULL,
    "communeId" INTEGER NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,

    CONSTRAINT "CourierStopdesk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryFeeRule" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspaceId" UUID NOT NULL,
    "wilayaId" INTEGER NOT NULL,
    "homePrice" INTEGER NOT NULL,
    "stopdeskPrice" INTEGER NOT NULL,
    "returnPrice" INTEGER NOT NULL DEFAULT 0,
    "freeAbove" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "source" "FeeSource" NOT NULL DEFAULT 'default',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryFeeRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourierAccount" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspaceId" UUID NOT NULL,
    "provider" "CourierProvider" NOT NULL,
    "baseUrl" TEXT NOT NULL DEFAULT '',
    "displayName" TEXT NOT NULL,
    "credentials" BYTEA NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "senderName" TEXT,
    "senderPhone" TEXT,
    "senderAddress" TEXT,
    "senderWilayaId" INTEGER,
    "webhookSecret" BYTEA,
    "lastTestedAt" TIMESTAMP(3),
    "lastTestOk" BOOLEAN,
    "lastTestLatencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourierAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourierRateCache" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "courierAccountId" UUID NOT NULL,
    "wilayaId" INTEGER NOT NULL,
    "homePrice" INTEGER,
    "stopdeskPrice" INTEGER,
    "avgDays" DECIMAL(4,1),
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourierRateCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspaceId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "provider" "ShipmentProvider" NOT NULL,
    "courierAccountId" UUID,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'pending',
    "trackingNumber" TEXT,
    "externalId" TEXT,
    "labelUrl" TEXT,
    "publicTrackingToken" TEXT NOT NULL,
    "codAmount" INTEGER NOT NULL,
    "weightKg" DECIMAL(6,2),
    "contentSummary" TEXT,
    "stopdeskId" TEXT,
    "courierCost" INTEGER,
    "failureReason" "FailureReason",
    "deliveryAttempts" INTEGER NOT NULL DEFAULT 0,
    "rawStatus" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "nextSyncAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentEvent" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "shipmentId" UUID NOT NULL,
    "rawStatus" TEXT NOT NULL,
    "mappedStatus" "ShipmentStatus",
    "description" TEXT,
    "location" TEXT,
    "at" TIMESTAMP(3) NOT NULL,
    "source" "ShipmentEventSource" NOT NULL,
    "actorId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SheetsConnection" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspaceId" UUID NOT NULL,
    "googleEmail" TEXT NOT NULL,
    "refreshToken" BYTEA NOT NULL,
    "spreadsheetId" TEXT NOT NULL,
    "sheetName" TEXT NOT NULL DEFAULT 'Commandes',
    "filters" JSONB NOT NULL DEFAULT '{}',
    "status" "SheetsStatus" NOT NULL DEFAULT 'active',
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SheetsConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SheetsRow" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "connectionId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SheetsRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspaceId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "terms" TEXT,
    "paymentTermsDays" INTEGER,
    "avgLeadDays" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspaceId" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "supplierId" UUID,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'draft',
    "supplierInvoiceRef" TEXT,
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "tax" INTEGER NOT NULL DEFAULT 0,
    "shippingCost" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "amountPaid" INTEGER NOT NULL DEFAULT 0,
    "paymentMethod" "PaymentMethod",
    "paymentStatus" "GdsPaymentStatus" NOT NULL DEFAULT 'unpaid',
    "notes" TEXT,
    "cancelReason" TEXT,
    "createdById" UUID NOT NULL,
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseItem" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "purchaseId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "variantId" UUID,
    "productName" TEXT NOT NULL,
    "variantName" TEXT,
    "quantity" INTEGER NOT NULL,
    "receivedQty" INTEGER NOT NULL DEFAULT 0,
    "unitCost" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,

    CONSTRAINT "PurchaseItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspaceId" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "clientId" UUID,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "status" "SaleStatus" NOT NULL DEFAULT 'completed',
    "subtotal" INTEGER NOT NULL,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "tax" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "amountPaid" INTEGER NOT NULL DEFAULT 0,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'cash',
    "paymentStatus" "GdsPaymentStatus" NOT NULL DEFAULT 'unpaid',
    "notes" TEXT,
    "createdById" UUID NOT NULL,
    "soldAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" UUID,
    "cancelReason" TEXT,
    "stockRestored" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleItem" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "saleId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "variantId" UUID,
    "productName" TEXT NOT NULL,
    "variantName" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "costPrice" INTEGER,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,

    CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashTransaction" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspaceId" UUID NOT NULL,
    "type" "CashType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "category" "CashCategory" NOT NULL,
    "method" "CashMethod" NOT NULL DEFAULT 'cash',
    "reference" TEXT,
    "description" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isAutomatic" BOOLEAN NOT NULL DEFAULT false,
    "sourceType" "CashSourceType",
    "sourceId" UUID,
    "closingId" UUID,
    "createdById" UUID,
    "proofUploadId" UUID,
    "correctsTransactionId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashClosing" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspaceId" UUID NOT NULL,
    "day" DATE NOT NULL,
    "theoreticalBalance" INTEGER NOT NULL,
    "countedBalance" INTEGER NOT NULL,
    "difference" INTEGER NOT NULL,
    "note" TEXT,
    "closedById" UUID NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reopenedById" UUID,
    "reopenedAt" TIMESTAMP(3),

    CONSTRAINT "CashClosing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspaceId" UUID,
    "userId" UUID,
    "type" "NotificationType" NOT NULL,
    "title" JSONB NOT NULL,
    "body" JSONB NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "membershipId" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "email" BOOLEAN NOT NULL DEFAULT true,
    "push" BOOLEAN NOT NULL DEFAULT true,
    "sound" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Upload" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspaceId" UUID,
    "storageKey" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "kind" "UploadKind" NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Upload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspaceId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "environment" "ApiKeyEnvironment" NOT NULL DEFAULT 'live',
    "prefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastUsedAt" TIMESTAMP(3),
    "lastUsedIp" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEndpoint" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspaceId" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "events" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "secret" BYTEA NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "disabledAt" TIMESTAMP(3),
    "disabledReason" TEXT,
    "lastDeliveryAt" TIMESTAMP(3),
    "secretRotatedAt" TIMESTAMP(3),
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "endpointId" UUID NOT NULL,
    "event" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'pending',
    "responseCode" INTEGER,
    "durationMs" INTEGER,
    "error" TEXT,
    "nextAttemptAt" TIMESTAMP(3),
    "replayOfId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Outbox" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspaceId" UUID,
    "topic" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyStat" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspaceId" UUID NOT NULL,
    "day" DATE NOT NULL,
    "metrics" JSONB NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportSchedule" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspaceId" UUID NOT NULL,
    "reportKey" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "dayOfMonth" INTEGER NOT NULL DEFAULT 1,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspaceId" UUID,
    "kind" "JobKind" NOT NULL,
    "queue" TEXT,
    "status" "JobStatus" NOT NULL DEFAULT 'queued',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER,
    "payload" JSONB,
    "result" JSONB,
    "error" TEXT,
    "resultUploadId" UUID,
    "expiresAt" TIMESTAMP(3),
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspaceId" UUID,
    "actorType" "ActorType" NOT NULL,
    "actorId" UUID,
    "actorRole" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "diff" JSONB,
    "reason" TEXT,
    "impersonationSessionId" UUID,
    "ip" TEXT,
    "userAgent" TEXT,
    "sessionId" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Counter" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspaceId" UUID,
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Counter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedView" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspaceId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "page" "SavedViewPage" NOT NULL,
    "name" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "sort" TEXT,
    "columns" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "density" "ListDensity",
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "sharedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationItem" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspaceId" UUID NOT NULL,
    "type" "ModerationItemType" NOT NULL,
    "productId" UUID,
    "agentId" UUID,
    "categoryId" UUID,
    "contentVersion" INTEGER NOT NULL DEFAULT 1,
    "snapshot" JSONB NOT NULL,
    "status" "ModerationItemStatus" NOT NULL DEFAULT 'pending',
    "aiScore" DECIMAL(3,2),
    "aiFlags" JSONB NOT NULL DEFAULT '[]',
    "priority" "ModerationPriority" NOT NULL DEFAULT 'normal',
    "slaDueAt" TIMESTAMP(3) NOT NULL,
    "assigneeId" UUID,
    "reviewerId" UUID,
    "decision" "ModerationDecision",
    "reasonTemplateKey" TEXT,
    "merchantMessage" TEXT,
    "rejectedFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "decidedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" "ModerationSource" NOT NULL DEFAULT 'create',

    CONSTRAINT "ModerationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationAppeal" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspaceId" UUID NOT NULL,
    "moderationItemId" UUID NOT NULL,
    "message" TEXT NOT NULL,
    "attachmentUploadId" UUID,
    "submittedById" UUID NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadlineAt" TIMESTAMP(3) NOT NULL,
    "reviewerId" UUID,
    "decision" "AppealDecision",
    "decisionNote" TEXT,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "ModerationAppeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationRule" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "key" TEXT NOT NULL,
    "kind" "ModerationRuleKind" NOT NULL,
    "value" TEXT NOT NULL,
    "locale" "Locale",
    "categoryId" UUID,
    "referencePrice" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModerationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspaceId" UUID,
    "type" "ReportType" NOT NULL,
    "reporterKind" "ReporterKind" NOT NULL,
    "reporterUserId" UUID,
    "reporterEmail" TEXT,
    "conversationId" UUID,
    "clientId" UUID,
    "messageId" UUID,
    "aiRunId" UUID,
    "productId" UUID,
    "targetWorkspaceId" UUID,
    "reason" "ReportReason" NOT NULL,
    "details" TEXT,
    "excerpt" JSONB,
    "severity" "Severity" NOT NULL DEFAULT 'medium',
    "status" "ReportStatus" NOT NULL DEFAULT 'open',
    "assigneeId" UUID,
    "decision" "ReportDecision",
    "decisionNote" TEXT,
    "resolvedById" UUID,
    "resolvedAt" TIMESTAMP(3),
    "reporterNotifiedAt" TIMESTAMP(3),
    "blockRequested" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerBlock" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspaceId" UUID NOT NULL,
    "clientId" UUID,
    "phone" TEXT,
    "channelId" UUID,
    "externalSenderId" TEXT,
    "reason" "BlockReason",
    "note" TEXT,
    "source" "BlockSource" NOT NULL DEFAULT 'manual',
    "reportId" UUID,
    "blockedById" UUID,
    "blockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unblockedById" UUID,
    "unblockedAt" TIMESTAMP(3),

    CONSTRAINT "CustomerBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformBlacklist" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "phone" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "reportId" UUID,
    "workspaceCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedById" UUID,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "PlatformBlacklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockedWord" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "workspaceId" UUID,
    "word" TEXT NOT NULL,
    "locale" "Locale",
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockedWord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "number" TEXT NOT NULL,
    "workspaceId" UUID,
    "userId" UUID NOT NULL,
    "category" "TicketCategory" NOT NULL,
    "priority" "TicketPriority" NOT NULL DEFAULT 'normal',
    "channel" "TicketChannel" NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'open',
    "subject" TEXT NOT NULL,
    "context" JSONB NOT NULL DEFAULT '{}',
    "assigneeId" UUID,
    "firstResponseAt" TIMESTAMP(3),
    "slaDueAt" TIMESTAMP(3) NOT NULL,
    "slaHours" INTEGER NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "satisfaction" INTEGER,
    "satisfactionNote" TEXT,
    "incidentId" UUID,
    "escalatedAt" TIMESTAMP(3),
    "escalationNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportMessage" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "ticketId" UUID NOT NULL,
    "authorKind" "TicketAuthorKind" NOT NULL,
    "authorId" UUID,
    "body" TEXT NOT NULL,
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "cannedReplyKey" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CannedReply" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" JSONB NOT NULL,
    "category" TEXT,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CannedReply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountDeletionRequest" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "userId" UUID NOT NULL,
    "source" "DeletionSource" NOT NULL,
    "status" "DeletionStatus" NOT NULL DEFAULT 'pending_confirmation',
    "tokenHash" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "blockedReason" TEXT,
    "exportJobId" UUID,
    "cancelledAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "processedById" UUID,
    "ip" TEXT,

    CONSTRAINT "AccountDeletionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImpersonationSession" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "adminUserId" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "ticketId" UUID,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "actionsCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ImpersonationSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataDeletionRequest" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "provider" TEXT NOT NULL DEFAULT 'meta',
    "confirmationCode" TEXT NOT NULL,
    "externalUserId" TEXT NOT NULL,
    "status" "DataDeletionStatus" NOT NULL DEFAULT 'pending',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "affectedWorkspaces" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DataDeletionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppVersion" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "platform" "AppPlatform" NOT NULL,
    "latestVersion" TEXT NOT NULL,
    "latestBuild" INTEGER,
    "minVersion" TEXT NOT NULL,
    "recommendedVersion" TEXT NOT NULL,
    "storeStatus" "StoreStatus" NOT NULL DEFAULT 'published',
    "rolloutPct" INTEGER,
    "storeUrl" TEXT NOT NULL,
    "updateMessage" JSONB NOT NULL,
    "forceUpdateAt" TIMESTAMP(3),
    "updatedById" UUID NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "key" TEXT NOT NULL,
    "description" TEXT,
    "webPct" INTEGER NOT NULL DEFAULT 0,
    "mobilePct" INTEGER NOT NULL DEFAULT 0,
    "targeting" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlagOverride" (
    "flagId" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL,

    CONSTRAINT "FeatureFlagOverride_pkey" PRIMARY KEY ("flagId","workspaceId")
);

-- CreateTable
CREATE TABLE "LegalDocument" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "key" "LegalDocKey" NOT NULL,
    "version" INTEGER NOT NULL,
    "isMajor" BOOLEAN NOT NULL DEFAULT false,
    "cmsEntryId" UUID NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedById" UUID NOT NULL,
    "requiresReacceptance" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "LegalDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSetting" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedById" UUID NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSettingVersion" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "settingId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "value" JSONB NOT NULL,
    "changedById" UUID NOT NULL,
    "reason" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformSettingVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaPermission" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "scope" TEXT NOT NULL,
    "status" "MetaPermissionStatus" NOT NULL DEFAULT 'not_requested',
    "feature" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformProvider" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "key" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "secret" BYTEA,
    "status" "ProviderStatus" NOT NULL DEFAULT 'disabled',
    "lastCheckedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "quota" JSONB,
    "expiresAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "title" JSONB NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'open',
    "severity" "IncidentSeverity" NOT NULL DEFAULT 'minor',
    "components" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "identifiedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "affectedWorkspaces" INTEGER,
    "bannerCmsEntryId" UUID,
    "postMortem" TEXT,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentUpdate" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "incidentId" UUID NOT NULL,
    "status" "IncidentStatus" NOT NULL,
    "body" JSONB NOT NULL,
    "authorId" UUID NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatusSubscriber" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "unsubscribedAt" TIMESTAMP(3),
    "locale" "Locale" NOT NULL DEFAULT 'fr',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatusSubscriber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CmsEntry" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "key" TEXT NOT NULL,
    "type" "CmsType" NOT NULL,
    "category" TEXT,
    "target" JSONB NOT NULL DEFAULT '{}',
    "channels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "link" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "CmsStatus" NOT NULL DEFAULT 'draft',
    "currentVersion" INTEGER NOT NULL DEFAULT 0,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CmsEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CmsEntryLocale" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "entryId" UUID NOT NULL,
    "locale" "Locale" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "CmsLocaleStatus" NOT NULL DEFAULT 'draft',
    "fallbackToFr" BOOLEAN NOT NULL DEFAULT false,
    "updatedById" UUID NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CmsEntryLocale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CmsEntryVersion" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "entryId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdById" UUID NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CmsEntryVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_ownedWorkspaceId_key" ON "User"("ownedWorkspaceId");

-- CreateIndex
CREATE INDEX "User_platformRole_idx" ON "User"("platformRole");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_familyId_idx" ON "RefreshToken"("userId", "familyId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailToken_tokenHash_key" ON "EmailToken"("tokenHash");

-- CreateIndex
CREATE INDEX "EmailToken_userId_kind_idx" ON "EmailToken"("userId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_defaultCourierAccountId_key" ON "Workspace"("defaultCourierAccountId");

-- CreateIndex
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_workspaceId_userId_key" ON "Membership"("workspaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");

-- CreateIndex
CREATE INDEX "Invitation_workspaceId_email_idx" ON "Invitation"("workspaceId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceToken_token_key" ON "DeviceToken"("token");

-- CreateIndex
CREATE INDEX "DeviceToken_userId_idx" ON "DeviceToken"("userId");

-- CreateIndex
CREATE INDEX "IdempotencyKey_expiresAt_idx" ON "IdempotencyKey"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyKey_workspaceId_key_key" ON "IdempotencyKey"("workspaceId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformInvitation_tokenHash_key" ON "PlatformInvitation"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "LegalAcceptance_userId_legalDocumentId_version_key" ON "LegalAcceptance"("userId", "legalDocumentId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_slug_key" ON "Plan"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "PlanVersion_planId_version_key" ON "PlanVersion"("planId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_promoRedemptionId_key" ON "Subscription"("promoRedemptionId");

-- CreateIndex
CREATE INDEX "Subscription_workspaceId_status_idx" ON "Subscription"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "Subscription_currentPeriodEnd_idx" ON "Subscription"("currentPeriodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_creditPackPurchaseId_key" ON "Invoice"("creditPackPurchaseId");

-- CreateIndex
CREATE INDEX "Invoice_workspaceId_status_createdAt_idx" ON "Invoice"("workspaceId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BillingPayment_providerCheckoutId_key" ON "BillingPayment"("providerCheckoutId");

-- CreateIndex
CREATE INDEX "BillingPayment_workspaceId_createdAt_idx" ON "BillingPayment"("workspaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CreditLedger_idempotencyKey_key" ON "CreditLedger"("idempotencyKey");

-- CreateIndex
CREATE INDEX "CreditLedger_workspaceId_periodStart_kind_idx" ON "CreditLedger"("workspaceId", "periodStart", "kind");

-- CreateIndex
CREATE INDEX "CreditLedger_workspaceId_createdAt_idx" ON "CreditLedger"("workspaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CreditPack_slug_key" ON "CreditPack"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "CreditPack_googleProductId_key" ON "CreditPack"("googleProductId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditPack_appleProductId_key" ON "CreditPack"("appleProductId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditPackPurchase_providerCheckoutId_key" ON "CreditPackPurchase"("providerCheckoutId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditPackPurchase_storeTransactionId_key" ON "CreditPackPurchase"("storeTransactionId");

-- CreateIndex
CREATE INDEX "CreditPackPurchase_workspaceId_createdAt_idx" ON "CreditPackPurchase"("workspaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PromoCode_code_key" ON "PromoCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PromoRedemption_ledgerEntryId_key" ON "PromoRedemption"("ledgerEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "PromoRedemption_promoCodeId_workspaceId_key" ON "PromoRedemption"("promoCodeId", "workspaceId");

-- CreateIndex
CREATE INDEX "Channel_workspaceId_status_idx" ON "Channel"("workspaceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Channel_platform_externalId_key" ON "Channel"("platform", "externalId");

-- CreateIndex
CREATE INDEX "ChannelEvent_channelId_at_idx" ON "ChannelEvent"("channelId", "at");

-- CreateIndex
CREATE INDEX "Conversation_workspaceId_status_lastMessageAt_idx" ON "Conversation"("workspaceId", "status", "lastMessageAt");

-- CreateIndex
CREATE INDEX "Conversation_workspaceId_assigneeId_idx" ON "Conversation"("workspaceId", "assigneeId");

-- CreateIndex
CREATE INDEX "Conversation_workspaceId_clientId_idx" ON "Conversation"("workspaceId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_channelId_externalSenderId_key" ON "Conversation"("channelId", "externalSenderId");

-- CreateIndex
CREATE INDEX "Message_conversationId_sentAt_idx" ON "Message"("conversationId", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "Message_conversationId_externalId_key" ON "Message"("conversationId", "externalId");

-- CreateIndex
CREATE INDEX "ConversationNote_conversationId_idx" ON "ConversationNote"("conversationId");

-- CreateIndex
CREATE INDEX "QuickReply_workspaceId_sortOrder_idx" ON "QuickReply"("workspaceId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "QuickReply_workspaceId_locale_title_key" ON "QuickReply"("workspaceId", "locale", "title");

-- CreateIndex
CREATE UNIQUE INDEX "InboundEvent_externalId_key" ON "InboundEvent"("externalId");

-- CreateIndex
CREATE INDEX "InboundEvent_provider_receivedAt_idx" ON "InboundEvent"("provider", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AiProvider_key_key" ON "AiProvider"("key");

-- CreateIndex
CREATE UNIQUE INDEX "AiModel_providerId_modelId_key" ON "AiModel"("providerId", "modelId");

-- CreateIndex
CREATE UNIQUE INDEX "AiRoute_capability_key" ON "AiRoute"("capability");

-- CreateIndex
CREATE UNIQUE INDEX "CreditPricing_version_key" ON "CreditPricing"("version");

-- CreateIndex
CREATE UNIQUE INDEX "AgentPreset_key_key" ON "AgentPreset"("key");

-- CreateIndex
CREATE UNIQUE INDEX "AgentPresetVersion_presetId_version_key" ON "AgentPresetVersion"("presetId", "version");

-- CreateIndex
CREATE INDEX "Agent_workspaceId_status_idx" ON "Agent"("workspaceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AgentVersion_agentId_version_key" ON "AgentVersion"("agentId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "AgentChannel_channelId_key" ON "AgentChannel"("channelId");

-- CreateIndex
CREATE INDEX "AgentProduct_productId_idx" ON "AgentProduct"("productId");

-- CreateIndex
CREATE INDEX "AgentInsight_workspaceId_agentId_status_topicKey_idx" ON "AgentInsight"("workspaceId", "agentId", "status", "topicKey");

-- CreateIndex
CREATE INDEX "AiRun_workspaceId_startedAt_idx" ON "AiRun"("workspaceId", "startedAt");

-- CreateIndex
CREATE INDEX "AiRun_workspaceId_agentId_startedAt_idx" ON "AiRun"("workspaceId", "agentId", "startedAt");

-- CreateIndex
CREATE INDEX "AiRun_status_startedAt_idx" ON "AiRun"("status", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AiToolCall_aiRunId_callId_key" ON "AiToolCall"("aiRunId", "callId");

-- CreateIndex
CREATE INDEX "AgentTestRun_agentId_at_idx" ON "AgentTestRun"("agentId", "at");

-- CreateIndex
CREATE UNIQUE INDEX "AgentTestLink_tokenHash_key" ON "AgentTestLink"("tokenHash");

-- CreateIndex
CREATE INDEX "AgentFaq_agentId_sortOrder_idx" ON "AgentFaq"("agentId", "sortOrder");

-- CreateIndex
CREATE INDEX "Category_workspaceId_parentId_idx" ON "Category"("workspaceId", "parentId");

-- CreateIndex
CREATE INDEX "Unit_workspaceId_idx" ON "Unit"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_moderationItemId_key" ON "Product"("moderationItemId");

-- CreateIndex
CREATE INDEX "Product_workspaceId_isActive_idx" ON "Product"("workspaceId", "isActive");

-- CreateIndex
CREATE INDEX "Product_workspaceId_categoryId_idx" ON "Product"("workspaceId", "categoryId");

-- CreateIndex
CREATE INDEX "Product_workspaceId_moderationStatus_idx" ON "Product"("workspaceId", "moderationStatus");

-- CreateIndex
CREATE INDEX "ProductImage_productId_sortOrder_idx" ON "ProductImage"("productId", "sortOrder");

-- CreateIndex
CREATE INDEX "ProductVariant_workspaceId_idx" ON "ProductVariant"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_productId_name_key" ON "ProductVariant"("productId", "name");

-- CreateIndex
CREATE INDEX "ProductExpense_workspaceId_productId_idx" ON "ProductExpense"("workspaceId", "productId");

-- CreateIndex
CREATE INDEX "Recommendation_workspaceId_isActive_idx" ON "Recommendation"("workspaceId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Recommendation_productId_recommendedId_type_key" ON "Recommendation"("productId", "recommendedId", "type");

-- CreateIndex
CREATE INDEX "RecommendationEvent_recommendationId_at_idx" ON "RecommendationEvent"("recommendationId", "at");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_reversedByMovementId_key" ON "StockMovement"("reversedByMovementId");

-- CreateIndex
CREATE INDEX "StockMovement_workspaceId_createdAt_idx" ON "StockMovement"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_workspaceId_productId_createdAt_idx" ON "StockMovement"("workspaceId", "productId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_refType_refId_idx" ON "StockMovement"("refType", "refId");

-- CreateIndex
CREATE INDEX "InventoryCount_workspaceId_status_idx" ON "InventoryCount"("workspaceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryCount_workspaceId_number_key" ON "InventoryCount"("workspaceId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryCountLine_movementId_key" ON "InventoryCountLine"("movementId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryCountLine_inventoryCountId_productId_variantId_key" ON "InventoryCountLine"("inventoryCountId", "productId", "variantId");

-- CreateIndex
CREATE INDEX "StockRecommendation_workspaceId_status_priority_idx" ON "StockRecommendation"("workspaceId", "status", "priority");

-- CreateIndex
CREATE INDEX "Client_workspaceId_lastOrderAt_idx" ON "Client"("workspaceId", "lastOrderAt");

-- CreateIndex
CREATE INDEX "Client_workspaceId_riskLevel_idx" ON "Client"("workspaceId", "riskLevel");

-- CreateIndex
CREATE INDEX "ClientAddress_clientId_idx" ON "ClientAddress"("clientId");

-- CreateIndex
CREATE INDEX "ClientIdentity_clientId_idx" ON "ClientIdentity"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientIdentity_channelId_externalSenderId_key" ON "ClientIdentity"("channelId", "externalSenderId");

-- CreateIndex
CREATE INDEX "Order_workspaceId_status_orderedAt_idx" ON "Order"("workspaceId", "status", "orderedAt");

-- CreateIndex
CREATE INDEX "Order_workspaceId_source_agentId_idx" ON "Order"("workspaceId", "source", "agentId");

-- CreateIndex
CREATE INDEX "Order_workspaceId_assigneeId_status_idx" ON "Order"("workspaceId", "assigneeId", "status");

-- CreateIndex
CREATE INDEX "Order_workspaceId_callbackAt_idx" ON "Order"("workspaceId", "callbackAt");

-- CreateIndex
CREATE INDEX "Order_workspaceId_clientId_idx" ON "Order"("workspaceId", "clientId");

-- CreateIndex
CREATE INDEX "Order_workspaceId_deliveryStatus_idx" ON "Order"("workspaceId", "deliveryStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Order_workspaceId_number_key" ON "Order"("workspaceId", "number");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");

-- CreateIndex
CREATE INDEX "OrderStatusHistory_orderId_at_idx" ON "OrderStatusHistory"("orderId", "at");

-- CreateIndex
CREATE INDEX "OrderCall_orderId_calledAt_idx" ON "OrderCall"("orderId", "calledAt");

-- CreateIndex
CREATE INDEX "OrderNote_orderId_idx" ON "OrderNote"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentEntry_cashTransactionId_key" ON "PaymentEntry"("cashTransactionId");

-- CreateIndex
CREATE INDEX "PaymentEntry_workspaceId_sourceType_sourceId_idx" ON "PaymentEntry"("workspaceId", "sourceType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderPayment_providerRef_key" ON "OrderPayment"("providerRef");

-- CreateIndex
CREATE INDEX "OrderPayment_orderId_status_idx" ON "OrderPayment"("orderId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Wilaya_code_key" ON "Wilaya"("code");

-- CreateIndex
CREATE INDEX "Commune_wilayaId_idx" ON "Commune"("wilayaId");

-- CreateIndex
CREATE UNIQUE INDEX "CourierCommuneMap_provider_communeId_key" ON "CourierCommuneMap"("provider", "communeId");

-- CreateIndex
CREATE INDEX "CourierStopdesk_provider_communeId_idx" ON "CourierStopdesk"("provider", "communeId");

-- CreateIndex
CREATE UNIQUE INDEX "CourierStopdesk_provider_externalId_key" ON "CourierStopdesk"("provider", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryFeeRule_workspaceId_wilayaId_key" ON "DeliveryFeeRule"("workspaceId", "wilayaId");

-- CreateIndex
CREATE UNIQUE INDEX "CourierAccount_workspaceId_provider_baseUrl_key" ON "CourierAccount"("workspaceId", "provider", "baseUrl");

-- CreateIndex
CREATE UNIQUE INDEX "CourierRateCache_courierAccountId_wilayaId_key" ON "CourierRateCache"("courierAccountId", "wilayaId");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_publicTrackingToken_key" ON "Shipment"("publicTrackingToken");

-- CreateIndex
CREATE INDEX "Shipment_workspaceId_status_lastSyncedAt_idx" ON "Shipment"("workspaceId", "status", "lastSyncedAt");

-- CreateIndex
CREATE INDEX "Shipment_nextSyncAt_idx" ON "Shipment"("nextSyncAt");

-- CreateIndex
CREATE INDEX "Shipment_trackingNumber_idx" ON "Shipment"("trackingNumber");

-- CreateIndex
CREATE INDEX "ShipmentEvent_shipmentId_at_idx" ON "ShipmentEvent"("shipmentId", "at");

-- CreateIndex
CREATE UNIQUE INDEX "SheetsConnection_workspaceId_key" ON "SheetsConnection"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "SheetsRow_orderId_key" ON "SheetsRow"("orderId");

-- CreateIndex
CREATE INDEX "Supplier_workspaceId_isActive_idx" ON "Supplier"("workspaceId", "isActive");

-- CreateIndex
CREATE INDEX "Purchase_workspaceId_status_expectedAt_idx" ON "Purchase"("workspaceId", "status", "expectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_workspaceId_number_key" ON "Purchase"("workspaceId", "number");

-- CreateIndex
CREATE INDEX "PurchaseItem_purchaseId_idx" ON "PurchaseItem"("purchaseId");

-- CreateIndex
CREATE INDEX "Sale_workspaceId_soldAt_idx" ON "Sale"("workspaceId", "soldAt");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_workspaceId_number_key" ON "Sale"("workspaceId", "number");

-- CreateIndex
CREATE INDEX "SaleItem_saleId_idx" ON "SaleItem"("saleId");

-- CreateIndex
CREATE INDEX "CashTransaction_workspaceId_date_idx" ON "CashTransaction"("workspaceId", "date");

-- CreateIndex
CREATE INDEX "CashTransaction_sourceType_sourceId_idx" ON "CashTransaction"("sourceType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "CashClosing_workspaceId_day_key" ON "CashClosing"("workspaceId", "day");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_workspaceId_type_createdAt_idx" ON "Notification"("workspaceId", "type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_membershipId_type_key" ON "NotificationPreference"("membershipId", "type");

-- CreateIndex
CREATE INDEX "Upload_workspaceId_kind_idx" ON "Upload"("workspaceId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "ApiKey_workspaceId_idx" ON "ApiKey"("workspaceId");

-- CreateIndex
CREATE INDEX "WebhookEndpoint_workspaceId_idx" ON "WebhookEndpoint"("workspaceId");

-- CreateIndex
CREATE INDEX "WebhookDelivery_endpointId_createdAt_idx" ON "WebhookDelivery"("endpointId", "createdAt");

-- CreateIndex
CREATE INDEX "WebhookDelivery_status_nextAttemptAt_idx" ON "WebhookDelivery"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "Outbox_processedAt_createdAt_idx" ON "Outbox"("processedAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Outbox_topic_key_key" ON "Outbox"("topic", "key");

-- CreateIndex
CREATE UNIQUE INDEX "DailyStat_workspaceId_day_key" ON "DailyStat"("workspaceId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "ReportSchedule_workspaceId_reportKey_email_key" ON "ReportSchedule"("workspaceId", "reportKey", "email");

-- CreateIndex
CREATE INDEX "Job_workspaceId_kind_createdAt_idx" ON "Job"("workspaceId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "Job_status_createdAt_idx" ON "Job"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_workspaceId_at_idx" ON "AuditLog"("workspaceId", "at");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_at_idx" ON "AuditLog"("actorId", "at");

-- CreateIndex
CREATE INDEX "AuditLog_action_at_idx" ON "AuditLog"("action", "at");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "Counter_workspaceId_key_key" ON "Counter"("workspaceId", "key");

-- CreateIndex
CREATE INDEX "SavedView_workspaceId_page_isShared_idx" ON "SavedView"("workspaceId", "page", "isShared");

-- CreateIndex
CREATE UNIQUE INDEX "SavedView_workspaceId_userId_page_name_key" ON "SavedView"("workspaceId", "userId", "page", "name");

-- CreateIndex
CREATE INDEX "ModerationItem_status_priority_submittedAt_idx" ON "ModerationItem"("status", "priority", "submittedAt");

-- CreateIndex
CREATE INDEX "ModerationItem_workspaceId_productId_submittedAt_idx" ON "ModerationItem"("workspaceId", "productId", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ModerationItem_productId_contentVersion_key" ON "ModerationItem"("productId", "contentVersion");

-- CreateIndex
CREATE UNIQUE INDEX "ModerationAppeal_moderationItemId_key" ON "ModerationAppeal"("moderationItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ModerationRule_key_key" ON "ModerationRule"("key");

-- CreateIndex
CREATE INDEX "Report_status_severity_createdAt_idx" ON "Report"("status", "severity", "createdAt");

-- CreateIndex
CREATE INDEX "Report_workspaceId_createdAt_idx" ON "Report"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "CustomerBlock_workspaceId_unblockedAt_idx" ON "CustomerBlock"("workspaceId", "unblockedAt");

-- CreateIndex
CREATE INDEX "CustomerBlock_phone_idx" ON "CustomerBlock"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformBlacklist_phone_key" ON "PlatformBlacklist"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "BlockedWord_workspaceId_word_key" ON "BlockedWord"("workspaceId", "word");

-- CreateIndex
CREATE UNIQUE INDEX "SupportTicket_number_key" ON "SupportTicket"("number");

-- CreateIndex
CREATE INDEX "SupportTicket_status_slaDueAt_idx" ON "SupportTicket"("status", "slaDueAt");

-- CreateIndex
CREATE INDEX "SupportTicket_workspaceId_createdAt_idx" ON "SupportTicket"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "SupportTicket_assigneeId_status_idx" ON "SupportTicket"("assigneeId", "status");

-- CreateIndex
CREATE INDEX "SupportMessage_ticketId_at_idx" ON "SupportMessage"("ticketId", "at");

-- CreateIndex
CREATE UNIQUE INDEX "CannedReply_key_key" ON "CannedReply"("key");

-- CreateIndex
CREATE UNIQUE INDEX "AccountDeletionRequest_tokenHash_key" ON "AccountDeletionRequest"("tokenHash");

-- CreateIndex
CREATE INDEX "AccountDeletionRequest_status_scheduledAt_idx" ON "AccountDeletionRequest"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "ImpersonationSession_workspaceId_startedAt_idx" ON "ImpersonationSession"("workspaceId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DataDeletionRequest_confirmationCode_key" ON "DataDeletionRequest"("confirmationCode");

-- CreateIndex
CREATE UNIQUE INDEX "AppVersion_platform_key" ON "AppVersion"("platform");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_key_key" ON "FeatureFlag"("key");

-- CreateIndex
CREATE UNIQUE INDEX "LegalDocument_key_version_key" ON "LegalDocument"("key", "version");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformSetting_key_key" ON "PlatformSetting"("key");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformSettingVersion_settingId_version_key" ON "PlatformSettingVersion"("settingId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "MetaPermission_scope_key" ON "MetaPermission"("scope");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformProvider_key_key" ON "PlatformProvider"("key");

-- CreateIndex
CREATE INDEX "Incident_status_startedAt_idx" ON "Incident"("status", "startedAt");

-- CreateIndex
CREATE INDEX "IncidentUpdate_incidentId_at_idx" ON "IncidentUpdate"("incidentId", "at");

-- CreateIndex
CREATE UNIQUE INDEX "StatusSubscriber_email_key" ON "StatusSubscriber"("email");

-- CreateIndex
CREATE UNIQUE INDEX "CmsEntry_key_key" ON "CmsEntry"("key");

-- CreateIndex
CREATE INDEX "CmsEntry_type_status_idx" ON "CmsEntry"("type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CmsEntryLocale_entryId_locale_key" ON "CmsEntryLocale"("entryId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "CmsEntryVersion_entryId_version_key" ON "CmsEntryVersion"("entryId", "version");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_ownedWorkspaceId_fkey" FOREIGN KEY ("ownedWorkspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailToken" ADD CONSTRAINT "EmailToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_senderWilayaId_fkey" FOREIGN KEY ("senderWilayaId") REFERENCES "Wilaya"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_defaultCourierAccountId_fkey" FOREIGN KEY ("defaultCourierAccountId") REFERENCES "CourierAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_trustSetById_fkey" FOREIGN KEY ("trustSetById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceToken" ADD CONSTRAINT "DeviceToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotencyKey" ADD CONSTRAINT "IdempotencyKey_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformInvitation" ADD CONSTRAINT "PlatformInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalAcceptance" ADD CONSTRAINT "LegalAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalAcceptance" ADD CONSTRAINT "LegalAcceptance_legalDocumentId_fkey" FOREIGN KEY ("legalDocumentId") REFERENCES "LegalDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanVersion" ADD CONSTRAINT "PlanVersion_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanVersion" ADD CONSTRAINT "PlanVersion_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_promoRedemptionId_fkey" FOREIGN KEY ("promoRedemptionId") REFERENCES "PromoRedemption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_creditPackPurchaseId_fkey" FOREIGN KEY ("creditPackPurchaseId") REFERENCES "CreditPackPurchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingPayment" ADD CONSTRAINT "BillingPayment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingPayment" ADD CONSTRAINT "BillingPayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingPayment" ADD CONSTRAINT "BillingPayment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingPayment" ADD CONSTRAINT "BillingPayment_proofUploadId_fkey" FOREIGN KEY ("proofUploadId") REFERENCES "Upload"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingPayment" ADD CONSTRAINT "BillingPayment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditLedger" ADD CONSTRAINT "CreditLedger_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditLedger" ADD CONSTRAINT "CreditLedger_aiRunId_fkey" FOREIGN KEY ("aiRunId") REFERENCES "AiRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditLedger" ADD CONSTRAINT "CreditLedger_creditPackPurchaseId_fkey" FOREIGN KEY ("creditPackPurchaseId") REFERENCES "CreditPackPurchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditLedger" ADD CONSTRAINT "CreditLedger_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditPackPurchase" ADD CONSTRAINT "CreditPackPurchase_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditPackPurchase" ADD CONSTRAINT "CreditPackPurchase_creditPackId_fkey" FOREIGN KEY ("creditPackId") REFERENCES "CreditPack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditPackPurchase" ADD CONSTRAINT "CreditPackPurchase_purchasedById_fkey" FOREIGN KEY ("purchasedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoCode" ADD CONSTRAINT "PromoCode_targetWorkspaceId_fkey" FOREIGN KEY ("targetWorkspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoCode" ADD CONSTRAINT "PromoCode_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoRedemption" ADD CONSTRAINT "PromoRedemption_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoRedemption" ADD CONSTRAINT "PromoRedemption_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoRedemption" ADD CONSTRAINT "PromoRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoRedemption" ADD CONSTRAINT "PromoRedemption_ledgerEntryId_fkey" FOREIGN KEY ("ledgerEntryId") REFERENCES "CreditLedger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_parentChannelId_fkey" FOREIGN KEY ("parentChannelId") REFERENCES "Channel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_connectedById_fkey" FOREIGN KEY ("connectedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelEvent" ADD CONSTRAINT "ChannelEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelEvent" ADD CONSTRAINT "ChannelEvent_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelEvent" ADD CONSTRAINT "ChannelEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_aiRunId_fkey" FOREIGN KEY ("aiRunId") REFERENCES "AiRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationNote" ADD CONSTRAINT "ConversationNote_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationNote" ADD CONSTRAINT "ConversationNote_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationNote" ADD CONSTRAINT "ConversationNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuickReply" ADD CONSTRAINT "QuickReply_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiModel" ADD CONSTRAINT "AiModel_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "AiProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiRoute" ADD CONSTRAINT "AiRoute_primaryModelId_fkey" FOREIGN KEY ("primaryModelId") REFERENCES "AiModel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiRoute" ADD CONSTRAINT "AiRoute_fallbackModelId_fkey" FOREIGN KEY ("fallbackModelId") REFERENCES "AiModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiRoute" ADD CONSTRAINT "AiRoute_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditPricing" ADD CONSTRAINT "CreditPricing_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditPricing" ADD CONSTRAINT "CreditPricing_announcementCmsEntryId_fkey" FOREIGN KEY ("announcementCmsEntryId") REFERENCES "CmsEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentPresetVersion" ADD CONSTRAINT "AgentPresetVersion_presetId_fkey" FOREIGN KEY ("presetId") REFERENCES "AgentPreset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentPresetVersion" ADD CONSTRAINT "AgentPresetVersion_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "AiModel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_presetId_fkey" FOREIGN KEY ("presetId") REFERENCES "AgentPreset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_avatarUploadId_fkey" FOREIGN KEY ("avatarUploadId") REFERENCES "Upload"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentVersion" ADD CONSTRAINT "AgentVersion_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentVersion" ADD CONSTRAINT "AgentVersion_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentVersion" ADD CONSTRAINT "AgentVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentChannel" ADD CONSTRAINT "AgentChannel_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentChannel" ADD CONSTRAINT "AgentChannel_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentProduct" ADD CONSTRAINT "AgentProduct_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentProduct" ADD CONSTRAINT "AgentProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentInsight" ADD CONSTRAINT "AgentInsight_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentInsight" ADD CONSTRAINT "AgentInsight_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentInsight" ADD CONSTRAINT "AgentInsight_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentInsight" ADD CONSTRAINT "AgentInsight_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentInsight" ADD CONSTRAINT "AgentInsight_aiRunId_fkey" FOREIGN KEY ("aiRunId") REFERENCES "AiRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentInsight" ADD CONSTRAINT "AgentInsight_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiRun" ADD CONSTRAINT "AiRun_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiRun" ADD CONSTRAINT "AiRun_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiRun" ADD CONSTRAINT "AiRun_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiRun" ADD CONSTRAINT "AiRun_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "AiModel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiRun" ADD CONSTRAINT "AiRun_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "AiProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiToolCall" ADD CONSTRAINT "AiToolCall_aiRunId_fkey" FOREIGN KEY ("aiRunId") REFERENCES "AiRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentTestRun" ADD CONSTRAINT "AgentTestRun_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentTestRun" ADD CONSTRAINT "AgentTestRun_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentTestRun" ADD CONSTRAINT "AgentTestRun_aiRunId_fkey" FOREIGN KEY ("aiRunId") REFERENCES "AiRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentTestLink" ADD CONSTRAINT "AgentTestLink_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentTestLink" ADD CONSTRAINT "AgentTestLink_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentTestLink" ADD CONSTRAINT "AgentTestLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentFaq" ADD CONSTRAINT "AgentFaq_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentFaq" ADD CONSTRAINT "AgentFaq_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_imageUploadId_fkey" FOREIGN KEY ("imageUploadId") REFERENCES "Upload"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_baseUnitId_fkey" FOREIGN KEY ("baseUnitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_moderationItemId_fkey" FOREIGN KEY ("moderationItemId") REFERENCES "ModerationItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductExpense" ADD CONSTRAINT "ProductExpense_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductExpense" ADD CONSTRAINT "ProductExpense_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductExpense" ADD CONSTRAINT "ProductExpense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_recommendedId_fkey" FOREIGN KEY ("recommendedId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationEvent" ADD CONSTRAINT "RecommendationEvent_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "Recommendation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationEvent" ADD CONSTRAINT "RecommendationEvent_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationEvent" ADD CONSTRAINT "RecommendationEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_reversedByMovementId_fkey" FOREIGN KEY ("reversedByMovementId") REFERENCES "StockMovement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCount" ADD CONSTRAINT "InventoryCount_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCount" ADD CONSTRAINT "InventoryCount_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCount" ADD CONSTRAINT "InventoryCount_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCount" ADD CONSTRAINT "InventoryCount_validatedById_fkey" FOREIGN KEY ("validatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCountLine" ADD CONSTRAINT "InventoryCountLine_inventoryCountId_fkey" FOREIGN KEY ("inventoryCountId") REFERENCES "InventoryCount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCountLine" ADD CONSTRAINT "InventoryCountLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCountLine" ADD CONSTRAINT "InventoryCountLine_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCountLine" ADD CONSTRAINT "InventoryCountLine_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "StockMovement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockRecommendation" ADD CONSTRAINT "StockRecommendation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockRecommendation" ADD CONSTRAINT "StockRecommendation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockRecommendation" ADD CONSTRAINT "StockRecommendation_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockRecommendation" ADD CONSTRAINT "StockRecommendation_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockRecommendation" ADD CONSTRAINT "StockRecommendation_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockRecommendation" ADD CONSTRAINT "StockRecommendation_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockRecommendation" ADD CONSTRAINT "StockRecommendation_dismissedById_fkey" FOREIGN KEY ("dismissedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockRecommendationMute" ADD CONSTRAINT "StockRecommendationMute_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockRecommendationMute" ADD CONSTRAINT "StockRecommendationMute_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientAddress" ADD CONSTRAINT "ClientAddress_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientAddress" ADD CONSTRAINT "ClientAddress_wilayaId_fkey" FOREIGN KEY ("wilayaId") REFERENCES "Wilaya"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientAddress" ADD CONSTRAINT "ClientAddress_communeId_fkey" FOREIGN KEY ("communeId") REFERENCES "Commune"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientIdentity" ADD CONSTRAINT "ClientIdentity_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientIdentity" ADD CONSTRAINT "ClientIdentity_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_wilayaId_fkey" FOREIGN KEY ("wilayaId") REFERENCES "Wilaya"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_communeId_fkey" FOREIGN KEY ("communeId") REFERENCES "Commune"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderCall" ADD CONSTRAINT "OrderCall_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderCall" ADD CONSTRAINT "OrderCall_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderNote" ADD CONSTRAINT "OrderNote_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderNote" ADD CONSTRAINT "OrderNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentEntry" ADD CONSTRAINT "PaymentEntry_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentEntry" ADD CONSTRAINT "PaymentEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentEntry" ADD CONSTRAINT "PaymentEntry_cashTransactionId_fkey" FOREIGN KEY ("cashTransactionId") REFERENCES "CashTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderPayment" ADD CONSTRAINT "OrderPayment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderPayment" ADD CONSTRAINT "OrderPayment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commune" ADD CONSTRAINT "Commune_wilayaId_fkey" FOREIGN KEY ("wilayaId") REFERENCES "Wilaya"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourierCommuneMap" ADD CONSTRAINT "CourierCommuneMap_communeId_fkey" FOREIGN KEY ("communeId") REFERENCES "Commune"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourierStopdesk" ADD CONSTRAINT "CourierStopdesk_communeId_fkey" FOREIGN KEY ("communeId") REFERENCES "Commune"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryFeeRule" ADD CONSTRAINT "DeliveryFeeRule_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryFeeRule" ADD CONSTRAINT "DeliveryFeeRule_wilayaId_fkey" FOREIGN KEY ("wilayaId") REFERENCES "Wilaya"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourierAccount" ADD CONSTRAINT "CourierAccount_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourierAccount" ADD CONSTRAINT "CourierAccount_senderWilayaId_fkey" FOREIGN KEY ("senderWilayaId") REFERENCES "Wilaya"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourierRateCache" ADD CONSTRAINT "CourierRateCache_courierAccountId_fkey" FOREIGN KEY ("courierAccountId") REFERENCES "CourierAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourierRateCache" ADD CONSTRAINT "CourierRateCache_wilayaId_fkey" FOREIGN KEY ("wilayaId") REFERENCES "Wilaya"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_courierAccountId_fkey" FOREIGN KEY ("courierAccountId") REFERENCES "CourierAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentEvent" ADD CONSTRAINT "ShipmentEvent_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentEvent" ADD CONSTRAINT "ShipmentEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SheetsConnection" ADD CONSTRAINT "SheetsConnection_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SheetsRow" ADD CONSTRAINT "SheetsRow_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "SheetsConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SheetsRow" ADD CONSTRAINT "SheetsRow_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashTransaction" ADD CONSTRAINT "CashTransaction_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashTransaction" ADD CONSTRAINT "CashTransaction_closingId_fkey" FOREIGN KEY ("closingId") REFERENCES "CashClosing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashTransaction" ADD CONSTRAINT "CashTransaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashTransaction" ADD CONSTRAINT "CashTransaction_proofUploadId_fkey" FOREIGN KEY ("proofUploadId") REFERENCES "Upload"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashTransaction" ADD CONSTRAINT "CashTransaction_correctsTransactionId_fkey" FOREIGN KEY ("correctsTransactionId") REFERENCES "CashTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashClosing" ADD CONSTRAINT "CashClosing_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashClosing" ADD CONSTRAINT "CashClosing_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashClosing" ADD CONSTRAINT "CashClosing_reopenedById_fkey" FOREIGN KEY ("reopenedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEndpoint" ADD CONSTRAINT "WebhookEndpoint_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEndpoint" ADD CONSTRAINT "WebhookEndpoint_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "WebhookEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_replayOfId_fkey" FOREIGN KEY ("replayOfId") REFERENCES "WebhookDelivery"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyStat" ADD CONSTRAINT "DailyStat_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportSchedule" ADD CONSTRAINT "ReportSchedule_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportSchedule" ADD CONSTRAINT "ReportSchedule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_resultUploadId_fkey" FOREIGN KEY ("resultUploadId") REFERENCES "Upload"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_impersonationSessionId_fkey" FOREIGN KEY ("impersonationSessionId") REFERENCES "ImpersonationSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Counter" ADD CONSTRAINT "Counter_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedView" ADD CONSTRAINT "SavedView_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedView" ADD CONSTRAINT "SavedView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedView" ADD CONSTRAINT "SavedView_sharedById_fkey" FOREIGN KEY ("sharedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationItem" ADD CONSTRAINT "ModerationItem_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationItem" ADD CONSTRAINT "ModerationItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationItem" ADD CONSTRAINT "ModerationItem_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationItem" ADD CONSTRAINT "ModerationItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationItem" ADD CONSTRAINT "ModerationItem_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationItem" ADD CONSTRAINT "ModerationItem_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationAppeal" ADD CONSTRAINT "ModerationAppeal_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationAppeal" ADD CONSTRAINT "ModerationAppeal_moderationItemId_fkey" FOREIGN KEY ("moderationItemId") REFERENCES "ModerationItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationAppeal" ADD CONSTRAINT "ModerationAppeal_attachmentUploadId_fkey" FOREIGN KEY ("attachmentUploadId") REFERENCES "Upload"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationAppeal" ADD CONSTRAINT "ModerationAppeal_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationAppeal" ADD CONSTRAINT "ModerationAppeal_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationRule" ADD CONSTRAINT "ModerationRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationRule" ADD CONSTRAINT "ModerationRule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_targetWorkspaceId_fkey" FOREIGN KEY ("targetWorkspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterUserId_fkey" FOREIGN KEY ("reporterUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_aiRunId_fkey" FOREIGN KEY ("aiRunId") REFERENCES "AiRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerBlock" ADD CONSTRAINT "CustomerBlock_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerBlock" ADD CONSTRAINT "CustomerBlock_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerBlock" ADD CONSTRAINT "CustomerBlock_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerBlock" ADD CONSTRAINT "CustomerBlock_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerBlock" ADD CONSTRAINT "CustomerBlock_blockedById_fkey" FOREIGN KEY ("blockedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerBlock" ADD CONSTRAINT "CustomerBlock_unblockedById_fkey" FOREIGN KEY ("unblockedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformBlacklist" ADD CONSTRAINT "PlatformBlacklist_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformBlacklist" ADD CONSTRAINT "PlatformBlacklist_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformBlacklist" ADD CONSTRAINT "PlatformBlacklist_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockedWord" ADD CONSTRAINT "BlockedWord_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockedWord" ADD CONSTRAINT "BlockedWord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CannedReply" ADD CONSTRAINT "CannedReply_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountDeletionRequest" ADD CONSTRAINT "AccountDeletionRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountDeletionRequest" ADD CONSTRAINT "AccountDeletionRequest_exportJobId_fkey" FOREIGN KEY ("exportJobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountDeletionRequest" ADD CONSTRAINT "AccountDeletionRequest_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpersonationSession" ADD CONSTRAINT "ImpersonationSession_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpersonationSession" ADD CONSTRAINT "ImpersonationSession_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpersonationSession" ADD CONSTRAINT "ImpersonationSession_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppVersion" ADD CONSTRAINT "AppVersion_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureFlag" ADD CONSTRAINT "FeatureFlag_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureFlagOverride" ADD CONSTRAINT "FeatureFlagOverride_flagId_fkey" FOREIGN KEY ("flagId") REFERENCES "FeatureFlag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureFlagOverride" ADD CONSTRAINT "FeatureFlagOverride_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalDocument" ADD CONSTRAINT "LegalDocument_cmsEntryId_fkey" FOREIGN KEY ("cmsEntryId") REFERENCES "CmsEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalDocument" ADD CONSTRAINT "LegalDocument_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformSetting" ADD CONSTRAINT "PlatformSetting_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformSettingVersion" ADD CONSTRAINT "PlatformSettingVersion_settingId_fkey" FOREIGN KEY ("settingId") REFERENCES "PlatformSetting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformSettingVersion" ADD CONSTRAINT "PlatformSettingVersion_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_bannerCmsEntryId_fkey" FOREIGN KEY ("bannerCmsEntryId") REFERENCES "CmsEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentUpdate" ADD CONSTRAINT "IncidentUpdate_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentUpdate" ADD CONSTRAINT "IncidentUpdate_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CmsEntry" ADD CONSTRAINT "CmsEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CmsEntryLocale" ADD CONSTRAINT "CmsEntryLocale_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "CmsEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CmsEntryLocale" ADD CONSTRAINT "CmsEntryLocale_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CmsEntryVersion" ADD CONSTRAINT "CmsEntryVersion_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "CmsEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CmsEntryVersion" ADD CONSTRAINT "CmsEntryVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
