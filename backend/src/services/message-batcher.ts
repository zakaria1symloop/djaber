/**
 * Message Batcher — collects rapid-fire messages from the same sender
 * and processes them as a single combined message after a configurable delay.
 *
 * Example: user sends "hello" then "I want" then "a product" within 3s
 * → AI receives "hello\nI want\na product" as one message.
 */

interface PendingBatch {
  messages: string[];
  imageUrls: string[];
  timer: ReturnType<typeof setTimeout>;
  handler: (combinedText: string, combinedImages: string[]) => Promise<void>;
}

// Key = conversationId
const batches = new Map<string, PendingBatch>();

/**
 * Queue a message for batching. If no more messages arrive within `delayMs`,
 * the handler is called with all accumulated messages joined by newline.
 */
export function queueMessage(
  conversationId: string,
  text: string | null,
  imageUrls: string[],
  delayMs: number,
  handler: (combinedText: string, combinedImages: string[]) => Promise<void>
): void {
  const existing = batches.get(conversationId);

  if (existing) {
    // More messages arriving — reset timer, accumulate
    clearTimeout(existing.timer);
    if (text) existing.messages.push(text);
    existing.imageUrls.push(...imageUrls);
    existing.handler = handler; // use latest handler (has latest conversation history)
    existing.timer = setTimeout(() => flush(conversationId), delayMs);
  } else {
    // First message — start new batch
    const batch: PendingBatch = {
      messages: text ? [text] : [],
      imageUrls: [...imageUrls],
      handler,
      timer: setTimeout(() => flush(conversationId), delayMs),
    };
    batches.set(conversationId, batch);
  }
}

async function flush(conversationId: string): Promise<void> {
  const batch = batches.get(conversationId);
  if (!batch) return;
  batches.delete(conversationId);

  const combinedText = batch.messages.join('\n').trim();
  const combinedImages = [...new Set(batch.imageUrls)]; // dedupe

  try {
    await batch.handler(combinedText, combinedImages);
  } catch (error) {
    console.error(`Message batch handler error for conversation ${conversationId}:`, error);
  }
}

/**
 * Check if a conversation has a pending batch (used to avoid double-processing).
 */
export function hasPendingBatch(conversationId: string): boolean {
  return batches.has(conversationId);
}
