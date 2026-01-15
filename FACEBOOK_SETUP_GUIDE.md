# Facebook & Instagram Integration Setup Guide

This guide will walk you through setting up Facebook and Instagram integration for Djaber.ai.

---

## Prerequisites

- Facebook account (personal or business)
- A Facebook Page (you'll need to create one if you don't have it)
- Business verification (optional but recommended for production)

---

## Step 1: Create a Facebook App

1. **Go to Facebook Developers**
   - Visit: https://developers.facebook.com/
   - Click "Get Started" or "My Apps" (top right)
   - Log in with your Facebook account

2. **Create New App**
   - Click "Create App" button
   - Choose app type: **"Business"**
   - Click "Next"

3. **App Details**
   - Display name: `Djaber.ai` (or your preferred name)
   - App contact email: Your email
   - Business Account: Select or create one
   - Click "Create App"

4. **Complete Security Check**
   - Complete the CAPTCHA verification

---

## Step 2: Configure App Settings

1. **Basic Settings** (Settings > Basic)
   - App ID: Copy this (you'll need it)
   - App Secret: Click "Show" and copy this (you'll need it)
   - App Domains: Add `localhost` (for testing)
   - Privacy Policy URL: `http://localhost:3000/privacy` (for now)
   - Terms of Service URL: `http://localhost:3000/terms` (for now)
   - Click "Save Changes"

2. **Update Your .env File**
   ```bash
   # In backend/.env
   META_APP_ID=your_app_id_here
   META_APP_SECRET=your_app_secret_here
   ```

---

## Step 3: Add Facebook Login Product

1. **Add Product**
   - In left sidebar, click "+ Add Product"
   - Find "Facebook Login" and click "Set Up"

2. **Configure Facebook Login**
   - Choose "Web" as platform
   - Site URL: `http://localhost:3000`
   - Click "Save" and "Continue"

3. **Facebook Login Settings** (Products > Facebook Login > Settings)
   - Valid OAuth Redirect URIs:
     ```
     http://localhost:3000/api/auth/facebook/callback
     http://localhost:3000/dashboard
     ```
   - Login from Devices: **Enable**
   - Click "Save Changes"

---

## Step 4: Add Messenger Product (for Facebook Pages)

1. **Add Messenger**
   - In left sidebar, click "+ Add Product"
   - Find "Messenger" and click "Set Up"

2. **Configure Messenger**
   - Go to Products > Messenger > Settings
   - In "Access Tokens" section:
     - Click "Add or Remove Pages"
     - Select your Facebook Page
     - Grant all permissions requested
     - Copy the "Page Access Token" (save this!)

3. **Webhook Setup** (We'll configure this later)
   - For now, note that you'll need a public URL
   - We'll use ngrok for testing

---

## Step 5: Request Permissions

Your app needs specific permissions to work:

### Required Permissions:

1. **Go to App Review > Permissions and Features**
   - Search and request these permissions:
     - `pages_show_list` - Read list of pages
     - `pages_read_engagement` - Read page content
     - `pages_manage_metadata` - Manage page metadata
     - `pages_messaging` - Send/receive messages

2. **For Testing (Development Mode)**
   - Add yourself as a Test User or Admin
   - Go to "Roles" > "Roles" in left sidebar
   - Add your Facebook account as Administrator or Tester

---

## Step 6: Set Up Webhooks with ngrok

Since Facebook needs a public URL, we'll use ngrok for testing:

### Install ngrok

**Windows:**
```bash
# Download from https://ngrok.com/download
# Or use chocolatey
choco install ngrok
```

**Mac/Linux:**
```bash
brew install ngrok
```

### Start ngrok

1. **Authenticate ngrok** (get token from https://dashboard.ngrok.com)
   ```bash
   ngrok config add-authtoken YOUR_TOKEN
   ```

2. **Start tunnel to your backend**
   ```bash
   ngrok http 5000
   ```

3. **Copy the HTTPS URL** (looks like: `https://abc123.ngrok.io`)

### Configure Webhook in Facebook

1. **Go to Products > Messenger > Settings**

2. **In Webhooks section:**
   - Click "Add Callback URL"
   - Callback URL: `https://YOUR-NGROK-URL.ngrok.io/api/webhooks/meta`
   - Verify Token: Use the same token from your `.env` file (`META_VERIFY_TOKEN`)
   - Click "Verify and Save"

3. **Subscribe to Webhook Fields:**
   - Check these fields:
     - `messages`
     - `messaging_postbacks`
     - `message_deliveries`
     - `message_reads`
   - Click "Subscribe"

4. **Subscribe Your Page to Webhook:**
   - In "Webhooks" section
   - Find your page and click "Subscribe"

---

## Step 7: Update Backend Environment Variables

Make sure your `backend/.env` has all these values:

```bash
# Server Configuration
PORT=5000
NODE_ENV=development

# Database
DATABASE_URL="mysql://root:mysql@localhost:3306/djaber"

# JWT Secret
JWT_SECRET=djaber-secret-key-change-in-production-2026
JWT_EXPIRE=7d

# Meta/Facebook API
META_APP_ID=YOUR_APP_ID_HERE
META_APP_SECRET=YOUR_APP_SECRET_HERE
META_VERIFY_TOKEN=djaber_webhook_verify_token

# OpenAI API
OPENAI_API_KEY=your-openai-api-key-here

# Anthropic Claude API (Optional)
ANTHROPIC_API_KEY=your-anthropic-api-key-here

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000

# Webhook URL (your ngrok URL)
WEBHOOK_URL=https://YOUR-NGROK-URL.ngrok.io/api/webhooks/meta
```

---

## Step 8: Test the Integration

### Testing Checklist:

1. **Webhook Verification**
   - Check ngrok terminal to see if Facebook verified your webhook
   - Should see GET request to `/api/webhooks/meta`

2. **Send Test Message**
   - Go to your Facebook Page
   - Send a message to the page (from another account or Facebook's test tools)
   - Check backend logs to see if webhook received the message

3. **OAuth Flow Test**
   - Click "Connect Page" in dashboard
   - Should redirect to Facebook login
   - Grant permissions
   - Should redirect back with page access token

---

## Important URLs

- **Facebook Developers Console:** https://developers.facebook.com/apps/
- **Test Your Webhook:** https://developers.facebook.com/tools/webhooks/
- **Graph API Explorer:** https://developers.facebook.com/tools/explorer/
- **ngrok Dashboard:** https://dashboard.ngrok.com/

---

## Common Issues & Solutions

### Issue: Webhook verification fails
**Solution:**
- Make sure `META_VERIFY_TOKEN` in .env matches what you entered in Facebook
- Ensure backend is running and ngrok tunnel is active
- Check backend logs for errors

### Issue: "This app is in Development Mode"
**Solution:**
- For testing, add yourself as a Test User or Admin in "Roles"
- For production, you need to submit app for review

### Issue: Can't send messages
**Solution:**
- Make sure you've subscribed your page to webhook
- Check that you have `pages_messaging` permission
- Verify page access token is valid

### Issue: No messages received
**Solution:**
- Check ngrok is running and URL is correct in Facebook webhook settings
- Verify webhook is subscribed to `messages` field
- Check backend logs for errors

---

## Production Deployment Notes

When deploying to production:

1. **Replace ngrok URL** with your actual domain (e.g., `https://api.djaber.ai`)
2. **Update Facebook App Settings:**
   - Add your production domain to App Domains
   - Update OAuth Redirect URIs
   - Update Webhook URL
3. **Submit for App Review:**
   - Submit required permissions for review
   - Provide screencast demo
   - Wait for approval (usually 3-7 days)
4. **Switch App to Live Mode**
5. **Update Environment Variables** on your server

---

## Next Steps

After setting up Facebook:

1. Test the OAuth flow in your app
2. Connect a page
3. Send a test message to your page
4. Verify AI responds correctly
5. Configure AI settings (personality, business context)
6. Monitor conversations in dashboard

---

## Support

If you encounter issues:
- Check Facebook's official documentation
- Review webhook logs in ngrok/backend
- Test using Facebook's Graph API Explorer
- Ask in Djaber.ai support (coming soon)

---

**Last Updated:** 2026-01-15
