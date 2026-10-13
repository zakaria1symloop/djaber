'use client';
// One tab of Settings › Intégrations. The card of each tab is the matching block of the Figma frame.
import { ApiKeysTab } from './api-keys-tab';
import { SheetsTab } from './sheets-tab';
import type { IntegrationTab } from './tabs';
import { WebhooksTab } from './webhooks-tab';

export function IntegrationTabPage({ tab }: { tab: IntegrationTab }) {
  if (tab === 'api-keys') return <ApiKeysTab />;
  if (tab === 'webhooks') return <WebhooksTab />;
  return <SheetsTab />;
}
