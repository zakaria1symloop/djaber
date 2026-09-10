import { Request, Response } from 'express';
import axios from 'axios';
import prisma from '../config/database';
import { fail, handleError, resolveLang, translate, type ErrorCode } from '../errors';

const DEFAULT_BACKEND_URL = 'https://djaberio.symloop.com';
const ID_RE = /^[0-9a-fA-F-]{8,64}$/;

function frontendUrlOf(): string {
  return (process.env.FRONTEND_URL || 'http://localhost:5175').split(',')[0].trim();
}

/**
 * Finish an OAuth flow that may have run in a popup OR a full-page redirect
 * (popup-blocker fallback). Posts the result to the opener when present,
 * otherwise sends the browser back to the dashboard. Payload is JSON-encoded
 * (never string-interpolated) so query-derived errors can't inject script.
 */
function sendOAuthPopupResult(
  res: Response,
  frontendUrl: string,
  payload: Record<string, unknown>,
  humanMessage: string
): void {
  const returnUrl = `${frontendUrl}/dashboard?section=pages`;
  res.send(`
    <html>
      <body style="font-family:sans-serif;background:#09090b;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;padding:0 24px">
        <script>
          (function () {
            var payload = ${JSON.stringify(payload)};
            if (window.opener) {
              try { window.opener.postMessage(payload, ${JSON.stringify(frontendUrl)}); } catch (e) {}
              window.close();
            } else {
              window.location.replace(${JSON.stringify(returnUrl)});
            }
          })();
        </script>
        <p>${humanMessage}</p>
      </body>
    </html>
  `);
}

/**
 * OAuth callback failure: same popup/redirect mechanics, but the payload carries
 * a stable `code` and the human text is translated for the caller's language.
 */
function sendOAuthError(
  req: Request,
  res: Response,
  platform: 'facebook' | 'instagram',
  code: ErrorCode,
  extra: Record<string, unknown> = {}
): void {
  const message = translate(resolveLang(req), code);
  sendOAuthPopupResult(
    res,
    frontendUrlOf(),
    { type: `${platform}-oauth-error`, code, error: message, ...extra },
    `${message} Returning to Djaber…`
  );
}

/**
 * The OAuth `state` is the id of the user who started the flow. Make sure it
 * is a real user before saving pages under it (else Prisma throws P2003).
 */
async function resolveStateUser(state: unknown): Promise<string | null> {
  if (typeof state !== 'string' || !ID_RE.test(state)) return null;
  const user = await prisma.user.findUnique({ where: { id: state }, select: { id: true } });
  return user?.id ?? null;
}

/**
 * Initiate Facebook OAuth flow
 */
export const connectFacebookPage = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');
    if (!process.env.META_APP_ID || !process.env.META_APP_SECRET) return fail(req, res, 'PAGE_META_NOT_CONFIGURED');

    // Use environment variable or default to production URL
    const baseUrl = process.env.BACKEND_URL || DEFAULT_BACKEND_URL;
    const redirectUri = `${baseUrl}/api/pages/callback/facebook`;
    const scope = 'pages_show_list,pages_manage_metadata,pages_messaging,pages_read_engagement';

    const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
      `client_id=${process.env.META_APP_ID}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${scope}` +
      `&state=${req.user.userId}`;

    res.json({ authUrl });
  } catch (error) {
    handleError(req, res, error, 'PAGE_CONNECT_FAILED');
  }
};

/**
 * Handle Facebook OAuth callback
 */
