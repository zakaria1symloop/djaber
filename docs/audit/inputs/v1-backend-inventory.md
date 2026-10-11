# V1 backend inventory (verified against code, 2026-10-05)

Source: `E:\Dev App\djaber\backend\src`. Citations are `file:line`. No secret files were opened.

## Key facts that differ from the v2 specs' assumptions

1. Chargily webhook: `validateWebhookSignature` exists (`services/chargily.service.ts:118-122`) but is never called; `POST /api/payments/chargily-webhook` (`server.ts:209-231`) trusts `data.status` and `data.metadata.user_id/plan_slug` from the body. `GET /api/payments/verify/:checkoutId` (`server.ts:234-256`) has no ownership check and can be replayed; each run creates a new Subscription and resets `creditsUsed: 0` (`chargily.service.ts:145-166`).
2. Meta webhook `POST /api/webhooks/meta` (`controllers/webhook.controller.ts:157-198`) never verifies `X-Hub-Signature-256`. Only the data-deletion callback checks an HMAC (`:100-112`).
3. Page access tokens stored plaintext (`controllers/pages.controller.ts:191,204`); AES-256-GCM (`utils/encryption.ts`) is only used for delivery-provider credentials. AI provider keys plaintext (`schema.prisma:668`).
4. Plan limits never enforced; only `AGENT_LIMIT = 1` hardcoded (`user-agents.controller.ts:10,128-130`).
5. No rate limiting anywhere; `RATE_LIMITED` code exists (`errors/catalog.core.ts:42`) unused.
6. Credits are only consumed for webhook AI replies (`webhook.controller.ts:531,773`). NOT charged: page analysis, agent generation, test playground. `AI_ORDER_CREATED:2` is defined (`credits.service.ts:4-9`) but never charged. Check (`hasCredits`, before batching) and consume (after LLM) are not atomic. Monthly reset is calendar-month, lazy (`:22-33`). `monthlyCredits = -1` not handled by `hasCredits`. No top-up feature.
7. OAuth `state` = raw userId (`pages.controller.ts:229,466`), no nonce.
8. Plan values: register/admin accept only `individual|teams` (`auth.controller.ts:25`, `admin.controller.ts:7,402`); subscriptions/Chargily set any slug (`admin.controller.ts:888-891`, `chargily.service.ts:161`). Admin-created subscriptions don't sync `creditsLimit`.
9. "Credits exhausted" notification created with `type:'stock_alert'` (`webhook.controller.ts:553-559`); customer reply hardcoded French (`:534`). No low-stock notification producer exists.

