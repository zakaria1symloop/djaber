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

    const redirectUri = `${process.env.FRONTEND_URL}/api/auth/facebook/callback`;
    const scope = 'pages_show_list,pages_read_engagement,pages_manage_metadata,pages_messaging';

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
    const { code, state } = req.query;
    const userId = state as string;

    if (!code) {
      res.status(400).json({ error: 'Bad Request', message: 'Authorization code missing' });
      return;
    }

    // Exchange code for access token
    const redirectUri = `${process.env.FRONTEND_URL}/api/auth/facebook/callback`;
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
    const pages = pagesResponse.data.data;
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
    }

    res.json({
      success: true,
      message: `Successfully connected ${pages.length} page(s)`,
      pages: pages.map((p: any) => ({ id: p.id, name: p.name })),
    });
  } catch (error) {
    console.error('Facebook callback error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to connect Facebook pages',
    });
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