export const facebookCallback = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, state, error: fbError } = req.query;
    const frontendUrl = frontendUrlOf();

    // Handle user cancellation or errors
    if (fbError) return sendOAuthError(req, res, 'facebook', 'PAGE_OAUTH_CANCELLED', { reason: String(fbError) });
    if (!code || typeof code !== 'string') return sendOAuthError(req, res, 'facebook', 'PAGE_OAUTH_CODE_MISSING');
    if (!process.env.META_APP_ID || !process.env.META_APP_SECRET) return sendOAuthError(req, res, 'facebook', 'PAGE_META_NOT_CONFIGURED');

    const userId = await resolveStateUser(state);
    if (!userId) return sendOAuthError(req, res, 'facebook', 'PAGE_OAUTH_STATE_INVALID');

    // Exchange code for access token
    const baseUrl = process.env.BACKEND_URL || DEFAULT_BACKEND_URL;
    const redirectUri = `${baseUrl}/api/pages/callback/facebook`;
    const tokenResponse = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
      params: {
        client_id: process.env.META_APP_ID,
        client_secret: process.env.META_APP_SECRET,
        redirect_uri: redirectUri,
        code,
      },
    });

    const userAccessToken = tokenResponse.data.access_token;

    // Get user's pages
    const pagesResponse = await axios.get('https://graph.facebook.com/v18.0/me/accounts', {
      params: {
        fields: 'id,name,access_token,picture{url}',
        access_token: userAccessToken,
      },
    });

    // Save pages to database
    const pages = pagesResponse.data.data || [];
    for (const page of pages) {
      await prisma.page.upsert({
        where: {
          platform_pageId: {
            platform: 'facebook',
            pageId: page.id,
          },
        },
        update: {
          pageName: page.name,
          pageAvatar: page.picture?.data?.url || null,
          pageAccessToken: page.access_token,
          isActive: true,
          userId: userId,
        },
        create: {
          platform: 'facebook',
          pageId: page.id,
          pageName: page.name,
          pageAvatar: page.picture?.data?.url || null,
          pageAccessToken: page.access_token,
          userId: userId,
          isActive: true,
        },
      });

      // Subscribe page to webhook so it receives messages
      try {
        await axios.post(
          `https://graph.facebook.com/v18.0/${page.id}/subscribed_apps`,
          null,
          {
            params: {
              subscribed_fields: 'messages,messaging_postbacks',
              access_token: page.access_token,
            },
          }
        );
        console.log(`Subscribed page ${page.name} (${page.id}) to webhooks`);
      } catch (subErr: any) {
        console.error(`Failed to subscribe page ${page.id}:`, subErr.response?.data || subErr.message);
      }

      // Check for linked Instagram account
      try {
        const igResponse = await axios.get(
          `https://graph.facebook.com/v18.0/${page.id}`,
          {
            params: {
              fields: 'instagram_business_account{id,name,username,profile_picture_url}',
              access_token: page.access_token,
            },
          }
        );

        const igAccount = igResponse.data?.instagram_business_account;
        if (igAccount) {
          await prisma.page.upsert({
            where: {
              platform_pageId: {
                platform: 'instagram',
                pageId: igAccount.id,
              },
            },
            update: {
              pageName: igAccount.username || igAccount.name || `IG-${page.name}`,
              pageAccessToken: page.access_token, // Instagram uses the Facebook page token
              isActive: true,
              userId: userId,
            },
            create: {
              platform: 'instagram',
              pageId: igAccount.id,
              pageName: igAccount.username || igAccount.name || `IG-${page.name}`,
              pageAccessToken: page.access_token,
              userId: userId,
              isActive: true,
            },
          });
          console.log(`Connected Instagram: ${igAccount.username || igAccount.id}`);
        }
      } catch (igErr: any) {
        console.error(`Failed to fetch Instagram for page ${page.id}:`, igErr.response?.data || igErr.message);
      }
    }

    // Send success response back to the app (popup or full-page)
    sendOAuthPopupResult(
      res,
      frontendUrl,
      { type: 'facebook-oauth-success', pages: pages.length },
      `Successfully connected ${pages.length} page(s). Returning to Djaber…`
    );
  } catch (error: any) {
    console.error('Facebook callback error:', error?.response?.data || error);
    if (res.headersSent) return;
    sendOAuthError(req, res, 'facebook', 'PAGE_OAUTH_FAILED');
  }
};

/**
 * Get user's connected pages
 */
