import axios from 'axios';

const META_GRAPH_API_URL = 'https://graph.facebook.com/v18.0';
const INSTAGRAM_GRAPH_API_URL = 'https://graph.instagram.com/v21.0';

interface SendMessageParams {
  pageAccessToken: string;
  recipientId: string;
  message: string;
  platform: 'facebook' | 'instagram';
}

export class MetaMessagingError extends Error {
  constructor(
    message: string,
    public fbCode?: number,
    public fbSubcode?: number,
    public outsideWindow?: boolean,
  ) {
    super(message);
    this.name = 'MetaMessagingError';
  }
}

async function postFacebookMessage(
  pageAccessToken: string,
  recipientId: string,
  message: string,
  extra: Record<string, any> = {},
): Promise<any> {
  const response = await axios.post(
    `${META_GRAPH_API_URL}/me/messages`,
    {
      recipient: { id: recipientId },
      message: { text: message },
      ...extra,
    },
    { params: { access_token: pageAccessToken } },
  );
  return response.data;
}

export const sendMessage = async ({
  pageAccessToken,
  recipientId,
  message,
  platform,
}: SendMessageParams): Promise<any> => {
  if (platform === 'instagram') {
    try {
      const response = await axios.post(
        `${INSTAGRAM_GRAPH_API_URL}/me/messages`,
        { recipient: { id: recipientId }, message: { text: message } },
        {
          headers: {
            Authorization: `Bearer ${pageAccessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );
      return response.data;
    } catch (error: any) {
      const fbErr = error.response?.data?.error;
      console.error('Meta send message error (instagram):', fbErr || error.message);
      throw new MetaMessagingError(
        fbErr?.message || 'Failed to send Instagram DM',
        fbErr?.code,
        fbErr?.error_subcode,
      );
    }
  }

  // Facebook: try regular send first, then retry with HUMAN_AGENT tag if outside 24h window.
  try {
    return await postFacebookMessage(pageAccessToken, recipientId, message);
  } catch (error: any) {
    const fbErr = error.response?.data?.error;
    const code = fbErr?.code;
    const subcode = fbErr?.error_subcode;
    // 10 / 2018278 = "message sent outside allowed window"
    const outsideWindow = code === 10 && subcode === 2018278;

    if (outsideWindow) {
      try {
        const retried = await postFacebookMessage(pageAccessToken, recipientId, message, {
          messaging_type: 'MESSAGE_TAG',
          tag: 'HUMAN_AGENT',
        });
        return retried;
      } catch (retryErr: any) {
        const retryFbErr = retryErr.response?.data?.error;
        console.error('Meta send message error (HUMAN_AGENT retry):', retryFbErr || retryErr.message);
        throw new MetaMessagingError(
          'This conversation is older than 24 hours. Facebook only lets you reply within that window unless your app has the HUMAN_AGENT permission. Ask the customer to send a new message first.',
          retryFbErr?.code,
          retryFbErr?.error_subcode,
          true,
        );
      }
    }

    console.error('Meta send message error:', fbErr || error.message);
    throw new MetaMessagingError(
      fbErr?.message || 'Failed to send message via Facebook',
      code,
      subcode,
      false,
    );
  }
};

// ============================================================================
// Send product cards as Facebook Generic Template (rich cards with images)
// ============================================================================

interface ProductCard {
  title: string;
  subtitle: string;
  imageUrl?: string;
  productId: string;
}

interface SendProductCardsParams {
  pageAccessToken: string;
  recipientId: string;
  cards: ProductCard[];
  platform: 'facebook' | 'instagram';
}

export const sendProductCards = async ({
  pageAccessToken,
  recipientId,
  cards,
  platform,
}: SendProductCardsParams): Promise<void> => {
  if (cards.length === 0) return;

  // Send each product as: image attachment (full-size, expandable) + text with name/price
  // This way the customer can tap the image to see it big — unlike Generic Templates
  // which embed a tiny thumbnail.
  for (const card of cards.slice(0, 5)) {
    try {
      // 1. Send image as a standalone attachment (clickable/expandable)
      // Only if we have a publicly accessible URL (GCS or external)
      if (card.imageUrl && card.imageUrl.startsWith('http')) {
        const imagePayload = {
          recipient: { id: recipientId },
          message: {
            attachment: {
              type: 'image',
              payload: { url: card.imageUrl, is_reusable: true },
            },
          },
        };

        if (platform === 'instagram') {
          await axios.post(`${INSTAGRAM_GRAPH_API_URL}/me/messages`, imagePayload, {
            headers: { Authorization: `Bearer ${pageAccessToken}`, 'Content-Type': 'application/json' },
          });
        } else {
          await axios.post(`${META_GRAPH_API_URL}/me/messages`, imagePayload, {
            params: { access_token: pageAccessToken },
          });
        }
      }

      // 2. Send product info as a short text message
      const infoText = `🛍 ${card.title}\n💰 ${card.subtitle}`;
      await sendMessage({ pageAccessToken, recipientId, message: infoText, platform });
    } catch (error: any) {
      console.error('Send product card error:', error.response?.data || error.message);
      // Non-fatal — try next card
    }
  }
};

interface GetPageInfoParams {
  pageId: string;
  accessToken: string;
}

export const getPageInfo = async ({
  pageId,
  accessToken,
}: GetPageInfoParams): Promise<any> => {
  try {
    const response = await axios.get(
      `${META_GRAPH_API_URL}/${pageId}`,
      {
        params: {
          fields: 'id,name,access_token',
          access_token: accessToken,
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error('Meta get page info error:', error);
    throw new Error('Failed to get page info from Meta API');
  }
};

interface GetPageInsightsParams {
  pageId: string;
  accessToken: string;
  metrics?: string[];
}

export const getPageInsights = async ({
  pageId,
  accessToken,
  metrics = ['page_followers_count', 'page_impressions', 'page_engaged_users', 'page_post_engagements'],
}: GetPageInsightsParams): Promise<any> => {
  try {
    const response = await axios.get(
      `${META_GRAPH_API_URL}/${pageId}/insights`,
      {
        params: {
          metric: metrics.join(','),
          period: 'day',
          access_token: accessToken,
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error('Meta get page insights error:', error);
    throw new Error('Failed to get page insights from Meta API');
  }
};

// ============================================================================
// Fetch conversations + messages from Facebook (used by manual sync)
// ============================================================================

export interface FetchedConversation {
  conversationId: string; // Facebook's conversation id (t_xxx)
  senderId: string;
  senderName: string | null;
  updatedTime: string;
  messages: Array<{
    messageId: string;
    fromId: string;
    fromName: string | null;
    toId: string;
    text: string | null;
    attachments: Array<{ type: string; url: string | null }>;
    createdTime: string;
  }>;
}

export const fetchPageConversationsFromMeta = async (
  platformPageId: string,
  pageAccessToken: string,
  limit = 25,
  messagesPerConv = 25,
): Promise<FetchedConversation[]> => {
  const url = `${META_GRAPH_API_URL}/${platformPageId}/conversations`;
  const fields = `id,updated_time,participants,messages.limit(${messagesPerConv}){id,from,to,message,attachments,created_time}`;
  const response = await axios.get(url, {
    params: { fields, limit, access_token: pageAccessToken },
  });

  const conversations = response.data?.data || [];

  return conversations.map((conv: any): FetchedConversation => {
    // Pick the participant that is NOT the page itself
    const participants = conv.participants?.data || [];
    const otherParticipant = participants.find((p: any) => p.id !== platformPageId) || participants[0];

    const rawMessages = conv.messages?.data || [];
    const messages = rawMessages.map((m: any) => ({
      messageId: m.id,
      fromId: m.from?.id,
      fromName: m.from?.name || null,
      toId: m.to?.data?.[0]?.id,
      text: m.message || null,
      attachments: (m.attachments?.data || []).map((a: any) => ({
        type: a.mime_type?.startsWith('image/') ? 'image' : (a.image_data ? 'image' : 'file'),
        url: a.image_data?.url || a.file_url || a.video_data?.url || null,
      })),
      createdTime: m.created_time,
    }));

    return {
      conversationId: conv.id,
      senderId: otherParticipant?.id || '',
      senderName: otherParticipant?.name || null,
      updatedTime: conv.updated_time,
      messages,
    };
  });
};

// ============================================================================
// Fetch page posts (used by AI page-analysis wizard)
// ============================================================================

export interface FetchedPost {
  postId: string;
  message: string | null;
  fullPicture: string | null;
  attachments: Array<{ type: string | null; url: string | null; description: string | null }>;
  createdTime: string;
}

export class MetaPermissionError extends Error {
  constructor(message: string, public fbCode?: number, public fbType?: string) {
    super(message);
    this.name = 'MetaPermissionError';
  }
}

export const fetchPagePostsFromMeta = async (
  platformPageId: string,
  pageAccessToken: string,
  limit = 50,
): Promise<FetchedPost[]> => {
  const url = `${META_GRAPH_API_URL}/${platformPageId}/posts`;
  const fields = 'id,message,full_picture,created_time,attachments{media_type,media,description,subattachments}';
  let response;
  try {
    response = await axios.get(url, {
      params: { fields, limit, access_token: pageAccessToken },
    });
  } catch (err: any) {
    const fbError = err.response?.data?.error;
    if (fbError) {
      throw new MetaPermissionError(
        fbError.message || 'Facebook rejected the request',
        fbError.code,
        fbError.type,
      );
    }
    throw err;
  }

  const posts = response.data?.data || [];
  return posts.map((p: any): FetchedPost => {
    const atts: any[] = [];
    const top = p.attachments?.data?.[0];
    if (top) {
      atts.push({
        type: top.media_type || null,
        url: top.media?.image?.src || null,
        description: top.description || null,
      });
      const subs = top.subattachments?.data || [];
      for (const s of subs) {
        atts.push({
          type: s.media_type || null,
          url: s.media?.image?.src || null,
          description: s.description || null,
        });
      }
    }
    return {
      postId: p.id,
      message: p.message || null,
      fullPicture: p.full_picture || null,
      attachments: atts,
      createdTime: p.created_time,
    };
  });
};

interface VerifyWebhookParams {
  mode: string;
  token: string;
  challenge: string;
}

export const verifyWebhook = ({
  mode,
  token,
  challenge,
}: VerifyWebhookParams): string | null => {
  const verifyToken = process.env.META_VERIFY_TOKEN;

  if (mode === 'subscribe' && token === verifyToken) {
    return challenge;
  }

  return null;
};
