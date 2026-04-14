import axios from 'axios';

const META_GRAPH_API_URL = 'https://graph.facebook.com/v18.0';
const INSTAGRAM_GRAPH_API_URL = 'https://graph.instagram.com/v21.0';

interface SendMessageParams {
  pageAccessToken: string;
  recipientId: string;
  message: string;
  platform: 'facebook' | 'instagram';
}

export const sendMessage = async ({
  pageAccessToken,
  recipientId,
  message,
  platform,
}: SendMessageParams): Promise<any> => {
  try {
    if (platform === 'instagram') {
      // Instagram API requires Authorization header
      const response = await axios.post(
        `${INSTAGRAM_GRAPH_API_URL}/me/messages`,
        {
          recipient: { id: recipientId },
          message: { text: message },
        },
        {
          headers: {
            'Authorization': `Bearer ${pageAccessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return response.data;
    }

    // Facebook uses access_token as query param
    const response = await axios.post(
      `${META_GRAPH_API_URL}/me/messages`,
      {
        recipient: { id: recipientId },
        message: { text: message },
      },
      {
        params: {
          access_token: pageAccessToken,
        },
      }
    );

    return response.data;
  } catch (error: any) {
    console.error('Meta send message error:', error.response?.data || error.message);
    throw new Error('Failed to send message via Meta API');
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

  // Instagram doesn't support templates — fall back to text
  if (platform === 'instagram') {
    const text = cards.map((c) => `🛍 ${c.title}\n${c.subtitle}`).join('\n\n');
    await sendMessage({ pageAccessToken, recipientId, message: text, platform });
    return;
  }

  // Facebook Generic Template — max 10 elements
  const elements = cards.slice(0, 10).map((card) => {
    const elem: Record<string, unknown> = {
      title: card.title.slice(0, 80),
      subtitle: card.subtitle.slice(0, 80),
    };
    if (card.imageUrl) {
      elem.image_url = card.imageUrl;
    }
    return elem;
  });

  try {
    await axios.post(
      `${META_GRAPH_API_URL}/me/messages`,
      {
        recipient: { id: recipientId },
        message: {
          attachment: {
            type: 'template',
            payload: {
              template_type: 'generic',
              elements,
            },
          },
        },
      },
      {
        params: { access_token: pageAccessToken },
      }
    );
  } catch (error: any) {
    console.error('Send product cards error:', error.response?.data || error.message);
    // Non-fatal — the text message was already sent
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