export const getUserPages = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const pages = await prisma.page.findMany({
      where: {
        userId: req.user.userId,
        isActive: true,
      },
      select: {
        id: true,
        platform: true,
        pageId: true,
        pageName: true,
        pageAvatar: true,
        isActive: true,
        createdAt: true,
      },
    });

    res.json({ pages });
  } catch (error) {
    handleError(req, res, error, 'PAGE_LIST_FAILED');
  }
};

/**
 * Initiate Instagram Professional Login OAuth flow
 */
export const connectInstagramPage = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');
    if (!process.env.INSTAGRAM_APP_ID || !process.env.INSTAGRAM_APP_SECRET) return fail(req, res, 'PAGE_INSTAGRAM_NOT_CONFIGURED');

    const baseUrl = process.env.BACKEND_URL || DEFAULT_BACKEND_URL;
    const redirectUri = `${baseUrl}/api/pages/callback/instagram`;
    const scope = 'instagram_business_basic,instagram_business_manage_messages';

    const authUrl = `https://www.instagram.com/oauth/authorize?` +
      `client_id=${process.env.INSTAGRAM_APP_ID}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${encodeURIComponent(scope)}` +
      `&response_type=code` +
      `&state=${req.user.userId}`;

    res.json({ authUrl });
  } catch (error) {
    handleError(req, res, error, 'PAGE_CONNECT_FAILED');
  }
};

/**
 * Handle Instagram OAuth callback
 */