## Auth (`controllers/auth.controller.ts`, `routes/auth.routes.ts`)
- Register: firstName/lastName ≤80 required, email, password 8–128 (no complexity), plan `individual|teams` default individual. `AUTH_EMAIL_TAKEN`. bcrypt cost 10. Returns `{token,user{id,email,firstName,lastName,plan}}`.
- Login: `AUTH_INVALID_CREDENTIALS` for both unknown email and wrong password; returns `isAdmin`.
- JWT `{userId,email}`, 30 days, no refresh, no revocation; password reset doesn't invalidate JWTs.
- Forgot password: `MAIL_NOT_CONFIGURED` if no SMTP; always 200 otherwise; 60 s cooldown; token 32 random bytes hex, SHA-256 stored; older tokens deleted; TTL 60 min; link `${APP_URL}/reset-password?token=`; email lang from `resolveLang`.
- Verify token `GET /reset-password/:token` (`^[a-f0-9]{64}$`): `AUTH_RESET_TOKEN_INVALID|EXPIRED`.
- Reset: transaction burns token (`updateMany usedAt:null`), updates password, deletes other tokens; returns new JWT.
- Profile GET only: `id,email,firstName,lastName,plan,isAdmin,creditsUsed,creditsLimit,createdAt`. No user profile update. No delete account (only admin delete + Meta data deletion).
- Middleware: `authenticate` (UNAUTHORIZED / INVALID_TOKEN, doesn't check user still exists); `requireAdmin` (DB lookup each request, ADMIN_REQUIRED).

## Pages / channels (`controllers/pages.controller.ts`)
- FB OAuth start `GET /connect/facebook`, scopes `pages_show_list,pages_manage_metadata,pages_messaging,pages_read_engagement`; Graph v18.0. Missing scopes for things used later: page posts, IG media/messages, business_management.
- FB callback: **no page selection** — every page from `/me/accounts` auto-connected (100/call, cap 200, 6 parallel). Skips: no access_token (`PAGE_ACCESS_TOKEN_MISSING`), tasks lacking MESSAGING|MANAGE|MODERATE (`PAGE_MESSAGING_PERMISSION_MISSING`), owned by another user (`PAGE_ALREADY_CONNECTED_ELSEWHERE`). Subscribes `messages,messaging_postbacks`; failure → status `warning` `PAGE_WEBHOOK_SUBSCRIBE_FAILED`. Postbacks subscribed but handler drops events without `message` (`webhook.controller.ts:246`).
- Linked IG: reads `instagram_business_account{id,name,username,profile_picture_url}`, stores as its own Page row (platform instagram) with the **FB page token**.
- Result via `postMessage` (`facebook-oauth-success|error`, `results[{pageId,pageName,status:connected|skipped|warning,code,message}]`) or redirect `/dashboard?section=pages`.
- IG Business Login: scopes `instagram_business_basic,instagram_business_manage_messages`; short→long-lived token (`ig_exchange_token`), fallback short; profile from `graph.instagram.com/v21.0/me`; failure → `PAGE_INSTAGRAM_PENDING_APPROVAL`; IGSID stored as pageId; subscribes `messages`. **Long-lived IG tokens (~60 d) are never refreshed** (no cron).
- `GET /api/pages` → active pages `{id,platform,pageId,pageName,pageAvatar,isActive,createdAt}`.
- Disconnect = soft (`isActive:false`); doesn't unsubscribe webhook, clear token, or remove AgentPage; webhook ignores inactive pages.

## Page config / inbox (`controllers/page-config.controller.ts`)
- Enums: conversation status `active|resolved|archived` (list filter default `active`); message type `all|incoming|outgoing`; AI personality `professional|friendly|casual|technical`; tone `balanced|formal|casual|enthusiastic`; length `short|medium|detailed`. Limits: reply ≤2000, customInstructions ≤4000, businessSummary ≤600.
- Insights `GET /:pageId/insights`: metrics `page_followers_count,page_impressions,page_engaged_users,page_post_engagements` period day (some deprecated by Meta) → `INBOX_INSIGHTS_UNAVAILABLE` on failure; also called for IG pages.
- Conversations list: filter status, limit 50 (max 200), offset; returns `id,senderId,senderName,status,aiPaused,platform,lastMessage{text,timestamp,isFromPage},createdAt,updatedAt,total`. No search/unread/date filter.
- Messages `GET /:pageId/messages`: dateFrom, dateTo, type. Conversation messages: last 200 incl. attachmentType/Url.
- `PATCH /conversations/:id`: **only `status`**; `aiPaused` not settable directly; status `active` clears `aiPaused`.
- Reply: text only ≤2000; FB retries with `MESSAGE_TAG`/`HUMAN_AGENT` on error 10/2018278 → else `REPLY_OUTSIDE_WINDOW`; IG has no retry. **Manual reply does not pause AI.**
- Sync: FB imports 25 conv × 25 msgs; IG via FB page `?platform=instagram` (fails for IG-Login tokens → zeros); upsert by (platform,pageId,senderId); first attachment only; IG attachments always `[]`; token errors → `PAGE_SYNC_TOKEN_EXPIRED`.
- Analyze `POST /:pageId/analyze?limit=1..50` (default 30): synchronous, no job state; FB `/posts` (needs un-requested permission → `PAGE_ANALYSIS_PERMISSION_REQUIRED`) or IG `/media`; per post: download image, re-host (GCS or local — even for non-products), `gpt-4o-mini` vision JSON `{isProduct,name,description,priceDA,category}` max_tokens 300; dedup by name; returns `{pageName,pageId,scanned,extracted,warning}`. No credits.
- Import products: `items[{name≤120,priceDA>0}]` → Product SKU `FB-…`, unit piece, qty 0, one ProductImage. No maxProducts check.
- Summary: conversations total/active/resolved/archived/unread; messages 7d/24h/in7d/out7d; products = **all** user's active products; agent from AgentPage else PageAISettings; `autoReply` mirrors `agent.isActive`; lastActivity, pictureUrl.
- Generate agent: 25 conv × 10 msgs, 12k chars cap, `gpt-4o-mini` JSON; returns `{personality,responseTone,responseLength,customInstructions,businessSummary,languages,topQuestions,sampledMessages,sampledConversations,warning}`; DEFAULT_AGENT fallback. No credits.
- Apply agent: updates user's first Agent or creates (`aiModel:'gpt-4'`, sellAllProducts true); prepends tone/length/personality text; length → maxTokens 400/800/1500; relinks AgentPage; mirrors to PageAISettings. Applying to a second page overwrites the single shared agent.
- PageAISettings (legacy): aiEnabled, aiPersonality, customInstructions, autoReply, responseTone, responseLength.

## Meta service (`services/meta.service.ts`)
- Text send `/me/messages`; FB Graph v18 token as query param; IG `graph.instagram.com/v21.0` Bearer.
- Image attachment `{type:'image',payload:{url,is_reusable:true}}` http URLs only.
- **Product cards are NOT generic templates**: each card = image + text "🛍 title\n💰 subtitle", max 5. No quick replies, buttons, templates.
- Sender actions `mark_seen|typing_on|typing_off` best-effort 5 s timeout; `typing_on` used by webhook.
- Default sends have no `messaging_type`; `MESSAGE_TAG`+`HUMAN_AGENT` only on retry after 10/2018278 — AI auto-replies also go through this path (policy risk).
- Errors: `MetaMessagingError{fbCode,fbSubcode,outsideWindow}`, `MetaPermissionError`. No retry/backoff/rate-limit handling; no token-expiry (190) handling on sends.
- IG sync via FB page; IG media via `graph.facebook.com/{igUserId}/media` (fails for IG-Login tokens). `verifyWebhook` compares `META_VERIFY_TOKEN`.

## Agents (`controllers/user-agents.controller.ts`, `/api/user-stock/agents`)
- Create fields: name ≤100 req, description ≤1000, personality (4, default professional), customInstructions ≤10000, productTemplate/closingInstructions/humanHandoffRules ≤5000, imageRecognition (false), voiceTranscription (false), responseDelay 0–60 (3), aiModel ≤100 (default `gpt-4`, not validated), temperature 0–2 (0.7), maxTokens 1–8000 (1000), sellAllProducts (true), pageIds[], productIds[].
- `AGENT_LIMIT=1` → `PLAN_LIMIT_REACHED{limit:1,item:'agent'}`. Creating with pageIds silently steals pages from other agents; P2002 → `AGENT_PAGE_ALREADY_ASSIGNED`.
- Update: same + isActive; replaces links in transaction. Delete: hard; removes AgentPage/AgentProduct/AgentInsight; conversations keep agentId null.
- Test: `message ≤4000`, `history[]`; `dryRun:true` — create/cancel order stubs, `get_shipping_fee` real. No credits. Returns raw `{response}` with tags.
- Metrics: conversationCount, totalMessages, messagesFromCustomers, messagesFromAgent, ordersCreated (source ai via client's conversations), insightsPending, insightsResolved (resolved+dismissed), lastActiveDate.
- Insights: list by status; resolve `action resolve|dismiss` + optional `newInstruction ≤2000` appended as `- …` to customInstructions. Types written: `unclear|unknown_topic|handoff`.

## Admin (`controllers/admin.controller.ts`, `ai-providers.controller.ts`)
- Analytics `?period=today|week|month|year`: totalUsers, newUsersInPeriod, adminCount, totalPages, totalProducts, totalSales, totalRevenue, totalPurchases, totalSpent, activeAgents, totalConversations, messagesInPeriod; pagesByPlatform, planBreakdown, recentSignups(5). No MRR/credits/AI cost.
- Users list filters: search, plan, role, startDate, endDate, sortBy, sortOrder, min/maxPages, min/maxProducts, min/maxRevenue, minConversations, activity=with-pages|with-agents|inactive; returns counts {pages,agents,conversations,products,sales,orders,clients}, _revenue. Post-filters break `total`. No credits fields.
- User detail: user, pages, agents, stats{products,sales,revenue,purchases,spent,orders,clients,conversations,messages}, 10 recent conversations. No credits/subscription.
- Update user: isAdmin, plan (`individual|teams` only), firstName, lastName, password. Credits not editable. `ADMIN_CANNOT_DEMOTE_SELF`.
- Delete user: hard; Product/Sale/Order/Client/Subscription rows orphaned (plain userId strings).
- Plans: slug, name, description, priceMonthly, priceYearly, currency (`DA`), maxPages(1), maxAgents(1), maxProducts(50), maxConversations(100), maxTeamMembers(1), monthlyCredits(500, -1 unlimited), features[] JSON, isActive, isFeatured, sortOrder, chargily ids. Delete blocked if in use (`PLAN_IN_USE`). subscriberCount from user.plan.
- Subscriptions: statuses `active|cancelled|expired|trial`; cycles monthly|yearly; fields userId, planSlug, billingCycle, status, startDate, endDate(+1/+12 months), notes, chargily ids, cancelledAt. One active per user (`SUBSCRIPTION_ALREADY_ACTIVE`) — not applied in Chargily path. Syncs user.plan, not credits. **No expiry cron.**
- Conversations viewer filters: search, platform, status, userId, pageId, agentId, minMessages, startDate, endDate; detail 200 msgs. Products viewer filters: search, lowStock, userId, categoryId, isActive, min/maxPrice, min/maxStock, hasImage; adds owner, isLowStock. Lookups: categories/pages/agents (500 max).
- CMS: slug kebab-case, title ≤200, category company|legal, content HTML (unsanitized), isPublished, sortOrder; upsert by slug; **no locale**. Public GET only published.
- Admin profile: firstName, lastName, password (needs currentPassword).
- AI providers: `openai|anthropic|google|groq`; GET masks to last 8; PUT apiKey/isActive/models[]; test lists models (Anthropic: 1-token ping + static list) and overwrites stored models; errors `AI_PROVIDER_KEY_REJECTED|RATE_LIMITED|UNREACHABLE|TEST_UNSUPPORTED|NO_KEY|NOT_FOUND`. Public `GET /api/user-stock/ai-providers/active`. **No pricing calculator, no impersonation, no audit log in backend.**

## Notifications / push / email
- Types created: `ai_order` ("New AI Order", "Cancellation Needs Human Review", "Order Cancelled by Customer" — `ai.service.ts:917-931,1131-1143,1170-1182`); `agent_insight` ("Agent Couldn't Understand", "Unknown Question Detected", "Human Intervention Requested"; metadata type unclear|unknown|handoff); `stock_alert` (only for "Credits Exhausted"); `delivery_sent` ("Order Sent to Delivery", `user-delivery.controller.ts:402-413`); push-only `paused_message` when a customer writes into an AI-paused conversation (`webhook.controller.ts:457-465`). All titles hardcoded English.
- API `/api/user-stock/notifications`: list (type, isRead, limit 20 max 100), unread count, read-all, read one. No delete.
- Push: Expo API, ≤20 devices/user, removes `DeviceNotRegistered`; every createNotification also pushes. Devices: token regex `^Expo(nent)?PushToken\[…\]$`, platform android|ios, upsert by token, max 20.
- Email: nodemailer SMTP env; only password-reset template (en/fr/ar, RTL). No other emails.
- i18n: `en|fr|ar` from `?lang` → `X-Lang` → `Accept-Language`.

## Transcription (`services/transcription.service.ts`)
- Groq `whisper-large-v3-turbo` if Groq key, else OpenAI `whisper-1`; no runtime fallback (returns null on failure). `languageHint` exists but never passed. Audio ≤25 MB, 30 s download timeout, 60 s Whisper timeout. Only when `agent.voiceTranscription`; otherwise hardcoded English "Sorry, I can't process voice messages yet…" (`webhook.controller.ts:498-518`).

## server.ts
- Routes: `/api/auth`, `/api/webhooks`, `/api/pages` (2 routers), `/api/stock`, `/api/user-stock`, `/api/admin`, `/api/devices`; inline payments checkout/webhook/verify, `/api/plans`, `/api/credits`, `/api/cms/:slug`; `/health`, `/api`, robots, privacy/terms html, Swagger `/api/docs`.
- CORS: FRONTEND_URL list + **any `*.vercel.app`** + localhost, credentials true.
- No rate limiter, helmet, cron. Startup seeds default units only.
- Checkout: `planSlug`, `billingCycle monthly|yearly`; `PLAN_NOT_FOUND`, `PLAN_IS_FREE`; Chargily v2 `/checkouts` amount, `currency:'dzd'`, success/failure `/dashboard?section=settings&payment=success|failed`; metadata `{user_id,plan_slug,billing_cycle,type:'subscription',customer_name,customer_email}`; `CHARGILY_MODE` default test.
- Activation creates a new subscription every time, no dedup, no amount check; sets user.plan, creditsLimit, creditsUsed 0.
