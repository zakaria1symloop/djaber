/**
 * Message Batcher — collects rapid-fire messages from the same sender
 * and processes them as a single combined message after a configurable delay.
 *
 * Example: user sends "hello" then "I want" then "a product" within 3s
 * → AI receives "hello\nI want\na product" as one message.
 *
 * Timing contract (important — this is what `Agent.responseDelay` means):
 *   The delay is a BATCHING WINDOW measured from the FIRST message of a burst.
 *   A later message in the same burst accumulates into the batch but NEVER
 *   extends the window past that first deadline, so the window is applied
 *   exactly once (previously every new message re-armed a full delay, which is
 *   how a "3s" setting could become 6s, 9s… before the LLM even started).
 *   The model's generation time is on top of the window and cannot be removed;
 *   `onOpen` lets the caller show a typing indicator immediately, and the
 *   handler receives the measured window so real timings can be logged.
 */

interface PendingBatch {
  messages: string[];
  imageUrls: string[];
  timer: ReturnType<typeof setTimeout>;
  handler: BatchHandler;
  /** Date.now() when the window opened (first message of the burst). */
  startedAt: number;
  /** Absolute deadline = startedAt + delayMs. Never pushed back. */
  deadline: number;
}

export interface BatchMeta {
  /** Real time spent waiting in the batching window, in ms. */
  windowMs: number;
  /** How many customer messages were merged into this batch. */
  messageCount: number;
}

export type BatchHandler = (
  combinedText: string,
  combinedImages: string[],
  meta: BatchMeta
) => Promise<void>;

// Key = conversationId
const batches = new Map<string, PendingBatch>();

/**
 * Queue a message for batching. The handler is called once the window that
 * opened with the first message of the burst elapses.
 *
 * @param onOpen called synchronously only when a NEW window opens (not on
 *   accumulation) — use it to fire the typing indicator right away.
 */
export function queueMessage(
  conversationId: string,
  text: string | null,
  imageUrls: string[],
  delayMs: number,
  handler: BatchHandler,
  onOpen?: () => void
): void {
  const existing = batches.get(conversationId);
  const now = Date.now();

  if (existing) {
    // More messages arriving — accumulate, but keep the ORIGINAL deadline so
    // the configured delay is never applied twice.
    clearTimeout(existing.timer);
    if (text) existing.messages.push(text);
    existing.imageUrls.push(...imageUrls);
    existing.handler = handler; // use latest handler (has latest conversation history)
    const remaining = Math.max(0, existing.deadline - now);
    existing.timer = setTimeout(() => flush(conversationId), remaining);
    return;
  }

  // First message — start a new batch
  const wait = Math.max(0, delayMs);
  const batch: PendingBatch = {
    messages: text ? [text] : [],
    imageUrls: [...imageUrls],
    handler,
    startedAt: now,
    deadline: now + wait,
    timer: setTimeout(() => flush(conversationId), wait),
  };
  batches.set(conversationId, batch);

  // Tell the caller the window just opened (typing indicator, etc.)
  if (onOpen) {
    try {
      onOpen();
    } catch {
      /* never let the hook break batching */
    }
  }
}

async function flush(conversationId: string): Promise<void> {
  const batch = batches.get(conversationId);
  if (!batch) return;
  // Deleted BEFORE awaiting the handler: a message arriving during generation
  // opens a fresh window instead of being swallowed or re-arming this one.
  batches.delete(conversationId);

  const combinedText = batch.messages.join('\n').trim();
  const combinedImages = [...new Set(batch.imageUrls)]; // dedupe
  const meta: BatchMeta = {
    windowMs: Date.now() - batch.startedAt,
    messageCount: batch.messages.length,
  };

  try {
    await batch.handler(combinedText, combinedImages, meta);
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