export const instagramCallback = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, state, error: igError } = req.query;
    const frontendUrl = frontendUrlOf();

    // Handle user cancellation or errors
    if (igError) return sendOAuthError(req, res, 'instagram', 'PAGE_OAUTH_CANCELLED', { reason: String(igError) });
    if (!code || typeof code !== 'string') return sendOAuthError(req, res, 'instagram', 'PAGE_OAUTH_CODE_MISSING');
    if (!process.env.INSTAGRAM_APP_ID || !process.env.INSTAGRAM_APP_SECRET) return sendOAuthError(req, res, 'instagram', 'PAGE_INSTAGRAM_NOT_CONFIGURED');

    const userId = await resolveStateUser(state);
    if (!userId) return sendOAuthError(req, res, 'instagram', 'PAGE_OAUTH_STATE_INVALID');

    // Step 1: Exchange code for short-lived token
    const baseUrl = process.env.BACKEND_URL || DEFAULT_BACKEND_URL;
    const redirectUri = `${baseUrl}/api/pages/callback/instagram`;

    const tokenResponse = await axios.post(
      'https://api.instagram.com/oauth/access_token',
      new URLSearchParams({
        client_id: process.env.INSTAGRAM_APP_ID,
        client_secret: process.env.INSTAGRAM_APP_SECRET,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code,
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );

    const shortLivedToken = tokenResponse.data.access_token;
    const igUserId = tokenResponse.data.user_id;

    // Step 2: Exchange short-lived token for long-lived token
    let longLivedToken = shortLivedToken;
    try {
      const longTokenResponse = await axios.get('https://graph.instagram.com/access_token', {
        params: {
          grant_type: 'ig_exchange_token',
          client_secret: process.env.INSTAGRAM_APP_SECRET,
          access_token: shortLivedToken,
        },
      });
      longLivedToken = longTokenResponse.data.access_token;
      console.log('Got long-lived Instagram token, expires in:', longTokenResponse.data.expires_in);
    } catch (ltErr: any) {
      console.warn('Failed to get long-lived token, using short-lived:', ltErr.response?.data || ltErr.message);
    }

    // Step 3: Get user profile info (user_id here is the IGSID used in webhooks)
    let username = `instagram-${igUserId}`;
    let igsId = String(igUserId); // fallback to OAuth user_id
    let avatar: string | null = null;
    let profileOk = false;
    try {
      const profileResponse = await axios.get(`https://graph.instagram.com/v21.0/me`, {
        params: {
          fields: 'user_id,username,name,profile_picture_url',
          access_token: longLivedToken,
        },
      });
      username = profileResponse.data.username || username;
      avatar = profileResponse.data.profile_picture_url || null;
      // user_id from the profile API is the IGSID that webhooks use
      if (profileResponse.data.user_id) {
        igsId = String(profileResponse.data.user_id);
      }
      profileOk = true;
      console.log(`Instagram profile: username=${username}, oauth_id=${igUserId}, igsid=${igsId}, hasAvatar=${!!avatar}`);
    } catch (profErr: any) {
      console.warn('Failed to fetch Instagram profile:', profErr.response?.data || profErr.message);
    }

    // Standard Access (app pending Meta approval): non-tester accounts get an
    // OAuth token but every Graph call is refused. Saving would create a broken
    // "instagram-<id>" page whose IGSID doesn't match webhooks â€” refuse cleanly
    // instead, and clean up any junk row from previous attempts.
    if (!profileOk) {
      await prisma.page
        .deleteMany({ where: { platform: 'instagram', pageId: String(igUserId) } })
        .catch(() => {});
      return sendOAuthError(req, res, 'instagram', 'PAGE_INSTAGRAM_PENDING_APPROVAL');
    }

    // Step 4: Save to database using IGSID as pageId (matches webhook entry.id)
    // First, clean up any old record with the OAuth user_id if different
    if (igsId !== String(igUserId)) {
      await prisma.page.deleteMany({
        where: {
          platform: 'instagram',
          pageId: String(igUserId),
        },
      });
    }

    await prisma.page.upsert({
      where: {
        platform_pageId: {
          platform: 'instagram',
          pageId: igsId,
        },
      },
      update: {
        pageName: username,
        pageAvatar: avatar,
        pageAccessToken: longLivedToken,
        isActive: true,
        userId: userId,
      },
      create: {
        platform: 'instagram',
        pageId: igsId,
        pageName: username,
        pageAvatar: avatar,
        pageAccessToken: longLivedToken,
        userId: userId,
        isActive: true,
      },
    });

    console.log(`Connected Instagram account: ${username} (${igUserId})`);

    // Step 5: Subscribe this Instagram account to message webhooks (idempotent, non-fatal)
    try {
      await axios.post(
        `https://graph.instagram.com/v21.0/me/subscribed_apps`,
        null,
        { params: { subscribed_fields: 'messages', access_token: longLivedToken } }
      );
      console.log(`Subscribed Instagram account ${username} to message webhooks`);
    } catch (subErr: any) {
      console.warn(`Failed to subscribe Instagram account ${username}:`, subErr.response?.data || subErr.message);
    }

    // Send success response back to the app (popup or full-page)
    sendOAuthPopupResult(
      res,
      frontendUrl,
      { type: 'instagram-oauth-success', username },
      `Successfully connected Instagram account @${username}. Returning to Djaber…`
    );
  } catch (error: any) {
    console.error('Instagram callback error:', error?.response?.data || error);
    if (res.headersSent) return;
    sendOAuthError(req, res, 'instagram', 'PAGE_OAUTH_FAILED');
  }
};

/**
 * Disconnect a page
 */
export const disconnectPage = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) return fail(req, res, 'UNAUTHORIZED');

    const { pageId } = req.params;
    const pageIdString = Array.isArray(pageId) ? pageId[0] : pageId;
    if (!pageIdString || !ID_RE.test(pageIdString)) return fail(req, res, 'PAGE_NOT_FOUND');

    const page = await prisma.page.findFirst({
      where: {
        id: pageIdString,
        userId: req.user.userId,
      },
    });

    if (!page) return fail(req, res, 'PAGE_NOT_FOUND');

    await prisma.page.update({
      where: { id: pageIdString },
      data: { isActive: false },
    });

    res.json({
      success: true,
      message: 'Page disconnected successfully',
    });
  } catch (error) {
    handleError(req, res, error, 'PAGE_DISCONNECT_FAILED');
  }
};
