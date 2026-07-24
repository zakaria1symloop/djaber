import { Request, Response } from 'express';
import axios from 'axios';
import prisma from '../config/database';

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
 * Initiate Facebook OAuth flow
 */
export const connectFacebookPage = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
      return;
    }

    // Use environment variable or default to production URL
    const baseUrl = process.env.BACKEND_URL || 'https://djaberio.symloop.com';
    const redirectUri = `${baseUrl}/api/pages/callback/facebook`;
    const scope = 'pages_show_list,pages_manage_metadata,pages_messaging,pages_read_engagement';

    const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
      `client_id=${process.env.META_APP_ID}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${scope}` +
      `&state=${req.user.userId}`;

    res.json({ authUrl });
  } catch (error) {
    console.error('Facebook connect error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to initiate Facebook connection',
    });
  }
};

/**
 * Handle Facebook OAuth callback
 */
export const facebookCallback = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, state, error: fbError } = req.query;
    const userId = state as string;
    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5175').split(',')[0].trim();

    // Handle user cancellation or errors
    if (fbError) {
      sendOAuthPopupResult(
        res,
        frontendUrl,
        { type: 'facebook-oauth-error', error: String(fbError) },
        'Authorization cancelled. Returning to Djaber…'
      );
      return;
    }

    if (!code) {
      sendOAuthPopupResult(
        res,
        frontendUrl,
        { type: 'facebook-oauth-error', error: 'No authorization code' },
        'Authorization failed. Returning to Djaber…'
      );
      return;
    }

    // Exchange code for access token
    const baseUrl = process.env.BACKEND_URL || 'https://djaberio.symloop.com';
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
  } catch (error) {
    console.error('Facebook callback error:', error);
    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5175').split(',')[0].trim();
    sendOAuthPopupResult(
      res,
      frontendUrl,
      { type: 'facebook-oauth-error', error: 'Connection failed' },
      'Failed to connect pages. Returning to Djaber…'
    );
  }
};

/**
 * Get user's connected pages
 */
export const getUserPages = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
      return;
    }

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
    console.error('Get pages error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch pages',
    });
  }
};

/**
 * Initiate Instagram Professional Login OAuth flow
 */
export const connectInstagramPage = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
      return;
    }

    const baseUrl = process.env.BACKEND_URL || 'https://djaberio.symloop.com';
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
    console.error('Instagram connect error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to initiate Instagram connection',
    });
  }
};

/**
 * Handle Instagram OAuth callback
 */
export const instagramCallback = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, state, error: igError } = req.query;
    const userId = state as string;
    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5175').split(',')[0].trim();

    // Handle user cancellation or errors
    if (igError) {
      sendOAuthPopupResult(
        res,
        frontendUrl,
        { type: 'instagram-oauth-error', error: String(igError) },
        'Authorization cancelled. Returning to Djaber…'
      );
      return;
    }

    if (!code) {
      sendOAuthPopupResult(
        res,
        frontendUrl,
        { type: 'instagram-oauth-error', error: 'No authorization code' },
        'Authorization failed. Returning to Djaber…'
      );
      return;
    }

    // Step 1: Exchange code for short-lived token
    const baseUrl = process.env.BACKEND_URL || 'https://djaberio.symloop.com';
    const redirectUri = `${baseUrl}/api/pages/callback/instagram`;

    const tokenResponse = await axios.post(
      'https://api.instagram.com/oauth/access_token',
      new URLSearchParams({
        client_id: process.env.INSTAGRAM_APP_ID || '',
        client_secret: process.env.INSTAGRAM_APP_SECRET || '',
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code: code as string,
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
      const pendingMsg =
        'This Instagram account cannot be connected yet: the app is pending Meta approval. ' +
        'To test now, add this account as an Instagram Tester (App Roles) and accept the invite in the Instagram app.';
      sendOAuthPopupResult(
        res,
        frontendUrl,
        { type: 'instagram-oauth-error', error: pendingMsg },
        pendingMsg
      );
      return;
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
    console.error('Instagram callback error:', error.response?.data || error);
    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5175').split(',')[0].trim();
    sendOAuthPopupResult(
      res,
      frontendUrl,
      { type: 'instagram-oauth-error', error: 'Connection failed' },
      'Failed to connect Instagram. Returning to Djaber…'
    );
  }
};

/**
 * Disconnect a page
 */
export const disconnectPage = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
      return;
    }

    const { pageId } = req.params;
    const pageIdString = Array.isArray(pageId) ? pageId[0] : pageId;

    const page = await prisma.page.findFirst({
      where: {
        id: pageIdString,
        userId: req.user.userId,
      },
    });

    if (!page) {
      res.status(404).json({ error: 'Not Found', message: 'Page not found' });
      return;
    }

    await prisma.page.update({
      where: { id: pageIdString },
      data: { isActive: false },
    });

    res.json({
      success: true,
      message: 'Page disconnected successfully',
    });
  } catch (error) {
    console.error('Disconnect page error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to disconnect page',
    });
  }
};
