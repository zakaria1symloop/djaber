import { Request, Response } from 'express';
import axios from 'axios';
import prisma from '../config/database';
import { fail, handleError, resolveLang, translate, type ErrorCode, type Params } from '../errors';

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
  extra: Record<string, unknown> = {},
  params?: Params
): void {
  const message = translate(resolveLang(req), code, params);
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

// ---------------------------------------------------------------------------
// Facebook page listing + claiming helpers
// ---------------------------------------------------------------------------

/** One entry of `GET /me/accounts`. `access_token` / `tasks` may be absent. */
interface GraphPage {
  id?: string;
  name?: string;
  access_token?: string;
  tasks?: string[];
  picture?: { data?: { url?: string } };
}

/** Per-page outcome of the connect loop, reported back to the popup. */
interface PageOutcome {
  pageId: string;
  pageName: string;
  status: 'connected' | 'skipped' | 'warning';
  code?: ErrorCode;
  message?: string;
}

/** Graph `tasks` values that let an app receive/send messages for a page. */
const MESSAGING_TASKS = ['MESSAGING', 'MANAGE', 'MODERATE'];

const PAGES_PER_GRAPH_CALL = 100;
const MAX_PAGES = 200;

/**
 * Every page the user has a role on. `/me/accounts` is paginated (25 per page
 * by default), so we ask for 100 at a time AND follow `paging.next` until it
 * runs out — otherwise a merchant with many pages silently loses all but the
 * first batch. Hard-capped at MAX_PAGES so a huge Business Manager cannot hang
 * the OAuth callback.
 */
async function fetchAllFacebookPages(userAccessToken: string): Promise<GraphPage[]> {
  const collected: GraphPage[] = [];
  let url: string | null = 'https://graph.facebook.com/v18.0/me/accounts';
  let params: Record<string, string | number> | undefined = {
    fields: 'id,name,access_token,tasks,picture{url}',
    limit: PAGES_PER_GRAPH_CALL,
    access_token: userAccessToken,
  };

  while (url && collected.length < MAX_PAGES) {
    const response: { data?: { data?: GraphPage[]; paging?: { next?: string } } } = await axios.get(url, { params });
    const batch = response.data?.data;
    if (!Array.isArray(batch) || batch.length === 0) break;
    collected.push(...batch);
    // `paging.next` already carries fields/limit/token/cursor in its query string.
    url = response.data?.paging?.next ?? null;
    params = undefined;
  }

  // De-duplicate (a cursor replay can repeat an entry) and drop entries with no id.
  const seen = new Set<string>();
  return collected
    .filter((p) => typeof p.id === 'string' && p.id !== '')
    .filter((p) => (seen.has(p.id as string) ? false : (seen.add(p.id as string), true)))
    .slice(0, MAX_PAGES);
}

/**
 * Save a page for `userId`, refusing to steal it from someone else.
 *
 * `Page` is unique on (platform, pageId) GLOBALLY, so a blind `upsert` on that
 * key silently reassigns a page already connected by another account (a former
 * test account, a partner, a previous owner). Re-connecting your OWN page must
 * keep working (and refresh the token), so: look the row up first, let the
 * owner through, refuse anybody else with a translated code.
 */
/**
 * Run `worker` over `items` with at most `limit` in flight. The OAuth callback
 * does two Graph round-trips per page (webhook subscribe + Instagram lookup);
 * serialising them made a merchant with a dozen pages wait seconds after
 * approving on Facebook. The cap keeps us well inside Graph's rate limits.
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      out[index] = await worker(items[index]);
    }
  });
  await Promise.all(runners);
  return out;
}

async function claimPage(
  userId: string,
  platform: 'facebook' | 'instagram',
  pageId: string,
  data: { pageName: string; pageAvatar?: string | null; pageAccessToken: string }
): Promise<{ ok: true } | { ok: false; code: ErrorCode }> {
  const existing = await prisma.page.findUnique({
    where: { platform_pageId: { platform, pageId } },
    select: { id: true, userId: true },
  });

  if (existing && existing.userId !== userId) return { ok: false, code: 'PAGE_ALREADY_CONNECTED_ELSEWHERE' };

  if (existing) {
    await prisma.page.update({
      where: { id: existing.id },
      data: {
        pageName: data.pageName,
        ...(data.pageAvatar !== undefined ? { pageAvatar: data.pageAvatar } : {}),
        pageAccessToken: data.pageAccessToken,
        isActive: true,
      },
    });
    return { ok: true };
  }

  await prisma.page.create({
    data: {
      platform,
      pageId,
      pageName: data.pageName,
      pageAvatar: data.pageAvatar ?? null,
      pageAccessToken: data.pageAccessToken,
      userId,
      isActive: true,
    },
  });
  return { ok: true };
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

    // Get user's pages — every page, not just Graph's first 25.
    let pages: GraphPage[];
    try {
      pages = await fetchAllFacebookPages(userAccessToken);
    } catch (listErr: any) {
      console.error('Failed to list Facebook pages:', listErr?.response?.data || listErr?.message);
      return sendOAuthError(req, res, 'facebook', 'PAGE_LIST_FETCH_FAILED');
    }

    if (pages.length === 0) return sendOAuthError(req, res, 'facebook', 'PAGE_NONE_AVAILABLE');

    const lang = resolveLang(req);
    const results: PageOutcome[] = [];

    // One page's problem must never abort the whole run: every page is
    // isolated, records its own outcome, and they run concurrently so the
    // merchant is not left waiting after approving on Facebook.
    const perPage = await mapWithConcurrency(pages, 6, async (page) => {
      const own: PageOutcome[] = [];
      const note = (pageId: string, pageName: string, status: PageOutcome['status'], code?: ErrorCode): void => {
        own.push({
          pageId,
          pageName,
          status,
          ...(code ? { code, message: translate(lang, code, { pageName }) } : {}),
        });
      };

      const pageId = String(page.id);
      const pageName = page.name || pageId;

      try {
        // No page token → nothing can be stored or subscribed (the merchant
        // most likely unticked this page in the Meta consent screen).
        if (!page.access_token) {
          note(pageId, pageName, 'skipped', 'PAGE_ACCESS_TOKEN_MISSING');
          return own;
        }

        // Graph only returns pages the user has a role on, but the role must
        // include messaging or the webhook will never fire for this page.
        if (Array.isArray(page.tasks) && !page.tasks.some((task) => MESSAGING_TASKS.includes(String(task).toUpperCase()))) {
          note(pageId, pageName, 'skipped', 'PAGE_MESSAGING_PERMISSION_MISSING');
          return own;
        }

        const claimed = await claimPage(userId, 'facebook', pageId, {
          pageName,
          pageAvatar: page.picture?.data?.url || null,
          pageAccessToken: page.access_token,
        });
        if (!claimed.ok) {
          note(pageId, pageName, 'skipped', claimed.code);
          return own;
        }

        // Subscribe page to webhook so it receives messages. A refusal here
        // means the page is saved but deaf — report it as a warning instead of
        // letting the merchant believe it is live.
        let subscribed = true;
        try {
          await axios.post(
            `https://graph.facebook.com/v18.0/${pageId}/subscribed_apps`,
            null,
            {
              params: {
                subscribed_fields: 'messages,messaging_postbacks',
                access_token: page.access_token,
              },
            }
          );
          console.log(`Subscribed page ${pageName} (${pageId}) to webhooks`);
        } catch (subErr: any) {
          subscribed = false;
          console.error(`Failed to subscribe page ${pageId}:`, subErr.response?.data || subErr.message);
        }

        note(pageId, pageName, subscribed ? 'connected' : 'warning', subscribed ? undefined : 'PAGE_WEBHOOK_SUBSCRIBE_FAILED');

        // Check for linked Instagram account (never fatal for the page itself)
        try {
          const igResponse = await axios.get(
            `https://graph.facebook.com/v18.0/${pageId}`,
            {
              params: {
                fields: 'instagram_business_account{id,name,username,profile_picture_url}',
                access_token: page.access_token,
              },
            }
          );

          const igAccount = igResponse.data?.instagram_business_account;
          if (igAccount?.id) {
            const igName = igAccount.username || igAccount.name || `IG-${pageName}`;
            const igClaimed = await claimPage(userId, 'instagram', String(igAccount.id), {
              pageName: igName,
              pageAccessToken: page.access_token, // Instagram uses the Facebook page token
            });
            if (igClaimed.ok) {
              note(String(igAccount.id), igName, 'connected');
              console.log(`Connected Instagram: ${igName}`);
            } else {
              note(String(igAccount.id), igName, 'skipped', igClaimed.code);
            }
          }
        } catch (igErr: any) {
          console.error(`Failed to fetch Instagram for page ${pageId}:`, igErr.response?.data || igErr.message);
        }
      } catch (pageErr: any) {
        console.error(`Failed to connect page ${pageId}:`, pageErr?.response?.data || pageErr?.message || pageErr);
        note(pageId, pageName, 'skipped', 'PAGE_SAVE_FAILED');
      }

      return own;
    });

    results.push(...perPage.flat());

    const usable = results.filter((r) => r.status === 'connected' || r.status === 'warning');
    const skipped = results.filter((r) => r.status === 'skipped');

    // Nothing could be connected: answer with the real reason, not a success.
    if (usable.length === 0) {
      return sendOAuthError(
        req,
        res,
        'facebook',
        'PAGE_NONE_CONNECTED',
        { total: pages.length, results: skipped },
        { total: pages.length }
      );
    }

    // Send success response back to the app (popup or full-page)
    sendOAuthPopupResult(
      res,
      frontendUrl,
      {
        type: 'facebook-oauth-success',
        pages: usable.length,
        connected: usable.length,
        total: pages.length,
        results,
      },
      `Successfully connected ${usable.length} page(s)${skipped.length > 0 ? `, ${skipped.length} skipped` : ''}. Returning to Djaber…`
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
        .deleteMany({ where: { platform: 'instagram', pageId: String(igUserId), userId } })
        .catch(() => {});
      return sendOAuthError(req, res, 'instagram', 'PAGE_INSTAGRAM_PENDING_APPROVAL');
    }

    // Step 4: Save to database using IGSID as pageId (matches webhook entry.id)
    // First, clean up any old record with the OAuth user_id if different
    // Scoped to this user: a global deleteMany would wipe another account's page.
    if (igsId !== String(igUserId)) {
      await prisma.page.deleteMany({
        where: {
          platform: 'instagram',
          pageId: String(igUserId),
          userId,
        },
      });
    }

    const igClaimed = await claimPage(userId, 'instagram', igsId, {
      pageName: username,
      pageAvatar: avatar,
      pageAccessToken: longLivedToken,
    });
    if (!igClaimed.ok) {
      return sendOAuthError(req, res, 'instagram', igClaimed.code, { pageName: username }, { pageName: username });
    }

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
