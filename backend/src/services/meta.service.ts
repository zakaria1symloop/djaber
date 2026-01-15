import axios from 'axios';

const META_GRAPH_API_URL = 'https://graph.facebook.com/v18.0';

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
    const endpoint = platform === 'instagram'
      ? `${META_GRAPH_API_URL}/me/messages`
      : `${META_GRAPH_API_URL}/me/messages`;

    const response = await axios.post(
      endpoint,
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
  } catch (error) {
    console.error('Meta send message error:', error);
    throw new Error('Failed to send message via Meta API');
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
