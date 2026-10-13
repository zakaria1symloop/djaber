import type { ReactNode } from 'react';
import { IntegrationsShell } from '@/features/integrations/integrations-shell';

// IntegrationsTabs (02-next-route-map §1): Google Sheets · Clés API · Webhooks.
export default function IntegrationsLayout({ children }: { children: ReactNode }) {
  return <IntegrationsShell>{children}</IntegrationsShell>;
}
