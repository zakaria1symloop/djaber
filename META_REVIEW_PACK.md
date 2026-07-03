# Meta App Review Pack — Djaber.ai

> Everything you need to submit the Facebook + Instagram review from the
> [Meta App Dashboard](https://developers.facebook.com/apps/1885150502208265).
> Copy-paste the justifications below into each permission's review form.

---

## 1. App settings (Settings → Basic)

| Field | Value |
|---|---|
| Privacy Policy URL | `https://djaber.72-60-190-211.sslip.io/privacy-policy.html` |
| Terms of Service URL | `https://djaber.72-60-190-211.sslip.io/terms-of-service.html` |
| **Data Deletion Callback URL** | `https://djaber.72-60-190-211.sslip.io/api/webhooks/meta/data-deletion` |
| (or) Data Deletion Instructions URL | `https://djaber.vercel.app/data-deletion` |
| Category | Business and Pages |
| App icon | 1024×1024 required — upload your logo |

## 2. Webhooks (Messenger → Settings)

| Field | Value |
|---|---|
| Callback URL | `https://djaber.72-60-190-211.sslip.io/api/webhooks/meta` |
| Verify token | value of `META_VERIFY_TOKEN` in the VPS `/opt/djaber/backend/.env` |
| Subscribed fields | `messages`, `messaging_postbacks` |

## 3. Permissions to request (App Review → Permissions and Features)

### Facebook (used by the "Connect Facebook" OAuth flow)

**`pages_show_list`**
> Djaber.ai lets small merchants connect their own Facebook Page so an AI
> assistant can answer their customers. We use pages_show_list only to display
> the list of Pages the merchant manages so they can pick which Page to
> connect during onboarding.

**`pages_messaging`**
> Core functionality: after a merchant connects their Page, our AI assistant
> replies to customer messages in Messenger on the merchant's behalf (product
> questions, delivery quotes, order placement). Messages are only sent in
> response to a customer-initiated conversation, within the standard messaging
> window.

**`pages_manage_metadata`**
> Used once at connection time to subscribe the merchant's Page to our
> webhook (messages, messaging_postbacks) so we can receive customer messages
> and reply. No other Page settings are read or modified.

**`pages_read_engagement`**
> Used to read the Page's own published posts so our onboarding wizard can
> suggest a product catalog extracted from the merchant's existing posts, and
> to show the Page name/picture in the merchant dashboard.

### Instagram (used by the "Connect Instagram" flow — Instagram Professional Login)

**`instagram_business_basic`**
> Read the connected Instagram professional account's id and username so the
> merchant can identify the account in their dashboard.

**`instagram_business_manage_messages`**
> Core functionality: receive Instagram Direct messages from the merchant's
> customers via webhook and let the merchant's AI assistant reply to them
> (same assistant as Messenger).

## 4. Reviewer test instructions (paste into "Testing Instructions")

> 1. Log in at https://djaber.vercel.app/login with the test credentials
>    provided below.
> 2. Go to Dashboard → Social Media and click "Connect Facebook". Grant the
>    requested permissions with your test Page and pick a Page.
> 3. From a separate Facebook account, send a message to that Page (e.g.
>    "what products do you have?").
> 4. Within a few seconds the AI assistant replies in Messenger with product
>    information from the merchant's catalog. Ask "how much is delivery to
>    Algiers?" to see a delivery quote; say you want to buy to see the order
>    flow.
> 5. In the dashboard Inbox (Dashboard → Inbox) the reviewer can see the
>    conversation and reply manually as well.
>
> Test credentials: create a fresh account at /signup, or use:
> email: <fill in a test account you create for Meta>
> password: <fill in>

⚠️ Create a DEDICATED test account for Meta (do not hand them a@a.com).

## 5. Screencast (required for pages_messaging / instagram messages)

Record 2–3 minutes showing: login → Connect Facebook (OAuth dialog) → customer
sends message on Messenger → AI answers → Inbox shows the conversation →
manual reply. Tools: OBS or Loom; upload as the review screencast.

## 6. Pre-submission checklist

- [x] Privacy policy URL live (200)
- [x] Terms URL live (200)
- [x] Data deletion callback implemented + status page
- [x] /data-deletion public instructions page
- [x] Webhook verified and receiving events (production traffic confirmed)
- [ ] App icon 1024×1024 uploaded
- [ ] App switched from Development to **Live** mode
- [ ] Business verification completed (Meta Business Manager — needed for
      advanced access to messaging permissions)
- [ ] Dedicated Meta test user credentials filled into section 4
- [ ] Screencast recorded and attached

## Notes

- The app currently works in Development Mode for pages you admin (that's why
  the connected pages already function without review). Review + Live mode is
  what lets ANY merchant connect their own page.
- `instagram_business_manage_messages` requires the Instagram account to be
  Professional (Business/Creator) and linked to the app via Instagram login —
  the "Connect Instagram" button implements this flow.
