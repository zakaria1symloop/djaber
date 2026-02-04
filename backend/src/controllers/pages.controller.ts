import { Request, Response } from 'express';
import axios from 'axios';
import prisma from '../config/database';

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
    const scope = 'pages_show_list,pages_manage_metadata,pages_messaging,instagram_basic,instagram_manage_messages';

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
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5175';

    // Handle user cancellation or errors
    if (fbError) {
      res.send(`
        <html>
          <body>
            <script>
              window.opener && window.opener.postMessage({ type: 'facebook-oauth-error', error: '${fbError}' }, '${frontendUrl}');
              window.close();
            </script>
            <p>Authorization cancelled. This window will close automatically.</p>
          </body>
        </html>
      `);
      return;
    }

    if (!code) {
      res.send(`
        <html>
          <body>
            <script>
              window.opener && window.opener.postMessage({ type: 'facebook-oauth-error', error: 'No authorization code' }, '${frontendUrl}');
              window.close();
            </script>
            <p>Authorization failed. This window will close automatically.</p>
          </body>
        </html>
      `);
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
          pageAccessToken: page.access_token,
          isActive: true,
          userId: userId,
        },
        create: {
          platform: 'facebook',
          pageId: page.id,
          pageName: page.name,
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

    // Send success response that closes the popup
    res.send(`
      <html>
        <body>
          <script>
            window.opener && window.opener.postMessage({ type: 'facebook-oauth-success', pages: ${pages.length} }, '${frontendUrl}');
            window.close();
          </script>
          <p>Successfully connected ${pages.length} page(s). This window will close automatically.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Facebook callback error:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5175';
    res.send(`
      <html>
        <body>
          <script>
            window.opener && window.opener.postMessage({ type: 'facebook-oauth-error', error: 'Connection failed' }, '${frontendUrl}');
            window.close();
          </script>
          <p>Failed to connect pages. This window will close automatically.</p>
        </body>
      </html>
    `);
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
