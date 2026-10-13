// Tabs of /settings/integrations/[tab] (02-next-route-map §3). Plain module: read by the server route and the client shell.
export const INTEGRATION_TABS = ['sheets', 'api-keys', 'webhooks'] as const;
export type IntegrationTab = (typeof INTEGRATION_TABS)[number];
export const isIntegrationTab = (v: string): v is IntegrationTab => (INTEGRATION_TABS as readonly string[]).includes(v);
