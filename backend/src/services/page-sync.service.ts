import prisma from '../config/database';
import { fetchPageConversationsFromMeta } from './meta.service';

/**
 * Pull the latest conversations + messages for a page from Facebook
 * and upsert them into our DB. Returns counts so the API can report
 * how many new things showed up.
 */
export async function syncFacebookConversations(internalPageId: string) {
  const page = await prisma.page.findUnique({ where: { id: internalPageId } });
  if (!page) throw new Error('Page not found');
  if (page.platform !== 'facebook') {
    return { newConversations: 0, newMessages: 0, totalConversations: 0, totalMessages: 0 };
  }
  if (!page.pageAccessToken) {
    return { newConversations: 0, newMessages: 0, totalConversations: 0, totalMessages: 0 };
  }

  const fetched = await fetchPageConversationsFromMeta(page.pageId, page.pageAccessToken);

  let newConversations = 0;
  let newMessages = 0;
  let totalConversations = 0;
  let totalMessages = 0;

  for (const fc of fetched) {
    if (!fc.senderId) continue;
    totalConversations += 1;

    // Upsert conversation by (platform, pageId, senderId) unique key
    const existing = await prisma.conversation.findUnique({
      where: {
        platform_pageId_senderId: {
          platform: 'facebook',
          pageId: page.id,
          senderId: fc.senderId,
        },
      },
    });

    let conversation;
    if (existing) {
      conversation = await prisma.conversation.update({
        where: { id: existing.id },
        data: {
          senderName: fc.senderName || existing.senderName,
          updatedAt: new Date(fc.updatedTime),
        },
      });
    } else {
      conversation = await prisma.conversation.create({
        data: {
          pageId: page.id,
          senderId: fc.senderId,
          senderName: fc.senderName,
          platform: 'facebook',
          userId: page.userId,
          status: 'active',
        },
      });
      newConversations += 1;
    }

    for (const m of fc.messages) {
      if (!m.messageId) continue;
      totalMessages += 1;

      const existingMsg = await prisma.message.findUnique({
        where: {
          messageId_conversationId: {
            messageId: m.messageId,
            conversationId: conversation.id,
          },
        },
      });
      if (existingMsg) continue;

      const isFromPage = m.fromId === page.pageId;
      const firstAttachment = m.attachments[0];

      try {
        await prisma.message.create({
          data: {
            conversationId: conversation.id,
            messageId: m.messageId,
            senderId: m.fromId || '',
            recipientId: m.toId || '',
            text: m.text,
            attachmentType: firstAttachment?.type || null,
            attachmentUrl: firstAttachment?.url || null,
            timestamp: new Date(m.createdTime),
            isFromPage,
          },
        });
        newMessages += 1;
      } catch (err) {
        // Skip duplicates from race conditions
      }
    }
  }

  return { newConversations, newMessages, totalConversations, totalMessages };
}
