// §3.8 Image rule · §3.9 Cross-sell · §3.10 Product card template · §3.11 Closing · §3.12 Handoff rules.
import { UNCLEAR_STREAK_HANDOFF, VISION_CONFIDENCE_MIN } from '../../ai.constants';
import type { PromptContext } from '../prompt.types';

export const imageRuleSection = (c: PromptContext): string =>
  c.agent.imageRecognition
    ? [
        'IMAGES',
        'A customer photo is analysed before you answer and arrives as a note "IMAGE RESULT: {productId, confidence}", "IMAGE RESULT: unsure", "multiple", "blurry" or "unavailable".',
        `confidence < ${VISION_CONFIDENCE_MIN} or unsure ⇒ ask the customer for confirmation; never state a price for an unconfirmed match.`,
        'multiple ⇒ ask which product; blurry ⇒ ask for a new photo; unavailable ⇒ ask the customer to describe the product.',
      ].join('\n')
    : '';

export const crossSellSection = (c: PromptContext): string =>
  c.agent.capabilities.crossSell === false ? '' : 'CROSS-SELL\nSuggest at most 1 complementary product per conversation, only from ALSO lines, only after the customer chose a product.';

export const cardTemplateSection = (c: PromptContext): string =>
  `PRODUCT CARD\nWhen presenting a product use this template: ${c.agent.productCardTemplate?.trim() || '{name} — {price} DA'}\nList the ids of the products you present in productCards (at most 5); the cards are sent after your text.`;

export const closingSection = (c: PromptContext): string => {
  const text = (c.agent.closingInstructions ?? '').trim();
  return text ? `CLOSING\n${text}` : '';
};

const BUILT_IN: Record<string, string> = {
  human_request: 'customer_request: the customer asks for a human, a manager or a phone call',
  refund: 'refund: the customer asks for a refund or an exchange',
  complaint: 'complaint: the customer complains about an order, a product or the shop',
  anger: 'angry: insults or an angry tone',
  '3_unclear': `unclear_streak: ${UNCLEAR_STREAK_HANDOFF} messages in a row that you could not understand`,
  off_topic: 'off_catalogue: a question the catalogue, the policies and the FAQ cannot answer',
  over_limits: 'order_limits: an order above MAX_QTY_PER_ORDER or MAX_AMOUNT',
  risky_client: 'risky_client: a tool reports a blocked or risky customer and RISKY_CLIENT_POLICY=handoff',
  keyword: 'keyword: the message contains one of HANDOFF_KEYWORDS',
};

export const handoffSection = (c: PromptContext): string => {
  const rules = c.agent.handoffRules;
  const enabled = Object.keys(BUILT_IN).filter((k) => !rules.length || rules.find((r) => r.kind === k)?.enabled !== false);
  const keywords = c.agent.handoffKeywords.map((k) => k.trim()).filter(Boolean);
  const lines = enabled.filter((k) => k !== 'keyword' || keywords.length).map((k) => `- ${BUILT_IN[k]}`);
  const custom = (c.agent.humanHandoffRules ?? '').trim();
  return [
    'HANDOFF TO A HUMAN',
    'Hand the conversation to the team when one of these rules applies:',
    ...lines,
    ...(keywords.length ? [`HANDOFF_KEYWORDS: ${keywords.join(', ')}`] : []),
    ...(custom ? [`Shop rules:\n${custom}`] : []),
    ...(c.unclearStreak >= UNCLEAR_STREAK_HANDOFF - 1 ? [`UNCLEAR_STREAK=${c.unclearStreak}: if this message is unclear too, hand off (unclear_streak).`] : []),
    'Instruction: status=HANDOFF with statusDetail=<rule id> (or call handoff_to_human). Tell the customer briefly that a team member will follow up; do not promise a delay.',
    'status=UNKNOWN when you have no answer but no rule applies; status=UNCLEAR when you did not understand: say so politely in the customer language and ask them to rephrase.',
  ].join('\n');
};
