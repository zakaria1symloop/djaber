// §3.6 Delivery · §3.7 Order-taking rules (agent behaviour step 3).
import { AGENT_DEFAULT_MAX_AMOUNT, AGENT_DEFAULT_MAX_QTY } from '@djaber/shared';
import type { PromptContext } from '../prompt.types';

export const deliverySection = (c: PromptContext): string =>
  [
    `DELIVERY FEES: use quote_delivery.${c.workspace.freeDeliveryThreshold ? ` Free delivery from ${c.workspace.freeDeliveryThreshold} DA.` : ''}`,
    ...(c.workspace.senderWilaya ? [`Orders ship from ${c.workspace.senderWilaya}.`] : []),
    'Never state a delivery fee that did not come from the tool.',
  ].join('\n');

const FIELD_TEXT: Record<string, string> = {
  product: 'product+variant',
  quantity: 'quantity',
  name: 'name',
  phone: 'phone (10 digits, 05/06/07)',
  wilaya: 'wilaya',
  commune: 'commune',
  address: 'address or stop-desk',
  phone2: 'secondPhone',
  note: 'note',
};
const DEFAULT_REQUIRED = ['product', 'quantity', 'name', 'phone', 'wilaya', 'commune', 'address'];

export const orderRulesSection = (c: PromptContext): string => {
  const fields = c.agent.orderFields;
  const required = fields.length ? fields.filter((f) => f.required).map((f) => f.key as string) : DEFAULT_REQUIRED;
  const optional = fields.length ? fields.filter((f) => !f.required).map((f) => f.key as string) : ['phone2', 'note'];
  const order = Object.keys(FIELD_TEXT);
  const list = (keys: string[]) => order.filter((k) => keys.includes(k)).map((k) => FIELD_TEXT[k]);
  return [
    'ORDER TAKING',
    `Required fields, in this order: ${list(required).join(' → ')}`,
    ...(optional.length ? [`Optional fields: ${list(optional).join(', ')}`] : []),
    `MAX_QTY_PER_ORDER=${c.agent.maxQtyPerOrder ?? AGENT_DEFAULT_MAX_QTY}`,
    `MAX_AMOUNT=${c.agent.maxAmountPerOrder ?? AGENT_DEFAULT_MAX_AMOUNT} DA`,
    'An order above one of these limits is never created: hand off (status=HANDOFF, statusDetail=order_limits).',
    `RISKY_CLIENT_POLICY=${c.agent.riskyClientBehavior ?? 'take_and_flag'}`,
    `RECAP=${c.agent.recapMode ?? 'always'}`,
    'Ask one field at a time; never invent a value; re-ask an invalid value with an example (0555123456).',
    'Before create_order, show a recap (items, quantities, prices, delivery fee, total, address) and wait for an explicit confirmation of the customer.',
    'Call create_order only once per confirmed recap. If the tool says the order already exists (duplicateOf), confirm that order instead of creating another one.',
    'When the customer wants to cancel, use cancel_order only (ask which order when there are several); never call create_order to cancel or replace.',
    'Payment is cash on delivery unless a payment link tool is available.',
  ].join('\n');
};
